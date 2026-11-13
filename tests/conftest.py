"""
Configuraci├│n compartida de pytest.

1. Define variables de entorno de prueba (si no existen) para que la app arranque
   sin un archivo .env.
2. Reemplaza la BD real (MySQL) por SQLite en memoria en TODAS las pruebas que
   llaman a la API. As├¡ el endpoint /auth/login, que ahora guarda el perfil del
   profesor, se puede probar en el CI sin un servidor MySQL.
"""

import os

for key, value in {
    "SECRET_KEY": "test-secret-key-for-ci-only-0123456789",
    "ALGORITHM": "HS256",
    "ACCESS_TOKEN_EXPIRE_MINUTES": "60",
    "LDAP_SERVER_URI": "ldap://localhost:10389",
    "LDAP_BIND_DN": "cn=admin,dc=planetexpress,dc=com",
    "LDAP_BIND_PASSWORD": "GoodNewsEveryone",
    "LDAP_USER_BASE_DN": "ou=people,dc=planetexpress,dc=com",
    "LDAP_GROUP_BASE_DN": "ou=people,dc=planetexpress,dc=com",
    "LDAP_PROFESSOR_GROUP_CN": "admin_staff",
}.items():
    os.environ.setdefault(key, value)

import pytest  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.models  # noqa: E402,F401  (registra los modelos en Base.metadata)
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402

# StaticPool + check_same_thread=False: una sola conexi├│n compartida, necesaria
# porque cada conexi├│n nueva a ":memory:" crear├¡a una BD vac├¡a distinta, y
# TestClient atiende las peticiones en otro hilo.
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=test_engine, autoflush=False, expire_on_commit=False)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def clean_database():
    """Cada prueba empieza con las tablas vac├¡as."""
    Base.metadata.create_all(test_engine)
    yield
    Base.metadata.drop_all(test_engine)


@pytest.fixture
def db_session():
    """Sesi├│n sobre la misma BD que usa la API en las pruebas."""
    with TestingSessionLocal() as session:
        yield session
