"""
Pruebas de integración de PGPCECMC-20: el endpoint /auth/login crea la cuenta en
el primer acceso y no la duplica. LDAP se simula; la BD es SQLite (tests/conftest.py).
"""

from fastapi.testclient import TestClient

from app.core.security import decode_access_token
from app.main import app
from app.models.user import User
from app.services.ldap_service import LDAPService

LOGIN_URL = "/api/v1/auth/login"
CREDENTIALS = {"username": "professor", "password": "professor"}

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


def test_first_login_creates_account_and_reports_it(monkeypatch, db_session):
    _mock_ldap(monkeypatch, PROFESSOR)
    response = TestClient(app).post(LOGIN_URL, json=CREDENTIALS)

    assert response.status_code == 200
    assert response.json()["account_created"] is True
    assert db_session.query(User).filter_by(username="professor").count() == 1


def test_second_login_does_not_duplicate_account(monkeypatch, db_session):
    _mock_ldap(monkeypatch, PROFESSOR)
    client = TestClient(app)
    client.post(LOGIN_URL, json=CREDENTIALS)
    response = client.post(LOGIN_URL, json=CREDENTIALS)

    assert response.status_code == 200
    assert response.json()["account_created"] is False
    assert db_session.query(User).count() == 1


def test_token_carries_user_id_and_role_from_database(monkeypatch, db_session):
    _mock_ldap(monkeypatch, PROFESSOR)
    response = TestClient(app).post(LOGIN_URL, json=CREDENTIALS)

    payload = decode_access_token(response.cookies["access_token"])
    user = db_session.query(User).one()
    assert payload["user_id"] == user.id
    assert payload["role"] == "professor"


def test_email_registered_to_another_account_returns_409(monkeypatch, db_session):
    db_session.add(User(username="otro", email="professor@planetexpress.com", full_name="Otro"))
    db_session.commit()

    _mock_ldap(monkeypatch, PROFESSOR)
    response = TestClient(app).post(LOGIN_URL, json=CREDENTIALS)

    assert response.status_code == 409
    assert "access_token" not in response.cookies
    assert db_session.query(User).count() == 1


def test_inactive_account_returns_403(monkeypatch, db_session):
    db_session.add(
        User(username="professor", email="professor@planetexpress.com", full_name="H", is_active=False)
    )
    db_session.commit()

    _mock_ldap(monkeypatch, PROFESSOR)
    response = TestClient(app).post(LOGIN_URL, json=CREDENTIALS)

    assert response.status_code == 403
    assert "access_token" not in response.cookies


def test_ldap_identity_without_email_returns_502(monkeypatch, db_session):
    _mock_ldap(monkeypatch, {**PROFESSOR, "email": None})
    response = TestClient(app).post(LOGIN_URL, json=CREDENTIALS)

    assert response.status_code == 502
    assert db_session.query(User).count() == 0


def test_invalid_credentials_do_not_create_account(monkeypatch, db_session):
    _mock_ldap(monkeypatch, None)
    response = TestClient(app).post(LOGIN_URL, json={"username": "professor", "password": "wrong"})

    assert response.status_code == 401
    assert db_session.query(User).count() == 0
