"""
PR-HU12-02 (PGPCECMC-122) - Prueba de HU12 "Consolidar publicaciones de ORCID y manuales
revisadas". Aprobación y rechazo de publicaciones manuales. Criterios: CA35 y CA36.
Responsable: Camilo Vásquez (tester).

Procedimiento y resultado esperado (Jira): enviar dos publicaciones manuales; aprobar una y
rechazar otra: solo la aprobada entra al catálogo y ambas decisiones quedan registradas y
notificadas.

«Catálogo consolidado» = productos en estado «verificado» (regla propuesta en HU12). Las
pendientes y rechazadas se conservan para seguimiento, fuera del catálogo.

Servicios simulados: directorio LDAP (sesión real del profesor). Las decisiones del consejo se
toman con ProductService (la misma lógica que usa la API); la ruta HTTP con un consejero real se
prueba en CP-07 y hoy falla por el defecto D-05.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.notification import Notification
from app.models.product import Product
from app.models.user import User
from app.services.product_service import ProductService
from tests.support.directorio_ldap import PROFESOR, instalar_directorio

LOGIN_URL = "/api/v1/auth/login"
PRODUCTS_URL = "/api/v1/products"
MOTIVO = "La revista no está indexada en las bases aceptadas por la ECMC."

BASE = {
    "type": "publicacion",
    "authors": ["María García"],
    "year": 2025,
    "research_line": "Ciencia de datos",
}
A_APROBAR = {**BASE, "title": "Análisis de datos educativos en la ECMC", "doi": "10.5555/ecmc.2025.001"}
A_RECHAZAR = {**BASE, "title": "Encuesta exploratoria sin revisión por pares", "doi": "10.5555/ecmc.2025.002"}


@pytest.fixture
def consejero(db_session) -> User:
    """Miembro autorizado del consejo (rol 'reviewer')."""
    usuario = User(username="consejo1", email="consejo1@yachaytech.edu.ec", full_name="Consejo ECMC", role="reviewer")
    db_session.add(usuario)
    db_session.commit()
    return usuario


@pytest.fixture
def enviadas(monkeypatch, db_session) -> tuple[Product, Product]:
    """El profesor envía dos publicaciones manuales por la API."""
    instalar_directorio(monkeypatch)
    profesor = TestClient(app)
    assert profesor.post(
        LOGIN_URL, json={"username": PROFESOR["uid"], "password": PROFESOR["password"]}
    ).status_code == 200
    ids = []
    for publicacion in (A_APROBAR, A_RECHAZAR):
        respuesta = profesor.post(PRODUCTS_URL, json=publicacion)
        assert respuesta.status_code == 201
        ids.append(respuesta.json()["id"])
    return db_session.get(Product, ids[0]), db_session.get(Product, ids[1])


@pytest.fixture
def decididas(enviadas, consejero, db_session) -> tuple[Product, Product]:
    """El consejo aprueba la primera y rechaza la segunda."""
    aprobada, rechazada = enviadas
    ProductService.review_product(db=db_session, product_id=aprobada.id, reviewer=consejero, decision="verificado")
    ProductService.review_product(
        db=db_session, product_id=rechazada.id, reviewer=consejero, decision="rechazado", reason=MOTIVO
    )
    db_session.expire_all()
    return db_session.get(Product, aprobada.id), db_session.get(Product, rechazada.id)


def _catalogo(db_session) -> list[Product]:
    db_session.expire_all()
    return db_session.query(Product).filter_by(status="verificado").all()


def test_cp01_las_manuales_quedan_pendientes_y_fuera_del_catalogo(enviadas, consejero, db_session):
    """CP-01 · CA35: al enviarlas quedan «cargado» (pendientes), en la cola del consejo y fuera del catálogo."""
    for producto in enviadas:
        assert producto.status == "cargado"
        assert producto.source == "manual"

    cola = ProductService.get_pending_queue(db_session, consejero)

    assert {p.id for p in cola} == {p.id for p in enviadas}
    assert _catalogo(db_session) == []


def test_cp02_la_aprobacion_registra_decision_responsable_y_fecha(decididas, consejero):
    """CP-02 · CA36: la aprobada queda «verificado» con quién y cuándo la revisó."""
    aprobada, _ = decididas

    assert aprobada.status == "verificado"
    assert aprobada.reviewed_by == consejero.id
    assert aprobada.reviewed_at is not None
    assert aprobada.review_reason is None


def test_cp03_el_rechazo_registra_decision_responsable_fecha_y_motivo(decididas, consejero):
    """CP-03 · CA36: la rechazada queda «rechazado» con responsable, fecha y motivo."""
    _, rechazada = decididas

    assert rechazada.status == "rechazado"
    assert rechazada.reviewed_by == consejero.id
    assert rechazada.reviewed_at is not None
    assert rechazada.review_reason == MOTIVO


def test_cp04_solo_la_aprobada_entra_al_catalogo(decididas, consejero, db_session):
    """CP-04 · CA36: el catálogo consolidado tiene solo la aprobada; la rechazada se conserva para
    seguimiento pero fuera del catálogo, y la cola del consejo queda vacía."""
    aprobada, rechazada = decididas

    assert [p.id for p in _catalogo(db_session)] == [aprobada.id]
    assert db_session.get(Product, rechazada.id) is not None
    assert ProductService.get_pending_queue(db_session, consejero) == []


def test_cp05_ambas_decisiones_se_notifican_al_profesor(decididas, db_session):
    """CP-05 · CA36 con HU08: el profesor recibe una notificación por cada decisión."""
    aprobada, rechazada = decididas

    def avisos(producto: Product) -> list[str]:
        return [n.title.lower() for n in db_session.query(Notification).filter_by(product_id=producto.id)]

    assert sum("aprobado" in t for t in avisos(aprobada)) == 1
    assert sum("rechazado" in t for t in avisos(rechazada)) == 1


def test_cp06_una_decision_ya_tomada_no_se_puede_cambiar(decididas, consejero, db_session):
    """CP-06 · CA36: una publicación ya revisada no vuelve a revisarse (la decisión queda firme)."""
    _, rechazada = decididas

    with pytest.raises(Exception):
        ProductService.review_product(db=db_session, product_id=rechazada.id, reviewer=consejero, decision="verificado")

    db_session.expire_all()
    assert db_session.get(Product, rechazada.id).status == "rechazado"


# DEFECTO D-05 corregido en T-HU08-05 (PGPCECMC-93): las rutas de revisión exigen rol 'reviewer'
# en el token, que es el que lleva un consejero al iniciar sesión con su cuenta.
def test_cp07_el_consejero_aprueba_por_la_api(monkeypatch, enviadas, consejero):
    """CP-07 · CA36 de punta a punta: el consejero inicia sesión y aprueba por la API."""
    instalar_directorio(monkeypatch)
    # El consejero entra con su cuenta institucional; su cuenta ya tiene rol 'reviewer'
    monkeypatch.setattr(
        "app.services.ldap_service.LDAPService.authenticate_and_authorize_professor",
        classmethod(lambda cls, username, password: {
            "username": consejero.username, "full_name": consejero.full_name, "email": consejero.email,
        }),
    )
    cliente = TestClient(app)
    assert cliente.post(LOGIN_URL, json={"username": consejero.username, "password": "x"}).status_code == 200

    respuesta = cliente.patch(f"{PRODUCTS_URL}/{enviadas[0].id}/review", json={"decision": "verificado"})

    assert respuesta.status_code == 200
    assert respuesta.json()["status"] == "verificado"
