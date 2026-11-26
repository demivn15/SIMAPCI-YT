"""
File: product_bibliometrics.py
Author: Jhony Alfonso Peñaherrera
Description: Indicadores bibliométricos de un producto (citas, cuartil SJR, colaboración),
obtenidos de fuentes externas (OpenAlex, Crossref, SCImago). Base de HU09 y HU10.

Decisión de diseño: tabla aparte, 1 a 1 con `products`, en lugar de columnas nuevas en
`products`. Separa lo que registra el profesor (el producto) de lo que se calcula con
servicios externos y cambia con el tiempo (las citas), y no altera el modelo de productos.

Reglas:
- Citas desconocidas = NULL. No se tratan como 0: un 0 afirma que nadie citó la obra.
- `scimago_h_index` es el índice h de la REVISTA, no el del profesor (ese se calcula).
"""

from datetime import datetime

from app.db.base import Base
from sqlalchemy import JSON, Boolean, CheckConstraint, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

QUARTILES = ("Q1", "Q2", "Q3", "Q4")
AFFILIATION_VALUES = ("si", "no", "no_verificable")
COLLABORATION_VALUES = ("institucional", "nacional", "internacional", "no_verificable")


class ProductBibliometrics(Base):
    __tablename__ = "product_bibliometrics"
    __table_args__ = (
        CheckConstraint("citations IS NULL OR citations >= 0", name="citations_non_negative"),
        CheckConstraint("sjr_quartile IS NULL OR sjr_quartile IN ('Q1', 'Q2', 'Q3', 'Q4')", name="valid_quartile"),
        CheckConstraint(
            "yachay_affiliation IS NULL OR yachay_affiliation IN ('si', 'no', 'no_verificable')",
            name="valid_affiliation",
        ),
        CheckConstraint(
            "collaboration_type IS NULL OR collaboration_type IN "
            "('institucional', 'nacional', 'internacional', 'no_verificable')",
            name="valid_collaboration",
        ),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    product_id: Mapped[str] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)

    # Citas: `citations` es el valor que usa el sistema; las otras dos guardan cada fuente.
    citations: Mapped[int | None] = mapped_column(Integer, nullable=True)
    citations_openalex: Mapped[int | None] = mapped_column(Integer, nullable=True)
    citations_crossref: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fwci: Mapped[float | None] = mapped_column(Float, nullable=True)

    # SCImago (revista o congreso)
    sjr_quartile: Mapped[str | None] = mapped_column(String(2), nullable=True, index=True)
    sjr_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    scimago_h_index: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Acceso abierto y colaboración
    is_open_access: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    yachay_affiliation: Mapped[str | None] = mapped_column(String(20), nullable=True)
    collaboration_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    institutions: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    countries: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    # Trazabilidad: de dónde salieron los datos y cuándo se consultaron
    data_source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    retrieved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )
