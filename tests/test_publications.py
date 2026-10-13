"""
File: tests/test_publications.py
Description: Protected CRUD, DOI existence validation (charter req. #5), PDF
             metadata autocomplete (req. #3), citation refresh and export
             (req. #9) for the "Publicación Científica" entity.

Crossref/OpenAlex are mocked so the suite runs fully offline.
"""

import io
import pytest
from reportlab.pdfgen import canvas

from app.integrations import crossref, openalex
from tests.conftest import log_test_step


def _fake_crossref_metadata(doi: str) -> dict:
    return {
        "doi": doi, "title": "A Hybrid Model for Andean Glacier Retreat",
        "venue": "Journal of Computational Science", "year": 2026,
        "authors": "Juan Pablo Astudillo León", "publication_type": "journal-article",
    }


@pytest.fixture(autouse = True)
def mock_crossref(monkeypatch):
    """Every test in this file gets a Crossref double unless it overrides lookup_doi."""
    monkeypatch.setattr(crossref, "lookup_doi", lambda doi: _fake_crossref_metadata(doi))
    monkeypatch.setattr(openalex, "get_citation_count_by_doi", lambda doi: 42)
    yield


def test_create_publication_without_doi_succeeds(client, signed_in):
    print("\n>>> CASO DE PRUEBA: Registro manual de una publicación SIN DOI (no requiere validación externa)")

    user, _, headers = signed_in(client)
    payload = {"title": "A first draft"}
    response = client.post("/publications", json = payload, headers = headers)

    log_test_step(
        step = "Creación de publicación manual sin DOI",
        method = "POST",
        endpoint = "/publications",
        payload = payload,
        response = response,
        expected_status = 201,
        success_message = "La publicación se creó con status='uploaded' y source='manual', pendiente del comité."
    )

    body = response.json()
    assert body["status"] == "uploaded", f"[FALLÓ] Se esperaba status 'uploaded', se obtuvo '{body['status']}'."
    assert body["source"] == "manual", f"[FALLÓ] Se esperaba source 'manual', se obtuvo '{body['source']}'."
    assert body["owner_id"] == user["id"], "[FALLÓ] El owner_id no corresponde al docente autenticado."
    print(f"[VERIFICACIÓN EXTRA] owner_id={body['owner_id']} coincide con el id del docente autenticado={user['id']}.")


def test_create_publication_with_a_valid_doi_succeeds(client, signed_in):
    print("\n>>> CASO DE PRUEBA: Registro de publicación CON DOI -> validación de existencia contra Crossref (mock)")

    _, _, headers = signed_in(client)
    payload = {"title": "Glacier retreat", "doi": "10.1000/xyz123"}
    response = client.post("/publications", json = payload, headers = headers)

    log_test_step(
        step = "Creación de publicación con un DOI que SÍ existe en Crossref",
        method = "POST",
        endpoint = "/publications",
        payload = payload,
        response = response,
        expected_status = 201,
        success_message = "El DOI fue validado contra Crossref y la publicación se registró correctamente."
    )

    body = response.json()
    assert body["doi"] == "10.1000/xyz123", "[FALLÓ] El DOI almacenado no coincide con el enviado."
    print(f"[VERIFICACIÓN EXTRA] Autocompletado desde Crossref -> venue='{body['venue']}', year={body['year']}, authors='{body['authors']}'.")


def test_create_publication_with_an_unknown_doi_is_rejected(client, signed_in, monkeypatch):
    print("\n>>> CASO DE PRUEBA: DOI que NO existe en Crossref -> 422 (requerimiento #5 del Charter: validación de existencia)")

    _, _, headers = signed_in(client)
    monkeypatch.setattr(crossref, "lookup_doi", lambda doi: None)
    print("[SIMULACIÓN] Crossref.lookup_doi() devuelve None (DOI inexistente) para esta prueba.")

    payload = {"title": "Ghost paper", "doi": "10.1000/does-not-exist"}
    response = client.post("/publications", json = payload, headers = headers)

    log_test_step(
        step = "Creación de publicación con un DOI inexistente en Crossref",
        method = "POST",
        endpoint = "/publications",
        payload = payload,
        response = response,
        expected_status = 422,
        success_message = "La API rechazó el DOI inexistente con 422 Unprocessable Content, sin crear el registro."
    )


