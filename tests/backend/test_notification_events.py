"""
T-HU08-05 (PGPCECMC-93) - Integración de los eventos de verificación y rechazo con notificaciones
dirigidas al autor. Criterio CA23 (y CA24 para la unicidad).

CA23: cuando un producto pasa a «verificado» o «rechazado», el profesor propietario recibe una
      notificación con el nuevo estado y, si fue rechazado, el motivo.
CA24: cada cambio de estado genera una sola notificación.

Lo que se verifica aquí:
  - las plantillas de notificación (T-HU08-01) y que el motivo viaje en el rechazo;
  - el control de unicidad, que ahora vive en notification_service y no depende de que
    review_product se niegue a re-revisar;
  - el evento de verificación que antes quedaba mudo: una publicación importada desde ORCID nace
    «verificado» sin pasar por el Comité;
  - que el aviso llega por la API, que es lo que el defecto D-05 impedía.

El recorrido completo del consejo está en tests/acceptance/test_pr_hu08_01.py (PR-HU08-01).
"""

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.main import app
from app.models.notification import Notification
from app.models.product import Product
from app.models.user import User
from app.schemas.product import OrcidItemImport
from app.services.notification_service import (
    NOTIFICATION_TEMPLATES,
    PRODUCT_IMPORTED,
    PRODUCT_LOADED,
    PRODUCT_REJECTED,
    PRODUCT_VERIFIED,
    notify_product_event,
)
from app.services.product_service import ProductService

PRODUCTS_URL = "/api/v1/products"
MOTIVO = "El DOI no corresponde a la publicación declarada."


@pytest.fixture
def autor(db_session) -> User:
    """Profesor dueño del producto: es quien debe recibir los avisos."""
    usuario = User(
        username="autora", email="autora@yachaytech.edu.ec", full_name="María García", role="professor"
    )
    db_session.add(usuario)
    db_session.commit()
    db_session.refresh(usuario)
    return usuario


@pytest.fixture
def consejero(db_session) -> User:
    """Miembro del consejo (rol 'reviewer')."""
    usuario = User(
        username="consejo1", email="consejo1@yachaytech.edu.ec", full_name="Consejo ECMC", role="reviewer"
    )
    db_session.add(usuario)
    db_session.commit()
    db_session.refresh(usuario)
    return usuario


