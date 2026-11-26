"""
T-HU05-04 (PGPCECMC-50) - Paginación y optimización de las consultas de lectura del catálogo
consolidado (HU05, tarea de «Base de datos»). Criterio CA15, RNF02 (Rendimiento) y RNF05
(Escalabilidad).

CA15: «Dado que existen muchos productos o ninguno, cuando el usuario consulta el listado,
       entonces el sistema lo presenta paginado dentro de los tiempos de RNF02 o muestra un
       mensaje si no hay productos.»

Qué mide: el tiempo que tarda la consulta pública del catálogo (`GET /products/catalog` y su
detalle) cuando la base ya tiene volumen, con la BD simulada en memoria (SQLite). La paginación
`limit`/`offset` y el orden ya existen (T-HU12-04); esta tarea añade el índice compuesto
`ix_products_catalog` (status, year, created_at, id) que respalda el filtro «verificado» y el
orden descendente, para que la página pedida no obligue a recorrer ni a ordenar la tabla entera.
NO incluye la latencia de red de MySQL; esa parte se mide en el entorno de despliegue.

Escalabilidad (RNF05): cada escenario se mide con una carga base y de nuevo con el doble de
registros; el umbral debe seguir cumpliéndose al duplicar la carga, que es lo que exige PR-HU05-02.

Umbral: el valor de RNF02 no está escrito en Jira ni en el repo. Mientras el equipo lo confirma
se usa el mismo umbral PROVISIONAL de T-HU02-07/T-HU07-06 (p95 <= 500 ms, variable RNF02_P95_MS).
Ejecutar con -s para ver la tabla de tiempos:

    pytest tests/performance/test_t_hu05_04_tiempos.py -s
"""

import os
import statistics
import time
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.product import Product
from app.models.user import User

CATALOG_URL = "/api/v1/products/catalog"

REPETICIONES = int(os.environ.get("RNF02_REPETICIONES", "40"))
UMBRAL_P95_MS = float(os.environ.get("RNF02_P95_MS", "500"))

# Carga base (RNF02) y el doble (RNF05). La página pedida siempre es pequeña; lo que crece es la
# tabla sobre la que se filtra y se ordena, que es justo lo que el índice tiene que absorber.
CARGA_BASE = 200
CARGA_DOBLE = 400
LIMITE = 20

RESULTADOS: dict[str, dict[str, float]] = {}


def _sembrar(db, cantidad: int) -> list[str]:
    """Deja `cantidad` productos VERIFICADOS en la base y devuelve sus ids.

    Se insertan directo en la BD (el catálogo es de lectura pública, no pasa por el flujo de
    revisión) para medir solo la consulta. El año y la fecha de registro se reparten para que el
    orden `year desc, created_at desc` tenga trabajo real que resolver con el índice.
    """
    autor = User(
        username="autor_perf",
        email="autor_perf@yachaytech.edu.ec",
        full_name="Autor de Rendimiento",
        role="professor",
    )
    db.add(autor)
    db.flush()  # asigna autor.id antes de referenciarlo

    inicio = datetime(2024, 1, 1)
    productos = [
        Product(
            owner_id=autor.id,
            school="ECMC",
            type="publicacion",
            title=f"Producción consolidada {i}",
            authors=["María García", "Juan Pérez"],
            year=2000 + (i % 26),
            research_line="Computación científica",
            abstract="Resumen de una obra consolidada de la Escuela.",
            status="verificado",
            source="manual",
            created_at=inicio + timedelta(minutes=i),
        )
        for i in range(cantidad)
    ]
    db.add_all(productos)
    db.commit()
    return [producto.id for producto in productos]


@pytest.fixture
def sembrar_catalogo(db_session):
    """Factoría: siembra el catálogo con la carga pedida y entrega un cliente público y los ids."""

    def _hacer(cantidad: int) -> tuple[TestClient, list[str]]:
        ids = _sembrar(db_session, cantidad)
        return TestClient(app), ids

    return _hacer


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


