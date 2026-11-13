"""
Pruebas de persistencia de productos (T-HU03-05, PGPCECMC-36): POST /api/v1/products
guarda el producto en la base de datos, a nombre del profesor, y evita duplicados.
"""

from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session

from app.main import app
from app.models.product import Product
from app.models.user import User
from app.services.ldap_service import LDAPService

URL = "/api/v1/products"
PROJECT_ROOT = Path(__file__).resolve().parents[2]

PUBLICACION = {
    "type": "publicacion",
    "title": "Secure Aggregation for Federated Learning",
    "authors": ["María García", "Juan Pérez"],
    "year": 2023,
    "research_line": "Inteligencia artificial",
    "doi": "10.1145/3576915.3623102",
    "venue": "ACM CCS 2023",
}
PROYECTO = {
    "type": "proyecto",
    "title": "Modelos de optimización para redes",
    "authors": ["María García"],
    "year": 2024,
    "research_line": "Computación científica",
    "project_code": "ecmc-2024-01",
    "project_status": "activo",
}


def _login(monkeypatch, username="professor", email="professor@planetexpress.com") -> TestClient:
    monkeypatch.setattr(
        LDAPService,
        "authenticate_and_authorize_professor",
        classmethod(lambda cls, username, password: {
            "username": username, "full_name": "Hubert Farnsworth", "email": email,
        }),
    )
    client = TestClient(app)
    assert client.post("/api/v1/auth/login", json={"username": username, "password": "x"}).status_code == 200
    return client


@pytest.fixture
def client(monkeypatch):
    return _login(monkeypatch)


def test_publication_is_persisted_for_the_authenticated_professor(client, db_session):
    response = client.post(URL, json=PUBLICACION)

    assert response.status_code == 201
    body = response.json()
    owner = db_session.query(User).filter_by(username="professor").one()
    assert body["status"] == "cargado" and body["owner_id"] == owner.id and body["school"] == "ECMC"

    saved = db_session.get(Product, body["id"])
    assert saved.title == PUBLICACION["title"]
    assert saved.authors == PUBLICACION["authors"]
    assert saved.owner_id == owner.id and saved.status == "cargado"
    assert db_session.query(Product).count() == 1


def test_product_survives_a_new_session(client, db_session):
    """«Persistente»: se lee de nuevo desde la BD con una sesión distinta, no desde memoria."""
    product_id = client.post(URL, json=PUBLICACION).json()["id"]

    # Sesión nueva sobre el mismo motor: lee lo que quedó guardado, no el objeto en memoria
    with Session(db_session.get_bind()) as other_session:
        assert other_session.get(Product, product_id).doi == PUBLICACION["doi"]


def test_project_is_persisted_with_uppercase_code(client, db_session):
    response = client.post(URL, json=PROYECTO)

    assert response.status_code == 201
    assert response.json()["project_code"] == "ECMC-2024-01"
    assert db_session.query(Product).filter_by(type="proyecto").count() == 1


def test_duplicate_doi_returns_409_even_with_other_formatting(client, db_session):
    assert client.post(URL, json=PUBLICACION).status_code == 201

    same_doi = {**PUBLICACION, "doi": "https://doi.org/" + PUBLICACION["doi"].upper()}
    assert client.post(URL, json=same_doi).status_code == 409
    assert db_session.query(Product).count() == 1


def test_duplicate_project_code_returns_409(client, db_session):
    assert client.post(URL, json=PROYECTO).status_code == 201
    assert client.post(URL, json={**PROYECTO, "project_code": "ECMC-2024-01"}).status_code == 409
    assert db_session.query(Product).count() == 1


def test_invalid_product_returns_422_and_saves_nothing(client, db_session):
    assert client.post(URL, json={**PUBLICACION, "research_line": "Inventada"}).status_code == 422
    assert client.post(URL, json={**PUBLICACION, "authors": []}).status_code == 422
    assert client.post(URL, json={**PROYECTO, "project_code": None}).status_code == 422
    assert db_session.query(Product).count() == 0


def test_without_session_returns_401_and_saves_nothing(db_session):
    assert TestClient(app).post(URL, json=PUBLICACION).status_code == 401
    assert db_session.query(Product).count() == 0


def test_inactive_account_cannot_register_products(client, db_session):
    user = db_session.query(User).filter_by(username="professor").one()
    user.is_active = False
    db_session.commit()

    assert client.post(URL, json=PUBLICACION).status_code == 403
    assert db_session.query(Product).count() == 0


def test_migration_0002_creates_the_products_table(tmp_path, monkeypatch):
    """`alembic upgrade head` (lo que se corre en MySQL) crea la tabla con lo que el modelo necesita."""
    db_url = f"sqlite:///{(tmp_path / 'migrated.db').as_posix()}"
    config = Config(str(PROJECT_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(PROJECT_ROOT / "migrations"))
    config.set_main_option("sqlalchemy.url", db_url)

    command.upgrade(config, "head")

    inspector = inspect(create_engine(db_url))
    assert "products" in inspector.get_table_names()
    assert {c["name"] for c in inspector.get_columns("products")} == {c.name for c in Product.__table__.columns}
    unique_indexes = {i["name"] for i in inspector.get_indexes("products") if i["unique"]}
    assert {"ix_products_doi", "ix_products_project_code"} <= unique_indexes

    command.downgrade(config, "0001")
    assert "products" not in inspect(create_engine(db_url)).get_table_names()
