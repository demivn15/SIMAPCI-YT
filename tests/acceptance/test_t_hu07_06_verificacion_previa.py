"""
T-HU07-06 (PGPCECMC-64) - Pruebas de HU07 "Validar la existencia de un producto antes de
agregarlo": consulta previa de existencia por DOI y código de proyecto.
Criterios: CA19, CA20 y CA21 (y CA37 de HU12 para lo importado desde ORCID).
Responsable: Camilo Vásquez (tester).

Ruta probada: GET /api/v1/products/exists (T-HU07-02, PGPCECMC-60), que el formulario usa
para avisar antes de guardar. El guardado (POST /api/v1/products) repite la verificación;
aquí se comprueba además que ambas respuestas coinciden.

Reglas usadas (documento «Reglas y definiciones del Sprint 2», T-HU07-01): RU-02 y RU-03
para normalizar el DOI y el código de proyecto, RU-04 unicidad global, RU-06 sin
identificador no se verifica y RU-08 solo se enlaza un producto público («verificado»).

Servicios simulados: directorio LDAP (sesiones reales de dos profesores). La base de datos
es la SQLite en memoria de tests/conftest.py. El tiempo de respuesta está en
tests/performance/test_t_hu07_06_tiempos.py.
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
LOGOUT_URL = "/api/v1/auth/logout"
PRODUCTS_URL = "/api/v1/products"
EXISTS_URL = "/api/v1/products/exists"
IMPORT_URL = "/api/v1/products/orcid-import"

DOI = "10.1016/j.jcp.2024.112345"
CODIGO = "ECMC-2025-07"

PUBLICACION = {
    "type": "publicacion",
    "title": "Métodos espectrales para ecuaciones de reacción-difusión",
    "authors": ["María García", "Juan Pérez"],
    "year": 2024,
    "research_line": "Computación científica",
    "doi": DOI,
    "venue": "Journal of Computational Physics",
}

PROYECTO = {
    "type": "proyecto",
    "title": "Modelos de optimización para redes eléctricas",
    "authors": ["María García"],
    "year": 2025,
    "research_line": "Ecuaciones diferenciales, análisis matemático, modelamiento y optimización",
    "project_code": CODIGO,
    "project_status": "activo",
}

# Formas en que un profesor podría pegar el mismo DOI en el formulario (las de PR-HU07-01)
VARIANTES_DEL_DOI = {
    "igual": DOI,
    "mayúsculas": DOI.upper(),
    "URL completa": f"https://doi.org/{DOI}",
    "URL en mayúsculas": f"HTTPS://DOI.ORG/{DOI.upper()}",
    "URL antigua dx.doi.org": f"http://dx.doi.org/{DOI}",
    "prefijo doi:": f"doi: {DOI}",
    "espacios y barra final": f"  {DOI}/  ",
    "www.doi.org": f"https://www.doi.org/{DOI}",
    "barra codificada %2F": DOI.replace("/", "%2F"),
}

VARIANTES_DEL_CODIGO = {
    "minúsculas": "ecmc-2025-07",
    "espacios": "ECMC 2025 07",
    "guion bajo": "ecmc_2025_07",
    "espacios alrededor": "  ECMC-2025-07  ",
    "guion tipográfico": "ECMC\u20132025\u201307",
}


def _sesion(usuario: dict) -> TestClient:
    cliente = TestClient(app)
    respuesta = cliente.post(LOGIN_URL, json={"username": usuario["uid"], "password": usuario["password"]})
    assert respuesta.status_code == 200
    return cliente


@pytest.fixture
def profesor(monkeypatch) -> TestClient:
    """Profesor autenticado contra el directorio simulado (actor de HU07)."""
    instalar_directorio(monkeypatch)
    return _sesion(PROFESOR)


@pytest.fixture
def consejero(db_session) -> User:
    """Miembro del consejo (rol 'reviewer') para aprobar o rechazar productos."""
    usuario = User(username="consejo1", email="consejo1@yachaytech.edu.ec", full_name="Consejo ECMC", role="reviewer")
    db_session.add(usuario)
    db_session.commit()
    return usuario


def _consultar(cliente: TestClient, **params) -> dict:
    respuesta = cliente.get(EXISTS_URL, params=params)
    assert respuesta.status_code == 200
    return respuesta.json()


def test_cp01_sin_sesion_o_tras_cerrarla_no_se_puede_consultar(profesor):
    """CP-01 · CA20: la consulta previa es una función privada: sin sesión, o después de cerrar
    sesión, responde 401."""
    assert TestClient(app).get(EXISTS_URL, params={"doi": DOI}).status_code == 401

    assert profesor.post(LOGOUT_URL).status_code == 200
    assert profesor.get(EXISTS_URL, params={"doi": DOI}).status_code == 401


def test_cp02_un_doi_nuevo_no_existe_y_luego_se_registra(profesor):
    """CP-02 · CA19: antes de registrar, un DOI nuevo es verificable y no existe; el guardado
    posterior se acepta, igual que dijo la consulta."""
    antes = _consultar(profesor, doi=f"https://doi.org/{DOI}")

    assert antes["verifiable"] is True
    assert antes["exists"] is False
    assert antes["normalized_identifier"] == DOI
    assert profesor.post(PRODUCTS_URL, json=PUBLICACION).status_code == 201


@pytest.mark.parametrize("variante", VARIANTES_DEL_DOI.values(), ids=VARIANTES_DEL_DOI.keys())
def test_cp03_el_doi_registrado_se_detecta_en_cualquier_formato(profesor, variante):
    """CP-03 · CA20: después de registrar, la consulta reconoce el mismo DOI escrito de
    cualquier forma e indica que coincidió el DOI."""
    assert profesor.post(PRODUCTS_URL, json=PUBLICACION).status_code == 201

    respuesta = _consultar(profesor, doi=variante)

    assert respuesta["exists"] is True
    assert respuesta["field"] == "doi"
    assert respuesta["normalized_identifier"] == DOI


@pytest.mark.parametrize("variante", ["mayúsculas", "URL completa", "prefijo doi:"])
def test_cp04_si_la_consulta_dice_que_existe_el_guardado_se_rechaza(profesor, db_session, variante):
    """CP-04 · CA20: la consulta y el guardado aplican la misma regla: si la consulta dice que
    el DOI existe, guardarlo con esa misma escritura responde 409 y no se duplica."""
    assert profesor.post(PRODUCTS_URL, json=PUBLICACION).status_code == 201
    doi = VARIANTES_DEL_DOI[variante]
    assert _consultar(profesor, doi=doi)["exists"] is True

    respuesta = profesor.post(PRODUCTS_URL, json={**PUBLICACION, "title": "Otro título", "doi": doi})

    assert respuesta.status_code == 409
    assert db_session.query(Product).count() == 1


@pytest.mark.parametrize("variante", VARIANTES_DEL_CODIGO.values(), ids=VARIANTES_DEL_CODIGO.keys())
def test_cp05_el_codigo_de_proyecto_se_detecta_en_cualquier_formato(profesor, variante):
    """CP-05 · CA20 (proyectos): el código institucional se reconoce sin importar mayúsculas,
    espacios o guion bajo."""
    assert profesor.post(PRODUCTS_URL, json=PROYECTO).status_code == 201

    respuesta = _consultar(profesor, project_code=variante)

    assert respuesta["exists"] is True
    assert respuesta["field"] == "project_code"
    assert respuesta["normalized_identifier"] == CODIGO


@pytest.mark.parametrize("valor", ["", "   "], ids=["vacio", "solo-espacios"])
def test_cp06_sin_identificador_no_se_puede_verificar(profesor, valor):
    """CP-06 · CA21: sin DOI ni código (o con el campo vacío) la consulta no da error: indica
    que no se pudo verificar, para que el formulario muestre el aviso y deje continuar."""
    respuesta = _consultar(profesor, doi=valor, project_code=valor)

    assert respuesta["verifiable"] is False
    assert respuesta["exists"] is False


@pytest.mark.parametrize(
    "doi", ["no-es-un-doi", "10.1016", "10.1016/" + "x" * 300], ids=["texto", "sin-sufijo", "demasiado-largo"]
)
def test_cp07_un_doi_mal_escrito_se_rechaza_con_422(profesor, doi):
    """CP-07 · CA19: un DOI que no tiene la forma 10.<prefijo>/<sufijo>, o que excede la
    longitud permitida, se rechaza con 422 en vez de responder «no existe»."""
    assert profesor.get(EXISTS_URL, params={"doi": doi}).status_code == 422


def test_cp08_otro_profesor_ve_que_existe_pero_no_el_producto_pendiente(monkeypatch, db_session):
    """CP-08 · CA20 con RU-04 y RU-08: la unicidad es de toda la Escuela, así que un coautor
    también ve que el DOI existe; mientras el producto no esté verificado, no recibe su id."""
    instalar_directorio(monkeypatch)
    assert _sesion(PROFESOR).post(PRODUCTS_URL, json=PUBLICACION).status_code == 201

    respuesta = _consultar(_sesion(OTRO_PROFESOR), doi=DOI.upper())

    assert respuesta["exists"] is True
    assert respuesta["public_product_id"] is None


def test_cp09_tras_la_aprobacion_del_consejo_se_enlaza_el_producto(profesor, consejero, db_session):
    """CP-09 · CA20 con RU-08 y HU12: cuando el consejo aprueba el producto, la consulta ya
    puede enlazarlo (id público); si lo rechaza, sigue existiendo pero no se enlaza."""
    aprobado = profesor.post(PRODUCTS_URL, json=PUBLICACION).json()
    rechazado = profesor.post(PRODUCTS_URL, json=PROYECTO).json()
    ProductService.review_product(db=db_session, product_id=aprobado["id"], reviewer=consejero, decision="verificado")
    ProductService.review_product(
        db=db_session, product_id=rechazado["id"], reviewer=consejero, decision="rechazado", reason="Código inválido."
    )

    assert _consultar(profesor, doi=DOI)["public_product_id"] == aprobado["id"]
    respuesta = _consultar(profesor, project_code=CODIGO)
    assert respuesta["exists"] is True
    assert respuesta["public_product_id"] is None


def test_cp10_una_obra_importada_de_orcid_tambien_se_detecta(profesor):
    """CP-10 · CA20 con CA37 (HU12): una publicación que llegó desde ORCID cuenta igual que una
    manual; la consulta la detecta y la enlaza, porque lo importado queda «verificado»."""
    obra = {
        "external_id": "put-code-1001",
        "title": PUBLICACION["title"],
        "authors": PUBLICACION["authors"],
        "year": PUBLICACION["year"],
        "research_line": PUBLICACION["research_line"],
        "doi": f"https://doi.org/{DOI.upper()}",
        "venue": PUBLICACION["venue"],
    }
    importadas = profesor.post(IMPORT_URL, json=[obra]).json()

    respuesta = _consultar(profesor, doi=DOI)

    assert respuesta["exists"] is True
    assert respuesta["public_product_id"] == importadas[0]["id"]


def test_cp11_consultar_no_modifica_nada(profesor, db_session):
    """CP-11 · CA19: la consulta solo lee: después de muchas consultas no hay productos ni
    notificaciones nuevos."""
    assert profesor.post(PRODUCTS_URL, json=PUBLICACION).status_code == 201
    productos = db_session.query(Product).count()
    avisos = db_session.query(Notification).count()

    for doi in [*VARIANTES_DEL_DOI.values(), "10.9999/no.existe"]:
        _consultar(profesor, doi=doi)
    _consultar(profesor, project_code=CODIGO)

    db_session.expire_all()
    assert db_session.query(Product).count() == productos
    assert db_session.query(Notification).count() == avisos
