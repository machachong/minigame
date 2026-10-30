from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.budget import Budget
from app.models.category import Category
from app.models.record import Record
from app.models.user import User
from app.schemas.stats import CategoryStatItem, CategoryStatsOut, SummaryOut
from app.services.membership import require_book_member

router = APIRouter(prefix="/api/stats", tags=["stats"])


def _month_range(year_month: str) -> tuple[date, date]:
    try:
        y, m = map(int, year_month.split("-"))
        start = date(y, m, 1)
        end = date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)
        return start, end
    except ValueError:
        raise HTTPException(400, "year_month 格式应为 YYYY-MM")


@router.get("/summary", response_model=SummaryOut)
def summary(
    book_id: int = Query(...),
    year_month: str = Query(..., description="YYYY-MM"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_book_member(db, user, book_id)
    start, end = _month_range(year_month)

    def _sum(rtype: str) -> int:
        v = (
            db.query(func.coalesce(func.sum(Record.amount_cents), 0))
            .filter(
                Record.book_id == book_id,
                Record.type == rtype,
                Record.deleted_at.is_(None),
                Record.record_date >= start,
                Record.record_date < end,
            )
            .scalar()
        )
        return int(v or 0)

    expense = _sum("expense")
    income = _sum("income")
    budget_row = (
        db.query(Budget)
        .filter(Budget.book_id == book_id, Budget.year_month == year_month)
        .order_by(Budget.id)
        .first()
    )
    budget_cents = budget_row.amount_cents if budget_row else 0
    ratio = (expense / budget_cents) if budget_cents > 0 else 0.0
    return SummaryOut(
        year_month=year_month,
        expense_cents=expense,
        income_cents=income,
        budget_cents=budget_cents,
        budget_used_ratio=round(ratio, 4),
    )


@router.get("/by-category", response_model=CategoryStatsOut)
def by_category(
    book_id: int = Query(...),
    year_month: str = Query(...),
    type: str = Query("expense"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_book_member(db, user, book_id)
    start, end = _month_range(year_month)

    rows = (
        db.query(
            Record.category_id,
            func.sum(Record.amount_cents).label("total"),
        )
        .filter(
            Record.book_id == book_id,
            Record.type == type,
            Record.deleted_at.is_(None),
            Record.record_date >= start,
            Record.record_date < end,
        )
        .group_by(Record.category_id)
        .all()
    )
    total = sum(int(r.total) for r in rows)
    cat_ids = [r.category_id for r in rows]
    cats = {c.id: c for c in db.query(Category).filter(Category.id.in_(cat_ids)).all()} if cat_ids else {}

    items = []
    for r in sorted(rows, key=lambda x: -int(x.total)):
        cat = cats.get(r.category_id)
        amt = int(r.total)
        items.append(
            CategoryStatItem(
                category_id=r.category_id,
                category_name=cat.name if cat else "未知",
                category_icon=cat.icon if cat else "default",
                type=type,
                amount_cents=amt,
                ratio=round(amt / total, 4) if total else 0.0,
            )
        )
    return CategoryStatsOut(year_month=year_month, type=type, total_cents=total, items=items)
