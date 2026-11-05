"""
File: base.py
Author: Jhony Alfonso Peñaherrera
Description: Base declarativa de SQLAlchemy. Todos los modelos heredan de Base
para que Alembic encuentre sus tablas en Base.metadata.
"""

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

# Convención de nombres para índices y restricciones. Sin ella, cada motor
# inventa sus propios nombres y las migraciones de Alembic dejan de ser
# reproducibles entre MySQL (producción) y SQLite (pruebas).
NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
