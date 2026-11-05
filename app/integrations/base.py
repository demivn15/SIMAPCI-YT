"""
File: base.py
Author: Jhony Alfonso Peñaherrera
Description: Piezas comunes de los adaptadores externos - T-HU03-02 (PGPCECMC-33).

Patrón adaptador: cada servicio externo (Crossref, OpenAlex, ORCID) responde con
su propio formato. Cada adaptador lo traduce a un formato interno único
(DoiMetadata, OrcidWork), y el resto del sistema solo conoce ese formato. Si
mañana se cambia o se agrega un proveedor, nada fuera de app/integrations cambia.
"""

import html
import logging
import re
from dataclasses import dataclass, field

import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)


# --- Errores -----------------------------------------------------------------
# Solo dos casos importan para quien usa el adaptador (CA08):
#   - el dato no existe          -> el profesor debe revisar el identificador
#   - el servicio no respondió   -> el profesor puede reintentar o llenar a mano

class ExternalNotFoundError(Exception):
    """El servicio respondió, pero no tiene datos para ese identificador."""


class ExternalServiceUnavailableError(Exception):
    """El servicio no respondió a tiempo, falló o devolvió algo ilegible."""


# --- Formatos internos --------------------------------------------------------

@dataclass(frozen=True)
class DoiMetadata:
    doi: str
    title: str
    authors: list[str] = field(default_factory=list)
    year: int | None = None
    venue: str | None = None
    abstract: str | None = None
    source: str = ""  # "crossref" u "openalex": de dónde salieron los datos


@dataclass(frozen=True)
class OrcidWork:
    put_code: str | None
    title: str
    year: int | None = None
    doi: str | None = None
    venue: str | None = None
    work_type: str | None = None


# --- Cliente HTTP ---------------------------------------------------------------

def build_http_client() -> httpx.Client:
    """Cliente HTTP con tiempo de espera y una identificación del sistema.

    Crossref y OpenAlex piden que cada aplicación se identifique en el User-Agent
    (con un correo de contacto, si existe) para atenderla en su "polite pool".
    """
    contact = settings.INTEGRATIONS_CONTACT_EMAIL
    user_agent = "SIMAPCI/1.0 (https://github.com/demivn15/SIMAPCI-YT"
    user_agent += f"; mailto:{contact})" if contact else ")"
    return httpx.Client(
        timeout=settings.INTEGRATIONS_TIMEOUT_SECONDS,
        headers={"User-Agent": user_agent, "Accept": "application/json"},
        follow_redirects=True,
    )


def get_json(client: httpx.Client, url: str, service: str, **kwargs) -> dict:
    """GET que traduce cualquier falla de red o HTTP a los dos errores del adaptador."""
    try:
        response = client.get(url, **kwargs)
    except httpx.TimeoutException as exc:
        logger.warning("%s no respondió a tiempo: %s", service, url)
        raise ExternalServiceUnavailableError(f"{service}: tiempo de espera agotado") from exc
    except httpx.HTTPError as exc:
        logger.warning("%s no disponible (%s): %s", service, type(exc).__name__, url)
        raise ExternalServiceUnavailableError(f"{service}: error de conexión") from exc

    if response.status_code in (400, 404):
        # 400: el proveedor no reconoce el identificador; para el usuario es "no existe"
        raise ExternalNotFoundError(f"{service}: sin datos")
    if response.status_code >= 400:
        # 429 (demasiadas peticiones), 5xx, etc.
        logger.warning("%s respondió %s: %s", service, response.status_code, url)
        raise ExternalServiceUnavailableError(f"{service}: HTTP {response.status_code}")

    try:
        data = response.json()
    except ValueError as exc:
        raise ExternalServiceUnavailableError(f"{service}: respuesta no es JSON") from exc
    if not isinstance(data, dict):
        raise ExternalServiceUnavailableError(f"{service}: formato inesperado")
    return data


# --- Utilidades de limpieza -----------------------------------------------------

_TAGS = re.compile(r"<[^>]+>")
_SPACES = re.compile(r"\s+")


def clean_text(value: str | None) -> str | None:
    """Quita etiquetas XML/HTML (Crossref envía resúmenes en JATS: <jats:p>...),
    decodifica entidades (&amp;) y une espacios. Devuelve None si queda vacío."""
    if not value:
        return None
    text = _SPACES.sub(" ", html.unescape(_TAGS.sub(" ", value))).strip()
    return text or None


def first(values) -> str | None:
    """Crossref entrega muchos campos como listas (title, container-title)."""
    if isinstance(values, list) and values:
        return values[0]
    return None
