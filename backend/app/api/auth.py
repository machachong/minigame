from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token, get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse, PhoneCodeRequest, UserOut
from app.services.membership import normalize_phone
from app.services.seed import seed_user_defaults
from app.services.wx import code2session, get_phone_number

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _apply_profile(user: User, nickname: str | None, avatar_url: str | None) -> None:
    if nickname is not None:
        name = nickname.strip()
        if name:
            user.nickname = name[:64]
    if avatar_url is not None:
        user.avatar_url = (avatar_url or "")[:512]


def _bind_phone_to_user(db: Session, user: User, raw_phone: str) -> None:
    phone = normalize_phone(raw_phone)
    if not phone:
        raise HTTPException(400, "手机号无效")
    other = db.query(User).filter(User.phone == phone, User.id != user.id).first()
    if other:
        raise HTTPException(400, "该手机号已被绑定")
    user.phone = phone


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: Session = Depends(get_db)):
    try:
        openid = await code2session(body.code or "mock")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    user = db.query(User).filter(User.openid == openid).first()
    if not user:
        user = User(
            openid=openid,
            nickname=(body.nickname or "").strip() or "轻记用户",
            avatar_url=(body.avatar_url or "")[:512],
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        seed_user_defaults(db, user)
    else:
        _apply_profile(user, body.nickname, body.avatar_url)

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.openid)
    return LoginResponse(token=token, user=UserOut.model_validate(user))


@router.post("/phone", response_model=UserOut)
async def auth_phone(
    body: PhoneCodeRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """用微信 getPhoneNumber 的 code 换手机号并写入当前用户。"""
    try:
        raw = await get_phone_number(body.code)
    except ValueError as e:
        raise HTTPException(400, detail=str(e))
    _bind_phone_to_user(db, user, raw)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)
