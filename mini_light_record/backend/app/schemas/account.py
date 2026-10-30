from datetime import datetime

from pydantic import BaseModel, Field


class AccountCreate(BaseModel):
    book_id: int
    name: str = Field(..., min_length=1, max_length=64)
    balance_cents: int = Field(0, ge=0)
    icon: str = "cash"


class AccountOut(BaseModel):
    id: int
    book_id: int
    name: str
    balance_cents: int
    icon: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
