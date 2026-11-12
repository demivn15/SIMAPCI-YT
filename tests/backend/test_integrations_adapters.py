"""
Pruebas de los adaptadores Crossref, OpenAlex y ORCID y del respaldo (PGPCECMC-33).
httpx2.MockTransport reemplaza la red: cada prueba decide qué responde cada servicio.
"""

import httpx2
import pytest

from app.integrations.base import ExternalNotFoundError, ExternalServiceUnavailableError, clean_text
from app.integrations.crossref import CrossrefClient
from app.integrations.openalex import OpenAlexClient, rebuild_abstract
from app.integrations.orcid import OrcidClient
from app.services.doi_lookup_service import DoiLookupService
from tests.backend.integration_fixtures import (
    CROSSREF_WORK,
    CROSSREF_WORK_MINIMAL,
    DOI,
    OPENALEX_WORK,
    ORCID,
    ORCID_WORKS,
)

CROSSREF = "https://api.crossref.test"
OPENALEX = "https://api.openalex.test"
ORCID_API = "https://pub.orcid.test/v3.0"


def make_client(crossref=None, openalex=None, orcid=None, calls=None):
    """Cliente HTTP falso. Cada argumento es un httpx2.Response o una excepción."""

    def handler(request: httpx2.Request):
        host = request.url.host
        if calls is not None:
            calls.append(request)
        result = crossref if "crossref" in host else openalex if "openalex" in host else orcid
        if isinstance(result, Exception):
            raise result
        return result

    return httpx2.Client(transport=httpx2.MockTransport(handler))


def lookup_service(client):
    return DoiLookupService([CrossrefClient(client, CROSSREF), OpenAlexClient(client, OPENALEX)])


OK_CROSSREF = httpx2.Response(200, json=CROSSREF_WORK)
OK_OPENALEX = httpx2.Response(200, json=OPENALEX_WORK)
NOT_FOUND = httpx2.Response(404, text="Resource not found.")
SERVER_ERROR = httpx2.Response(503, text="Service Unavailable")
TIMEOUT = httpx2.ReadTimeout("timeout")


# --- Crossref ----------------------------------------------------------------

def test_crossref_maps_metadata_to_internal_format():
    calls = []
    metadata = CrossrefClient(make_client(crossref=OK_CROSSREF, calls=calls), CROSSREF).fetch(DOI)

    assert metadata.source == "crossref"
    assert metadata.title == "Secure Aggregation for Federated Learning & Edge Devices"
    assert metadata.authors == ["María García", "Juan Pérez", "ECMC Research Group"]
    assert metadata.year == 2023
    assert metadata.venue.startswith("Proceedings of the 2023 ACM")
    assert metadata.abstract == "We propose a protocol for secure aggregation."  # sin el encabezado JATS
    # La "/" del DOI viaja codificada como parte del identificador
    assert calls[0].url.raw_path == b"/works/10.1145%2F3576915.3623102"


def test_crossref_tolerates_missing_fields():
    metadata = CrossrefClient(make_client(crossref=httpx2.Response(200, json=CROSSREF_WORK_MINIMAL)), CROSSREF).fetch(DOI)
    assert metadata.title == ""
    assert metadata.authors == []
    assert metadata.year == 2021
    assert metadata.venue is None and metadata.abstract is None


@pytest.mark.parametrize(
    "response,error",
    [
        (NOT_FOUND, ExternalNotFoundError),
        (SERVER_ERROR, ExternalServiceUnavailableError),
        (httpx2.Response(429, text="Too Many Requests"), ExternalServiceUnavailableError),
        (httpx2.Response(200, text="<html>not json</html>"), ExternalServiceUnavailableError),
        (TIMEOUT, ExternalServiceUnavailableError),
        (httpx2.ConnectError("no route"), ExternalServiceUnavailableError),
    ],
)
def test_crossref_translates_failures(response, error):
    with pytest.raises(error):
        CrossrefClient(make_client(crossref=response), CROSSREF).fetch(DOI)


# --- OpenAlex ------------------------------------------------------------------

def test_openalex_maps_metadata_and_rebuilds_abstract():
    metadata = OpenAlexClient(make_client(openalex=OK_OPENALEX), OPENALEX).fetch(DOI)

    assert metadata.source == "openalex"
    assert metadata.title == "Secure Aggregation for Federated Learning"
    assert metadata.authors == ["María García", "Juan Pérez"]
    assert metadata.year == 2023
    assert metadata.venue == "ACM CCS 2023"
    assert metadata.abstract == "We propose a protocol."


def test_rebuild_abstract_orders_words_by_position():
    assert rebuild_abstract({"world": [1], "hello": [0, 2]}) == "hello world hello"
    assert rebuild_abstract(None) is None


def test_clean_text_removes_tags_and_extra_spaces():
    assert clean_text("<jats:p>Hola&nbsp; <i>mundo</i></jats:p>") == "Hola mundo"
    assert clean_text("   ") is None


# --- Respaldo Crossref -> OpenAlex ---------------------------------------------

def test_lookup_uses_crossref_first():
    calls = []
    metadata = lookup_service(make_client(crossref=OK_CROSSREF, openalex=OK_OPENALEX, calls=calls)).lookup(DOI)
    assert metadata.source == "crossref"
    assert len(calls) == 1  # OpenAlex no se consulta si Crossref respondió


@pytest.mark.parametrize("crossref_failure", [NOT_FOUND, SERVER_ERROR, TIMEOUT])
def test_lookup_falls_back_to_openalex(crossref_failure):
    metadata = lookup_service(make_client(crossref=crossref_failure, openalex=OK_OPENALEX)).lookup(DOI)
    assert metadata.source == "openalex"


def test_lookup_not_found_when_every_provider_says_not_found():
    with pytest.raises(ExternalNotFoundError):
        lookup_service(make_client(crossref=NOT_FOUND, openalex=NOT_FOUND)).lookup(DOI)


@pytest.mark.parametrize(
    "crossref,openalex",
    [(SERVER_ERROR, SERVER_ERROR), (NOT_FOUND, TIMEOUT), (TIMEOUT, NOT_FOUND)],
)
def test_lookup_unavailable_when_a_provider_could_not_answer(crossref, openalex):
    # Si alguien no respondió, no se puede afirmar que el DOI no exista
    with pytest.raises(ExternalServiceUnavailableError):
        lookup_service(make_client(crossref=crossref, openalex=openalex)).lookup(DOI)


# --- ORCID ---------------------------------------------------------------------

def test_orcid_lists_works_once_per_group_newest_first():
    calls = []
    works = OrcidClient(make_client(orcid=httpx2.Response(200, json=ORCID_WORKS), calls=calls), ORCID_API).fetch_works(ORCID)

    assert [w.title for w in works] == ["Secure Aggregation for Federated Learning", "Older paper", "Undated report"]
    newest = works[0]
    assert newest.doi == "10.1145/3576915.3623102"  # normalizado desde la URL
    assert newest.year == 2023 and newest.work_type == "conference-paper" and newest.put_code == "222"
    assert works[1].doi is None and works[1].venue == "Journal of Applied Math"
    assert works[2].year is None
    assert calls[0].url.path == f"/v3.0/{ORCID}/works"


def test_orcid_unknown_profile_is_not_found():
    with pytest.raises(ExternalNotFoundError):
        OrcidClient(make_client(orcid=NOT_FOUND), ORCID_API).fetch_works(ORCID)


def test_orcid_down_is_unavailable():
    with pytest.raises(ExternalServiceUnavailableError):
        OrcidClient(make_client(orcid=TIMEOUT), ORCID_API).fetch_works(ORCID)
