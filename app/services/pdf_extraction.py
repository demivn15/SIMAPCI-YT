"""
File: services/pdf_extraction.py
Description: Basic metadata extraction from an uploaded PDF, to autocomplete
             a publication/project form (charter requirement #3). The
             charter explicitly scopes this down to "autocompletado de
             metadatos básicos" -- no full-text indexing, no plagiarism
             detection, no content mining. The professor always reviews and
             confirms the suggested fields before anything is saved.
"""

import io
import re
from dataclasses import dataclass
from pypdf import PdfReader
from app.integrations.crossref import DOI_PATTERN

YEAR_PATTERN = re.compile(r"\b(19|20)\d{2}\b")
# DOIs in running text are sometimes prefixed, e.g. "DOI: 10.1000/xyz123".
DOI_IN_TEXT_PATTERN = re.compile(r"10\.\d{4,9}/[^\s,;)\]]+")


@dataclass
class ExtractedPdfMetadata:
    """Suggested, unconfirmed values. The caller must let the user edit them."""

    title: str | None
    authors: str | None
    year: int | None
    doi: str | None
    page_count: int


def extract_basic_metadata(file_bytes: bytes) -> ExtractedPdfMetadata:
    """
    Read a PDF's embedded document-info dictionary plus the first page of
    text, and return a best-effort guess of title/authors/year/DOI.

    Raises ValueError if the file cannot be parsed as a PDF at all.
    """
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
    except Exception as error:
        raise ValueError(f"The uploaded file is not a readable PDF: {error}") from error

    info = reader.metadata or {}
    title = (info.title or "").strip() or None
    authors = (info.author or "").strip() or None

    first_page_text = ""
    if reader.pages:
        try:
            first_page_text = reader.pages[0].extract_text() or ""
        except Exception:
            # Some PDFs (scanned images, exotic encodings) fail text
            # extraction; the embedded metadata above is still usable.
            first_page_text = ""

    if not title:
        # Fall back to the first non-trivial line of the first page, a
        # common (if imperfect) heuristic for a document's title.
        for line in first_page_text.splitlines():
            candidate = line.strip()
            if len(candidate) >= 8:
                title = candidate
                break

    doi_match = DOI_IN_TEXT_PATTERN.search(first_page_text)
    doi = doi_match.group(0).rstrip(".") if doi_match else None
    if doi and not DOI_PATTERN.match(doi):
        doi = None

    year_match = YEAR_PATTERN.search(first_page_text)
    year = int(year_match.group(0)) if year_match else None

    return ExtractedPdfMetadata(
        title = title,
        authors = authors,
        year = year,
        doi = doi,
        page_count = len(reader.pages)
    )
