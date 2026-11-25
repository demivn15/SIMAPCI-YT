"""
T-HU12-05 (PGPCECMC-98) - Pruebas de HU12 "Consolidar publicaciones de ORCID y manuales
revisadas": persistencia, las dos vías de ingreso, unicidad y permisos.
Criterios: CA34, CA35, CA36, CA37 y CA38.

Las pruebas por caso de Jira ya cubren cada pieza por separado: PR-HU12-01 la importación
ORCID, PR-HU12-02 la aprobación y el rechazo, PR-HU12-03 la revisión sin permiso. Esta
validación cubre lo que queda entre ellas, en los cuatro ejes de la tarea:

  persistencia  -> lo guardado y lo decidido sobreviven a la sesión, y se consulta por la API
                   (no mirando la base): hoy ya existen GET /products/catalog (T-HU12-04) y
                   GET /notifications (T-HU08-06), que no existían cuando se escribió PR-HU12-01;
  vías          -> manual y ORCID conviviendo en el mismo catálogo, cada una con su origen y
                   con su regla: la manual necesita decisión del consejo, la importada no;
  unicidad      -> el duplicado dentro de un MISMO envío, la unicidad del put-code por profesor,
                   el código de proyecto entre profesores y el DOI de una publicación rechazada;
  permisos      -> cuenta dada de baja, producto inexistente y decisión ya tomada.

Servicios simulados: directorio LDAP (sesiones reales de dos profesores y de un consejero).
La base de datos es la SQLite en memoria de tests/conftest.py.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.product import Product
from app.models.user import User
from tests.support.directorio_ldap import (
    GRUPO_PROFESORES,
    OTRO_PROFESOR,
    PROFESOR,
    USUARIOS_POR_DEFECTO,
    instalar_directorio,
)

LOGIN_URL = "/api/v1/auth/login"
LOGOUT_URL = "/api/v1/auth/logout"
PRODUCTS_URL = "/api/v1/products"
IMPORT_URL = f"{PRODUCTS_URL}/orcid-import"
QUEUE_URL = f"{PRODUCTS_URL}/review-queue"
CATALOG_URL = f"{PRODUCTS_URL}/catalog"
NOTIFICATIONS_URL = "/api/v1/notifications"

MOTIVO = "La revista no está indexada en las bases aceptadas por la ECMC."

# El consejero existe en el directorio como personal docente; lo que lo hace miembro del
# consejo es el rol 'reviewer' de su cuenta, no el directorio.
CONSEJERO = {
    "uid": "cvasquez",
    "password": "Clave-Consejo-2026!",
    "cn": "Camilo Vásquez",
    "mail": "cvasquez@yachaytech.edu.ec",
    "groups": [GRUPO_PROFESORES],
}

PUBLICACION = {
    "type": "publicacion",
    "title": "Estabilidad de esquemas implícitos en mallas no estructuradas",
    "authors": ["María García"],
    "year": 2025,
    "research_line": "Computación científica",
    "doi": "10.5555/ecmc.2025.501",
    "venue": "Applied Numerical Mathematics",
}
PROYECTO = {
    "type": "proyecto",
    "title": "Modelamiento de la cuenca del río Mira",
    "authors": ["María García", "Juan Pérez"],
    "year": 2025,
    "research_line": "Ecuaciones diferenciales, análisis matemático, modelamiento y optimización",
    "project_code": "ECMC-2025-77",
    "project_status": "activo",
}
OBRA_ORCID = {
    "external_id": "put-code-5001",
    "title": "Redes neuronales informadas por la física",
    "authors": ["María García"],
    "year": 2024,
    "research_line": "Inteligencia artificial",
    "doi": "10.5555/ecmc.2024.orcid.1",
    "venue": "Journal of Computational Physics",
}


def _sesion(usuario: dict) -> TestClient:
    cliente = TestClient(app)
    assert cliente.post(
        LOGIN_URL, json={"username": usuario["uid"], "password": usuario["password"]}
    ).status_code == 200
    return cliente


@pytest.fixture
def directorio(monkeypatch):
    """Directorio simulado con los dos profesores de siempre y el consejero."""
    return instalar_directorio(monkeypatch, (*USUARIOS_POR_DEFECTO, CONSEJERO))


@pytest.fixture
def consejo(directorio, db_session) -> User:
    """La cuenta del consejero, creada con rol 'reviewer' ANTES de su primer login.

    El token lleva el rol que la cuenta tenía al iniciar sesión (defecto D-05), así que
    cambiarlo después dejaría una sesión que sigue diciendo 'professor'.
    """
    usuario = User(
        username=CONSEJERO["uid"],
        email=CONSEJERO["mail"],
        full_name=CONSEJERO["cn"],
        role="reviewer",
    )
    db_session.add(usuario)
    db_session.commit()
    db_session.refresh(usuario)
    return usuario


@pytest.fixture
def profesor(directorio) -> TestClient:
    return _sesion(PROFESOR)


def _cargar(cliente: TestClient, producto: dict, **cambios) -> str:
    respuesta = cliente.post(PRODUCTS_URL, json={**producto, **cambios})
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()["id"]


def _decidir(consejero: TestClient, product_id: str, decision: str, reason: str | None = None):
    cuerpo = {"decision": decision}
    if reason:
        cuerpo["reason"] = reason
    return consejero.patch(f"{PRODUCTS_URL}/{product_id}/review", json=cuerpo)


def _aprobar(consejero: TestClient, product_id: str) -> None:
    assert _decidir(consejero, product_id, "verificado").status_code == 200


# --- Persistencia (CA38) --------------------------------------------------------------------


def test_cp01_la_decision_del_consejo_sobrevive_a_la_sesion(consejo, profesor, db_session):
    """CP-01 · CA38: cerrar sesión no borra la decisión; el responsable, la fecha y el estado
    siguen ahí cuando el consejo vuelve a entrar."""
    product_id = _cargar(profesor, PUBLICACION)
    primera = _sesion(CONSEJERO)
    _aprobar(primera, product_id)
    assert primera.post(LOGOUT_URL).status_code == 200

    segunda = _sesion(CONSEJERO)
    assert segunda.get(QUEUE_URL).status_code == 200  # la sesión nueva funciona

    db_session.expire_all()
    guardado = db_session.get(Product, product_id)
    assert guardado.status == "verificado"
    assert guardado.reviewed_by == consejo.id
    assert guardado.reviewed_at is not None


def test_cp02_lo_consolidado_se_consulta_aunque_nadie_tenga_sesion(consejo, profesor):
    """CP-02 · CA36: el catálogo es del público, no de la sesión que lo creó.

    Se comprueba por la API y no mirando la base, que es lo que PR-HU12-01 tuvo que hacer
    cuando todavía no existía ninguna consulta.
    """
    product_id = _cargar(profesor, PUBLICACION)
    _aprobar(_sesion(CONSEJERO), product_id)
    assert profesor.post(LOGOUT_URL).status_code == 200

    anonimo = TestClient(app)

    assert anonimo.get(f"{CATALOG_URL}/{product_id}").status_code == 200
    assert anonimo.get(CATALOG_URL).json()["total"] == 1


def test_cp03_el_aviso_de_la_decision_sigue_ahi_en_la_siguiente_sesion(consejo, profesor):
    """CP-03 · CA38 con HU08: el profesor que no estaba conectado se entera igual al volver,
    y el aviso no se duplica por haber vuelto a entrar."""
    product_id = _cargar(profesor, PUBLICACION)
    assert profesor.post(LOGOUT_URL).status_code == 200

    _decidir(_sesion(CONSEJERO), product_id, "rechazado", MOTIVO)

    avisos = _sesion(PROFESOR).get(NOTIFICATIONS_URL).json()["items"]
    rechazos = [a for a in avisos if a["product_id"] == product_id and a["title"] == "Producto rechazado"]
    assert len(rechazos) == 1
    assert MOTIVO in rechazos[0]["message"]


# --- Las dos vías de ingreso (CA34, CA35, CA36) -----------------------------------------------


def test_cp04_las_dos_vias_conviven_en_el_mismo_catalogo_con_su_origen(consejo, profesor):
    """CP-04 · CA34 y CA36: consolidar es juntar las dos vías sin perder de dónde vino cada una."""
    manual = _cargar(profesor, PUBLICACION)
    _aprobar(_sesion(CONSEJERO), manual)
    assert profesor.post(IMPORT_URL, json=[OBRA_ORCID]).status_code == 200

    items = TestClient(app).get(CATALOG_URL).json()["items"]

    assert len(items) == 2
    assert {item["source"] for item in items} == {"manual", "orcid"}
    por_origen = {item["source"]: item for item in items}
    assert por_origen["manual"]["id"] == manual
    assert por_origen["orcid"]["doi"] == OBRA_ORCID["doi"]


def test_cp05_la_obra_importada_no_pasa_por_la_cola_del_consejo(consejo, profesor):
    """CP-05 · CA34: lo de ORCID nace verificado, así que no hay nada que revisar.

    La cola solo debe traer lo que espera decisión, o el consejo revisaría dos veces.
    """
    pendiente = _cargar(profesor, PUBLICACION)
    assert profesor.post(IMPORT_URL, json=[OBRA_ORCID]).status_code == 200

    cola = _sesion(CONSEJERO).get(QUEUE_URL).json()

    assert [producto["id"] for producto in cola] == [pendiente]
    assert all(producto["source"] == "manual" for producto in cola)


def test_cp06_un_proyecto_solo_entra_por_la_via_manual(consejo, profesor):
    """CP-06 · CA34: la importación solo trae publicaciones; un proyecto se registra a mano y
    se consolida igual cuando el consejo lo aprueba."""
    rechazada = profesor.post(IMPORT_URL, json=[{**OBRA_ORCID, "type": "proyecto"}])
    assert rechazada.status_code == 422

    product_id = _cargar(profesor, PROYECTO)
    _aprobar(_sesion(CONSEJERO), product_id)

    detalle = TestClient(app).get(f"{CATALOG_URL}/{product_id}").json()
    assert detalle["type"] == "proyecto"
    assert detalle["project_code"] == PROYECTO["project_code"]
    assert detalle["source"] == "manual"


# --- Unicidad (CA37) --------------------------------------------------------------------------


def test_cp07_un_doi_repetido_en_el_mismo_envio_no_pierde_el_resto_del_lote(profesor, db_session):
    """CP-07 · CA37: ORCID puede devolver la misma obra dos veces en una sola respuesta.

    El duplicado se descarta y las obras nuevas del mismo envío se guardan: antes la
    restricción única saltaba al confirmar y el rollback se llevaba el lote entero.
    """
    envio = [
        OBRA_ORCID,
        {**OBRA_ORCID, "external_id": "put-code-5002"},  # mismo DOI, otro put-code
        {**OBRA_ORCID, "external_id": "put-code-5003", "doi": "10.5555/ecmc.2024.orcid.9",
         "title": "Obra distinta y válida"},
    ]

    respuesta = profesor.post(IMPORT_URL, json=envio)

    assert respuesta.status_code == 200
    assert [obra["external_id"] for obra in respuesta.json()] == ["put-code-5001", "put-code-5003"]
    assert db_session.query(Product).count() == 2


def test_cp08_un_put_code_repetido_en_el_mismo_envio_tampoco_pierde_el_lote(profesor, db_session):
    """CP-08 · CA37: el mismo identificador externo repetido en un envío se importa una vez."""
    envio = [
        OBRA_ORCID,
        {**OBRA_ORCID, "doi": "10.5555/ecmc.2024.orcid.2", "title": "Mismo put-code, otro DOI"},
        {**OBRA_ORCID, "external_id": "put-code-5004", "doi": "10.5555/ecmc.2024.orcid.3",
         "title": "Obra distinta y válida"},
    ]

    respuesta = profesor.post(IMPORT_URL, json=envio)

    assert respuesta.status_code == 200
    assert [obra["external_id"] for obra in respuesta.json()] == ["put-code-5001", "put-code-5004"]
    assert db_session.query(Product).count() == 2


def test_cp09_el_put_code_es_unico_por_profesor_y_el_doi_para_toda_la_escuela(directorio, db_session):
    """CP-09 · CA37: dos profesores pueden tener el mismo put-code en sus perfiles de ORCID,
    porque la numeración es de cada perfil; lo que no se repite nunca es el DOI."""
    una = _sesion(PROFESOR)
    otra = _sesion(OTRO_PROFESOR)
    assert una.post(IMPORT_URL, json=[OBRA_ORCID]).status_code == 200

    misma_obra = otra.post(IMPORT_URL, json=[OBRA_ORCID])
    otra_obra_mismo_put_code = otra.post(
        IMPORT_URL, json=[{**OBRA_ORCID, "doi": "10.5555/ecmc.2024.orcid.4", "title": "Otra obra"}]
    )

    assert misma_obra.json() == []  # el DOI ya estaba: no se duplica
    assert len(otra_obra_mismo_put_code.json()) == 1  # el put-code repetido sí vale, es de otro perfil
    assert db_session.query(Product).count() == 2


def test_cp10_el_doi_de_una_publicacion_rechazada_sigue_reservado(consejo, profesor, directorio):
    """CP-10 · CA37 con RU-01: la unicidad vale en cualquier estado.

    Un rechazo no libera el DOI: el registro se conserva para seguimiento, así que volver a
    cargarlo crearía el duplicado que la regla quiere evitar. Lo que corresponde es corregir
    el registro existente, no abrir otro.
    """
    product_id = _cargar(profesor, PUBLICACION)
    assert _decidir(_sesion(CONSEJERO), product_id, "rechazado", MOTIVO).status_code == 200

    de_nuevo_a_mano = _sesion(OTRO_PROFESOR).post(PRODUCTS_URL, json=PUBLICACION)
    por_orcid = profesor.post(
        IMPORT_URL, json=[{**OBRA_ORCID, "doi": PUBLICACION["doi"]}]
    )

    assert de_nuevo_a_mano.status_code == 409
    assert por_orcid.json() == []


def test_cp11_el_codigo_de_proyecto_es_unico_entre_profesores(profesor, directorio):
    """CP-11 · CA37 con RU-01: el proyecto se identifica por su código institucional, que es
    uno solo para toda la Escuela aunque lo registren distintos participantes."""
    _cargar(profesor, PROYECTO)

    respuesta = _sesion(OTRO_PROFESOR).post(
        PRODUCTS_URL, json={**PROYECTO, "title": "El mismo proyecto escrito por el coautor"}
    )

    assert respuesta.status_code == 409


# --- Permisos (CA38) --------------------------------------------------------------------------


def test_cp12_un_consejero_dado_de_baja_ya_no_puede_revisar(consejo, profesor, db_session):
    """CP-12 · CA38: el permiso se comprueba al revisar, no solo al entrar.

    El token dura hasta una hora, así que una cuenta desactivada todavía tiene una sesión
    válida en la mano; sin esta comprobación seguía aprobando y rechazando con ella.
    """
    product_id = _cargar(profesor, PUBLICACION)
    consejero = _sesion(CONSEJERO)

    consejo.is_active = False
    db_session.add(consejo)
    db_session.commit()

    assert _decidir(consejero, product_id, "verificado").status_code == 403
    assert consejero.get(QUEUE_URL).status_code == 403
    db_session.expire_all()
    assert db_session.get(Product, product_id).status == "cargado"


def test_cp13_revisar_un_producto_que_no_existe_responde_404(consejo):
    """CP-13 · CA38: un id que no existe no es un error de permisos ni una petición mal
    formada; es que no hay nada que revisar."""
    assert _decidir(_sesion(CONSEJERO), "no-existe", "verificado").status_code == 404


def test_cp14_una_decision_ya_tomada_no_se_cambia_ni_por_el_consejo(consejo, profesor, db_session):
    """CP-14 · CA36: la decisión queda firme. PR-HU12-03 ya comprueba que un profesor no puede
    alterarla; aquí ni siquiera el consejo puede, y por la API."""
    product_id = _cargar(profesor, PUBLICACION)
    consejero = _sesion(CONSEJERO)
    _aprobar(consejero, product_id)

    respuesta = _decidir(consejero, product_id, "rechazado", "Me arrepentí")

    assert respuesta.status_code == 400
    db_session.expire_all()
    guardado = db_session.get(Product, product_id)
    assert guardado.status == "verificado"
    assert guardado.review_reason is None


def test_cp15_el_consejero_no_registra_ni_importa_produccion_con_su_cuenta(consejo):
    """CP-15 · CA38: una cuenta tiene un solo rol, así que la del consejo solo revisa.

    Queda documentado para el cliente: si un miembro del consejo también publica, necesita que
    su producción entre por la cuenta de profesor, no por la del consejo.
    """
    consejero = _sesion(CONSEJERO)

    assert consejero.post(PRODUCTS_URL, json=PUBLICACION).status_code == 403
    assert consejero.post(IMPORT_URL, json=[OBRA_ORCID]).status_code == 403
