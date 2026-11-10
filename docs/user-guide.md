# User guide

## Enter the portal

1. Open the site and select one of the seven schools on the landing page.
2. On the school's access screen, choose visitor access or sign in with a demo profile.
3. Visitors can browse visible research output and the directory. Registering or correcting records requires the faculty demo profile.

The selected school must match the school assigned to the profile. An account for one school cannot be used in another school's portal.

## What each profile can do

| Profile | Areas and actions |
| --- | --- |
| Visitor | School dashboard, verified research output, and public directory. |
| Faculty | Visitor access, profile, publication/project registration, “My records”, corrections to observed records, notifications, and progress/closure reporting for owned projects. |
| Student | Profile and “My collaborations”. Students cannot register products. Collaboration data depends on saved associations; it is not inferred from ORCID co-authorship. |
| Scientific Committee | Queue of records to review, approve, or return with comments. This profile cannot register its own research output from the review view. |
| Developer | Development tools, traceability, review, and assignment/restoration of committee roles. |

Profiles available in the public version are for demonstration. UI role checks are not institutional authorization; see [Security and limitations](security-and-limitations.md).

## Faculty workflow: register and correct a record

1. Open the portal for the appropriate school and sign in as a faculty demo profile.
2. Open the registration form and select a publication or project.
3. Complete the fields, review the research line, and save. DOI lookup is optional; it may return simulated metadata or query Crossref.
4. The record enters **Pending verification** (`cargado`) and appears under “My records”.
5. If the Committee returns it with comments, correct it and resubmit it. It returns to the pending state.
6. For projects, add progress reports and record the closure when appropriate.

Article attachments must be PDF files up to 10 MB and are stored in that browser's local storage. Preliminary PDF metadata is simulated: review and complete every field manually before saving.

## Scientific Committee workflow

1. Open the Scientific Committee review console.
2. Review the record and its supporting evidence.
3. Mark it verified or return it with a specific reason.
4. The responsible faculty profile receives a local notification and can check the status.

Imported ORCID records marked `verified` are not evidence of Committee approval. That status is used to make the imported set publicly visible; the interface identifies these items as imported.

## Catalog, profiles, and exports

- Use the catalog to switch between publications and projects and filter by text, faculty member, period, line, and status where available.
- From the directory, open a profile or navigate to the catalog filtered by that researcher.
- Export filtered records as CSV or Excel. Bibliographic provenance is included when present.
- To create a PDF copy, use print and choose “Save as PDF” in the browser dialog. No PDF is generated or uploaded to a server.

## Data on this device

Changes are saved in the browser that created them. They do not appear automatically on another computer or another user's browser. Clearing site data can remove the local session, profiles, records, and attachments. Export anything you need before clearing browser data; do not rely on this prototype as the sole official archive.
