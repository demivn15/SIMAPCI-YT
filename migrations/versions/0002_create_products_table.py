"""create products table

T-HU03-05 (PGPCECMC-36): persistir los productos científicos (publicaciones y
proyectos) registrados por los profesores. Cada producto pertenece a un usuario.
Ampliación HU12: trazabilidad de origen ORCID/manual y auditoría del consejo.

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
        # Estados y trazabilidad HU12
        sa.Column("status", sa.String(length=20), server_default="cargado", nullable=False),
        sa.Column("source", sa.String(length=20), server_default="manual", nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=True),
        sa.Column("reviewed_by", sa.String(length=36), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("review_reason", sa.Text(), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        # Restricciones
        sa.CheckConstraint("type IN ('publicacion', 'proyecto')", name=op.f("ck_products_valid_type")),
        sa.CheckConstraint("status IN ('cargado', 'verificado', 'rechazado')", name=op.f("ck_products_valid_status")),
        sa.CheckConstraint("source IN ('manual', 'orcid')", name=op.f("ck_products_valid_source")),
        sa.UniqueConstraint("owner_id", "source", "external_id", name=op.f("uq_products_owner_source_external_id")),
        # Claves foráneas
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], name=op.f("fk_products_owner_id_users")),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], name=op.f("fk_products_reviewed_by_users"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_products")),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index(op.f("ix_products_owner_id"), "products", ["owner_id"], unique=False)
    op.create_index(op.f("ix_products_school"), "products", ["school"], unique=False)
    op.create_index(op.f("ix_products_source"), "products", ["source"], unique=False)
    op.create_index(op.f("ix_products_external_id"), "products", ["external_id"], unique=False)
    # Únicos: no se repite un DOI ni un código de proyecto (los NULL no cuentan)
    op.create_index(op.f("ix_products_doi"), "products", ["doi"], unique=True)
    op.create_index(op.f("ix_products_project_code"), "products", ["project_code"], unique=True)


def downgrade() -> None:
    op.drop_table("products")
