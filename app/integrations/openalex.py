"""
File: openalex.py
Author: Jhony Alfonso Peñaherrera
Description: Adaptador de OpenAlex (respaldo para DOI) - T-HU03-02 (PGPCECMC-33).
Documentación: https://docs.openalex.org/api-entities/works
"""

import httpx2
from app.core.config import settings
from app.integrations.base import DoiMetadata, clean_text, get_json

SERVICE = "OpenAlex"


def rebuild_abstract(inverted_index: dict | None) -> str | None:
    """OpenAlex no entrega el resumen como texto sino como índice invertido
    {"palabra": [posiciones]} (por licencias). Se reconstruye ordenando por posición."""
    if not inverted_index:
        return None
    positions = [(pos, word) for word, places in inverted_index.items() for pos in places]
    return clean_text(" ".join(word for _, word in sorted(positions)))


class OpenAlexClient:
    def __init__(self, client: httpx2.Client, base_url: str | None = None):
        self._client = client
        self._base_url = (base_url or settings.OPENALEX_API_URL).rstrip("/")

    def fetch(self, doi: str) -> DoiMetadata:
        params = {"mailto": settings.INTEGRATIONS_CONTACT_EMAIL} if settings.INTEGRATIONS_CONTACT_EMAIL else None
        work = get_json(self._client, f"{self._base_url}/works/doi:{doi}", SERVICE, params=params)

        source = ((work.get("primary_location") or {}).get("source") or {})
        authors = [
            clean_text(a["author"]["display_name"])
            for a in work.get("authorships") or []
            if (a.get("author") or {}).get("display_name")
        ]
        return DoiMetadata(
            doi=doi,
            title=clean_text(work.get("title") or work.get("display_name")) or "",
            authors=authors,
            year=work.get("publication_year"),
            venue=clean_text(source.get("display_name")),
            abstract=rebuild_abstract(work.get("abstract_inverted_index")),
            source="openalex",
        )
