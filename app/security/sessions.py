"""
File: security/sessions.py
Description: Database backed store of refresh tokens, which is what makes
             logout and token revocation possible on top of stateless JWTs.
"""

import hashlib
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.refresh_token import RefreshTokenModel
from app.models.user import UserModel
from app.schemas.token import TokenPair
from app.security.jwt import (
    REFRESH_TOKEN_TYPE,
    access_token_lifetime,
    create_access_token,
    create_refresh_token,
    decode_token,
)


class SessionError(Exception):
    """Raised when a refresh token cannot be accepted."""


def hash_token(token: str) -> str:
    """Digest a refresh token so the database never holds the token itself."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _utcnow() -> datetime:
    """Current UTC time, naive, matching how SQLAlchemy stores DATETIME values."""
    return datetime.now(timezone.utc).replace(tzinfo = None)


def issue_token_pair(db: Session, user: UserModel, remember_me: bool = False) -> TokenPair:
    """Create an access/refresh pair and persist the refresh token as a session."""
    access_token, _ = create_access_token(user.id, role = user.role.value)
    refresh_token, jti, refresh_expires_at = create_refresh_token(user.id, remember_me)

    session_row = RefreshTokenModel(
        user_id = user.id,
        jti = jti,
        token_hash = hash_token(refresh_token),
        remember_me = remember_me,
        expires_at = refresh_expires_at.astimezone(timezone.utc).replace(tzinfo = None)
    )
    db.add(session_row)
    db.commit()

    access_seconds = int(access_token_lifetime().total_seconds())
    refresh_seconds = int((refresh_expires_at - datetime.now(timezone.utc)).total_seconds())

    return TokenPair(
        access_token = access_token,
        refresh_token = refresh_token,
        token_type = "bearer",
        expires_in = access_seconds,
        refresh_expires_in = refresh_seconds
    )


def _load_session(db: Session, refresh_token: str) -> tuple[RefreshTokenModel, UserModel]:
    """Validate a refresh token against both its signature and the session table."""
    try:
        payload = decode_token(refresh_token, REFRESH_TOKEN_TYPE)
    except ValueError as error:
        raise SessionError(str(error)) from error

    session_row = (
        db.query(RefreshTokenModel)
        .filter(RefreshTokenModel.token_hash == hash_token(refresh_token))
        .first()
    )
    if session_row is None:
        raise SessionError("Refresh token is not a known session.")

    if session_row.revoked_at is not None:
        # Presenting an already-revoked token hints at a stolen token, so
        # every session of that user is closed as a precaution.
        revoke_all_sessions(db, session_row.user_id)
        raise SessionError("Refresh token has been revoked.")

    if session_row.expires_at <= _utcnow():
        raise SessionError("Refresh token has expired.")

    user = db.query(UserModel).filter(UserModel.id == int(payload["sub"])).first()
    if user is None:
        raise SessionError("The user of this token no longer exists.")

    if not user.is_active:
        raise SessionError("The user of this token is not active.")

    return session_row, user


def rotate_token_pair(db: Session, refresh_token: str) -> TokenPair:
    """Exchange a valid refresh token for a brand new pair (rotation)."""
    session_row, user = _load_session(db, refresh_token)

    session_row.revoked_at = _utcnow()
    db.add(session_row)
    db.commit()

    return issue_token_pair(db, user, remember_me = bool(session_row.remember_me))


def revoke_session(db: Session, refresh_token: str, user: UserModel) -> None:
    """Revoke the session behind a refresh token, used by POST /auth/logout."""
    session_row, token_user = _load_session(db, refresh_token)

    if token_user.id != user.id:
        raise SessionError("This refresh token belongs to another user.")

    session_row.revoked_at = _utcnow()
    db.add(session_row)
    db.commit()


def revoke_all_sessions(db: Session, user_id: int) -> int:
    """Revoke every live session of a user and return how many were closed."""
    closed = (
        db.query(RefreshTokenModel)
        .filter(
            RefreshTokenModel.user_id == user_id,
            RefreshTokenModel.revoked_at.is_(None)
        )
        .update({RefreshTokenModel.revoked_at: _utcnow()}, synchronize_session = False)
    )
    db.commit()
    return closed
