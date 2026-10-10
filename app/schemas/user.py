"""
File: schemas/user.py
Description: Definition of request and response contracts for user data.
"""

from pydantic import BaseModel, EmailStr, ConfigDict

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    is_active: bool

    model_config = ConfigDict(
        from_attributes = True
    )