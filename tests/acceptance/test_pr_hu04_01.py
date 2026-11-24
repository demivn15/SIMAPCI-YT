"""
PR-HU04-01 (PGPCECMC-105) - Prueba funcional de HU04 "Autocompletar un proyecto de
investigación desde su PDF". Carga de PDF de proyecto y revisión de campos precargados.
Criterios: CA10 y CA12.
Responsable: Camilo Vásquez (tester). Parte de T-HU04-07 (PGPCECMC-46).

Procedimiento (Jira): cargar un PDF de proyecto representativo y revisar los campos precargados.
Resultado esperado (Jira): se precargan los campos identificables y el profesor puede
corregirlos antes de guardar.

Rutas probadas: POST /api/v1/integrations/upload (T-HU04-03, T-HU04-04 y T-HU04-05) y, para
guardar lo revisado, POST /api/v1/products (HU03). La parte de la pantalla (marca «Precargado»,
corrección y confirmación) está en frontend/src/pages/RegisterProductPage.pr-hu04-01.test.jsx.

Campos esperados (T-HU04-02, PGPCECMC-41): título, código del proyecto, participantes, año y
resumen; la línea de investigación como sugerencia; el estado del proyecto lo elige el profesor.
El PDF representativo es PORTADA_PROYECTO de tests/support/portadas_proyecto.py.

Servicios simulados: directorio LDAP (sesión real del profesor). La base de datos es la SQLite en
memoria de tests/conftest.py.
"""

import io

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.notification import Notification
from app.models.product import Product
from tests.support.directorio_ldap import PROFESOR, instalar_directorio
from tests.support.portadas_proyecto import (
    ANIO,
    CODIGO,
    INTEGRANTES,
    INVESTIGADOR_PRINCIPAL,
    LINEA,
    PORTADA_PROYECTO,
    RESUMEN,
    TITULO,
    pdf_de_paginas,
)

LOGIN_URL = "/api/v1/auth/login"
UPLOAD_URL = "/api/v1/integrations/upload"
PRODUCTS_URL = "/api/v1/products"

# Hallazgos que JHONY reportó en PGPCECMC-40 (23/11) y que estas pruebas dejan documentados.
DEFECTO_D11 = (
    "DEFECTO D-11 (T-HU04-04, PGPCECMC-43): el patrón del año en app/utils/pdf_extractor.py es "
    "20[0-2][0-6], así que no reconoce 2007-2009, 2017-2019 ni desde 2027."
)
DEFECTO_D12 = (
    "DEFECTO D-12 (T-HU04-04, PGPCECMC-43): el extractor no identifica el código del proyecto, "
    "uno de los campos definidos en T-HU04-02, aunque la portada diga «Código del proyecto: ...»."
)
DEFECTO_D13 = (
    "DEFECTO D-13 (T-HU04-04, PGPCECMC-43): el extractor no sugiere la línea de investigación "
    "aunque la portada traiga una línea oficial; research_line siempre llega vacío."
)
DEFECTO_D14 = (
    "DEFECTO D-14 (T-HU04-04, PGPCECMC-43): los participantes solo se toman de «Autores» o "
    "«Integrantes»; el investigador principal de la portada se pierde."
)


def _sesion() -> TestClient:
    cliente = TestClient(app)
    respuesta = cliente.post(LOGIN_URL, json={"username": PROFESOR["uid"], "password": PROFESOR["password"]})
    assert respuesta.status_code == 200
    return cliente


@pytest.fixture
def profesor(monkeypatch) -> TestClient:
    """Profesor autenticado contra el directorio simulado (actor de HU04)."""
    instalar_directorio(monkeypatch)
    return _sesion()


def _cargar(cliente: TestClient, paginas: list[list[str]]) -> dict:
    archivo = ("proyecto.pdf", io.BytesIO(pdf_de_paginas(paginas)), "application/pdf")
    respuesta = cliente.post(UPLOAD_URL, files={"file": archivo})
    assert respuesta.status_code == 200
    return respuesta.json()


def test_cp01_el_pdf_representativo_precarga_titulo_anio_y_resumen(profesor):
    """CP-01 · CA10: el PDF del proyecto se acepta y precarga el título, el año y el resumen tal
    como aparecen en la portada."""
    campos = _cargar(profesor, [PORTADA_PROYECTO])["extracted_fields"]

    assert campos["title"] == TITULO
    assert campos["year"] == ANIO
    assert campos["abstract"] == RESUMEN


