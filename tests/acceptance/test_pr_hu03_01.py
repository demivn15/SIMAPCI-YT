"""
PR-HU03-01 (PGPCECMC-103) - Prueba de integración de HU03 "Registrar un producto con
autocompletado por identificador". Registro de producto con DOI válido y datos
precargados. Criterios: CA07 y CA09.
Responsable: Camilo Vásquez (tester). Parte de T-HU03-08 (PGPCECMC-39).

Resultado esperado (Jira): los campos se precargan y el producto queda asociado al
profesor con estado «cargado».

Servicios simulados: directorio LDAP (sesión real) y red de Crossref/OpenAlex.
Estado: la precarga (CA07) se puede probar; el guardado (CA09) está BLOQUEADO porque
POST /api/v1/products todavía no existe (T-HU03-03, T-HU03-04 y T-HU03-05:
PGPCECMC-34, 35 y 36, sin terminar).
"""

from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.backend.integration_fixtures import CROSSREF_WORK, DOI, OPENALEX_WORK
from tests.support.directorio_ldap import PROFESOR, instalar_directorio
from tests.support.red_simulada import RedSimulada, estado, instalar_red, json_ok, quitar_red

LOGIN_URL = "/api/v1/auth/login"
DOI_URL = "/api/v1/integrations/doi/"
CAMPOS_DEL_FORMULARIO = {"doi", "title", "authors", "year", "venue", "abstract", "source"}


@pytest.fixture
def profesor(monkeypatch):
    """Profesor autenticado contra el directorio simulado (actor de HU03)."""
    instalar_directorio(monkeypatch)
    cliente = TestClient(app)
    assert cliente.post(
        LOGIN_URL, json={"username": PROFESOR["uid"], "password": PROFESOR["password"]}
    ).status_code == 200
    yield cliente
    quitar_red()


def test_cp01_doi_valido_precarga_los_campos(profesor):
    """CP-01 · CA07: DOI válido y Crossref responde -> se devuelven todos los campos del formulario."""
    red = RedSimulada(crossref=json_ok(CROSSREF_WORK), openalex=estado(500))
    instalar_red(red)

    response = profesor.get(DOI_URL + quote(DOI, safe=""))

    assert response.status_code == 200
    datos = response.json()
    assert set(datos) == CAMPOS_DEL_FORMULARIO
    assert datos["doi"] == DOI
    assert datos["title"] == "Secure Aggregation for Federated Learning & Edge Devices"
    assert datos["authors"] == ["María García", "Juan Pérez", "ECMC Research Group"]
    assert datos["year"] == 2023
    assert datos["venue"].startswith("Proceedings of the 2023 ACM SIGSAC")
    assert "secure aggregation" in datos["abstract"]
    assert "<" not in datos["abstract"]  # sin etiquetas JATS
    assert datos["source"] == "crossref"
    assert red.peticiones["api.openalex.org"] == 0  # no se consulta el respaldo sin necesidad


def test_cp02_doi_en_formato_url_tambien_precarga(profesor):
    """CP-02 · CA07: el profesor pega el DOI como enlace (https://doi.org/...) -> mismo resultado."""
    instalar_red(RedSimulada(crossref=json_ok(CROSSREF_WORK), openalex=estado(500)))

    response = profesor.get(DOI_URL + quote(f"https://doi.org/{DOI.upper()}", safe=""))

    assert response.status_code == 200
    assert response.json()["doi"] == DOI


def test_cp03_si_crossref_no_tiene_el_doi_precarga_desde_openalex(profesor):
    """CP-03 · CA07: Crossref no lo encuentra (404) -> se precarga desde OpenAlex."""
    red = RedSimulada(crossref=estado(404), openalex=json_ok(OPENALEX_WORK))
    instalar_red(red)

    response = profesor.get(DOI_URL + quote(DOI, safe=""))

    assert response.status_code == 200
    assert response.json()["source"] == "openalex"
    assert response.json()["abstract"] == "We propose a protocol."
    assert red.peticiones == {"api.crossref.org": 1, "api.openalex.org": 1}


def test_cp04_sin_sesion_no_hay_autocompletado():
    """CP-04 · HU03 (actor autenticado): sin sesión el autocompletado se deniega (401)."""
    assert TestClient(app).get(DOI_URL + quote(DOI, safe="")).status_code == 401


PRODUCTO = {
    "type": "publicacion",
    "title": "Secure Aggregation for Federated Learning & Edge Devices",
    "authors": ["María García", "Juan Pérez"],
    "year": 2023,
    "research_line": "Ciencias de la computación",
    "abstract": None,
    "doi": DOI,
    "venue": "ACM CCS 2023",
    "project_code": None,
    "project_status": None,
}


@pytest.mark.xfail(
    strict=True,
    reason="BLOQUEADA: POST /api/v1/products no existe en main (responde 404). Depende de "
    "T-HU03-03/04/05 (PGPCECMC-34, 35 y 36, asignadas a Demian Viteri, en 'Tareas por hacer'). "
    "El contrato lo define frontend/src/services/productService.js (201 con status 'cargado').",
)
def test_cp05_producto_confirmado_queda_asociado_con_estado_cargado(profesor):
    """CP-05 · CA09: al guardar el producto precargado -> 201, estado «cargado», dueño = profesor."""
    response = profesor.post("/api/v1/products", json=PRODUCTO)

    assert response.status_code == 201
    assert response.json()["status"] == "cargado"
