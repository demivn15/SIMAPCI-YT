"""
File: user.py
Author: Jhony Alfonso Peñaherrera
Description: Modelo de datos del usuario (profesor o Revisor) - T-HU01-04 (PGPCECMC-21).

Decisión de diseño: la tabla NO tiene columna de contraseña. La autenticación se
delega al directorio institucional (LDAP), así que la contraseña nunca llega a
nuestra BD. Aquí solo se guarda el perfil que el sistema necesita para asociar
productos a un profesor y controlar permisos.
"""

import uuid
from datetime import datetime

from app.db.base import Base
from sqlalchemy import JSON, Boolean, CheckConstraint, DateTime, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column, validates

# Roles del sistema. El visitante no tiene cuenta, por eso no aparece aquí.
# "professor" coincide con el claim "role" que ya emite el JWT de /auth/login.
ROLE_PROFESSOR = "professor"
ROLE_REVIEWER = "reviewer"
VALID_ROLES = (ROLE_PROFESSOR, ROLE_REVIEWER)

AUTH_PROVIDER_LDAP = "ldap"
DEFAULT_SCHOOL = "ECMC"


def _new_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('professor', 'reviewer')",
            name="valid_role",
        ),
        CheckConstraint(
            "google_scholar_h_index IS NULL OR google_scholar_h_index >= 0",
            name="scholar_h_index_non_negative",
        ),
        CheckConstraint(
            "scopus_h_index IS NULL OR scopus_h_index >= 0",
            name="scopus_h_index_non_negative",
        ),
        # Opciones solo para MySQL; SQLite (pruebas) las ignora.
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    # UUID en texto: coincide con los ids string del frontend (ownerId) y no
    # revela cuántos usuarios hay, como sí lo haría un entero autoincremental.
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)

    # --- Identidad institucional (viene de LDAP) ---
    # username = uid de LDAP. Es la clave con la que se reconoce al usuario en
    # cada inicio de sesión; email también es único para el control de duplicados (CA02).
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    auth_provider: Mapped[str] = mapped_column(
        String(20), nullable=False, default=AUTH_PROVIDER_LDAP, server_default=AUTH_PROVIDER_LDAP
    )

    # --- Autorización ---
    # Se definen valores por defecto en Python (default) y en la BD (server_default):
    # así también aplican a filas insertadas por scripts, p. ej. la carga de revisores.
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, default=ROLE_PROFESSOR, server_default=ROLE_PROFESSOR
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("1"))

    # Escuela como texto y no como constante: el alcance actual es solo ECMC,
    # pero el modelo no debe asumir una única Escuela.
    school: Mapped[str] = mapped_column(
        String(20), nullable=False, default=DEFAULT_SCHOOL, server_default=DEFAULT_SCHOOL, index=True
    )

    # --- Identificadores académicos (opcionales, los completa el profesor) ---
    # ORCID con formato 0000-0000-0000-000X (19 caracteres). Único: dos cuentas no
    # pueden reclamar el mismo ORCID. MySQL permite varios NULL en un índice único.
    orcid: Mapped[str | None] = mapped_column(String(19), unique=True, nullable=True)
    google_scholar_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    scopus_author_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    web_of_science_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Índices h AUTODECLARADOS por el profesor. No confundir con el índice h de
    # una revista (scimago_h_index), que pertenece al modelo de productos.
    google_scholar_h_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scopus_h_index: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Lista de líneas de investigación; JSON porque es una lista corta que se lee
    # completa con el perfil y no se filtra por elemento.
    research_lines: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    # --- Auditoría ---
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    @validates("email", "username")
    def _normalize_identity(self, key: str, value: str) -> str:
        """Guarda correo y usuario en minúsculas y sin espacios.

        Así "Jperez@YachayTech.edu.ec" y "jperez@yachaytech.edu.ec" chocan con el
        índice único y no se crea una cuenta duplicada (CA02).
        """
        return value.strip().lower() if value is not None else value

    @validates("role")
    def _validate_role(self, key: str, value: str) -> str:
        if value not in VALID_ROLES:
            raise ValueError(f"Rol inválido: {value!r}. Valores permitidos: {VALID_ROLES}")
        return value

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username!r} role={self.role!r}>"
