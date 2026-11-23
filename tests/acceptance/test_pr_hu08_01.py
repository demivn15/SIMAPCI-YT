"""
PR-HU08-01 (PGPCECMC-113) - Prueba de integración de HU08 "Recibir notificaciones del estado
de un producto". Notificación por cambio de estado a verificado y rechazado.
Criterios: CA22 y CA23 (y la parte de CA24 «cada cambio de estado genera una sola notificación»).
Responsable: Camilo Vásquez (tester). Parte de T-HU08-07 (PGPCECMC-70).

Procedimiento (Jira): registrar un producto y cambiar su estado a verificado y a rechazado,
observando el canal configurado.
Resultado esperado (Jira): se genera una notificación por cada cambio de estado, con el motivo
en el rechazo.

Canal del prototipo: la tabla `notifications` (app/models/notification.py).
Servicios simulados: directorio LDAP (sesión real del profesor). El cambio de estado se hace con
ProductService.review_product, que es lo que usa la ruta del consejo; la ruta HTTP se prueba
aparte en CP-08.
"""

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.main import app
from app.models.notification import Notification
from app.models.product import Product
from app.models.user import User
from app.services.product_service import ProductError, ProductService
from tests.support.directorio_ldap import OTRO_PROFESOR, PROFESOR, instalar_directorio

LOGIN_URL = "/api/v1/auth/login"
PRODUCTS_URL = "/api/v1/products"
MOTIVO = "El DOI no corresponde a la publicación declarada."

PUBLICACION = {
    "type": "publicacion",
    "title": "Redes neuronales para series de tiempo climáticas",
    "authors": ["María García"],
    "year": 2025,
    "research_line": "Inteligencia artificial",
    "doi": "10.1007/s00521-025-11111-1",
    "venue": "Neural Computing and Applications",
}


def _sesion(usuario: dict) -> TestClient:
    cliente = TestClient(app)
    respuesta = cliente.post(LOGIN_URL, json={"username": usuario["uid"], "password": usuario["password"]})
    assert respuesta.status_code == 200
    return cliente


@pytest.fixture
def profesor(monkeypatch) -> TestClient:
    """Profesor autenticado contra el directorio simulado (actor de HU08)."""
    instalar_directorio(monkeypatch)
    return _sesion(PROFESOR)


@pytest.fixture
def consejero(db_session) -> User:
    """Miembro del consejo que revisa los productos (rol 'reviewer')."""
    usuario = User(username="consejo1", email="consejo1@yachaytech.edu.ec", full_name="Consejo ECMC", role="reviewer")
    db_session.add(usuario)
    db_session.commit()
    return usuario


@pytest.fixture
def producto(profesor, db_session) -> Product:
    """Producto registrado por el profesor, en estado 'cargado'."""
    respuesta = profesor.post(PRODUCTS_URL, json=PUBLICACION)
    assert respuesta.status_code == 201
    return db_session.get(Product, respuesta.json()["id"])


def _notificaciones(db_session, user_id: str) -> list[Notification]:
    db_session.expire_all()
    return db_session.query(Notification).filter_by(user_id=user_id).order_by(Notification.created_at).all()


def _revisar(db_session, producto: Product, consejero: User, decision: str, motivo: str | None = None) -> Product:
    return ProductService.review_product(
        db=db_session, product_id=producto.id, reviewer=consejero, decision=decision, reason=motivo
    )


def test_cp01_al_guardar_el_producto_llega_cargado_exitosamente(producto, db_session):
    """CP-01 · CA22: al guardar un producto, su dueño recibe una notificación de «cargado exitosamente»."""
    notificaciones = _notificaciones(db_session, producto.owner_id)

    assert len(notificaciones) == 1
    assert "cargado exitosamente" in notificaciones[0].title.lower()
    assert notificaciones[0].product_id == producto.id
    assert notificaciones[0].is_read is False


