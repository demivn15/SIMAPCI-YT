"""
File: security/dependencies.py
Description: FastAPI dependencies that turn a bearer token into a User row,
             and enforce the PROFESSOR/ADMIN role split required by the
             charter's review-committee workflow.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_database_session
from app.models.user import UserModel, UserRole
from app.security.jwt import ACCESS_TOKEN_TYPE, decode_token

# tokenUrl points at the form-encoded endpoint so the Authorize button of
# Swagger UI can obtain a token without leaving the documentation page.
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl = "/auth/token",
    scheme_name = "JWT Bearer"
)

CREDENTIALS_EXCEPTION = HTTPException(
    status_code = status.HTTP_401_UNAUTHORIZED,
    detail = "Could not validate credentials.",
    headers = {"WWW-Authenticate": "Bearer"}
)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_database_session)
) -> UserModel:
    """Resolve the user behind the Authorization header (access tokens only)."""
    try:
        payload = decode_token(token, ACCESS_TOKEN_TYPE)
    except ValueError:
        raise CREDENTIALS_EXCEPTION

    user = db.query(UserModel).filter(UserModel.id == int(payload["sub"])).first()
    if user is None:
        raise CREDENTIALS_EXCEPTION

    return user


def get_current_active_user(
    current_user: UserModel = Depends(get_current_user)
) -> UserModel:
    """Same as get_current_user, but also refuses deactivated accounts."""
    if not current_user.is_active:
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail = "This account has been deactivated."
        )
    return current_user


def require_admin(
    current_user: UserModel = Depends(get_current_active_user)
) -> UserModel:
    """
    Gate for the review-committee endpoints.

    Only accounts with role=ADMIN (bootstrapped via ADMIN_BOOTSTRAP_EMAILS,
    see app.config) may verify or reject a professor's submission.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail = "This action is restricted to the review committee."
        )
    return current_user
