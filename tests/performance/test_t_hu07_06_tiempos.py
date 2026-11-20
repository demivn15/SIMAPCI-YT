"""
T-HU07-06 (PGPCECMC-64) - Tiempo de respuesta de la verificación de existencia (HU07, RNF02).
Responsable: Camilo Vásquez (tester).

Qué mide: el tiempo que agrega la API (FastAPI + JWT + BD) al consultar si un producto ya
existe y al rechazar un duplicado, con el directorio LDAP y la BD simulados en memoria. NO
incluye la latencia de red de MySQL; esa parte se mide en el entorno de despliegue.

Umbral: el mismo umbral PROVISIONAL de T-HU02-07 (p95 <= 500 ms, variable RNF02_P95_MS)
mientras el equipo confirma el valor de RNF02. Para medir con una base con datos, antes de
cronometrar se registran PRODUCTOS_PREVIOS publicaciones. Ejecutar con -s para ver la tabla:

    pytest tests/performance/test_t_hu07_06_tiempos.py -s
"""

import os
import statistics
import time

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.support.directorio_ldap import PROFESOR, instalar_directorio

REPETICIONES = int(os.environ.get("RNF02_REPETICIONES", "60"))
UMBRAL_P95_MS = float(os.environ.get("RNF02_P95_MS", "500"))
PRODUCTOS_PREVIOS = 100

DOI = "10.1016/j.jcp.2024.112345"
PUBLICACION = {
    "type": "publicacion",
    "title": "Métodos espectrales para ecuaciones de reacción-difusión",
    "authors": ["María García"],
    "year": 2024,
    "research_line": "Computación científica",
    "doi": DOI,
}

RESULTADOS: dict[str, dict[str, float]] = {}


def _medir(nombre: str, peticion, codigo_esperado: int) -> dict[str, float]:
    peticion()  # calentamiento: la primera llamada carga módulos y crea conexiones
    tiempos = []
    for _ in range(REPETICIONES):
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
def profesor(monkeypatch, db_session) -> TestClient:
    """Profesor con sesión y una base con PRODUCTOS_PREVIOS publicaciones más el DOI de prueba."""
    instalar_directorio(monkeypatch)
    cliente = TestClient(app)
    assert cliente.post(
        "/api/v1/auth/login", json={"username": PROFESOR["uid"], "password": PROFESOR["password"]}
    ).status_code == 200
    for i in range(PRODUCTOS_PREVIOS):
        relleno = {**PUBLICACION, "title": f"Publicación de relleno {i}", "doi": f"10.5555/relleno.{i}"}
        assert cliente.post("/api/v1/products", json=relleno).status_code == 201
    assert cliente.post("/api/v1/products", json=PUBLICACION).status_code == 201
    return cliente


ESCENARIOS = {
    "consulta: DOI existente (CA20)": (lambda c: c.get("/api/v1/products/exists", params={"doi": DOI.upper()}), 200),
    "consulta: DOI nuevo (CA19)": (lambda c: c.get("/api/v1/products/exists", params={"doi": "10.9999/nuevo"}), 200),
    "consulta: sin identificador (CA21)": (lambda c: c.get("/api/v1/products/exists"), 200),
    "consulta sin sesión": (lambda c: TestClient(app).get("/api/v1/products/exists", params={"doi": DOI}), 401),
    "guardado duplicado rechazado (CA20)": (
        lambda c: c.post("/api/v1/products", json={**PUBLICACION, "doi": f"https://doi.org/{DOI}"}), 409),
}


@pytest.mark.parametrize("nombre", ESCENARIOS.keys())
def test_tiempo_de_respuesta_dentro_del_umbral(profesor, nombre):
    peticion, codigo = ESCENARIOS[nombre]

    resumen = _medir(nombre, lambda: peticion(profesor), codigo)

    assert resumen["p95"] <= UMBRAL_P95_MS, f"{nombre}: p95={resumen['p95']:.1f} ms"


def teardown_module(_module):
    if not RESULTADOS:
        return
    print(
        f"\n\nT-HU07-06 · tiempos en ms (n={REPETICIONES} por escenario, {PRODUCTOS_PREVIOS + 1} productos en la base, "
        f"umbral provisional p95 <= {UMBRAL_P95_MS:.0f} ms)"
    )
    print(f"{'escenario':40} {'p50':>8} {'p95':>8} {'máx':>8}")
    for nombre, r in RESULTADOS.items():
        print(f"{nombre:40} {r['p50']:8.2f} {r['p95']:8.2f} {r['max']:8.2f}")
