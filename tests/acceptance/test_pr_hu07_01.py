"""
PR-HU07-01 (PGPCECMC-111) - Prueba de regla de negocio de HU07 "Validar la existencia de
un producto antes de agregarlo". Rechazo de DOI duplicado en distintos formatos.
Criterios: CA19 y CA20.
Responsable: Camilo Vásquez (tester). Parte de T-HU07-06 (PGPCECMC-64).

Procedimiento (Jira): registrar un producto y repetir el intento con el mismo DOI en otro
formato (mayúsculas, URL completa).
Resultado esperado (Jira): el segundo intento se rechaza y no se crea un registro duplicado.

Servicios simulados: directorio LDAP (sesión real del profesor). La base de datos es la
SQLite en memoria de tests/conftest.py.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.product import Product
from tests.support.directorio_ldap import OTRO_PROFESOR, PROFESOR, instalar_directorio

LOGIN_URL = "/api/v1/auth/login"
PRODUCTS_URL = "/api/v1/products"

# DOI con letras para poder probar mayúsculas y minúsculas
DOI = "10.1016/j.jcp.2024.112345"

PUBLICACION = {
    "type": "publicacion",
    "title": "Métodos espectrales para ecuaciones de reacción-difusión",
    "authors": ["María García", "Juan Pérez"],
    "year": 2024,
    "research_line": "Computación científica",
    "doi": DOI,
    "venue": "Journal of Computational Physics",
}

PROYECTO = {
    "type": "proyecto",
    "title": "Modelos de optimización para redes eléctricas",
    "authors": ["María García"],
    "year": 2025,
    "research_line": "Ecuaciones diferenciales, análisis matemático, modelamiento y optimización",
    "project_code": "ECMC-2025-07",
    "project_status": "activo",
}

# El mismo DOI escrito de otras formas que un profesor podría pegar en el formulario
VARIANTES_DEL_DOI = {
    "mayúsculas": DOI.upper(),
    "URL completa": f"https://doi.org/{DOI}",
    "URL en mayúsculas": f"HTTPS://DOI.ORG/{DOI.upper()}",
    "URL antigua dx.doi.org": f"http://dx.doi.org/{DOI}",
    "prefijo doi:": f"doi: {DOI}",
    "espacios y barra final": f"  {DOI}/  ",
}


def _sesion(usuario: dict) -> TestClient:
    cliente = TestClient(app)
    respuesta = cliente.post(LOGIN_URL, json={"username": usuario["uid"], "password": usuario["password"]})
    assert respuesta.status_code == 200
    return cliente


@pytest.fixture
def profesor(monkeypatch) -> TestClient:
    """Profesor autenticado contra el directorio simulado (actor de HU07)."""
    instalar_directorio(monkeypatch)
    return _sesion(PROFESOR)


def _productos(db_session) -> int:
    return db_session.query(Product).count()


def test_cp01_el_primer_registro_con_doi_se_acepta(profesor, db_session):
    """CP-01 · CA19 (punto de partida): un DOI que no existe se registra normalmente."""
    respuesta = profesor.post(PRODUCTS_URL, json=PUBLICACION)

    assert respuesta.status_code == 201
    assert respuesta.json()["doi"] == DOI
    assert _productos(db_session) == 1


@pytest.mark.parametrize("variante", VARIANTES_DEL_DOI.values(), ids=VARIANTES_DEL_DOI.keys())
def test_cp02_el_mismo_doi_en_otro_formato_se_rechaza(profesor, db_session, variante):
    """CP-02 · CA20: el segundo intento con el mismo DOI en otro formato se rechaza (409)
    y no se crea un registro duplicado."""
    assert profesor.post(PRODUCTS_URL, json=PUBLICACION).status_code == 201

    respuesta = profesor.post(PRODUCTS_URL, json={**PUBLICACION, "doi": variante})

    assert respuesta.status_code == 409
    assert _productos(db_session) == 1


def test_cp03_el_rechazo_informa_la_coincidencia(profesor):
    """CP-03 · CA20: el rechazo dice que el DOI ya está registrado (no es un error genérico)."""
    profesor.post(PRODUCTS_URL, json=PUBLICACION)

    respuesta = profesor.post(PRODUCTS_URL, json={**PUBLICACION, "doi": f"https://doi.org/{DOI.upper()}"})

    assert respuesta.status_code == 409
    assert "DOI" in respuesta.json()["detail"]


def test_cp04_el_doi_se_guarda_normalizado(profesor, db_session):
    """CP-04 · CA19: aunque se escriba como URL en mayúsculas, se guarda en forma canónica,
    que es lo que permite comparar los registros."""
    respuesta = profesor.post(PRODUCTS_URL, json={**PUBLICACION, "doi": f"HTTPS://DOI.ORG/{DOI.upper()}"})

    assert respuesta.status_code == 201
    assert db_session.query(Product).one().doi == DOI


def test_cp05_otro_profesor_no_puede_registrar_el_mismo_doi(monkeypatch, db_session):
    """CP-05 · CA20: la unicidad es de toda la Escuela, no por profesor: un coautor que intenta
    registrar la misma publicación también recibe el rechazo."""
    instalar_directorio(monkeypatch)
    assert _sesion(PROFESOR).post(PRODUCTS_URL, json=PUBLICACION).status_code == 201

    respuesta = _sesion(OTRO_PROFESOR).post(PRODUCTS_URL, json={**PUBLICACION, "doi": DOI.upper()})

    assert respuesta.status_code == 409
    assert _productos(db_session) == 1


def test_cp06_el_codigo_de_proyecto_en_minusculas_tambien_se_rechaza(profesor, db_session):
    """CP-06 · CA20 (proyectos): el código institucional se compara sin distinguir mayúsculas."""
    assert profesor.post(PRODUCTS_URL, json=PROYECTO).status_code == 201

    respuesta = profesor.post(PRODUCTS_URL, json={**PROYECTO, "project_code": "ecmc-2025-07"})

    assert respuesta.status_code == 409
    assert _productos(db_session) == 1


def test_cp07_un_doi_distinto_si_se_registra(profesor, db_session):
    """CP-07 · CA19 (control): la regla no rechaza DOI que solo se parecen."""
    profesor.post(PRODUCTS_URL, json=PUBLICACION)

    respuesta = profesor.post(PRODUCTS_URL, json={**PUBLICACION, "doi": "10.1016/j.jcp.2024.112346"})

    assert respuesta.status_code == 201
    assert _productos(db_session) == 2
