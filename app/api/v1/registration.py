"""
File: registration.py
Description: Expose professor registration endpoint; validates required fields and institutional email domain, stores only a password hash.
"""

from app.core.passwords import hash_password
from app.schemas.registration import RegisterRequest
from app.services import user_store
from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix = "/auth", tags = ["Registration"])

@router.post("/register", status_code = status.HTTP_201_CREATED)
def register(data: RegisterRequest):
    """
    Validates the registration form. Invalid or missing fields and non-institutional
    email domains are rejected with 422. The password is hashed before storage and
    is never returned or logged.
    """

    try:
        user_store.create_user(
            email = data.email,
            full_name = data.full_name,
            school = data.school,
            password_hash = hash_password(data.password)
        )
    except user_store.DuplicateUserError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this institutional email already exists."
        )

    return {
        "message": "Registration successful",
        "email": data.email,
        "school": data.school
    }
