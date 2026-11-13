"""
File: app/api/v1/products.py
Description: API router for managing scientific products (HU03).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_professor
from app.db.session import get_db
from app.schemas.product import ProductCreate, ProductResponse
from app.services.product_service import DuplicateProductError, InvalidOwnerError, ProductService

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
        # El token es válido pero la cuenta ya no existe o fue desactivada
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except DuplicateProductError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
