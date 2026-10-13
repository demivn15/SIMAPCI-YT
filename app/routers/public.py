"""
File: routers/public.py
Description: Endpoints that any visitor may call without authentication:
             browsing/filtering the production científica (charter
             requirement #4), the impact dashboard (objective 3) and the
             export of filtered results (requirement #9, available to guests
             as well as signed-in professors).
"""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload
from app.config import settings
from app.database import get_database_session
from app.models.common import VerificationStatus
from app.models.project import ProjectStatus, ResearchProjectModel
from app.models.publication import PublicationModel, PublicationType
from app.schemas.dashboard import DashboardResponse
from app.schemas.project import ProjectPublicResponse
from app.schemas.publication import PublicationPublicResponse
from app.services.export import EXPORT_MEDIA_TYPES, build_export
from app.services.metrics import get_all_professor_metrics, get_publication_timeline, get_school_summary

router = APIRouter(prefix = "/public", tags = ["Public"])

PUBLICATION_EXPORT_COLUMNS = [
    "id", "title", "publication_type", "venue", "year", "authors",
    "doi", "citation_count", "owner_full_name",
]
PROJECT_EXPORT_COLUMNS = [
    "id", "title", "project_status", "project_code", "start_date", "end_date", "owner_full_name",
]


def _public_publication_query(db: Session):
    return (
        db.query(PublicationModel)
        .options(joinedload(PublicationModel.owner))
        .filter(PublicationModel.status == VerificationStatus.VERIFIED, PublicationModel.is_public.is_(True))
    )


def _public_project_query(db: Session):
    return (
        db.query(ResearchProjectModel)
        .options(joinedload(ResearchProjectModel.owner))
        .filter(ResearchProjectModel.status == VerificationStatus.VERIFIED, ResearchProjectModel.is_public.is_(True))
    )


@router.get(
    "/info",
    summary = "Obtain public API information",
    description = "Returns general information about the API without requiring authentication."
)
def public_info():
    """Describe the API to anonymous clients."""
    return {
        "application": settings.APP_NAME,
        "institution": "Escuela de Ciencias Matemáticas y Computacionales, Yachay Tech",
        "description": (
            "RED PAPERS: portal para la visualización y gestión de la producción "
            "científica de los docentes de la ECMC."
        ),
        "version": settings.API_VERSION,
        "authentication_required": False,
        "documentation": "/docs",
        "openapi_schema": "/openapi.json",
    }


@router.get(
    "/categories",
    summary = "List the controlled vocabularies used by the forms",
    description = "Publication types and project states, for building filter/search UIs."
)
def public_categories():
    """Expose the enumerations used by the publication and project entities."""
    return {
        "publication_types": [
            {"value": item.value, "label": item.value.replace("_", " ").title()}
            for item in PublicationType
        ],
        "project_statuses": [
            {"value": item.value, "label": item.value.replace("_", " ").title()}
            for item in ProjectStatus
        ],
    }


@router.get(
    "/publications",
    response_model = list[PublicationPublicResponse],
    summary = "Browse and filter the public catalogue of publications",
    description = "Only publications that passed committee review AND were marked public appear here."
)
def public_publications(
    db: Session = Depends(get_database_session),
    publication_type: PublicationType | None = Query(default = None),
    year: int | None = Query(default = None, ge = 1900, le = 2100),
    professor_username: str | None = Query(default = None),
    search: str | None = Query(default = None, min_length = 2, max_length = 100),
    skip: int = Query(default = 0, ge = 0),
    limit: int = Query(default = 20, ge = 1, le = 100)
):
    """List the publications that have passed review and been shared publicly."""
    query = _public_publication_query(db)

    if publication_type is not None:
        query = query.filter(PublicationModel.publication_type == publication_type)
    if year is not None:
        query = query.filter(PublicationModel.year == year)
    if professor_username:
        query = query.join(PublicationModel.owner).filter(
            PublicationModel.owner.has(username = professor_username)
        )
    if search:
        query = query.filter(PublicationModel.title.ilike(f"%{search}%"))

    return (
        query.order_by(PublicationModel.year.desc().nullslast(), PublicationModel.id.desc())
        .offset(skip).limit(limit).all()
    )


