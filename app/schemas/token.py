"""
File: schemas/token.py
Description: Request and response contracts for the JWT lifecycle.
"""

from pydantic import BaseModel, Field


class TokenPair(BaseModel):
    """Answer of /auth/login, /auth/token, /auth/refresh and the ORCID callback."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description = "Lifetime of the access token, in seconds.")
    refresh_expires_in: int = Field(description = "Lifetime of the refresh token, in seconds.")


class RefreshRequest(BaseModel):
    """Payload accepted by POST /auth/refresh and POST /auth/logout."""

    refresh_token: str = Field(description = "The refresh token previously returned by /auth/login.")


class MessageResponse(BaseModel):
    """Small, uniform body for operations that only need to confirm success."""

    detail: str = Field(examples = ["Session closed successfully."])
