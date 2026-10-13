"""
File: integrations/openalex.py
Description: Minimal OpenAlex client. OpenAlex supplies the citation counts
             behind the dashboard's "número de citas" and "índice h" metrics
             (charter objective: "Proveer análisis y métricas de impacto").
"""

import httpx
from app.config import settings
from app.integrations.crossref import normalize_doi


def _polite_params(extra: dict | None = None) -> dict:
    """Attach the contact email OpenAlex asks for to join its polite pool."""
    params = dict(extra or {})
    if settings.OPENALEX_CONTACT_EMAIL:
        params["mailto"] = settings.OPENALEX_CONTACT_EMAIL
    return params


def get_citation_count_by_doi(raw_doi: str) -> int | None:
    """Return how many times a DOI has been cited, or None if it is unknown to OpenAlex."""
    doi = normalize_doi(raw_doi)

    response = httpx.get(
        f"https://api.openalex.org/works/doi:{doi}",
        params = _polite_params(),
        timeout = 10.0
    )

    if response.status_code == 404:
        return None
    response.raise_for_status()

    return response.json().get("cited_by_count")


def get_author_metrics_by_orcid(orcid_id: str) -> dict | None:
    """
    Return OpenAlex's own h-index and citation totals for an ORCID iD.

    Useful as a cross-check or fallback for the locally computed h-index
    (see app.services.metrics), since OpenAlex indexes a broader citation
    graph than what this system stores.
    """
    response = httpx.get(
        "https://api.openalex.org/authors",
        params = _polite_params({"filter": f"orcid:{orcid_id}"}),
        timeout = 10.0
    )
    response.raise_for_status()

    results = response.json().get("results") or []
    if not results:
        return None

    author = results[0]
    stats = author.get("summary_stats") or {}

    return {
        "openalex_id": author.get("id"),
        "works_count": author.get("works_count"),
        "cited_by_count": author.get("cited_by_count"),
        "h_index": stats.get("h_index"),
        "i10_index": stats.get("i10_index"),
    }
