from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class BookCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    kind: Literal["personal", "family"] = "personal"
    is_default: bool = False


class BookOut(BaseModel):
    id: int
    name: str
    kind: str = "personal"
    is_default: bool
    role: str | None = None
    member_count: int | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class MemberOut(BaseModel):
    user_id: int
    nickname: str
    phone: str | None = None
    role: str
    created_at: datetime | None = None


class InviteCreate(BaseModel):
    channel: Literal["share", "phone"]
    phone: str | None = None


class InviteOut(BaseModel):
    id: int
    code: str
    channel: str
    phone: str | None = None
    status: str
    expires_at: datetime
    path: str  # 小程序 path
    created_at: datetime | None = None


class InvitePreview(BaseModel):
    code: str
    book_name: str
    book_kind: str
    inviter_nickname: str
    status: str
    expires_at: datetime

