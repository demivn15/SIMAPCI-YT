"""
Pruebas de la verificación de existencia previa al guardado - T-HU07-02 (PGPCECMC-60).
Criterios CA19, CA20, CA21 (HU07) y CA37 (HU12).

Las reglas RU-xx son las del documento "Reglas y definiciones del Sprint 2"
(T-HU07-01, PGPCECMC-59), pendientes de validar con el cliente.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.product import Product
from app.models.user import User
from app.schemas.product import OrcidItemImport
from app.services.ldap_service import LDAPService
from app.services.product_identity_service import find_existing_product
from app.services.product_service import ProductService
from app.utils.identifiers import normalize_doi, normalize_project_code

PRODUCTS_URL = "/api/v1/products"
EXISTS_URL = f"{PRODUCTS_URL}/exists"
DOI = "10.1145/3576915.3623102"

PUBLICACION = {
    "type": "publicacion",
    "title": "Secure Aggregation for Federated Learning",
    "authors": ["María García"],
    "year": 2023,
    "research_line": "Inteligencia artificial",
    "doi": DOI,
    "venue": "ACM CCS 2023",
}
PROYECTO = {
    "type": "proyecto",
    "title": "Modelos de optimización para redes",
    "authors": ["María García"],
    "year": 2024,
    "research_line": "Computación científica",
    "project_code": "ECMC-2024-01",
    "project_status": "activo",
}


def _login(monkeypatch, username="professor", email="professor@planetexpress.com") -> TestClient:
    """Inicia sesión simulando LDAP; cada cliente conserva su propia cookie."""
    monkeypatch.setattr(
        LDAPService,
        "authenticate_and_authorize_professor",
        classmethod(lambda cls, username, password: {
            "username": username, "full_name": username.title(), "email": f"{username}@planetexpress.com",
        }),
    )
    client = TestClient(app)
    assert client.post("/api/v1/auth/login", json={"username": username, "password": "x"}).status_code == 200
    return client


@pytest.fixture
def client(monkeypatch):
    return _login(monkeypatch)


# --------------------------------------------------------------- normalización (RU-02, RU-03)

@pytest.mark.parametrize("raw", [
    "https://www.doi.org/10.1145/3576915.3623102",
    "doi.org/10.1145/3576915.3623102",
    "https://doi.org/10.1145%2F3576915.3623102",
    "HTTPS://DX.DOI.ORG/10.1145/3576915.3623102",
])
def test_ru02_normalize_doi_new_variants(raw):
    assert normalize_doi(raw) == DOI


@pytest.mark.parametrize("raw", [
    " ecmc-2024-01 ",
    "ECMC 2024 01",
    "ECMC–2024–01",   # guion medio
    "ECMC_2024_01",
    "ECMC - 2024 -- 01",
])
def test_ru03_normalize_project_code_variants(raw):
    assert normalize_project_code(raw) == "ECMC-2024-01"


def test_normalization_is_idempotent():
    assert normalize_doi(normalize_doi(f"https://doi.org/{DOI.upper()}")) == DOI
    assert normalize_project_code(normalize_project_code("ecmc 2024 01")) == "ECMC-2024-01"


# --------------------------------------------------------------- registro (CA19, CA20)

def test_ru02_invalid_doi_is_rejected_on_create(client):
    response = client.post(PRODUCTS_URL, json={**PUBLICACION, "doi": "abc"})
    assert response.status_code == 422


@pytest.mark.parametrize("variant", [
    "https://www.doi.org/10.1145/3576915.3623102",
    "doi.org/10.1145/3576915.3623102",
    "https://doi.org/10.1145%2F3576915.3623102",
])
def test_ca20_doi_variants_are_duplicates(client, db_session, variant):
    assert client.post(PRODUCTS_URL, json=PUBLICACION).status_code == 201

    response = client.post(PRODUCTS_URL, json={**PUBLICACION, "doi": variant})

    assert response.status_code == 409
    assert db_session.query(Product).count() == 1


@pytest.mark.parametrize("variant", ["ECMC 2024 01", "ECMC–2024–01", "ecmc_2024_01"])
def test_ca20_project_code_variants_are_duplicates(client, db_session, variant):
    assert client.post(PRODUCTS_URL, json=PROYECTO).status_code == 201

    response = client.post(PRODUCTS_URL, json={**PROYECTO, "project_code": variant})

    assert response.status_code == 409
    assert db_session.query(Product).count() == 1


def test_project_code_is_stored_normalized(client, db_session):
    response = client.post(PRODUCTS_URL, json={**PROYECTO, "project_code": "ecmc 2024 01"})
    assert response.status_code == 201
    assert response.json()["project_code"] == "ECMC-2024-01"


# --------------------------------------------------------------- consulta previa (RU-07, RU-08)

def test_exists_requires_session():
    assert TestClient(app).get(EXISTS_URL, params={"doi": DOI}).status_code == 401


def test_ca21_without_identifier_is_not_verifiable(client):
    response = client.get(EXISTS_URL)

    assert response.status_code == 200
    assert response.json() == {
        "verifiable": False, "exists": False, "field": None,
        "normalized_identifier": None, "public_product_id": None,
    }


def test_exists_returns_false_for_new_doi(client):
    response = client.get(EXISTS_URL, params={"doi": f"https://doi.org/{DOI}"})

    assert response.status_code == 200
    body = response.json()
    assert body["verifiable"] is True
    assert body["exists"] is False
    assert body["normalized_identifier"] == DOI


def test_exists_rejects_invalid_doi(client):
    assert client.get(EXISTS_URL, params={"doi": "abc"}).status_code == 422


def test_ru08_pending_product_of_another_professor_is_not_revealed(monkeypatch, db_session):
    owner = _login(monkeypatch, username="fry")
    assert owner.post(PRODUCTS_URL, json=PUBLICACION).status_code == 201

    other = _login(monkeypatch, username="leela")
    body = other.get(EXISTS_URL, params={"doi": DOI.upper()}).json()

    assert body["exists"] is True
    assert body["field"] == "doi"
    assert body["public_product_id"] is None  # cargado: no es visible públicamente


def test_ru08_verified_product_is_linked(client, db_session):
    created = client.post(PRODUCTS_URL, json=PUBLICACION).json()
    product = db_session.get(Product, created["id"])
    product.status = "verificado"
    db_session.commit()

    body = client.get(EXISTS_URL, params={"doi": f"doi:{DOI}"}).json()

    assert body["exists"] is True
    assert body["public_product_id"] == created["id"]


def test_exists_by_project_code_variant(client):
    assert client.post(PRODUCTS_URL, json=PROYECTO).status_code == 201

    body = client.get(EXISTS_URL, params={"project_code": "ecmc 2024 01"}).json()

    assert body["exists"] is True
    assert body["field"] == "project_code"
    assert body["normalized_identifier"] == "ECMC-2024-01"


def test_ru09_rejected_product_keeps_its_identifier(client, db_session):
    created = client.post(PRODUCTS_URL, json=PUBLICACION).json()
    product = db_session.get(Product, created["id"])
    product.status = "rechazado"
    db_session.commit()

    assert client.get(EXISTS_URL, params={"doi": DOI}).json()["exists"] is True
    assert client.post(PRODUCTS_URL, json=PUBLICACION).status_code == 409


# --------------------------------------------------------------- servicio e importación ORCID (RU-10, CA37)

def test_service_without_identifiers_is_not_verifiable(db_session):
    result = find_existing_product(db_session)
    assert result.verifiable is False
    assert result.exists is False


def test_ru10_orcid_import_skips_doi_already_registered_in_another_format(client, db_session):
    assert client.post(PRODUCTS_URL, json=PUBLICACION).status_code == 201
    owner = db_session.query(User).one()

    item = OrcidItemImport(
        external_id="put-code-1", title="Same work from ORCID", authors=["María García"],
        year=2023, doi=f"https://www.doi.org/{DOI.upper()}",
    )
    imported = ProductService.import_orcid_products(db_session, owner.id, [item])

    assert imported == []
    assert db_session.query(Product).count() == 1


def test_ru02_orcid_item_with_invalid_doi_is_rejected():
    with pytest.raises(ValueError):
        OrcidItemImport(external_id="put-code-2", title="t", authors=["a"], year=2023, doi="not-a-doi")
