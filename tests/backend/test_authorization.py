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

from datetime import timedelta  # noqa: E402

import jwt  # noqa: E402
from fastapi import Depends, FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.api.deps import require_roles  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.core.security import create_access_token  # noqa: E402
from app.main import app  # noqa: E402

PRIVATE_ROUTE = "/api/v1/professor/dashboard"


def _session(role="professor", **kwargs):
    token = create_access_token(
        {"sub": "someone", "name": "Some One", "email": "someone@yachaytech.edu.ec", "role": role}, **kwargs
    )
    client = TestClient(app)
    client.cookies.set("access_token", token)
    return client


def test_private_route_without_session_returns_401():
    assert TestClient(app).get(PRIVATE_ROUTE).status_code == 401


def test_private_route_with_professor_role_returns_200():
    response = _session("professor").get(PRIVATE_ROUTE)
    assert response.status_code == 200
    assert response.json()["role"] == "professor"


def test_private_route_with_other_role_returns_403():
    assert _session("student").get(PRIVATE_ROUTE).status_code == 403


def test_private_route_with_missing_role_claim_returns_403():
    token = jwt.encode({"sub": "someone"}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    client = TestClient(app)
    client.cookies.set("access_token", token)
    assert client.get(PRIVATE_ROUTE).status_code == 403


def test_expired_token_returns_401():
    assert _session(expires_delta=timedelta(seconds=-5)).get(PRIVATE_ROUTE).status_code == 401


def test_token_signed_with_another_key_returns_401():
    forged = jwt.encode({"sub": "x", "role": "professor"}, "another-secret-key-0123456789-abcdef", algorithm="HS256")
    client = TestClient(app)
    client.cookies.set("access_token", forged)
    assert client.get(PRIVATE_ROUTE).status_code == 401


def test_unsigned_token_returns_401():
    unsigned = jwt.encode({"sub": "x", "role": "professor"}, None, algorithm="none")
    client = TestClient(app)
    client.cookies.set("access_token", unsigned)
    assert client.get(PRIVATE_ROUTE).status_code == 401


def test_auth_me_requires_professor_role():
    assert _session("student").get("/api/v1/auth/me").status_code == 403


def test_require_roles_supports_several_roles():
    demo = FastAPI()

    @demo.get("/reviewers")
    def reviewers(user: dict = Depends(require_roles("professor", "reviewer"))):
        return {"role": user["role"]}

    def call(role):
        client = TestClient(demo)
        client.cookies.set("access_token", create_access_token({"sub": "x", "role": role}))
        return client.get("/reviewers").status_code

    assert call("professor") == 200
    assert call("reviewer") == 200
    assert call("student") == 403
