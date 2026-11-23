"""
File: notifications.py
Description: Consulta de las notificaciones del profesor - T-HU08-06 (PGPCECMC-69).
             Criterio CA24 de HU08.

CA24: «Dado que el profesor consulta sus notificaciones, cuando las revisa, entonces ve
       únicamente las suyas y cada cambio de estado genera una sola notificación.»

Aislamiento por propietario: el dueño sale del token de sesión, nunca de un parámetro de la
petición. No hay forma de pedir las notificaciones de otro profesor, ni siquiera conociendo su
identificador; una notificación ajena responde 404 y no 403, para no revelar que existe.

El control de duplicados vive en app/services/notification_service.py (una notificación por
evento y producto, T-HU08-05) y lo respalda la restricción única del modelo.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_professor
from app.db.session import get_db
from app.schemas.notification import NotificationListResponse, NotificationResponse
from app.services.notification_service import (
    count_notifications,
    count_unread,
    list_notifications,
    mark_as_read,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])

MAX_PAGE_SIZE = 100


@router.get("", response_model=NotificationListResponse, status_code=status.HTTP_200_OK)
def get_my_notifications(
    only_unread: bool = Query(default=False, description="Devolver solo las no leídas"),
    limit: int = Query(default=20, ge=1, le=MAX_PAGE_SIZE, description="Tamaño de la página"),
    offset: int = Query(default=0, ge=0, description="Cuántas notificaciones saltar"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_professor),
):
    """
    Notificaciones del profesor autenticado, de la más reciente a la más antigua, con el
    contador de no leídas (CA24).

    `unread` cuenta todas las no leídas del profesor, sin importar el filtro ni la página, así
    que la pantalla puede mostrar el contador con una sola petición.
    """
    owner_id = current_user.get("user_id")

    return NotificationListResponse(
        unread=count_unread(db, owner_id),
        total=count_notifications(db, owner_id, only_unread=only_unread),
        items=[
            NotificationResponse.model_validate(notification)
            for notification in list_notifications(
                db, owner_id, only_unread=only_unread, limit=limit, offset=offset
            )
        ],
    )


@router.patch("/{notification_id}/read", response_model=NotificationResponse, status_code=status.HTTP_200_OK)
def mark_notification_as_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_professor),
):
    """
    Marca como leída una notificación propia, para que el contador de no leídas baje.

    404 si no existe o si es de otro profesor: desde fuera los dos casos se ven igual, de modo
    que la respuesta no sirve para averiguar qué notificaciones tienen los demás.
    """
    notification = mark_as_read(db, user_id=current_user.get("user_id"), notification_id=notification_id)
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")

    return notification
