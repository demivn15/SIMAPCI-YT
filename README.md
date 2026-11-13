# SIMAPCI-YT — Scientific Production Management System (ECMC · Yachay Tech)

SIMAPCI-YT manages the scientific production of the School of Mathematical and Computational Sciences (ECMC) at Yachay Tech: professors sign in with their institutional account, register publications and research projects, and the school can browse and measure that production. The project is developed with Scrum; backlog and sprints live in Jira (project key `PGPCECMC`), and branches and commits are linked to Jira through the task key (for example `feature/PGPCECMC-33-doi-orcid-adapter`).

The repository is split by branch:

| Branch | What it holds | Status |
| :--- | :--- | :--- |
| `main` | **Institutional Professor Portal**, the system under development: FastAPI backend (`app/`) + React SPA (`frontend/`) with LDAP login, JWT session, professor accounts and product registration with DOI/ORCID autocomplete | Sprint 1 (in progress) |
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
                                                     │     users table     │
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

---

## Tech Stack

### Backend
* **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+; CI runs 3.13)
* **LDAP Integration:** [`ldap3`](https://pypi.org/project/ldap3/)
* **Security & Tokens:** [`PyJWT`](https://pyjwt.readthedocs.io/)
* **Database:** MySQL 8 with [SQLAlchemy 2](https://www.sqlalchemy.org/), [Alembic](https://alembic.sqlalchemy.org/) migrations and `PyMySQL`
* **External APIs:** [`httpx`](https://www.python-httpx.org/) clients for Crossref, OpenAlex and ORCID
* **Settings Management:** [`pydantic-settings`](https://docs.pydantic.dev/)
* **ASGI Server:** `uvicorn`

### Frontend
* **Core & Build Tool:** [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
* **Styling:** [Tailwind CSS 4](https://tailwindcss.com/)
* **State Management & Data Fetching:** [TanStack Query (React Query v5)](https://tanstack.com/query/latest)
* **Routing:** [React Router v7](https://reactrouter.com/)
* **HTTP Client:** [Axios](https://axios-http.com/)

### Quality
* **Backend:** `pytest` and `ruff` (run by GitHub Actions on every push and pull request to `main`)
* **Frontend:** [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/)

---

## Key Security Implementation Features

* **HttpOnly & SameSite Cookies:** Eliminates JavaScript access to tokens, making session hijacking via XSS impossible.
* **Strict CORS Policy:** Configured via FastAPI middleware with `allow_credentials=True` restricted to explicitly whitelisted origin domains.
* **Non-Enumeration Auth Response:** Credentials and authorization errors return generic 401 responses to prevent account harvest attacks.
* **Connection Fail-Fast:** LDAP connections enforce a 5-second connection timeout, returning clean `503 Service Unavailable` responses during directory server downtime.
* **No Stored Passwords:** The `users` table keeps only the institutional profile; authentication is always delegated to LDAP.
* **Closed Integration Proxy:** The DOI/ORCID endpoints require a professor session, so the API cannot be used as an open proxy to external services.

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
│   │   ├── deps.py              # Security dependency injection (get_current_professor)
│   │   └── v1/
│   │       ├── auth.py          # Auth endpoints (/login, /me, /logout) + account provisioning
│   │       └── integrations.py  # DOI and ORCID lookup endpoints
│   ├── core/
│   │   ├── config.py            # Pydantic environment configuration
│   │   └── security.py          # JWT creation, decoding, and validation
│   ├── db/
│   │   ├── base.py              # SQLAlchemy declarative base
│   │   └── session.py           # Engine and per-request session (get_db)
│   ├── models/
│   │   └── user.py              # User model (professor / reviewer)
│   ├── services/
│   │   ├── ldap_service.py      # LDAP authentication and RBAC logic
│   │   ├── user_service.py      # Account creation on first login, duplicate control
│   │   └── doi_lookup_service.py  # Crossref → OpenAlex fallback rules
│   ├── integrations/
│   │   ├── base.py              # HTTP client, timeouts, error translation
│   │   ├── crossref.py          # Crossref adapter
│   │   ├── openalex.py          # OpenAlex adapter
│   │   └── orcid.py             # ORCID works adapter
│   └── utils/
│       └── identifiers.py       # DOI / ORCID normalization and validation
├── migrations/
│   └── versions/
│       └── 0001_create_users_table.py
├── frontend/                    # React Single-Page Application
│   ├── src/
│   │   ├── App.jsx              # React router configuration
│   │   ├── components/          # ProtectedRoute guard component
│   │   ├── context/             # AuthContext & TanStack Query wrapper
│   │   ├── pages/               # LoginPage, DashboardPage, RegisterProductPage (+ *.test.jsx)
│   │   ├── services/            # api.js (Axios, withCredentials) and productService.js
│   │   ├── utils/               # loginMessages.js (status code → user message)
│   │   └── constants/           # products.js (product types, research lines, project states)
│   ├── vitest.config.js         # Frontend test configuration
│   └── vite.config.js           # Vite build configuration
├── tests/                       # Backend tests (pytest)
│   ├── conftest.py              # Test settings + in-memory SQLite instead of MySQL
│   ├── backend/                 # Unit and integration tests per module
│   ├── acceptance/              # Acceptance tests, one file per Jira test case (PR-HUxx-yy)
│   ├── performance/             # Response-time measurements (T-HU02-07)
│   └── support/                 # Test doubles: simulated LDAP directory and simulated network
└── docs/
    └── deployment.md            # Deployment notes and limits (Render)
```

---

## API Endpoint Reference

| Method | Endpoint | Protection | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Public | Health check |
| `POST` | `/api/v1/auth/login` | Public | Authenticates credentials with LDAP, checks RBAC, creates the account on first access and sets the `HttpOnly` JWT cookie. Returns `account_created` |
| `GET` | `/api/v1/auth/me` | Protected (Professor) | Validates session cookie and returns user profile details |
| `POST` | `/api/v1/auth/logout` | Public | Clears the `access_token` session cookie |
| `GET` | `/api/v1/integrations/doi/{doi}` | Protected (Professor) | Metadata for a DOI (title, authors, year, venue, abstract). Accepts `https://doi.org/...` links |
| `GET` | `/api/v1/integrations/orcid/{orcid}/works` | Protected (Professor) | Public works of an ORCID profile, without duplicates |

Login status codes: `401` invalid credentials or not a professor · `403` inactive account · `409` email already linked to another account · `502` the directory returned an incomplete identity · `503` directory unreachable. Integration status codes: `400` malformed identifier · `404` no data · `503` external service unavailable.

### Frontend Routes

| Route | Access | Screen |
| :--- | :--- | :--- |
| `/login` | Public | Institutional login with Spanish error messages |
| `/dashboard` | Session required | Professor panel (shows a confirmation on the first access) |
| `/products/new` | Session required | Register a publication or project, with DOI autocomplete |

### Data Model

`users` (migration `0001`): UUID `id`, `username` and `email` (unique, lowercase), `full_name`, `role` (`professor` or `reviewer`), `is_active`, `school` (default `ECMC`, not hard-coded), optional academic identifiers (`orcid` unique, Google Scholar, Scopus, Web of Science), self-reported h-indexes, `research_lines` (JSON) and audit timestamps. There is no password column.

---

## Sprint 1 Status

Sprint 1 (24 Oct – 5 Nov 2026) covers HU01–HU03.

| User story | Implemented in `main` | Pending |
| :--- | :--- | :--- |
| **HU01** Register a professor account | Users table and migration (PGPCECMC-21), account creation on first login with duplicate control (PGPCECMC-20), acceptance test PR-HU01-01 (PGPCECMC-99), account-created confirmation in the panel (PGPCECMC-23) | Institutional email domain check (PGPCECMC-19) |
| **HU02** Sign in and sign out | LDAP login and JWT cookie (PGPCECMC-18), Spanish login screen with error mapping (PGPCECMC-25), session refresh and navigation after login (PGPCECMC-30) | Token revocation on logout (PGPCECMC-29), role guards (PGPCECMC-28), configurable `Secure` cookie (PGPCECMC-22) |
| **HU03** Register a product with identifier autocomplete | Product form with manual entry (PGPCECMC-32), Crossref/OpenAlex/ORCID adapters with error handling (PGPCECMC-33) | Saving the product with initial status «cargado»: `POST /api/v1/products` (PGPCECMC-34, 35, 36) |

---

## Testing & QA

The Sprint 1 QA suite turns each Jira test case into an automated test and runs the team's real code against simulated external services:

* **Simulated LDAP directory** (`tests/support/directorio_ldap.py`): an in-memory `ldap3` directory with two professors and one student, so login tests exercise the real `LDAPService` (search, bind and group check).
* **Simulated network** (`tests/support/red_simulada.py`): replaces only the HTTP layer, so the full chain endpoint → `DoiLookupService` → Crossref/OpenAlex adapters runs with controlled responses, errors, timeouts and outages.
* **Database:** in-memory SQLite (`tests/conftest.py`).

| Jira | Test case | File |
| :--- | :--- | :--- |
| PGPCECMC-99 | PR-HU01-01 · Registration with valid and invalid institutional email | `tests/acceptance/test_pr_hu01_01.py` |
| PGPCECMC-100 | PR-HU01-02 · No plain-text credentials in database, token, responses or logs | `tests/acceptance/test_pr_hu01_02.py` |
| PGPCECMC-101 | PR-HU02-01 · Access with valid and invalid credentials | `tests/acceptance/test_pr_hu02_01.py` |
| PGPCECMC-102 | PR-HU02-02 · Private functions denied without a session or after logout | `tests/acceptance/test_pr_hu02_02.py` |
| PGPCECMC-103 | PR-HU03-01 · Product registration with a valid DOI and prefilled data | `tests/acceptance/test_pr_hu03_01.py` + `frontend/src/pages/RegisterProductPage.test.jsx` |
| PGPCECMC-104 | PR-HU03-02 · External service outage during autocomplete | `tests/acceptance/test_pr_hu03_02.py` + `frontend/src/pages/RegisterProductPage.test.jsx` |
| PGPCECMC-31 | T-HU02-07 · Authentication, authorization and response time | `tests/performance/test_t_hu02_07_tiempos.py` |
| PGPCECMC-23 / 24 | T-HU01-06 / 07 · Registration confirmation and result messages | `frontend/src/pages/LoginPage.test.jsx` |

Tests marked `xfail(strict=True)` document a known gap and name the Jira task that fixes it. They do not break CI; when the fix lands, pytest reports `XPASS` and the marker must be removed. Response times use a provisional threshold of p95 ≤ 500 ms (`RNF02_P95_MS`) until RNF02 defines one.

```bash
pytest                          # backend: unit, integration, acceptance and performance
pytest tests/performance -s     # prints the response-time table
cd frontend && npm test         # frontend: Vitest
```

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

Visit `http://localhost:5173` to access the login portal. With the mock directory, sign in as `professor` / `professor` (see [`TESTS.md`](TESTS.md) for the other test accounts).

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
| Camilo Vásquez (`Camimilo-11`) | RED PAPERS prototype (`prototype` branch), Sprint 1 QA suite (acceptance, security, resilience and performance tests), account-created confirmation |
