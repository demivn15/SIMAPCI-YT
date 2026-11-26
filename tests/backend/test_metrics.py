"""
Pruebas de las métricas del dashboard - HU09 y HU10 (CA25, CA26, CA27, CA28).
Datos conocidos para comparar con el cálculo manual (en la línea de PR-HU09-01).
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.product import Product
from app.models.product_bibliometrics import ProductBibliometrics
from app.models.user import User
from app.services.metrics_service import h_index

client = TestClient(app)


@pytest.mark.parametrize(
    ("citations", "expected"),
    [
        ([], 0),
        ([0, 0], 0),
        ([10, 8, 5, 4, 3], 4),
        ([25, 8, 5, 3, 3], 3),
        ([1, 1, 1], 1),
        ([None, None, 7], 1),  # citas desconocidas no cuentan
        ([100], 1),
    ],
)
def test_h_index_standard_definition(citations, expected):
    assert h_index(citations) == expected


def _user(db, username, name):
    user = User(username=username, email=f"{username}@yachaytech.edu.ec", full_name=name)
    db.add(user)
    db.flush()
    return user


def _product(db, owner, title, year, authors, status="verificado", **metrics):
    product = Product(
        owner_id=owner.id, school="ECMC", type="publicacion", title=title, authors=authors,
        year=year, research_line="Ciencia de datos", status=status, source="manual",
    )
    db.add(product)
    db.flush()
    if metrics:
        db.add(ProductBibliometrics(product_id=product.id, **metrics))
    return product


@pytest.fixture
def school(db_session):
    ana = _user(db_session, "ana", "Ana Morales")
    luis = _user(db_session, "luis", "Luis Paredes")
    _user(db_session, "eva", "Eva Ruiz")  # sin obras (CA27)
    _product(db_session, ana, "A", 2024, ["Ana Morales", "Luis Paredes"], citations=10, sjr_quartile="Q1",
             countries=["EC", "ES"], institutions=["Universidad Yachay Tech", "UPC"], is_open_access=True,
             collaboration_type="internacional")
    _product(db_session, ana, "B", 2024, ["Ana Morales"], citations=3, sjr_quartile="Q3",
             is_open_access=False, collaboration_type="nacional")
    _product(db_session, luis, "C", 2025, ["Luis Paredes"], citations=None)  # citas desconocidas
    _product(db_session, luis, "D", 2025, ["Luis Paredes"])  # sin indicadores
    _product(db_session, ana, "Pendiente", 2025, ["Ana Morales"], status="cargado", citations=500)
    db_session.commit()
    return {"ana": ana, "luis": luis}


def test_overview_counts_only_verified_and_ignores_unknown_citations(school):
    data = client.get("/api/v1/metrics/overview").json()
    assert data["total_products"] == 4
    assert data["professors"] == 2
    assert data["citations_total"] == 13
    assert data["products_with_citations"] == 2
    assert data["h_index"] == 2
    assert data["quartiles"] == {"Q1": 1, "Q2": 0, "Q3": 1, "Q4": 0, "sin_cuartil": 2}
    assert data["q1_q2_share"] == 0.5
    assert data["open_access_share"] == 0.5
    assert data["international_share"] == 0.5
    assert (data["year_from"], data["year_to"]) == (2024, 2025)


def test_timeline_groups_by_year_and_quartile(school):
    items = client.get("/api/v1/metrics/timeline").json()["items"]
    assert [(i["year"], i["total"], i["Q1"], i["Q3"], i["sin_cuartil"]) for i in items] == [
        (2024, 2, 1, 1, 0),
        (2025, 2, 0, 0, 2),
    ]


def test_professors_credit_coauthorship_and_skip_professors_without_products(school):
    items = {i["full_name"]: i for i in client.get("/api/v1/metrics/professors").json()["items"]}
    assert set(items) == {"Ana Morales", "Luis Paredes"}
    assert (items["Ana Morales"]["products"], items["Ana Morales"]["citations"], items["Ana Morales"]["h_index"]) == (2, 13, 2)
    # Luis es coautor de «A» (dueña: Ana): la obra también cuenta para él.
    assert (items["Luis Paredes"]["products"], items["Luis Paredes"]["citations"], items["Luis Paredes"]["h_index"]) == (3, 10, 1)
    assert items["Luis Paredes"]["coauthored_in_school"] == 1


def test_collaboration_graph_and_external_partners(school):
    data = client.get("/api/v1/metrics/collaboration").json()
    assert {n["full_name"] for n in data["nodes"]} == {"Ana Morales", "Luis Paredes"}
    assert data["edges"] == [{
        "source": min(school["ana"].id, school["luis"].id),
        "target": max(school["ana"].id, school["luis"].id),
        "weight": 1,
    }]
    assert data["countries"] == [{"code": "ES", "count": 1}]  # Ecuador no es colaboración externa
    assert data["institutions"] == [{"name": "UPC", "count": 1}]


def test_metrics_are_public_and_empty_safe():
    assert client.get("/api/v1/metrics/overview").json()["h_index"] == 0
    assert client.get("/api/v1/metrics/collaboration").json() == {
        "nodes": [], "edges": [], "countries": [], "institutions": []
    }
