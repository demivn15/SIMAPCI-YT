"""
File: schemas/user.py
Description: Request and response contracts for user data. Registration is
             oriented to ECMC professors, per the charter.
"""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator
from app.models.user import UserRole
from app.security.jwt import MAX_PASSWORD_BYTES


class UserRegister(BaseModel):
    """Payload accepted by POST /auth/register, for an ECMC professor."""

    username: str = Field(
        min_length = 3,
        max_length = 50,
        pattern = r"^[A-Za-z0-9._-]+$",
        examples = ["jastudillo"]
    )
    full_name: str = Field(
        min_length = 3,
        max_length = 150,
        examples = ["Juan Pablo Astudillo León"]
    )
    email: EmailStr = Field(examples = ["jastudillo@yachaytech.edu.ec"])
    password: str = Field(
        min_length = 8,
        max_length = 72,
        examples = ["MySecurePassword123!"]
    )
    department: str | None = Field(
        default = None,
        max_length = 150,
        examples = ["Ciencias de la Computación"]
    )

    @field_validator("password")
    @classmethod
    def password_fits_in_bcrypt(cls, value: str) -> str:
        """
        bcrypt only considers the first 72 bytes of a password, so longer
        values are rejected with a 422 instead of being silently truncated.
        Accented characters take more than one byte, hence the byte check.
        """
        if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
            raise ValueError(
                f"Password must not exceed {MAX_PASSWORD_BYTES} bytes once encoded."
            )
        return value


class UserLogin(BaseModel):
    """Payload accepted by POST /auth/login: email or username, plus password."""

    email: EmailStr | None = Field(default = None, examples = ["jastudillo@yachaytech.edu.ec"])
    username: str | None = Field(
        default = None,
        description = "Alternative to email when signing in with a username."
    )
    password: str = Field(examples = ["MySecurePassword123!"])
    remember_me: bool = Field(
        default = False,
        description = "When true the refresh token is issued with the extended lifetime."
    )

    @model_validator(mode = "after")
    def require_an_identifier(self) -> "UserLogin":
        if not self.email and not self.username:
            raise ValueError("Provide either 'email' or 'username'.")
        return self


class UserUpdate(BaseModel):
    """Payload accepted by PATCH /users/me. Every field is optional."""

    full_name: str | None = Field(default = None, min_length = 3, max_length = 150)
    department: str | None = Field(default = None, max_length = 150)


class UserResponse(BaseModel):
    """Public view of a user. It deliberately never exposes the password hash."""

    id: int
    username: str
    full_name: str
    email: EmailStr
    role: UserRole
    is_active: bool
    orcid_id: str | None = None
    affiliation: str | None = None
    department: str | None = None
    created_at: datetime | None = None
    last_login_at: datetime | None = None

    model_config = ConfigDict(from_attributes = True)


class ProfessorPublicResponse(BaseModel):
    """Reduced view of a professor, used in public catalogues and dashboards."""

    id: int
    username: str
    full_name: str
    orcid_id: str | None = None
    affiliation: str | None = None
    department: str | None = None

    model_config = ConfigDict(from_attributes = True)
