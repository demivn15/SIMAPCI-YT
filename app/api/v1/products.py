"""
File: app/api/v1/products.py
Description: API router for managing scientific products, ORCID imports, and council reviews (HU03, HU12).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.api.deps import get_current_professor
from app.db.session import get_db
from app.models.user import User  # <-- Importamos User al inicio correctamente
from app.schemas.product import ProductCreate, ProductResponse, OrcidItemImport, ReviewDecisionSchema
from app.services.product_service import DuplicateProductError, InvalidOwnerError, ProductError, ProductService

router = APIRouter(prefix="/products", tags=["Products"])


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
    current_user: dict = Depends(get_current_professor),
):
    """
    Get the pending review queue for authorized council members with 'reviewer' role (CA35, CA38).
    """
    user = db.get(User, current_user.get("user_id"))
    try:
        return ProductService.get_pending_queue(db, user)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


@router.patch("/{product_id}/review", response_model=ProductResponse, status_code=status.HTTP_200_OK)
def review_product_decision(
    product_id: str,
    decision_data: ReviewDecisionSchema,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_professor),
):
    """
    Allows an authorized council member to approve ('verificado') or reject ('rechazado') 
    a pending product (CA36, CA38).
    """
    reviewer = db.get(User, current_user.get("user_id"))

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
