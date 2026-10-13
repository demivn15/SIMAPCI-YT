# RED PAPERS

**Portal Web para la Visualización y Gestión de la Producción Científica** de
los docentes de la Escuela de Ciencias Matemáticas y Computacionales (ECMC),
Yachay Tech. Este repositorio contiene el backend (API RESTful en FastAPI)
descrito en `Charter.pdf`.

## Arquitectura

```
app/
├── main.py                 Fábrica de la aplicación, routers, metadatos OpenAPI
├── config.py                Settings (DB, JWT, ORCID, Crossref/OpenAlex, admins)
├── database.py               Motor SQLAlchemy (MySQL/PostgreSQL o SQLite para pruebas)
├── models/                   Entidades: User, RefreshToken, Publication, Project, Notification
├── schemas/                   Contratos Pydantic de entrada/salida
├── security/                  JWT, hashing (bcrypt), sesiones de refresh, control de roles
├── integrations/              Clientes de APIs externas: ORCID, Crossref, OpenAlex
├── services/                  Lógica de negocio: métricas (h-index), export CSV/XLSX/PDF,
│                              notificaciones, extracción básica de PDF
└── routers/
    ├── auth.py                Registro/login/refresh/logout (email + contraseña)
    ├── orcid.py                Login/registro vía ORCID + importación de publicaciones
    ├── users.py                Perfil del docente autenticado
    ├── publications.py         CRUD protegido + validación DOI + export
    ├── projects.py             CRUD protegido + validación de código de proyecto + export
    ├── review.py                Verificación/rechazo por el comité (rol admin)
    ├── notifications.py         Estado de verificación de los productos del docente
    └── public.py                Catálogo público, dashboard de métricas y export público
```

Cada módulo es independiente (charter, requerimiento no funcional #4:
Modularidad), de forma que una nueva escuela o un nuevo tipo de producto se
pueda añadir sin rediseñar el resto del sistema.

## Flujo de datos y roles

- **Profesor (`role=professor`)**: se registra, inicia sesión, registra
  publicaciones/proyectos (manualmente o vía ORCID) y ve sus propias
  notificaciones.
- **Comité de revisión (`role=admin`)**: verifica o rechaza los productos
  `source=manual`. Se asigna automáticamente al registrarse si el email está
  en `ADMIN_BOOTSTRAP_EMAILS` (variable de entorno); no existe otra forma de
  auto-promoverse.
- **Público general**: consulta `/public/*` sin autenticarse.

Un producto (`Publication`/`ResearchProject`) tiene dos orígenes posibles
(`source`):

| `source`  | Flujo de verificación |
|-----------|------------------------|
| `orcid`   | Se asume confiable (viene del propio registro ORCID del docente) y se marca `VERIFIED` de inmediato. |
| `manual`  | Entra como `UPLOADED`, pasa por `/review/*` y termina en `VERIFIED` o `REJECTED`. Si el docente la edita tras un rechazo, vuelve a `UPLOADED` automáticamente. |

Solo los productos `VERIFIED` y marcados `is_public=true` aparecen en el
catálogo público y alimentan el dashboard de métricas.

## Puesta en marcha

```bash
python -m venv .venv
.venv\Scripts\Activate.ps1        # Windows PowerShell
pip install -e .
cp .env.example .env              # y completar los valores
uvicorn app.main:app --reload
```

Documentación interactiva: `http://127.0.0.1:8000/docs`

Para probar sin un servidor MySQL/PostgreSQL, usa SQLite en `.env`:

```
DATABASE_URL=sqlite:///./red_papers.db
```

## Integraciones externas (cada una en su propio módulo, ver `app/integrations/`)

- **ORCID** (`orcid_client.py`): OAuth 2.0 ("Sign in with ORCID") para
  registro/login académico, y lectura pública del registro de obras para
  autocompletar publicaciones.
- **Crossref** (`crossref.py`): valida la existencia de un DOI antes de
  aceptar una publicación manual, y trae metadatos básicos (título, revista,
  año, autores).
- **OpenAlex** (`openalex.py`): número de citas por DOI y métricas de autor
  (h-index) por ORCID iD, usadas para refrescar `citation_count` y como
  contraste del índice h calculado localmente.

Si alguna de estas integraciones no está configurada o no responde, el
registro manual sigue funcionando (mitigación de riesgo del charter: "permitir
el registro manual como alternativa").

## Fuera de alcance (ver Charter.pdf, sección "El proyecto no incluye")

- Gestión de financiamiento o presupuestos de investigación.
- Soporte para otras escuelas o instituciones externas.
- Minería de texto completo, detección de plagio o indexación semántica de PDFs
  (solo se extraen metadatos básicos: título, autores, año, DOI).
- Soporte técnico en vivo (chat 24/7).
- Repositorio de acceso abierto con almacenamiento de manuscritos.