@pytest.fixture
def producto(db_session, autor) -> Product:
    """Producto del autor en estado «cargado», listo para que el consejo decida."""
    product = Product(
        owner_id=autor.id,
        school=autor.school,
        type="publicacion",
        title="Redes neuronales para series de tiempo climáticas",
        authors=["María García"],
        year=2025,
        research_line="Inteligencia artificial",
        doi="10.1007/s00521-025-11111-1",
        status="cargado",
        source="manual",
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    return product


def _avisos(db_session, user_id: str) -> list[Notification]:
    db_session.expire_all()
    return db_session.query(Notification).filter_by(user_id=user_id).order_by(Notification.created_at).all()


# --- Plantillas y contenido del aviso (CA23) ----------------------------------------------


@pytest.mark.parametrize(
    "event", [PRODUCT_LOADED, PRODUCT_VERIFIED, PRODUCT_REJECTED, PRODUCT_IMPORTED]
)
def test_cada_evento_usa_su_plantilla_y_nombra_el_producto(db_session, producto, event):
    """Todo evento del ciclo de vida tiene plantilla y el aviso nombra el producto."""
    aviso = notify_product_event(db_session, producto, event, reason=MOTIVO)

    titulo_esperado, _ = NOTIFICATION_TEMPLATES[event]
    assert aviso.title == titulo_esperado
    assert producto.title in aviso.message
    assert aviso.product_id == producto.id
    assert aviso.is_read is False


def test_el_aviso_de_rechazo_incluye_el_motivo(db_session, producto):
    """CA23: en el rechazo el profesor necesita saber por qué, no solo que fue rechazado."""
    aviso = notify_product_event(db_session, producto, PRODUCT_REJECTED, reason=MOTIVO)

    assert MOTIVO in aviso.message


def test_un_rechazo_sin_motivo_no_se_puede_notificar(db_session, producto):
    """CA23: el motivo es parte del aviso, así que sin él no se genera."""
    with pytest.raises(ValueError):
        notify_product_event(db_session, producto, PRODUCT_REJECTED)

    assert _avisos(db_session, producto.owner_id) == []


def test_un_evento_desconocido_se_rechaza(db_session, producto):
    """Solo se notifican los estados oficiales definidos en T-HU08-01."""
    with pytest.raises(ValueError):
        notify_product_event(db_session, producto, "archivado")


def test_el_aviso_va_al_autor_y_no_a_quien_revisa(db_session, producto, consejero):
    """CA23: la notificación es «dirigida al autor»."""
    notify_product_event(db_session, producto, PRODUCT_VERIFIED)

    assert len(_avisos(db_session, producto.owner_id)) == 1
    assert _avisos(db_session, consejero.id) == []


# --- Control de unicidad (CA24) -----------------------------------------------------------


def test_el_mismo_evento_no_se_notifica_dos_veces(db_session, producto):
    """CA24: repetir el evento no genera un segundo aviso, aunque se llame directo al servicio."""
    primero = notify_product_event(db_session, producto, PRODUCT_VERIFIED)
    repetido = notify_product_event(db_session, producto, PRODUCT_VERIFIED)

    assert primero is not None
    assert repetido is None
    assert len(_avisos(db_session, producto.owner_id)) == 1


def test_eventos_distintos_del_mismo_producto_si_conviven(db_session, producto):
    """La carga y la decisión son dos avisos distintos: el control de unicidad es por evento."""
    notify_product_event(db_session, producto, PRODUCT_LOADED)
    notify_product_event(db_session, producto, PRODUCT_VERIFIED)

    titulos = [aviso.title for aviso in _avisos(db_session, producto.owner_id)]
    assert titulos == [NOTIFICATION_TEMPLATES[PRODUCT_LOADED][0], NOTIFICATION_TEMPLATES[PRODUCT_VERIFIED][0]]


# --- Importación ORCID: el evento de verificación que antes quedaba mudo -------------------


def _obra(external_id: str, title: str) -> OrcidItemImport:
    return OrcidItemImport(
        external_id=external_id,
        title=title,
        authors=["María García"],
        year=2025,
        research_line="Ciencia de datos",
        doi=f"10.1000/{external_id}",
    )


def test_lo_importado_desde_orcid_se_notifica_al_autor(db_session, autor):
    """CA23 con CA34: lo importado nace «verificado», así que el autor debe enterarse."""
    importadas = ProductService.import_orcid_products(
        db_session, autor.id, [_obra("put-1", "Primera obra"), _obra("put-2", "Segunda obra")]
    )

    assert len(importadas) == 2
    avisos = _avisos(db_session, autor.id)
    assert len(avisos) == 2
    assert {aviso.title for aviso in avisos} == {NOTIFICATION_TEMPLATES[PRODUCT_IMPORTED][0]}
    assert {aviso.product_id for aviso in avisos} == {p.id for p in importadas}


def test_reimportar_lo_mismo_no_genera_mas_avisos(db_session, autor):
    """CA24 con CA37: una obra que ya estaba importada se omite, así que tampoco se vuelve a avisar."""
    obras = [_obra("put-1", "Primera obra")]
    ProductService.import_orcid_products(db_session, autor.id, obras)

    reintento = ProductService.import_orcid_products(db_session, autor.id, obras)

    assert reintento == []
    assert len(_avisos(db_session, autor.id)) == 1


# --- De punta a punta por la API (lo que impedía el defecto D-05) ---------------------------


def _sesion(usuario: User) -> TestClient:
    cliente = TestClient(app)
    cliente.cookies.set(
        "access_token",
        create_access_token({"sub": usuario.username, "user_id": usuario.id, "role": usuario.role}),
    )
    return cliente


def test_el_consejo_aprueba_por_la_api_y_el_autor_recibe_el_aviso(db_session, producto, consejero):
    """CA23 de punta a punta: la decisión por la API dispara el aviso al autor."""
    respuesta = _sesion(consejero).patch(
        f"{PRODUCTS_URL}/{producto.id}/review", json={"decision": "verificado"}
    )

    assert respuesta.status_code == 200
    aviso = _avisos(db_session, producto.owner_id)[-1]
    assert aviso.title == NOTIFICATION_TEMPLATES[PRODUCT_VERIFIED][0]


def test_el_consejo_rechaza_por_la_api_y_el_aviso_lleva_el_motivo(db_session, producto, consejero):
    """CA23 de punta a punta: el motivo del rechazo llega al autor."""
    respuesta = _sesion(consejero).patch(
        f"{PRODUCTS_URL}/{producto.id}/review", json={"decision": "rechazado", "reason": MOTIVO}
    )

    assert respuesta.status_code == 200
    assert MOTIVO in _avisos(db_session, producto.owner_id)[-1].message


def test_un_profesor_no_puede_decidir_por_la_api_y_no_se_notifica(db_session, producto, autor):
    """CA38: el guard de rol sigue cerrado para los profesores; sin decisión no hay aviso."""
    respuesta = _sesion(autor).patch(
        f"{PRODUCTS_URL}/{producto.id}/review", json={"decision": "verificado"}
    )

    assert respuesta.status_code == 403
    assert _avisos(db_session, producto.owner_id) == []


def test_el_consejo_ve_la_cola_y_un_profesor_no(db_session, producto, consejero, autor):
    """CA35 y CA38: la cola de revisión es del consejo (lo que D-05 le negaba)."""
    assert _sesion(consejero).get(f"{PRODUCTS_URL}/review-queue").status_code == 200
    assert _sesion(autor).get(f"{PRODUCTS_URL}/review-queue").status_code == 403
