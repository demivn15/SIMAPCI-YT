"""
File: auth.py
Author: Demian Viteri
Description: Expose login endpoint; receive user credentials, run them through LDAP service and, if valid, set secure token cookie.
"""

from app.api.deps import get_current_professor
from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import get_db
from app.services.ldap_service import LDAPService
from app.services.user_service import (
    EmailAlreadyRegisteredError,
    InactiveAccountError,
    IncompleteIdentityError,
    LdapIdentity,
    UserService,
)
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

router = APIRouter(prefix = "/auth", tags = ["Authentication"])

class LoginRequest(BaseModel):
    username: str
    password: str

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
    
    # 2. Crear la cuenta en el primer acceso o recuperar la existente (PGPCECMC-20)
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
        # El dato faltante viene del directorio, no del usuario: 502 (error del servicio externo)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    user = provisioning.user

    # 3. Create JWT token payload with user identity and claims
    # Los datos salen de nuestra BD; "user_id" permite asociar productos a la cuenta.
    token_payload = {
        "sub": user.username,
        "user_id": user.id,
        "name": user.full_name,
        "email": user.email,
        "role": user.role,
    }
    
    access_token = create_access_token(data = token_payload)
    
    # 4. Set token in a secure HttpOnly cookie
    # secure=True ensures it only transmits over HTTPS (set to False only for local http testing if needed)
    response.set_cookie(
        key = "access_token",
        value = access_token,
        httponly = True,
        secure = False, # Set to True in production (HTTPS required)
        samesite = "lax",
        max_age = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    
    return {
        "message": "Login successful",
        "username": user.username,
        "full_name": user.full_name,
        # True solo en el primer acceso: el frontend puede mostrar "Cuenta creada" (CA01)
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
