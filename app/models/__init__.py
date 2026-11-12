"""
Registro de modelos. Importar aquí cada modelo nuevo para que Alembic lo vea
en Base.metadata al generar migraciones.
"""

from app.models.user import User
from app.models.product import Product

__all__ = ["User"]
