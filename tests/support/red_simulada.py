"""
Red simulada para Crossref y OpenAlex (pruebas de HU03, Camilo Vásquez).

Reemplaza solo el cliente HTTP (httpx2.MockTransport). Así corre la cadena real:
endpoint -> DoiLookupService -> CrossrefClient / OpenAlexClient -> get_json,
y lo único simulado es la respuesta (o la caída) de cada servicio externo.
"""

from collections.abc import Callable

import httpx2

from app.api.v1.integrations import get_http_client
from app.main import app

Manejador = Callable[[httpx2.Request], httpx2.Response]


def json_ok(datos: dict) -> Manejador:
    return lambda request: httpx2.Response(200, json=datos)


def estado(codigo: int) -> Manejador:
    return lambda request: httpx2.Response(codigo, json={"status": "error"})


def lanza(error: type[httpx2.TransportError]) -> Manejador:
    def manejador(request: httpx2.Request) -> httpx2.Response:
        raise error("simulado", request=request)

    return manejador


class RedSimulada:
    """Responde según el servicio (host) y cuenta las peticiones a cada uno."""

    def __init__(self, crossref: Manejador, openalex: Manejador):
        self._por_host = {"api.crossref.org": crossref, "api.openalex.org": openalex}
        self.peticiones: dict[str, int] = {"api.crossref.org": 0, "api.openalex.org": 0}

    def __call__(self, request: httpx2.Request) -> httpx2.Response:
        host = request.url.host
        self.peticiones[host] = self.peticiones.get(host, 0) + 1
        return self._por_host[host](request)


def instalar_red(red: RedSimulada) -> None:
    def cliente_simulado():
        with httpx2.Client(transport=httpx2.MockTransport(red)) as cliente:
            yield cliente

    app.dependency_overrides[get_http_client] = cliente_simulado


def quitar_red() -> None:
    app.dependency_overrides.pop(get_http_client, None)
