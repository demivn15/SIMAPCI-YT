"""
Errores del directorio sin detalles internos - T-HU01-05 (PGPCECMC-22), CA05.
Cualquier falla del LDAP responde 503 con un mensaje genérico; el detalle va al log.
"""

from fastapi.testclient import TestClient
from ldap3.core.exceptions import LDAPException

from app.main import app
from app.services import ldap_service
from app.services.ldap_service import DIRECTORY_UNAVAILABLE

DETALLE_INTERNO = "cn=admin,dc=yachaytech,dc=edu,dc=ec en ldap-interno:389"


def _login():
    return TestClient(app, raise_server_exceptions=False).post(
        "/api/v1/auth/login", json={"username": "mgarcia", "password": "Clave-2026!"}
    )


def test_error_inesperado_al_conectar_responde_503_generico(monkeypatch, caplog):
    def conexion_rota(*_args, **_kwargs):
        raise ValueError(DETALLE_INTERNO)

    monkeypatch.setattr(ldap_service, "Connection", conexion_rota)
    response = _login()

    assert response.status_code == 503
    assert response.json()["detail"] == DIRECTORY_UNAVAILABLE
    assert DETALLE_INTERNO not in response.text
    assert DETALLE_INTERNO in caplog.text


def test_error_del_directorio_en_la_busqueda_responde_503_generico(monkeypatch):
    class ConexionQueFalla:
        def __enter__(self):
            return self

        def __exit__(self, *_exc):
            return False

        def search(self, **_kwargs):
            raise LDAPException(DETALLE_INTERNO)

    monkeypatch.setattr(ldap_service.LDAPService, "_get_service_connection", staticmethod(ConexionQueFalla))
    response = _login()

    assert response.status_code == 503
    assert DETALLE_INTERNO not in response.text
