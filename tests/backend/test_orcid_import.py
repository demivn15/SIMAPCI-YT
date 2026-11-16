"""
File: test_orcid_import.py
Description: Test suite for ORCID automatic import, mapping, and duplicate control (T-HU12-02, CA34, CA37).
"""

from app.models.product import Product
from app.models.user import User
from app.schemas.product import OrcidItemImport
from app.services.product_service import ProductService


def test_orcid_import_success_and_duplicate_prevention(db_session):
    """
    Valida que las publicaciones de ORCID se importen como 'verificado' y 'orcid',
    y que reintentar la importación del mismo external_id o DOI no cree duplicados (CA34, CA37).
    """
    user = User(
        username="profesor_orcid",
        email="profesor.orcid@example.com",
        full_name="Profesor Orcid",
        school="ECMC",
        role="professor"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    orcid_item = OrcidItemImport(
        external_id="orcid-put-code-123",
        title="Research on Machine Learning",
        authors=["Dra. María Gómez"],
        year=2025,
        doi="10.1016/j.ml.2025.01",
        venue="Journal of AI"
    )

    # 1. Primera importación exitosa
    imported = ProductService.import_orcid_products(db_session, user.id, [orcid_item])
    assert len(imported) == 1
    assert imported[0].source == "orcid"
    assert imported[0].external_id == "orcid-put-code-123"
    assert imported[0].status == "verificado"

    # 2. Segunda importación con el mismo external_id (debe ser ignorado por control de duplicados CA37)
    imported_again = ProductService.import_orcid_products(db_session, user.id, [orcid_item])
    assert len(imported_again) == 0

    total_products = db_session.query(Product).filter_by(owner_id=user.id).count()
    assert total_products == 1
