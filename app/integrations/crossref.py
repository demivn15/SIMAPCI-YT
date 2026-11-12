"""
File: crossref.py
Author: Jhony Alfonso Peñaherrera
Description: Adaptador de Crossref (registro oficial de DOI) - T-HU03-02 (PGPCECMC-33).
Documentación: https://api.crossref.org/swagger-ui/index.html
"""

import re
from urllib.parse import quote

import httpx2
from app.core.config import settings
from app.integrations.base import DoiMetadata, clean_text, first, get_json

SERVICE = "Crossref"

# El resumen llega en JATS y suele empezar con un encabezado <jats:title>Abstract</jats:title>
_JATS_TITLE = re.compile(r"<jats:title[^>]*>.*?</jats:title>", re.IGNORECASE | re.DOTALL)


def _year(message: dict) -> int | None:
    """Crossref tiene varias fechas; se usa la primera disponible en este orden."""
    for key in ("issued", "published-print", "published-online", "published", "created"):
        parts = (message.get(key) or {}).get("date-parts") or []
        if parts and parts[0] and parts[0][0]:
            return int(parts[0][0])
    return None


def _authors(message: dict) -> list[str]:
    names = []
    for author in message.get("author") or []:
        # Personas: given + family. Organizaciones: name.
        full = " ".join(p for p in (author.get("given"), author.get("family")) if p) or author.get("name")
        if full:
            names.append(clean_text(full))
    return names


class CrossrefClient:
    def __init__(self, client: httpx2.Client, base_url: str | None = None):
        self._client = client
        self._base_url = (base_url or settings.CROSSREF_API_URL).rstrip("/")

    def fetch(self, doi: str) -> DoiMetadata:
        # quote(safe=""): la "/" del DOI se codifica para que Crossref la reciba como parte del DOI
        url = f"{self._base_url}/works/{quote(doi, safe='')}"
        message = get_json(self._client, url, SERVICE).get("message") or {}

        return DoiMetadata(
            doi=doi,
            title=clean_text(first(message.get("title"))) or "",
            authors=_authors(message),
            year=_year(message),
            venue=clean_text(first(message.get("container-title"))),
            abstract=clean_text(_JATS_TITLE.sub(" ", message.get("abstract") or "")),
            source="crossref",
        )
