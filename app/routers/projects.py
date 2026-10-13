"""
File: routers/projects.py
Description: JWT protected CRUD over the "Proyecto de Investigación" entity.
             Existence validation here is based on the internal project code
             (the charter names no external project registry, unlike DOIs for
             publications, which Crossref indexes).
"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.database import get_database_session
from app.models.common import ProductSource, VerificationStatus
from app.models.project import ProjectStatus, ResearchProjectModel
from app.models.user import UserModel
from app.models.notification import NotificationProductType
from app.schemas.pdf_extraction import PdfExtractionResponse
from app.schemas.project import (
    ProjectCodeLookupResponse,
    ProjectCreate,
    ProjectListResponse,
    ProjectResponse,
    ProjectUpdate,
)
from app.security.dependencies import get_current_active_user
from app.services import pdf_extraction
from app.services.export import EXPORT_MEDIA_TYPES, build_export
from app.services.notifications import notify_status_change

router = APIRouter(
    prefix = "/projects",
    tags = ["Projects"],
    dependencies = [Depends(get_current_active_user)],
    responses = {401: {"description": "Missing, invalid or expired access token."}}
)

EXPORT_COLUMNS = [
    "id", "title", "project_status", "project_code", "start_date", "end_date",
    "source", "status", "is_public", "created_at",
]


def _get_owned_project(project_id: int, db: Session, current_user: UserModel) -> ResearchProjectModel:
    """Load a project and make sure the caller owns it."""
    project = db.query(ResearchProjectModel).filter(ResearchProjectModel.id == project_id).first()

    if project is None:
        raise HTTPException(status_code = status.HTTP_404_NOT_FOUND, detail = "Project not found.")

    if project.owner_id != current_user.id:
        raise HTTPException(status_code = status.HTTP_403_FORBIDDEN, detail = "This project belongs to another user.")

    return project


@router.get(
    "/lookup-code",
    response_model = ProjectCodeLookupResponse,
    summary = "Check whether a project code is already registered",
    description = "Charter requirement #5 applied to projects: validate existence via project code."
)
def lookup_project_code(
    project_code: str = Query(..., min_length = 1, max_length = 100),
    db: Session = Depends(get_database_session)
):
    """Check a project code against our own database before registering it."""
    exists = (
        db.query(ResearchProjectModel)
        .filter(ResearchProjectModel.project_code == project_code)
        .first() is not None
    )
    return ProjectCodeLookupResponse(project_code = project_code, already_registered = exists)


@router.post(
    "/extract-pdf",
    response_model = PdfExtractionResponse,
    summary = "Extract basic metadata from an uploaded project PDF",
    description = "Same basic autocomplete as for publications, scoped to title/authors/year/DOI.",
    responses = {422: {"description": "The uploaded file is not a readable PDF."}}
)
async def extract_pdf_metadata(file: UploadFile):
    """Suggest project fields from an uploaded PDF, without saving anything."""
    file_bytes = await file.read()
    try:
        extracted = pdf_extraction.extract_basic_metadata(file_bytes)
    except ValueError as error:
        raise HTTPException(status_code = status.HTTP_422_UNPROCESSABLE_CONTENT, detail = str(error))

    return PdfExtractionResponse(
        title = extracted.title,
        authors = extracted.authors,
        year = extracted.year,
        doi = extracted.doi,
        page_count = extracted.page_count
    )


@router.post(
    "",
    response_model = ProjectResponse,
    status_code = status.HTTP_201_CREATED,
    summary = "Register a new research project",
    description = "Creates a project owned by the authenticated professor, pending committee review.",
    responses = {409: {"description": "That project code is already registered."}}
)
def create_project(
    payload: ProjectCreate,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session)
):
    """Create a manually-submitted research project."""
    if payload.project_code:
        if db.query(ResearchProjectModel).filter(ResearchProjectModel.project_code == payload.project_code).first():
            raise HTTPException(status_code = status.HTTP_409_CONFLICT, detail = "This project code is already registered.")

    project = ResearchProjectModel(
        title = payload.title,
        description = payload.description,
        project_status = payload.project_status,
        project_code = payload.project_code,
        start_date = payload.start_date,
        end_date = payload.end_date,
        source = ProductSource.MANUAL,
        status = VerificationStatus.UPLOADED,
        is_public = payload.is_public,
        owner_id = current_user.id
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    notify_status_change(
        db, current_user.id, NotificationProductType.PROJECT,
        project.id, project.title, VerificationStatus.UPLOADED
    )

    return project


@router.get(
    "",
    response_model = ProjectListResponse,
    summary = "List the research projects of the authenticated professor"
)
def list_projects(
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session),
    status_filter: VerificationStatus | None = Query(default = None, alias = "status"),
    project_status: ProjectStatus | None = Query(default = None),
    search: str | None = Query(default = None, min_length = 2, max_length = 100),
    skip: int = Query(default = 0, ge = 0),
    limit: int = Query(default = 20, ge = 1, le = 100)
):
    """Return the projects owned by the authenticated professor."""
    query = db.query(ResearchProjectModel).filter(ResearchProjectModel.owner_id == current_user.id)

    if status_filter is not None:
        query = query.filter(ResearchProjectModel.status == status_filter)
    if project_status is not None:
        query = query.filter(ResearchProjectModel.project_status == project_status)
    if search:
        query = query.filter(ResearchProjectModel.title.ilike(f"%{search}%"))

    total = query.count()
    items = query.order_by(ResearchProjectModel.created_at.desc()).offset(skip).limit(limit).all()

    return ProjectListResponse(total = total, skip = skip, limit = limit, items = items)


@router.get(
    "/export",
    summary = "Download the authenticated professor's own project history",
    description = "Charter requirement #9: export the caller's full history as CSV, PDF or Excel."
)
def export_my_projects(
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session),
    export_format: str = Query(default = "csv", alias = "format", pattern = "^(csv|xlsx|pdf)$")
):
    """Export every project owned by the caller, regardless of review status."""
    items = (
        db.query(ResearchProjectModel)
        .filter(ResearchProjectModel.owner_id == current_user.id)
        .order_by(ResearchProjectModel.created_at.desc())
        .all()
    )

    rows = [
        {
            "id": item.id, "title": item.title,
            "project_status": item.project_status.value, "project_code": item.project_code,
            "start_date": item.start_date.isoformat() if item.start_date else None,
            "end_date": item.end_date.isoformat() if item.end_date else None,
            "source": item.source.value, "status": item.status.value, "is_public": item.is_public,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in items
    ]

    content = build_export(export_format, rows, EXPORT_COLUMNS, title = "My Projects")

    return Response(
        content = content,
        media_type = EXPORT_MEDIA_TYPES[export_format],
        headers = {"Content-Disposition": f'attachment; filename="projects.{export_format}"'}
    )


@router.get(
    "/{project_id}",
    response_model = ProjectResponse,
    summary = "Get one research project",
    responses = {
        403: {"description": "The project belongs to another user."},
        404: {"description": "No project with that id."},
    }
)
def read_project(
    project_id: int,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session)
):
    """Return one project owned by the authenticated professor."""
    return _get_owned_project(project_id, db, current_user)


@router.patch(
    "/{project_id}",
    response_model = ProjectResponse,
    summary = "Partially update a research project",
    description = "A rejected project that is edited is automatically resubmitted (status -> UPLOADED).",
    responses = {
        403: {"description": "The project belongs to another user."},
        404: {"description": "No project with that id."},
    }
)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session)
):
    """Apply a partial update to a project, owned by the authenticated professor."""
    project = _get_owned_project(project_id, db, current_user)

    for field, value in payload.model_dump(exclude_unset = True).items():
        setattr(project, field, value)

    resubmitted = project.status == VerificationStatus.REJECTED
    if resubmitted:
        project.status = VerificationStatus.UPLOADED
        project.rejection_reason = None

    db.add(project)
    db.commit()
    db.refresh(project)

    if resubmitted:
        notify_status_change(
            db, current_user.id, NotificationProductType.PROJECT,
            project.id, project.title, VerificationStatus.UPLOADED
        )

    return project


@router.delete(
    "/{project_id}",
    status_code = status.HTTP_204_NO_CONTENT,
    summary = "Delete a research project",
    responses = {
        403: {"description": "The project belongs to another user."},
        404: {"description": "No project with that id."},
    }
)
def delete_project(
    project_id: int,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session)
):
    """Delete a project owned by the authenticated professor."""
    project = _get_owned_project(project_id, db, current_user)

    db.delete(project)
    db.commit()
