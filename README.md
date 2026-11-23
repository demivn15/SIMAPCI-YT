# SIMAPCI-YT — Scientific Production Management System (ECMC · Yachay Tech)

SIMAPCI-YT manages the scientific production of the School of Mathematical and Computational Sciences (ECMC) at Yachay Tech: professors sign in with their institutional account, register publications and research projects, and the school can browse and measure that production. The project is developed with Scrum; backlog and sprints live in Jira (project key `PGPCECMC`), and branches and commits are linked to Jira through the task key (for example `feature/PGPCECMC-33-doi-orcid-adapter`).

The repository is split by branch:

| Branch | What it holds | Status |
| :--- | :--- | :--- |
| `main` | **Institutional Professor Portal**, the system under development: FastAPI backend (`app/`) + React SPA (`frontend/`) with LDAP login, JWT session, professor accounts, product registration with DOI autocomplete and PDF extraction, ORCID import, council review and notifications | Sprint 1 closed · Sprint 2 in progress |
| `prototype` | **RED PAPERS prototype**: static React + TypeScript portal used to validate the UX (public catalog by school, dashboards, researcher directory, traceability matrix), with its own README and docs | Published on GitHub Pages |

This README describes the Institutional Professor Portal.

---

## Institutional Professor Portal — Authentication & Authorization System

A secure, scalable, role-based authentication and authorization web application designed for institutional portals. The system authenticates users against an institutional LDAP server, verifies role membership (restricting access to professors), and manages session state via secure, stateless JWT tokens delivered in `HttpOnly` cookies. On top of that, it stores each professor's profile in a relational database and lets professors register scientific products with metadata autocompleted from external services.

---

## Architecture Overview

```
                                      ┌──────────────────────┐   ┌──────────────────────────────┐
                                      │  Institutional LDAP  │   │  External metadata services  │
                                      │  / Active Directory  │   │  Crossref → OpenAlex, ORCID  │
                                      └──────────▲───────────┘   └──────────────▲───────────────┘
                  1-2. Search, bind,             │                              │  6. DOI / ORCID lookup
                       group check               │                              │     (5 s timeout, fallback)
┌─────────────────────────┐          ┌───────────┴──────────────────────────────┴───────┐
│     React Frontend      │HTTP/JSON │                 FastAPI Backend                  │
│  (Vite, Tailwind CSS,   │◄────────►│  (PyJWT, ldap3, Pydantic, SQLAlchemy, httpx,     │
│ TanStack Query, Axios)  │ HttpOnly │   Dependency Injection)                          │
└─────────────────────────┘  Cookie  └─────────────────────────┬────────────────────────┘
                                                               │ 5. Account provisioning
                                                     ┌─────────▼───────────┐
                                                     │  MySQL 8 (Alembic)  │
                                                     │  users · products   │
                                                     └─────────────────────┘
```

1. **Authentication Flow (Two-Step LDAP Bind):**
   * **Step 1 (Directory Search):** The backend uses a dedicated service account (`LDAP_BIND_DN`) to locate the target user by `uid` or `sAMAccountName` and retrieve user metadata and `memberOf` attributes.
   * **Step 2 (User Authentication):** The backend attempts an LDAP bind using the user’s full Distinguished Name (DN) and submitted password.
2. **Authorization (Role-Based Access Control - RBAC):**
   * Upon successful credential bind, the backend checks group membership against `LDAP_PROFESSOR_GROUP_CN` (either via the `memberOf` attribute or explicit group container lookup).
3. **Session Management (Stateless JWT in HttpOnly Cookies):**
   * Once authenticated and authorized, the backend issues an `HS256`-signed JWT token containing user identity details and role assertions.
   * The token is returned in a secure `HttpOnly`, `SameSite=Lax` cookie to prevent Cross-Site Scripting (XSS) and mitigate Cross-Site Request Forgery (CSRF).
4. **Frontend Session Hydration:**
   * On page load or refresh, the React client executes a `/auth/me` health query. If valid, user state is hydrated; if invalid (401), the frontend safely redirects to the login view.
5. **Account Provisioning (HU01 · PGPCECMC-20, 21):**
   * There is no separate sign-up form: the professor account is created in the database on the **first successful login**, with the identity returned by LDAP. Later logins reuse and synchronize the same account.
   * Email and username are normalized to lowercase, so duplicates are rejected (`409`). The table has **no password column**: credentials never leave the directory.
   * The login response includes `account_created: true` on the first access so the UI can confirm the registration.
