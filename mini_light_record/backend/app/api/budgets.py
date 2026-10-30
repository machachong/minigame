from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.budget import Budget
from app.models.user import User
from app.schemas.budget import BudgetCreate, BudgetOut
from app.services.membership import require_book_member

router = APIRouter(prefix="/api/budgets", tags=["budgets"])


@router.get("", response_model=list[BudgetOut])
def list_budgets(
    book_id: int = Query(...),
    year_month: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_book_member(db, user, book_id)
    q = db.query(Budget).filter(Budget.book_id == book_id)
    if year_month:
        q = q.filter(Budget.year_month == year_month)
    return q.order_by(Budget.year_month.desc()).all()


@router.post("", response_model=BudgetOut)
def upsert_budget(
    body: BudgetCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_book_member(db, user, body.book_id)

    budget = (
        db.query(Budget)
        .filter(Budget.book_id == body.book_id, Budget.year_month == body.year_month)
        .order_by(Budget.id)
        .first()
    )
    if budget:
        budget.amount_cents = body.amount_cents
    else:
        budget = Budget(
            user_id=user.id,
            book_id=body.book_id,
            year_month=body.year_month,
            amount_cents=body.amount_cents,
        )
        db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget
