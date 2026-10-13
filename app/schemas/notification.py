"""
File: schemas/notification.py
Description: Response contract for the notification feed (charter
             requirement #6).
"""

from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.notification import NotificationProductType


class NotificationResponse(BaseModel):
    id: int
    product_type: NotificationProductType
    product_id: int
    status: str
    message: str
    is_read: bool
    created_at: datetime
    read_at: datetime | None

    model_config = ConfigDict(from_attributes = True)


class NotificationListResponse(BaseModel):
    total: int
    unread_count: int
    items: list[NotificationResponse]
