"""
File jwt.py
Description: Implementation of JWT for security.

Password hashing talks to the `bcrypt` library directly rather than through
passlib's CryptContext: passlib 1.7.x hard-codes checks against bcrypt's old
`__about__.__version__` attribute, which modern bcrypt releases no longer
provide, so the combination raises at runtime. Calling bcrypt.hashpw /
bcrypt.checkpw ourselves avoids the broken shim entirely.
"""

import uuid
from datetime import datetime, timedelta, timezone
import bcrypt
from jose import JWTError, jwt
from app.config import settings

ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"

# bcrypt only looks at the first 72 bytes of a password and raises on
# anything longer, so this limit is enforced explicitly in the schemas too.
MAX_PASSWORD_BYTES = 72


def hash_password(password: str) -> str:
    """Hash a plain text password for safe storage in the database."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    """Verify an incoming login password against the stored database hash."""
    if not hashed_password:
        # ORCID-only accounts have no password; they can never log in locally.
        return False

    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except ValueError:
        # A malformed hash or an over-long password: either way, no match.
        return False


def access_token_lifetime() -> timedelta:
    """How long a freshly minted access token stays valid."""
    return timedelta(minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES)


def refresh_token_lifetime(remember_me: bool = False) -> timedelta:
    """How long a refresh token stays valid ("Remember Me" only affects this)."""
    days = (
        settings.REMEMBER_REFRESH_TOKEN_EXPIRE_DAYS
        if remember_me
        else settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    return timedelta(days = days)


def _create_token(subject: str, token_type: str, lifetime: timedelta, **extra_claims) -> tuple[str, str, datetime]:
    """Encode a signed JWT and return the token, its jti and its expiry."""
    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + lifetime
    jti = str(uuid.uuid4())

    payload = {
        "sub": subject,
        "type": token_type,
        "jti": jti,
        "iat": issued_at,
        "exp": expires_at,
        **extra_claims,
    }

    token = jwt.encode(payload, settings.SECRET_KEY, algorithm = settings.ALGORITHM)
    return token, jti, expires_at


def create_access_token(user_id: int, **extra_claims) -> tuple[str, datetime]:
    """Generate a short-lived signed JWT access token for a user id."""
    token, _, expires_at = _create_token(
        subject = str(user_id),
        token_type = ACCESS_TOKEN_TYPE,
        lifetime = access_token_lifetime(),
        **extra_claims
    )
    return token, expires_at


def create_refresh_token(user_id: int, remember_me: bool = False) -> tuple[str, str, datetime]:
    """Generate a long-lived refresh token, returning it with its jti and expiry."""
    return _create_token(
        subject = str(user_id),
        token_type = REFRESH_TOKEN_TYPE,
        lifetime = refresh_token_lifetime(remember_me),
        remember_me = remember_me
    )


def decode_token(token: str, expected_type: str) -> dict:
    """Decode a JWT, validating its signature, its expiration and its type."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms = [settings.ALGORITHM])
    except JWTError as error:
        raise ValueError("Token is invalid or has expired.") from error

    if payload.get("type") != expected_type:
        raise ValueError(f"Expected a {expected_type} token.")

    if not payload.get("sub"):
        raise ValueError("Token has no subject.")

    return payload
