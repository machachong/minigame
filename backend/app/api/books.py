import secrets
import string
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.book import Book
from app.models.member import BookMember, Invite
from app.models.user import User
from app.schemas.book import BookCreate, BookOut, InviteCreate, InviteOut, MemberOut
from app.services.membership import (
    INVITE_ROLES,
    MANAGE_ROLES,
    get_membership,
    normalize_phone,
    require_book_member,
    require_role,
)
from app.services.seed import seed_book_defaults

router = APIRouter(prefix="/api/books", tags=["books"])

INVITE_TTL_DAYS = 7
CODE_ALPHABET = string.ascii_uppercase + string.digits


def _gen_code(db: Session, length: int = 8) -> str:
    for _ in range(20):
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(length))
        if not db.query(Invite).filter(Invite.code == code).first():
            return code
    raise HTTPException(500, "邀请码生成失败")


def _book_out(book: Book, role: str, member_count: int) -> BookOut:
    return BookOut(
        id=book.id,
        name=book.name,
        kind=book.kind or "personal",
        is_default=book.is_default,
        role=role,
        member_count=member_count,
        created_at=book.created_at,
    )


@router.get("", response_model=list[BookOut])
def list_books(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(Book, BookMember.role)
        .join(BookMember, BookMember.book_id == Book.id)
        .filter(BookMember.user_id == user.id)
        .order_by(Book.id)
        .all()
    )
    if not rows:
        return []
    book_ids = [b.id for b, _ in rows]
    counts = dict(
        db.query(BookMember.book_id, func.count(BookMember.id))
        .filter(BookMember.book_id.in_(book_ids))
        .group_by(BookMember.book_id)
        .all()
    )
    return [_book_out(b, role, int(counts.get(b.id, 1))) for b, role in rows]


@router.post("", response_model=BookOut)
def create_book(
    body: BookCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    kind = body.kind or "personal"
    if kind not in ("personal", "family"):
        raise HTTPException(400, "kind 须为 personal 或 family")
    if body.is_default:
        owned_ids = [
            m.book_id
            for m in db.query(BookMember).filter(
                BookMember.user_id == user.id, BookMember.role == "owner"
            )
        ]
        if owned_ids:
            db.query(Book).filter(Book.id.in_(owned_ids), Book.is_default.is_(True)).update(
                {"is_default": False}
            )
    book = Book(user_id=user.id, name=body.name, kind=kind, is_default=body.is_default)
    db.add(book)
    db.flush()
    db.add(BookMember(book_id=book.id, user_id=user.id, role="owner"))
    seed_book_defaults(db, user, book)
    db.commit()
    db.refresh(book)
    return _book_out(book, "owner", 1)


@router.get("/{book_id}", response_model=BookOut)
def get_book(book_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    book, member = require_book_member(db, user, book_id)
    count = db.query(func.count(BookMember.id)).filter(BookMember.book_id == book_id).scalar() or 0
    return _book_out(book, member.role, int(count))


@router.post("/{book_id}/invites", response_model=InviteOut)
def create_invite(
    book_id: int,
    body: InviteCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    book, member = require_book_member(db, user, book_id)
    if book.kind != "family":
        raise HTTPException(400, "仅家庭账本可邀请")
    require_role(member, INVITE_ROLES, "仅 owner/admin 可邀请")

    phone = None
    if body.channel == "phone":
        if not body.phone:
            raise HTTPException(400, "手机号邀请须填写 phone")
        phone = normalize_phone(body.phone)
    elif body.channel != "share":
        raise HTTPException(400, "channel 须为 share 或 phone")

    code = _gen_code(db)
    invite = Invite(
        book_id=book.id,
        inviter_id=user.id,
        code=code,
        channel=body.channel,
        phone=phone,
        status="pending",
        expires_at=datetime.now(timezone.utc) + timedelta(days=INVITE_TTL_DAYS),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return InviteOut(
        id=invite.id,
        code=invite.code,
        channel=invite.channel,
        phone=invite.phone,
        status=invite.status,
        expires_at=invite.expires_at,
        path=f"pages/invite/accept?code={invite.code}",
        created_at=invite.created_at,
    )


@router.get("/{book_id}/members", response_model=list[MemberOut])
def list_members(
    book_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_book_member(db, user, book_id)
    rows = (
        db.query(BookMember, User)
        .join(User, User.id == BookMember.user_id)
        .filter(BookMember.book_id == book_id)
        .order_by(BookMember.id)
        .all()
    )
    return [
        MemberOut(
            user_id=u.id,
            nickname=u.nickname,
            phone=u.phone,
            role=m.role,
            created_at=m.created_at,
        )
        for m, u in rows
    ]


@router.delete("/{book_id}/members/{user_id}")
def remove_member(
    book_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _book, actor = require_book_member(db, user, book_id)
    require_role(actor, MANAGE_ROLES, "仅 owner/admin 可移除成员")
    target = get_membership(db, user_id, book_id)
    if not target:
        raise HTTPException(404, "成员不存在")
    if target.role == "owner":
        raise HTTPException(400, "不能移除 owner")
    if actor.role == "admin" and target.role == "admin":
        raise HTTPException(403, "admin 不能移除其他 admin")
    db.delete(target)
    db.commit()
    return {"ok": True}
