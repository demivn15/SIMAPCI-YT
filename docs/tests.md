# Tests and validation

## Automated tests

Vitest is configured in `vitest.config.ts` to include `check-*.test.tsx` files in a Node environment. `vitest.setup.ts` supplies an in-memory `localStorage`; each test starts with a cleared store.

| File | Coverage |
| --- | --- |
| `check-committee.test.tsx` | Committee workflow restrictions and faculty registration. |
| `check-orcid-presentation.test.tsx` | ORCID provenance vs. committee review, unknown citations, explicit researcher associations, metrics, and featured work per line. |
| `check-print-export.test.tsx` | Printable documents, export, and error handling when the print window cannot open. |
| `check-research-line-dictionary.test.tsx` | Bilingual title terms, abstention when evidence is weak, ECMC-only scope, and preserving manual classification during migration. |
| `check-role-reassignment.test.tsx` | Committee role assignment/restoration and administration restrictions. |
| `check-roles.test.tsx` | Demo access and menus by profile. |
| `check-shared-demo.test.tsx` | Demo identities across schools, separate profiles, migration, and disabling demo accounts. |

Run the suite with:

```bash
npm test
```

For type errors:

```bash
npm run lint
```

## Recommended manual review

Before integrating a UI or workflow change, review at least:

1. Landing page and transition into a school on desktop and mobile.
2. Browser back/forward navigation and the return-to-schools selector.
3. Visitor access and each relevant demo profile.
4. Catalog, filters, details, and directory at narrow and wide viewport sizes.
5. Registration, observation, correction, resubmission, notification, and review.
6. Exports with accented text and print/save-as-PDF behavior.
7. A valid PDF under 10 MB and rejection of an invalid file type or size.
8. Refresh and local persistence after making a change.

Screenshots from earlier visual checks were removed from the branch to keep it light; they remain in the Git history.

## Known coverage limits

The automated suite covers logic and component integration with mocks; it is not a browser E2E suite. There is no Playwright/Cypress configuration or automated testing for contrast, screen readers, performance, or comprehensive browser compatibility. The GitHub Pages build does run type checking and tests before deployment.
