import os

os.environ.update(
    SECRET_KEY="test-secret-key-for-ci-only-0123456789",
    ALGORITHM="HS256",
    ACCESS_TOKEN_EXPIRE_MINUTES="60",
    LDAP_SERVER_URI="ldap://localhost:10389",
    LDAP_BIND_DN="cn=admin,dc=planetexpress,dc=com",
    LDAP_BIND_PASSWORD="GoodNewsEveryone",
    LDAP_USER_BASE_DN="ou=people,dc=planetexpress,dc=com",
    LDAP_GROUP_BASE_DN="ou=people,dc=planetexpress,dc=com",
    LDAP_PROFESSOR_GROUP_CN="admin_staff",
)

import time  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core import token_blocklist  # noqa: E402
from app.main import app  # noqa: E402
from app.services.ldap_service import LDAPService  # noqa: E402

PROFESSOR = {
    "username": "professor",
    "full_name": "Hubert Farnsworth",
    "email": "professor@planetexpress.com",
}


@pytest.fixture(autouse=True)
def _clean_blocklist():
    token_blocklist.reset()
    yield
    token_blocklist.reset()


@pytest.fixture
def logged_in(monkeypatch):
    monkeypatch.setattr(
        LDAPService,
        "authenticate_and_authorize_professor",
        classmethod(lambda cls, username, password: PROFESSOR),
    )
    session = TestClient(app)
    response = session.post("/api/v1/auth/login", json={"username": "professor", "password": "professor"})
    assert response.status_code == 200
    return session, response.cookies["access_token"]


def test_logout_invalidates_the_session(logged_in):
    session, _ = logged_in
    assert session.get("/api/v1/auth/me").status_code == 200
    assert session.post("/api/v1/auth/logout").status_code == 200
    assert session.get("/api/v1/auth/me").status_code == 401


def test_logout_clears_the_cookie(logged_in):
    session, _ = logged_in
    response = session.post("/api/v1/auth/logout")
    cookie = response.headers["set-cookie"].lower()
    assert "access_token=" in cookie
    assert "max-age=0" in cookie
    assert "httponly" in cookie


def test_copied_token_is_rejected_after_logout(logged_in):
    session, token = logged_in
    session.post("/api/v1/auth/logout")

    attacker = TestClient(app)
    attacker.cookies.set("access_token", token)
    assert attacker.get("/api/v1/auth/me").status_code == 401
    assert attacker.get("/api/v1/professor/dashboard").status_code == 401


def test_logout_only_revokes_the_current_token(logged_in):
    session, _ = logged_in
    other_device = TestClient(app)
    other_device.post("/api/v1/auth/login", json={"username": "professor", "password": "professor"})

    session.post("/api/v1/auth/logout")
    assert session.get("/api/v1/auth/me").status_code == 401
    assert other_device.get("/api/v1/auth/me").status_code == 200


def test_new_login_after_logout_works(logged_in):
    session, _ = logged_in
    session.post("/api/v1/auth/logout")
    session.post("/api/v1/auth/login", json={"username": "professor", "password": "professor"})
    assert session.get("/api/v1/auth/me").status_code == 200


def test_logout_without_session_is_harmless():
    assert TestClient(app).post("/api/v1/auth/logout").status_code == 200


def test_logout_with_garbage_token_is_harmless():
    client = TestClient(app)
    client.cookies.set("access_token", "not-a-jwt")
    assert client.post("/api/v1/auth/logout").status_code == 200


def test_blocklist_drops_expired_entries():
    token_blocklist.revoke("old", time.time() - 10)
    token_blocklist.revoke("fresh", time.time() + 60)
    assert not token_blocklist.is_revoked("old")
    assert token_blocklist.is_revoked("fresh")
