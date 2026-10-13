"""
File: integrations/crossref.py
Description: Minimal Crossref client used to validate that a DOI a professor
             types in actually exists before the publication is accepted,
             and to autocomplete its basic metadata (charter requirement #5,
             "Validación de existencia de productos").
"""

import re
import httpx
from app.config import settings

DOI_PATTERN = re.compile(r"^10\.\d{4,9}/\S+$")


def normalize_doi(raw_doi: str) -> str:
    """Strip a doi.org URL prefix/whitespace so only the bare DOI remains."""
    doi = raw_doi.strip()
    doi = re.sub(r"^(https?://)?(dx\.)?doi\.org/", "", doi, flags = re.IGNORECASE)
    return doi


def is_well_formed_doi(doi: str) -> bool:
    """Shape check ("10.xxxx/suffix") before spending an HTTP call on it."""
    return bool(DOI_PATTERN.match(doi))


def lookup_doi(raw_doi: str) -> dict | None:
    """
    Look a DOI up on Crossref.

    Returns a small, already-normalised metadata dict on success, or None
    when Crossref has no record for it (a 404). Any other failure (network,
    5xx, timeout) is raised so the caller can tell "not found" apart from
    "could not check right now".
    """
    doi = normalize_doi(raw_doi)
    if not is_well_formed_doi(doi):
        return None

    params = {}
    if settings.CROSSREF_CONTACT_EMAIL:
        # The "polite pool" gets friendlier rate limits in exchange for a
        # contact email, per Crossref's own etiquette guidelines.
        params["mailto"] = settings.CROSSREF_CONTACT_EMAIL

    response = httpx.get(
        f"https://api.crossref.org/works/{doi}",
        params = params,
        timeout = 10.0
    )

    if response.status_code == 404:
        return None
    response.raise_for_status()

    message = response.json().get("message", {})

    title_list = message.get("title") or []
    container_list = message.get("container-title") or []
    authors = [
        " ".join(filter(None, [author.get("given"), author.get("family")]))
        for author in message.get("author", [])
    ]

    year = None
    for date_block in ("published-print", "published-online", "published"):
        parts = (message.get(date_block) or {}).get("date-parts")
        if parts and parts[0]:
            year = parts[0][0]
            break

    return {
        "doi": doi,
        "title": title_list[0] if title_list else None,
        "venue": container_list[0] if container_list else None,
        "year": year,
        "authors": ", ".join(filter(None, authors)) or None,
        "publication_type": message.get("type"),
    }
