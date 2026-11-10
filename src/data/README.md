# ECMC bibliographic source

`ecmc-orcid.json` is derived exclusively from the user-provided `emcc_orcid.sql` file. The phpMyAdmin dump reports that it was generated on October 12, 2026 at 00:58:14 and contains a single table, `publicaciones`. The SQL was not executed; its values were extracted as data.

The import is limited to ECMC. The other schools retain their existing data. The four researchers are identified by the names and ORCID IDs in the source; no email addresses, positions, academic degrees, photos, biographies, or external metrics absent from the file have been attributed to them.

## Counts and co-authorship

- 140 original rows and 135 unique bibliographic works.
- 120 distinct DOIs and 15 works without a DOI.
- Four shared DOIs produce five additional source rows. Their metadata matches; each work is grouped once while retaining all researcher and source-row associations (`sourceRows` uses one-based positions in the `INSERT` block).
- The institutional total, without counting shared works more than once, is 1,388 known citations. The 140 original rows sum to 1,409 citations because co-authorship rows repeat works.
- Juan Astudillo León (`0000-0002-7291-3584`): 43 associations, 296 known citations.
- Manuel Eugenio Morocho-Cayamcela (`0000-0002-4705-7923`): 47 associations, 955 known citations.
- Rigoberto Fonseca-Delgado (`0000-0002-8890-3911`): 19 associations, 130 known citations.
- Jefferson Alexander Moreno-Guaicha (`0000-0002-0380-4739`): 31 associations, 28 known citations.

The `Investigador` field indicates a bibliographic association with an ORCID, not the full author list or author order. `authors` and `authorIds` contain only the researchers linked by this source. No lead author or product owner is inferred: `ownerId` uses the technical identifier `ecmc-orcid-import`.

## Fidelity and missing data

- The nine original types are preserved in `bibliographicSource.publicationType`: 63 journal articles, 33 chapters, 29 conference papers, one thesis, three datasets, one `other`, one software item, two edited books, and two journal issues. They are presented in the bibliographic catalog as `publicacion`; no projects are fabricated.
- Years span 2011–2027. The two 2027 chapters appear that way in the source and are preserved without advancing or correcting their dates.
- There are no exact publication dates, semesters, research lines, abstracts, projects, or evidence of review. Those fields remain absent or empty according to the data contract. `createdAt` and `updatedAt` record ingestion, not the publication date.
- Nineteen works have `NULL` citations, two publication venues are blank, 15 DOIs are missing, and 66 source rows have unknown SJR. Unknown citations remain `null` in `bibliographicSource.citations`; the existing numeric citations field uses zero only as a neutral aggregation value and does not convert unknown data into a measured zero.
- SJR values `Sin dato` and `-` are normalized to `null`. Existing quartiles and scores are retained without estimates.
- `&amp;` is decoded to `&` (seven source rows), and non-breaking spaces are converted to regular spaces (13 rows), without otherwise changing bibliographic content.
- Product IDs are stable: prefix `ecmc-orcid-` plus the first 24 hexadecimal characters of SHA-256 over `doi:{normalized DOI}`, or when no DOI exists, `title:{year}:{normalized title}`. Researcher IDs are based on ORCID.

## Temporary topic classification

The SQL does not associate publications with research lines. To make the provisional content more useful, a transparent dictionary in `src/services/ecmcResearchLineDictionary.ts` is applied only to the 135 imported ECMC publication titles. It recognizes English and Spanish terms, compares scores against ECMC's six official lines, and leaves weak-evidence or tied cases unassigned. Each suggestion stores the dictionary version, matched terms, and relative strength; this is neither a probability nor an ORCID-provided classification. Researcher profiles, other schools, and future records are not classified by this dictionary.

The technical `verified` status is used only to make this imported set visible under the portal's current data contract. `bibliographicSource` records provenance, the interface labels the items “ORCID imported”, and they have no `verifiedAt` or attributed Committee approval.

## Local storage

Migration recognizes retired synthetic ECMC product IDs `prod-001` through `prod-015` and faculty IDs `doc-001` through `doc-006`. These IDs are distinct from the newly imported records and are not IDs for the real researchers. Demo credentials are stored separately from bibliographic researcher profiles.