@router.get(
    "/publications/export",
    summary = "Download the filtered public catalogue of publications",
    description = "Charter requirement #9: any visitor, authenticated or not, may export filtered results."
)
def export_public_publications(
    db: Session = Depends(get_database_session),
    publication_type: PublicationType | None = Query(default = None),
    year: int | None = Query(default = None, ge = 1900, le = 2100),
    search: str | None = Query(default = None, min_length = 2, max_length = 100),
    export_format: str = Query(default = "csv", alias = "format", pattern = "^(csv|xlsx|pdf)$")
):
    """Export the public, verified publication catalogue, honouring the same filters as the listing."""
    query = _public_publication_query(db)

    if publication_type is not None:
        query = query.filter(PublicationModel.publication_type == publication_type)
    if year is not None:
        query = query.filter(PublicationModel.year == year)
    if search:
        query = query.filter(PublicationModel.title.ilike(f"%{search}%"))

    items = query.order_by(PublicationModel.year.desc().nullslast()).all()

    rows = [
        {
            "id": item.id, "title": item.title, "publication_type": item.publication_type.value,
            "venue": item.venue, "year": item.year, "authors": item.authors, "doi": item.doi,
            "citation_count": item.citation_count, "owner_full_name": item.owner.full_name,
        }
        for item in items
    ]

    content = build_export(export_format, rows, PUBLICATION_EXPORT_COLUMNS, title = "ECMC Publications")

    return Response(
        content = content,
        media_type = EXPORT_MEDIA_TYPES[export_format],
        headers = {"Content-Disposition": f'attachment; filename="ecmc_publications.{export_format}"'}
    )


@router.get(
    "/projects",
    response_model = list[ProjectPublicResponse],
    summary = "Browse and filter the public catalogue of research projects",
    description = "Only projects that passed committee review AND were marked public appear here."
)
def public_projects(
    db: Session = Depends(get_database_session),
    project_status: ProjectStatus | None = Query(default = None),
    professor_username: str | None = Query(default = None),
    search: str | None = Query(default = None, min_length = 2, max_length = 100),
    skip: int = Query(default = 0, ge = 0),
    limit: int = Query(default = 20, ge = 1, le = 100)
):
    """List the research projects that have passed review and been shared publicly."""
    query = _public_project_query(db)

    if project_status is not None:
        query = query.filter(ResearchProjectModel.project_status == project_status)
    if professor_username:
        query = query.join(ResearchProjectModel.owner).filter(
            ResearchProjectModel.owner.has(username = professor_username)
        )
    if search:
        query = query.filter(ResearchProjectModel.title.ilike(f"%{search}%"))

    return (
        query.order_by(ResearchProjectModel.start_date.desc().nullslast())
        .offset(skip).limit(limit).all()
    )


@router.get(
    "/projects/export",
    summary = "Download the filtered public catalogue of research projects",
    description = "Charter requirement #9: any visitor, authenticated or not, may export filtered results."
)
def export_public_projects(
    db: Session = Depends(get_database_session),
    project_status: ProjectStatus | None = Query(default = None),
    search: str | None = Query(default = None, min_length = 2, max_length = 100),
    export_format: str = Query(default = "csv", alias = "format", pattern = "^(csv|xlsx|pdf)$")
):
    """Export the public, verified project catalogue, honouring the same filters as the listing."""
    query = _public_project_query(db)

    if project_status is not None:
        query = query.filter(ResearchProjectModel.project_status == project_status)
    if search:
        query = query.filter(ResearchProjectModel.title.ilike(f"%{search}%"))

    items = query.order_by(ResearchProjectModel.start_date.desc().nullslast()).all()

    rows = [
        {
            "id": item.id, "title": item.title, "project_status": item.project_status.value,
            "project_code": item.project_code,
            "start_date": item.start_date.isoformat() if item.start_date else None,
            "end_date": item.end_date.isoformat() if item.end_date else None,
            "owner_full_name": item.owner.full_name,
        }
        for item in items
    ]

    content = build_export(export_format, rows, PROJECT_EXPORT_COLUMNS, title = "ECMC Research Projects")

    return Response(
        content = content,
        media_type = EXPORT_MEDIA_TYPES[export_format],
        headers = {"Content-Disposition": f'attachment; filename="ecmc_projects.{export_format}"'}
    )


@router.get(
    "/dashboard",
    response_model = DashboardResponse,
    summary = "Impact dashboard of the ECMC's scientific production",
    description = (
        "Charter objective: 'Implementar un dashboard interactivo que visualice "
        "métricas clave, como el número de publicaciones por usuario, número de "
        "citas, índice h de los docentes y la evolución temporal'. Open to "
        "visitors, per the charter's stakeholder list ('Público General')."
    )
)
def public_dashboard(db: Session = Depends(get_database_session)):
    """Everything the landing-page dashboard needs, in a single call."""
    return DashboardResponse(
        summary = get_school_summary(db),
        timeline = get_publication_timeline(db),
        professors = get_all_professor_metrics(db)
    )
