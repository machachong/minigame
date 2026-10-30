from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class RecordCreate(BaseModel):
    book_id: int
    account_id: int
    category_id: int
    type: Literal["expense", "income"]
    amount_cents: int = Field(..., ge=1)
    note: str = ""
    record_date: date | None = None

    @field_validator("amount_cents")
    @classmethod
    def validate_amount(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("金额必须大于 0")
        if v > 10_000_000_000:
            raise ValueError("金额过大")
        return v


class RecordOut(BaseModel):
    id: int
    book_id: int
    account_id: int
    category_id: int
    type: str
    amount_cents: int
    note: str
    record_date: date
    created_at: datetime | None = None
    category_name: str | None = None
    category_icon: str | None = None
    account_name: str | None = None
    user_id: int | None = None
    user_nickname: str | None = None

    model_config = {"from_attributes": True}
