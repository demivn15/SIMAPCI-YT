# Data and provenance

## Schools

The canonical configuration is in `src/constants/schools.ts`. Persisted codes are:

| Internal code | Name |
| --- | --- |
| `ECIAA` | School of Agricultural and Agroindustrial Sciences |
| `ECBI` | School of Biological Sciences and Engineering |
| `ECFN` | School of Physical Sciences and Nanotechnology |
| `ECTEA` | School of Earth Sciences, Energy, and Environment |
| `ECMC` | School of Mathematical and Computational Sciences |
| `ECQI` | School of Chemical Sciences and Engineering |
| `YTLC` | YachayTech Language Center |

For historical/visual compatibility, `ECIAA` appears as **ECAA** in some parts of the interface. Do not change the persisted code to `ECAA` without an explicit migration.

Official research lines are defined in `schools.ts`; the ECMC lines and sublines used by the portal are also collected in `src/constants/researchLines.ts`. A product line is an official line or is left blank.

## Core records

Complete interfaces are in `src/types/index.ts`.

### Scientific product

`ScientificProduct` represents a publication (`publicacion`) or a project (`proyecto`). Depending on the record, it can include title, authors, responsible owner, school, year/dates, research line, abstract, status, and audit metadata. Publications may include a DOI, journal/conference, and PDF attachment. Projects may include a code, director, funding source, participants, duration, expected outputs, progress reports, and closure report.

### Status values

| Internal value | UI label | Meaning |
| --- | --- | --- |
| `cargado` | Pending verification | Newly registered or corrected record sent to the Committee. |
| `verificado` | Verified | Reviewed record or record made visible under a local data policy. Provenance determines what the status means for each dataset. |
| `rechazado` | Record needs changes | The responsible faculty member must correct it before resubmission. |

Projects also have an operational status: `activo`, `en_pausa`, `finalizado`, or `cancelado`.

### Academic profile

`TeacherUser` can store a name, email, rank, academic degree/field, school, research lines/sublines, profile image, academic identifiers, and bibliometric indices. Academic identity and bibliometric fields in synthetic seed profiles are marked in the model so they can be distinguished from values entered or confirmed by a person.

## Preloaded data

- **ECMC:** publications and four researcher profiles imported from the ORCID dataset described below. The source does not contain all fields for an academic profile and does not demonstrate Committee approval.
- **The other six schools:** `src/constants/schoolSeedData.ts` creates example records to demonstrate portal behavior. Several profile identifiers and bibliometric fields are explicitly marked synthetic; the publications and projects are hard-coded seed examples and should also be treated as demo content unless confirmed by an institutional source. Do not cite them or treat them as a confirmed institutional roster or production report.
- **Demo accounts:** defined in `src/constants/demoAccounts.ts`; they are not real institutional accounts.
- **Records created during use:** entered by a user in their own browser and not shared with a remote installation or user.

The seed in the code may differ from the current browser state because local storage can preserve earlier edits.

## ECMC ORCID import

The normalized file is `src/data/ecmc-orcid.json`, derived from the `emcc_orcid.sql` dump supplied for this project. SQL is not executed as a program; its values were extracted and normalized. Full counts, researcher associations, citations, DOI values, publication types, and normalization rules are in the [ECMC source notes](../src/data/README.md).

Important constraints when changing this import:

- The source has 140 rows consolidated into 135 unique works. Shared DOI records are grouped to avoid duplicate works and citation totals.
- Researcher associations come from ORCID values in the source; they do not represent a complete or ordered author list.
- Unknown citation counts remain `null` in `bibliographicSource.citations`. A numeric zero is used as a neutral value for some aggregations; it does not mean the source measured zero citations.
- The source contains no abstracts, exact publication dates, semesters, institutional research lines, or committee review evidence. Do not invent these values.
- The title dictionary in `ecmcResearchLineDictionary.ts` produces a **temporary thematic suggestion** for this import only. It is not an official classification, an AI model, or a probability; ambiguous cases remain unassigned and the suggestion records its version, matched terms, and relative strength.
- The imported dataset's `verified` status supports public visibility. The UI identifies imported records as “ORCID imported”; they have no `verifiedAt` and no Committee approval is attributed to them.

## Persistence and migrations

Persistence is implemented in `src/services/storage.ts`, `authService.ts`, `roleService.ts`, and `articleAttachmentService.ts`.

| Area | Storage | Main keys/identifiers |
| --- | --- | --- |
| Products, faculty, notifications, session, and public settings | `localStorage` | `red_papers_products_v1`, `red_papers_teachers_v1`, `red_papers_notifications_v1`, `red_papers_current_user_v1`, `red_papers_public_config_v1` |
| ECMC import marker and pre-import backup | `localStorage` | `red_papers_ecmc_orcid_import_v1`, `red_papers_ecmc_pre_orcid_backup_v1` |
| Credentials, student profiles, and roles | `localStorage` | `red_papers_auth_creds_v1`, `red_papers_student_profiles_v1`, `red_papers_roles_v1` |
| PDF attachments | IndexedDB database `red-papers-private-files`, object store `article-attachments` | Blobs keyed by attachment ID |

The ECMC import uses a version marker to run migrations once and preserves records outside the retired ECMC seed set. Before changing keys, IDs, or migration logic, inspect the backup behavior and related tests; do not clear all browser storage as a way to “reset” a user's installation.