def test_cp02_al_verificar_el_dueno_recibe_una_notificacion(producto, consejero, db_session):
    """CP-02 · CA23: al pasar a «verificado», el dueño recibe una notificación con el nuevo estado."""
    _revisar(db_session, producto, consejero, "verificado")

    notificaciones = _notificaciones(db_session, producto.owner_id)
    assert len(notificaciones) == 2  # «cargado» + «verificado»
    aviso = notificaciones[-1]
    assert aviso.product_id == producto.id
    assert "aprobado" in aviso.title.lower()
    assert PUBLICACION["title"] in aviso.message


def test_cp03_al_rechazar_la_notificacion_incluye_el_motivo(producto, consejero, db_session):
    """CP-03 · CA23: al pasar a «rechazado», la notificación incluye el motivo."""
    _revisar(db_session, producto, consejero, "rechazado", MOTIVO)

    aviso = _notificaciones(db_session, producto.owner_id)[-1]
    assert "rechazado" in aviso.title.lower()
    assert MOTIVO in aviso.message


def test_cp04_rechazar_sin_motivo_no_cambia_el_estado_ni_notifica(producto, consejero, db_session):
    """CP-04 · CA23: el rechazo exige motivo; sin él no cambia el estado ni se notifica."""
    with pytest.raises(ValueError):
        _revisar(db_session, producto, consejero, "rechazado", None)

    db_session.expire_all()
    assert db_session.get(Product, producto.id).status == "cargado"
    assert len(_notificaciones(db_session, producto.owner_id)) == 1


def test_cp05_cada_cambio_de_estado_genera_una_sola_notificacion(producto, consejero, db_session):
    """CP-05 · CA24: un producto ya revisado no se vuelve a revisar, así que no se duplica la notificación."""
    _revisar(db_session, producto, consejero, "verificado")

    with pytest.raises(ProductError):
        _revisar(db_session, producto, consejero, "rechazado", MOTIVO)

    titulos = [n.title.lower() for n in _notificaciones(db_session, producto.owner_id)]
    assert len(titulos) == 2
    assert sum("aprobado" in t for t in titulos) == 1
    assert not any("rechazado" in t for t in titulos)


def test_cp06_la_notificacion_solo_llega_al_dueno(producto, consejero, db_session):
    """CP-06 · CA23/CA24: la notificación va al profesor dueño, no al consejero ni a otro profesor."""
    otro = _sesion(OTRO_PROFESOR)  # crea la cuenta de otro profesor
    assert otro is not None
    otro_id = db_session.query(User).filter_by(username=OTRO_PROFESOR["uid"]).one().id

    _revisar(db_session, producto, consejero, "rechazado", MOTIVO)

    assert len(_notificaciones(db_session, producto.owner_id)) == 2
    assert _notificaciones(db_session, consejero.id) == []
    assert _notificaciones(db_session, otro_id) == []


def test_cp07_un_profesor_no_puede_cambiar_el_estado(producto, db_session):
    """CP-07 · CA23: solo el consejo cambia estados; un profesor no puede y no se genera notificación."""
    profesor = db_session.get(User, producto.owner_id)

    with pytest.raises(PermissionError):
        _revisar(db_session, producto, profesor, "verificado")

    assert len(_notificaciones(db_session, producto.owner_id)) == 1


# DEFECTO D-05 corregido en T-HU08-05 (PGPCECMC-93): las rutas de revisión usan ahora
# get_current_reviewer, así que el consejo puede decidir por la API y el aviso de CA23 sí se
# dispara de punta a punta.
def test_cp08_el_consejero_cambia_el_estado_por_la_api(producto, consejero, db_session):
    """CP-08 · CA23 (de punta a punta): el consejero rechaza por la API y el dueño recibe el aviso."""
    cliente = TestClient(app)
    cliente.cookies.set(
        "access_token",
        create_access_token({"sub": consejero.username, "user_id": consejero.id, "role": "reviewer"}),
    )

    respuesta = cliente.patch(
        f"{PRODUCTS_URL}/{producto.id}/review", json={"decision": "rechazado", "reason": MOTIVO}
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["status"] == "rechazado"
    assert MOTIVO in _notificaciones(db_session, producto.owner_id)[-1].message
