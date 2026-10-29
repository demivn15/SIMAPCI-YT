# Institutional Professor Portal — Authentication & Authorization System

A secure, scalable, role-based authentication and authorization web application designed for institutional portals. The system authenticates users against an institutional LDAP server, verifies role membership (restricting access to professors), and manages session state via secure, stateless JWT tokens delivered in `HttpOnly` cookies.

---

## Architecture Overview

```
                          ┌───────────────────────────┐
                          │   Institutional LDAP /    │
                          │     Active Directory      │
                          └─────────────▲─────────────┘
                                        │
                         1. Search DN   │  2. User Bind &
                         & Attributes   │     Group Verification
                                        │
┌─────────────────────────┐   HTTP/JSON ┴─────────────────────────┐
│     React Frontend      │◄───────────►│      FastAPI Backend      │
│  (Vite, Tailwind CSS,   │  HttpOnly   │ (PyJWT, ldap3, Pydantic,  │
│     TanStack Query)     │  Cookie     │   Dependency Injection)   │
└─────────────────────────┘             └─────────────────────────┘
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

---

## Tech Stack

### Backend
* **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+)
* **LDAP Integration:** [`ldap3`](https://pypi.org/project/ldap3/)
* **Security & Tokens:** [`PyJWT`](https://pyjwt.readthedocs.io/), `passlib`
* **Settings Management:** [`pydantic-settings`](https://docs.pydantic.dev/)
* **ASGI Server:** `uvicorn`

### Frontend
* **Core & Build Tool:** [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/)
* **State Management & Data Fetching:** [TanStack Query (React Query v5)](https://tanstack.com/query/latest)
* **Routing:** [React Router v6](https://reactrouter.com/)
* **HTTP Client:** [Axios](https://axios-http.com/)

---

## Key Security Implementation Features

* **HttpOnly & SameSite Cookies:** Eliminates JavaScript access to tokens, making session hijacking via XSS impossible.
* **Strict CORS Policy:** Configured via FastAPI middleware with `allow_credentials=True` restricted to explicitly whitelisted origin domains.
* **Non-Enumeration Auth Response:** Credentials and authorization errors return generic 401 responses to prevent account harvest attacks.
* **Connection Fail-Fast:** LDAP connections enforce a 5-second connection timeout, returning clean `503 Service Unavailable` responses during directory server downtime.

---

## Directory Structure

```
.
├── docker-compose.yml          # Local mock OpenLDAP environment
├── .env                        # Local environment variables
├── TESTS.md                    # Execution manual for QA/testing
├── app/                        # FastAPI Backend Application
│   ├── main.py                 # FastAPI initialization and CORS setup
│   ├── api/
│   │   ├── deps.py             # Security dependency injection (get_current_professor)
│   │   └── v1/
│   │       ├── auth.py         # Auth endpoints (/login, /me, /logout)
│   │       └── professor.py    # Protected domain routes
│   ├── core/
│   │   ├── config.py           # Pydantic environment configuration
│   │   └── security.py         # JWT creation, decoding, and validation
│   └── services/
│       └── ldap_service.py     # LDAP authentication and RBAC logic
└── frontend/                   # React Single-Page Application
    ├── src/
    │   ├── api/                # Axios client configuration (withCredentials: true)
    │   ├── components/         # ProtectedRoute guard components
    │   ├── context/            # AuthContext & TanStack Query wrapper
    │   ├── pages/              # LoginPage and Dashboard view components
    │   └── App.jsx             # React router configuration
    ├── index.css               # Tailwind directives
    └── vite.config.js          # Vite build configuration
```

---

## API Endpoint Reference

| Method | Endpoint | Protection | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Public | Authenticates credentials with LDAP, checks RBAC, sets `HttpOnly` JWT cookie |
| `GET` | `/api/v1/auth/me` | Protected (JWT) | Validates session cookie and returns user profile details |
| `POST` | `/api/v1/auth/logout` | Public | Clears the `access_token` session cookie |
| `GET` | `/api/v1/professor/dashboard` | Protected (Professor) | Example domain endpoint guarded by `get_current_professor` |

---

## Local Setup & Quickstart

### Prerequisites
* Python 3.10+
* Node.js 18+ & npm
* Docker & Docker Compose

### 1. Environment Configuration
Create a `.env` file in the root directory:

```env
APP_NAME="Institutional Professor Portal"
SECRET_KEY="super_secret_local_development_key_change_in_prod"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=480

# LDAP Connection Settings (Mock Configuration)
LDAP_SERVER_URI="ldap://localhost:10389"
LDAP_BIND_DN="cn=admin,dc=planetexpress,dc=com"
LDAP_BIND_PASSWORD="GoodNewsEveryone"

LDAP_USER_BASE_DN="ou=people,dc=planetexpress,dc=com"
LDAP_GROUP_BASE_DN="ou=people,dc=planetexpress,dc=com"
LDAP_PROFESSOR_GROUP_CN="admin_staff"

BACKEND_CORS_ORIGINS=["http://localhost:5173"]
```

### 2. Backend Initialization
```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install fastapi uvicorn ldap3 PyJWT pydantic-settings

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

Visit `http://localhost:5173` to access the login portal.
