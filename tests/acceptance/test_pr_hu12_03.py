"""
PR-HU12-03 (PGPCECMC-123) - Prueba de HU12 "Consolidar publicaciones de ORCID y manuales
revisadas". Revisión sin permiso y registro manual de un DOI importado. Criterios: CA37 y CA38.
Responsable: Camilo Vásquez (tester).

Procedimiento y resultado esperado (Jira): intentar revisar sin permiso y registrar manualmente
un DOI importado: se deniega la revisión no autorizada y se evita duplicar la publicación.

Servicios simulados: directorio LDAP (sesiones reales de dos profesores).
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.notification import Notification
from app.models.product import Product
from app.models.user import User
from app.services.product_service import ProductService
from tests.support.directorio_ldap import OTRO_PROFESOR, PROFESOR, instalar_directorio

LOGIN_URL = "/api/v1/auth/login"
PRODUCTS_URL = "/api/v1/products"
IMPORT_URL = "/api/v1/products/orcid-import"
DOI_IMPORTADO = "10.1093/imanum/drae001"

MANUAL = {
    "type": "publicacion",
    "title": "Errores a posteriori para elementos finitos",
    "authors": ["María García"],
    "year": 2025,
    "research_line": "Computación científica",
    "doi": "10.5555/ecmc.2025.010",
}
OBRA_ORCID = {
    "external_id": "put-code-3001",
    "title": "Convergencia de métodos de Galerkin discontinuo",
    "authors": ["María García"],
    "year": 2024,
    "research_line": "Computación científica",
    "doi": DOI_IMPORTADO,
    "venue": "IMA Journal of Numerical Analysis",
}


def _sesion(usuario: dict) -> TestClient:
    cliente = TestClient(app)
    respuesta = cliente.post(LOGIN_URL, json={"username": usuario["uid"], "password": usuario["password"]})
    assert respuesta.status_code == 200
    return cliente


@pytest.fixture
def profesores(monkeypatch) -> tuple[TestClient, TestClient]:
    """El dueño de la publicación y otro profesor, ambos con sesión real."""
    instalar_directorio(monkeypatch)
    return _sesion(PROFESOR), _sesion(OTRO_PROFESOR)


@pytest.fixture
def pendiente(profesores, db_session) -> Product:
    """Publicación manual del primer profesor, pendiente de revisión («cargado»)."""
    respuesta = profesores[0].post(PRODUCTS_URL, json=MANUAL)
    assert respuesta.status_code == 201
    return db_session.get(Product, respuesta.json()["id"])


def _estado(db_session, producto: Product) -> str:
    db_session.expire_all()
    return db_session.get(Product, producto.id).status


def _avisos_de_revision(db_session, producto: Product) -> int:
    titulos = [n.title.lower() for n in db_session.query(Notification).filter_by(product_id=producto.id)]
    return sum("aprobado" in t or "rechazado" in t for t in titulos)


# --- Revisión sin permiso (CA38) ------------------------------------------------------------


@pytest.mark.parametrize("quien", [0, 1], ids=["el-propio-autor", "otro-profesor"])
def test_cp01_un_profesor_no_puede_aprobar_por_la_api(profesores, pendiente, db_session, quien):
    """CP-01 · CA38: ni el autor ni otro profesor pueden aprobar; se responde 403 y nada cambia."""
    respuesta = profesores[quien].patch(f"{PRODUCTS_URL}/{pendiente.id}/review", json={"decision": "verificado"})

    assert respuesta.status_code == 403
    assert _estado(db_session, pendiente) == "cargado"
    assert _avisos_de_revision(db_session, pendiente) == 0


def test_cp02_un_profesor_no_puede_rechazar_por_la_api(profesores, pendiente, db_session):
    """CP-02 · CA38: un profesor tampoco puede rechazar, aunque envíe un motivo."""
    respuesta = profesores[1].patch(
        f"{PRODUCTS_URL}/{pendiente.id}/review", json={"decision": "rechazado", "reason": "No me parece"}
    )

    assert respuesta.status_code == 403
    assert _estado(db_session, pendiente) == "cargado"


def test_cp03_un_profesor_no_ve_la_cola_del_consejo(profesores, pendiente):
    """CP-03 · CA38: la cola de revisión es solo del consejo."""
    assert profesores[0].get(f"{PRODUCTS_URL}/review-queue").status_code == 403


def test_cp04_sin_sesion_no_se_puede_revisar(pendiente, db_session):
    """CP-04 · CA38: sin sesión, la revisión se deniega con 401."""
    respuesta = TestClient(app).patch(f"{PRODUCTS_URL}/{pendiente.id}/review", json={"decision": "verificado"})

    assert respuesta.status_code == 401
    assert _estado(db_session, pendiente) == "cargado"


def test_cp05_un_profesor_no_puede_alterar_una_decision_ya_tomada(profesores, pendiente, db_session):
    """CP-05 · CA38: después de que el consejo aprueba, un profesor no puede cambiarla a rechazada."""
    consejero = User(username="consejo1", email="consejo1@yachaytech.edu.ec", full_name="Consejo", role="reviewer")
    db_session.add(consejero)
    db_session.commit()
    ProductService.review_product(db=db_session, product_id=pendiente.id, reviewer=consejero, decision="verificado")

    respuesta = profesores[1].patch(
        f"{PRODUCTS_URL}/{pendiente.id}/review", json={"decision": "rechazado", "reason": "Cambio no autorizado"}
    )

    assert respuesta.status_code == 403
    assert _estado(db_session, pendiente) == "verificado"
    db_session.expire_all()
    assert db_session.get(Product, pendiente.id).reviewed_by == consejero.id


# --- Registro manual de un DOI importado (CA37) ---------------------------------------------


@pytest.mark.parametrize(
    "doi",
    [DOI_IMPORTADO, DOI_IMPORTADO.upper(), f"https://doi.org/{DOI_IMPORTADO}"],
    ids=["mismo-doi", "mayusculas", "url-completa"],
)
def test_cp06_registrar_a_mano_un_doi_importado_se_rechaza(profesores, db_session, doi):
    """CP-06 · CA37: el DOI ya llegó desde ORCID; registrarlo a mano (en cualquier formato) da 409
    y queda un solo registro, con su origen ORCID."""
    assert profesores[0].post(IMPORT_URL, json=[OBRA_ORCID]).status_code == 200

    manual = {key: OBRA_ORCID[key] for key in ("title", "authors", "year", "research_line", "venue")}
    respuesta = profesores[0].post(PRODUCTS_URL, json={**manual, "type": "publicacion", "doi": doi})

    assert respuesta.status_code == 409
    productos = db_session.query(Product).filter_by(doi=DOI_IMPORTADO).all()
    assert len(productos) == 1
    assert productos[0].source == "orcid"


def test_cp07_un_coautor_tampoco_puede_registrar_a_mano_el_doi_importado(profesores, db_session):
    """CP-07 · CA37: la regla de unicidad vale para toda la Escuela, no solo para quien importó."""
    profesores[0].post(IMPORT_URL, json=[OBRA_ORCID])

    respuesta = profesores[1].post(
        PRODUCTS_URL,
        json={**MANUAL, "title": OBRA_ORCID["title"], "doi": DOI_IMPORTADO},
    )

    assert respuesta.status_code == 409
    assert db_session.query(Product).filter_by(doi=DOI_IMPORTADO).count() == 1
