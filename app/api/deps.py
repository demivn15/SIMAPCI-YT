"""
File: deps.py
Author: Demian Viteri
Description: Hold security guards. Protect endpoints.
"""

from app.core.security import decode_access_token
from app.db.session import SessionLocal  # Adjust if your session factory is named differently
from fastapi import HTTPException, status, Depends
from fastapi.security import APIKeyCookie
from sqlalchemy.orm import Session
from typing import Generator
from typing import Callable, List

# Tells FastAPI to automatically extract the "access_token" cookie from requests
cookie_scheme = APIKeyCookie(name = "access_token", auto_error = False)

def get_current_professor(token: str | None = Depends(cookie_scheme)) -> dict:
    """
    Dependency that validates the session JWT from the secure cookie.
    Ensures the user is authenticated and holds the professor role.
    """

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Missing session cookie."
        )
    
    # Decode and verify the JWT signature and expiration
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token. Please log in again."
        )
    
    # Enforce Role-Based Access Control (RBAC)
    if payload.get("role") != "professor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Insufficient privileges."
        )
        
    # Return user details payload to be injected into the route function
    return {
        "username": payload.get("sub"),
        "name": payload.get("name"),
        "email": payload.get("email"),
        "role": payload.get("role")
    }

def get_db() -> Generator[Session, None, None]:
    """
    Dependency that creates a new SQLAlchemy database session for each request
    and closes it when the request is finished.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def require_roles(allowed_roles: List[str]) -> Callable:
    """
    Dependency factory that checks if the current user has one of the allowed roles.
    """
    def role_verifier(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = current_user.get("role")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user
    return role_verifier
