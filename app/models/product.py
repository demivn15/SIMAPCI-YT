"""
File: product.py
Description: SQLAlchemy model for scientific products (publications or projects) 
supporting manual submission, ORCID imports, and council review tracking (T-HU03-05, T-HU12-02, T-HU12-03).
"""

import uuid
from datetime import datetime

from app.db.base import Base
from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("type IN ('publicacion', 'proyecto')", name="valid_type"),
        CheckConstraint("status IN ('cargado', 'verificado', 'rechazado')", name="valid_status"),
        CheckConstraint("source IN ('manual', 'orcid')", name="valid_source"),
        # Evita importar exactamente el mismo registro externo de ORCID dos veces para el mismo profesor (CA37)
        UniqueConstraint("owner_id", "source", "external_id", name="uq_owner_source_external_id"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    school: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    type: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    authors: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    research_line: Mapped[str] = mapped_column(String(255), nullable=False)
    abstract: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Publications only fields
    # Único (los NULL no cuentan): un mismo DOI no puede registrarse dos veces (409)
    doi: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True, index=True)
    venue: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Projects only fields
    project_code: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)
    project_status: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Estado del flujo de consolidación (CA34, CA35, CA36)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="cargado", server_default="cargado")

    # Trazabilidad de origen: 'manual' (enviado por profesor) o 'orcid' (importación automática)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="manual", server_default="manual", index=True)
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    # Auditoría de decisiones del consejo de revisión (CA36, CA38)
    reviewed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    review_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
