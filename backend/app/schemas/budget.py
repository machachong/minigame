from pydantic import BaseModel, Field, field_validator
import re


class BudgetCreate(BaseModel):
    book_id: int
    year_month: str = Field(..., description="YYYY-MM")
    amount_cents: int = Field(..., ge=0)

    @field_validator("year_month")
    @classmethod
    def validate_ym(cls, v: str) -> str:
        if not re.match(r"^\d{4}-\d{2}$", v):
            raise ValueError("year_month 格式应为 YYYY-MM")
        return v


class BudgetOut(BaseModel):
    id: int
    book_id: int
    year_month: str
    amount_cents: int

    model_config = {"from_attributes": True}
