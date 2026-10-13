"""
File: schemas/project.py
Description: Request and response contracts for the "Proyecto de
             Investigación" entity. Deliberately excludes any budget/funding
             field, per the charter's explicit out-of-scope list.
"""

from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.common import ProductSource, VerificationStatus
from app.models.project import ProjectStatus
from app.schemas.user import ProfessorPublicResponse


class ProjectCreate(BaseModel):
    """Payload accepted by POST /projects."""

    title: str = Field(min_length = 3, max_length = 500, examples = ["Andean Glacier Retreat Monitoring"])
    description: str | None = Field(default = None)
    project_status: ProjectStatus = Field(default = ProjectStatus.ONGOING)
    project_code: str | None = Field(
        default = None,
        max_length = 100,
        description = "Internal ECMC/Yachay Tech project code, checked for uniqueness.",
        examples = ["ECMC-2026-014"]
    )
    start_date: date | None = None
    end_date: date | None = None
    is_public: bool = Field(default = True)


class ProjectUpdate(BaseModel):
    """Payload accepted by PATCH /projects/{id}: only the changed fields."""

    title: str | None = Field(default = None, min_length = 3, max_length = 500)
    description: str | None = None
    project_status: ProjectStatus | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_public: bool | None = None


class ProjectResponse(BaseModel):
    """Full representation returned to the owner of the project."""

    id: int
    title: str
    description: str | None
    project_status: ProjectStatus
    project_code: str | None
    start_date: date | None
    end_date: date | None
    source: ProductSource
    status: VerificationStatus
    rejection_reason: str | None
    is_public: bool
    owner_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes = True)


class ProjectPublicResponse(BaseModel):
    """Representation used by the unauthenticated catalogue."""

    id: int
    title: str
    description: str | None
    project_status: ProjectStatus
    project_code: str | None
    start_date: date | None
    end_date: date | None
    owner: ProfessorPublicResponse

    model_config = ConfigDict(from_attributes = True)


class ProjectListResponse(BaseModel):
    """Paginated envelope so clients can page through large result sets."""

    total: int
    skip: int
    limit: int
    items: list[ProjectResponse]


class ProjectCodeLookupResponse(BaseModel):
    """Result of checking a project code against our own database."""

    project_code: str
    already_registered: bool