# CARGA: (cantidad de productos, etiqueta del escenario de RNF). Cada escenario de lectura se
# repite con las dos cargas para comprobar que el umbral aguanta al duplicar el volumen (RNF05).
CARGAS = {
    "base (RNF02)": CARGA_BASE,
    "doble (RNF05)": CARGA_DOBLE,
}


def _peticiones(cliente: TestClient, ids: list[str], cantidad: int) -> dict[str, tuple]:
    """Los tres caminos de lectura de CA15/CA14: primera página, página profunda y detalle."""
    id_muestra = ids[len(ids) // 2]
    return {
        "listado: primera página (CA15)": (
            lambda: cliente.get(CATALOG_URL, params={"limit": LIMITE, "offset": 0}),
            200,
        ),
        # El offset profundo es el peor caso de la paginación por desplazamiento: sin índice obliga
        # a recorrer casi toda la tabla antes de devolver la última página.
        "listado: página profunda (CA15)": (
            lambda: cliente.get(CATALOG_URL, params={"limit": LIMITE, "offset": cantidad - LIMITE}),
            200,
        ),
        "detalle de un producto (CA14)": (
            lambda: cliente.get(f"{CATALOG_URL}/{id_muestra}"),
            200,
        ),
    }


@pytest.mark.parametrize("carga_label", CARGAS.keys())
@pytest.mark.parametrize(
    "escenario",
    ["listado: primera página (CA15)", "listado: página profunda (CA15)", "detalle de un producto (CA14)"],
)
def test_la_lectura_del_catalogo_cumple_el_umbral_de_rnf02(sembrar_catalogo, escenario, carga_label):
    """CP-01 · CA15/CA14 · RNF02/RNF05: cada camino de lectura queda dentro del umbral, y sigue
    dentro al duplicar la carga del catálogo."""
    cantidad = CARGAS[carga_label]
    cliente, ids = sembrar_catalogo(cantidad)
    peticion, codigo = _peticiones(cliente, ids, cantidad)[escenario]

    nombre = f"{escenario} · {carga_label}"
    resumen = _medir(nombre, peticion, codigo)

    assert resumen["p95"] <= UMBRAL_P95_MS, f"{nombre}: p95={resumen['p95']:.1f} ms"


def test_la_paginacion_devuelve_una_pagina_acotada_bajo_carga(sembrar_catalogo):
    """CP-02 · CA15: por muchos productos que haya, la consulta nunca entrega la tabla entera;
    responde `total` con el tamaño real y una sola página de `limit` elementos, ordenada."""
    cliente, _ = sembrar_catalogo(CARGA_BASE)

    cuerpo = cliente.get(CATALOG_URL, params={"limit": LIMITE, "offset": 0}).json()

    assert cuerpo["total"] == CARGA_BASE
    assert len(cuerpo["items"]) == LIMITE
    anios = [item["year"] for item in cuerpo["items"]]
    assert anios == sorted(anios, reverse=True)


def test_un_catalogo_vacio_responde_una_pagina_vacia(db_session):
    """CP-03 · CA15: «o muestra un mensaje si no hay productos». Sin productos verificados la
    consulta no falla: devuelve `total` 0 e `items` vacío, el contrato sobre el que la pantalla
    de HU05 muestra su estado sin resultados."""
    cuerpo = TestClient(app).get(CATALOG_URL).json()

    assert cuerpo["total"] == 0
    assert cuerpo["items"] == []


def teardown_module(_module):
    if not RESULTADOS:
        return
    print(
        f"\n\nT-HU05-04 · tiempos en ms (n={REPETICIONES} por escenario, "
        f"cargas base={CARGA_BASE} y doble={CARGA_DOBLE} productos, "
        f"umbral provisional p95 <= {UMBRAL_P95_MS:.0f} ms)"
    )
    print(f"{'escenario':48} {'p50':>8} {'p95':>8} {'máx':>8}")
    for nombre, r in RESULTADOS.items():
        print(f"{nombre:48} {r['p50']:8.2f} {r['p95']:8.2f} {r['max']:8.2f}")
