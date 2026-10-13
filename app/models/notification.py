"""
File: models/notification.py
Description: Per-user notifications about the review stage of their products
             (charter requirement #6: "cargado exitosamente, verificado,
             rechazado"). The frontend polls/lists this table instead of the
             API pushing anything, which keeps the backend simple and stateless
             beyond this row.
"""

import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import BaseModelClass


class NotificationProductType(str, enum.Enum):
    """Which kind of record the notification is about."""

    PUBLICATION = "publication"
    PROJECT = "project"


class NotificationModel(BaseModelClass):
    """One event in the lifecycle of a professor's submitted product."""

    __tablename__ = "notification"

    id = Column(Integer, primary_key = True, index = True, autoincrement = True)

    user_id = Column(Integer, ForeignKey("user.id", ondelete = "CASCADE"), index = True, nullable = False)

    product_type = Column(Enum(NotificationProductType), nullable = False)
    product_id = Column(Integer, nullable = False)

    # The verification status that triggered this notification, stored as
    # plain text so the notification survives even if the product is later
    # deleted (product_id would then point at nothing).
    status = Column(String(30), nullable = False)
    message = Column(String(500), nullable = False)

    is_read = Column(Boolean, default = False, nullable = False)
    created_at = Column(DateTime, server_default = func.now(), nullable = False)
    read_at = Column(DateTime, nullable = True)

    user = relationship("UserModel", back_populates = "notifications")
