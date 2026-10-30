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

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services.ldap_service import LDAPService  # noqa: E402

client = TestClient(app)

PROFESSOR = {
    "username": "professor",
    "full_name": "Hubert Farnsworth",
    "email": "professor@planetexpress.com",
    "dn": "cn=Hubert J. Farnsworth,ou=people,dc=planetexpress,dc=com",
}


def _mock_ldap(monkeypatch, result):
    monkeypatch.setattr(
        LDAPService,
        "authenticate_and_authorize_professor",
        classmethod(lambda cls, username, password: result),
    )


def test_health_check():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_login_success_sets_cookie(monkeypatch):
    _mock_ldap(monkeypatch, PROFESSOR)
    response = client.post("/api/v1/auth/login", json={"username": "professor", "password": "professor"})
    assert response.status_code == 200
    assert response.json()["message"] == "Login successful"
    assert "access_token" in response.cookies


def test_login_invalid_credentials_returns_401(monkeypatch):
    _mock_ldap(monkeypatch, None)
    response = client.post("/api/v1/auth/login", json={"username": "professor", "password": "wrongpass"})
    assert response.status_code == 401
    assert "access_token" not in response.cookies


def test_login_requires_body():
    assert client.post("/api/v1/auth/login", json={}).status_code == 422


def test_me_requires_session():
    assert TestClient(app).get("/api/v1/auth/me").status_code == 401


def test_me_returns_profile_after_login(monkeypatch):
    _mock_ldap(monkeypatch, PROFESSOR)
    session = TestClient(app)
    session.post("/api/v1/auth/login", json={"username": "professor", "password": "professor"})
    response = session.get("/api/v1/auth/me")
    assert response.status_code == 200
    assert response.json()["username"] == "professor"
    assert response.json()["role"] == "admin"
