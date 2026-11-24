"""
T-HU08-06 (PGPCECMC-69) - Consulta de las notificaciones del profesor, con contador de no leídas,
aislamiento por propietario y control de duplicados. Criterio CA24 de HU08.

CA24: «Dado que el profesor consulta sus notificaciones, cuando las revisa, entonces ve
       únicamente las suyas y cada cambio de estado genera una sola notificación.»

Las dos mitades del criterio se prueban por separado:
  - ve únicamente las suyas  -> aislamiento: el dueño sale del token, nunca de la petición;
  - una sola notificación    -> duplicados: ni el servicio ni la base de datos admiten dos avisos
                                del mismo evento para el mismo producto.

La generación de los avisos está en tests/backend/test_notification_events.py (T-HU08-05).
"""

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from app.core.security import create_access_token
from app.main import app
from app.models.notification import Notification
from app.models.product import Product
from app.models.user import User
from app.services.notification_service import (
    NOTIFICATION_TEMPLATES,
    PRODUCT_VERIFIED,
    notify_product_event,
)

NOTIFICATIONS_URL = "/api/v1/notifications"


def _profesor(db_session, username: str) -> User:
    usuario = User(
        username=username,
        email=f"{username}@yachaytech.edu.ec",
        full_name=username.capitalize(),
        role="professor",
    )
    db_session.add(usuario)
    db_session.commit()
    db_session.refresh(usuario)
    return usuario


def _sesion(usuario: User) -> TestClient:
    cliente = TestClient(app)
    cliente.cookies.set(
        "access_token",
        create_access_token({"sub": usuario.username, "user_id": usuario.id, "role": usuario.role}),
    )
    return cliente


def _aviso(db_session, usuario: User, titulo: str, *, leido: bool = False, minutos: int = 0) -> Notification:
    """Crea una notificación suelta.

    `minutos` desplaza la fecha para poder comprobar el orden: SQLite guarda `created_at` con
    precisión de segundos, así que varias inserciones seguidas quedarían empatadas.
    """
    notificacion = Notification(
        user_id=usuario.id,
        title=titulo,
        message=f"Mensaje de {titulo}",
        is_read=leido,
        created_at=datetime(2026, 11, 23, 10, 0, 0) + timedelta(minutes=minutos),
    )
    db_session.add(notificacion)
    db_session.commit()
    db_session.refresh(notificacion)
    return notificacion


@pytest.fixture
def autora(db_session) -> User:
    return _profesor(db_session, "autora")


@pytest.fixture
def otro(db_session) -> User:
    return _profesor(db_session, "otroprof")


# --- Aislamiento por propietario (CA24) ---------------------------------------------------


def test_sin_sesion_no_se_pueden_consultar_las_notificaciones():
    """Las notificaciones son una función privada: sin cookie de sesión, 401."""
    assert TestClient(app).get(NOTIFICATIONS_URL).status_code == 401


def test_cada_profesor_ve_unicamente_sus_notificaciones(db_session, autora, otro):
    """CA24: la consulta devuelve solo las del profesor que la hace."""
    _aviso(db_session, autora, "Producto aprobado")
    _aviso(db_session, autora, "Producto cargado exitosamente", minutos=1)
    _aviso(db_session, otro, "Producto rechazado")

    cuerpo = _sesion(autora).get(NOTIFICATIONS_URL).json()

    assert cuerpo["total"] == 2
    assert {item["title"] for item in cuerpo["items"]} == {
        "Producto aprobado",
        "Producto cargado exitosamente",
    }


def test_no_se_puede_marcar_como_leida_la_notificacion_de_otro(db_session, autora, otro):
    """Seguridad: conocer el id de una notificación ajena no da acceso a ella."""
    ajena = _aviso(db_session, otro, "Producto rechazado")

    respuesta = _sesion(autora).patch(f"{NOTIFICATIONS_URL}/{ajena.id}/read")

    # 404 y no 403: desde fuera no se distingue de una que no existe, así que la respuesta no
    # sirve para averiguar qué notificaciones tienen los demás.
    assert respuesta.status_code == 404
    db_session.expire_all()
    assert db_session.get(Notification, ajena.id).is_read is False


def test_una_notificacion_inexistente_responde_404(autora):
    assert _sesion(autora).patch(f"{NOTIFICATIONS_URL}/no-existe/read").status_code == 404


def test_un_miembro_del_consejo_no_usa_esta_consulta(db_session):
    """Las notificaciones de HU08 son del profesor dueño del producto; el rol revisor no aplica."""
    consejero = User(
        username="consejo1", email="consejo1@yachaytech.edu.ec", full_name="Consejo", role="reviewer"
    )
    db_session.add(consejero)
    db_session.commit()
    db_session.refresh(consejero)

    assert _sesion(consejero).get(NOTIFICATIONS_URL).status_code == 403


# --- Contador de no leídas ----------------------------------------------------------------


def test_el_contador_cuenta_solo_las_no_leidas(db_session, autora):
    _aviso(db_session, autora, "Producto cargado exitosamente")
    _aviso(db_session, autora, "Producto aprobado", leido=True, minutos=1)

    cuerpo = _sesion(autora).get(NOTIFICATIONS_URL).json()

    assert cuerpo["unread"] == 1
    assert cuerpo["total"] == 2


