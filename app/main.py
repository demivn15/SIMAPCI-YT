"""
File: main.py
Description: Application factory for RED PAPERS: metadata, middleware,
             routers and startup. See Charter.pdf for the product scope this
             API implements.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import BaseModelClass, db_engine
from app.routers import auth, notifications, orcid, projects, public, publications, review, users

# Imported for its side effect: it registers every model on the metadata that
# create_all() walks below. The alias keeps the name "app" free for the
# FastAPI instance declared further down.
from app import models as _registered_models  # noqa: F401

API_DESCRIPTION = """
**RED PAPERS**: Portal Web para la Visualización y Gestión de la Producción
Científica de los docentes de la Escuela de Ciencias Matemáticas y
Computacionales (ECMC), Yachay Tech.

### Flujo típico

1. Un docente se registra con `POST /auth/register` o inicia sesión con su
   ORCID iD (`GET /orcid/login`).
2. Inicia sesión y autoriza esta documentación con el botón **Authorize**.
3. Registra sus productos (`POST /publications`, `POST /projects`) de forma
   manual, o los importa automáticamente desde ORCID
   (`GET /orcid/works` + `POST /orcid/import`).
4. El comité de revisión (rol `admin`) verifica o rechaza los productos
   manuales desde `/review/*`; el docente recibe el resultado en
   `/notifications`.
5. Cualquier visitante consulta y filtra la producción pública y el
   dashboard de impacto en `/public/*`, y puede exportarla en CSV/Excel/PDF.

### Procedencia de los datos

| `source` | Significado | Revisión |
|----------|-------------|----------|
| `orcid`  | Importado automáticamente del registro ORCID del docente | Verificado automáticamente (fuente confiable) |
| `manual` | Cargado a mano, opcionalmente asistido por extracción de PDF | Pasa por el comité de revisión |

Fuera de alcance (ver Charter): gestión de fondos/presupuestos, soporte para
otras escuelas, minería de texto completo o detección de plagio, soporte
técnico en vivo, y repositorio de acceso abierto con almacenamiento de
manuscritos.
"""

OPENAPI_TAGS = [
    {"name": "Public", "description": "Open endpoints, catálogo y dashboard. Nunca requieren autenticación."},
    {"name": "Authentication", "description": "Registro, login, refresh y logout por email/contraseña."},
    {"name": "ORCID", "description": "Registro/login académico vía ORCID, e importación automática de publicaciones."},
    {"name": "Users", "description": "Perfil del docente autenticado."},
    {"name": "Publications", "description": "CRUD protegido de publicaciones científicas, propiedad de cada docente."},
    {"name": "Projects", "description": "CRUD protegido de proyectos de investigación, propiedad de cada docente."},
    {"name": "Review Committee", "description": "Verificación/rechazo de productos manuales. Solo rol admin."},
    {"name": "Notifications", "description": "Estado de verificación de los productos del docente."},
]


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Create the tables that do not exist yet before serving the first request."""
    BaseModelClass.metadata.create_all(bind = db_engine)
    yield


app = FastAPI(
    title = settings.APP_NAME,
    description = API_DESCRIPTION,
    version = settings.API_VERSION,
    openapi_tags = OPENAPI_TAGS,
    contact = {"name": "RED PAPERS / ECMC, Yachay Tech"},
    license_info = {"name": "MIT"},
    lifespan = lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins = settings.cors_origin_list,
    allow_credentials = True,
    allow_methods = ["*"],
    allow_headers = ["*"]
)

app.include_router(public.router)
app.include_router(auth.router)
app.include_router(orcid.router)
app.include_router(users.router)
app.include_router(publications.router)
app.include_router(projects.router)
app.include_router(review.router)
app.include_router(notifications.router)


@app.get(
    "/",
    tags = ["Public"],
    summary = "API entry point",
    description = "Minimal announcement of the API and where to find its documentation."
)
def root():
    """Return the name and version of the API."""
    return {
        "message": settings.APP_NAME,
        "version": settings.API_VERSION,
        "documentation": "/docs",
    }


@app.get(
    "/health",
    tags = ["Public"],
    summary = "Liveness probe",
    description = "Answers 200 while the process is able to serve requests."
)
def health():
    """Report that the service is up."""
    return {"status": "ok"}
