"""
File: orcid.py
Author: Jhony Alfonso Peñaherrera
Description: Adaptador de la API pública de ORCID - T-HU03-02 (PGPCECMC-33).
Documentación: https://info.orcid.org/documentation/api-tutorials/

Un ORCID identifica a una PERSONA: el adaptador devuelve la lista de sus obras.
La importación de esas obras como productos corresponde a HU12.
"""

import httpx
from app.core.config import settings
from app.integrations.base import OrcidWork, clean_text, get_json
from app.utils.identifiers import is_valid_doi, normalize_doi

SERVICE = "ORCID"


def _value(node: dict | None, *path: str):
    """Recorre el JSON anidado de ORCID ({"title": {"title": {"value": ...}}}) sin fallar si falta algo."""
    for key in path:
        if not isinstance(node, dict):
            return None
        node = node.get(key)
    return node


def _doi(summary: dict) -> str | None:
    for ext in _value(summary, "external-ids", "external-id") or []:
        if (ext.get("external-id-type") or "").lower() == "doi":
            doi = normalize_doi(ext.get("external-id-value"))
            if is_valid_doi(doi):
                return doi
    return None


def _to_work(summary: dict) -> OrcidWork | None:
    title = clean_text(_value(summary, "title", "title", "value"))
    if not title:
        return None
    year = _value(summary, "publication-date", "year", "value")
    return OrcidWork(
        put_code=str(summary["put-code"]) if summary.get("put-code") is not None else None,
        title=title,
        year=int(year) if year and str(year).isdigit() else None,
        doi=_doi(summary),
        venue=clean_text(_value(summary, "journal-title", "value")),
        work_type=summary.get("type"),
    )


class OrcidClient:
    def __init__(self, client: httpx.Client, base_url: str | None = None):
        self._client = client
        self._base_url = (base_url or settings.ORCID_API_URL).rstrip("/")

    def fetch_works(self, orcid: str) -> list[OrcidWork]:
        data = get_json(self._client, f"{self._base_url}/{orcid}/works", SERVICE)

        works = []
        # ORCID agrupa en un "group" las versiones de la misma obra que llegan de
        # distintas fuentes (Crossref, Scopus, el propio investigador). Se toma la
        # primera versión de cada grupo para no listar la misma obra varias veces.
        for group in data.get("group") or []:
            summaries = group.get("work-summary") or []
            work = _to_work(summaries[0]) if summaries else None
            if work:
                works.append(work)

        # Más recientes primero; las obras sin año al final
        return sorted(works, key=lambda w: w.year or 0, reverse=True)
