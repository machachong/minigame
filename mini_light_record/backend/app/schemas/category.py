from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    book_id: int
    name: str = Field(..., min_length=1, max_length=64)
    type: Literal["expense", "income"]
    icon: str = "default"
    # 省略或 null → 建一级大类；传入一级 id → 建二级小类
    parent_id: int | None = None


class CategoryOut(BaseModel):
    id: int
    book_id: int
    parent_id: int | None = None
    name: str
    type: str
    icon: str
    created_at: datetime | None = None
    children: list["CategoryOut"] = Field(default_factory=list)

    model_config = {"from_attributes": True}
