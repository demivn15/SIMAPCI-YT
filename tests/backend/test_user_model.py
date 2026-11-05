"""
Pruebas de T-HU01-04 (PGPCECMC-21): persistencia del usuario en el modelo de datos.

Usan SQLite para que corran en el CI sin un servidor MySQL. La migración se
probó además manualmente contra MySQL 8 (ver descripción del PR).
"""

import os

# env.py de Alembic importa la configuración de la app, que exige estas variables.
for key, value in {
    "SECRET_KEY": "test-secret-key-for-ci-only-0123456789",
    "ALGORITHM": "HS256",
    "ACCESS_TOKEN_EXPIRE_MINUTES": "60",
    "LDAP_SERVER_URI": "ldap://localhost:10389",
    "LDAP_BIND_DN": "cn=admin,dc=planetexpress,dc=com",
    "LDAP_BIND_PASSWORD": "GoodNewsEveryone",
    "LDAP_USER_BASE_DN": "ou=people,dc=planetexpress,dc=com",
    "LDAP_GROUP_BASE_DN": "ou=people,dc=planetexpress,dc=com",
    "LDAP_PROFESSOR_GROUP_CN": "admin_staff",
}.items():
    os.environ.setdefault(key, value)

from pathlib import Path  # noqa: E402

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from sqlalchemy import create_engine, inspect  # noqa: E402
from sqlalchemy.exc import IntegrityError  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.models.user import User  # noqa: E402

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _make_user(**overrides) -> User:
    data = {
        "username": "jperez",
        "email": "jperez@yachaytech.edu.ec",
        "full_name": "Juan Pérez",
    }
    data.update(overrides)
    return User(**data)


@pytest.fixture
def db():
    """Base SQLite en memoria creada desde los modelos, limpia en cada prueba."""
    engine = create_engine("sqlite:///:memory:")

    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


# --- CA01: el usuario se persiste con sus valores por defecto -----------------

def test_user_is_persisted_with_defaults(db):
    db.add(_make_user())
    db.commit()

    saved = db.query(User).one()
    assert len(saved.id) == 36  # UUID
    assert saved.role == "professor"
    assert saved.school == "ECMC"
    assert saved.is_active is True
    assert saved.auth_provider == "ldap"
    assert saved.created_at is not None
    assert saved.orcid is None


def test_research_lines_roundtrip_as_json(db):
    lines = ["Inteligencia Artificial", "Matemática Aplicada"]
    db.add(_make_user(research_lines=lines))
    db.commit()

    assert db.query(User).one().research_lines == lines


def test_reviewer_role_is_accepted(db):
    db.add(_make_user(role="reviewer"))
    db.commit()
    assert db.query(User).one().role == "reviewer"


# --- CA02: control de duplicados a nivel de base de datos ---------------------

def test_email_and_username_are_normalized():
    user = _make_user(email="  JPerez@YachayTech.EDU.ec ", username=" JPerez ")
    assert user.email == "jperez@yachaytech.edu.ec"
    assert user.username == "jperez"


def test_duplicate_email_with_different_case_is_rejected(db):
    db.add(_make_user())
    db.commit()

    db.add(_make_user(username="otro", email="JPEREZ@yachaytech.edu.ec"))
    with pytest.raises(IntegrityError):
        db.commit()


def test_duplicate_username_is_rejected(db):
    db.add(_make_user())
    db.commit()

    db.add(_make_user(email="otro@yachaytech.edu.ec"))
    with pytest.raises(IntegrityError):
        db.commit()


def test_duplicate_orcid_is_rejected_but_many_nulls_are_allowed(db):
    db.add(_make_user(orcid="0000-0002-1825-0097"))
    db.add(_make_user(username="a", email="a@yachaytech.edu.ec"))  # ORCID NULL
    db.add(_make_user(username="b", email="b@yachaytech.edu.ec"))  # ORCID NULL
    db.commit()
    assert db.query(User).count() == 3

    db.add(_make_user(username="c", email="c@yachaytech.edu.ec", orcid="0000-0002-1825-0097"))
    with pytest.raises(IntegrityError):
        db.commit()


def test_invalid_role_is_rejected():
    with pytest.raises(ValueError):
        _make_user(role="admin")


# --- CA03: las credenciales no se persisten ----------------------------------

def test_users_table_has_no_password_column(db):
    columns = {col["name"] for col in inspect(db.get_bind()).get_columns("users")}
    assert not any("password" in name for name in columns)


# --- Migración de Alembic -----------------------------------------------------

def test_alembic_migration_upgrade_and_downgrade(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'migration.db'}"
    config = Config(str(PROJECT_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(PROJECT_ROOT / "migrations"))
    config.set_main_option("sqlalchemy.url", db_url)

    command.upgrade(config, "head")
    engine = create_engine(db_url)
    inspector = inspect(engine)
    assert "users" in inspector.get_table_names()
    unique_names = {uc["name"] for uc in inspector.get_unique_constraints("users")}
    assert {"uq_users_email", "uq_users_username", "uq_users_orcid"} <= unique_names

    command.downgrade(config, "base")
    assert "users" not in inspect(engine).get_table_names()
    engine.dispose()
