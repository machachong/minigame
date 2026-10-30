from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class AmountMixin(BaseModel):
    amount_cents: int = Field(..., ge=1, description="金额（分），必须为正整数")

    @field_validator("amount_cents")
    @classmethod
    def validate_amount(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("金额必须大于 0")
        if v > 10_000_000_000:  # 1亿人民币
            raise ValueError("金额过大")
        return v


RecordType = Literal["expense", "income"]
