from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.book import Book
from app.models.member import BookMember, Invite
from app.models.user import User
from app.schemas.book import InvitePreview
from app.services.membership import get_membership, normalize_phone, refresh_invite_status

router = APIRouter(prefix="/api/invites", tags=["invites"])


def _load_invite(db: Session, code: str) -> Invite:
    invite = db.query(Invite).filter(Invite.code == code.upper()).first()
    if not invite:
        # 也尝试原始大小写
        invite = db.query(Invite).filter(Invite.code == code).first()
    if not invite:
        raise HTTPException(404, "邀请不存在")
    refresh_invite_status(invite)
    return invite


@router.get("/{code}", response_model=InvitePreview)
def preview_invite(code: str, db: Session = Depends(get_db)):
    invite = _load_invite(db, code)
    book = db.get(Book, invite.book_id)
    inviter = db.get(User, invite.inviter_id)
    if not book or not inviter:
        raise HTTPException(404, "邀请不存在")
    db.commit()  # persist expired status if updated
    return InvitePreview(
        code=invite.code,
        book_name=book.name,
        book_kind=book.kind or "family",
        inviter_nickname=inviter.nickname or "轻记用户",
        status=invite.status,
        expires_at=invite.expires_at,
    )


@router.post("/{code}/accept")
def accept_invite(
    code: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    invite = _load_invite(db, code)
    if invite.status == "expired":
        db.commit()
        raise HTTPException(400, "邀请已过期")
    if invite.status == "revoked":
        raise HTTPException(400, "邀请已撤销")
    if invite.status == "accepted":
        raise HTTPException(400, "邀请已被使用")
    if invite.status != "pending":
        raise HTTPException(400, "邀请不可用")

    book = db.get(Book, invite.book_id)
    if not book or book.kind != "family":
        raise HTTPException(400, "账本不可加入")

    if invite.channel == "phone":
        if not user.phone:
            raise HTTPException(400, "请先绑定手机号")
        if normalize_phone(user.phone) != invite.phone:
            raise HTTPException(403, "手机号与邀请不匹配")

    existing = get_membership(db, user.id, book.id)
    if existing:
        invite.status = "accepted"
        invite.accepted_by = user.id
        db.commit()
        return {"ok": True, "book_id": book.id, "already_member": True}

    db.add(BookMember(book_id=book.id, user_id=user.id, role="member"))
    invite.status = "accepted"
    invite.accepted_by = user.id
    db.commit()
    return {"ok": True, "book_id": book.id, "already_member": False}