6. **Product Autocomplete (HU03 · PGPCECMC-32, 33):**
   * The product form asks the backend for metadata by DOI. The backend queries Crossref first and falls back to OpenAlex; ORCID lists a profile's public works.
   * Any timeout or provider error is translated into `503` ("service unavailable") and a missing DOI into `404`, so the form can tell the professor what happened and keep what was already typed.
7. **Product Registration (HU03, HU07 · PGPCECMC-34, 35, 36, 60, 63):**
   * `POST /api/v1/products` saves the product for the signed-in professor with the initial status «cargado».
   * The DOI is normalized before saving; a DOI or project code that already exists returns `409`, so the same work is not registered twice.
   * **Existence check in the registration flow (PGPCECMC-63):** when the professor confirms the registration, the form calls `GET /api/v1/products/exists` first (CA19). On a match it does not save and says which identifier matched, noting when the existing product is already verified and public (CA20, RU-08). Without a DOI or project code there is nothing to check (RU-06), so the product is saved and the confirmation says existence could not be verified (CA21) — the same notice appears when the check service itself does not answer, because `POST /products` still rejects a duplicate with `409`.
8. **Document Upload and Extraction (HU04 · PGPCECMC-42, 43, 91):**
   * `POST /api/v1/integrations/upload` checks type, size (max 25 MB) and content (magic bytes), computes a SHA-256 integrity hash and extracts title, authors, year and abstract with `pdfplumber` to prefill the form.
   * **Unrecognized format (PGPCECMC-91):** PDF is the only format the system can read, so anything else is rejected with `400`; a file that carries the `%PDF` header but cannot be parsed (damaged, truncated or password-protected) is also rejected with `400` and a clear message instead of an internal error.
   * **Prefill in the registration form (PGPCECMC-45):** the extracted fields prefill the HU03 form according to the chosen product type — a publication takes the venue, a project takes the institutional code — and each one is tagged «Precargado». The research line is a closed catalogue, so it is only selected when the extracted text matches an official ECMC line. Everything stays editable and nothing is saved until the professor reviews it and presses «Guardar producto» (CA10, CA12).
   * **Partial extraction (PGPCECMC-91):** reading a PDF and identifying only some fields is not a failure. The response carries an `extraction` report (`status`: `completa` / `parcial` / `vacia`, plus `fields_found`, `fields_missing` and a message), so the form prefills what was identified, leaves the rest editable and tells the professor what is left to complete. A scanned PDF with no text is reported as `vacia`, still with `200`.
9. **ORCID Import and Council Review (HU12):**
   * `POST /api/v1/products/orcid-import` saves a professor's ORCID works with source `orcid`, skipping works whose DOI or ORCID id is already stored.
   * Council members (role `reviewer`) list pending products and approve («verificado») or reject («rechazado», with a reason) them; the decision, the reviewer and the date are stored.
10. **Notifications (HU08):**
    * Each status change (saved, approved, rejected) creates a notification for the product owner in the `notifications` table. There is no API or screen to list them yet.

---

## Tech Stack

