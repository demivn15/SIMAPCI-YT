"""
PR-HU03-02 (PGPCECMC-104) - Prueba de resiliencia de HU03.
Caída del servicio externo durante el autocompletado. Criterio: CA08.
Responsable: Camilo Vásquez (tester). Parte de T-HU03-08 (PGPCECMC-39).

Resultado esperado (Jira): el sistema informa el problema, permite el registro manual
y no pierde los datos ingresados.

Este archivo cubre el lado del backend (cómo informa la falla). La parte de
"permite el registro manual y no pierde los datos" es de la pantalla y se prueba en
frontend/src/pages/RegisterProductPage.test.jsx.
"""

from urllib.parse import quote

import httpx2
import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.backend.integration_fixtures import DOI
from tests.support.directorio_ldap import PROFESOR, instalar_directorio
from tests.support.red_simulada import RedSimulada, estado, instalar_red, lanza, quitar_red

LOGIN_URL = "/api/v1/auth/login"
URL = "/api/v1/integrations/doi/" + quote(DOI, safe="")


@pytest.fixture
def profesor(monkeypatch):
    instalar_directorio(monkeypatch)
    cliente = TestClient(app)
    assert cliente.post(
        LOGIN_URL, json={"username": PROFESOR["uid"], "password": PROFESOR["password"]}
    ).status_code == 200
    yield cliente
    quitar_red()


CAIDAS = {
    "tiempo de espera agotado": lanza(httpx2.ReadTimeout),
    "sin conexión": lanza(httpx2.ConnectError),
    "error 500": estado(500),
    "error 503": estado(503),
    "demasiadas peticiones 429": estado(429),
}


@pytest.mark.parametrize("falla", CAIDAS.values(), ids=CAIDAS.keys())
def test_cp01_ambos_servicios_caidos_se_informa_con_503(profesor, falla):
    """CP-01 · CA08: Crossref y OpenAlex caídos -> 503 con mensaje claro en español."""
    instalar_red(RedSimulada(crossref=falla, openalex=falla))

    response = profesor.get(URL)

    assert response.status_code == 503
    assert "no están disponibles" in response.json()["detail"]


def test_cp02_mensaje_de_caida_no_expone_detalles_internos(profesor):
    """CP-02 · CA08: el mensaje no muestra URLs, proveedores ni trazas internas."""
    instalar_red(RedSimulada(crossref=lanza(httpx2.ConnectError), openalex=estado(500)))

    detalle = profesor.get(URL).json()["detail"].lower()

    assert "http" not in detalle and "crossref" not in detalle and "traceback" not in detalle


def test_cp03_una_caida_no_se_confunde_con_doi_inexistente(profesor):
    """CP-03 · CA08: Crossref caído y OpenAlex sin datos -> 503 (no se afirma que el DOI no exista)."""
    instalar_red(RedSimulada(crossref=lanza(httpx2.ReadTimeout), openalex=estado(404)))

    assert profesor.get(URL).status_code == 503


def test_cp04_doi_sin_datos_se_informa_con_404(profesor):
    """CP-04 · CA08: el identificador no devuelve datos en ningún servicio -> 404 con mensaje."""
    instalar_red(RedSimulada(crossref=estado(404), openalex=estado(404)))

    response = profesor.get(URL)

    assert response.status_code == 404
    assert "No se encontraron datos" in response.json()["detail"]


def test_cp05_respuesta_corrupta_se_trata_como_servicio_no_disponible(profesor):
    """CP-05 · CA08: el servicio responde algo que no es JSON -> 503, sin error interno."""
    no_json = lambda request: httpx2.Response(200, text="<html>Mantenimiento</html>")  # noqa: E731
    instalar_red(RedSimulada(crossref=no_json, openalex=no_json))

    assert profesor.get(URL).status_code == 503
