"""create users table

T-HU01-04 (PGPCECMC-21): persistir el usuario en el modelo de datos.
Tabla de perfiles de profesores y Revisores. No guarda contraseñas: la
autenticación se delega al directorio institucional (LDAP).

Revision ID: 0001
Revises:
Create Date: 2026-11-05
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        # Identidad institucional
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("auth_provider", sa.String(length=20), server_default="ldap", nullable=False),
        # Autorización
        sa.Column("role", sa.String(length=20), server_default="professor", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("1"), nullable=False),
        sa.Column("school", sa.String(length=20), server_default="ECMC", nullable=False),
        # Identificadores académicos (opcionales)
        sa.Column("orcid", sa.String(length=19), nullable=True),
        sa.Column("google_scholar_id", sa.String(length=64), nullable=True),
        sa.Column("scopus_author_id", sa.String(length=64), nullable=True),
        sa.Column("web_of_science_id", sa.String(length=64), nullable=True),
        sa.Column("google_scholar_h_index", sa.Integer(), nullable=True),
        sa.Column("scopus_h_index", sa.Integer(), nullable=True),
        sa.Column("research_lines", sa.JSON(), nullable=True),
        # Auditoría. sa.func.now() se traduce según el motor (NOW() en MySQL,
        # CURRENT_TIMESTAMP en SQLite); un texto fijo 'now()' rompería SQLite.
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("last_login_at", sa.DateTime(), nullable=True),
        # Restricciones
        sa.CheckConstraint("role IN ('professor', 'reviewer')", name=op.f("ck_users_valid_role")),
        sa.CheckConstraint(
            "google_scholar_h_index IS NULL OR google_scholar_h_index >= 0",
            name=op.f("ck_users_scholar_h_index_non_negative"),
        ),
        sa.CheckConstraint(
            "scopus_h_index IS NULL OR scopus_h_index >= 0",
            name=op.f("ck_users_scopus_h_index_non_negative"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("username", name=op.f("uq_users_username")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
        sa.UniqueConstraint("orcid", name=op.f("uq_users_orcid")),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index(op.f("ix_users_school"), "users", ["school"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_school"), table_name="users")
    op.drop_table("users")
