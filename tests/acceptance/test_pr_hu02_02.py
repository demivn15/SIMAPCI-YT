"""
PR-HU02-02 (PGPCECMC-102) - Prueba de seguridad de HU02 "Iniciar y cerrar sesión".
Denegación de funciones privadas sin sesión y vista pública accesible. Criterio: CA06.
Responsable: Camilo Vásquez (tester). Parte de T-HU02-07 (PGPCECMC-31).

Procedimiento (Jira): solicitar una función privada sin sesión y después de cerrar
sesión; consultar la vista pública sin sesión.
Resultado esperado: el acceso privado se deniega en ambos casos y la vista pública
permanece accesible.

Funciones privadas que existen hoy en main:
    GET /api/v1/auth/me
    GET /api/v1/integrations/doi/{doi}
    GET /api/v1/integrations/orcid/{orcid}/works
La vista pública del catálogo (HU05) es del Sprint 2; hoy solo se puede comprobar
que la parte pública del backend responde sin sesión.
"""

from datetime import timedelta

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import create_access_token
from app.main import app
from tests.support.directorio_ldap import PROFESOR, instalar_directorio

LOGIN_URL = "/api/v1/auth/login"
LOGOUT_URL = "/api/v1/auth/logout"

FUNCIONES_PRIVADAS = [
    "/api/v1/auth/me",
    "/api/v1/integrations/doi/10.1145/3576915.3623102",
    "/api/v1/integrations/orcid/0000-0002-1825-0097/works",
]


def _token(**cambios) -> str:
    datos = {"sub": "mgarcia", "user_id": "u-1", "name": "María García",
             "email": "mgarcia@yachaytech.edu.ec", "role": "professor"}
    datos.update(cambios)
    return create_access_token(datos)


def _cliente_con_cookie(token: str) -> TestClient:
    cliente = TestClient(app)
    cliente.cookies.set("access_token", token)
    return cliente


# --- Sin sesión -------------------------------------------------------------------

@pytest.mark.parametrize("ruta", FUNCIONES_PRIVADAS)
def test_cp01_funcion_privada_sin_sesion_es_denegada(ruta):
    """CP-01 · CA06: sin cookie de sesión -> 401 en cada función privada."""
    assert TestClient(app).get(ruta).status_code == 401


@pytest.mark.parametrize("ruta", FUNCIONES_PRIVADAS)
def test_cp02_token_vencido_es_denegado(ruta):
    """CP-02 · CA06: token expirado -> 401 (al expirar, la sesión deja de ser válida)."""
    vencido = create_access_token({"sub": "mgarcia", "role": "professor"}, expires_delta=timedelta(minutes=-1))
    assert _cliente_con_cookie(vencido).get(ruta).status_code == 401


def test_cp03_token_alterado_es_denegado():
    """CP-03 · CA06: token con la firma modificada -> 401."""
    token = _token()
    alterado = token[:-4] + ("AAAA" if not token.endswith("AAAA") else "BBBB")
    assert _cliente_con_cookie(alterado).get(FUNCIONES_PRIVADAS[0]).status_code == 401


def test_cp04_token_firmado_con_otra_clave_es_denegado():
    """CP-04 · CA06: token falsificado con otra clave secreta -> 401."""
    falso = jwt.encode({"sub": "mgarcia", "role": "professor"}, "otra-clave-secreta-de-32-bytes-xx",
                       algorithm=settings.ALGORITHM)
    assert _cliente_con_cookie(falso).get(FUNCIONES_PRIVADAS[0]).status_code == 401


def test_cp05_token_sin_firma_alg_none_es_denegado():
    """CP-05 · CA06: token con alg 'none' (sin firma) -> 401."""
    sin_firma = jwt.encode({"sub": "mgarcia", "role": "professor"}, key=None, algorithm="none")
    assert _cliente_con_cookie(sin_firma).get(FUNCIONES_PRIVADAS[0]).status_code == 401


def test_cp06_token_valido_con_rol_no_autorizado_es_denegado():
    """CP-06 · CA06: sesión válida pero sin rol de profesor -> 403 (autorización por rol)."""
    assert _cliente_con_cookie(_token(role="visitante")).get(FUNCIONES_PRIVADAS[0]).status_code == 403


# --- Después de cerrar sesión ----------------------------------------------------

@pytest.fixture
def sesion(monkeypatch):
    """Profesor con sesión iniciada contra el directorio simulado."""
    instalar_directorio(monkeypatch)
    cliente = TestClient(app)
    response = cliente.post(LOGIN_URL, json={"username": PROFESOR["uid"], "password": PROFESOR["password"]})
    assert response.status_code == 200
    return cliente


def test_cp07_logout_borra_la_cookie_y_deniega_el_acceso(sesion):
    """CP-07 · CA06: después de cerrar sesión, el mismo navegador ya no accede (401)."""
    assert sesion.get(FUNCIONES_PRIVADAS[0]).status_code == 200

    response = sesion.post(LOGOUT_URL)
    assert response.status_code == 200
    assert "access_token" not in sesion.cookies
    assert sesion.get(FUNCIONES_PRIVADAS[0]).status_code == 401


@pytest.mark.xfail(
    strict=True,
    reason="DEFECTO D-03: en main el logout solo borra la cookie del navegador; el token sigue "
    "siendo válido hasta que expira (8 h). T-HU02-05 (PGPCECMC-29) figura 'Finalizada' en Jira, "
    "pero la invalidación (app/core/token_blocklist.py) está solo en la rama "
    "feature/PGPCECMC-29-logout-token, que no se ha integrado a main.",
)
def test_cp08_token_copiado_antes_del_logout_deja_de_servir(sesion):
    """CP-08 · CA06: un token capturado antes del logout no debe volver a abrir la sesión."""
    token_anterior = sesion.cookies.get("access_token")
    sesion.post(LOGOUT_URL)

    reutilizado = _cliente_con_cookie(token_anterior).get(FUNCIONES_PRIVADAS[0])
    assert reutilizado.status_code == 401


# --- Vista pública ---------------------------------------------------------------

def test_cp09_parte_publica_del_backend_responde_sin_sesion():
    """CP-09 · CA06: la parte pública disponible hoy (estado del servicio) responde sin sesión.
    El catálogo público (HU05, Sprint 2) se probará en PR-HU05-01."""
    response = TestClient(app).get("/")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
