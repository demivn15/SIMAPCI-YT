"""
PR-HU07-02 (PGPCECMC-112) - Prueba funcional de HU07 "Validar la existencia de un producto
antes de agregarlo". Registro de producto sin DOI ni código de proyecto. Criterio: CA21.
Responsable: Camilo Vásquez (tester). Parte de T-HU07-06 (PGPCECMC-64).

Procedimiento (Jira): registrar un producto sin DOI ni código de proyecto.
Resultado esperado (Jira): el registro continúa con el aviso de que la verificación no pudo
realizarse.

Este archivo cubre el backend (POST /api/v1/products). El aviso en pantalla se prueba en
frontend/src/pages/RegisterProductPage.hu07.test.jsx.

Nota de diseño: un proyecto siempre exige su código institucional (validación de HU03), así que
«sin identificador» solo aplica a publicaciones sin DOI (CP-05 lo deja documentado).
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.product import Product
from tests.support.directorio_ldap import PROFESOR, instalar_directorio

LOGIN_URL = "/api/v1/auth/login"
PRODUCTS_URL = "/api/v1/products"

SIN_DOI = {
    "type": "publicacion",
    "title": "Notas de clase de análisis numérico",
    "authors": ["María García"],
    "year": 2024,
    "research_line": "Computación científica",
    "venue": "Repositorio institucional ECMC",
}


@pytest.fixture
def profesor(monkeypatch) -> TestClient:
    """Profesor autenticado contra el directorio simulado (actor de HU07)."""
    instalar_directorio(monkeypatch)
    cliente = TestClient(app)
    respuesta = cliente.post(LOGIN_URL, json={"username": PROFESOR["uid"], "password": PROFESOR["password"]})
    assert respuesta.status_code == 200
    return cliente


def test_cp01_una_publicacion_sin_doi_se_registra(profesor, db_session):
    """CP-01 · CA21: sin DOI el sistema permite continuar: el producto se guarda en estado «cargado»."""
    respuesta = profesor.post(PRODUCTS_URL, json=SIN_DOI)

    assert respuesta.status_code == 201
    datos = respuesta.json()
    assert datos["doi"] is None
    assert datos["status"] == "cargado"
    assert db_session.query(Product).count() == 1


@pytest.mark.parametrize("doi_vacio", ["", "   "], ids=["vacio", "solo-espacios"])
def test_cp02_un_doi_vacio_cuenta_como_sin_doi(profesor, db_session, doi_vacio):
    """CP-02 · CA21: un campo DOI vacío o con espacios se trata como «sin DOI», no como un DOI inválido."""
    respuesta = profesor.post(PRODUCTS_URL, json={**SIN_DOI, "doi": doi_vacio})

    assert respuesta.status_code == 201
    assert respuesta.json()["doi"] is None


def test_cp03_varias_publicaciones_sin_doi_no_chocan_entre_si(profesor, db_session):
    """CP-03 · CA21: como no hay identificador, no se puede verificar la existencia; dos productos
    sin DOI no se rechazan como duplicados."""
    assert profesor.post(PRODUCTS_URL, json=SIN_DOI).status_code == 201

    segundo = profesor.post(PRODUCTS_URL, json={**SIN_DOI, "title": "Guía de laboratorio de métodos numéricos"})

    assert segundo.status_code == 201
    assert db_session.query(Product).count() == 2


def test_cp04_sin_doi_igual_se_validan_los_campos_obligatorios(profesor, db_session):
    """CP-04 · CA21 (control): continuar sin DOI no salta las demás validaciones del formulario."""
    respuesta = profesor.post(PRODUCTS_URL, json={**SIN_DOI, "title": "   "})

    assert respuesta.status_code == 422
    assert db_session.query(Product).count() == 0


def test_cp05_un_proyecto_sin_codigo_no_se_registra(profesor, db_session):
    """CP-05 · Diseño de HU03: un proyecto siempre necesita su código institucional, así que el caso
    «sin identificador» de CA21 solo aplica a publicaciones."""
    proyecto = {
        "type": "proyecto",
        "title": "Proyecto sin código",
        "authors": ["María García"],
        "year": 2025,
        "research_line": "Ciencia de datos",
        "project_status": "activo",
    }

    respuesta = profesor.post(PRODUCTS_URL, json=proyecto)

    assert respuesta.status_code == 422
    assert db_session.query(Product).count() == 0
