"""
File: tests/test_orcid.py
Description: ORCID-assisted sign-in and publication import (charter: replaces
             generic social login with ORCID, and automates registration of
             academic products). The ORCID servers themselves are mocked.
"""

from urllib.parse import parse_qs, urlparse
import pytest
from app.config import settings
from app.integrations import orcid_client
from tests.conftest import log_test_step


@pytest.fixture(autouse = True)
def configure_orcid(monkeypatch):
    """Pretend ORCID credentials are configured for every test in this file."""
    monkeypatch.setattr(settings, "ORCID_CLIENT_ID", "fake-client-id")
    monkeypatch.setattr(settings, "ORCID_CLIENT_SECRET", "fake-client-secret")
    yield


def test_orcid_login_is_unavailable_without_credentials(client, monkeypatch):
    print("\n>>> CASO DE PRUEBA: GET /orcid/login sin ORCID_CLIENT_ID/SECRET configurados -> 503 Service Unavailable")

    monkeypatch.setattr(settings, "ORCID_CLIENT_ID", None)
    monkeypatch.setattr(settings, "ORCID_CLIENT_SECRET", None)

    response = client.get("/orcid/login", follow_redirects = False)

    log_test_step(
        step = "Intento de iniciar el flujo ORCID sin credenciales configuradas en el servidor",
        method = "GET",
        endpoint = "/orcid/login",
        payload = None,
        response = response,
        expected_status = 503,
        success_message = "La API informó correctamente que la integración ORCID no está configurada."
    )


def test_orcid_login_redirects_to_orcid_with_a_state_cookie(client):
    print("\n>>> CASO DE PRUEBA: GET /orcid/login redirige al consent screen de ORCID con un 'state' anti-CSRF")

    response = client.get("/orcid/login", follow_redirects = False)

    print(f"ENDPOINT       : GET /orcid/login")
    print(f"STATUS ESPERADO: 302 o 307  |  STATUS RECIBIDO: {response.status_code}")
    print(f"LOCATION (redirección): {response.headers.get('location')}")
    print(f"COOKIES RECIBIDAS     : {dict(response.cookies)}")

    assert response.status_code in (302, 307), f"[FALLÓ] Se esperaba una redirección, se obtuvo {response.status_code}."
    assert "sandbox.orcid.org/oauth/authorize" in response.headers["location"], (
        "[FALLÓ] La redirección no apunta al endpoint de autorización de ORCID sandbox."
    )
    assert "orcid_oauth_state" in response.cookies, "[FALLÓ] No se emitió la cookie anti-CSRF 'orcid_oauth_state'."
    print("[ÉXITO] La API redirige a ORCID con un parámetro 'state' protegido por cookie httponly.")


def test_orcid_callback_signs_in_a_new_professor(client, monkeypatch):
    print("\n>>> CASO DE PRUEBA: Flujo completo 'Sign in with ORCID' -> crea una cuenta local y emite JWT propios")

    login_response = client.get("/orcid/login", follow_redirects = False)
    state = parse_qs(urlparse(login_response.headers["location"]).query)["state"][0]
    print(f"[PASO PREVIO] Estado OAuth generado por /orcid/login: {state[:20]}...")

    monkeypatch.setattr(
        orcid_client, "exchange_code_for_identity",
        lambda code, redirect_uri: orcid_client.OrcidIdentity(
            orcid_id = "0000-0002-1825-0097", name = "Jane Researcher", access_token = "orcid-access-token"
        )
    )
    print("[SIMULACIÓN] ORCID devuelve la identidad: orcid_id=0000-0002-1825-0097, name='Jane Researcher'.")

    callback_endpoint = f"/orcid/callback?code=fake-code&state={state}"
    callback = client.get(callback_endpoint)

    log_test_step(
        step = "Callback de ORCID con un código de autorización válido y el mismo 'state'",
        method = "GET",
        endpoint = callback_endpoint,
        payload = None,
        response = callback,
        expected_status = 200,
        success_message = "Se creó la cuenta local del docente a partir de su identidad ORCID y se emitió un JWT propio."
    )

    tokens = callback.json()
    assert tokens["access_token"] and tokens["refresh_token"], "[FALLÓ] No se emitieron tokens JWT tras el login ORCID."

    me_response = client.get("/users/me", headers = {"Authorization": f"Bearer {tokens['access_token']}"})
    log_test_step(
        step = "Verificación del perfil creado automáticamente a partir de ORCID",
        method = "GET",
        endpoint = "/users/me",
        payload = None,
        response = me_response,
        expected_status = 200,
        success_message = "El perfil creado tiene el nombre, el orcid_id y el rol 'professor' esperados."
    )
    me = me_response.json()
    assert me["full_name"] == "Jane Researcher", "[FALLÓ] El nombre completo no se tomó de la identidad ORCID."
    assert me["orcid_id"] == "0000-0002-1825-0097", "[FALLÓ] El orcid_id no se guardó en el perfil."
    assert me["role"] == "professor", "[FALLÓ] Un login ORCID nuevo debería crear un docente, no un admin."


