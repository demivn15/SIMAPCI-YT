# Security and limitations

## Not for production use with sensitive information

The application runs entirely in the browser and is deployed as static files. It has no backend, first-party API, shared database, server-enforced access control, institutional account recovery, or remote audit trail. Profiles, permissions, and records can be inspected or changed through the browser's own developer tools. Role checks are interface behavior, not a security boundary.

Therefore:

- Do not enter institutional passwords, sensitive personal data, or confidential documents.
- Do not treat a local login, role, or “verified” status as real institutional authentication or approval.
- Do not use this repository or a browser as the official source of record for research output.
- Do not present demo data as real staff, metrics, or projects.

## Demo authentication

Demo accounts and passwords are defined in the source and shared by the public prototype. `authService.ts` uses a local hashing mechanism that is explicitly not suitable for production security. `VITE_ENABLE_DEMO=false` can remove those profiles from a build, but it does not add secure authentication or a server.

## Storage and privacy

- `localStorage` holds products, profiles, notifications, roles, and session data for the site origin.
- PDF attachments are stored as blobs in the browser's IndexedDB.
- Profile images may be stored as embedded data in the local profile.
- Data may remain on the device after a tab is closed. Clearing site data can permanently remove it.
- Storage belongs to that browser/origin: it does not synchronize with other users, devices, or deployments.
- Anyone with access to the device or browser tools may read or alter the local data.

## Provenance and data accuracy

- Schools other than ECMC contain demo seed data; some synthetic fields are marked in the data model.
- ECMC is based on a specific ORCID dataset. An ORCID association does not establish complete authorship, record ownership, or Committee approval.
- Unknown citation counts remain unknown in source metadata; they must not be presented as a verified zero.
- ECMC dictionary-based research lines are temporary suggestions.
- ORCID search is simulated and does not contact ORCID. Crossref is queried for DOI resolution where applicable; local examples are marked as simulated. Review the suggested school research line returned by DOI lookup because Crossref does not provide Yachay Tech's official line assignment.
- PDF validation checks type, size, and basic file signature. Preliminary metadata from `pdfExtractorService.ts` is heuristic/simulated and requires manual review.

See [Data and provenance](data-and-provenance.md) and the [ECMC dataset notes](../src/data/README.md) for details.

## Requirements for a future institutional release

At minimum, a production version would need institutionally validated server-side authentication, per-resource and role authorization, a central database with backups, protection for private documents, change auditing, a privacy and retention policy, a security review, monitoring, and deployment tests. This describes work not yet implemented by the prototype.
