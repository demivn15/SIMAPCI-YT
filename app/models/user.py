"""
File: models/user.py
Description: Definition of the user entity. Per the RED PAPERS charter the
             account holders are ECMC professors (role PROFESSOR) plus a
             small review committee / administration (role ADMIN) that
             verifies manually submitted products.
"""

import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import BaseModelClass


class UserRole(str, enum.Enum):
    """Who the account belongs to, per the charter's stakeholder list."""

    PROFESSOR = "professor"
    ADMIN = "admin"


class UserModel(BaseModelClass):
    """An ECMC professor (or a review-committee administrator)."""

    __tablename__ = "user"

    id = Column(
        Integer,
        primary_key = True,
        index = True,
        autoincrement = True
    )
    username = Column(
        String(50),
        unique = True,
        index = True,
        nullable = False
    )
    full_name = Column(
        String(150),
        nullable = False
    )
    email = Column(
        String(255),
        unique = True,
        index = True,
        nullable = False
    )
    # NULL for accounts created exclusively through ORCID: those professors
    # never give us a password, so there is nothing to hash.
    hashed_password = Column(
        String(255),
        nullable = True
    )
    role = Column(
        Enum(UserRole),
        default = UserRole.PROFESSOR,
        nullable = False
    )
    is_active = Column(
        Boolean,
        default = True,
        nullable = False
    )

    # --- Academic identity (ORCID) ---------------------------------------
    # The ORCID iD, e.g. "0000-0002-1825-0097". This is what lets the system
    # auto-import a professor's publication record and is also usable as a
    # sign-in method (OAuth 2.0 / OpenID Connect through ORCID).
    orcid_id = Column(
        String(19),
        unique = True,
        index = True,
        nullable = True
    )
    # Stored so the API can call the ORCID member API on the professor's
    # behalf (e.g. to re-sync works) without asking them to sign in again.
    # The public API does not require it, so this is best-effort.
    orcid_access_token = Column(
        String(2048),
        nullable = True
    )

    affiliation = Column(
        String(150),
        nullable = True,
        default = "Escuela de Ciencias Matemáticas y Computacionales"
    )
    department = Column(
        String(150),
        nullable = True
    )
    created_at = Column(
        DateTime,
        server_default = func.now(),
        nullable = False
    )
    last_login_at = Column(
        DateTime,
        nullable = True
    )

    # Publications and projects each have two foreign keys to this table
    # (owner_id and reviewed_by_id), so the ownership relationship must say
    # explicitly which column it follows.
    publications = relationship(
        "PublicationModel",
        back_populates = "owner",
        foreign_keys = "PublicationModel.owner_id",
        cascade = "all, delete-orphan"
    )
    projects = relationship(
        "ResearchProjectModel",
        back_populates = "owner",
        foreign_keys = "ResearchProjectModel.owner_id",
        cascade = "all, delete-orphan"
    )
    refresh_tokens = relationship(
        "RefreshTokenModel",
        back_populates = "user",
        cascade = "all, delete-orphan"
    )
    notifications = relationship(
        "NotificationModel",
        back_populates = "user",
        cascade = "all, delete-orphan"
    )
