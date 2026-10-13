"""
File: routers/publications.py
Description: JWT protected CRUD over the "Publicación Científica" entity,
             plus the DOI-existence validation, PDF metadata autocomplete,
             citation refresh and export helpers the charter asks for.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.database import get_database_session
from app.models.common import ProductSource, VerificationStatus
from app.models.publication import PublicationModel, PublicationType
from app.models.user import UserModel
from app.schemas.pdf_extraction import PdfExtractionResponse
from app.schemas.publication import (
    DoiLookupResponse,
    PublicationCreate,
    PublicationListResponse,
    PublicationResponse,
    PublicationUpdate,
)
from app.integrations import crossref, openalex
from app.security.dependencies import get_current_active_user
from app.services import pdf_extraction
from app.services.export import EXPORT_MEDIA_TYPES, build_export
from app.services.notifications import notify_status_change
from app.models.notification import NotificationProductType

router = APIRouter(
    prefix = "/publications",
    tags = ["Publications"],
    dependencies = [Depends(get_current_active_user)],
    responses = {401: {"description": "Missing, invalid or expired access token."}}
)

EXPORT_COLUMNS = [
    "id", "title", "publication_type", "venue", "year", "authors",
    "doi", "citation_count", "source", "status", "is_public", "created_at",
]


def _get_owned_publication(publication_id: int, db: Session, current_user: UserModel) -> PublicationModel:
    """Load a publication and make sure the caller owns it (authorisation, not just authentication)."""
    publication = db.query(PublicationModel).filter(PublicationModel.id == publication_id).first()

    if publication is None:
        raise HTTPException(status_code = status.HTTP_404_NOT_FOUND, detail = "Publication not found.")

    if publication.owner_id != current_user.id:
        raise HTTPException(status_code = status.HTTP_403_FORBIDDEN, detail = "This publication belongs to another user.")

    return publication


@router.get(
    "/lookup-doi",
    response_model = DoiLookupResponse,
    summary = "Validate a DOI's existence and preview its metadata",
    description = (
        "Charter requirement #5 ('Validación de existencia de productos'): checks "
        "the DOI against Crossref, enriches it with OpenAlex's citation count, and "
        "flags whether it is already registered in our own database."
    )
)
def lookup_doi(
    doi: str = Query(..., examples = ["10.1000/xyz123"]),
    db: Session = Depends(get_database_session)
):
    """Look up a DOI on Crossref/OpenAlex before the professor commits to it."""
    normalized = crossref.normalize_doi(doi)

    try:
        metadata = crossref.lookup_doi(normalized)
    except Exception as error:
        raise HTTPException(
            status_code = status.HTTP_502_BAD_GATEWAY,
            detail = f"Could not reach Crossref right now: {error}"
        )

    already_registered = (
        db.query(PublicationModel).filter(PublicationModel.doi == normalized).first() is not None
    )

    if metadata is None:
        return DoiLookupResponse(doi = normalized, exists = False, already_registered = already_registered)

    citation_count = None
    try:
        citation_count = openalex.get_citation_count_by_doi(normalized)
    except Exception:
        # Citation enrichment is best-effort; DOI existence is what matters here.
        citation_count = None

    return DoiLookupResponse(
        doi = normalized,
        exists = True,
        title = metadata["title"],
        venue = metadata["venue"],
        year = metadata["year"],
        authors = metadata["authors"],
        publication_type = metadata["publication_type"],
        citation_count = citation_count,
        already_registered = already_registered
    )


@router.post(
    "/extract-pdf",
    response_model = PdfExtractionResponse,
    summary = "Extract basic metadata from an uploaded PDF",
    description = (
        "Charter requirement #3: reads the PDF's embedded document info and first "
        "page to SUGGEST a title, authors, year and DOI. Nothing is saved: submit "
        "the (possibly corrected) values through POST /publications afterwards."
    ),
    responses = {422: {"description": "The uploaded file is not a readable PDF."}}
)
async def extract_pdf_metadata(file: UploadFile):
    """Suggest publication fields from an uploaded PDF, without saving anything."""
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
    response_model = PublicationResponse,
    status_code = status.HTTP_201_CREATED,
    summary = "Register a new scientific publication",
    description = (
        "Creates a manually-registered publication owned by the authenticated "
        "professor. When a DOI is given, it must exist on Crossref, and any of "
        "venue/year/authors left blank is autocompleted from Crossref's record. "
        "The record starts as UPLOADED and awaits the review committee."
    ),
    responses = {
        409: {"description": "That DOI is already registered."},
        422: {"description": "Invalid payload, or the DOI does not exist on Crossref."},
    }
)
def create_publication(
    payload: PublicationCreate,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session)
):
    """Create a manually-submitted publication, pending committee review."""
    doi = crossref.normalize_doi(payload.doi) if payload.doi else None

    if doi:
        if db.query(PublicationModel).filter(PublicationModel.doi == doi).first():
            raise HTTPException(status_code = status.HTTP_409_CONFLICT, detail = "This DOI is already registered.")

        try:
            metadata = crossref.lookup_doi(doi)
        except Exception as error:
            raise HTTPException(
                status_code = status.HTTP_502_BAD_GATEWAY,
                detail = f"Could not validate the DOI against Crossref right now: {error}"
            )

        if metadata is None:
            raise HTTPException(
                status_code = status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail = f"DOI '{doi}' was not found on Crossref."
            )
    else:
        metadata = {}

    # Charter requirement #3 ("autocompletado"): fields the professor left
    # empty are filled in from Crossref's record of the DOI. Anything they
    # did type is kept as-is -- the API never overwrites an explicit value.
    publication = PublicationModel(
        title = payload.title,
        abstract = payload.abstract,
        publication_type = payload.publication_type,
        venue = payload.venue or metadata.get("venue"),
        year = payload.year or metadata.get("year"),
        authors = payload.authors or metadata.get("authors"),
        doi = doi,
        source = ProductSource.MANUAL,
        status = VerificationStatus.UPLOADED,
        is_public = payload.is_public,
        owner_id = current_user.id,
        project_id = payload.project_id
    )

    db.add(publication)
    db.commit()
    db.refresh(publication)

    notify_status_change(
        db, current_user.id, NotificationProductType.PUBLICATION,
        publication.id, publication.title, VerificationStatus.UPLOADED
    )

    return publication


@router.get(
    "",
    response_model = PublicationListResponse,
    summary = "List the publications of the authenticated professor",
    description = "Paginated list restricted to the caller's own records, with optional filters."
)
def list_publications(
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session),
    status_filter: VerificationStatus | None = Query(default = None, alias = "status"),
    publication_type: PublicationType | None = Query(default = None),
    year: int | None = Query(default = None, ge = 1900, le = 2100),
    search: str | None = Query(default = None, min_length = 2, max_length = 100),
    skip: int = Query(default = 0, ge = 0),
    limit: int = Query(default = 20, ge = 1, le = 100)
):
    """Return the publications owned by the authenticated professor."""
    query = db.query(PublicationModel).filter(PublicationModel.owner_id == current_user.id)

    if status_filter is not None:
        query = query.filter(PublicationModel.status == status_filter)
    if publication_type is not None:
        query = query.filter(PublicationModel.publication_type == publication_type)
    if year is not None:
        query = query.filter(PublicationModel.year == year)
    if search:
        query = query.filter(PublicationModel.title.ilike(f"%{search}%"))

    total = query.count()
    items = query.order_by(PublicationModel.created_at.desc()).offset(skip).limit(limit).all()

    return PublicationListResponse(total = total, skip = skip, limit = limit, items = items)


@router.get(
    "/export",
    summary = "Download the authenticated professor's own publication history",
    description = "Charter requirement #9: export the caller's full history as CSV, PDF or Excel.",
    responses = {200: {"content": {"text/csv": {}, "application/pdf": {}}}}
)
def export_my_publications(
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session),
    export_format: str = Query(default = "csv", alias = "format", pattern = "^(csv|xlsx|pdf)$")
):
    """Export every publication owned by the caller, regardless of review status."""
    items = (
        db.query(PublicationModel)
        .filter(PublicationModel.owner_id == current_user.id)
        .order_by(PublicationModel.year.desc().nullslast())
        .all()
    )

    rows = [
        {
            "id": item.id, "title": item.title,
            "publication_type": item.publication_type.value, "venue": item.venue,
            "year": item.year, "authors": item.authors, "doi": item.doi,
            "citation_count": item.citation_count, "source": item.source.value,
            "status": item.status.value, "is_public": item.is_public,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in items
    ]

    content = build_export(export_format, rows, EXPORT_COLUMNS, title = "My Publications")
    filename = f"publications.{export_format}"

    return Response(
        content = content,
        media_type = EXPORT_MEDIA_TYPES[export_format],
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get(
    "/{publication_id}",
    response_model = PublicationResponse,
    summary = "Get one publication",
    responses = {
        403: {"description": "The publication belongs to another user."},
        404: {"description": "No publication with that id."},
    }
)
def read_publication(
    publication_id: int,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session)
):
    """Return one publication owned by the authenticated professor."""
    return _get_owned_publication(publication_id, db, current_user)


@router.patch(
    "/{publication_id}",
    response_model = PublicationResponse,
    summary = "Partially update a publication",
    description = "A rejected publication that is edited is automatically resubmitted (status -> UPLOADED).",
    responses = {
        403: {"description": "The publication belongs to another user."},
        404: {"description": "No publication with that id."},
    }
)
def update_publication(
    publication_id: int,
    payload: PublicationUpdate,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session)
):
    """Apply a partial update to a publication, owned by the authenticated professor."""
    publication = _get_owned_publication(publication_id, db, current_user)

    for field, value in payload.model_dump(exclude_unset = True).items():
        setattr(publication, field, value)

    resubmitted = publication.status == VerificationStatus.REJECTED and publication.source == ProductSource.MANUAL
    if resubmitted:
        publication.status = VerificationStatus.UPLOADED
        publication.rejection_reason = None

    db.add(publication)
    db.commit()
    db.refresh(publication)

    if resubmitted:
        notify_status_change(
            db, current_user.id, NotificationProductType.PUBLICATION,
            publication.id, publication.title, VerificationStatus.UPLOADED
        )

    return publication


@router.post(
    "/{publication_id}/refresh-citations",
    response_model = PublicationResponse,
    summary = "Refresh the citation count of a publication from OpenAlex",
    description = "Feeds the dashboard's citation-count and h-index metrics with a fresh value.",
    responses = {
        400: {"description": "This publication has no DOI to look up."},
        403: {"description": "The publication belongs to another user."},
        404: {"description": "No publication with that id."},
    }
)
def refresh_publication_citations(
    publication_id: int,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session)
):
    """Pull the latest citation count for a publication from OpenAlex."""
    publication = _get_owned_publication(publication_id, db, current_user)

    if not publication.doi:
        raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail = "This publication has no DOI.")

    try:
        count = openalex.get_citation_count_by_doi(publication.doi)
    except Exception as error:
        raise HTTPException(status_code = status.HTTP_502_BAD_GATEWAY, detail = f"OpenAlex lookup failed: {error}")

    publication.citation_count = count or 0
    publication.citation_count_updated_at = datetime.now(timezone.utc).replace(tzinfo = None)

    db.add(publication)
    db.commit()
    db.refresh(publication)

    return publication


@router.delete(
    "/{publication_id}",
    status_code = status.HTTP_204_NO_CONTENT,
    summary = "Delete a publication",
    responses = {
        403: {"description": "The publication belongs to another user."},
        404: {"description": "No publication with that id."},
    }
)
def delete_publication(
    publication_id: int,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session)
):
    """Delete a publication owned by the authenticated professor."""
    publication = _get_owned_publication(publication_id, db, current_user)

    db.delete(publication)
    db.commit()
