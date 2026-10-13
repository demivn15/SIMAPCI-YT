"""
File: models/publication.py
Description: The "Publicación Científica" entity of the charter: a journal
             article, conference paper, book, etc. authored by an ECMC
             professor, optionally imported from ORCID and optionally
             validated/enriched against Crossref and OpenAlex via its DOI.
"""

import enum
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Float, Enum, ForeignKey
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import BaseModelClass
from app.models.common import ProductSource, VerificationStatus


class PublicationType(str, enum.Enum):
    """Kind of scientific product being registered."""

    JOURNAL_ARTICLE = "journal_article"
    CONFERENCE_PAPER = "conference_paper"
    BOOK = "book"
    BOOK_CHAPTER = "book_chapter"
    THESIS = "thesis"
    PATENT = "patent"
    DATASET = "dataset"
    TECHNICAL_REPORT = "technical_report"
    OTHER = "other"


class PublicationModel(BaseModelClass):
    """A scientific publication owned by exactly one professor (User 1-N)."""

    __tablename__ = "publication"

    id = Column(Integer, primary_key = True, index = True, autoincrement = True)

    title = Column(String(500), index = True, nullable = False)
    abstract = Column(Text, nullable = True)
    publication_type = Column(
        Enum(PublicationType), default = PublicationType.JOURNAL_ARTICLE, nullable = False
    )
    venue = Column(String(255), nullable = True)
    year = Column(Integer, index = True, nullable = True)
    authors = Column(
        String(1000),
        nullable = True,
        doc = "Free-text author list, as reported by the source (ORCID/Crossref) or typed by hand."
    )

    # --- External identifiers / enrichment -------------------------------
    doi = Column(String(120), unique = True, index = True, nullable = True)
    # ORCID's internal identifier for one "work" entry in a member's record,
    # kept so a re-sync can update instead of duplicating the same work.
    orcid_put_code = Column(String(50), nullable = True)
    # Best-effort citation count, refreshed from OpenAlex. Feeds the
    # dashboard's citation and h-index metrics.
    citation_count = Column(Integer, default = 0, nullable = False)
    citation_count_updated_at = Column(DateTime, nullable = True)

    # --- Provenance and review workflow -----------------------------------
    source = Column(Enum(ProductSource), default = ProductSource.MANUAL, nullable = False)
    status = Column(
        Enum(VerificationStatus), default = VerificationStatus.UPLOADED,
        index = True, nullable = False
    )
    rejection_reason = Column(String(500), nullable = True)
    reviewed_by_id = Column(Integer, ForeignKey("user.id", ondelete = "SET NULL"), nullable = True)
    reviewed_at = Column(DateTime, nullable = True)

    # Only publications the owner chose to share AND that passed review are
    # exposed through the public catalogue / dashboard.
    is_public = Column(Boolean, default = True, nullable = False)

    owner_id = Column(Integer, ForeignKey("user.id", ondelete = "CASCADE"), index = True, nullable = False)

    # Optional link to the research project that produced this publication.
    project_id = Column(
        Integer, ForeignKey("research_project.id", ondelete = "SET NULL"), nullable = True
    )

    created_at = Column(DateTime, server_default = func.now(), nullable = False)
    updated_at = Column(DateTime, server_default = func.now(), onupdate = func.now(), nullable = False)

    owner = relationship("UserModel", back_populates = "publications", foreign_keys = [owner_id])
    reviewed_by = relationship("UserModel", foreign_keys = [reviewed_by_id])
    project = relationship("ResearchProjectModel", back_populates = "publications")

    @property
    def is_visible_publicly(self) -> bool:
        """A record only ever appears in the public catalogue once verified."""
        return self.is_public and self.status == VerificationStatus.VERIFIED
