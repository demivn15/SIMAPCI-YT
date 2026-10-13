"""
File: routers/users.py
Description: Definition of endpoints for the authenticated professor's own profile.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database import get_database_session
from app.models.user import UserModel
from app.schemas.user import UserResponse, UserUpdate
from app.security.dependencies import get_current_active_user
from app.security.sessions import revoke_all_sessions

router = APIRouter(prefix = "/users", tags = ["Users"])


@router.get(
    "/me",
    response_model = UserResponse,
    summary = "Get the profile of the authenticated professor",
    description = "Returns the account behind the bearer token. The password hash is never included.",
    responses = {401: {"description": "Missing, invalid or expired access token."}}
)
def read_current_user(current_user: UserModel = Depends(get_current_active_user)):
    """Return the authenticated user."""
    return current_user


@router.patch(
    "/me",
    response_model = UserResponse,
    summary = "Update the profile of the authenticated professor",
    description = "Changes the editable fields of the account making the request.",
    responses = {401: {"description": "Missing, invalid or expired access token."}}
)
def update_current_user(
    payload: UserUpdate,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session)
):
    """Apply a partial update to the authenticated user."""
    for field, value in payload.model_dump(exclude_unset = True).items():
        setattr(current_user, field, value)

    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return current_user


@router.delete(
    "/me",
    status_code = status.HTTP_204_NO_CONTENT,
    summary = "Deactivate the authenticated account",
    description = (
        "Marks the account as inactive instead of deleting it, so the scientific "
        "production already registered is preserved. Every session is revoked."
    ),
    responses = {401: {"description": "Missing, invalid or expired access token."}}
)
def deactivate_current_user(
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session)
):
    """Soft-delete the authenticated user and close all of their sessions."""
    current_user.is_active = False
    db.add(current_user)
    db.commit()

    revoke_all_sessions(db, current_user.id)
