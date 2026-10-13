"""
File: database.py
Description: Database connection bridge.
"""

from collections.abc import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from app.config import settings

DATABASE_URL = settings.sqlalchemy_url

# SQLite (used by the test-suite / local prototyping) needs an extra flag to
# be usable from the TestClient thread; MySQL/PostgreSQL benefit instead from
# recycling stale pooled connections.
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine_options = {}
else:
    connect_args = {}
    engine_options = {"pool_pre_ping": True, "pool_recycle": 3600}

db_engine = create_engine(
        DATABASE_URL,
        connect_args = connect_args,
        **engine_options
)

SessionLocal = sessionmaker(
        autocommit = False,
        autoflush = False,
        bind = db_engine
)

BaseModelClass = declarative_base()


def get_database_session() -> Generator[Session, None, None]:
        """FastAPI dependency that yields a database session and always closes it."""
        db = SessionLocal()
        try:
                yield db
        finally:
                db.close()
