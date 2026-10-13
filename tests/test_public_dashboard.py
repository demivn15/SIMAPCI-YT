"""
File: tests/test_public_dashboard.py
Description: Public catalogue visibility rules (charter requirement #4) and
             the impact dashboard's metrics (objective: publicaciones por
             usuario, citas, índice h, evolución temporal).
"""

from app.services.metrics import compute_h_index
from tests.conftest import log_test_step


def _log_unit_case(description: str, input_counts: list[int], expected: int, actual: int) -> None:
    """Same report style as log_test_step, but for a pure function (no HTTP call)."""
    print("\n" + "=" * 90)
    print(f"PASO DE PRUEBA : {description}")
    print(f"FUNCIÓN        : app.services.metrics.compute_h_index()")
    print(f"ENTRADA (conteo de citas por publicación): {input_counts}")
    print(f"ÍNDICE H ESPERADO: {expected}  |  ÍNDICE H CALCULADO: {actual}")
    assert actual == expected, (
        f"[FALLÓ] compute_h_index({input_counts}) debía devolver {expected}, devolvió {actual}."
    )
    print(f"[ÉXITO] El índice h se calculó correctamente para esta distribución de citas.")
    print("=" * 90)


def test_h_index_is_computed_correctly():
    print("\n>>> CASO DE PRUEBA: Cálculo del índice h (métrica exigida por el Charter: 'índice h de los docentes')")

    # 3 papers cited >= 3 times (10, 8, 5), the 4th only cited twice -> h = 3.
    _log_unit_case("3 publicaciones con >=3 citas cada una, la 4ta con solo 2 -> h=3", [10, 8, 5, 2], 3, compute_h_index([10, 8, 5, 2]))
    _log_unit_case("Docente sin publicaciones -> h=0", [], 0, compute_h_index([]))
    _log_unit_case("Publicaciones sin ninguna cita -> h=0", [0, 0, 0], 0, compute_h_index([0, 0, 0]))
    _log_unit_case("5 publicaciones con 5 citas cada una -> h=5", [5, 5, 5, 5, 5], 5, compute_h_index([5, 5, 5, 5, 5]))


def test_public_catalogue_without_a_token_succeeds(client):
    assert client.get("/public/info").status_code == 200
    assert client.get("/public/publications").status_code == 200
    assert client.get("/public/projects").status_code == 200
    assert client.get("/public/dashboard").status_code == 200


def test_unverified_publications_are_hidden_from_the_public_catalogue(client, signed_in):
    _, _, headers = signed_in(client)
    client.post("/publications", json = {"title": "Still pending", "is_public": True}, headers = headers)

    response = client.get("/public/publications")

    assert response.status_code == 200
    assert response.json() == []


def test_verified_and_public_publications_appear_in_the_catalogue(client, signed_in, admin_headers):
    _, _, headers = signed_in(client)
    created = client.post(
        "/publications", json = {"title": "Visible paper", "is_public": True}, headers = headers
    ).json()
    client.patch(f"/review/publications/{created['id']}", json = {"status": "verified"}, headers = admin_headers)

    response = client.get("/public/publications")

    assert response.status_code == 200
    titles = [item["title"] for item in response.json()]
    assert titles == ["Visible paper"]


def test_verified_but_private_publications_stay_hidden(client, signed_in, admin_headers):
    _, _, headers = signed_in(client)
    created = client.post(
        "/publications", json = {"title": "Private paper", "is_public": False}, headers = headers
    ).json()
    client.patch(f"/review/publications/{created['id']}", json = {"status": "verified"}, headers = admin_headers)

    response = client.get("/public/publications")

    assert response.json() == []


