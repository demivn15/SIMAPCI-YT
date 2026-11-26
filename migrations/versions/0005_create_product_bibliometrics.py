"""create product_bibliometrics table

HU09 y HU10 (dashboard de métricas): indicadores bibliométricos de cada producto, 1 a 1 con
`products` (citas, cuartil SJR, índice h de la revista, acceso abierto, afiliación y
colaboración). Ver app/models/product_bibliometrics.py.

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, Sequence[str], None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "product_bibliometrics",
        sa.Column("product_id", sa.String(length=36), nullable=False),
        sa.Column("citations", sa.Integer(), nullable=True),
        sa.Column("citations_openalex", sa.Integer(), nullable=True),
        sa.Column("citations_crossref", sa.Integer(), nullable=True),
        sa.Column("fwci", sa.Float(), nullable=True),
        sa.Column("sjr_quartile", sa.String(length=2), nullable=True),
        sa.Column("sjr_score", sa.Float(), nullable=True),
        sa.Column("scimago_h_index", sa.Integer(), nullable=True),
        sa.Column("is_open_access", sa.Boolean(), nullable=True),
        sa.Column("yachay_affiliation", sa.String(length=20), nullable=True),
        sa.Column("collaboration_type", sa.String(length=20), nullable=True),
        sa.Column("institutions", sa.JSON(), nullable=True),
        sa.Column("countries", sa.JSON(), nullable=True),
        sa.Column("data_source", sa.String(length=255), nullable=True),
        sa.Column("retrieved_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("citations IS NULL OR citations >= 0", name=op.f("ck_product_bibliometrics_citations_non_negative")),
        sa.CheckConstraint(
            "sjr_quartile IS NULL OR sjr_quartile IN ('Q1', 'Q2', 'Q3', 'Q4')",
            name=op.f("ck_product_bibliometrics_valid_quartile"),
        ),
        sa.CheckConstraint(
            "yachay_affiliation IS NULL OR yachay_affiliation IN ('si', 'no', 'no_verificable')",
            name=op.f("ck_product_bibliometrics_valid_affiliation"),
        ),
        sa.CheckConstraint(
            "collaboration_type IS NULL OR collaboration_type IN "
            "('institucional', 'nacional', 'internacional', 'no_verificable')",
            name=op.f("ck_product_bibliometrics_valid_collaboration"),
        ),
        sa.ForeignKeyConstraint(
            ["product_id"], ["products.id"], name=op.f("fk_product_bibliometrics_product_id_products"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("product_id", name=op.f("pk_product_bibliometrics")),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index(op.f("ix_product_bibliometrics_sjr_quartile"), "product_bibliometrics", ["sjr_quartile"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_product_bibliometrics_sjr_quartile"), table_name="product_bibliometrics")
    op.drop_table("product_bibliometrics")
