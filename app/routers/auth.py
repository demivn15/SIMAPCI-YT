"""
File: auth.py
Description: Registration and login for ECMC professors (charter requirement
             #1 "Registro de usuarios" and #2 "Autenticación y acceso"), plus
             the JWT refresh/logout lifecycle (charter non-functional
             requirement #1: "autenticación segura (OAuth2 o JWT)").
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_database_session
from app.models.user import UserModel, UserRole
from app.schemas.token import MessageResponse, RefreshRequest, TokenPair
from app.schemas.user import UserLogin, UserRegister, UserResponse
from app.security.dependencies import get_current_active_user
from app.security.jwt import hash_password, verify_password
from app.security.sessions import (
    SessionError,
    issue_token_pair,
    revoke_all_sessions,
    revoke_session,
    rotate_token_pair,
)

router = APIRouter(prefix = "/auth", tags = ["Authentication"])

INVALID_CREDENTIALS = HTTPException(
    status_code = status.HTTP_401_UNAUTHORIZED,
    detail = "Incorrect email/username or password.",
    headers = {"WWW-Authenticate": "Bearer"}
)


def _authenticate(db: Session, identifier: str, password: str) -> UserModel:
    """Find an active local user by email or username and check the password."""
    user = (
        db.query(UserModel)
        .filter(or_(UserModel.email == identifier, UserModel.username == identifier))
        .first()
    )

    # A missing user and a wrong password return the very same 401, so the
    # endpoint never reveals which email addresses are registered.
    if user is None or not verify_password(password, user.hashed_password):
        raise INVALID_CREDENTIALS

    if not user.is_active:
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail = "This account has been deactivated."
        )

    user.last_login_at = datetime.now(timezone.utc).replace(tzinfo = None)
    db.add(user)
    db.commit()

    return user


@router.post(
    "/register",
    response_model = UserResponse,
    status_code = status.HTTP_201_CREATED,
    summary = "Register a new ECMC professor account",
    description = (
        "Creates a local account for a professor of the Escuela de Ciencias "
        "Matemáticas y Computacionales. The password is never stored: only a "
        "bcrypt hash of it is kept. An email listed in ADMIN_BOOTSTRAP_EMAILS "
        "is automatically promoted to the review-committee (ADMIN) role."
    ),
    responses = {409: {"description": "The username or the email already exists."}}
)
def register_user(
    payload: UserRegister,
    db: Session = Depends(get_database_session)
):
    """Create a new professor account."""
    if db.query(UserModel).filter(UserModel.email == payload.email).first():
        raise HTTPException(status_code = status.HTTP_409_CONFLICT, detail = "Email already registered.")

    if db.query(UserModel).filter(UserModel.username == payload.username).first():
        raise HTTPException(status_code = status.HTTP_409_CONFLICT, detail = "Username already taken.")

    role = (
        UserRole.ADMIN
        if payload.email.lower() in settings.admin_bootstrap_email_set
        else UserRole.PROFESSOR
    )

    new_user = UserModel(
        username = payload.username,
        full_name = payload.full_name,
        email = payload.email,
        hashed_password = hash_password(payload.password),
        department = payload.department,
        role = role,
        is_active = True
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.post(
    "/login",
    response_model = TokenPair,
    summary = "Sign in and obtain an access and a refresh token",
    description = (
        "Validates the credentials and returns a short-lived access token plus a "
        "refresh token. `remember_me` only extends the refresh token's lifetime."
    ),
    responses = {401: {"description": "Wrong credentials."}, 403: {"description": "Account deactivated."}}
)
def login(payload: UserLogin, db: Session = Depends(get_database_session)):
    """Exchange email/username and password for a JWT pair."""
    identifier = payload.email or payload.username
    user = _authenticate(db, identifier, payload.password)
    return issue_token_pair(db, user, remember_me = payload.remember_me)


@router.post(
    "/token",
    response_model = TokenPair,
    summary = "Sign in with an OAuth2 password form (used by the Authorize button)",
    description = "Same as POST /auth/login, accepting the form Swagger UI's Authorize dialog sends.",
    responses = {401: {"description": "Wrong credentials."}}
)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_database_session)
):
    """Form-encoded sign in, so Swagger UI can authorise itself."""
    user = _authenticate(db, form_data.username, form_data.password)
    return issue_token_pair(db, user, remember_me = False)


@router.post(
    "/refresh",
    response_model = TokenPair,
    summary = "Exchange a refresh token for a new token pair",
    description = "Rotates the refresh token: the presented one is revoked and a new pair is issued.",
    responses = {401: {"description": "Invalid, expired or revoked refresh token."}}
)
def refresh_tokens(payload: RefreshRequest, db: Session = Depends(get_database_session)):
    """Rotate a refresh token into a fresh access/refresh pair."""
    try:
        return rotate_token_pair(db, payload.refresh_token)
    except SessionError as error:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = str(error),
            headers = {"WWW-Authenticate": "Bearer"}
        )


@router.post(
    "/logout",
    response_model = MessageResponse,
    summary = "Close the current session",
    description = "Revokes the refresh token sent in the body. Requires a valid access token.",
    responses = {401: {"description": "Missing/invalid access token, or unusable refresh token."}}
)
def logout(
    payload: RefreshRequest,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session)
):
    """Revoke the refresh token of the session being closed."""
    try:
        revoke_session(db, payload.refresh_token, current_user)
    except SessionError as error:
        raise HTTPException(status_code = status.HTTP_401_UNAUTHORIZED, detail = str(error))

    return MessageResponse(detail = "Session closed successfully.")


@router.post(
    "/logout-all",
    response_model = MessageResponse,
    summary = "Close every session of the current user",
    description = "Revokes all refresh tokens of the authenticated user, on every device.",
    responses = {401: {"description": "Missing or invalid access token."}}
)
def logout_everywhere(
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session)
):
    """Revoke every refresh token belonging to the authenticated user."""
    closed = revoke_all_sessions(db, current_user.id)
    return MessageResponse(detail = f"{closed} session(s) closed successfully.")
