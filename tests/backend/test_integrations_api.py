"""
Pruebas de los endpoints /api/v1/integrations (PGPCECMC-33).
Los proveedores externos se reemplazan con dependency_overrides de FastAPI.
"""

from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient

from app.api.v1.integrations import get_doi_lookup_service, get_orcid_client
from app.core.security import create_access_token
from app.integrations.base import (
    DoiMetadata,
    ExternalNotFoundError,
    ExternalServiceUnavailableError,
    OrcidWork,
)
from app.main import app
from tests.backend.integration_fixtures import DOI, ORCID

METADATA = DoiMetadata(
    doi=DOI, title="Secure Aggregation", authors=["María García"], year=2023,
    venue="ACM CCS 2023", abstract="We propose...", source="crossref",
)


class FakeLookup:
    def __init__(self, result):
        self.result = result
        self.received = None

    def lookup(self, doi):
        self.received = doi
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


class FakeOrcid:
    def __init__(self, result):
        self.result = result

    def fetch_works(self, orcid):
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


@pytest.fixture
def client():
    test_client = TestClient(app)
    token = create_access_token({"sub": "professor", "user_id": "u1", "role": "professor"})
    test_client.cookies.set("access_token", token)
    yield test_client
    app.dependency_overrides.pop(get_doi_lookup_service, None)
    app.dependency_overrides.pop(get_orcid_client, None)


def use_lookup(result):
    fake = FakeLookup(result)
    app.dependency_overrides[get_doi_lookup_service] = lambda: fake
    return fake


def use_orcid(result):
    app.dependency_overrides[get_orcid_client] = lambda: FakeOrcid(result)


# --- DOI ---------------------------------------------------------------------

def test_doi_lookup_requires_session():
    use_lookup(METADATA)
    response = TestClient(app).get(f"/api/v1/integrations/doi/{DOI}")
    assert response.status_code == 401
    app.dependency_overrides.pop(get_doi_lookup_service, None)


def test_doi_lookup_returns_metadata_in_frontend_contract(client):
    use_lookup(METADATA)
    response = client.get(f"/api/v1/integrations/doi/{DOI}")

    assert response.status_code == 200
    assert response.json() == {
        "doi": DOI, "title": "Secure Aggregation", "authors": ["María García"], "year": 2023,
        "venue": "ACM CCS 2023", "abstract": "We propose...", "source": "crossref",
    }


def test_doi_encoded_like_the_frontend_and_with_prefix_is_normalized(client):
    # El frontend usa encodeURIComponent: la "/" llega como %2F
    fake = use_lookup(METADATA)
    response = client.get("/api/v1/integrations/doi/" + quote("https://doi.org/10.1145/3576915.3623102", safe=""))

    assert response.status_code == 200
    assert fake.received == DOI


def test_invalid_doi_returns_400_without_calling_providers(client):
    fake = use_lookup(METADATA)
    response = client.get("/api/v1/integrations/doi/no-es-un-doi")

    assert response.status_code == 400
    assert fake.received is None


def test_unknown_doi_returns_404(client):
    use_lookup(ExternalNotFoundError("x"))
    assert client.get(f"/api/v1/integrations/doi/{DOI}").status_code == 404


def test_providers_down_returns_503(client):
    use_lookup(ExternalServiceUnavailableError("x"))
    response = client.get(f"/api/v1/integrations/doi/{DOI}")
    assert response.status_code == 503
    assert "no están disponibles" in response.json()["detail"]


# --- ORCID ---------------------------------------------------------------------

def test_orcid_works_are_listed(client):
    use_orcid([OrcidWork(put_code="222", title="Secure Aggregation", year=2023, doi=DOI, venue=None, work_type="conference-paper")])
    response = client.get(f"/api/v1/integrations/orcid/{ORCID}/works")

    assert response.status_code == 200
    assert response.json()[0]["doi"] == DOI


def test_orcid_with_wrong_check_digit_returns_400(client):
    use_orcid([])
    assert client.get("/api/v1/integrations/orcid/0000-0002-1825-0098/works").status_code == 400


@pytest.mark.parametrize("error,status_code", [
    (ExternalNotFoundError("x"), 404),
    (ExternalServiceUnavailableError("x"), 503),
])
def test_orcid_errors(client, error, status_code):
    use_orcid(error)
    assert client.get(f"/api/v1/integrations/orcid/{ORCID}/works").status_code == status_code
