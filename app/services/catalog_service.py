"""
File: catalog_service.py
Description: Consulta del catálogo consolidado - T-HU12-04 (PGPCECMC-97). Criterios CA34 y CA36.

«Catálogo consolidado» = los productos en estado «verificado», vengan de donde vengan
(T-HU12-01, regla RV-01 de HU05): una publicación manual que el Comité Revisor aprobó
(CA36) y una obra importada de ORCID, que nace verificada sin pasar por revisión (CA34).
Las pendientes y las rechazadas se conservan para seguimiento, pero fuera del catálogo.

Esta es la OTRA mitad de la aprobación: hasta ahora la decisión del Comité solo cambiaba
una columna y avisaba al autor que su producto quedaba «incorporado al catálogo
consolidado», pero no existía ninguna consulta capaz de mostrarlo. Aquí vive esa consulta,
en un único punto, para que la definición de «catálogo» no se repita en cada pantalla que
lo necesite (la vista pública de HU05 y sus filtros de HU06 se construyen sobre esto).
"""

from dataclasses import dataclass
from unicodedata import category, normalize

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.models.product import Product
from app.models.user import User
from app.services.product_identity_service import PUBLIC_STATUS

# Un solo lugar define qué entra al catálogo. Se reutiliza el estado público de HU07/HU05
# (PUBLIC_STATUS) en vez de escribir «verificado» otra vez: si la regla cambia, cambia una vez.
CATALOG_STATUS = PUBLIC_STATUS


@dataclass(frozen=True)
class CatalogCriteria:
    """Filtros opcionales para la consulta pública del catálogo."""

    q: str | None = None
    product_type: str | None = None
    owner_id: str | None = None
    year_from: int | None = None
    year_to: int | None = None
    research_line: str | None = None


_ACCENT_REPLACEMENTS = (
    ("á", "a"),
    ("à", "a"),
    ("ä", "a"),
    ("â", "a"),
    ("ã", "a"),
    ("å", "a"),
    ("é", "e"),
    ("è", "e"),
    ("ë", "e"),
    ("ê", "e"),
    ("í", "i"),
    ("ì", "i"),
    ("ï", "i"),
    ("î", "i"),
    ("ó", "o"),
    ("ò", "o"),
    ("ö", "o"),
    ("ô", "o"),
    ("õ", "o"),
    ("ú", "u"),
    ("ù", "u"),
    ("ü", "u"),
    ("û", "u"),
    ("ñ", "n"),
    ("ç", "c"),
)


def _normalize_text(value: str) -> str:
    return "".join(char for char in normalize("NFD", value.lower()) if category(char) != "Mn")


def _normalized_column(column):
    expression = func.lower(cast(column, String))
    for accented, unaccented in _ACCENT_REPLACEMENTS:
        expression = func.replace(expression, accented, unaccented)
        # JSON may store Unicode letters as escaped sequences (for example, on SQLite).
        expression = func.replace(expression, f"\\u{ord(accented):04x}", unaccented)
    return expression


def _catalog_conditions(filters: CatalogCriteria) -> list[ColumnElement[bool]]:
    conditions = [Product.status == CATALOG_STATUS]

    if filters.q:
        search = _normalize_text(filters.q.strip())
        searchable_columns = (
            Product.title,
            Product.authors,
            Product.doi,
            Product.venue,
            Product.project_code,
        )
        conditions.append(
            or_(
                *(
                    _normalized_column(column).contains(search, autoescape=True)
                    for column in searchable_columns
                )
            )
        )
    if filters.product_type:
        conditions.append(Product.type == filters.product_type)
    if filters.owner_id:
        conditions.append(Product.owner_id == filters.owner_id)
    if filters.year_from is not None:
        conditions.append(Product.year >= filters.year_from)
    if filters.year_to is not None:
        conditions.append(Product.year <= filters.year_to)
    if filters.research_line:
        conditions.append(Product.research_line == filters.research_line)

    return conditions


def count_catalog(db: Session, filters: CatalogCriteria | None = None) -> int:
    """Cuántos productos visibles coinciden con los filtros."""
    filters = filters or CatalogCriteria()
    return db.scalar(
        select(func.count()).select_from(Product).where(*_catalog_conditions(filters))
    ) or 0


def list_catalog(
    db: Session,
    limit: int = 20,
    offset: int = 0,
    filters: CatalogCriteria | None = None,
) -> list[Product]:
    """Página del catálogo consolidado, de la producción más reciente a la más antigua.

    Se ordena por año y, dentro del mismo año, por fecha de registro: es el orden con el que
    se lee una producción científica. Se pagina porque el catálogo solo crece.
    """
    filters = filters or CatalogCriteria()
    return list(
        db.scalars(
            select(Product)
            .where(*_catalog_conditions(filters))
            .order_by(Product.year.desc(), Product.created_at.desc(), Product.id.desc())
            .limit(limit)
            .offset(offset)
        )
    )


def list_catalog_professors(db: Session) -> list[dict[str, str]]:
    """Profesores responsables de al menos un producto publicado."""
    rows = db.execute(
        select(User.id, User.full_name)
        .join(Product, Product.owner_id == User.id)
        .where(Product.status == CATALOG_STATUS)
        .distinct()
        .order_by(User.full_name, User.id)
    )
    return [{"id": row.id, "full_name": row.full_name} for row in rows]


def get_catalog_product(db: Session, product_id: str) -> Product | None:
    """Un producto del catálogo, o None si no existe o todavía no está verificado.

    El estado es parte de la búsqueda, no un filtro posterior: conocer el id de un producto
    pendiente o rechazado no alcanza para leerlo, que es lo que permite enlazar sin riesgo el
    `public_product_id` de la verificación previa de HU07 (regla RU-08).
    """
    return db.scalar(
        select(Product).where(Product.id == product_id, Product.status == CATALOG_STATUS)
    )
