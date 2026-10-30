from datetime import datetime

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    code: str = ""
    nickname: str | None = Field(None, max_length=64)
    avatar_url: str | None = Field(None, max_length=512)


class UserOut(BaseModel):
    id: int
    openid: str
    nickname: str
    avatar_url: str
    phone: str | None = None
    last_login_at: datetime | None = None

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    token: str
    user: UserOut


class PhoneCodeRequest(BaseModel):
    """微信 getPhoneNumber 动态令牌"""

    code: str = Field(..., min_length=1, max_length=256)


class MeUpdate(BaseModel):
    nickname: str | None = Field(None, min_length=1, max_length=64)
    avatar_url: str | None = Field(None, max_length=512)


class PhoneBind(BaseModel):
    """开发明文绑定或微信 phone_code 二选一。"""

    phone: str | None = Field(None, max_length=20)
    phone_code: str | None = Field(None, max_length=256)
