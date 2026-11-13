"""
File: auth.py
Author: Demian Viteri
Description: Expose login endpoint; receive user credentials, run them through LDAP service and, if valid, set secure token cookie.
"""

import re
from app.api.deps import get_current_professor
from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.user import User
from app.services.ldap_service import LDAPService
from app.services.user_service import (
    EmailAlreadyRegisteredError,
    InactiveAccountError,
    IncompleteIdentityError,
    LdapIdentity,
    UserService,
)
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

router = APIRouter(prefix = "/auth", tags = ["Authentication"])

# Institutional UID validation pattern (T-HU02-02, PGPCECMC-26)
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,64}$")

class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)

    @field_validator("username")
    @classmethod
    def username_is_institutional_uid(cls, value: str) -> str:
        value = value.strip()
        if not USERNAME_PATTERN.fullmatch(value):
            raise ValueError("Username can only contain letters, numbers, periods, hyphens, and underscores.")
        return value

@router.post("/login")
def login(credentials: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """
    Authenticates an institutional user via LDAP and checks professor authorization.
    Issues a secure HttpOnly cookie containing a JWT session token upon success.
    """

    # 1. Authenticate and authorize via LDAP Service
    user_data = LDAPService.authenticate_and_authorize_professor(
        username=credentials.username,
        password=credentials.password
    )
    
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid institutional credentials or unauthorized user role (Professors only)."
        )
    
    # 2. Provision user account on first login or retrieve existing one (PGPCECMC-20)
    try:
        provisioning = UserService.provision_from_ldap(
            db,
            LdapIdentity(
                username=user_data["username"],
                full_name=user_data["full_name"],
                email=user_data["email"],
            ),
        )
    except EmailAlreadyRegisteredError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except InactiveAccountError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except IncompleteIdentityError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    user = provisioning.user

    # 3. Create JWT token payload with user identity and claims
    token_payload = {
        "sub": user.username,
        "user_id": user.id,
        "name": user.full_name,
        "email": user.email,
        "role": user.role,
    }
    
    access_token = create_access_token(data = token_payload)
    
    # 3. Set token in a secure HttpOnly cookie
    # secure ensures it only transmits over HTTPS (COOKIE_SECURE=true in production; false only for local http testing)
    # 4. Set token in a secure HttpOnly cookie
    response.set_cookie(
        key = "access_token",
        value = access_token,
        httponly = True,
        secure = settings.COOKIE_SECURE,
        samesite = "lax",
        max_age = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    
    return {
        "message": "Login successful",
        "username": user.username,
        "full_name": user.full_name,
        "account_created": provisioning.created,
    }

@router.get("/me")
def get_current_user_profile(current_user: dict = Depends(get_current_professor)):
    """
    Validates the session cookie and returns the currently logged-in professor's profile.
    Used by the frontend on initial load/refresh to restore session state.
    """
    return {
        "username": current_user["username"],
        "name": current_user["name"],
        "email": current_user["email"],
        "role": current_user["role"]
    }

@router.post("/logout")
def logout(response: Response):
    """Clears the session cookie to log the user out."""

    response.delete_cookie(key="access_token")
    return {"message": "Successfully logged out"}

@router.post("/refresh")
def refresh_session(
    response: Response,
    current_user: dict = Depends(get_current_professor),
    db: Session = Depends(get_db),
):
    """
    Refreshes the access token before it expires (T-HU02-03, PGPCECMC-27).
    Issues a new token with current user data.
    """
    user = db.get(User, current_user["user_id"]) if current_user.get("user_id") else None
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token. Please log in again."
        )

    token_payload = {
        "sub": user.username,
        "user_id": user.id,
        "name": user.full_name,
        "email": user.email,
        "role": user.role,
    }
    
    new_access_token = create_access_token(data=token_payload)
    
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    
    return {"message": "Session refreshed"}