### Backend
* **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+; CI runs 3.13)
* **LDAP Integration:** [`ldap3`](https://pypi.org/project/ldap3/)
* **Security & Tokens:** [`PyJWT`](https://pyjwt.readthedocs.io/)
* **Database:** MySQL 8 with [SQLAlchemy 2](https://www.sqlalchemy.org/), [Alembic](https://alembic.sqlalchemy.org/) migrations and `PyMySQL`
* **External APIs:** [`httpx`](https://www.python-httpx.org/) clients for Crossref, OpenAlex and ORCID
* **Documents:** [`pdfplumber`](https://github.com/jsvine/pdfplumber) to extract fields from uploaded PDFs
* **Settings Management:** [`pydantic-settings`](https://docs.pydantic.dev/)
* **ASGI Server:** `uvicorn`

### Frontend
* **Core & Build Tool:** [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
* **Styling:** [Tailwind CSS 4](https://tailwindcss.com/) and `src/styles/portal.css`, which reproduces the look of the prototype (ECMC colors, Bricolage Grotesque and Source Sans 3 fonts)
* **Icons:** [`lucide-react`](https://lucide.dev/)
* **State Management & Data Fetching:** [TanStack Query (React Query v5)](https://tanstack.com/query/latest)
* **Routing:** [React Router v7](https://reactrouter.com/)
* **HTTP Client:** [Axios](https://axios-http.com/)

### Quality
* **Backend:** `pytest` and `ruff` (run by GitHub Actions on every push and pull request to `main`)
* **Frontend:** [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) and ESLint (run locally; CI does not run the frontend yet)

---

## Key Security Implementation Features

* **HttpOnly & SameSite Cookies:** Eliminates JavaScript access to tokens, making session hijacking via XSS impossible.
* **Strict CORS Policy:** Configured via FastAPI middleware with `allow_credentials=True` restricted to explicitly whitelisted origin domains.
* **Non-Enumeration Auth Response:** Credentials and authorization errors return generic 401 responses to prevent account harvest attacks.
* **Connection Fail-Fast:** LDAP connections enforce a 5-second connection timeout, returning clean `503 Service Unavailable` responses during directory server downtime.
* **No Stored Passwords:** The `users` table keeps only the institutional profile; authentication is always delegated to LDAP.
* **Closed Integration Proxy:** The DOI/ORCID endpoints require a professor session, so the API cannot be used as an open proxy to external services. The file upload endpoint does not check the session yet (see [Known issues](#known-issues)).

---

## Directory Structure

```
.
├── .env.example                 # Template for the local .env (LDAP, database, integrations, CORS)
├── docker-compose.yml           # Local mock OpenLDAP + MySQL 8
├── alembic.ini                  # Alembic configuration (URL taken from DATABASE_URL)
├── requirements.txt             # Backend + test dependencies
├── pytest.ini / ruff.toml       # Test and lint configuration
├── render.yaml                  # Render blueprint for the API (not deployed yet)
├── TESTS.md                     # Manual QA walkthrough against the mock LDAP
├── .github/workflows/
│   └── ci.yml                   # Backend CI: ruff + pytest
├── app/                         # FastAPI Backend Application
│   ├── main.py                  # FastAPI initialization, CORS and routers
│   ├── api/
│   │   ├── deps.py              # Security dependencies (get_current_user, require_roles, get_current_professor)
│   │   └── v1/
│   │       ├── auth.py          # Auth endpoints (/login, /me, /logout, /refresh) + account provisioning
│   │       ├── registration.py  # Registration form validation (/auth/register)
│   │       ├── integrations.py  # DOI and ORCID lookup, document upload and extraction
│   │       ├── products.py      # Product registration, ORCID import and council review
│   │       └── professor.py     # Example private route (/professor/dashboard)
│   ├── core/
│   │   ├── config.py            # Pydantic environment configuration
│   │   └── security.py          # JWT creation, decoding, and validation
│   ├── db/
│   │   ├── base.py              # SQLAlchemy declarative base
│   │   └── session.py           # Engine and per-request session (get_db)
│   ├── models/
│   │   ├── user.py              # User model (professor / reviewer)
│   │   ├── product.py           # Product model (publication / project, status, review data)
│   │   └── notification.py      # Notification model (one per status change)
│   ├── schemas/
│   │   ├── product.py           # Product, ORCID import and review payloads
│   │   └── registration.py      # Registration form payload
│   ├── services/
│   │   ├── ldap_service.py      # LDAP authentication and RBAC logic
│   │   ├── user_service.py      # Account creation on first login, duplicate control
│   │   ├── user_store.py        # In-memory store for /auth/register (not persistent)
│   │   ├── doi_lookup_service.py  # Crossref → OpenAlex fallback rules
│   │   ├── product_service.py   # Saving, duplicate control, ORCID import and review rules
│   │   └── notification_service.py  # Creates the owner's notifications
│   ├── integrations/
│   │   ├── base.py              # HTTP client, timeouts, error translation
│   │   ├── crossref.py          # Crossref adapter
│   │   ├── openalex.py          # OpenAlex adapter
│   │   └── orcid.py             # ORCID works adapter
│   └── utils/
│       ├── identifiers.py       # DOI / ORCID normalization and validation
│       ├── file_validation.py   # Upload type (PDF only), size, magic bytes and SHA-256
│       └── pdf_extractor.py     # Field extraction from PDFs (pdfplumber) + unreadable / partial handling
├── migrations/
│   └── versions/
│       ├── 0001_create_users_table.py
│       └── 0002_create_products_table.py
├── frontend/                    # React Single-Page Application
│   ├── public/assets/           # Yachay Tech logo
│   ├── src/
│   │   ├── App.jsx              # React router configuration
│   │   ├── components/          # ProtectedRoute guard + portal/ (AccessScreen, PortalLayout, Brand logos)
│   │   ├── context/             # AuthContext & TanStack Query wrapper
│   │   ├── pages/               # PublicHomePage, LoginPage, DashboardPage, RegisterProductPage (+ *.test.jsx)
│   │   ├── services/            # api.js (Axios, withCredentials) and productService.js
│   │   ├── utils/               # loginMessages.js (status code → message), fileValidation.js (PDF-only upload checks)
│   │   ├── constants/           # products.js (types, research lines, project states), school.js (ECMC data)
│   │   ├── styles/              # portal.css (look of the prototype)
│   │   └── assets/fonts/        # Bricolage Grotesque and Source Sans 3 (OFL licenses included)
│   ├── vitest.config.js         # Frontend test configuration
│   └── vite.config.js           # Vite build configuration
├── tests/                       # Backend tests (pytest)
│   ├── conftest.py              # Test settings + in-memory SQLite instead of MySQL
│   ├── backend/                 # Unit and integration tests per module
│   ├── acceptance/              # Acceptance tests, one file per Jira test case (PR-HUxx-yy)
│   ├── performance/             # Response-time measurements (T-HU02-07)
│   └── support/                 # Test doubles: simulated LDAP directory, simulated network, test PDFs
└── docs/
    └── deployment.md            # Deployment notes and limits (Render)
```

---

## API Endpoint Reference

| Method | Endpoint | Protection | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Public | Health check |
| `POST` | `/api/v1/auth/login` | Public | Authenticates credentials with LDAP, checks RBAC, creates the account on first access and sets the `HttpOnly` JWT cookie. Returns `account_created` |
| `GET` | `/api/v1/auth/me` | Professor session | Validates session cookie and returns user profile details |
| `POST` | `/api/v1/auth/refresh` | Professor session | Issues a new token before the current one expires (the SPA calls it every 30 min) |
| `POST` | `/api/v1/auth/logout` | Public | Revokes the current token and clears the `access_token` cookie |
| `POST` | `/api/v1/auth/register` | Public | Validates the registration form (institutional email domain, required fields); keeps only a password hash in memory |
| `GET` | `/api/v1/professor/dashboard` | Professor session | Example private route |
| `GET` | `/api/v1/integrations/doi/{doi}` | Professor session | Metadata for a DOI (title, authors, year, venue, abstract). Accepts `https://doi.org/...` links |
| `GET` | `/api/v1/integrations/orcid/{orcid}/works` | Professor session | Public works of an ORCID profile, without duplicates |
| `POST` | `/api/v1/integrations/upload` | Public (session check pending) | Validates an uploaded PDF (type, 25 MB limit, magic bytes, SHA-256) and extracts its fields, reporting which ones are still missing |
| `POST` | `/api/v1/products` | Professor session | Saves a publication or project with status «cargado». `409` if the DOI or project code already exists |
| `GET` | `/api/v1/products/exists` | Professor session | Pre-save existence check by DOI or project code, used by the registration form. `422` if the DOI is malformed |
| `POST` | `/api/v1/products/orcid-import` | Professor session | Saves ORCID works (source `orcid`) and skips the ones already stored |
| `GET` | `/api/v1/products/review-queue` | Professor session + `reviewer` role in the database | Products waiting for the council |
| `PATCH` | `/api/v1/products/{id}/review` | Professor session + `reviewer` role in the database | Approves («verificado») or rejects («rechazado», reason required) a pending product |

Login status codes: `401` invalid credentials or not a professor · `403` inactive account · `409` email already linked to another account · `502` the directory returned an incomplete identity · `503` directory unreachable. Integration status codes: `400` malformed identifier · `404` no data · `503` external service unavailable. Upload status codes: `400` not a PDF or PDF that cannot be read · `413` over the size limit.

### Frontend Routes

The screens follow the design of the `prototype` branch (ECMC colors, fonts and layout), showing only what already has a backend.

| Route | Access | Screen |
| :--- | :--- | :--- |
| `/` | Public | ECMC access screen with «Iniciar sesión» (the public catalog arrives with HU05) |
| `/login` | Public | Login box over the access screen, with Spanish error messages |
| `/dashboard` | Session required | Professor home: side menu and «Accesos rápidos» (shows a confirmation on the first access) |
| `/products/new` | Session required | Registration window over the home page: DOI autocomplete, document upload with extraction, save. `?tipo=proyecto` opens it as a project |
| any other | — | Redirects to `/` |

### Data Model

* `users` (migration `0001`): UUID `id`, `username` and `email` (unique, lowercase), `full_name`, `role` (`professor` or `reviewer`), `is_active`, `school` (default `ECMC`, not hard-coded), optional academic identifiers (`orcid` unique, Google Scholar, Scopus, Web of Science), self-reported h-indexes, `research_lines` (JSON) and audit timestamps. There is no password column.
* `products` (migration `0002`): UUID `id`, `owner_id` → `users`, `school`, `type` (`publicacion` / `proyecto`), `title`, `authors` (JSON), `year`, `research_line`, `abstract`; for publications `doi` (unique) and `venue`; for projects `project_code` (unique) and `project_status`; `status` (`cargado` → `verificado` / `rechazado`), `source` (`manual` / `orcid`) and `external_id`; review data (`reviewed_by`, `reviewed_at`, `review_reason`) and timestamps.
* `notifications` (model only, **no migration yet**): `user_id`, optional `product_id`, `title`, `message`, `is_read`, `created_at`.

---

## Project Status

**Sprint 1 (24 Oct – 5 Nov 2026) — closed.** HU01 (professor account), HU02 (sign in and sign out) and HU03 (product registration with DOI autocomplete and saving with status «cargado») are complete in `main`.

**Sprint 2 — in progress.** What is already in `main`:

| User story | Implemented in `main` | Still pending |
| :--- | :--- | :--- |
| **HU04** Autocomplete a research project from its PDF | Upload with type, size and integrity checks (PGPCECMC-42), PDF field extraction (PGPCECMC-43), handling of unrecognized formats and partial extraction (PGPCECMC-91), extraction wired into the registration form (PGPCECMC-45), test PR-HU04-02 | PGPCECMC-40, 41, 44 |
| **HU05** View the scientific production (public) | — | Public list and detail (`/produccion`), PGPCECMC-47 to 52 |
| **HU06** Filter the scientific production | — | Filters on the HU05 list, PGPCECMC-53 to 58 |
| **HU07** Check that a product exists before adding it | DOI normalization and duplicate control, pre-save existence check wired into the registration form (PGPCECMC-60, 63), tests PR-HU07-01, PR-HU07-02 and T-HU07-06 | — |
| **HU08** Receive product status notifications | Notifications on save, approval and rejection, test PR-HU08-01 | `notifications` migration (see [Known issues](#known-issues)) and PGPCECMC-69 |
| **HU12** Consolidate ORCID and reviewed publications | ORCID import, council review queue and decisions, tests PR-HU12-01 to 03 | Reviewer access through the API (defect D-05) |

The frontend follows the design of the `prototype` branch for the screens that already have a backend (public access, login, professor home and product registration).

---

## Testing & QA

The QA suite turns each Jira test case into an automated test and runs the team's real code against simulated external services:

* **Simulated LDAP directory** (`tests/support/directorio_ldap.py`): an in-memory `ldap3` directory with two professors and one student, so login tests exercise the real `LDAPService` (search, bind and group check).
* **Simulated network** (`tests/support/red_simulada.py`): replaces only the HTTP layer, so the full chain endpoint → `DoiLookupService` → Crossref/OpenAlex adapters runs with controlled responses, errors, timeouts and outages.
* **Database:** in-memory SQLite (`tests/conftest.py`). Tables are created from the models, so a missing Alembic migration is not caught by the tests.

| Jira | Test case | File |
| :--- | :--- | :--- |
| PGPCECMC-99 | PR-HU01-01 · Registration with valid and invalid institutional email | `tests/acceptance/test_pr_hu01_01.py` |
| PGPCECMC-100 | PR-HU01-02 · No plain-text credentials in database, token, responses or logs | `tests/acceptance/test_pr_hu01_02.py` |
| PGPCECMC-101 | PR-HU02-01 · Access with valid and invalid credentials | `tests/acceptance/test_pr_hu02_01.py` |
| PGPCECMC-102 | PR-HU02-02 · Private functions denied without a session or after logout | `tests/acceptance/test_pr_hu02_02.py` + `frontend/src/App.test.jsx` |
| PGPCECMC-103 | PR-HU03-01 · Product registration with a valid DOI and prefilled data | `tests/acceptance/test_pr_hu03_01.py` + `frontend/src/pages/RegisterProductPage.test.jsx` |
| PGPCECMC-104 | PR-HU03-02 · External service outage during autocomplete | `tests/acceptance/test_pr_hu03_02.py` + `frontend/src/pages/RegisterProductPage.test.jsx` |
| PGPCECMC-106 | PR-HU04-02 · Non-PDF, damaged and oversized files are rejected without losing the form | `tests/acceptance/test_pr_hu04_02.py` + `frontend/src/pages/RegisterProductPage.hu04.test.jsx` |
| PGPCECMC-45 | T-HU04-06 · Extraction prefills the form by product type, stays editable and saves only on confirmation | `frontend/src/pages/RegisterProductPage.hu04-integracion.test.jsx` |
| PGPCECMC-91 | T-HU04-05 · Unrecognized format rejected with a clear message, and partial extraction reported instead of failing | `tests/backend/test_pdf_extraction.py` + `frontend/src/pages/RegisterProductPage.hu04-extraccion.test.jsx` |
| PGPCECMC-111 | PR-HU07-01 · Duplicate DOI rejected in its different formats | `tests/acceptance/test_pr_hu07_01.py` |
| PGPCECMC-112 | PR-HU07-02 · Product without DOI or project code | `tests/acceptance/test_pr_hu07_02.py` + `frontend/src/pages/RegisterProductPage.hu07.test.jsx` |
| PGPCECMC-63 | T-HU07-05 · Existence check integrated into the registration flow (match blocks the save, no identifier warns) | `frontend/src/pages/RegisterProductPage.hu07-verificacion.test.jsx` |
| PGPCECMC-113 | PR-HU08-01 · One notification per status change, with the reason on rejection | `tests/acceptance/test_pr_hu08_01.py` |
| PGPCECMC-121 | PR-HU12-01 · ORCID import persists, keeps its source and does not duplicate | `tests/acceptance/test_pr_hu12_01.py` |
| PGPCECMC-122 | PR-HU12-02 · Council approves and rejects manual publications | `tests/acceptance/test_pr_hu12_02.py` |
| PGPCECMC-123 | PR-HU12-03 · Review without permission and manual entry of an imported DOI | `tests/acceptance/test_pr_hu12_03.py` |
| PGPCECMC-31 | T-HU02-07 · Authentication, authorization and response time | `tests/performance/test_t_hu02_07_tiempos.py` |
| PGPCECMC-23 / 24 | T-HU01-06 / 07 · Registration confirmation and result messages | `frontend/src/pages/LoginPage.test.jsx` |

Tests marked `xfail(strict=True)` (pytest) or `it.fails` (Vitest) document a known defect and name the Jira task it belongs to. They do not break CI; when the fix lands, the test reports an unexpected pass and the marker must be removed (`it.fails` becomes `it`). Response times use a provisional threshold of p95 ≤ 500 ms (`RNF02_P95_MS`) until RNF02 defines one.

```bash
pytest                          # backend: unit, integration, acceptance and performance
pytest tests/performance -s     # prints the response-time table
ruff check .                    # backend lint (also run by CI)
cd frontend && npm test         # frontend: Vitest
cd frontend && npm run lint     # frontend lint (ESLint)
cd frontend && npm run build    # frontend production build
```

Current results on `main`: backend `349 passed, 1 skipped, 4 xfailed`; frontend `64 passed`. CI runs only the backend (`ruff` + `pytest`), so run the frontend commands locally before opening a pull request.

### Known defects documented by tests

| Id | Defect | Test | Jira task |
| :--- | :--- | :--- | :--- |
| D-05 | Review routes use `get_current_professor`, so a council member (role `reviewer`) gets `403` | PR-HU08-01 CP-08, PR-HU12-02 CP-07 | PGPCECMC-96 |
| D-07 | ORCID import does not validate the year or the research line | PR-HU12-01 CP-09 | PGPCECMC-95 |

Closed: **D-06** (saving without DOI did not warn that duplicates were not checked), fixed in T-HU07-05 (PGPCECMC-63); **D-08** (upload accepted DOCX and ZIP) and **D-09** (a damaged PDF returned `500`), both fixed in T-HU04-05 (PGPCECMC-91). Their test cases — `RegisterProductPage.hu07.test.jsx` CP-07, PR-HU04-02 CP-05 and CP-06, and `RegisterProductPage.hu04.test.jsx` CP-10 — now pass.

One open discrepancy against Jira: T-HU04-03 asks for a **10 MB** limit and both the code and PR-HU04-02 CP-04 use **25 MB** (PGPCECMC-42).

---

## Local Setup & Quickstart

### Prerequisites
* Python 3.10+
* Node.js 22 & npm
* Docker & Docker Compose

### 1. Environment Configuration
Copy the template and adjust it if needed. It already points to the mock LDAP and the MySQL container:

```bash
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
```

Key variables: `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `DATABASE_URL`, `LDAP_*`, `INTEGRATIONS_CONTACT_EMAIL`, `INTEGRATIONS_TIMEOUT_SECONDS` and `BACKEND_CORS_ORIGINS`.

### 2. Backend Initialization
```bash
# Start the mock LDAP directory and MySQL
docker compose up -d

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create the database tables
alembic upgrade head

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Initialization
```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

Visit `http://localhost:5173` to access the portal. With the mock directory, sign in as `professor` / `professor` (see [`TESTS.md`](TESTS.md) for the other test accounts). Keep the backend and the frontend running in two separate terminals.

### Windows (PowerShell)

The same steps work in PowerShell with these differences:

```powershell
.\venv\Scripts\python -m pip install -r requirements.txt
.\venv\Scripts\alembic upgrade head
.\venv\Scripts\python -m uvicorn app.main:app --reload --port 8000

cd frontend
npm.cmd install      # use npm.cmd / npx.cmd if the execution policy blocks npm.ps1
npm.cmd run dev
```

### Troubleshooting

| Symptom | Cause and fix |
| :--- | :--- |
| `Access denied for user 'simapci'@'localhost'` in the backend | A local MySQL service (for example `MySQL84` on Windows) is using port 3306 instead of the Docker container. Stop it (`Stop-Service MySQL84` as administrator), then `docker compose restart` |
| `Lost connection to MySQL server` right after starting Docker | MySQL is still starting. Wait until `docker compose ps` shows `healthy` |
| The login screen says «No hay conexión con el servidor» | The backend is not running, or it failed with `500` (the browser then hides the response). Check the backend terminal |
| Vite starts on port 5174 | Another `npm run dev` is still open. Close it: the backend only accepts `http://localhost:5173` (`BACKEND_CORS_ORIGINS`) |
| `lucide-react` could not be resolved | Run `npm install` again inside `frontend/` |

---

## Known issues

* **`notifications` has no migration.** The model exists, but `0002` only creates `products`. In MySQL, saving or reviewing a product can fail until a `0003` migration creates the table (HU08, PGPCECMC-67).
* **Upload without session check.** `POST /api/v1/integrations/upload` does not require a professor session yet.
* **Defects D-05 and D-07** (see [Known defects documented by tests](#known-defects-documented-by-tests)).
* **The extractor does not read the project code yet.** T-HU04-02 lists the institutional code among the fields to extract and the form already prefills it, but `app/utils/pdf_extractor.py` has no heuristic for it, so it always arrives empty (T-HU04-04, PGPCECMC-43).
* **No public product detail route.** On a match, HU07 names the identifier but cannot link to the existing product: `/produccion/:id` belongs to HU05 (PGPCECMC-47 to 52) and does not exist yet, so a link would bounce the professor to the public home page.

---

## Deployment

* **Prototype:** published to GitHub Pages from the `prototype` branch (its `.github/workflows/pages.yml`): <https://demivn15.github.io/SIMAPCI-YT/>.
* **Portal API:** `render.yaml` describes a Render web service, but it is not deployed yet: it needs an LDAP directory and a MySQL database reachable from the internet. See [`docs/deployment.md`](docs/deployment.md).

---

## Contributors

| Member | Main contributions |
| :--- | :--- |
| Demian Viteri (`demivn15`) | LDAP login and JWT session, FastAPI and React scaffold, CI workflow |
| Jhony Peñaherrera (`ShonyALV`) | Users table and migrations, account provisioning, login UI, product form, DOI/ORCID integrations, PR-HU01-01 |
| Alejandro Ortiz (`Aleortz`) | CI lint and test pipeline, Render deployment blueprint |
| Camilo Vásquez (`Camimilo-11`) | RED PAPERS prototype (`prototype` branch), QA suite for Sprints 1 and 2 (acceptance, security, resilience and performance tests), account-created confirmation, Sprint 1 closure fixes, frontend design based on the prototype, Scrum Master in Sprint 2 |
