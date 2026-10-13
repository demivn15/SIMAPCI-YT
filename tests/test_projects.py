"""
File: tests/test_projects.py
Description: Protected CRUD and project-code existence validation (charter
             requirement #5) for the "Proyecto de Investigación" entity.
"""


def test_create_project_without_code_succeeds(client, signed_in):
    user, _, headers = signed_in(client)

    response = client.post("/projects", json = {"title": "Glacier Monitoring"}, headers = headers)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "uploaded"
    assert body["owner_id"] == user["id"]


def test_create_project_with_a_project_code_succeeds(client, signed_in):
    _, _, headers = signed_in(client)

    response = client.post(
        "/projects",
        json = {"title": "Glacier Monitoring", "project_code": "ECMC-2026-014"},
        headers = headers
    )

    assert response.status_code == 201
    assert response.json()["project_code"] == "ECMC-2026-014"


def test_duplicate_project_code_is_rejected(client, signed_in):
    _, _, headers = signed_in(client)

    client.post("/projects", json = {"title": "First", "project_code": "ECMC-2026-014"}, headers = headers)
    response = client.post(
        "/projects", json = {"title": "Second", "project_code": "ECMC-2026-014"}, headers = headers
    )

    assert response.status_code == 409


def test_lookup_code_reports_registration_state(client, signed_in):
    _, _, headers = signed_in(client)

    before = client.get("/projects/lookup-code?project_code=ECMC-2026-014", headers = headers)
    assert before.json()["already_registered"] is False

    client.post("/projects", json = {"title": "First", "project_code": "ECMC-2026-014"}, headers = headers)

    after = client.get("/projects/lookup-code?project_code=ECMC-2026-014", headers = headers)
    assert after.json()["already_registered"] is True


def test_ownership_is_enforced(client, signed_in):
    _, _, owner_headers = signed_in(client)
    _, _, other_headers = signed_in(client, username = "other", email = "other@yachaytech.edu.ec")

    created = client.post("/projects", json = {"title": "Owned project"}, headers = owner_headers).json()

    assert client.get(f"/projects/{created['id']}", headers = other_headers).status_code == 403
    assert client.delete(f"/projects/{created['id']}", headers = other_headers).status_code == 403


def test_protected_crud_requires_authentication(client):
    assert client.get("/projects").status_code == 401
    assert client.post("/projects", json = {"title": "x"}).status_code == 401


def test_update_and_delete_project(client, signed_in):
    _, _, headers = signed_in(client)
    created = client.post("/projects", json = {"title": "Draft project"}, headers = headers).json()

    updated = client.patch(
        f"/projects/{created['id']}", json = {"project_status": "finished"}, headers = headers
    )
    assert updated.status_code == 200
    assert updated.json()["project_status"] == "finished"

    deleted = client.delete(f"/projects/{created['id']}", headers = headers)
    assert deleted.status_code == 204
    assert client.get(f"/projects/{created['id']}", headers = headers).status_code == 404


def test_export_my_projects(client, signed_in):
    _, _, headers = signed_in(client)
    client.post("/projects", json = {"title": "Exportable project"}, headers = headers)

    csv_response = client.get("/projects/export?format=csv", headers = headers)
    assert csv_response.status_code == 200
    assert b"Exportable project" in csv_response.content
