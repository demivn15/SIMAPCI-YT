# Development and deployment

## Set up the environment

- Node.js 22 and npm.
- Git to obtain the repository.
- A modern browser for review. For mobile testing, connect the device to the same network as the development machine and use Vite's LAN address; do not expose it on a public network.

```bash
git clone <repository-url>
cd red-papers
npm ci
npm run dev
```

There is no `.env.example`; no environment variable is required for the normal local workflow.

## Checks before release

```bash
npm run lint
npm test
npm run build
npm run preview
```

`lint` means a TypeScript check (`tsc --noEmit`), not ESLint. `preview` serves the latest static output from `dist/` for local review.

## Environment variables

| Variable | Purpose | Default/behavior |
| --- | --- | --- |
| `VITE_ENABLE_DEMO` | Enables demo profiles in the build. | Enabled by default (`true`). Always enabled during development because `import.meta.env.DEV` takes precedence. Set to `false` to disable demo profiles in a production build. |
| `DISABLE_HMR` | Vite setting for the AI Studio editing environment. | When `true`, disables HMR and the dev server file watcher. It does not control authentication or data. |

Example production build without demo profiles in PowerShell:

```powershell
$env:VITE_ENABLE_DEMO = 'false'
npm run build
```

In Bash:

```bash
VITE_ENABLE_DEMO=false npm run build
```

Disabling demo profiles does not make the app a secure authentication system: it adds neither a server nor server-side authorization. See [Security and limitations](security-and-limitations.md).

## GitHub Pages

`.github/workflows/pages.yml` deploys on pushes to `main` or through a manual `workflow_dispatch`. The workflow:

1. Uses Ubuntu and Node.js 22.
2. Runs `npm ci`, `npm run lint`, `npm test`, and `npm run build -- --base=./`.
3. Uploads `dist/` as the GitHub Pages artifact.

The relative base path `./` lets assets work under the GitHub Pages project path. Logo and mascot maps use `import.meta.env.BASE_URL`; preserve this pattern when adding assets. GitHub Pages hosts static files only; it does not provide application data storage or synchronization.

## Where to make changes

- School names, codes, colors, and official lines: `src/constants/schools.ts`.
- Demo seeds for the six non-ECMC schools: `src/constants/schoolSeedData.ts`.
- ECMC import: `src/data/ecmc-orcid.json`, `src/constants/ecmcOrcidData.ts`, and `src/data/README.md`.
- Domain contracts and status values: `src/types/index.ts`.
- Landing/school navigation: `src/App.tsx`; selected school portal: `src/PortalApp.tsx`.
- Persistence/migrations: `src/services/storage.ts` and related services.
- Responsive landing page: `src/components/institutional/` and the portal stylesheets.

When changing a persisted key, role, visibility rule, or migration, update relevant tests and documentation. Do not replace seed content for another school as if it were real without a verifiable institutional source.
