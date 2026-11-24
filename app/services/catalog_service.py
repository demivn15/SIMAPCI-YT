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

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.product import Product
from app.services.product_identity_service import PUBLIC_STATUS

# Un solo lugar define qué entra al catálogo. Se reutiliza el estado público de HU07/HU05
# (PUBLIC_STATUS) en vez de escribir «verificado» otra vez: si la regla cambia, cambia una vez.
CATALOG_STATUS = PUBLIC_STATUS


def count_catalog(db: Session) -> int:
    """Cuántos productos hay en el catálogo consolidado."""
    return db.scalar(
        select(func.count()).select_from(Product).where(Product.status == CATALOG_STATUS)
    ) or 0


def list_catalog(db: Session, limit: int = 20, offset: int = 0) -> list[Product]:
    """Página del catálogo consolidado, de la producción más reciente a la más antigua.

    Se ordena por año y, dentro del mismo año, por fecha de registro: es el orden con el que
    se lee una producción científica. Se pagina porque el catálogo solo crece.
    """
    return list(
        db.scalars(
            select(Product)
            .where(Product.status == CATALOG_STATUS)
            .order_by(Product.year.desc(), Product.created_at.desc(), Product.id.desc())
            .limit(limit)
            .offset(offset)
        )
    )


def get_catalog_product(db: Session, product_id: str) -> Product | None:
    """Un producto del catálogo, o None si no existe o todavía no está verificado.

    El estado es parte de la búsqueda, no un filtro posterior: conocer el id de un producto
    pendiente o rechazado no alcanza para leerlo, que es lo que permite enlazar sin riesgo el
    `public_product_id` de la verificación previa de HU07 (regla RU-08).
    """
    return db.scalar(
        select(Product).where(Product.id == product_id, Product.status == CATALOG_STATUS)
    )
