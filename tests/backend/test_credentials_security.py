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

from app.core.config import settings  # noqa: E402
from app.core.passwords import hash_password, verify_password  # noqa: E402
from app.main import app  # noqa: E402
from app.services import user_store  # noqa: E402
from app.services.ldap_service import LDAPService  # noqa: E402

client = TestClient(app)

NEW_PROFESSOR = {
    "full_name": "Ana Torres",
    "email": "ana.torres@yachaytech.edu.ec",
    "password": "clave-segura-1",
    "school": "ECMC",
}


def test_hash_is_salted_and_never_contains_the_password():
    first = hash_password("clave-segura-1")
    second = hash_password("clave-segura-1")
    assert first != second
    assert "clave-segura-1" not in first
    assert first.startswith("pbkdf2_sha256$")


def test_verify_password_accepts_only_the_right_password():
    stored = hash_password("clave-segura-1")
    assert verify_password("clave-segura-1", stored)
    assert not verify_password("clave-segura-2", stored)
    assert not verify_password("", stored)


def test_verify_password_rejects_malformed_hashes():
    assert not verify_password("x", "")
    assert not verify_password("x", "plaintext")
    assert not verify_password("x", "md5$1$abc$def")
    assert not verify_password("x", "pbkdf2_sha256$notanumber$!!$!!")


def test_registration_stores_only_a_hash():
    response = client.post("/api/v1/auth/register", json=NEW_PROFESSOR)
    assert response.status_code == 201
    assert "password" not in response.text
    stored = user_store.get_user(NEW_PROFESSOR["email"])
    assert stored["password_hash"] != NEW_PROFESSOR["password"]
    assert verify_password(NEW_PROFESSOR["password"], stored["password_hash"])
    assert NEW_PROFESSOR["password"] not in str(stored)


def test_registration_rejects_duplicate_email():
    assert client.post("/api/v1/auth/register", json=NEW_PROFESSOR).status_code == 201
    duplicate = client.post("/api/v1/auth/register", json=NEW_PROFESSOR)
    assert duplicate.status_code == 409


def test_ldap_bind_password_is_masked():
    assert "GoodNewsEveryone" not in repr(settings)
    assert "GoodNewsEveryone" not in str(settings.LDAP_BIND_PASSWORD)
    assert settings.LDAP_BIND_PASSWORD.get_secret_value() == "GoodNewsEveryone"


def test_login_cookie_flags(monkeypatch):
    monkeypatch.setattr(
        LDAPService,
        "authenticate_and_authorize_professor",
        classmethod(lambda cls, username, password: {
            "username": "professor", "full_name": "Hubert Farnsworth", "email": "p@planetexpress.com",
        }),
    )
    monkeypatch.setattr(settings, "COOKIE_SECURE", True)
    response = client.post("/api/v1/auth/login", json={"username": "professor", "password": "professor"})
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie
    assert "secure" in cookie
    assert "samesite=lax" in cookie


def test_ldap_rejects_blank_credentials_without_contacting_the_directory():
    # An empty password would otherwise become an anonymous LDAP bind.
    assert LDAPService.authenticate_and_authorize_professor("professor", "") is None
    assert LDAPService.authenticate_and_authorize_professor("", "professor") is None
