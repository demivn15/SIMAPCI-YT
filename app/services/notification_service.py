"""
File: notification_service.py
Description: Service for generating and registering notifications for product state changes (T-HU08-03).
"""

from sqlalchemy.orm import Session
from app.models.notification import Notification # Asumiendo que existe el modelo de notificación


def create_notification(
    db: Session, user_id: str, title: str, message: str, product_id: str | None = None
) -> Notification:
    """
    Registra una nueva notificación en la base de datos para un profesor específico (CA22, CA23, CA24).
    Cada cambio de estado genera una única notificación dirigida al propietario.
    """
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        product_id=product_id,
        is_read=False
    )
    
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification
