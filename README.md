# RED PAPERS

**Web Portal for the Visualization and Management of the Scientific Output** of
the faculty of the School of Mathematical and Computational Sciences (ECMC),
Yachay Tech. This repository contains the backend (RESTful API in FastAPI)
described in `Project.pdf`.

## Architecture

```
app/
├── main.py                 Application factory, routers, OpenAPI metadata
├── config.py                Settings (DB, JWT, ORCID, Crossref/OpenAlex, admins)
├── database.py               SQLAlchemy engine (MySQL/PostgreSQL, or SQLite for testing)
├── models/                   Entities: User, RefreshToken, Publication, Project, Notification
├── schemas/                   Pydantic input/output contracts
├── security/                  JWT, hashing (bcrypt), refresh sessions, role-based access control
├── integrations/              External API clients: ORCID, Crossref, OpenAlex
├── services/                  Business logic: metrics (h-index), CSV/XLSX/PDF export,
│                              notifications, basic PDF extraction
└── routers/
    ├── auth.py                Register/login/refresh/logout (email + password)
    ├── orcid.py                Login/registration via ORCID + publication import
    ├── users.py                Authenticated professor's profile
    ├── publications.py         Protected CRUD + DOI validation + export
    ├── projects.py             Protected CRUD + project code validation + export
    ├── review.py                Verification/rejection by the committee (admin role)
    ├── notifications.py         Verification status of the professor's products
    └── public.py                Public catalog, metrics dashboard and public export
```

Each module is independent (Project, non-functional requirement #4:
Modularity), so that a new school or a new type of product can be added
without redesigning the rest of the system.

## Data flow and roles

- **Professor (`role=professor`)**: registers, logs in, records
  publications/projects (manually or via ORCID) and views their own
  notifications.
- **Review committee (`role=admin`)**: verifies or rejects `source=manual`
  products. This role is assigned automatically at registration if the email
  is listed in `ADMIN_BOOTSTRAP_EMAILS` (environment variable); there is no
  other way to self-promote.
- **General public**: browses `/public/*` without authentication.

A product (`Publication`/`ResearchProject`) has two possible origins
(`source`):

| `source`  | Verification flow |
|-----------|-------------------|
| `orcid`   | Assumed trustworthy (it comes from the professor's own ORCID record) and is marked `VERIFIED` immediately. |
| `manual`  | Enters as `UPLOADED`, goes through `/review/*` and ends up `VERIFIED` or `REJECTED`. If the professor edits it after a rejection, it automatically returns to `UPLOADED`. |

Only products that are `VERIFIED` and flagged `is_public=true` appear in the
public catalog and feed the metrics dashboard.

## Getting started

```bash
python -m venv .venv
.venv\Scripts\Activate.ps1        # Windows PowerShell
pip install -e .
cp .env.example .env              # then fill in the values
uvicorn app.main:app --reload
```

Interactive documentation: `http://127.0.0.1:8000/docs`

To test without a MySQL/PostgreSQL server, use SQLite in `.env`:

```
DATABASE_URL=sqlite:///./red_papers.db
```

## External integrations (each in its own module, see `app/integrations/`)

- **ORCID** (`orcid_client.py`): OAuth 2.0 ("Sign in with ORCID") for
  academic registration/login, and public reading of the works record to
  autofill publications.
- **Crossref** (`crossref.py`): validates that a DOI exists before accepting
  a manual publication, and fetches basic metadata (title, journal, year,
  authors).
- **OpenAlex** (`openalex.py`): citation count per DOI and author metrics
  (h-index) per ORCID iD, used to refresh `citation_count` and as a
  cross-check against the locally computed h-index.

If any of these integrations is not configured or does not respond, manual
registration still works (risk mitigation from the Project: "allow manual
registration as an alternative").

## Out of scope (see Project.pdf, section "The project does not include")

- Management of research funding or budgets.
- Support for other schools or external institutions.
- Full-text mining, plagiarism detection or semantic indexing of PDFs
  (only basic metadata is extracted: title, authors, year, DOI).
- Live technical support (24/7 chat).
- Open-access repository with manuscript storage.
