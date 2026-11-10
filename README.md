# RED PAPERS — SIMAPCI-YT prototype

This branch (`prototype`) holds **RED PAPERS**, the static prototype used to validate the user experience of SIMAPCI-YT before the real system was built. It brings publications, projects and researcher profiles from Yachay Tech's schools into one browser-based portal: a public catalog by school, school dashboards, a researcher directory, demo profiles (faculty, student, scientific committee) and the agile traceability matrix.

> **Looking for the system under development?** The Institutional Professor Portal (FastAPI backend + React frontend, LDAP login, MySQL) lives in the `main` branch. This branch contains only the prototype.

Published site: <https://demivn15.github.io/SIMAPCI-YT/>

---

## How it works

The prototype builds to a static website. React manages the UI and state; services under `src/services/` read and write browser storage (`localStorage` and IndexedDB for PDF attachments). There is no application server, database or authentication service: records stay in each visitor's browser. ECMC records come from a bibliographic import; the other schools use demonstration data.

See [`docs/architecture.md`](docs/architecture.md) for the module map and data flow.

---

## Tech Stack

* **UI:** React 19 + TypeScript, built with Vite
* **Styling:** Tailwind CSS 4
* **Animation and icons:** Motion, Lucide
* **Exports:** SheetJS (`xlsx`) and browser printing
* **Tests:** Vitest

---

## Directory Structure

```
.
├── index.html                  # Entry page (preloads logos and mascots)
├── package.json                # Scripts: dev, build, preview, lint (tsc), test
├── vite.config.ts              # Vite + React + Tailwind
├── tsconfig.json               # TypeScript configuration
├── vitest.config.ts            # Test configuration (runs check-*.test.tsx)
├── vitest.setup.ts             # In-memory localStorage for tests
├── check-*.test.tsx            # 7 test files (roles, committee, ORCID, exports, research lines…)
├── .github/workflows/
│   └── pages.yml               # Lint, test, build and publish to GitHub Pages on push to `prototype`
├── src/
│   ├── main.tsx                # Mounts React
│   ├── App.tsx                 # Landing page, school selection and navigation
│   ├── PortalApp.tsx           # School portal: session, records and active tab
│   ├── components/
│   │   ├── institutional/      # Public landing page and school selector
│   │   ├── dashboard/          # Metrics, charts and featured publications
│   │   ├── catalog/            # Search, filters, record details, project tracking
│   │   ├── directory/          # Researcher directory
│   │   ├── profile/            # Faculty and student profiles
│   │   ├── register/           # Publication and project registration
│   │   ├── reviewer/           # Scientific committee review queue
│   │   ├── roles/              # Role assignment
│   │   ├── traceability/       # Agile traceability matrix (RF → HU → CA → tasks → tests)
│   │   └── auth/, layout/      # Access screens, header and navigation
│   ├── constants/              # Schools, seed data, traceability data
│   ├── services/               # Storage, DOI lookup, products, exports
│   ├── data/                   # ECMC ORCID dataset and its notes
│   └── types/                  # Domain types and status values
├── public/                     # Logos, mascots and static assets
└── docs/                       # Architecture, data provenance, security, tests, user guide
```

---

## Local Setup

Requires Node.js 22 and npm.

```bash
npm ci
npm run dev        # http://localhost:3000
```

Checks before publishing:

```bash
npm run lint       # TypeScript check (tsc --noEmit)
npm test           # Vitest
npm run build      # Static site in dist/
npm run preview
```

---

## Deployment

`.github/workflows/pages.yml` runs `npm ci`, `npm run lint`, `npm test` and `npm run build -- --base=./`, then publishes `dist/` to GitHub Pages on every push to the `prototype` branch or on a manual run.

---

## Documentation

| Document | Content |
| :--- | :--- |
| [`docs/architecture.md`](docs/architecture.md) | Modules, startup and navigation |
| [`docs/data-and-provenance.md`](docs/data-and-provenance.md) | Where each dataset comes from |
| [`docs/security-and-limitations.md`](docs/security-and-limitations.md) | What the prototype does not protect |
| [`docs/development-and-deployment.md`](docs/development-and-deployment.md) | Environment, checks and GitHub Pages |
| [`docs/tests.md`](docs/tests.md) | What the tests cover |
| [`docs/user-guide.md`](docs/user-guide.md) | Profiles and what each one can do |
| `docs/SIMAPCI_Project_Documentation.docx` | Full project report of the prototype |
