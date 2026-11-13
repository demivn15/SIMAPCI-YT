"""
File: app/api/v1/products.py
Description: API router for managing scientific products (HU03).
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_professor, get_db
from app.schemas.product import ProductCreate, ProductResponse
from app.services.product_service import ProductService

router = APIRouter(prefix="/products", tags=["Products"])


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product_in: ProductCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_professor),
):
    """
    Register a new scientific product with initial status 'cargado'.
    """
    # Assuming user_id is extracted from current_user payload/token
    user_id = current_user.get("user_id") or current_user.get("id")
    return ProductService.create_product(db=db, product_in=product_in, user_id=user_id)