@pytest.mark.xfail(strict=True, reason=DEFECTO_D14)
def test_cp02_se_precargan_todos_los_participantes(profesor):
    """CP-02 · CA10: los participantes precargados incluyen al investigador principal y a los
    integrantes."""
    participantes = _cargar(profesor, [PORTADA_PROYECTO])["extracted_fields"]["authors"]

    for nombre in [INVESTIGADOR_PRINCIPAL, *INTEGRANTES]:
        assert nombre in participantes


@pytest.mark.xfail(strict=True, reason=DEFECTO_D12)
def test_cp03_se_precarga_el_codigo_del_proyecto(profesor):
    """CP-03 · CA10: el código institucional que trae la portada se precarga."""
    campos = _cargar(profesor, [PORTADA_PROYECTO])["extracted_fields"]

    assert campos.get("project_code", "").upper() == CODIGO


@pytest.mark.xfail(strict=True, reason=DEFECTO_D13)
def test_cp04_se_sugiere_la_linea_de_investigacion(profesor):
    """CP-04 · CA10: si la portada nombra una línea oficial de la Escuela, se sugiere."""
    campos = _cargar(profesor, [PORTADA_PROYECTO])["extracted_fields"]

    assert LINEA in campos["research_line"]


@pytest.mark.parametrize(
    "anio",
    [
        "2016",
        "2024",
        pytest.param("2009", marks=pytest.mark.xfail(strict=True, reason=DEFECTO_D11)),
        pytest.param("2018", marks=pytest.mark.xfail(strict=True, reason=DEFECTO_D11)),
        pytest.param("2019", marks=pytest.mark.xfail(strict=True, reason=DEFECTO_D11)),
    ],
)
def test_cp05_se_precarga_el_anio_de_inicio(profesor, anio):
    """CP-05 · CA10: el año de inicio se precarga sea cual sea (proyectos de 2000 al año actual)."""
    portada = [TITULO, f"Investigador principal: {INVESTIGADOR_PRINCIPAL}", f"Año de inicio: {anio}"]

    assert _cargar(profesor, [portada])["extracted_fields"]["year"] == anio


def test_cp06_lo_no_identificado_queda_vacio_y_se_informa(profesor):
    """CP-06 · CA10: lo que no se identifica llega vacío (no se inventa) y el reporte lo nombra
    como faltante; el estado del proyecto no se extrae porque lo elige el profesor."""
    respuesta = _cargar(profesor, [PORTADA_PROYECTO])
    campos, reporte = respuesta["extracted_fields"], respuesta["extraction"]

    assert reporte["status"] in ("parcial", "completa")
    assert set(reporte["fields_found"]) == {nombre for nombre, valor in campos.items() if valor}
    assert set(reporte["fields_missing"]) == {nombre for nombre, valor in campos.items() if not valor}
    assert all(campos[nombre] == "" for nombre in reporte["fields_missing"])
    assert "project_status" not in campos


def test_cp07_cargar_el_pdf_no_guarda_nada(profesor, db_session):
    """CP-07 · CA12: cargar el PDF solo precarga; no crea el producto ni envía avisos."""
    _cargar(profesor, [PORTADA_PROYECTO])

    assert db_session.query(Product).count() == 0
    assert db_session.query(Notification).count() == 0


def test_cp08_se_guarda_lo_que_el_profesor_corrigio_y_confirmo(profesor, db_session):
    """CP-08 · CA12: el profesor corrige lo precargado, completa lo que falta y confirma; se
    guarda lo corregido, no lo extraído."""
    campos = _cargar(profesor, [PORTADA_PROYECTO])["extracted_fields"]
    titulo_corregido = f"{campos['title']} - fase 2"
    revisado = {
        "type": "proyecto",
        "title": titulo_corregido,
        "authors": [INVESTIGADOR_PRINCIPAL, *INTEGRANTES],
        "year": int(campos["year"]),
        "research_line": LINEA,
        "abstract": campos["abstract"],
        "project_code": CODIGO,
        "project_status": "activo",
    }

    respuesta = profesor.post(PRODUCTS_URL, json=revisado)

    assert respuesta.status_code == 201
    guardado = db_session.get(Product, respuesta.json()["id"])
    assert guardado.title == titulo_corregido != campos["title"]
    assert guardado.authors == [INVESTIGADOR_PRINCIPAL, *INTEGRANTES]
    assert guardado.project_code == CODIGO
