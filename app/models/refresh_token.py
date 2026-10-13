"""
File: models/refresh_token.py
Description: Server side record of every refresh token (session) handed to a
             client. JWTs are stateless, so this table is what makes logout
             and token revocation actually possible.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import BaseModelClass


class RefreshTokenModel(BaseModelClass):
    """One row per issued refresh token. Only a SHA-256 digest is stored."""

    __tablename__ = "refresh_token"

    id = Column(
        Integer,
        primary_key = True,
        index = True,
        autoincrement = True
    )
    user_id = Column(
        Integer,
        ForeignKey("user.id", ondelete = "CASCADE"),
        index = True,
        nullable = False
    )
    jti = Column(
        String(36),
        unique = True,
        index = True,
        nullable = False
    )
    token_hash = Column(
        String(64),
        unique = True,
        index = True,
        nullable = False
    )
    remember_me = Column(
        Boolean,
        default = False,
        nullable = False
    )
    expires_at = Column(
        DateTime,
        nullable = False
    )
    revoked_at = Column(
        DateTime,
        nullable = True
    )
    created_at = Column(
        DateTime,
        server_default = func.now(),
        nullable = False
    )

    user = relationship(
        "UserModel",
        back_populates = "refresh_tokens"
    )
