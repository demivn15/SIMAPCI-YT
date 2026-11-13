"""
File: doi_lookup_service.py
Author: Jhony Alfonso Peñaherrera
Description: Consulta de metadatos por DOI con respaldo - T-HU03-02 (PGPCECMC-33).

Orden: Crossref (registro oficial de DOI) y, si no sirve, OpenAlex.
Regla para decidir el error final (importa para CA08):
  - Si un proveedor encuentra el DOI          -> se devuelven sus datos.
  - Si TODOS respondieron "no existe"         -> ExternalNotFoundError (revisar el DOI).
  - Si alguno NO respondió y nadie lo encontró -> ExternalServiceUnavailableError:
    no se puede afirmar que el DOI no exista, solo que no se pudo consultar.
"""

import logging
from typing import Protocol

from app.integrations.base import DoiMetadata, ExternalNotFoundError, ExternalServiceUnavailableError

logger = logging.getLogger(__name__)


class DoiProvider(Protocol):
    def fetch(self, doi: str) -> DoiMetadata: ...


class DoiLookupService:
    def __init__(self, providers: list[DoiProvider]):
        self._providers = providers

    def lookup(self, doi: str) -> DoiMetadata:
        some_provider_failed = False

        for provider in self._providers:
            try:
                return provider.fetch(doi)
            except ExternalNotFoundError:
                continue
            except ExternalServiceUnavailableError as exc:
                some_provider_failed = True
                logger.info("Probando el siguiente proveedor de DOI: %s", exc)

        if some_provider_failed:
            raise ExternalServiceUnavailableError("Ningún servicio de DOI pudo responder.")
        raise ExternalNotFoundError("Ningún servicio tiene datos para este DOI.")
