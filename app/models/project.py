"""
File: models/project.py
Description: The "Proyecto de Investigación" entity of the charter. Scope
             note: per the charter's exclusions, this system never manages
             budgets, disbursements or funding administration -- only the
             descriptive, citable record of the project.
"""

import enum
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Date, DateTime, Enum, ForeignKey
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import BaseModelClass
from app.models.common import ProductSource, VerificationStatus


class ProjectStatus(str, enum.Enum):
    """Lifecycle of the research project itself (not the review workflow)."""

    PLANNED = "planned"
    ONGOING = "ongoing"
    FINISHED = "finished"
    SUSPENDED = "suspended"


class ResearchProjectModel(BaseModelClass):
    """A research project owned by exactly one professor (User 1-N)."""

    __tablename__ = "research_project"

    id = Column(Integer, primary_key = True, index = True, autoincrement = True)

    title = Column(String(500), index = True, nullable = False)
    description = Column(Text, nullable = True)
    project_status = Column(Enum(ProjectStatus), default = ProjectStatus.ONGOING, nullable = False)

    # Institutional identifier (e.g. an internal ECMC/Yachay Tech project
    # code). The charter asks it to be used for existence validation when no
    # DOI applies, so it is kept unique.
    project_code = Column(String(100), unique = True, index = True, nullable = True)

    start_date = Column(Date, nullable = True)
    end_date = Column(Date, nullable = True)

    # --- Provenance and review workflow (shared with publications) --------
    source = Column(Enum(ProductSource), default = ProductSource.MANUAL, nullable = False)
    status = Column(
        Enum(VerificationStatus), default = VerificationStatus.UPLOADED,
        index = True, nullable = False
    )
    rejection_reason = Column(String(500), nullable = True)
    reviewed_by_id = Column(Integer, ForeignKey("user.id", ondelete = "SET NULL"), nullable = True)
    reviewed_at = Column(DateTime, nullable = True)

    is_public = Column(Boolean, default = True, nullable = False)

    owner_id = Column(Integer, ForeignKey("user.id", ondelete = "CASCADE"), index = True, nullable = False)

    created_at = Column(DateTime, server_default = func.now(), nullable = False)
    updated_at = Column(DateTime, server_default = func.now(), onupdate = func.now(), nullable = False)

    owner = relationship("UserModel", back_populates = "projects", foreign_keys = [owner_id])
    reviewed_by = relationship("UserModel", foreign_keys = [reviewed_by_id])
    publications = relationship("PublicationModel", back_populates = "project")

    @property
    def is_visible_publicly(self) -> bool:
        """A record only ever appears in the public catalogue once verified."""
        return self.is_public and self.status == VerificationStatus.VERIFIED
