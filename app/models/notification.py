"""
File: notification.py
Description: SQLAlchemy model for user notifications (T-HU08-03) with the uniqueness constraint
             that backs the duplicate control of T-HU08-06 (PGPCECMC-69). Criterio CA24.
"""

import uuid
from datetime import datetime
from app.db.base import Base
from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        # CA24: un mismo evento de un producto no puede notificarse dos veces al mismo profesor.
        # El título identifica el evento (son fijos, ver NOTIFICATION_TEMPLATES), porque la tabla
        # no guarda un campo de tipo. Igual que el índice único del DOI en `products`, es la
        # garantía final: notify_product_event ya evita el duplicado antes de insertar, pero esto
        # lo sostiene aunque otro camino intente insertarlo.
        # Los avisos sin producto (product_id NULL) no entran en la restricción, porque en SQL
        # los NULL no cuentan como iguales.
        UniqueConstraint("user_id", "product_id", "title", name="uq_notification_event"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[str | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
