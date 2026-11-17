"""
PR-HU12-01 (PGPCECMC-121) - Prueba de HU12 "Consolidar publicaciones de ORCID y manuales
revisadas". Importación ORCID persistente, con origen y sin duplicados.
Criterios: CA34, CA37 y CA38.
Responsable: Camilo Vásquez (tester).

Procedimiento y resultado esperado (Jira): importar desde ORCID, repetir la importación y
consultar en otra sesión: los datos persisten, conservan su origen y no se duplican por
identificador.

Ruta probada: POST /api/v1/products/orcid-import (recibe las obras ya leídas de ORCID).
Servicios simulados: directorio LDAP (sesión real del profesor). Como todavía no existe una
ruta para listar «mis productos» (llega con HU05), la consulta «en otra sesión» se hace
cerrando sesión, volviendo a entrar y revisando la base de datos.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.product import Product
from app.models.user import User
from tests.support.directorio_ldap import OTRO_PROFESOR, PROFESOR, instalar_directorio

LOGIN_URL = "/api/v1/auth/login"
LOGOUT_URL = "/api/v1/auth/logout"
PRODUCTS_URL = "/api/v1/products"
IMPORT_URL = "/api/v1/products/orcid-import"

DOI_A = "10.1016/j.amc.2024.128001"
DOI_B = "10.1137/23m1550001"

OBRAS_ORCID = [
    {
        "external_id": "put-code-1001",
        "title": "Esquemas de alto orden para leyes de conservación",
        "authors": ["María García"],
        "year": 2024,
        "research_line": "Computación científica",
        "doi": DOI_A,
        "venue": "Applied Mathematics and Computation",
    },
    {
        "external_id": "put-code-1002",
        "title": "Optimización estocástica en redes",
        "authors": ["María García", "Juan Pérez"],
        "year": 2023,
        "research_line": "Ecuaciones diferenciales, análisis matemático, modelamiento y optimización",
        "doi": DOI_B,
        "venue": "SIAM Journal on Optimization",
    },
]


def _sesion(usuario: dict) -> TestClient:
    cliente = TestClient(app)
    respuesta = cliente.post(LOGIN_URL, json={"username": usuario["uid"], "password": usuario["password"]})
    assert respuesta.status_code == 200
    return cliente


@pytest.fixture
def profesor(monkeypatch) -> TestClient:
    """Profesor autenticado contra el directorio simulado (actor de HU12)."""
    instalar_directorio(monkeypatch)
    return _sesion(PROFESOR)


def _id_de(db_session, usuario: dict) -> str:
    return db_session.query(User).filter_by(username=usuario["uid"]).one().id


def _productos(db_session) -> list[Product]:
    db_session.expire_all()
    return db_session.query(Product).order_by(Product.external_id).all()


def test_cp01_las_obras_de_orcid_se_guardan_con_origen_y_sin_confirmacion(profesor, db_session):
    """CP-01 · CA34: se guardan asociadas al profesor, con origen ORCID e identificador externo,
    sin confirmación individual (quedan «verificado»)."""
    respuesta = profesor.post(IMPORT_URL, json=OBRAS_ORCID)

    assert respuesta.status_code == 200
    assert len(respuesta.json()) == 2
    duenio = _id_de(db_session, PROFESOR)
    for producto, obra in zip(_productos(db_session), OBRAS_ORCID):
        assert producto.owner_id == duenio
        assert producto.source == "orcid"
        assert producto.external_id == obra["external_id"]
        assert producto.status == "verificado"
        assert producto.doi == obra["doi"]


def test_cp02_repetir_la_importacion_no_duplica(profesor, db_session):
    """CP-02 · CA37: repetir la misma importación no crea registros nuevos."""
    profesor.post(IMPORT_URL, json=OBRAS_ORCID)

    repetida = profesor.post(IMPORT_URL, json=OBRAS_ORCID)

    assert repetida.status_code == 200
    assert repetida.json() == []
    assert len(_productos(db_session)) == 2


def test_cp03_en_otra_sesion_los_datos_persisten_y_no_se_duplican(monkeypatch, db_session):
    """CP-03 · CA38: tras cerrar sesión y volver a entrar, los datos, el origen y el vínculo con el
    profesor siguen ahí, y una nueva importación no los duplica."""
    instalar_directorio(monkeypatch)
    primera = _sesion(PROFESOR)
    primera.post(IMPORT_URL, json=OBRAS_ORCID)
    assert primera.post(LOGOUT_URL).status_code == 200

    segunda = _sesion(PROFESOR)
    assert segunda.post(IMPORT_URL, json=OBRAS_ORCID).json() == []

    productos = _productos(db_session)
    assert len(productos) == 2
    assert {p.source for p in productos} == {"orcid"}
    assert {p.owner_id for p in productos} == {_id_de(db_session, PROFESOR)}
    assert [p.external_id for p in productos] == ["put-code-1001", "put-code-1002"]


def test_cp04_el_doi_de_orcid_se_normaliza_antes_de_comparar(profesor, db_session):
    """CP-04 · CA37: el mismo DOI escrito como URL o en mayúsculas en otra obra de ORCID no se duplica."""
    profesor.post(IMPORT_URL, json=OBRAS_ORCID[:1])
    variante = {**OBRAS_ORCID[0], "external_id": "put-code-1099", "doi": f"https://doi.org/{DOI_A.upper()}"}

    respuesta = profesor.post(IMPORT_URL, json=[variante])

    assert respuesta.json() == []
    assert len(_productos(db_session)) == 1


def test_cp05_si_ya_estaba_registrada_a_mano_no_se_duplica(profesor, db_session):
    """CP-05 · CA37: una obra que llega de ORCID con el DOI de una carga manual no se duplica, y la
    carga manual conserva su origen."""
    manual = {key: OBRAS_ORCID[0][key] for key in ("title", "authors", "year", "research_line", "venue")}
    assert profesor.post(PRODUCTS_URL, json={**manual, "type": "publicacion", "doi": DOI_A}).status_code == 201

    respuesta = profesor.post(IMPORT_URL, json=OBRAS_ORCID)

    assert [obra["external_id"] for obra in respuesta.json()] == ["put-code-1002"]
    productos = _productos(db_session)
    assert len(productos) == 2
    assert next(p for p in productos if p.doi == DOI_A).source == "manual"


def test_cp06_la_carga_manual_de_un_doi_importado_se_rechaza(profesor, db_session):
    """CP-06 · CA37: si la obra ya llegó desde ORCID, registrarla a mano responde 409 sin duplicar."""
    profesor.post(IMPORT_URL, json=OBRAS_ORCID)
    manual = {key: OBRAS_ORCID[1][key] for key in ("title", "authors", "year", "research_line", "venue")}

    respuesta = profesor.post(PRODUCTS_URL, json={**manual, "type": "publicacion", "doi": DOI_B.upper()})

    assert respuesta.status_code == 409
    assert len(_productos(db_session)) == 2


def test_cp07_otro_profesor_no_duplica_una_obra_ya_importada(monkeypatch, db_session):
    """CP-07 · CA37: la unicidad por DOI vale para toda la Escuela: un coautor que importa la misma
    obra no crea otro registro."""
    instalar_directorio(monkeypatch)
    _sesion(PROFESOR).post(IMPORT_URL, json=OBRAS_ORCID)

    respuesta = _sesion(OTRO_PROFESOR).post(
        IMPORT_URL, json=[{**OBRAS_ORCID[1], "external_id": "put-code-2002"}]
    )

    assert respuesta.json() == []
    assert len(_productos(db_session)) == 2


def test_cp08_importar_sin_sesion_no_esta_permitido(db_session):
    """CP-08 · CA38: sin sesión no se puede importar nada."""
    respuesta = TestClient(app).post(IMPORT_URL, json=OBRAS_ORCID)

    assert respuesta.status_code == 401
    assert _productos(db_session) == []


@pytest.mark.xfail(
    strict=True,
    reason="DEFECTO D-07: OrcidItemImport (app/schemas/product.py) no valida el año ni la línea de "
    "investigación, a diferencia del registro manual (ProductCreate). Una obra con año 1500 o con una "
    "línea fuera del catálogo de la ECMC se guarda igual. Relacionado con T-HU12-02 (PGPCECMC-95).",
)
@pytest.mark.parametrize(
    "cambio",
    [{"year": 1500}, {"research_line": "Línea que no existe"}],
    ids=["anio-imposible", "linea-fuera-del-catalogo"],
)
def test_cp09_una_obra_con_datos_invalidos_se_rechaza(profesor, db_session, cambio):
    """CP-09 · CA34: lo importado cumple las mismas reglas que el registro manual."""
    respuesta = profesor.post(IMPORT_URL, json=[{**OBRAS_ORCID[0], **cambio}])

    assert respuesta.status_code == 422
    assert _productos(db_session) == []
