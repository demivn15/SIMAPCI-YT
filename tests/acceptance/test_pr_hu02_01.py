"""
PR-HU02-01 (PGPCECMC-101) - Prueba funcional de HU02 "Iniciar y cerrar sesión".
Acceso con credenciales válidas e inválidas. Criterios cubiertos: CA04 y CA05.
Responsable: Camilo Vásquez (tester). Parte de T-HU02-07 (PGPCECMC-31).

Resultado esperado (Jira): solo las credenciales válidas permiten iniciar sesión.

El directorio institucional se simula con tests/support/directorio_ldap.py, de modo
que corre el código real de LDAPService (búsqueda, bind y verificación del grupo).

Las pruebas marcadas con xfail(strict=True) documentan DEFECTOS encontrados: hoy
fallan a propósito. Cuando se corrija el defecto, la prueba pasará, pytest avisará
(XPASS) y se debe quitar el marcador.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.support.directorio_ldap import (
    ESTUDIANTE,
    PROFESOR,
    directorio_caido,
    instalar_directorio,
)

LOGIN_URL = "/api/v1/auth/login"
ME_URL = "/api/v1/auth/me"


@pytest.fixture
def cliente(monkeypatch):
    instalar_directorio(monkeypatch)
    # raise_server_exceptions=False: un error interno se ve como HTTP 500, igual que
    # lo vería el navegador, en lugar de cortar la prueba con una excepción.
    return TestClient(app, raise_server_exceptions=False)


def _login(cliente, username, password):
    return cliente.post(LOGIN_URL, json={"username": username, "password": password})


# --- CA04: credenciales válidas ---------------------------------------------------

def test_cp01_credenciales_validas_inician_sesion_segura(cliente):
    """CP-01 · CA04: profesor con credenciales válidas -> sesión JWT en cookie HttpOnly."""
    response = _login(cliente, PROFESOR["uid"], PROFESOR["password"])

    assert response.status_code == 200
    assert "access_token" in response.cookies
    set_cookie = response.headers["set-cookie"].lower()
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie
    assert PROFESOR["password"] not in response.text


def test_cp02_sesion_valida_habilita_funciones_privadas(cliente):
    """CP-02 · CA04: con la sesión iniciada, /auth/me (función privada) responde el perfil."""
    _login(cliente, PROFESOR["uid"], PROFESOR["password"])
    response = cliente.get(ME_URL)

    assert response.status_code == 200
    assert response.json()["username"] == PROFESOR["uid"]
    assert response.json()["role"] == "professor"


def test_cp03_usuario_en_mayusculas_es_la_misma_cuenta(cliente):
    """CP-03 · CA04: 'MGARCIA' entra a la misma cuenta que 'mgarcia' (sin duplicar)."""
    assert _login(cliente, PROFESOR["uid"], PROFESOR["password"]).status_code == 200
    response = _login(cliente, PROFESOR["uid"].upper(), PROFESOR["password"])

    assert response.status_code == 200
    assert response.json()["account_created"] is False


# --- CA05: credenciales incorrectas o incompletas --------------------------------

def test_cp04_contrasena_incorrecta_es_rechazada(cliente):
    """CP-04 · CA05: contraseña incorrecta -> 401 y sin cookie de sesión."""
    response = _login(cliente, PROFESOR["uid"], "contrasena-incorrecta")

    assert response.status_code == 401
    assert "access_token" not in response.cookies


def test_cp05_usuario_inexistente_recibe_el_mismo_mensaje(cliente):
    """CP-05 · CA05: usuario inexistente -> 401 con el MISMO mensaje que una contraseña
    incorrecta (no revela qué usuarios existen)."""
    inexistente = _login(cliente, "no-existe", "cualquier-clave")
    clave_mala = _login(cliente, PROFESOR["uid"], "contrasena-incorrecta")

    assert inexistente.status_code == 401
    assert inexistente.json()["detail"] == clave_mala.json()["detail"]


def test_cp06_usuario_que_no_es_profesor_es_rechazado(cliente):
    """CP-06 · CA05: credenciales correctas de alguien fuera del grupo de profesores -> 401."""
    response = _login(cliente, ESTUDIANTE["uid"], ESTUDIANTE["password"])

    assert response.status_code == 401
    assert "access_token" not in response.cookies


def test_cp07_formulario_sin_campos_es_rechazado(cliente):
    """CP-07 · CA05: petición sin usuario ni contraseña -> 422 (validación de entrada)."""
    assert cliente.post(LOGIN_URL, json={}).status_code == 422
    assert cliente.post(LOGIN_URL, json={"username": PROFESOR["uid"]}).status_code == 422


def test_cp08_usuario_vacio_es_rechazado(cliente):
    """CP-08 · CA05: usuario vacío -> rechazo controlado, sin sesión."""
    response = _login(cliente, "", "cualquier-clave")

    assert response.status_code in (401, 422)
    assert "access_token" not in response.cookies


@pytest.mark.xfail(
    strict=True,
    reason="DEFECTO D-01: con contraseña vacía ldap3 lanza LDAPPasswordIsMandatoryError, "
    "LDAPService la convierte en RuntimeError y la API responde 500 en vez de 401/422. "
    "El frontend lo muestra como 'El servicio de acceso no responde' (mensaje inapropiado, CA05). "
    "Relacionado con T-HU02-02 (PGPCECMC-26, validaciones de entrada).",
)
def test_cp09_contrasena_vacia_es_rechazada_sin_error_interno(cliente):
    """CP-09 · CA05: contraseña vacía -> 401/422, nunca 500."""
    response = _login(cliente, PROFESOR["uid"], "")

    assert response.status_code in (401, 422)


@pytest.mark.xfail(
    strict=True,
    reason="DEFECTO D-02: el usuario se inserta sin escapar en el filtro LDAP (uid={username}). "
    "'mgar*' encuentra a mgarcia, inicia sesión y crea una cuenta fantasma con username 'mgar*' "
    "y el correo de mgarcia; después mgarcia ya no puede entrar (409). "
    "El commit de PGPCECMC-22 dice 'harden LDAP queries', pero esa rama no modifica ldap_service.py.",
)
def test_cp10_comodin_en_el_usuario_no_inicia_sesion(cliente):
    """CP-10 · CA05: un comodín LDAP en el usuario no debe autenticar a nadie."""
    response = _login(cliente, "mgar*", PROFESOR["password"])

    assert response.status_code == 401
    assert "access_token" not in response.cookies


@pytest.mark.xfail(
    strict=True,
    reason="DEFECTO D-02 (misma causa): caracteres especiales de LDAP en el usuario rompen "
    "el filtro, ldap3 lanza una excepción y la API responde 500 en vez de 401.",
)
def test_cp11_caracteres_especiales_en_el_usuario_no_causan_error_interno(cliente):
    """CP-11 · CA05: 'mgarcia)(uid=*' -> 401, nunca 500."""
    response = _login(cliente, "mgarcia)(uid=*", PROFESOR["password"])

    assert response.status_code == 401


def test_cp12_directorio_caido_responde_503_sin_detalles_internos(monkeypatch):
    """CP-12 · CA05: si el directorio no responde -> 503 con mensaje claro, sin sesión
    y sin exponer detalles internos (host, DN de servicio, trazas)."""
    directorio_caido(monkeypatch)
    response = TestClient(app, raise_server_exceptions=False).post(
        LOGIN_URL, json={"username": PROFESOR["uid"], "password": PROFESOR["password"]}
    )

    assert response.status_code == 503
    assert "access_token" not in response.cookies
    detalle = response.json()["detail"].lower()
    assert "dc=" not in detalle and "ldap://" not in detalle and "traceback" not in detalle
