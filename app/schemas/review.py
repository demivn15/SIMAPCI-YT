"""
File: schemas/review.py
Description: Request contract used by the review-committee (ADMIN) endpoints
             to verify or reject a professor's manually submitted product.
"""

from pydantic import BaseModel, Field, model_validator
from app.models.common import VerificationStatus


class ReviewDecision(BaseModel):
    """Payload accepted by PATCH /review/publications/{id} and /review/projects/{id}."""

    status: VerificationStatus = Field(
        description = "Must be VERIFIED or REJECTED; UPLOADED/UNDER_REVIEW are not valid decisions."
    )
    rejection_reason: str | None = Field(
        default = None,
        max_length = 500,
        description = "Required when status is REJECTED."
    )

    @model_validator(mode = "after")
    def validate_decision(self) -> "ReviewDecision":
        if self.status not in (VerificationStatus.VERIFIED, VerificationStatus.REJECTED):
            raise ValueError("A review decision must be either 'verified' or 'rejected'.")
        if self.status == VerificationStatus.REJECTED and not self.rejection_reason:
            raise ValueError("A rejection requires a 'rejection_reason'.")
        return self
