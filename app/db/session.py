"""
File: session.py
Author: Jhony Alfonso Peñaherrera
Description: Motor de base de datos y fábrica de sesiones. Expone get_db() como
dependencia de FastAPI para que cada petición use su propia sesión.
"""

from collections.abc import Generator

from app.core.config import settings
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

# pool_pre_ping evita errores "MySQL server has gone away" cuando una conexión
# del pool queda inactiva más tiempo que el wait_timeout del servidor.
# create_engine no abre conexiones: la primera se abre al ejecutar una consulta.
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=settings.DATABASE_ECHO,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """Entrega una sesión por petición y la cierra al terminar, incluso si hay error."""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
