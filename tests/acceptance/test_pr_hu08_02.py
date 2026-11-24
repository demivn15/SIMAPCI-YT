"""
PR-HU08-02 (PGPCECMC-114) - Prueba funcional de HU08 "Recibir notificaciones del estado de un
producto". Consulta de notificaciones por profesor sin duplicados.
Criterio: CA24.
Responsable: Camilo Vásquez (tester). Parte de T-HU08-07 (PGPCECMC-70).

Procedimiento (Jira): consultar notificaciones con dos profesores y repetir un mismo cambio de
estado.
Resultado esperado (Jira): cada profesor ve solo las suyas y no se generan duplicados.

Rutas probadas: GET /api/v1/notifications y PATCH /api/v1/notifications/{id}/read (T-HU08-06,
PGPCECMC-69). Los cambios de estado se hacen por la ruta del consejo
PATCH /api/v1/products/{id}/review (T-HU08-05, PGPCECMC-93), igual que en producción.

Servicios simulados: directorio LDAP (sesiones reales de dos profesores). La base de datos es la
SQLite en memoria de tests/conftest.py.
"""

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.main import app
from app.models.user import User
from tests.support.directorio_ldap import OTRO_PROFESOR, PROFESOR, instalar_directorio

LOGIN_URL = "/api/v1/auth/login"
LOGOUT_URL = "/api/v1/auth/logout"
PRODUCTS_URL = "/api/v1/products"
NOTIFICATIONS_URL = "/api/v1/notifications"
MOTIVO = "El DOI no corresponde a la publicación declarada."

CARGADO = "Producto cargado exitosamente"
APROBADO = "Producto aprobado"
RECHAZADO = "Producto rechazado"
IMPORTADO = "Publicación importada y verificada"


def _publicacion(n: int, titulo: str = "Publicación") -> dict:
    return {
        "type": "publicacion",
        "title": f"{titulo} {n}",
        "authors": ["María García"],
        "year": 2025,
        "research_line": "Inteligencia artificial",
        "doi": f"10.1007/s00521-025-{n:05d}-1",
        "venue": "Neural Computing and Applications",
    }


def _sesion(usuario: dict) -> TestClient:
    cliente = TestClient(app)
    respuesta = cliente.post(LOGIN_URL, json={"username": usuario["uid"], "password": usuario["password"]})
    assert respuesta.status_code == 200
    return cliente


@pytest.fixture
def profesores(monkeypatch) -> tuple[TestClient, TestClient]:
    """Dos profesores autenticados contra el directorio simulado: A (mgarcia) y B (jperez)."""
    instalar_directorio(monkeypatch)
    return _sesion(PROFESOR), _sesion(OTRO_PROFESOR)


@pytest.fixture
def consejo(db_session) -> TestClient:
    """Miembro del consejo con sesión (rol 'reviewer'), que es quien cambia los estados."""
    usuario = User(username="consejo1", email="consejo1@yachaytech.edu.ec", full_name="Consejo ECMC", role="reviewer")
    db_session.add(usuario)
    db_session.commit()
    cliente = TestClient(app)
    cliente.cookies.set(
        "access_token", create_access_token({"sub": usuario.username, "user_id": usuario.id, "role": "reviewer"})
    )
    return cliente


def _registrar(cliente: TestClient, n: int) -> str:
    respuesta = cliente.post(PRODUCTS_URL, json=_publicacion(n))
    assert respuesta.status_code == 201
    return respuesta.json()["id"]


def _decidir(consejo: TestClient, producto_id: str, decision: str):
    cuerpo = {"decision": decision, "reason": MOTIVO if decision == "rechazado" else None}
    return consejo.patch(f"{PRODUCTS_URL}/{producto_id}/review", json=cuerpo)


def _consultar(cliente: TestClient, **params) -> dict:
    respuesta = cliente.get(NOTIFICATIONS_URL, params={"limit": 100, **params})
    assert respuesta.status_code == 200
    return respuesta.json()


def _titulos(cliente: TestClient) -> list[str]:
    return sorted(item["title"] for item in _consultar(cliente)["items"])


def test_cp01_cada_profesor_ve_unicamente_sus_notificaciones(profesores):
    """CP-01 · CA24: A registra dos productos y B uno; cada uno ve solo los avisos de sus productos."""
    a, b = profesores
    productos_a = {_registrar(a, 1), _registrar(a, 2)}
    productos_b = {_registrar(b, 3)}

    lista_a, lista_b = _consultar(a), _consultar(b)

    assert lista_a["total"] == 2 and lista_a["unread"] == 2
    assert {item["product_id"] for item in lista_a["items"]} == productos_a
    assert lista_b["total"] == 1 and lista_b["unread"] == 1
    assert {item["product_id"] for item in lista_b["items"]} == productos_b
    assert all("user_id" not in item for item in lista_a["items"] + lista_b["items"])


