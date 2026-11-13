"""
PR-HU01-01 (PGPCECMC-99) - Prueba de aceptación de HU01 "Registrar una cuenta de profesor".
Criterios cubiertos: CA01 y CA02.

Adaptación a LDAP: la cuenta se crea en el primer inicio de sesión
(POST /api/v1/auth/login). El directorio LDAP se reemplaza por un doble de prueba
que devuelve la identidad de cada caso; la BD es SQLite (tests/conftest.py).

Cada prueba corresponde a un caso del documento PR-HU01-01 (CP-01 ... CP-06).
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.user import User
from app.services.ldap_service import LDAPService

LOGIN_URL = "/api/v1/auth/login"

INSTITUTIONAL = {
    "username": "mgarcia",
    "full_name": "María García",
    "email": "mgarcia@yachaytech.edu.ec",
    "dn": "uid=mgarcia,ou=people,dc=yachaytech,dc=edu,dc=ec",
}


def _ldap_returns(monkeypatch, identity):
    """Simula la respuesta del directorio institucional para este caso."""
    monkeypatch.setattr(
        LDAPService,
        "authenticate_and_authorize_professor",
        classmethod(lambda cls, username, password: identity),
    )


def _login(username="mgarcia", password="clave-valida"):
    return TestClient(app).post(LOGIN_URL, json={"username": username, "password": password})


def test_cp01_first_access_with_valid_institutional_email_creates_account(monkeypatch, db_session):
    """CP-01 · CA01: correo institucional válido -> la cuenta se crea y se confirma."""
    _ldap_returns(monkeypatch, INSTITUTIONAL)
    response = _login()

    assert response.status_code == 200
    assert response.json()["account_created"] is True
    assert "access_token" in response.cookies
    user = db_session.query(User).one()
    assert user.email == "mgarcia@yachaytech.edu.ec"
    assert user.role == "professor"
    assert user.school == "ECMC"


def test_cp02_repeated_access_does_not_duplicate_account(monkeypatch, db_session):
    """CP-02 · CA02: el mismo profesor vuelve a ingresar -> no se duplica la cuenta."""
    _ldap_returns(monkeypatch, INSTITUTIONAL)
    _login()
    response = _login()

    assert response.status_code == 200
    assert response.json()["account_created"] is False
    assert db_session.query(User).count() == 1


def test_cp03_email_already_registered_to_another_account_is_rejected(monkeypatch, db_session):
    """CP-03 · CA02: correo ya registrado en otra cuenta -> se rechaza con motivo."""
    _ldap_returns(monkeypatch, INSTITUTIONAL)
    _login()

    _ldap_returns(monkeypatch, {**INSTITUTIONAL, "username": "mgarcia2", "full_name": "Otra cuenta"})
    response = _login(username="mgarcia2")

    assert response.status_code == 409
    assert "correo" in response.json()["detail"].lower()
    assert "access_token" not in response.cookies
    assert db_session.query(User).count() == 1


def test_cp04_email_already_registered_with_different_case_is_rejected(monkeypatch, db_session):
    """CP-04 · CA02: el mismo correo con otras mayúsculas también cuenta como duplicado."""
    _ldap_returns(monkeypatch, INSTITUTIONAL)
    _login()

    _ldap_returns(
        monkeypatch,
        {**INSTITUTIONAL, "username": "mgarcia2", "email": "MGarcia@YachayTech.edu.ec"},
    )
    response = _login(username="mgarcia2")

    assert response.status_code == 409
    assert db_session.query(User).count() == 1


@pytest.mark.xfail(
    strict=True,
    reason="Pendiente T-HU01-02 (PGPCECMC-19): validación del dominio de correo institucional. "
    "Cuando se implemente, esta prueba pasará y se debe quitar el marcador xfail.",
)
def test_cp05_external_email_domain_is_rejected(monkeypatch, db_session):
    """CP-05 · CA02: correo de dominio externo -> se rechaza con motivo y no se crea cuenta."""
    _ldap_returns(monkeypatch, {**INSTITUTIONAL, "username": "externo", "email": "externo@gmail.com"})
    response = _login(username="externo")

    assert response.status_code in (400, 403, 422)
    assert db_session.query(User).count() == 0


def test_cp06_invalid_credentials_do_not_create_account(monkeypatch, db_session):
    """CP-06 · CA02 (complementario): credenciales inválidas -> no se crea ni modifica nada."""
    _ldap_returns(monkeypatch, None)
    response = _login(password="clave-incorrecta")

    assert response.status_code == 401
    assert "access_token" not in response.cookies
    assert db_session.query(User).count() == 0
