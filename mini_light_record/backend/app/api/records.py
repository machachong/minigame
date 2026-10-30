from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.account import Account
from app.models.category import Category
from app.models.record import Record
from app.models.user import User
from app.schemas.record import RecordCreate, RecordOut
from app.services.membership import MANAGE_ROLES, require_book_member

router = APIRouter(prefix="/api/records", tags=["records"])


def _to_out(
    rec: Record,
    cat: Category | None = None,
    acc: Account | None = None,
    nickname: str | None = None,
) -> RecordOut:
    return RecordOut(
        id=rec.id,
        book_id=rec.book_id,
        account_id=rec.account_id,
        category_id=rec.category_id,
        type=rec.type,
        amount_cents=rec.amount_cents,
        note=rec.note or "",
        record_date=rec.record_date,
        created_at=rec.created_at,
        category_name=cat.name if cat else None,
        category_icon=cat.icon if cat else None,
        account_name=acc.name if acc else None,
        user_id=rec.user_id,
        user_nickname=nickname,
    )


@router.get("", response_model=list[RecordOut])
def list_records(
    book_id: int = Query(...),
    year_month: str | None = Query(None, description="YYYY-MM"),
    type: str | None = Query(None),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_book_member(db, user, book_id)

    q = db.query(Record).filter(
        Record.book_id == book_id,
        Record.deleted_at.is_(None),
    )
    if year_month:
        try:
            y, m = map(int, year_month.split("-"))
            start = date(y, m, 1)
            end = date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)
            q = q.filter(Record.record_date >= start, Record.record_date < end)
        except ValueError:
            raise HTTPException(400, "year_month 格式应为 YYYY-MM")
    if type:
        q = q.filter(Record.type == type)

    rows = q.order_by(Record.record_date.desc(), Record.id.desc()).limit(limit).all()
    cat_ids = {r.category_id for r in rows}
    acc_ids = {r.account_id for r in rows}
    user_ids = {r.user_id for r in rows}
    cats = {c.id: c for c in db.query(Category).filter(Category.id.in_(cat_ids)).all()} if cat_ids else {}
    accs = {a.id: a for a in db.query(Account).filter(Account.id.in_(acc_ids)).all()} if acc_ids else {}
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}
    return [
        _to_out(
            r,
            cats.get(r.category_id),
            accs.get(r.account_id),
            users[r.user_id].nickname if r.user_id in users else None,
        )
        for r in rows
    ]


@router.post("", response_model=RecordOut)
def create_record(
    body: RecordCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_book_member(db, user, body.book_id)
    cat = (
        db.query(Category)
        .filter(Category.id == body.category_id, Category.book_id == body.book_id)
        .first()
    )
    if not cat:
        raise HTTPException(400, "分类不存在")
    if cat.type != body.type:
        raise HTTPException(400, "分类类型与收支类型不一致")
    if cat.parent_id is None:
        raise HTTPException(400, "只能记在二级小类上，不能直接记在大类")
    acc = (
        db.query(Account)
        .filter(
            Account.id == body.account_id,
            Account.book_id == body.book_id,
            Account.deleted_at.is_(None),
        )
        .first()
    )
    if not acc:
        raise HTTPException(400, "账户不存在")

    rd = body.record_date or date.today()
    rec = Record(
        user_id=user.id,
        book_id=body.book_id,
        account_id=body.account_id,
        category_id=body.category_id,
        type=body.type,
        amount_cents=body.amount_cents,
        note=body.note or "",
        record_date=rd,
    )
    if body.type == "expense":
        acc.balance_cents -= body.amount_cents
    else:
        acc.balance_cents += body.amount_cents

    db.add(rec)
    db.commit()
    db.refresh(rec)
    return _to_out(rec, cat, acc, user.nickname)


@router.delete("/{record_id}")
def delete_record(
    record_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rec = db.query(Record).filter(Record.id == record_id, Record.deleted_at.is_(None)).first()
    if not rec:
        raise HTTPException(404, "记录不存在")
    _book, member = require_book_member(db, user, rec.book_id)
    if rec.user_id != user.id and member.role not in MANAGE_ROLES:
        raise HTTPException(403, "只能删除自己的流水")
    acc = db.get(Account, rec.account_id)
    if acc and acc.deleted_at is None:
        if rec.type == "expense":
            acc.balance_cents += rec.amount_cents
        else:
            acc.balance_cents -= rec.amount_cents
    rec.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}
