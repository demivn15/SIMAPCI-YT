"""
Pruebas de los filtros comunes de métricas y de los endpoints de redes y ficha del profesor.

Escuela de prueba (solo cuentan las obras «verificado»):
    P1 2016 Ana+Luis   Q1  journal-article      Yachay sí   UPC, MIT, Yachay   EC, ES, US
    P2 2020 Ana        Q3  book-chapter         Yachay no   UPC, YACHAY TECH   EC, ES
    P3 2021 Luis+Pía   —   (sin indicadores)
    P4 2024 Luis+Pía   Q2  journal-article      Yachay sí   UPC, MIT           US
    P5 2023 Eva        Q4  proceedings-article  Yachay sí   UPC                ES
    P6 2025 Ana+Luis   «cargado»   (no cuenta)                Secreta            FR
    P7 2024 Pía+Eva    «rechazado» (no cuenta)
Departamentos: Ana Matemáticas, Luis y Pía Computación, Eva Desarrollo Humano.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.product import Product
from app.models.product_bibliometrics import ProductBibliometrics
from app.models.user import User

client = TestClient(app)

CD = "Ciencia de datos"
IA = "Inteligencia artificial"
CTS = "Ciencia, Tecnología y Sociedad"


def _user(db, username, name, department=None, role="professor"):
    user = User(username=username, email=f"{username}@yachaytech.edu.ec", full_name=name,
                department=department, role=role)
    db.add(user)
    db.flush()
    return user


def _product(db, owner, title, year, authors, line, status="verificado", **metrics):
    product = Product(
        owner_id=owner.id, school="ECMC", type="publicacion", title=title, authors=authors,
        year=year, research_line=line, status=status, source="manual",
    )
    db.add(product)
    db.flush()
    if metrics:
        db.add(ProductBibliometrics(product_id=product.id, **metrics))
    return product


@pytest.fixture
def school(db_session):
    ana = _user(db_session, "ana", "Ana Morales", "Matemáticas")
    luis = _user(db_session, "luis", "Luis Paredes", "Computación")
    pia = _user(db_session, "pia", "Pía Torres", "Computación")
    eva = _user(db_session, "eva", "Eva Ruiz", "Desarrollo Humano")
    idle = _user(db_session, "idle", "Sin Obras", "Matemáticas")
    reviewer = _user(db_session, "rev", "Rita Revisora", role="reviewer")

    _product(db_session, ana, "P1", 2016, ["Ana Morales", "Luis Paredes"], CD, citations=10, sjr_quartile="Q1",
             contribution_type="journal-article", yachay_affiliation="si",
             institutions=["Universidad Yachay Tech", "UPC", "MIT"], countries=["EC", "ES", "US"])
    _product(db_session, ana, "P2", 2020, ["Ana Morales"], IA, citations=3, sjr_quartile="Q3",
             contribution_type="book-chapter", yachay_affiliation="no",
             institutions=["YACHAY TECH", "UPC"], countries=["EC", "ES"])
    _product(db_session, luis, "P3", 2021, ["Luis Paredes", "Pía Torres"], CD)
    _product(db_session, luis, "P4", 2024, ["Luis Paredes", "Pía Torres"], IA, citations=None, sjr_quartile="Q2",
             contribution_type="journal-article", yachay_affiliation="si",
             institutions=["UPC", "MIT"], countries=["US"])
    _product(db_session, eva, "P5", 2023, ["Eva Ruiz"], CTS, citations=1, sjr_quartile="Q4",
             contribution_type="proceedings-article", yachay_affiliation="si",
             institutions=["UPC"], countries=["ES"])
    _product(db_session, ana, "P6", 2025, ["Ana Morales", "Luis Paredes"], CD, status="cargado",
             citations=500, institutions=["Secreta"], countries=["FR"], contribution_type="dataset")
    _product(db_session, pia, "P7", 2024, ["Pía Torres", "Eva Ruiz"], CD, status="rechazado")
    db_session.commit()
    return {"ana": ana, "luis": luis, "pia": pia, "eva": eva, "idle": idle, "reviewer": reviewer}


def _total(**params):
    response = client.get("/api/v1/metrics/overview", params=params)
    assert response.status_code == 200, response.text
    return response.json()["total_products"]


# ---------------------------------------------------------------------------
# Filtros comunes
# ---------------------------------------------------------------------------

def test_without_filters_only_verified_count(school):
    assert _total() == 5


@pytest.mark.parametrize(
    ("params", "expected"),
    [
        ({"department": "Matemáticas"}, 2),  # P1 y P2
        ({"department": "Computación"}, 3),  # P1 (por Luis), P3 y P4
        ({"department": "Desarrollo Humano"}, 1),
        ({"department": "Física"}, 0),
        ({"year_from": 2020, "year_to": 2023}, 3),
        ({"affiliation": "yachay"}, 3),
        ({"affiliation": "all"}, 5),
        ({"contribution_type": "journal-article"}, 2),
        ({"contribution_type": "dataset"}, 0),  # solo existe en una obra «cargado»
        ({"quartile": "Q1"}, 1),
        ({"quartile": "sin_cuartil"}, 1),  # P3 no tiene fila de indicadores
        ({"department": "Computación", "affiliation": "yachay", "quartile": "Q2"}, 1),
        ({"department": "Computación", "year_from": 2016, "year_to": 2021, "contribution_type": "journal-article"}, 1),
    ],
)
def test_each_filter_and_combinations(school, params, expected):
    assert _total(**params) == expected


def test_inverted_years_are_swapped(school):
    data = client.get("/api/v1/metrics/overview", params={"year_from": 2021, "year_to": 2016}).json()
    assert data["total_products"] == 3
    assert (data["year_from"], data["year_to"]) == (2016, 2021)


@pytest.mark.parametrize(
    "params", [{"quartile": "Q5"}, {"affiliation": "todos"}, {"year_from": "dos mil"}, {"year_to": 1800}]
)
def test_invalid_filters_are_rejected(school, params):
    assert client.get("/api/v1/metrics/overview", params=params).status_code == 422


def test_filters_apply_to_every_metric_endpoint(school):
    params = {"department": "Desarrollo Humano"}
    assert [i["year"] for i in client.get("/api/v1/metrics/timeline", params=params).json()["items"]] == [2023]
    assert [i["full_name"] for i in client.get("/api/v1/metrics/professors", params=params).json()["items"]] == [
        "Eva Ruiz"
    ]
    assert len(client.get("/api/v1/metrics/collaboration", params=params).json()["nodes"]) == 1
    assert client.get("/api/v1/metrics/network", params=params).json()["summary"]["nodes"] == 1
    assert client.get("/api/v1/metrics/networks/coauthorship", params=params).json()["edges"] == []


def test_overview_reports_contribution_types_and_timeline_known_citations(school):
    data = client.get("/api/v1/metrics/overview").json()
    assert data["contribution_types"] == [
        {"contribution_type": "journal-article", "count": 2},
        {"contribution_type": "book-chapter", "count": 1},
        {"contribution_type": "proceedings-article", "count": 1},
        {"contribution_type": None, "count": 1},
    ]
    items = {i["year"]: i for i in client.get("/api/v1/metrics/timeline").json()["items"]}
    assert (items[2024]["citations"], items[2024]["products_with_citations"]) == (0, 0)  # desconocida, no 0
    assert (items[2016]["citations"], items[2016]["products_with_citations"]) == (10, 1)


def test_filter_options(school):
    data = client.get("/api/v1/metrics/filters").json()
    assert data["departments"] == ["Computación", "Desarrollo Humano", "Matemáticas"]
    assert (data["year_min"], data["year_max"]) == (2016, 2024)
    assert data["affiliations"] == ["all", "yachay"]
    assert data["contribution_types"] == [
        {"value": "journal-article", "count": 2},
        {"value": "book-chapter", "count": 1},
        {"value": "proceedings-article", "count": 1},
    ]
    assert data["quartiles"] == [
        {"value": "Q1", "count": 1}, {"value": "Q2", "count": 1}, {"value": "Q3", "count": 1},
        {"value": "Q4", "count": 1}, {"value": "sin_cuartil", "count": 1},
    ]


def test_filter_options_on_empty_catalogue():
    data = client.get("/api/v1/metrics/filters").json()
    assert data["departments"] == [] and data["year_min"] is None and data["contribution_types"] == []


# ---------------------------------------------------------------------------
# Redes
# ---------------------------------------------------------------------------

def test_professors_include_department_betweenness_and_community(school):
    items = {i["full_name"]: i for i in client.get("/api/v1/metrics/professors").json()["items"]}
    assert set(items) == {"Ana Morales", "Luis Paredes", "Pía Torres", "Eva Ruiz"}
    assert items["Luis Paredes"]["department"] == "Computación"
    # Luis es el único puente entre Ana y Pía: 1 de los 3 pares posibles entre los otros.
    assert items["Luis Paredes"]["betweenness"] == pytest.approx(0.3333, abs=1e-4)
    assert items["Ana Morales"]["betweenness"] == 0.0
    assert items["Ana Morales"]["community"] == items["Luis Paredes"]["community"] == items["Pía Torres"]["community"]
    assert items["Eva Ruiz"]["community"] != items["Ana Morales"]["community"]


def test_network_summary_and_centralities(school):
    data = client.get("/api/v1/metrics/network").json()
    summary = data["summary"]
    assert (summary["nodes"], summary["edges"], summary["components"], summary["largest_component"]) == (4, 2, 2, 3)
    assert summary["density"] == pytest.approx(2 / 6, abs=1e-4)
    assert summary["communities"] == 2
    professors = {p["full_name"]: p for p in data["professors"]}
    assert data["professors"][0]["full_name"] == "Luis Paredes"  # ordenados por intermediación
    luis = professors["Luis Paredes"]
    assert (luis["degree"], luis["strength"]) == (2, 3)  # Ana (P1) + Pía (P3, P4)
    assert luis["eigenvector"] > professors["Ana Morales"]["eigenvector"] > 0
    assert professors["Eva Ruiz"]["eigenvector"] == 0.0
    assert set(luis) >= {
        "betweenness", "betweenness_weighted", "closeness", "clustering", "community", "department",
        "products", "main_research_line",
    }


def test_coauthorship_excludes_unverified_products(school):
    data = client.get("/api/v1/metrics/networks/coauthorship").json()
    ids = {school[k].id: k for k in ("ana", "luis", "pia", "eva")}
    edges = {(ids[e["source"]], ids[e["target"]]) if ids[e["source"]] < ids[e["target"]]
             else (ids[e["target"]], ids[e["source"]]): e["weight"] for e in data["edges"]}
    # P6 («cargado») no suma a Ana-Luis y P7 («rechazado») no crea Pía-Eva.
    assert edges == {("ana", "luis"): 1, ("luis", "pia"): 2}
    node = next(n for n in data["nodes"] if n["id"] == school["luis"].id)
    assert set(node) == {"id", "full_name", "department", "products", "main_research_line", "community",
                         "betweenness", "degree"}


def test_institutions_network_excludes_yachay_and_respects_min_count(school):
    data = client.get("/api/v1/metrics/networks/institutions").json()
    assert data["min_count"] == 3
    institutions = {n["label"]: n["count"] for n in data["nodes"] if n["kind"] == "institution"}
    assert institutions == {"UPC": 4}  # MIT solo en 2 obras; «Secreta» está en una obra no verificada
    professors = {n["label"] for n in data["nodes"] if n["kind"] == "professor"}
    assert professors == {"Ana Morales", "Luis Paredes", "Pía Torres", "Eva Ruiz"}
    assert not any("yachay" in n["label"].lower() for n in data["nodes"])

    low = client.get("/api/v1/metrics/networks/institutions", params={"min_count": 2}).json()
    assert {n["label"] for n in low["nodes"] if n["kind"] == "institution"} == {"UPC", "MIT"}
    edge = next(e for e in low["edges"] if e["source"] == school["luis"].id and e["target"] == "inst:MIT")
    assert edge["weight"] == 2  # P1 y P4
    assert client.get("/api/v1/metrics/networks/institutions", params={"min_count": 0}).status_code == 422


def test_countries_network_excludes_ecuador(school):
    data = client.get("/api/v1/metrics/networks/countries").json()
    countries = {n["label"]: n["count"] for n in data["nodes"] if n["kind"] == "country"}
    assert countries == {"ES": 3, "US": 2}  # EC es el país propio; FR solo en una obra no verificada
    assert {n["kind"] for n in data["nodes"]} == {"professor", "country"}


def test_research_lines_network(school):
    data = client.get("/api/v1/metrics/networks/research-lines").json()
    assert {n["label"]: n["products"] for n in data["nodes"]} == {CD: 2, IA: 2, CTS: 1}
    # Ana, Luis y Pía publican en las dos líneas; Eva solo en CTS.
    assert data["edges"] == [{"source": CD, "target": IA, "weight": 3}]


def test_periods_network_default_and_custom(school):
    periods = client.get("/api/v1/metrics/networks/periods").json()["periods"]
    assert [p["label"] for p in periods] == ["2014–2018", "2019–2022", "2023–2026"]
    assert [(p["summary"]["nodes"], p["summary"]["edges"], p["products"]) for p in periods] == [
        (2, 1, 1), (3, 1, 2), (3, 1, 2),
    ]
    custom = client.get("/api/v1/metrics/networks/periods", params={"periods": "2020-2016,2021-2024"}).json()
    assert [(p["year_from"], p["year_to"]) for p in custom["periods"]] == [(2016, 2020), (2021, 2024)]
    assert client.get("/api/v1/metrics/networks/periods", params={"periods": "2016"}).status_code == 422


# ---------------------------------------------------------------------------
# Ficha del profesor
# ---------------------------------------------------------------------------

def test_professor_profile(school):
    response = client.get(f"/api/v1/metrics/professors/{school['luis'].id}")
    assert response.status_code == 200
    data = response.json()
    assert (data["full_name"], data["department"], data["products"]) == ("Luis Paredes", "Computación", 3)
    assert data["citations"] == 10 and data["h_index"] == 1
    assert [c["full_name"] for c in data["coauthors"]] == ["Pía Torres", "Ana Morales"]  # por peso
    assert [c["weight"] for c in data["coauthors"]] == [2, 1]
    assert len(data["ego_network"]["nodes"]) == 3 and len(data["ego_network"]["edges"]) == 2
    assert sum(n["is_center"] for n in data["ego_network"]["nodes"]) == 1
    assert data["network"]["betweenness_rank"] == 1 and data["network"]["network_size"] == 4
    assert {i["name"] for i in data["institutions"]} == {"UPC", "MIT"}
    assert {c["code"] for c in data["countries"]} == {"ES", "US"}
    assert [p["year"] for p in data["timeline"]] == [2016, 2021, 2024]
    assert "email" not in response.text and "username" not in response.text
    assert "luis@yachaytech.edu.ec" not in response.text


def test_professor_profile_not_found_cases(school):
    for professor_id in ("no-existe", school["reviewer"].id, school["idle"].id):
        response = client.get(f"/api/v1/metrics/professors/{professor_id}")
        assert response.status_code == 404
        assert response.json()["detail"] == "Profesor no encontrado."
    # Existe y tiene obras, pero los filtros las dejan fuera.
    filtered = client.get(f"/api/v1/metrics/professors/{school['luis'].id}", params={"department": "Desarrollo Humano"})
    assert filtered.status_code == 404
    assert "filtros" in filtered.json()["detail"]
    # Con filtros, un profesor sin obras sigue siendo «no encontrado».
    idle = client.get(f"/api/v1/metrics/professors/{school['idle'].id}", params={"year_from": 2020})
    assert idle.json()["detail"] == "Profesor no encontrado."


def test_network_endpoints_are_public_and_empty_safe():
    assert client.get("/api/v1/metrics/network").json()["summary"]["nodes"] == 0
    assert client.get("/api/v1/metrics/networks/coauthorship").json()["nodes"] == []
    assert client.get("/api/v1/metrics/networks/institutions").json()["nodes"] == []
    assert client.get("/api/v1/metrics/networks/countries").json()["nodes"] == []
    assert client.get("/api/v1/metrics/networks/research-lines").json() == {"nodes": [], "edges": []}
    assert all(p["summary"]["nodes"] == 0 for p in client.get("/api/v1/metrics/networks/periods").json()["periods"])
