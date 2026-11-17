"""
File: test_products_hu12_api.py
Description: Pruebas de integración HTTP para importación ORCID (T-HU12-02) 
y flujo de cola/revisión del consejo (T-HU12-03, CA34-CA38).
"""


from fastapi.testclient import TestClient

from app.main import app
from app.models.notification import Notification
from app.models.product import Product
from app.models.user import User
from app.services.ldap_service import LDAPService

BASE_URL = "/api/v1/products"


def _login_as(monkeypatch, username: str, email: str, full_name: str = "Test User") -> TestClient:
    """Autentica un usuario mediante mock de LDAP y devuelve un TestClient con sesión activa."""
    monkeypatch.setattr(
        LDAPService,
        "authenticate_and_authorize_professor",
        classmethod(lambda cls, username, password: {
            "username": username,
            "full_name": full_name,
            "email": email,
        }),
    )
    client = TestClient(app)
    res = client.post("/api/v1/auth/login", json={"username": username, "password": "secret"})
    assert res.status_code == 200
    return client


def test_orcid_import_endpoint_success_and_deduplication(monkeypatch, db_session):
    """
    CA34 & CA37: POST /api/v1/products/orcid-import importa publicaciones como 'verificado' 
    y 'orcid' sin confirmación individual, ignorando duplicados en reintentos.
    """
    client = _login_as(monkeypatch, "prof_orcid", "prof.orcid@ecmc.edu.ec", "Dra. Ana Morales")

    payload = [
        {
            "external_id": "orcid-work-9001",
            "title": "Deep Learning in Computational Science",
            "authors": ["Dra. Ana Morales"],
            "year": 2025,
            "research_line": "Inteligencia artificial",
            "doi": "10.1000/dl.comp.2025",
            "venue": "Journal of Computational Science",
        }
    ]

    # 1. Primera importación exitosa
    response = client.post(f"{BASE_URL}/orcid-import", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["source"] == "orcid"
    assert body[0]["external_id"] == "orcid-work-9001"
    assert body[0]["status"] == "verificado"

    # 2. Reintento con el mismo external_id / DOI -> No crea duplicados (CA37)
    retry_response = client.post(f"{BASE_URL}/orcid-import", json=payload)
    assert retry_response.status_code == 200
    assert retry_response.json() == []
    assert db_session.query(Product).count() == 1


def test_review_queue_access_control(monkeypatch, db_session):
    """
    CA35 & CA38: Solo usuarios con rol 'reviewer' pueden consultar GET /api/v1/products/review-queue.
    Un profesor regular recibe 403 Forbidden.
    """
    prof_client = _login_as(monkeypatch, "prof_regular", "prof.reg@ecmc.edu.ec")

    # El profesor crea un producto manual (queda en estado 'cargado')
    create_res = prof_client.post(
        BASE_URL,
        json={
            "type": "publicacion",
            "title": "Pending Manual Publication",
            "authors": ["Prof Regular"],
            "year": 2026,
            "research_line": "Ciencia de datos",
            "doi": "10.1000/manual.pending.2026",
        },
    )
    assert create_res.status_code == 201

    # Profesor intenta acceder a la cola -> 403 Forbidden (CA38)
    forbidden_res = prof_client.get(f"{BASE_URL}/review-queue")
    assert forbidden_res.status_code == 403

    # Se inicia sesión con un usuario y se le asigna el rol 'reviewer' en BD
    rev_client = _login_as(monkeypatch, "council_member", "council@ecmc.edu.ec", "Dr. Carlos Ruiz")
    reviewer = db_session.query(User).filter_by(username="council_member").one()
    reviewer.role = "reviewer"
    db_session.commit()

    # El miembro del consejo sí puede ver la cola pendiente
    queue_res = rev_client.get(f"{BASE_URL}/review-queue")
    assert queue_res.status_code == 200
    queue = queue_res.json()
    assert len(queue) == 1
    assert queue[0]["title"] == "Pending Manual Publication"
    assert queue[0]["status"] == "cargado"


def test_council_review_decision_approve_reject_and_notify(monkeypatch, db_session):
    """
    CA36 & CA38: PATCH /api/v1/products/{id}/review permite aprobar ('verificado') o rechazar ('rechazado')
    con motivo obligatorio, registra responsable y fecha, y dispara notificación (HU08).
    """
    prof_client = _login_as(monkeypatch, "prof_author", "author@ecmc.edu.ec", "Prof. Author")
    p1_id = prof_client.post(
        BASE_URL,
        json={
            "type": "publicacion",
            "title": "Paper to Approve",
            "authors": ["Prof. Author"],
            "year": 2026,
            "research_line": "Computación científica",
            "doi": "10.1000/approve.2026",
        },
    ).json()["id"]

    p2_id = prof_client.post(
        BASE_URL,
        json={
            "type": "publicacion",
            "title": "Paper to Reject",
            "authors": ["Prof. Author"],
            "year": 2026,
            "research_line": "Computación científica",
            "doi": "10.1000/reject.2026",
        },
    ).json()["id"]

    # Usuario sin rol 'reviewer' no puede revisar (CA38)
    unauth_res = prof_client.patch(f"{BASE_URL}/{p1_id}/review", json={"decision": "verificado"})
    assert unauth_res.status_code == 403

    # Preparamos miembro del consejo
    rev_client = _login_as(monkeypatch, "reviewer_user", "reviewer@ecmc.edu.ec", "Dra. Elena Vega")
    reviewer = db_session.query(User).filter_by(username="reviewer_user").one()
    reviewer.role = "reviewer"
    db_session.commit()

    # 1. Aprobación del primer producto
    approve_res = rev_client.patch(f"{BASE_URL}/{p1_id}/review", json={"decision": "verificado"})
    assert approve_res.status_code == 200
    approved_body = approve_res.json()
    assert approved_body["status"] == "verificado"
    assert approved_body["reviewed_by"] == reviewer.id
    assert approved_body["reviewed_at"] is not None

    # 2. Rechazo sin motivo -> 422 Unprocessable Entity (validación Pydantic)
    bad_reject_res = rev_client.patch(f"{BASE_URL}/{p2_id}/review", json={"decision": "rechazado"})
    assert bad_reject_res.status_code == 422

    # 3. Rechazo con motivo válido -> 200 OK
    reject_res = rev_client.patch(
        f"{BASE_URL}/{p2_id}/review",
        json={"decision": "rechazado", "reason": "DOI no verificable en el repositorio oficial."},
    )
    assert reject_res.status_code == 200
    rejected_body = reject_res.json()
    assert rejected_body["status"] == "rechazado"
    assert rejected_body["reviewed_by"] == reviewer.id
    assert rejected_body["review_reason"] == "DOI no verificable en el repositorio oficial."

    # 4. Verificar que las notificaciones de aprobación y rechazo se generaron para el profesor (CA36 / HU08)
    author = db_session.query(User).filter_by(username="prof_author").one()
    notifications = db_session.query(Notification).filter_by(user_id=author.id).all()
    titles = {n.title for n in notifications}
    assert "Producto aprobado" in titles
    assert "Producto rechazado" in titles
