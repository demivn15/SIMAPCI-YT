"""
File: notification_service.py
Description: Generación y registro de notificaciones por cambio de estado de un producto
             (T-HU08-03) e integración de los eventos de verificación y rechazo
             (T-HU08-05, PGPCECMC-93). Criterios CA22, CA23 y CA24.

Un único punto arma la notificación que recibe el AUTOR del producto, para que todos los eventos
usen las mismas plantillas (T-HU08-01) y ninguno se duplique (CA24):
  - 'cargado'    -> el profesor guardó el producto (CA22, T-HU08-04).
  - 'verificado' -> el Comité Revisor lo aprobó (CA23, T-HU08-05).
  - 'rechazado'  -> el Comité Revisor lo rechazó; la notificación lleva el motivo (CA23).
  - 'importado'  -> llegó desde ORCID y quedó verificado sin pasar por revisión (CA34, CA37 de
                    HU12). Sin este aviso el autor no se enteraría de un producto suyo que ya
                    aparece como verificado.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.notification import Notification

PRODUCT_LOADED = "cargado"
PRODUCT_VERIFIED = "verificado"
PRODUCT_REJECTED = "rechazado"
PRODUCT_IMPORTED = "importado"

# Plantillas de notificación (T-HU08-01): título fijo y cuerpo con «{title}» y, en el rechazo,
# «{reason}». Los títulos no cambian porque las pruebas de HU08 y HU12 los usan para reconocer
# cada aviso.
NOTIFICATION_TEMPLATES: dict[str, tuple[str, str]] = {
    PRODUCT_LOADED: (
        "Producto cargado exitosamente",
        "Tu producto «{title}» ha sido registrado correctamente y se encuentra en estado cargado.",
    ),
    PRODUCT_VERIFIED: (
        "Producto aprobado",
        "Tu producto «{title}» ha sido aprobado e incorporado al catálogo consolidado.",
    ),
    PRODUCT_REJECTED: (
        "Producto rechazado",
        "Tu producto «{title}» ha sido rechazado. Motivo: {reason}",
    ),
    PRODUCT_IMPORTED: (
        "Publicación importada y verificada",
        "Tu publicación «{title}» se importó desde ORCID y quedó registrada como verificada, "
        "sin pasar por revisión del Comité.",
    ),
}


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


def _already_notified(db: Session, product_id: str, user_id: str, title: str) -> bool:
    """CA24: ¿ya existe el aviso de este evento para este producto y este profesor?

    Se compara por título porque la tabla `notifications` no guarda el tipo de evento; los
    títulos son fijos (NOTIFICATION_TEMPLATES), así que identifican el evento sin ambigüedad.
    """
    return db.scalar(
        select(Notification.id).where(
            Notification.product_id == product_id,
            Notification.user_id == user_id,
            Notification.title == title,
        )
    ) is not None


def notify_product_event(db: Session, product, event: str, reason: str | None = None) -> Notification | None:
    """
    Notifica al AUTOR del producto un evento de su ciclo de vida (CA22, CA23).

    Devuelve la notificación creada, o None si ese evento ya se había notificado para este
    producto: un mismo cambio de estado nunca genera dos avisos (CA24). El control de unicidad
    vive aquí y no en quien llama, para que cualquier camino que cambie el estado quede cubierto.
    """
    if event not in NOTIFICATION_TEMPLATES:
        raise ValueError(f"Unknown product event: {event}.")

    if event == PRODUCT_REJECTED and not reason:
        # El motivo es parte del criterio: un rechazo sin motivo no se puede notificar (CA23).
        raise ValueError("A reason is required to notify a rejection.")

    title, body = NOTIFICATION_TEMPLATES[event]
    message = body.format(title=product.title, reason=reason)

    if _already_notified(db, product_id=product.id, user_id=product.owner_id, title=title):
        return None

    return create_notification(
        db=db,
        user_id=product.owner_id,
        title=title,
        message=message,
        product_id=product.id,
    )


# --- Consulta de las notificaciones del profesor (T-HU08-06, PGPCECMC-69; CA24) -------------
#
# Todas las funciones reciben el `user_id` del dueño y filtran por él: el aislamiento por
# propietario no es un parámetro opcional de la consulta, es la consulta. Así ninguna ruta puede
# devolver por descuido las notificaciones de otro profesor.


def count_unread(db: Session, user_id: str) -> int:
    """Cuántas notificaciones sin leer tiene el profesor."""
    return db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user_id, Notification.is_read.is_(False))
    ) or 0


def count_notifications(db: Session, user_id: str, only_unread: bool = False) -> int:
    """Cuántas notificaciones tiene el profesor en total (o solo las no leídas)."""
    condiciones = [Notification.user_id == user_id]
    if only_unread:
        condiciones.append(Notification.is_read.is_(False))

    return db.scalar(select(func.count()).select_from(Notification).where(*condiciones)) or 0


def list_notifications(
    db: Session,
    user_id: str,
    only_unread: bool = False,
    limit: int = 20,
    offset: int = 0,
) -> list[Notification]:
    """Notificaciones del profesor, de la más reciente a la más antigua.

    Se pagina porque la lista crece con cada producto y cada decisión del Comité; el orden es
    descendente para que el profesor vea primero lo último que pasó con sus productos.
    """
    condiciones = [Notification.user_id == user_id]
    if only_unread:
        condiciones.append(Notification.is_read.is_(False))

    return list(
        db.scalars(
            select(Notification)
            .where(*condiciones)
            .order_by(Notification.created_at.desc(), Notification.id.desc())
            .limit(limit)
            .offset(offset)
        )
    )


def mark_as_read(db: Session, user_id: str, notification_id: str) -> Notification | None:
    """Marca como leída una notificación del profesor.

    Devuelve None si la notificación no existe o no es suya: quien llama responde 404 en ambos
    casos, para no revelar que existe una notificación de otra persona.
    """
    notification = db.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    if notification is None:
        return None

    if not notification.is_read:
        notification.is_read = True
        db.commit()
        db.refresh(notification)

    return notification
