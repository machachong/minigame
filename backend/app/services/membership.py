"""账本成员校验与手机号规范化"""

from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.book import Book
from app.models.member import BookMember, Invite
from app.models.user import User

ROLE_OWNER = "owner"
ROLE_ADMIN = "admin"
ROLE_MEMBER = "member"
INVITE_ROLES = {ROLE_OWNER, ROLE_ADMIN}
MANAGE_ROLES = {ROLE_OWNER, ROLE_ADMIN}


def normalize_phone(phone: str | None) -> str | None:
    """规范化中国大陆手机号：去空格/横线，去 +86/86 前缀，校验 11 位 1 开头。"""
    if phone is None:
        return None
    s = re.sub(r"[\s\-]", "", str(phone).strip())
    if not s:
        return None
    if s.startswith("+86"):
        s = s[3:]
    elif s.startswith("86") and len(s) == 13:
        s = s[2:]
    if not re.fullmatch(r"1\d{10}", s):
        raise HTTPException(400, "手机号格式不正确")
    return s


def get_membership(db: Session, user_id: int, book_id: int) -> BookMember | None:
    return (
        db.query(BookMember)
        .filter(BookMember.book_id == book_id, BookMember.user_id == user_id)
        .first()
    )


def require_book_member(db: Session, user: User, book_id: int) -> tuple[Book, BookMember]:
    member = get_membership(db, user.id, book_id)
    if not member:
        raise HTTPException(404, "账本不存在")
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(404, "账本不存在")
    return book, member


def require_role(member: BookMember, allowed: set[str], detail: str = "无权限") -> None:
    if member.role not in allowed:
        raise HTTPException(403, detail)


def refresh_invite_status(invite: Invite) -> Invite:
    """过期 pending 邀请标记为 expired。"""
    if invite.status == "pending" and invite.expires_at:
        exp = invite.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            invite.status = "expired"
    return invite
