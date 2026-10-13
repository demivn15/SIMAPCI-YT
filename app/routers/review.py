"""
File: routers/review.py
Description: Review-committee ("consejo de revisión") endpoints. Only ADMIN
             accounts may verify or reject a manually submitted publication
             or project (charter requirements #1 and #7).
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_database_session
from app.models.common import VerificationStatus
from app.models.notification import NotificationProductType
from app.models.project import ResearchProjectModel
from app.models.publication import PublicationModel
from app.models.user import UserModel
from app.schemas.project import ProjectListResponse, ProjectResponse
from app.schemas.publication import PublicationListResponse, PublicationResponse
from app.schemas.review import ReviewDecision
from app.security.dependencies import require_admin
from app.services.notifications import notify_status_change

router = APIRouter(
    prefix = "/review",
    tags = ["Review Committee"],
    dependencies = [Depends(require_admin)],
    responses = {
        401: {"description": "Missing, invalid or expired access token."},
        403: {"description": "This action is restricted to the review committee."},
    }
)


@router.get(
    "/publications",
    response_model = PublicationListResponse,
    summary = "List publications awaiting committee review",
    description = "Defaults to the UPLOADED queue; pass `status` to see verified/rejected history instead."
)
def list_publications_for_review(
    db: Session = Depends(get_database_session),
    status_filter: VerificationStatus = Query(default = VerificationStatus.UPLOADED, alias = "status"),
    skip: int = Query(default = 0, ge = 0),
    limit: int = Query(default = 20, ge = 1, le = 100)
):
    """List publications in a given review state, oldest first (FIFO review queue)."""
    query = db.query(PublicationModel).filter(PublicationModel.status == status_filter)

    total = query.count()
    items = query.order_by(PublicationModel.created_at.asc()).offset(skip).limit(limit).all()

    return PublicationListResponse(total = total, skip = skip, limit = limit, items = items)


@router.patch(
    "/publications/{publication_id}",
    response_model = PublicationResponse,
    summary = "Verify or reject a submitted publication",
    description = "Records the committee's decision and notifies the owning professor.",
    responses = {404: {"description": "No publication with that id."}}
)
def review_publication(
    publication_id: int,
    decision: ReviewDecision,
    admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_database_session)
):
    """Apply a VERIFIED/REJECTED decision to one publication."""
    publication = db.query(PublicationModel).filter(PublicationModel.id == publication_id).first()
    if publication is None:
        raise HTTPException(status_code = status.HTTP_404_NOT_FOUND, detail = "Publication not found.")

    publication.status = decision.status
    publication.rejection_reason = decision.rejection_reason if decision.status == VerificationStatus.REJECTED else None
    publication.reviewed_by_id = admin.id
    publication.reviewed_at = datetime.now(timezone.utc).replace(tzinfo = None)

    db.add(publication)
    db.commit()
    db.refresh(publication)

    notify_status_change(
        db, publication.owner_id, NotificationProductType.PUBLICATION,
        publication.id, publication.title, decision.status, decision.rejection_reason
    )

    return publication


@router.get(
    "/projects",
    response_model = ProjectListResponse,
    summary = "List research projects awaiting committee review",
    description = "Defaults to the UPLOADED queue; pass `status` to see verified/rejected history instead."
)
def list_projects_for_review(
    db: Session = Depends(get_database_session),
    status_filter: VerificationStatus = Query(default = VerificationStatus.UPLOADED, alias = "status"),
    skip: int = Query(default = 0, ge = 0),
    limit: int = Query(default = 20, ge = 1, le = 100)
):
    """List research projects in a given review state, oldest first."""
    query = db.query(ResearchProjectModel).filter(ResearchProjectModel.status == status_filter)

    total = query.count()
    items = query.order_by(ResearchProjectModel.created_at.asc()).offset(skip).limit(limit).all()

    return ProjectListResponse(total = total, skip = skip, limit = limit, items = items)


@router.patch(
    "/projects/{project_id}",
    response_model = ProjectResponse,
    summary = "Verify or reject a submitted research project",
    description = "Records the committee's decision and notifies the owning professor.",
    responses = {404: {"description": "No project with that id."}}
)
def review_project(
    project_id: int,
    decision: ReviewDecision,
    admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_database_session)
):
    """Apply a VERIFIED/REJECTED decision to one research project."""
    project = db.query(ResearchProjectModel).filter(ResearchProjectModel.id == project_id).first()
    if project is None:
        raise HTTPException(status_code = status.HTTP_404_NOT_FOUND, detail = "Project not found.")

    project.status = decision.status
    project.rejection_reason = decision.rejection_reason if decision.status == VerificationStatus.REJECTED else None
    project.reviewed_by_id = admin.id
    project.reviewed_at = datetime.now(timezone.utc).replace(tzinfo = None)

    db.add(project)
    db.commit()
    db.refresh(project)

    notify_status_change(
        db, project.owner_id, NotificationProductType.PROJECT,
        project.id, project.title, decision.status, decision.rejection_reason
    )

    return project