def test_orcid_callback_rejects_a_mismatched_state(client, monkeypatch):
    client.get("/orcid/login", follow_redirects = False)

    monkeypatch.setattr(
        orcid_client, "exchange_code_for_identity",
        lambda code, redirect_uri: orcid_client.OrcidIdentity(
            orcid_id = "0000-0002-1825-0097", name = "Jane Researcher", access_token = "tok"
        )
    )

    response = client.get("/orcid/callback?code=fake-code&state=not-the-right-state")

    assert response.status_code == 400


def test_orcid_callback_reuses_the_same_local_account_on_a_second_sign_in(client, monkeypatch):
    def fake_identity(code, redirect_uri):
        return orcid_client.OrcidIdentity(
            orcid_id = "0000-0002-1825-0097", name = "Jane Researcher", access_token = "tok"
        )
    monkeypatch.setattr(orcid_client, "exchange_code_for_identity", fake_identity)

    def sign_in_once():
        login_response = client.get("/orcid/login", follow_redirects = False)
        state = parse_qs(urlparse(login_response.headers["location"]).query)["state"][0]
        return client.get(f"/orcid/callback?code=fake-code&state={state}").json()

    first = sign_in_once()
    second = sign_in_once()

    first_id = client.get("/users/me", headers = {"Authorization": f"Bearer {first['access_token']}"}).json()["id"]
    second_id = client.get("/users/me", headers = {"Authorization": f"Bearer {second['access_token']}"}).json()["id"]

    assert first_id == second_id


def test_import_orcid_works_creates_verified_publications(client, signed_in, monkeypatch):
    print("\n>>> CASO DE PRUEBA: Importación automática de publicaciones desde el registro público de ORCID")

    from app.database import SessionLocal
    from app.models.user import UserModel

    user, _, headers = signed_in(client)
    with SessionLocal() as db:
        db_user = db.query(UserModel).filter(UserModel.id == user["id"]).first()
        db_user.orcid_id = "0000-0002-1825-0097"
        db.add(db_user)
        db.commit()
    print(f"[PASO PREVIO] El docente {user['username']} queda vinculado al ORCID iD 0000-0002-1825-0097.")

    monkeypatch.setattr(
        orcid_client, "fetch_works_summary",
        lambda orcid_id: [
            {"put_code": 111, "title": "Imported Work", "type": "journal-article",
             "year": "2026", "doi": "10.1000/imported", "journal_title": "Some Journal"}
        ]
    )
    monkeypatch.setattr(
        orcid_client, "fetch_work_detail",
        lambda orcid_id, put_code: {
            "put_code": put_code, "title": "Imported Work", "type": "journal_article",
            "year": "2026", "doi": "10.1000/imported", "journal_title": "Some Journal",
            "short_description": None, "authors": "Jane Researcher",
        }
    )
    print("[SIMULACIÓN] El registro ORCID público del docente expone 1 obra (put_code=111, DOI=10.1000/imported).")

    works_response = client.get("/orcid/works", headers = headers)
    log_test_step(
        step = "Listado de las obras disponibles en el registro ORCID del docente",
        method = "GET",
        endpoint = "/orcid/works",
        payload = None,
        response = works_response,
        expected_status = 200,
        success_message = "Se listó 1 obra disponible para importar, marcada como no importada todavía."
    )
    assert len(works_response.json()["works"]) == 1, "[FALLÓ] Se esperaba exactamente 1 obra en el listado."
    assert works_response.json()["works"][0]["already_imported"] is False, "[FALLÓ] La obra no debería figurar como ya importada."

    import_payload = {"put_codes": [111]}
    imported = client.post("/orcid/import", json = import_payload, headers = headers)
    log_test_step(
        step = "Importación de la obra seleccionada como una Publicación verificada",
        method = "POST",
        endpoint = "/orcid/import",
        payload = import_payload,
        response = imported,
        expected_status = 201,
        success_message = "La obra se registró como Publication con source='orcid' y status='verified' automáticamente."
    )

    body = imported.json()[0]
    assert body["source"] == "orcid", f"[FALLÓ] Se esperaba source='orcid', se obtuvo '{body['source']}'."
    assert body["status"] == "verified", (
        "[FALLÓ] Las publicaciones importadas desde ORCID deben saltarse el comité de revisión (fuente confiable)."
    )
    assert body["doi"] == "10.1000/imported", "[FALLÓ] El DOI importado no coincide con el de ORCID."
    print("[VERIFICACIÓN EXTRA] Confirmado: el origen ORCID se marca VERIFIED de inmediato, sin pasar por /review.")

    # A second import of the same put-code must not duplicate the record.
    again = client.post("/orcid/import", json = import_payload, headers = headers)
    log_test_step(
        step = "Reimportación del mismo put_code (debe ser idempotente, sin duplicar el registro)",
        method = "POST",
        endpoint = "/orcid/import",
        payload = import_payload,
        response = again,
        expected_status = 201,
        success_message = "La reimportación no creó un duplicado: sigue habiendo una sola publicación en la base de datos."
    )
    total_publications = client.get("/publications", headers = headers).json()["total"]
    assert total_publications == 1, f"[FALLÓ] Se esperaba 1 publicación total, se encontraron {total_publications}."


def test_orcid_endpoints_require_a_linked_orcid_id(client, signed_in):
    _, _, headers = signed_in(client)

    assert client.get("/orcid/works", headers = headers).status_code == 400
    assert client.post("/orcid/import", json = {"put_codes": [1]}, headers = headers).status_code == 400
