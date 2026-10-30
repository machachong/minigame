from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.account import Account
from app.models.user import User
from app.schemas.account import AccountCreate, AccountOut
from app.services.membership import require_book_member

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountOut])
def list_accounts(
    book_id: int = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_book_member(db, user, book_id)
    return (
        db.query(Account)
        .filter(Account.book_id == book_id, Account.deleted_at.is_(None))
        .order_by(Account.id)
        .all()
    )


@router.post("", response_model=AccountOut)
def create_account(
    body: AccountCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_book_member(db, user, body.book_id)
    acc = Account(
        user_id=user.id,
        book_id=body.book_id,
        name=body.name,
        balance_cents=body.balance_cents,
        icon=body.icon,
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return acc


@router.delete("/{account_id}")
def delete_account(
    account_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    acc = db.query(Account).filter(Account.id == account_id, Account.deleted_at.is_(None)).first()
    if not acc:
        raise HTTPException(404, "账户不存在")
    require_book_member(db, user, acc.book_id)
    acc.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}
