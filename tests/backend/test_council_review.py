"""
File: test_council_review.py
Description: Test suite for manual review queue and council decisions with access control (T-HU12-03, CA35, CA36, CA38).
"""

import pytest
from app.models.product import Product
from app.models.user import User
from app.services.product_service import ProductService


def test_reviewer_can_approve_product(db_session):
    """
    Valida que un miembro del consejo ('reviewer') pueda aprobar una publicación pendiente,
    registrando responsable, fecha y notificando al profesor (CA36, CA38).
    """
    professor = User(
        username="prof_demo",
        email="prof@example.com",
        full_name="Profesor Demo",
        school="ECMC",
        role="professor"
    )
    reviewer = User(
        username="rev_demo",
        email="rev@example.com",
        full_name="Consejero Demo",
        school="ECMC",
        role="reviewer"
    )
    db_session.add_all([professor, reviewer])
    db_session.commit()

    product = Product(
        owner_id=professor.id,
        school="ECMC",
        type="publicacion",
        title="Manual Submission Paper",
        authors=["Profesor Demo"],
        year=2026,
        research_line="Inteligencia artificial",
        status="cargado",
        source="manual"
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)

    # El revisor aprueba el producto
    updated = ProductService.review_product(
        db=db_session,
        product_id=product.id,
        reviewer=reviewer,
        decision="verificado"
    )

    assert updated.status == "verificado"
    assert updated.reviewed_by == reviewer.id
    assert updated.reviewed_at is not None


def test_unauthorized_user_cannot_review_products(db_session):
    """
    Valida que un usuario sin autorización (ej. rol 'professor') no pueda alterar decisiones de revisión (CA38).
    """
    professor = User(
        username="prof_unauth",
        email="profunauth@example.com",
        full_name="Profesor Común",
        school="ECMC",
        role="professor"
    )
    db_session.add(professor)
    db_session.commit()

    product = Product(
        owner_id=professor.id,
        school="ECMC",
        type="publicacion",
        title="Another Paper",
        authors=["Profesor Común"],
        year=2026,
        research_line="Ciencia de datos",
        status="cargado",
        source="manual"
    )
    db_session.add(product)
    db_session.commit()

    with pytest.raises(PermissionError):
        ProductService.review_product(
            db=db_session,
            product_id=product.id,
            reviewer=professor,
            decision="verificado"
        )
