from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.auth import MeUpdate, PhoneBind, UserOut
from app.services.membership import normalize_phone
from app.services.wx import get_phone_number

router = APIRouter(prefix="/api/me", tags=["me"])


def _set_phone(db: Session, user: User, phone: str) -> None:
    other = db.query(User).filter(User.phone == phone, User.id != user.id).first()
    if other:
        raise HTTPException(400, "该手机号已被绑定")
    user.phone = phone


@router.get("", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)


@router.patch("", response_model=UserOut)
def update_me(
    body: MeUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.nickname is None and body.avatar_url is None:
        raise HTTPException(400, "请提供 nickname 或 avatar_url")
    if body.nickname is not None:
        name = body.nickname.strip()
        if not name:
            raise HTTPException(400, "昵称不能为空")
        user.nickname = name[:64]
    if body.avatar_url is not None:
        user.avatar_url = (body.avatar_url or "")[:512]
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.post("/phone", response_model=UserOut)
async def bind_phone(
    body: PhoneBind,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """支持微信 phone_code 或开发明文 phone。"""
    if body.phone_code:
        try:
            raw = await get_phone_number(body.phone_code)
        except ValueError as e:
            raise HTTPException(400, detail=str(e))
        phone = normalize_phone(raw)
    elif body.phone:
        phone = normalize_phone(body.phone)
    else:
        raise HTTPException(400, "请提供 phone 或 phone_code")
    if not phone:
        raise HTTPException(400, "手机号不能为空")
    _set_phone(db, user, phone)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)
