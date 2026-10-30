from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    openid: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    nickname: Mapped[str] = mapped_column(String(64), default="轻记用户")
    avatar_url: Mapped[str] = mapped_column(String(512), default="")
    # 规范化手机号（微信授权或开发明文绑定）
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    books = relationship("Book", back_populates="user")
    memberships = relationship("BookMember", back_populates="user")
