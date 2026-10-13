"""
File: services/notifications.py
Description: Helper that records the status-change events behind charter
             requirement #6 ("El sistema notifica al usuario sobre las
             diferentes etapas en las que se encuentre su producto: cargado
             exitosamente, verificado, rechazado").
"""

from sqlalchemy.orm import Session
from app.models.common import VerificationStatus
from app.models.notification import NotificationModel, NotificationProductType

_STATUS_MESSAGES = {
    VerificationStatus.UPLOADED: "fue cargado exitosamente y está pendiente de revisión.",
    VerificationStatus.UNDER_REVIEW: "está siendo revisado por el comité.",
    VerificationStatus.VERIFIED: "fue verificado y ahora es visible en el catálogo.",
    VerificationStatus.REJECTED: "fue rechazado por el comité de revisión.",
}


def notify_status_change(
    db: Session,
    user_id: int,
    product_type: NotificationProductType,
    product_id: int,
    product_title: str,
    status: VerificationStatus,
    rejection_reason: str | None = None
) -> NotificationModel:
    """Create (and commit) one notification row describing a status change."""
    label = "Tu publicación" if product_type == NotificationProductType.PUBLICATION else "Tu proyecto"
    message = f'{label} "{product_title}" {_STATUS_MESSAGES[status]}'
    if status == VerificationStatus.REJECTED and rejection_reason:
        message += f" Motivo: {rejection_reason}"

    notification = NotificationModel(
        user_id = user_id,
        product_type = product_type,
        product_id = product_id,
        status = status.value,
        message = message
    )

    db.add(notification)
    db.commit()
    db.refresh(notification)

    return notification
