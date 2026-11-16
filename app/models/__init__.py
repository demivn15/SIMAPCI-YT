"""
Registro de modelos. Importar aquí cada modelo nuevo para que Alembic lo vea
en Base.metadata al generar migraciones.
"""

from app.models.product import Product
from app.models.user import User
from app.models.notification import Notification

__all__ = ["User", "Product", "Notification"]
