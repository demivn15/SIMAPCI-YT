"""
T-HU12-04 (PGPCECMC-97) - La aprobación conectada con el catálogo consolidado, con las
consultas y con las notificaciones de HU08. Criterios CA34, CA36 y CA23.

CA36: «Dado que el Comité Revisor aprueba una publicación manual, cuando registra la
       decisión, entonces la publicación queda verificada, entra al catálogo consolidado y
       el profesor recibe la notificación correspondiente.»

La decisión en sí (estado, responsable, fecha y motivo) ya se prueba en
tests/backend/test_council_review.py y en tests/acceptance/test_pr_hu12_02.py. Aquí se prueba
lo que la decisión DESENCADENA, que es lo que esta tarea conecta:

  - catálogo       -> lo aprobado se puede consultar; lo pendiente y lo rechazado, no;
  - consultas      -> el catálogo responde sin sesión y sin exponer el expediente de revisión;
  - notificaciones -> la decisión le llega al autor por la consulta de HU08 (T-HU08-06).
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.product import Product
from app.models.user import User
from app.services.ldap_service import LDAPService

PRODUCTS_URL = "/api/v1/products"
CATALOG_URL = f"{PRODUCTS_URL}/catalog"
NOTIFICATIONS_URL = "/api/v1/notifications"
MOTIVO = "La revista no está indexada en las bases aceptadas por la ECMC."

PUBLICACION = {
    "type": "publicacion",
    "title": "Modelos de difusión para series climáticas de la Sierra",
    "authors": ["María García"],
    "year": 2025,
    "research_line": "Ciencia de datos",
    "doi": "10.5555/ecmc.2025.100",
    "venue": "Revista Ecuatoriana de Matemática Aplicada",
    "abstract": "Resumen de la publicación.",
}


def _sembrar_catalogo_para_filtros(db_session):
    ana = User(
        username="ana_filtros",
        email="ana_filtros@yachaytech.edu.ec",
        full_name="Ana Morales Vega",
        role="professor",
    )
    beto = User(
        username="beto_filtros",
        email="beto_filtros@yachaytech.edu.ec",
        full_name="Beto Salazar",
        role="professor",
    )
    db_session.add_all([ana, beto])
    db_session.flush()

    productos = [
        Product(
            owner_id=ana.id,
            school="ECMC",
            type="publicacion",
            title="Optimización de rutas de Ibarra",
            authors=["Lucía Morales"],
            year=2025,
            research_line="Computación científica",
            status="verificado",
            source="manual",
        ),
        Product(
            owner_id=ana.id,
            school="ECMC",
            type="publicacion",
            title="Optimizacion de datos científicos",
            authors=["Ana Morales"],
            year=2024,
            research_line="Computación científica",
            status="verificado",
            source="manual",
        ),
        Product(
            owner_id=ana.id,
            school="ECMC",
            type="proyecto",
            title="Optimización de un proyecto",
            authors=["Ana Morales"],
            year=2025,
            research_line="Computación científica",
            status="verificado",
            source="manual",
        ),
        Product(
            owner_id=beto.id,
            school="ECMC",
            type="publicacion",
            title="Optimización pendiente",
            authors=["Beto Salazar"],
            year=2025,
            research_line="Computación científica",
            status="cargado",
            source="manual",
        ),
    ]
    db_session.add_all(productos)
    db_session.commit()
    return ana, productos


def _login(monkeypatch, username: str) -> TestClient:
    """Sesión real: el login crea o recupera el perfil y emite la cookie con el rol de la cuenta."""
    monkeypatch.setattr(
        LDAPService,
        "authenticate_and_authorize_professor",
        classmethod(lambda cls, username, password: {
            "username": username,
            "full_name": username.capitalize(),
            "email": f"{username}@yachaytech.edu.ec",
        }),
    )
    cliente = TestClient(app)
    assert cliente.post("/api/v1/auth/login", json={"username": username, "password": "x"}).status_code == 200
    return cliente


@pytest.fixture
def profesor(monkeypatch) -> TestClient:
    return _login(monkeypatch, "autora")


@pytest.fixture
def consejero(monkeypatch, db_session) -> TestClient:
    """Miembro del consejo.

    La cuenta se crea con rol 'reviewer' ANTES del login, porque el token lleva el rol que
    tenía la cuenta en ese momento (defecto D-05, corregido en T-HU08-05).
    """
    db_session.add(
        User(
            username="consejo1",
            email="consejo1@yachaytech.edu.ec",
            full_name="Consejo ECMC",
            role="reviewer",
        )
    )
    db_session.commit()
    return _login(monkeypatch, "consejo1")


@pytest.fixture
def publico() -> TestClient:
    """Cualquiera, sin sesión: el catálogo es la producción publicada de la Escuela."""
    return TestClient(app)


def _cargar(profesor: TestClient, **cambios) -> str:
    """El profesor registra un producto y devuelve su id (queda en estado «cargado»)."""
    respuesta = profesor.post(PRODUCTS_URL, json={**PUBLICACION, **cambios})
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()["id"]


def _decidir(consejero: TestClient, product_id: str, decision: str, reason: str | None = None) -> None:
    cuerpo = {"decision": decision}
    if reason:
        cuerpo["reason"] = reason
    respuesta = consejero.patch(f"{PRODUCTS_URL}/{product_id}/review", json=cuerpo)
    assert respuesta.status_code == 200, respuesta.text


# --- Qué entra al catálogo (CA36, CA34) -----------------------------------------------------


def test_un_producto_recien_cargado_todavia_no_esta_en_el_catalogo(profesor, publico):
    """CA35: mientras espera revisión, el producto existe pero no es parte de la producción."""
    _cargar(profesor)

    cuerpo = publico.get(CATALOG_URL).json()

    assert cuerpo["total"] == 0
    assert cuerpo["items"] == []


def test_la_aprobacion_incorpora_el_producto_al_catalogo(profesor, consejero, publico):
    """CA36: aprobar es lo que hace consultable al producto; antes de la decisión no aparece."""
    product_id = _cargar(profesor)
    assert publico.get(CATALOG_URL).json()["total"] == 0

    _decidir(consejero, product_id, "verificado")

    cuerpo = publico.get(CATALOG_URL).json()
    assert cuerpo["total"] == 1
    assert cuerpo["items"][0]["id"] == product_id
    assert cuerpo["items"][0]["status"] == "verificado"


def test_un_producto_rechazado_no_entra_al_catalogo_pero_se_conserva(
    profesor, consejero, publico, db_session
):
    """CA36: la rechazada se guarda para seguimiento, fuera del catálogo."""
    product_id = _cargar(profesor)

    _decidir(consejero, product_id, "rechazado", MOTIVO)

    assert publico.get(CATALOG_URL).json()["total"] == 0
    assert db_session.get(Product, product_id) is not None


def test_una_obra_importada_de_orcid_esta_en_el_catalogo_sin_pasar_por_revision(profesor, publico):
    """CA34: lo que llega de ORCID nace verificado, así que se consolida sin decisión del Comité."""
    importadas = profesor.post(
        f"{PRODUCTS_URL}/orcid-import",
        json=[{
            "external_id": "orcid-work-7001",
            "title": "Aprendizaje profundo aplicado a la computación científica",
            "authors": ["Autora"],
            "year": 2024,
            "research_line": "Inteligencia artificial",
            "doi": "10.5555/ecmc.2024.orcid",
        }],
    )
    assert importadas.status_code == 200

    cuerpo = publico.get(CATALOG_URL).json()

    assert cuerpo["total"] == 1
    assert cuerpo["items"][0]["source"] == "orcid"


# --- Las consultas del catálogo -------------------------------------------------------------


def test_el_catalogo_se_consulta_sin_sesion(profesor, consejero, publico):
    """El catálogo consolidado es público: para leer la producción no hace falta cuenta."""
    _decidir(consejero, _cargar(profesor), "verificado")

    assert publico.get(CATALOG_URL).status_code == 200


def test_el_catalogo_no_expone_el_expediente_de_revision(profesor, consejero, publico):
    """El catálogo muestra la obra, no quién la revisó ni de quién es: es una consulta pública."""
    _decidir(consejero, _cargar(profesor), "verificado")

    item = publico.get(CATALOG_URL).json()["items"][0]

    for campo in ("owner_id", "reviewed_by", "reviewed_at", "review_reason", "external_id"):
        assert campo not in item
    # Y sí trae lo que describe la obra.
    assert item["title"] == PUBLICACION["title"]
    assert item["authors"] == PUBLICACION["authors"]
    assert item["research_line"] == PUBLICACION["research_line"]
    assert item["doi"] == PUBLICACION["doi"]


def test_el_detalle_de_un_producto_del_catalogo_se_consulta_sin_sesion(profesor, consejero, publico):
    """Hace falta para enlazar el `public_product_id` de la verificación previa de HU07 (RU-08)."""
    product_id = _cargar(profesor)
    _decidir(consejero, product_id, "verificado")

    respuesta = publico.get(f"{CATALOG_URL}/{product_id}")

    assert respuesta.status_code == 200
    assert respuesta.json()["id"] == product_id
    assert "review_reason" not in respuesta.json()


def test_el_detalle_de_un_producto_pendiente_responde_404(profesor, publico):
    """Conocer el id no alcanza: lo que no está verificado no se puede leer desde fuera."""
    assert publico.get(f"{CATALOG_URL}/{_cargar(profesor)}").status_code == 404


def test_el_detalle_de_un_producto_rechazado_responde_404(profesor, consejero, publico):
    """El motivo del rechazo es asunto del Comité y del autor, no de la consulta pública."""
    product_id = _cargar(profesor)
    _decidir(consejero, product_id, "rechazado", MOTIVO)

    respuesta = publico.get(f"{CATALOG_URL}/{product_id}")

    assert respuesta.status_code == 404
    assert MOTIVO not in respuesta.text


def test_el_detalle_de_un_id_inexistente_responde_404(publico):
    assert publico.get(f"{CATALOG_URL}/no-existe").status_code == 404


# --- Orden y paginación ---------------------------------------------------------------------


def test_el_catalogo_llega_de_la_produccion_mas_reciente_a_la_mas_antigua(
    profesor, consejero, publico
):
    for anio in (2023, 2025, 2024):
        _decidir(
            consejero,
            _cargar(profesor, year=anio, title=f"Producción {anio}", doi=f"10.5555/ecmc.{anio}.ord"),
            "verificado",
        )

    items = publico.get(CATALOG_URL).json()["items"]

    assert [item["year"] for item in items] == [2025, 2024, 2023]


def test_la_paginacion_del_catalogo_devuelve_la_pagina_pedida(profesor, consejero, publico):
    for anio in (2021, 2022, 2023, 2024, 2025):
        _decidir(
            consejero,
            _cargar(profesor, year=anio, title=f"Producción {anio}", doi=f"10.5555/ecmc.{anio}.pag"),
            "verificado",
        )

    cuerpo = publico.get(CATALOG_URL, params={"limit": 2, "offset": 2}).json()

    # Orden descendente por año: 2025, 2024, | 2023, 2022, | 2021
    assert cuerpo["total"] == 5
    assert [item["year"] for item in cuerpo["items"]] == [2023, 2022]


def test_los_filtros_se_combinan_antes_de_contar_y_paginar(db_session, publico):
    ana, productos = _sembrar_catalogo_para_filtros(db_session)
    params = {
        "q": "OPTIMIZACION",
        "type": "publicacion",
        "owner_id": ana.id,
        "year_from": 2024,
        "year_to": 2025,
        "research_line": "Computación científica",
        "limit": 1,
        "offset": 0,
    }

    primera = publico.get(CATALOG_URL, params=params).json()
    segunda = publico.get(CATALOG_URL, params={**params, "offset": 1}).json()

    assert primera["total"] == 2
    assert primera["items"][0]["id"] == productos[0].id
    assert segunda["total"] == 2
    assert segunda["items"][0]["id"] == productos[1].id


def test_busqueda_del_catalogo_incluye_autores_y_no_distingue_tildes(db_session, publico):
    _, productos = _sembrar_catalogo_para_filtros(db_session)

    response = publico.get(CATALOG_URL, params={"q": "lucia"})

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["id"] == productos[0].id


def test_las_opciones_de_profesor_solo_incluyen_productores_publicados(db_session, publico):
    ana, _ = _sembrar_catalogo_para_filtros(db_session)

    response = publico.get(f"{CATALOG_URL}/professors")

    assert response.status_code == 200
    assert response.json() == [{"id": ana.id, "full_name": "Ana Morales Vega"}]


@pytest.mark.parametrize(
    "params", [{"limit": 0}, {"limit": 500}, {"offset": -1}],
    ids=["limite-cero", "limite-enorme", "offset-negativo"],
)
def test_una_paginacion_invalida_del_catalogo_se_rechaza(publico, params):
    """La página tiene límites: una consulta pública no puede pedir la tabla entera."""
    assert publico.get(CATALOG_URL, params=params).status_code == 422


# --- La decisión le llega al autor por las notificaciones de HU08 (CA23) ----------------------


def test_la_aprobacion_le_llega_al_profesor_como_notificacion(profesor, consejero):
    """CA36 con HU08: el autor se entera por su propia consulta de notificaciones (T-HU08-06)."""
    product_id = _cargar(profesor)

    _decidir(consejero, product_id, "verificado")

    avisos = profesor.get(NOTIFICATIONS_URL).json()["items"]
    aprobacion = [a for a in avisos if a["product_id"] == product_id and a["title"] == "Producto aprobado"]
    assert len(aprobacion) == 1


def test_el_rechazo_le_llega_al_profesor_con_el_motivo(profesor, consejero):
    """CA23: un rechazo sin motivo no le sirve al autor para corregir."""
    product_id = _cargar(profesor)

    _decidir(consejero, product_id, "rechazado", MOTIVO)

    avisos = profesor.get(NOTIFICATIONS_URL).json()["items"]
    rechazo = [a for a in avisos if a["product_id"] == product_id and a["title"] == "Producto rechazado"]
    assert len(rechazo) == 1
    assert MOTIVO in rechazo[0]["message"]


def test_la_notificacion_de_aprobacion_apunta_al_producto_que_quedo_en_el_catalogo(
    profesor, consejero, publico
):
    """Las tres piezas que conecta esta tarea, de punta a punta: decisión, aviso y catálogo.

    El aviso le dice al autor que su producto «ha sido aprobado e incorporado al catálogo
    consolidado»; esta prueba comprueba que el producto del que habla es justamente el que
    desde ese momento se puede consultar.
    """
    product_id = _cargar(profesor)
    _decidir(consejero, product_id, "verificado")

    aviso = next(
        a for a in profesor.get(NOTIFICATIONS_URL).json()["items"] if a["title"] == "Producto aprobado"
    )
    detalle = publico.get(f"{CATALOG_URL}/{aviso['product_id']}")

    assert detalle.status_code == 200
    assert detalle.json()["title"] == PUBLICACION["title"]
