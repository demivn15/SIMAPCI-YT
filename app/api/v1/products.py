"""
File: app/api/v1/products.py
Description: API router for managing scientific products, ORCID imports, and council reviews (HU03, HU12).
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List

from app.api.deps import get_current_professor, get_current_reviewer
from app.db.session import get_db
from app.models.user import User  # <-- Importamos User al inicio correctamente
from app.schemas.catalog import CatalogListResponse, CatalogProductResponse
from app.schemas.product import (
    OrcidItemImport,
    ProductCreate,
    ProductExistenceResponse,
    ProductResponse,
    ReviewDecisionSchema,
)
from app.services.catalog_service import count_catalog, get_catalog_product, list_catalog
from app.services.product_identity_service import find_existing_product
from app.utils.identifiers import is_valid_doi, normalize_doi
from app.services.product_service import DuplicateProductError, InvalidOwnerError, ProductError, ProductService

router = APIRouter(prefix="/products", tags=["Products"])

MAX_CATALOG_PAGE_SIZE = 100


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product_in: ProductCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_professor),
):
    """
    Register a new scientific product with initial status 'cargado', owned by the
    authenticated professor. 409 if the DOI or project code is already registered.
    """
    try:
        return ProductService.create_product(db=db, owner_id=current_user.get("user_id"), data=product_in)
    except InvalidOwnerError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except DuplicateProductError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get("/exists", response_model=ProductExistenceResponse, status_code=status.HTTP_200_OK)
def check_product_existence(
    doi: str | None = Query(default=None, max_length=255, description="DOI en cualquier formato"),
    project_code: str | None = Query(default=None, max_length=64, description="Código del proyecto"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_professor),
):
    """
    Pre-save existence check (T-HU07-02, PGPCECMC-60; CA19, CA20, CA21).

    Lets the registration form warn the professor before submitting. It is
    informative: POST /products repeats the check and answers 409 on duplicates.
    422 if the DOI does not have the form 10.<prefix>/<suffix>.
    """
    clean_doi = normalize_doi(doi)
    if clean_doi and not is_valid_doi(clean_doi):
        raise HTTPException(
            status_code=422,  # Unprocessable Content
            detail="DOI is not valid. Expected format: 10.<prefix>/<suffix>.",
        )

    check = find_existing_product(db, doi=clean_doi, project_code=project_code)
    return ProductExistenceResponse(
        verifiable=check.verifiable,
        exists=check.exists,
        field=check.field,
        normalized_identifier=check.normalized_identifier,
        public_product_id=check.public_product_id,
    )


@router.get("/catalog", response_model=CatalogListResponse, status_code=status.HTTP_200_OK)
def get_consolidated_catalog(
    limit: int = Query(default=20, ge=1, le=MAX_CATALOG_PAGE_SIZE, description="Tamaño de la página"),
    offset: int = Query(default=0, ge=0, description="Cuántos productos saltar"),
    db: Session = Depends(get_db),
):
    """
    Consolidated catalogue: the verified production of the School (T-HU12-04, PGPCECMC-97).

    This is where an approval becomes visible (CA36). It holds the manual publications the
    council approved and the works imported from ORCID, which arrive verified (CA34); pending
    and rejected ones are kept for follow-up but stay out.

    Sin sesión: el catálogo es la producción publicada de la Escuela (HU05). Por eso la
    respuesta no lleva el dueño ni el expediente de revisión; ver CatalogProductResponse.
    """
    return CatalogListResponse(
        total=count_catalog(db),
        items=[
            CatalogProductResponse.model_validate(product)
            for product in list_catalog(db, limit=limit, offset=offset)
        ],
    )


@router.get("/catalog/{product_id}", response_model=CatalogProductResponse, status_code=status.HTTP_200_OK)
def get_catalog_product_detail(product_id: str, db: Session = Depends(get_db)):
    """
    Detail of one product of the consolidated catalogue (T-HU12-04, PGPCECMC-97).

    404 if it does not exist or is not verified yet: a pending or rejected product is not
    readable even knowing its id, which is what makes the `public_product_id` of the HU07
    pre-save check safe to link (rule RU-08).
    """
    product = get_catalog_product(db, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found in the catalogue.")

    return product


@router.post("/orcid-import", response_model=List[ProductResponse], status_code=status.HTTP_200_OK)
def import_orcid_products(
    items: List[OrcidItemImport],
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_professor),
):
    """
    Import publications automatically from ORCID for the authenticated professor 
    without requiring individual confirmation (CA34, CA37).
    """
    try:
        return ProductService.import_orcid_products(db, current_user.get("user_id"), items)
    except InvalidOwnerError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except DuplicateProductError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get("/review-queue", response_model=List[ProductResponse], status_code=status.HTTP_200_OK)
def get_pending_review_queue(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_reviewer),
):
    """
    Get the pending review queue for authorized council members with 'reviewer' role (CA35, CA38).
    """
    user = db.get(User, current_user.get("user_id"))
    if user is None:
        # El token es válido pero la cuenta ya no existe: no se puede comprobar el rol en la BD.
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Reviewer account not found.")

    try:
        return ProductService.get_pending_queue(db, user)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


@router.patch("/{product_id}/review", response_model=ProductResponse, status_code=status.HTTP_200_OK)
def review_product_decision(
    product_id: str,
    decision_data: ReviewDecisionSchema,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_reviewer),
):
    """
    Allows an authorized council member to approve ('verificado') or reject ('rechazado')
    a pending product (CA36, CA38).

    The decision is what triggers the owner's notification (CA23, T-HU08-05): until D-05 was
    fixed this route answered 403 to council members, so the notification never fired.
    """
    reviewer = db.get(User, current_user.get("user_id"))
    if reviewer is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Reviewer account not found.")

    try:
        return ProductService.review_product(
            db=db,
            product_id=product_id,
            reviewer=reviewer,
            decision=decision_data.decision,
            reason=decision_data.reason,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except (ProductError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
