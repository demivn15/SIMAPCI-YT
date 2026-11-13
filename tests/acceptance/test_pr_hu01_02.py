"""
PR-HU01-02 (PGPCECMC-100) - Prueba de seguridad de HU01 "Registrar una cuenta de profesor".
Revisión de persistencia de credenciales y tráfico de registro. Criterio: CA03 (RNF01).
Responsable: Camilo Vásquez (tester). Parte de T-HU01-07 (PGPCECMC-24).

Resultado esperado (Jira): no existen credenciales en texto plano y se cumple RNF01.

Adaptación a LDAP: la cuenta se crea en el primer inicio de sesión, así que el
"registro" que se revisa es POST /api/v1/auth/login con un profesor nuevo.
La contraseña usada es un valor centinela fácil de buscar en BD, token, respuesta y logs.
"""

import logging

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect, select

from app.db.base import Base
from app.main import app
from tests.support.directorio_ldap import PROFESOR, instalar_directorio

LOGIN_URL = "/api/v1/auth/login"
CLAVE_CENTINELA = "Centinela-PR-HU01-02-#2026"
PROFESOR_CENTINELA = {**PROFESOR, "password": CLAVE_CENTINELA}


@pytest.fixture
def registro(monkeypatch, caplog):
    """Primer acceso (= registro) de un profesor con la contraseña centinela."""
    instalar_directorio(monkeypatch, usuarios=[PROFESOR_CENTINELA])
    caplog.set_level(logging.DEBUG)
    response = TestClient(app).post(
        LOGIN_URL, json={"username": PROFESOR["uid"], "password": CLAVE_CENTINELA}
    )
    assert response.status_code == 200
    assert response.json()["account_created"] is True
    return response


def test_cp01_la_contrasena_no_aparece_en_ninguna_tabla(registro, db_session):
    """CP-01 · CA03: después del registro, ningún valor de ninguna tabla contiene la contraseña."""
    filas = []
    for tabla in Base.metadata.sorted_tables:
        filas += [str(tuple(fila)) for fila in db_session.execute(select(tabla)).all()]

    assert filas, "el registro debía crear al menos una fila"
    assert not any(CLAVE_CENTINELA in fila for fila in filas)


def test_cp02_ninguna_tabla_tiene_columnas_de_contrasena(registro, db_session):
    """CP-02 · CA03: el modelo no guarda contraseñas ni hashes (la autenticación es LDAP)."""
    sospechosas = ("password", "passwd", "pwd", "contrasena", "secret", "hash")
    inspector = inspect(db_session.get_bind())
    for tabla in inspector.get_table_names():
        for columna in inspector.get_columns(tabla):
            assert not any(s in columna["name"].lower() for s in sospechosas), f"{tabla}.{columna['name']}"


def test_cp03_el_token_de_sesion_no_lleva_la_contrasena(registro):
    """CP-03 · CA03: el JWT de la cookie no contiene la contraseña y solo lleva los datos previstos."""
    token = registro.cookies.get("access_token")
    datos = jwt.decode(token, options={"verify_signature": False})

    assert CLAVE_CENTINELA not in token
    assert CLAVE_CENTINELA not in str(datos)
    assert set(datos) <= {"sub", "user_id", "name", "email", "role", "exp", "jti", "iat"}


def test_cp04_la_respuesta_del_registro_no_devuelve_la_contrasena(registro):
    """CP-04 · CA03: ni el cuerpo ni las cabeceras de la respuesta repiten la contraseña."""
    assert CLAVE_CENTINELA not in registro.text
    assert all(CLAVE_CENTINELA not in valor for valor in registro.headers.values())


def test_cp05_los_logs_no_registran_la_contrasena(registro, caplog, capsys):
    """CP-05 · CA03: los logs de la aplicación y la salida de consola no muestran la contraseña."""
    salida = capsys.readouterr()
    assert CLAVE_CENTINELA not in caplog.text
    assert CLAVE_CENTINELA not in salida.out + salida.err


def test_cp06_la_cookie_de_sesion_no_es_accesible_desde_javascript(registro):
    """CP-06 · CA03/RNF01: cookie HttpOnly y SameSite=Lax (mitiga robo por XSS y CSRF)."""
    set_cookie = registro.headers["set-cookie"].lower()

    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie


def test_cp07_la_cookie_se_puede_marcar_secure_para_produccion(monkeypatch):
    """CP-07 · RNF01: debe existir una configuración para marcar la cookie como Secure."""
    from app.core.config import settings

    assert hasattr(settings, "COOKIE_SECURE")
