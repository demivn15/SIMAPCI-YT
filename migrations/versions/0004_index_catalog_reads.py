"""index consolidated catalogue reads

T-HU05-04 (PGPCECMC-50): optimizar las consultas de lectura del catálogo consolidado (CA15).
La vista pública de HU05 pide el catálogo paginado y ordenado de la producción más reciente a
la más antigua (catalog_service.list_catalog/count_catalog): filtra por `status = 'verificado'`
y ordena por (year, created_at, id) descendente. Este índice compuesto cubre ese filtro y ese
orden, para que la página pedida se resuelva sin recorrer ni ordenar la tabla entera y se cumpla
el tiempo de RNF02 a medida que el catálogo crece (RNF05).

Las pruebas usan SQLite con Base.metadata.create_all, así que el índice ya se declara en el
modelo (app/models/product.py); esta migración lo crea en la BD real (MySQL) para mantener la
paridad entre los dos motores.

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-26
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0004"
down_revision: Union[str, Sequence[str], None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_products_catalog",
        "products",
        ["status", "year", "created_at", "id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_products_catalog", table_name="products")
