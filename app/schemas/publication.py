"""
File: schemas/publication.py
Description: Request and response contracts for the "Publicación Científica"
             entity.
"""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.common import ProductSource, VerificationStatus
from app.models.publication import PublicationType
from app.schemas.user import ProfessorPublicResponse


class PublicationCreate(BaseModel):
    """Payload accepted by POST /publications (manual registration)."""

    title: str = Field(min_length = 3, max_length = 500, examples = ["A Hybrid Model for Andean Glacier Retreat"])
    abstract: str | None = Field(default = None)
    publication_type: PublicationType = Field(default = PublicationType.JOURNAL_ARTICLE)
    venue: str | None = Field(default = None, max_length = 255, examples = ["Journal of Computational Science"])
    year: int | None = Field(default = None, ge = 1900, le = 2100, examples = [2026])
    authors: str | None = Field(default = None, max_length = 1000)
    doi: str | None = Field(
        default = None,
        max_length = 120,
        description = "When provided, the API validates it against Crossref before accepting the record.",
        examples = ["10.1000/xyz123"]
    )
    is_public: bool = Field(default = True, description = "Expose this record through the public catalogue once verified.")
    project_id: int | None = Field(default = None, description = "Research project this publication came from, if any.")


class PublicationUpdate(BaseModel):
    """Payload accepted by PATCH /publications/{id}: only the changed fields."""

    title: str | None = Field(default = None, min_length = 3, max_length = 500)
    abstract: str | None = None
    publication_type: PublicationType | None = None
    venue: str | None = Field(default = None, max_length = 255)
    year: int | None = Field(default = None, ge = 1900, le = 2100)
    authors: str | None = Field(default = None, max_length = 1000)
    is_public: bool | None = None
    project_id: int | None = None


class PublicationResponse(BaseModel):
    """Full representation returned to the owner of the publication."""

    id: int
    title: str
    abstract: str | None
    publication_type: PublicationType
    venue: str | None
    year: int | None
    authors: str | None
    doi: str | None
    citation_count: int
    source: ProductSource
    status: VerificationStatus
    rejection_reason: str | None
    is_public: bool
    owner_id: int
    project_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes = True)


class PublicationPublicResponse(BaseModel):
    """Representation used by the unauthenticated catalogue and dashboard."""

    id: int
    title: str
    abstract: str | None
    publication_type: PublicationType
    venue: str | None
    year: int | None
    authors: str | None
    doi: str | None
    citation_count: int
    owner: ProfessorPublicResponse

    model_config = ConfigDict(from_attributes = True)


class PublicationListResponse(BaseModel):
    """Paginated envelope so clients can page through large result sets."""

    total: int
    skip: int
    limit: int
    items: list[PublicationResponse]


class DoiLookupResponse(BaseModel):
    """Result of validating/autocompleting a DOI against Crossref + OpenAlex."""

    doi: str
    exists: bool
    title: str | None = None
    venue: str | None = None
    year: int | None = None
    authors: str | None = None
    publication_type: str | None = None
    citation_count: int | None = None
    already_registered: bool = Field(
        default = False,
        description = "True when this DOI is already present in our own database."
    )
