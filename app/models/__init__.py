"""
File: models/__init__.py
Description: Imports every model so SQLAlchemy can resolve relationships and
             create the whole schema from BaseModelClass.metadata.
"""

from app.models.common import ProductSource, VerificationStatus
from app.models.user import UserModel, UserRole
from app.models.refresh_token import RefreshTokenModel
from app.models.publication import PublicationModel, PublicationType
from app.models.project import ResearchProjectModel, ProjectStatus
from app.models.notification import NotificationModel, NotificationProductType

__all__ = [
    "ProductSource",
    "VerificationStatus",
    "UserModel",
    "UserRole",
    "RefreshTokenModel",
    "PublicationModel",
    "PublicationType",
    "ResearchProjectModel",
    "ProjectStatus",
    "NotificationModel",
    "NotificationProductType",
]
