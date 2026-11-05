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

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)

VALID = {
    "full_name": "Ana Torres",
    "email": "ana.torres@yachaytech.edu.ec",
    "password": "clave-segura-1",
    "school": "ECMC",
}


def _register(**overrides):
    return client.post("/api/v1/auth/register", json={**VALID, **overrides})


def test_register_valid_data_is_accepted_and_normalized():
    response = _register(email="  Ana.Torres@YachayTech.edu.ec ", school="ecmc", full_name="  Ana   Torres ")
    assert response.status_code == 202
    assert response.json()["email"] == "ana.torres@yachaytech.edu.ec"
    assert response.json()["school"] == "ECMC"


@pytest.mark.parametrize("field", ["full_name", "email", "password", "school"])
def test_register_requires_every_field(field):
    body = {k: v for k, v in VALID.items() if k != field}
    assert client.post("/api/v1/auth/register", json=body).status_code == 422


@pytest.mark.parametrize("field", ["full_name", "email", "password", "school"])
def test_register_rejects_blank_fields(field):
    assert _register(**{field: "   "}).status_code == 422


@pytest.mark.parametrize(
    "email",
    [
        "ana@gmail.com",
        "ana@yachaytech.edu",
        "ana@yachaytech.edu.ec.evil.com",
        "ana@evil-yachaytech.edu.ec",
        "ana@sub.yachaytech.edu.ec",
        "ana@@yachaytech.edu.ec",
        "@yachaytech.edu.ec",
        "ana",
    ],
)
def test_register_rejects_non_institutional_email(email):
    response = _register(email=email)
    assert response.status_code == 422
    assert "email" in response.text


def test_register_rejects_short_password():
    assert _register(password="1234567").status_code == 422


def test_register_rejects_invalid_school_code():
    assert _register(school="not a school!").status_code == 422
