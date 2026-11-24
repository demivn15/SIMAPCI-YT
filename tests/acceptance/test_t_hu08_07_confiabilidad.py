"""
T-HU08-07 (PGPCECMC-70) - Pruebas de integración y de confiabilidad del flujo de notificaciones
de HU08 "Recibir notificaciones del estado de un producto". Criterios: CA22, CA23 y CA24.
Responsable: Camilo Vásquez (tester).

Cada evento por separado ya está probado en PR-HU08-01 (test_pr_hu08_01.py) y la consulta por
profesor en PR-HU08-02 (test_pr_hu08_02.py). Aquí se prueba que el flujo completo sea confiable:
  - CP-01: con muchos productos, dos profesores y decisiones mezcladas, cada evento genera
    exactamente un aviso y le llega a su dueño;
  - CP-02 y CP-03: volver a emitir un evento, o que dos peticiones lo emitan a la vez, no duplica;
  - CP-04: las operaciones que fallan no dejan avisos;
  - CP-05 y CP-06: con la base creada por las migraciones de Alembic (la que se usa en MySQL),
    la tabla de avisos existe y guardar un producto funciona.

Servicios simulados: directorio LDAP (sesiones reales de dos profesores). La base de datos es la
SQLite en memoria de tests/conftest.py, salvo en CP-05 y CP-06, que crean una base nueva con
`alembic upgrade head`.
"""

from collections import Counter
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models.notification import Notification
from app.models.product import Product
from app.models.user import User
from app.services import notification_service
from app.services.notification_service import (
    PRODUCT_IMPORTED,
    PRODUCT_LOADED,
    PRODUCT_REJECTED,
    PRODUCT_VERIFIED,
    notify_product_event,
)
from tests.support.directorio_ldap import OTRO_PROFESOR, PROFESOR, instalar_directorio

PROJECT_ROOT = Path(__file__).resolve().parents[2]
LOGIN_URL = "/api/v1/auth/login"
PRODUCTS_URL = "/api/v1/products"
NOTIFICATIONS_URL = "/api/v1/notifications"
MOTIVO = "El DOI no corresponde a la publicación declarada."

CARGADO = "Producto cargado exitosamente"
APROBADO = "Producto aprobado"
RECHAZADO = "Producto rechazado"
IMPORTADO = "Publicación importada y verificada"

# CP-01: productos por profesor; el consejo aprueba los pares y rechaza los impares
PRODUCTOS_A, PRODUCTOS_B, OBRAS_ORCID_A = 12, 8, 3


def _publicacion(n: int) -> dict:
    return {
        "type": "publicacion",
        "title": f"Publicación de prueba {n}",
        "authors": ["María García"],
        "year": 2025,
        "research_line": "Inteligencia artificial",
        "doi": f"10.5555/hu08.{n}",
    }


def _sesion(usuario: dict, cliente: TestClient | None = None) -> TestClient:
    cliente = cliente or TestClient(app)
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
    """Miembro del consejo con sesión (rol 'reviewer')."""
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


def _decidir(consejo: TestClient, producto_id: str, decision: str, motivo: str | None = MOTIVO):
    cuerpo = {"decision": decision, "reason": motivo if decision == "rechazado" else None}
    return consejo.patch(f"{PRODUCTS_URL}/{producto_id}/review", json=cuerpo)


def _avisos(db_session) -> list[Notification]:
    db_session.expire_all()
    return db_session.query(Notification).all()


def test_cp01_cada_evento_genera_exactamente_un_aviso_para_su_dueno(profesores, consejo, db_session):
    """CP-01 · CA22, CA23 y CA24: A registra 12 productos y B 8, el consejo aprueba la mitad y
    rechaza la otra mitad, y A importa 3 obras de ORCID. Cada evento deja un solo aviso, dirigido
    al dueño del producto, y lo que ve cada profesor en la consulta coincide con la base."""
    a, b = profesores
    productos = [_registrar(a, n) for n in range(PRODUCTOS_A)]
    productos += [_registrar(b, 100 + n) for n in range(PRODUCTOS_B)]
    for i, producto in enumerate(productos):
        assert _decidir(consejo, producto, "verificado" if i % 2 == 0 else "rechazado").status_code == 200
    obras = [{**_publicacion(200 + n), "external_id": f"put-code-{n}"} for n in range(OBRAS_ORCID_A)]
    for obra in obras:
        obra.pop("type")
    assert a.post(f"{PRODUCTS_URL}/orcid-import", json=obras).status_code == 200

    avisos = _avisos(db_session)
    duenos = {p.id: p.owner_id for p in db_session.query(Product).all()}

    assert Counter((n.product_id, n.title) for n in avisos).most_common(1)[0][1] == 1
    assert all(n.user_id == duenos[n.product_id] for n in avisos)
    assert all(MOTIVO in n.message for n in avisos if n.title == RECHAZADO)
    assert Counter(n.title for n in avisos) == {
        CARGADO: PRODUCTOS_A + PRODUCTOS_B,
        APROBADO: (PRODUCTOS_A + PRODUCTOS_B) // 2,
        RECHAZADO: (PRODUCTOS_A + PRODUCTOS_B) // 2,
        IMPORTADO: OBRAS_ORCID_A,
    }
    assert a.get(NOTIFICATIONS_URL).json()["total"] == 2 * PRODUCTOS_A + OBRAS_ORCID_A
    assert b.get(NOTIFICATIONS_URL).json()["total"] == 2 * PRODUCTOS_B


