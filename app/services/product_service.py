"""
File: product_service.py
Description: Service to handle product creation, ORCID imports, and persistence (T-HU03-05, T-HU12-02, T-HU12-03, PGPCECMC-36).

El servicio no conoce HTTP: lanza excepciones de dominio y es el endpoint el que las
traduce a códigos de estado (igual que user_service.py).
"""

from datetime import datetime
from app.models.product import Product
from app.models.user import User
from app.schemas.product import ProductCreate
from app.services.notification_service import create_notification
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

        duplicate = cls._find_duplicate(db, data)
        if duplicate == "doi":
            raise DuplicateProductError("A product with this DOI is already registered.")
        if duplicate == "project_code":
            raise DuplicateProductError("A project with this code is already registered.")

        product = Product(
            owner_id=owner.id,
            school=owner.school,
            status="cargado",
            source="manual",
            **data.model_dump(),
        )
        db.add(product)
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise DuplicateProductError("This DOI or project code is already registered.") from exc

        db.refresh(product)

        create_notification(
            db=db,
            user_id=owner.id,
            title="Producto cargado exitosamente",
            message=f"Tu producto «{product.title}» ha sido registrado correctamente y se encuentra en estado cargado.",
            product_id=product.id,
        )

        return product

    @classmethod
    def import_orcid_products(cls, db: Session, owner_id: str, items: list) -> list[Product]:
        """
        Importa publicaciones automáticamente desde ORCID asociándolas al profesor, 
        con origen 'orcid', estado 'verificado' (sin confirmación individual) y control de duplicados (CA34, CA37).
        """
        owner = db.get(User, owner_id) if owner_id else None
        if owner is None or not owner.is_active:
            raise InvalidOwnerError("Invalid owner or inactive account.")

        imported_products = []

        for item in items:
            if item.doi and db.scalar(select(Product.id).where(Product.doi == item.doi)):
                continue

            existing_orcid = db.scalar(
                select(Product.id).where(
                    Product.owner_id == owner.id,
                    Product.source == "orcid",
                    Product.external_id == item.external_id
                )
            )
            if existing_orcid:
                continue

            product = Product(
                owner_id=owner.id,
                school=owner.school,
                type=item.type,
                title=item.title.strip(),
                authors=item.authors,
                year=item.year,
                research_line=item.research_line,
                abstract=item.abstract,
                doi=item.doi,
                venue=item.venue,
                source="orcid",
                external_id=item.external_id,
                status="verificado",
            )
            db.add(product)
            imported_products.append(product)

        try:
            db.commit()
            for product in imported_products:
                db.refresh(product)
        except IntegrityError as exc:
            db.rollback()
            raise DuplicateProductError("A duplicate product was detected during ORCID import.") from exc

        return imported_products

    @classmethod
    def get_pending_queue(cls, db: Session, user: User) -> list[Product]:
        """
        Retorna la cola de productos pendientes de revisión ('cargado') 
        para los miembros autorizados del consejo (CA35, CA36, CA38).
        """
        if user.role != "reviewer":
            raise PermissionError("User is not authorized to access the review queue.")
        
        return db.scalars(
            select(Product).where(Product.status == "cargado").order_by(Product.created_at.asc())
        ).all()

    @classmethod
    def review_product(cls, db: Session, product_id: str, reviewer: User, decision: str, reason: str | None = None) -> Product:
        """
        Registra la decisión del consejo (aprobar 'verificado' o rechazar 'rechazado'),
        el responsable, la fecha y notifica al profesor (CA36, CA38).
        """
        if reviewer.role != "reviewer":
            raise PermissionError("Only authorized council members can review products.")

        product = db.get(Product, product_id)
        if not product:
            raise ProductError("Product not found.")

        if product.status != "cargado":
            raise ProductError("Product has already been reviewed.")

        if decision not in ("verificado", "rechazado"):
            raise ValueError("Invalid review decision. Must be 'verificado' or 'rechazado'.")

        if decision == "rechazado" and not reason:
            raise ValueError("A reason is required when rejecting a product.")

        product.status = decision
        product.reviewed_by = reviewer.id
        product.reviewed_at = datetime.utcnow()
        product.review_reason = reason.strip() if reason else None

        try:
            db.commit()
            db.refresh(product)
        except Exception as exc:
            db.rollback()
            raise ProductError("Error saving review decision.") from exc

        notif_title = "Producto aprobado" if decision == "verificado" else "Producto rechazado"
        notif_msg = (
            f"Tu producto «{product.title}» ha sido aprobado e incorporado al catálogo consolidado."
            if decision == "verificado"
            else f"Tu producto «{product.title}» ha sido rechazado. Motivo: {product.review_reason}"
        )

        create_notification(
            db=db,
            user_id=product.owner_id,
            title=notif_title,
            message=notif_msg,
            product_id=product.id,
        )

        return product