def test_cp02_sin_sesion_o_tras_cerrarla_no_se_ve_ninguna(profesores):
    """CP-02 · CA24: sin sesión, o después de cerrarla, la consulta responde 401."""
    a, _ = profesores
    _registrar(a, 1)

    assert TestClient(app).get(NOTIFICATIONS_URL).status_code == 401
    assert a.post(LOGOUT_URL).status_code == 200
    assert a.get(NOTIFICATIONS_URL).status_code == 401


def test_cp03_un_profesor_no_puede_marcar_como_leida_la_de_otro(profesores):
    """CP-03 · CA24: B no puede marcar como leído un aviso de A (404, como si no existiera); el
    aviso sigue sin leer para A, y cuando A lo marca, su contador baja."""
    a, b = profesores
    _registrar(a, 1)
    aviso_de_a = _consultar(a)["items"][0]["id"]

    assert b.patch(f"{NOTIFICATIONS_URL}/{aviso_de_a}/read").status_code == 404
    assert _consultar(a)["unread"] == 1

    assert a.patch(f"{NOTIFICATIONS_URL}/{aviso_de_a}/read").status_code == 200
    assert _consultar(a)["unread"] == 0


@pytest.mark.parametrize("decision, titulo", [("verificado", APROBADO), ("rechazado", RECHAZADO)])
def test_cp04_repetir_el_mismo_cambio_de_estado_no_duplica(profesores, consejo, decision, titulo):
    """CP-04 · CA24: el consejo repite la misma decisión sobre el producto de A; la segunda se
    rechaza y A sigue con un solo aviso de ese cambio de estado."""
    a, _ = profesores
    producto = _registrar(a, 1)
    assert _decidir(consejo, producto, decision).status_code == 200

    assert _decidir(consejo, producto, decision).status_code == 400

    assert _titulos(a) == sorted([CARGADO, titulo])


def test_cp05_cambiar_una_decision_ya_tomada_no_agrega_avisos(profesores, consejo):
    """CP-05 · CA24: después de rechazar, intentar aprobar el mismo producto se rechaza y no
    aparece un aviso de «aprobado» que contradiga al de «rechazado»."""
    a, _ = profesores
    producto = _registrar(a, 1)
    assert _decidir(consejo, producto, "rechazado").status_code == 200

    assert _decidir(consejo, producto, "verificado").status_code == 400

    assert _titulos(a) == sorted([CARGADO, RECHAZADO])


def test_cp06_guardar_otra_vez_el_mismo_producto_no_duplica_el_aviso(profesores):
    """CP-06 · CA24: volver a enviar el mismo producto (mismo DOI en otro formato) responde 409 y
    no genera un segundo «cargado exitosamente»."""
    a, _ = profesores
    _registrar(a, 1)
    repetido = {**_publicacion(1), "doi": "https://doi.org/" + _publicacion(1)["doi"].upper()}

    assert a.post(PRODUCTS_URL, json=repetido).status_code == 409

    assert _titulos(a) == [CARGADO]


def test_cp07_reimportar_la_misma_obra_de_orcid_no_duplica_el_aviso(profesores):
    """CP-07 · CA24: importar dos veces la misma obra desde ORCID deja un solo aviso de importación."""
    a, _ = profesores
    obra = {**_publicacion(9), "external_id": "put-code-2001"}
    obra.pop("type")

    assert a.post(f"{PRODUCTS_URL}/orcid-import", json=[obra]).status_code == 200
    assert a.post(f"{PRODUCTS_URL}/orcid-import", json=[obra]).status_code == 200

    assert _titulos(a) == [IMPORTADO]


def test_cp08_la_decision_sobre_un_producto_de_a_no_llega_a_b(profesores, consejo):
    """CP-08 · CA24: las decisiones sobre los productos de A solo cambian la lista de A; la de B
    queda igual."""
    a, b = profesores
    aprobado, rechazado = _registrar(a, 1), _registrar(a, 2)
    _registrar(b, 3)
    antes_b = _consultar(b)

    assert _decidir(consejo, aprobado, "verificado").status_code == 200
    assert _decidir(consejo, rechazado, "rechazado").status_code == 200

    assert _consultar(b) == antes_b
    assert _titulos(a) == sorted([CARGADO, CARGADO, APROBADO, RECHAZADO])


def test_cp09_el_contador_coincide_con_la_lista(profesores, consejo):
    """CP-09 · CA24: tras varios eventos, el contador de no leídas coincide con la lista y baja
    solo con lo que el propio profesor marca como leído."""
    a, _ = profesores
    aprobado, rechazado = _registrar(a, 1), _registrar(a, 2)
    assert _decidir(consejo, aprobado, "verificado").status_code == 200
    assert _decidir(consejo, rechazado, "rechazado").status_code == 200
    lista = _consultar(a)
    assert lista["total"] == lista["unread"] == len(lista["items"]) == 4

    a.patch(f"{NOTIFICATIONS_URL}/{lista['items'][0]['id']}/read")

    despues = _consultar(a)
    assert despues["total"] == 4 and despues["unread"] == 3
    assert _consultar(a, only_unread=True)["total"] == 3
