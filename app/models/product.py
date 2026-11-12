"""
File: product.py
Description: SQLAlchemy model for scientific products (publications or projects) (T-HU03-05, PGPCECMC-36).
"""

import uuid
from datetime import datetime

from app.db.base import Base
from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("type IN ('publicacion', 'proyecto')", name="valid_type"),
        CheckConstraint("status IN ('cargado', 'verificado', 'rechazado')", name="valid_status"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    school: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    type: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    authors: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    year: Mapped[Integer] = mapped_column(Integer, nullable=False)
    research_line: Mapped[str] = mapped_column(String(255), nullable=False)
    abstract: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Publications only fields
    doi: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    venue: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Projects only fields
    project_code: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    project_status: Mapped[str | None] = mapped_column(String(20), nullable=True)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="cargado", server_default="cargado")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
