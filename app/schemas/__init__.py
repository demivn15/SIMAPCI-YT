"""
File: schemas/__init__.py
Description: Re-exports the Pydantic contracts used across the routers.
"""

from app.schemas.token import MessageResponse, RefreshRequest, TokenPair
from app.schemas.user import (
    ProfessorPublicResponse,
    UserLogin,
    UserRegister,
    UserResponse,
    UserUpdate,
)
from app.schemas.publication import (
    DoiLookupResponse,
    PublicationCreate,
    PublicationListResponse,
    PublicationPublicResponse,
    PublicationResponse,
    PublicationUpdate,
)
from app.schemas.project import (
    ProjectCodeLookupResponse,
    ProjectCreate,
    ProjectListResponse,
    ProjectPublicResponse,
    ProjectResponse,
    ProjectUpdate,
)
from app.schemas.notification import NotificationListResponse, NotificationResponse
from app.schemas.review import ReviewDecision
from app.schemas.dashboard import DashboardResponse, ProfessorMetrics, SchoolSummary, TimelinePoint
from app.schemas.pdf_extraction import PdfExtractionResponse
from app.schemas.orcid import (
    OrcidImportRequest,
    OrcidLinkRequest,
    OrcidWorksListResponse,
    OrcidWorkSummary,
)

__all__ = [
    "MessageResponse", "RefreshRequest", "TokenPair",
    "ProfessorPublicResponse", "UserLogin", "UserRegister", "UserResponse", "UserUpdate",
    "DoiLookupResponse", "PublicationCreate", "PublicationListResponse",
    "PublicationPublicResponse", "PublicationResponse", "PublicationUpdate",
    "ProjectCodeLookupResponse", "ProjectCreate", "ProjectListResponse",
    "ProjectPublicResponse", "ProjectResponse", "ProjectUpdate",
    "NotificationListResponse", "NotificationResponse",
    "ReviewDecision",
    "DashboardResponse", "ProfessorMetrics", "SchoolSummary", "TimelinePoint",
    "PdfExtractionResponse",
    "OrcidImportRequest", "OrcidLinkRequest", "OrcidWorksListResponse", "OrcidWorkSummary",
]
