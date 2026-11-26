"""add users.department and product_bibliometrics.contribution_type

Filtros comunes del análisis de producción y de redes:
- `users.department`: departamento académico del profesor (Matemáticas, Computación,
  Desarrollo Humano…), para el filtro por departamento y el color de las redes.
- `product_bibliometrics.contribution_type`: tipo de obra según Crossref/OpenAlex
  (`journal-article`, `book-chapter`, `proceedings-article`…), para el filtro
  «tipo de contribución».

Ambas columnas son opcionales: un profesor real que inicia sesión por LDAP no trae
departamento, y una obra sin indicadores no tiene tipo conocido.

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, Sequence[str], None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("department", sa.String(length=80), nullable=True))
    op.create_index(op.f("ix_users_department"), "users", ["department"], unique=False)
    op.add_column("product_bibliometrics", sa.Column("contribution_type", sa.String(length=40), nullable=True))
    op.create_index(
        op.f("ix_product_bibliometrics_contribution_type"), "product_bibliometrics", ["contribution_type"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_product_bibliometrics_contribution_type"), table_name="product_bibliometrics")
    op.drop_column("product_bibliometrics", "contribution_type")
    op.drop_index(op.f("ix_users_department"), table_name="users")
    op.drop_column("users", "department")
