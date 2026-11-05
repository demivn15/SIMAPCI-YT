"""
File: security.py
Author: Demian Viteri
Description: JWT creation and decoding.
"""

import uuid

import jwt

from app.core import token_blocklist
from app.core.config import settings
from datetime import datetime, timedelta, timezone

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Generates a signed JWT containing user claims, a unique id (jti) and an expiration time."""

    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
    to_encode.update({"exp": expire, "jti": uuid.uuid4().hex})
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    return encoded_jwt

def decode_access_token(token: str) -> dict | None:
    """Decodes and validates a JWT. Returns payload if valid and not revoked, None otherwise."""

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.PyJWTError:
        return None

    # A token invalidated by logout is rejected even though its signature and expiration are still valid
    if token_blocklist.is_revoked(payload.get("jti", "")):
        return None

    return payload

def revoke_access_token(token: str) -> bool:
    """Invalidates an active token (logout). Returns False if the token was not valid to begin with."""

    payload = decode_access_token(token)
    if not payload or not payload.get("jti"):
        return False

    token_blocklist.revoke(payload["jti"], payload["exp"])
    return True