def test_cp02_volver_a_emitir_cualquier_evento_no_agrega_avisos(profesores, consejo, db_session):
    """CP-02 · CA24: si algún camino vuelve a emitir un evento ya notificado (carga, aprobación,
    rechazo o importación), el componente de avisos lo ignora."""
    a, _ = profesores
    aprobado, rechazado = _registrar(a, 1), _registrar(a, 2)
    assert _decidir(consejo, aprobado, "verificado").status_code == 200
    assert _decidir(consejo, rechazado, "rechazado").status_code == 200
    obra = {**_publicacion(3), "external_id": "put-code-3"}
    obra.pop("type")
    importado = a.post(f"{PRODUCTS_URL}/orcid-import", json=[obra]).json()[0]["id"]
    antes = len(_avisos(db_session))

    repetidos = [
        notify_product_event(db_session, db_session.get(Product, aprobado), PRODUCT_LOADED),
        notify_product_event(db_session, db_session.get(Product, aprobado), PRODUCT_VERIFIED),
        notify_product_event(db_session, db_session.get(Product, rechazado), PRODUCT_REJECTED, reason=MOTIVO),
        notify_product_event(db_session, db_session.get(Product, importado), PRODUCT_IMPORTED),
    ]

    assert repetidos == [None, None, None, None]
    assert len(_avisos(db_session)) == antes == 5


def test_cp03_si_dos_peticiones_coinciden_la_base_impide_el_duplicado(profesores, db_session, monkeypatch):
    """CP-03 · CA24: si dos peticiones emiten el mismo evento a la vez, las dos pasan la
    verificación previa antes de que la otra guarde. Se simula haciendo que esa verificación no
    vea el aviso existente: la restricción única de la tabla rechaza el segundo."""
    a, _ = profesores
    producto = db_session.get(Product, _registrar(a, 1))
    monkeypatch.setattr(notification_service, "_already_notified", lambda *args, **kwargs: False)

    with pytest.raises(IntegrityError):
        notify_product_event(db_session, producto, PRODUCT_LOADED)
    db_session.rollback()

    assert [n.title for n in _avisos(db_session)] == [CARGADO]


def test_cp04_las_operaciones_que_fallan_no_dejan_avisos(profesores, consejo, db_session):
    """CP-04 · CA22 y CA23: un producto inválido o duplicado, un rechazo sin motivo, una decisión
    de un profesor o sobre un producto que no existe no generan avisos ni cambian el estado."""
    a, b = profesores
    producto = _registrar(a, 1)
    antes = len(_avisos(db_session))

    assert a.post(PRODUCTS_URL, json={**_publicacion(2), "title": ""}).status_code == 422
    assert b.post(PRODUCTS_URL, json=_publicacion(1)).status_code == 409
    assert _decidir(consejo, producto, "rechazado", motivo="   ").status_code == 422
    assert _decidir(consejo, producto, "archivado").status_code == 422
    assert _decidir(a, producto, "verificado").status_code == 403
    assert _decidir(consejo, "no-existe", "verificado").status_code == 400

    assert len(_avisos(db_session)) == antes == 1
    db_session.expire_all()
    assert db_session.get(Product, producto).status == "cargado"


@pytest.fixture
def base_migrada(tmp_path):
    """Base nueva creada con `alembic upgrade head`, como la de MySQL del despliegue."""
    url = f"sqlite:///{(tmp_path / 'migrada.db').as_posix()}"
    config = Config(str(PROJECT_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(PROJECT_ROOT / "migrations"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    engine = create_engine(url, connect_args={"check_same_thread": False})
    yield engine
    engine.dispose()


DEFECTO_D10 = (
    "DEFECTO D-10 (T-HU08-03, PGPCECMC-67): no hay migración de Alembic para la tabla "
    "`notifications` (solo 0001 users y 0002 products). En MySQL, `alembic upgrade head` no la "
    "crea: guardar un producto responde 500 aunque el producto sí se guarda (al reintentar da 409) "
    "y la consulta GET /notifications también responde 500."
)


@pytest.mark.xfail(strict=True, reason=DEFECTO_D10)
def test_cp05_las_migraciones_crean_la_tabla_de_avisos(base_migrada):
    """CP-05 · CA22 a CA24: la base creada por las migraciones tiene la tabla de avisos con su
    restricción de unicidad (CA24)."""
    inspector = inspect(base_migrada)

    assert "notifications" in inspector.get_table_names()
    restricciones = {uc["name"] for uc in inspector.get_unique_constraints("notifications")}
    assert "uq_notification_event" in restricciones


@pytest.mark.xfail(strict=True, reason=DEFECTO_D10)
def test_cp06_con_la_base_migrada_guardar_un_producto_notifica(base_migrada, monkeypatch):
    """CP-06 · CA22 de punta a punta con la base migrada: el profesor guarda un producto, recibe
    201 y queda su aviso de «cargado exitosamente»."""
    Sesion = sessionmaker(bind=base_migrada, autoflush=False, expire_on_commit=False)

    def db_migrada():
        with Sesion() as db:
            yield db

    monkeypatch.setitem(app.dependency_overrides, get_db, db_migrada)
    instalar_directorio(monkeypatch)
    profesor = _sesion(PROFESOR, TestClient(app, raise_server_exceptions=False))

    respuesta = profesor.post(PRODUCTS_URL, json=_publicacion(1))

    assert respuesta.status_code == 201
    assert [n["title"] for n in profesor.get(NOTIFICATIONS_URL).json()["items"]] == [CARGADO]