def test_dashboard_reports_publications_citations_and_h_index(client, signed_in, admin_headers, monkeypatch):
    print("\n>>> CASO DE PRUEBA: GET /public/dashboard agrega publicaciones, citas, índice h y evolución temporal")

    from app.integrations import crossref
    monkeypatch.setattr(crossref, "lookup_doi", lambda doi: {
        "doi": doi, "title": "t", "venue": "v", "year": 2026, "authors": "a", "publication_type": "journal-article"
    })

    _, _, headers = signed_in(client)

    dois = ["10.1000/a1", "10.1000/a2", "10.1000/a3"]
    created_ids = []
    for doi in dois:
        created = client.post(
            "/publications", json = {"title": f"Paper {doi}", "doi": doi, "is_public": True}, headers = headers
        ).json()
        created_ids.append(created["id"])
    print(f"[PASO PREVIO] Se registraron 3 publicaciones con DOI para el docente 'jastudillo': ids={created_ids}")

    # Manually set distinct citation counts through the database to avoid
    # depending on a live OpenAlex call.
    from app.database import SessionLocal
    from app.models.publication import PublicationModel

    counts = [10, 3, 1]
    with SessionLocal() as db:
        for publication_id, count in zip(created_ids, counts):
            publication = db.query(PublicationModel).filter(PublicationModel.id == publication_id).first()
            publication.citation_count = count
            db.add(publication)
        db.commit()
    print(f"[SIMULACIÓN] Conteos de citas asignados (equivalentes a una sincronización con OpenAlex): {counts}")

    for publication_id in created_ids:
        decision = client.patch(
            f"/review/publications/{publication_id}", json = {"status": "verified"}, headers = admin_headers
        )
        print(f"[PASO PREVIO] Publicación {publication_id} verificada por el comité -> status {decision.status_code}")

    dashboard_response = client.get("/public/dashboard")
    log_test_step(
        step = "Consulta del dashboard público de métricas de impacto de la ECMC",
        method = "GET",
        endpoint = "/public/dashboard",
        payload = None,
        response = dashboard_response,
        expected_status = 200,
        success_message = "El dashboard devolvió correctamente las métricas agregadas por docente y por escuela."
    )

    dashboard = dashboard_response.json()
    professor_metrics = next(p for p in dashboard["professors"] if p["username"] == "jastudillo")

    print(f"MÉTRICAS DEL DOCENTE 'jastudillo': {professor_metrics}")
    print(f"CITAS POR PUBLICACIÓN (orden descendente): {sorted(counts, reverse = True)} -> índice h esperado = 2")

    assert professor_metrics["publications_count"] == 3, (
        f"[FALLÓ] Se esperaban 3 publicaciones, se reportaron {professor_metrics['publications_count']}."
    )
    assert professor_metrics["total_citations"] == 14, (
        f"[FALLÓ] Se esperaban 14 citas totales (10+3+1), se reportaron {professor_metrics['total_citations']}."
    )
    assert professor_metrics["h_index"] == 2, (  # 2 papers with >=2 citations (10, 3), the 3rd has only 1.
        f"[FALLÓ] Se esperaba índice h = 2, se calculó {professor_metrics['h_index']}."
    )
    print("[VERIFICACIÓN EXTRA] publications_count, total_citations e índice h del docente son correctos.")

    print(f"RESUMEN DE LA ESCUELA (summary): {dashboard['summary']}")
    assert dashboard["summary"]["total_publications"] == 3, "[FALLÓ] El total de publicaciones de la Escuela es incorrecto."
    assert dashboard["summary"]["total_citations"] == 14, "[FALLÓ] El total de citas de la Escuela es incorrecto."

    print(f"EVOLUCIÓN TEMPORAL (timeline): {dashboard['timeline']}")
    assert dashboard["timeline"] == [{"year": 2026, "publications_count": 3}], (
        "[FALLÓ] La evolución temporal de la producción de la Escuela no coincide con lo esperado."
    )
    print("[VERIFICACIÓN EXTRA] El resumen de la Escuela y la evolución temporal (timeline) son correctos.")


def test_public_export_of_verified_publications(client, signed_in, admin_headers):
    _, _, headers = signed_in(client)
    created = client.post(
        "/publications", json = {"title": "Exportable public paper", "is_public": True}, headers = headers
    ).json()
    client.patch(f"/review/publications/{created['id']}", json = {"status": "verified"}, headers = admin_headers)

    response = client.get("/public/publications/export?format=csv")

    assert response.status_code == 200
    assert b"Exportable public paper" in response.content
