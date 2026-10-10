"""
File: database.py
Description: Database connection bridge.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

DATABASE_URL = (
        f"mysql+pymysql://{settings.DB_USER}:{settings.DB_PASSWORD}"
        f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
)

db_engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(
        autocommit = False, 
        autoflush = False, 
        bind = db_engine
)

BaseModelClass = declarative_base()

def get_database_session():
        db = SessionLocal()
        try:
                yield db
        finally:
                db.close()