"""
File: deps.py
Author: Demian Viteri
Description: Hold security guards. Protect endpoints.
"""

from app.core.security import decode_access_token
from fastapi import HTTPException, status, Depends
from fastapi.security import APIKeyCookie

# Tells FastAPI to automatically extract the "access_token" cookie from requests
cookie_scheme = APIKeyCookie(name = "access_token", auto_error = False)

def get_current_user(token: str | None = Depends(cookie_scheme)) -> dict:
    """
    Dependency that validates the session JWT from the secure cookie.
    Ensures the user is authenticated (401 otherwise); does not check the role.
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

    # Return user details payload to be injected into the route function
    return {
        "username": payload.get("sub"),
        "name": payload.get("name"),
        "email": payload.get("email"),
        "role": payload.get("role")
    }

def require_roles(*allowed_roles: str):
    """
    Dependency factory enforcing Role-Based Access Control (RBAC).
    Usage: Depends(require_roles("professor")). Anonymous callers get 401, authenticated
    users without one of the allowed roles get 403.
    """

    def role_guard(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Insufficient privileges."
            )
        return current_user

    return role_guard

# Guard for professor-only (private) functions
get_current_professor = require_roles("professor")
