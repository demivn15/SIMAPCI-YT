"""
File: tests/test_review_and_notifications.py
Description: The committee verification workflow (charter requirement #6:
             "cargado exitosamente, verificado, rechazado") and the resulting
             notification feed.
"""


def test_a_regular_professor_cannot_access_the_review_queue(client, signed_in):
    _, _, headers = signed_in(client)

    response = client.get("/review/publications", headers = headers)

    assert response.status_code == 403


def test_new_submissions_appear_in_the_review_queue(client, signed_in, admin_headers):
    _, _, headers = signed_in(client)
    client.post("/publications", json = {"title": "Pending paper"}, headers = headers)

    queue = client.get("/review/publications", headers = admin_headers)

    assert queue.status_code == 200
    assert queue.json()["total"] == 1
    assert queue.json()["items"][0]["title"] == "Pending paper"


def test_verifying_a_publication_notifies_the_owner(client, signed_in, admin_headers):
    _, _, headers = signed_in(client)
    created = client.post("/publications", json = {"title": "Good paper"}, headers = headers).json()

    decision = client.patch(
        f"/review/publications/{created['id']}", json = {"status": "verified"}, headers = admin_headers
    )
    assert decision.status_code == 200
    assert decision.json()["status"] == "verified"

    notifications = client.get("/notifications", headers = headers).json()
    assert notifications["total"] == 2  # one for "uploaded", one for "verified"
    assert any("verificado" in item["message"] for item in notifications["items"])


def test_rejecting_a_publication_requires_a_reason(client, signed_in, admin_headers):
    _, _, headers = signed_in(client)
    created = client.post("/publications", json = {"title": "Weak paper"}, headers = headers).json()

    missing_reason = client.patch(
        f"/review/publications/{created['id']}", json = {"status": "rejected"}, headers = admin_headers
    )
    assert missing_reason.status_code == 422

    with_reason = client.patch(
        f"/review/publications/{created['id']}",
        json = {"status": "rejected", "rejection_reason": "Incomplete metadata."},
        headers = admin_headers
    )
    assert with_reason.status_code == 200
    assert with_reason.json()["rejection_reason"] == "Incomplete metadata."

    notifications = client.get("/notifications", headers = headers).json()
    assert any("rechazado" in item["message"] for item in notifications["items"])


def test_mark_notification_as_read(client, signed_in, admin_headers):
    _, _, headers = signed_in(client)
    created = client.post("/publications", json = {"title": "A paper"}, headers = headers).json()
    client.patch(f"/review/publications/{created['id']}", json = {"status": "verified"}, headers = admin_headers)

    notifications = client.get("/notifications", headers = headers).json()
    first_id = notifications["items"][0]["id"]

    marked = client.patch(f"/notifications/{first_id}/read", headers = headers)
    assert marked.status_code == 200
    assert marked.json()["is_read"] is True

    refreshed = client.get("/notifications", headers = headers).json()
    assert refreshed["unread_count"] == 1


def test_mark_all_notifications_as_read(client, signed_in, admin_headers):
    _, _, headers = signed_in(client)
    created = client.post("/publications", json = {"title": "A paper"}, headers = headers).json()
    client.patch(f"/review/publications/{created['id']}", json = {"status": "verified"}, headers = admin_headers)

    response = client.patch("/notifications/read-all", headers = headers)

    assert response.status_code == 200
    assert client.get("/notifications", headers = headers).json()["unread_count"] == 0


def test_notifications_cannot_be_read_by_another_user(client, signed_in, admin_headers):
    _, _, owner_headers = signed_in(client)
    _, _, other_headers = signed_in(client, username = "other", email = "other@yachaytech.edu.ec")

    created = client.post("/publications", json = {"title": "A paper"}, headers = owner_headers).json()
    client.patch(f"/review/publications/{created['id']}", json = {"status": "verified"}, headers = admin_headers)

    owner_notifications = client.get("/notifications", headers = owner_headers).json()
    notification_id = owner_notifications["items"][0]["id"]

    response = client.patch(f"/notifications/{notification_id}/read", headers = other_headers)
    assert response.status_code == 403