def test_create_publication_with_a_duplicate_doi_is_rejected(client, signed_in):
    print("\n>>> CASO DE PRUEBA: Un DOI ya registrado en nuestra BD no puede registrarse dos veces (409 Conflict)")

    _, _, headers = signed_in(client)

    first_payload = {"title": "First", "doi": "10.1000/dup"}
    first_response = client.post("/publications", json = first_payload, headers = headers)
    log_test_step(
        step = "Primer registro de la publicación con DOI '10.1000/dup'",
        method = "POST",
        endpoint = "/publications",
        payload = first_payload,
        response = first_response,
        expected_status = 201,
        success_message = "La primera publicación con ese DOI se registró sin problema."
    )

    second_payload = {"title": "Second", "doi": "10.1000/dup"}
    second_response = client.post("/publications", json = second_payload, headers = headers)
    log_test_step(
        step = "Segundo intento de registro con el MISMO DOI '10.1000/dup'",
        method = "POST",
        endpoint = "/publications",
        payload = second_payload,
        response = second_response,
        expected_status = 409,
        success_message = "La API detectó el DOI duplicado y respondió 409 Conflict, evitando el registro repetido."
    )


def test_lookup_doi_reports_existence_and_registration_state(client, signed_in):
    print("\n>>> CASO DE PRUEBA: GET /publications/lookup-doi -> existencia en Crossref + ya_registrado en nuestra BD")

    _, _, headers = signed_in(client)

    not_registered = client.get("/publications/lookup-doi?doi=10.1000/xyz123", headers = headers)
    log_test_step(
        step = "Consulta de un DOI que existe en Crossref pero AÚN NO está en nuestra base de datos",
        method = "GET",
        endpoint = "/publications/lookup-doi?doi=10.1000/xyz123",
        payload = None,
        response = not_registered,
        expected_status = 200,
        success_message = "El DOI se reporta como existente en Crossref y NO registrado localmente."
    )
    assert not_registered.json()["exists"] is True, "[FALLÓ] Crossref debería reportar el DOI como existente."
    assert not_registered.json()["already_registered"] is False, "[FALLÓ] El DOI no debería estar aún en nuestra BD."

    create_payload = {"title": "Glacier retreat", "doi": "10.1000/xyz123"}
    client.post("/publications", json = create_payload, headers = headers)
    print(f"[ACCIÓN] Se registró la publicación con DOI='{create_payload['doi']}' para repetir la consulta.")

    now_registered = client.get("/publications/lookup-doi?doi=10.1000/xyz123", headers = headers)
    log_test_step(
        step = "Repetición de la misma consulta DOI, ahora que SÍ está registrado localmente",
        method = "GET",
        endpoint = "/publications/lookup-doi?doi=10.1000/xyz123",
        payload = None,
        response = now_registered,
        expected_status = 200,
        success_message = "El endpoint ahora reporta already_registered=True, reflejando el estado real de la BD."
    )
    assert now_registered.json()["already_registered"] is True, "[FALLÓ] Debería reportarse como ya registrado."


