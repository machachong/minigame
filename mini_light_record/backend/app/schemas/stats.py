from pydantic import BaseModel


class SummaryOut(BaseModel):
    year_month: str
    expense_cents: int
    income_cents: int
    budget_cents: int
    budget_used_ratio: float


class CategoryStatItem(BaseModel):
    category_id: int
    category_name: str
    category_icon: str
    type: str
    amount_cents: int
    ratio: float


class CategoryStatsOut(BaseModel):
    year_month: str
    type: str
    total_cents: int
    items: list[CategoryStatItem]