def test_marcar_como_leida_baja_el_contador(db_session, autora):
    aviso = _aviso(db_session, autora, "Producto aprobado")
    cliente = _sesion(autora)
    assert cliente.get(NOTIFICATIONS_URL).json()["unread"] == 1

    respuesta = cliente.patch(f"{NOTIFICATIONS_URL}/{aviso.id}/read")

    assert respuesta.status_code == 200
    assert respuesta.json()["is_read"] is True
    assert cliente.get(NOTIFICATIONS_URL).json()["unread"] == 0


def test_marcar_dos_veces_la_misma_notificacion_no_cambia_nada(db_session, autora):
    """Marcar como leída es idempotente: repetirlo no es un error ni descuadra el contador."""
    aviso = _aviso(db_session, autora, "Producto aprobado")
    cliente = _sesion(autora)

    assert cliente.patch(f"{NOTIFICATIONS_URL}/{aviso.id}/read").status_code == 200
    assert cliente.patch(f"{NOTIFICATIONS_URL}/{aviso.id}/read").status_code == 200

    assert cliente.get(NOTIFICATIONS_URL).json()["unread"] == 0


def test_el_contador_no_depende_del_filtro_ni_de_la_pagina(db_session, autora):
    """`unread` es el total de no leídas del profesor, para mostrarlo sin pedir toda la lista."""
    for i in range(3):
        _aviso(db_session, autora, f"Aviso {i}", minutos=i)

    cuerpo = _sesion(autora).get(NOTIFICATIONS_URL, params={"limit": 1, "only_unread": True}).json()

    assert cuerpo["unread"] == 3
    assert len(cuerpo["items"]) == 1


# --- Orden, filtro y paginación -------------------------------------------------------------


def test_las_notificaciones_llegan_de_la_mas_reciente_a_la_mas_antigua(db_session, autora):
    """El profesor ve primero lo último que pasó con sus productos."""
    _aviso(db_session, autora, "La primera", minutos=0)
    _aviso(db_session, autora, "La segunda", minutos=5)
    _aviso(db_session, autora, "La tercera", minutos=10)

    items = _sesion(autora).get(NOTIFICATIONS_URL).json()["items"]

    assert [item["title"] for item in items] == ["La tercera", "La segunda", "La primera"]


def test_el_filtro_de_no_leidas_excluye_las_leidas(db_session, autora):
    _aviso(db_session, autora, "Ya leida", leido=True, minutos=0)
    _aviso(db_session, autora, "Sin leer", minutos=1)

    cuerpo = _sesion(autora).get(NOTIFICATIONS_URL, params={"only_unread": True}).json()

    assert cuerpo["total"] == 1
    assert [item["title"] for item in cuerpo["items"]] == ["Sin leer"]


def test_la_paginacion_devuelve_la_pagina_pedida(db_session, autora):
    for i in range(5):
        _aviso(db_session, autora, f"Aviso {i}", minutos=i)

    cuerpo = _sesion(autora).get(NOTIFICATIONS_URL, params={"limit": 2, "offset": 2}).json()

    # Orden descendente: Aviso 4, 3, | 2, 1, | 0
    assert cuerpo["total"] == 5
    assert [item["title"] for item in cuerpo["items"]] == ["Aviso 2", "Aviso 1"]


@pytest.mark.parametrize(
    "params", [{"limit": 0}, {"limit": 500}, {"offset": -1}], ids=["limite-cero", "limite-enorme", "offset-negativo"]
)
def test_una_paginacion_invalida_se_rechaza(autora, params):
    """La página tiene límites: así una consulta no puede pedir la tabla entera."""
    assert _sesion(autora).get(NOTIFICATIONS_URL, params=params).status_code == 422


# --- Control de duplicados (CA24) -----------------------------------------------------------


@pytest.fixture
def producto(db_session, autora) -> Product:
    product = Product(
        owner_id=autora.id,
        school=autora.school,
        type="publicacion",
        title="Redes neuronales para series de tiempo climáticas",
        authors=["Autora"],
        year=2025,
        research_line="Inteligencia artificial",
        status="cargado",
        source="manual",
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    return product


def test_repetir_el_evento_no_agrega_una_segunda_notificacion(db_session, autora, producto):
    """CA24: un mismo cambio de estado se ve una sola vez en la consulta."""
    notify_product_event(db_session, producto, PRODUCT_VERIFIED)
    notify_product_event(db_session, producto, PRODUCT_VERIFIED)

    cuerpo = _sesion(autora).get(NOTIFICATIONS_URL).json()

    assert cuerpo["total"] == 1
    assert cuerpo["items"][0]["title"] == NOTIFICATION_TEMPLATES[PRODUCT_VERIFIED][0]


def test_la_base_de_datos_tambien_rechaza_el_duplicado(db_session, autora, producto):
    """La restricción única es la garantía final, aunque alguien inserte sin pasar por el servicio."""
    titulo, _ = NOTIFICATION_TEMPLATES[PRODUCT_VERIFIED]
    notify_product_event(db_session, producto, PRODUCT_VERIFIED)

    db_session.add(
        Notification(user_id=autora.id, product_id=producto.id, title=titulo, message="Duplicado a mano")
    )
    with pytest.raises(IntegrityError):
        db_session.commit()

    db_session.rollback()