def test_extract_pdf_suggests_metadata_without_saving_anything(client, signed_in):
    _, _, headers = signed_in(client)

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer)
    pdf.setTitle("A Hybrid Model for Andean Glacier Retreat")
    pdf.setAuthor("Juan Pablo Astudillo León")
    pdf.drawString(100, 750, "Published 2026. DOI: 10.1000/xyz123")
    pdf.save()
    buffer.seek(0)

    response = client.post(
        "/publications/extract-pdf",
        files = {"file": ("paper.pdf", buffer, "application/pdf")},
        headers = headers
    )

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "A Hybrid Model for Andean Glacier Retreat"
    assert body["authors"] == "Juan Pablo Astudillo León"
    assert body["doi"] == "10.1000/xyz123"
    assert body["year"] == 2026

    # Nothing was persisted by the extraction call alone.
    assert client.get("/publications", headers = headers).json()["total"] == 0


def test_extract_pdf_rejects_a_non_pdf_file(client, signed_in):
    _, _, headers = signed_in(client)

    response = client.post(
        "/publications/extract-pdf",
        files = {"file": ("notes.txt", io.BytesIO(b"not a pdf"), "text/plain")},
        headers = headers
    )

    assert response.status_code == 422


def test_ownership_is_enforced_on_the_crud(client, signed_in):
    _, _, owner_headers = signed_in(client)
    _, _, other_headers = signed_in(client, username = "other", email = "other@yachaytech.edu.ec")

    created = client.post("/publications", json = {"title": "Owned by the first professor"}, headers = owner_headers)
    publication_id = created.json()["id"]

    forbidden = client.get(f"/publications/{publication_id}", headers = other_headers)
    assert forbidden.status_code == 403

    unauthenticated = client.get(f"/publications/{publication_id}")
    assert unauthenticated.status_code == 401


def test_editing_a_rejected_publication_resubmits_it(client, signed_in, admin_headers):
    _, _, headers = signed_in(client)

    created = client.post("/publications", json = {"title": "Needs revision"}, headers = headers).json()
    client.patch(
        f"/review/publications/{created['id']}",
        json = {"status": "rejected", "rejection_reason": "Missing venue."},
        headers = admin_headers
    )

    updated = client.patch(
        f"/publications/{created['id']}", json = {"venue": "Now with a venue"}, headers = headers
    )

    assert updated.status_code == 200
    assert updated.json()["status"] == "uploaded"
    assert updated.json()["rejection_reason"] is None


def test_refresh_citations_updates_the_count(client, signed_in):
    _, _, headers = signed_in(client)

    created = client.post(
        "/publications", json = {"title": "Cited paper", "doi": "10.1000/xyz123"}, headers = headers
    ).json()
    assert created["citation_count"] == 0

    refreshed = client.post(f"/publications/{created['id']}/refresh-citations", headers = headers)

    assert refreshed.status_code == 200
    assert refreshed.json()["citation_count"] == 42


def test_refresh_citations_requires_a_doi(client, signed_in):
    _, _, headers = signed_in(client)

    created = client.post("/publications", json = {"title": "No DOI here"}, headers = headers).json()
    response = client.post(f"/publications/{created['id']}/refresh-citations", headers = headers)

    assert response.status_code == 400


def test_export_my_publications_as_csv(client, signed_in):
    _, _, headers = signed_in(client)
    client.post("/publications", json = {"title": "Exportable paper"}, headers = headers)

    response = client.get("/publications/export?format=csv", headers = headers)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert b"Exportable paper" in response.content


def test_export_my_publications_as_xlsx_and_pdf(client, signed_in):
    _, _, headers = signed_in(client)
    client.post("/publications", json = {"title": "Exportable paper"}, headers = headers)

    xlsx = client.get("/publications/export?format=xlsx", headers = headers)
    pdf = client.get("/publications/export?format=pdf", headers = headers)

    assert xlsx.status_code == 200 and len(xlsx.content) > 0
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")


def test_delete_publication(client, signed_in):
    _, _, headers = signed_in(client)
    created = client.post("/publications", json = {"title": "To be deleted"}, headers = headers).json()

    deleted = client.delete(f"/publications/{created['id']}", headers = headers)
    assert deleted.status_code == 204

    assert client.get(f"/publications/{created['id']}", headers = headers).status_code == 404
