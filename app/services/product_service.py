"""
File: product_service.py
Description: Service to handle product creation and persistence (T-HU03-05, PGPCECMC-36).

El servicio no conoce HTTP: lanza excepciones de dominio y es el endpoint el que las
traduce a códigos de estado (igual que user_service.py).
"""

from app.models.product import Product
from app.models.user import User
from app.schemas.product import ProductCreate
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


class ProductError(Exception):
    """Error base del registro de productos."""


class InvalidOwnerError(ProductError):
    """El dueño no existe o su cuenta está desactivada."""


class DuplicateProductError(ProductError):
    """El DOI o el código de proyecto ya están registrados."""


class ProductService:
    @staticmethod
    def _find_duplicate(db: Session, data: ProductCreate) -> str | None:
        """Devuelve el motivo del duplicado ('doi' o 'project_code') o None si no hay."""

        if data.doi and db.scalar(select(Product.id).where(Product.doi == data.doi)):
            return "doi"
        if data.project_code and db.scalar(select(Product.id).where(Product.project_code == data.project_code)):
            return "project_code"
        return None

    @classmethod
    def create_product(cls, db: Session, owner_id: str | None, data: ProductCreate) -> Product:
        """Guarda el producto a nombre del profesor, con estado inicial 'cargado'."""

        owner = db.get(User, owner_id) if owner_id else None
        if owner is None or not owner.is_active:
            raise InvalidOwnerError("Invalid owner or inactive account.")

        # Se revisa ANTES de insertar para dar un error claro; el índice único de la BD
        # queda como respaldo ante dos registros simultáneos (ver IntegrityError abajo).
        duplicate = cls._find_duplicate(db, data)
        if duplicate == "doi":
            raise DuplicateProductError("A product with this DOI is already registered.")
        if duplicate == "project_code":
            raise DuplicateProductError("A project with this code is already registered.")

        product = Product(
            owner_id=owner.id,
            school=owner.school,
            status="cargado",
            **data.model_dump(),
        )
        db.add(product)
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise DuplicateProductError("This DOI or project code is already registered.") from exc

        db.refresh(product)
        return product
