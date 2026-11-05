"""
File: registration.py
Description: Request schema for institutional professor registration (HU01). Validates required fields and the institutional email domain.
"""

import re

from pydantic import BaseModel, field_validator

INSTITUTIONAL_EMAIL_DOMAIN = "yachaytech.edu.ec"

_EMAIL_PATTERN = re.compile(r"^[a-z0-9_%+-]+(?:\.[a-z0-9_%+-]+)*@" + re.escape(INSTITUTIONAL_EMAIL_DOMAIN) + r"$")
_SCHOOL_CODE_PATTERN = re.compile(r"^[A-Z]{2,10}$")


class RegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str
    school: str

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 3:
            raise ValueError("Full name is required (minimum 3 characters).")
        return value

    @field_validator("email")
    @classmethod
    def validate_institutional_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not value:
            raise ValueError("Institutional email is required.")
        if not _EMAIL_PATTERN.match(value):
            raise ValueError(f"Email must be a valid institutional address (@{INSTITUTIONAL_EMAIL_DOMAIN}).")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must have at least 8 characters.")
        return value

    @field_validator("school")
    @classmethod
    def validate_school(cls, value: str) -> str:
        value = value.strip().upper()
        if not _SCHOOL_CODE_PATTERN.match(value):
            raise ValueError("A valid school code is required (e.g. ECMC).")
        return value
