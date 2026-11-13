"""
T-HU02-07 (PGPCECMC-31) - Tiempo de respuesta de autenticación y autorización (RNF02).
Responsable: Camilo Vásquez (tester).

Qué mide: el tiempo que agrega la API (FastAPI + JWT + BD) en cada operación de HU02,
con el directorio LDAP y la BD simulados en memoria. NO incluye la latencia de red del
LDAP institucional ni de MySQL; esa parte se mide en el entorno de despliegue.

Umbral: el valor de RNF02 no está escrito en Jira ni en el repo. Mientras el equipo lo
confirma se usa un umbral PROVISIONAL de p95 <= 500 ms, configurable con la variable
de entorno RNF02_P95_MS. Ejecutar con -s para ver la tabla de tiempos:

    pytest tests/performance -s
"""

import os
import statistics
import time
from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.backend.integration_fixtures import CROSSREF_WORK, DOI
from tests.support.directorio_ldap import PROFESOR, instalar_directorio
from tests.support.red_simulada import RedSimulada, estado, instalar_red, json_ok, quitar_red

REPETICIONES = int(os.environ.get("RNF02_REPETICIONES", "60"))
UMBRAL_P95_MS = float(os.environ.get("RNF02_P95_MS", "500"))

RESULTADOS: dict[str, dict[str, float]] = {}


def _medir(nombre: str, peticion, codigo_esperado: int, preparar=lambda: None) -> dict[str, float]:
    preparar()
    peticion()  # calentamiento: la primera llamada carga módulos y crea conexiones
    tiempos = []
    for _ in range(REPETICIONES):
        preparar()  # lo que haga falta antes de la petición; no se cronometra
        inicio = time.perf_counter()
        response = peticion()
        tiempos.append((time.perf_counter() - inicio) * 1000)
        assert response.status_code == codigo_esperado, f"{nombre}: {response.status_code}"
    tiempos.sort()
    resumen = {
        "n": len(tiempos),
        "p50": statistics.median(tiempos),
        "p95": tiempos[int(0.95 * (len(tiempos) - 1))],
        "max": tiempos[-1],
    }
    RESULTADOS[nombre] = resumen
    return resumen


@pytest.fixture
def entorno(monkeypatch):
    instalar_directorio(monkeypatch)
    instalar_red(RedSimulada(crossref=json_ok(CROSSREF_WORK), openalex=estado(500)))
    yield
    quitar_red()


def _login(cliente, password=PROFESOR["password"]):
    return cliente.post("/api/v1/auth/login", json={"username": PROFESOR["uid"], "password": password})


ESCENARIOS = {
    "login válido (CA04)": (lambda c: _login(c), 200),
    "login inválido (CA05)": (lambda c: _login(c, "incorrecta"), 401),
    "función privada con sesión (CA04)": (lambda c: c.get("/api/v1/auth/me"), 200),
    "función privada sin sesión (CA06)": (lambda c: TestClient(app).get("/api/v1/auth/me"), 401),
    "autocompletado DOI con sesión": (
        lambda c: c.get("/api/v1/integrations/doi/" + quote(DOI, safe="")), 200),
    "cierre de sesión (CA06)": (lambda c: c.post("/api/v1/auth/logout"), 200),
}


@pytest.mark.parametrize("nombre", ESCENARIOS.keys())
def test_tiempo_de_respuesta_dentro_del_umbral(entorno, nombre):
    peticion, codigo = ESCENARIOS[nombre]
    cliente = TestClient(app)
    assert _login(cliente).status_code == 200
    # Cada cierre de sesión necesita una sesión abierta; ese login previo no se cronometra
    preparar = (lambda: _login(cliente)) if nombre == "cierre de sesión (CA06)" else (lambda: None)

    resumen = _medir(nombre, lambda: peticion(cliente), codigo, preparar)

    assert resumen["p95"] <= UMBRAL_P95_MS, f"{nombre}: p95={resumen['p95']:.1f} ms"


def teardown_module(_module):
    if not RESULTADOS:
        return
    print(f"\n\nT-HU02-07 · tiempos en ms (n={REPETICIONES} por escenario, umbral provisional p95 <= {UMBRAL_P95_MS:.0f} ms)")
    print(f"{'escenario':40} {'p50':>8} {'p95':>8} {'máx':>8}")
    for nombre, r in RESULTADOS.items():
        print(f"{nombre:40} {r['p50']:8.2f} {r['p95']:8.2f} {r['max']:8.2f}")
