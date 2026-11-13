import pytest

from app.main import app
from fastapi.testclient import TestClient
from unittest.mock import patch

@pytest.fixture
def client():
    """Provide a fresh TestClient instance with cleared cookies for every test"""
    return TestClient(app)

def test_health_check(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "LDAP Auth API Running"}

@patch("app.services.ldap_service.LDAPService.authenticate_and_authorize_professor")
def test_login_success(mock_ldap_auth, client):
    # Mock a successful LDAP response for an authorized professor
    mock_ldap_auth.return_value = {
        "username": "professor",
        "full_name": "Test Professor",
        "email": "prof@university.edu",
        "dn": "cn=professor,ou=people,dc=planetexpress,dc=com"
    }

    response = client.post("/api/v1/auth/login", json={
        "username": "professor",
        "password": "correct_password"
    })

    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "access_token" in response.cookies

@patch("app.services.ldap_service.LDAPService.authenticate_and_authorize_professor")
def test_login_failure_invalid_credentials(mock_ldap_auth, client):
    # Mock LDAP returning None (bad credentials or unauthorized role)
    mock_ldap_auth.return_value = None

    response = client.post("/api/v1/auth/login", json={
        "username": "professor",
        "password": "wrong_password"
    })

    assert response.status_code == 401

def test_protected_route_unauthenticated(client):
    # Attempt to hit dashboard API without a session cookie
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
