"""
File: tests/conftest.py
Description: Shared fixtures. The environment is prepared before importing the
             application so the test-suite runs on a throwaway SQLite file
             instead of the MySQL/PostgreSQL database of the real deployment.
"""

import json
import os
import pathlib
import tempfile

TEST_DB_PATH = pathlib.Path(tempfile.gettempdir()) / "red_papers_test.db"

# Environment variables win over the .env file in pydantic-settings, so these
# assignments isolate the suite even on a machine with a configured .env.
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["SECRET_KEY"] = "test-secret-key-used-only-by-the-test-suite"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "15"
os.environ["REFRESH_TOKEN_EXPIRE_DAYS"] = "7"
os.environ["REMEMBER_REFRESH_TOKEN_EXPIRE_DAYS"] = "30"
os.environ["ORCID_CLIENT_ID"] = ""
os.environ["ORCID_CLIENT_SECRET"] = ""
os.environ["ADMIN_BOOTSTRAP_EMAILS"] = "chair@yachaytech.edu.ec"

import pytest
from fastapi.testclient import TestClient

from app import models as _registered_models  # noqa: F401  (fills the metadata)
from app.database import BaseModelClass, db_engine
from app.main import app

DEFAULT_PASSWORD = "MySecurePassword123!"


@pytest.fixture(autouse = True)
def fresh_database():
    """Give every test an empty schema so tests never influence each other."""
    BaseModelClass.metadata.drop_all(bind = db_engine)
    BaseModelClass.metadata.create_all(bind = db_engine)
    yield
    BaseModelClass.metadata.drop_all(bind = db_engine)


@pytest.fixture
def client():
    """HTTP client wired directly onto the FastAPI application."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def register():
    """Factory that registers a professor and returns the created representation."""

    def _register(client: TestClient, **overrides) -> dict:
        payload = {
            "username": "jastudillo",
            "full_name": "Juan Pablo Astudillo León",
            "email": "jastudillo@yachaytech.edu.ec",
            "password": DEFAULT_PASSWORD,
        }
        payload.update(overrides)

        response = client.post("/auth/register", json = payload)
        assert response.status_code == 201, response.text
        return response.json()

    return _register


@pytest.fixture
def login():
    """Factory that signs a user in and returns the token pair."""

    def _login(client: TestClient, email: str = "jastudillo@yachaytech.edu.ec", **overrides) -> dict:
        payload = {"email": email, "password": DEFAULT_PASSWORD, "remember_me": False}
        payload.update(overrides)

        response = client.post("/auth/login", json = payload)
        assert response.status_code == 200, response.text
        return response.json()

    return _login


@pytest.fixture
def signed_in(register, login):
    """Register a professor, sign them in and return (user, tokens, auth headers)."""

    def _signed_in(client: TestClient, **overrides) -> tuple[dict, dict, dict]:
        user = register(client, **overrides)
        tokens = login(client, email = user["email"])
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        return user, tokens, headers

    return _signed_in


def _safe_response_body(response):
    """Return the parsed JSON body, or raw text when the response has none."""
    if not response.content:
        return None
    try:
        return response.json()
    except ValueError:
        return response.text


def log_test_step(
    *,
    step: str,
    method: str,
    endpoint: str,
    response,
    expected_status: int,
    success_message: str,
    payload: dict | list | None = None,
) -> None:
    """
    Print a full, human-readable trace of one HTTP interaction and then assert
    on it -- replacing a silent `assert response.status_code == 200` with a
    report-grade block showing the endpoint, the request payload, the
    expected vs. received status code and the complete JSON response body.

    Used across the core-requirement tests (JWT auth, DOI/ORCID product
    registration, metrics) so `pytest -v -s` produces a readable technical
    test report instead of a bare list of dots.
    """
    body = _safe_response_body(response)

    print("\n" + "=" * 90)
    print(f"PASO DE PRUEBA : {step}")
    print(f"ENDPOINT       : {method.upper()} {endpoint}")
    print(
        "PAYLOAD ENVIADO:\n"
        + (json.dumps(payload, indent = 2, ensure_ascii = False) if payload is not None else "(sin cuerpo)")
    )
    print(f"STATUS ESPERADO: {expected_status}")
    print(f"STATUS RECIBIDO: {response.status_code}")
    print(
        "RESPUESTA JSON COMPLETA:\n"
        + (json.dumps(body, indent = 2, ensure_ascii = False, default = str) if body is not None else "(sin cuerpo)")
    )

    assert response.status_code == expected_status, (
        f"[FALLÓ] {step} -> se esperaba status {expected_status} pero la API devolvió "
        f"{response.status_code}. Cuerpo de la respuesta: {body}"
    )

    print(f"[ÉXITO] {success_message}")
    print("=" * 90)


@pytest.fixture
def admin_headers(client, register, login):
    """Register and sign in the bootstrap admin (review committee) account."""
    register(
        client,
        username = "chair",
        full_name = "Review Committee Chair",
        email = "chair@yachaytech.edu.ec"
    )
    tokens = login(client, email = "chair@yachaytech.edu.ec")
    return {"Authorization": f"Bearer {tokens['access_token']}"}
