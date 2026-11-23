"""
File: notification.py
Description: Esquemas de la consulta de notificaciones del profesor - T-HU08-06 (PGPCECMC-69).
             Criterio CA24.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    """Una notificación tal como la ve su dueño.

    No incluye `user_id`: la consulta siempre devuelve las notificaciones del profesor que la
    hace, así que repetir su identificador en cada elemento no aporta nada.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    message: str
    is_read: bool
    product_id: str | None = None
    created_at: datetime


class NotificationListResponse(BaseModel):
    """Página de notificaciones con el contador de no leídas (CA24).

    - `unread`: no leídas del profesor, independiente del filtro y de la página, para que la
      pantalla pueda mostrar el contador sin pedir la lista completa.
    - `total`: cuántas notificaciones hay con el filtro aplicado, para paginar.
    - `items`: la página pedida, de la más reciente a la más antigua.
    """

    unread: int
    total: int
    items: list[NotificationResponse]
