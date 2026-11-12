"""
File: product_service.py
Description: Service to handle product creation and persistence (T-HU03-05, PGPCECMC-36).
"""

from app.models.product import Product
from app.models.user import User
from app.schemas.product import ProductCreate
from sqlalchemy.orm import Session


class ProductService:
    @staticmethod
    def create_product(db: Session, owner_id: str, data: ProductCreate) -> Product:
        owner = db.get(User, owner_id)
        if owner is None or not owner.is_active:
            raise ValueError("Invalid owner or inactive account.")

        product_data = data.model_dump()
        product = Product(
            owner_id=owner.id,
            school=owner.school,
            status="cargado",
            **product_data
        )
        db.add(product)
        db.commit()
        db.refresh(product)
        return product
