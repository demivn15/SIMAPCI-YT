"""create products table

T-HU03-05 (PGPCECMC-36): persistir los productos científicos (publicaciones y
proyectos) registrados por los profesores. Cada producto pertenece a un usuario.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-13
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, Sequence[str], None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "products",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("owner_id", sa.String(length=36), nullable=False),
        sa.Column("school", sa.String(length=20), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("authors", sa.JSON(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("research_line", sa.String(length=255), nullable=False),
        sa.Column("abstract", sa.Text(), nullable=True),
        # Solo publicaciones
        sa.Column("doi", sa.String(length=255), nullable=True),
        sa.Column("venue", sa.String(length=500), nullable=True),
        # Solo proyectos
        sa.Column("project_code", sa.String(length=64), nullable=True),
        sa.Column("project_status", sa.String(length=20), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="cargado", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("type IN ('publicacion', 'proyecto')", name=op.f("ck_products_valid_type")),
        sa.CheckConstraint(
            "status IN ('cargado', 'verificado', 'rechazado')", name=op.f("ck_products_valid_status")
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], name=op.f("fk_products_owner_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_products")),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index(op.f("ix_products_owner_id"), "products", ["owner_id"], unique=False)
    op.create_index(op.f("ix_products_school"), "products", ["school"], unique=False)
    # Únicos: no se repite un DOI ni un código de proyecto (los NULL no cuentan)
    op.create_index(op.f("ix_products_doi"), "products", ["doi"], unique=True)
    op.create_index(op.f("ix_products_project_code"), "products", ["project_code"], unique=True)


def downgrade() -> None:
    # Solo drop_table: borra también sus índices. Quitar antes ix_products_owner_id
    # falla en MySQL porque la clave foránea a users lo necesita.
    op.drop_table("products")
