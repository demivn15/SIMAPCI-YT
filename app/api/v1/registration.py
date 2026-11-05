"""
File: registration.py
Description: Expose professor registration endpoint; validates required fields and institutional email domain.
"""

from app.schemas.registration import RegisterRequest
from fastapi import APIRouter, status

router = APIRouter(prefix = "/auth", tags = ["Registration"])

@router.post("/register", status_code = status.HTTP_202_ACCEPTED)
def register(data: RegisterRequest):
    """
    Validates the registration form. Invalid or missing fields and non-institutional
    email domains are rejected with 422 before any account processing happens.
    """

    return {
        "message": "Registration data validated",
        "email": data.email,
        "school": data.school
    }
