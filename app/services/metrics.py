"""
File: services/metrics.py
Description: Bibliometric and dashboard calculations required by the charter
             objective "Proveer análisis y métricas de impacto": publications
             per user, citation counts, h-index, and the school's temporal
             evolution. Every query here only ever considers records with
             status == VERIFIED, since unreviewed submissions should not
             count towards official metrics.
"""

from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.common import VerificationStatus
from app.models.publication import PublicationModel
from app.models.project import ResearchProjectModel
from app.models.user import UserModel


def compute_h_index(citation_counts: list[int]) -> int:
    """
    Standard h-index: the largest h such that h publications have each been
    cited at least h times.
    """
    counts = sorted(citation_counts, reverse = True)
    h_index = 0
    for position, citations in enumerate(counts, start = 1):
        if citations >= position:
            h_index = position
        else:
            break
    return h_index


def get_professor_metrics(db: Session, user: UserModel) -> dict:
    """Publications, citations and h-index for one professor (verified records only)."""
    citation_counts = [
        row[0] for row in
        db.query(PublicationModel.citation_count)
        .filter(
            PublicationModel.owner_id == user.id,
            PublicationModel.status == VerificationStatus.VERIFIED
        )
        .all()
    ]

    projects_count = (
        db.query(ResearchProjectModel)
        .filter(
            ResearchProjectModel.owner_id == user.id,
            ResearchProjectModel.status == VerificationStatus.VERIFIED
        )
        .count()
    )

    return {
        "user_id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "publications_count": len(citation_counts),
        "projects_count": projects_count,
        "total_citations": sum(citation_counts),
        "h_index": compute_h_index(citation_counts),
    }


def get_all_professor_metrics(db: Session) -> list[dict]:
    """Metrics for every active professor, used by the ranking/dashboard views."""
    from app.models.user import UserRole

    professors = (
        db.query(UserModel)
        .filter(UserModel.role == UserRole.PROFESSOR, UserModel.is_active.is_(True))
        .all()
    )
    return [get_professor_metrics(db, professor) for professor in professors]


def get_school_summary(db: Session) -> dict:
    """Headline totals for the ECMC as a whole (verified + public records only)."""
    publication_query = db.query(PublicationModel).filter(
        PublicationModel.status == VerificationStatus.VERIFIED,
        PublicationModel.is_public.is_(True)
    )
    project_query = db.query(ResearchProjectModel).filter(
        ResearchProjectModel.status == VerificationStatus.VERIFIED,
        ResearchProjectModel.is_public.is_(True)
    )

    total_citations = (
        db.query(func.coalesce(func.sum(PublicationModel.citation_count), 0))
        .filter(
            PublicationModel.status == VerificationStatus.VERIFIED,
            PublicationModel.is_public.is_(True)
        )
        .scalar()
    )

    by_type = (
        publication_query
        .with_entities(PublicationModel.publication_type, func.count(PublicationModel.id))
        .group_by(PublicationModel.publication_type)
        .all()
    )

    from app.models.user import UserRole

    return {
        "active_professors": (
            db.query(UserModel)
            .filter(UserModel.role == UserRole.PROFESSOR, UserModel.is_active.is_(True))
            .count()
        ),
        "total_publications": publication_query.count(),
        "total_projects": project_query.count(),
        "total_citations": int(total_citations or 0),
        "publications_by_type": {
            publication_type.value: count for publication_type, count in by_type
        },
    }


def get_publication_timeline(db: Session) -> list[dict]:
    """
    Temporal evolution of the school's production (charter objective:
    "evolución temporal de la producción total de la Escuela"), one row per
    calendar year with a known publication year.
    """
    rows = (
        db.query(PublicationModel.year, func.count(PublicationModel.id))
        .filter(
            PublicationModel.status == VerificationStatus.VERIFIED,
            PublicationModel.is_public.is_(True),
            PublicationModel.year.isnot(None)
        )
        .group_by(PublicationModel.year)
        .order_by(PublicationModel.year.asc())
        .all()
    )
    return [{"year": year, "publications_count": count} for year, count in rows]
