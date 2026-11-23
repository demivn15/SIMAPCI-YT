"""
File: integrations.py
Author: Jhony Alfonso Peñaherrera
Description: Endpoints de integración con DOI y ORCID - T-HU03-02 (PGPCECMC-33).

Los usa el formulario de registro de productos (PGPCECMC-32) para el autocompletado.
Requieren sesión de profesor: sin esa protección, la API serviría de intermediario
abierto hacia Crossref, OpenAlex y ORCID para cualquiera.
"""


from app.api.deps import get_current_professor
from app.integrations.base import ExternalNotFoundError, ExternalServiceUnavailableError, build_http_client
from app.integrations.crossref import CrossrefClient
from app.integrations.openalex import OpenAlexClient
from app.integrations.orcid import OrcidClient
from app.services.doi_lookup_service import DoiLookupService
from app.utils.file_validation import validate_and_process_file
from app.utils.pdf_extractor import UnreadableDocumentError, extract_fields_from_pdf
from app.utils.identifiers import is_valid_doi, is_valid_orcid, normalize_doi, normalize_orcid
from collections.abc import Iterator
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from pydantic import BaseModel
from typing import Literal

import httpx2

router = APIRouter(prefix="/integrations", tags=["Integrations"])

# --- Esquemas de respuesta (contrato con el frontend) ---------------------------

class DoiMetadataOut(BaseModel):
    doi: str
    title: str
    authors: list[str]
    year: int | None
    venue: str | None
    abstract: str | None
    source: str


class OrcidWorkOut(BaseModel):
    put_code: str | None
    title: str
    year: int | None
    doi: str | None
    venue: str | None
    work_type: str | None


class UploadedFileOut(BaseModel):
    """Archivo aceptado por la validación de tipo, tamaño e integridad (T-HU04-03)."""

    filename: str | None
    size: int
    content_type: str | None
    integrity_sha256: str


class ExtractionReportOut(BaseModel):
    """Qué se logró identificar en el documento y qué queda por completar (T-HU04-05, CA10).

    status: 'completa' (todos los campos), 'parcial' (algunos) o 'vacia' (ninguno, por ejemplo
    un PDF escaneado). Ninguno de los tres es un error: el formulario precarga lo identificado
    y deja el resto editable.
    """

    status: Literal["completa", "parcial", "vacia"]
    fields_found: list[str]
    fields_missing: list[str]
    message: str


class ProductFileUploadOut(BaseModel):
    file: UploadedFileOut
    extracted_fields: dict[str, str]
    extraction: ExtractionReportOut


# --- Dependencias (las pruebas las reemplazan por clientes simulados) -----------

def get_http_client() -> Iterator[httpx2.Client]:
    with build_http_client() as client:
        yield client


def get_doi_lookup_service(client: httpx2.Client = Depends(get_http_client)) -> DoiLookupService:
    return DoiLookupService([CrossrefClient(client), OpenAlexClient(client)])


def get_orcid_client(client: httpx2.Client = Depends(get_http_client)) -> OrcidClient:
    return OrcidClient(client)

# --- Endpoints ----------------------------------------------------------------

@router.get("/doi/{doi:path}", response_model=DoiMetadataOut)
def lookup_doi(
    doi: str,
    _user: dict = Depends(get_current_professor),
    service: DoiLookupService = Depends(get_doi_lookup_service),
):
    """Metadatos de una publicación a partir de su DOI (CA07).

    `{doi:path}` porque un DOI contiene "/" (10.1145/3576915.3623102).
    """
    clean_doi = normalize_doi(doi)
    if not is_valid_doi(clean_doi):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El DOI debe tener la forma 10.xxxx/xxxxx.")

    try:
        metadata = service.lookup(clean_doi)
    except ExternalNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No se encontraron datos para este DOI.") from exc
    except ExternalServiceUnavailableError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Los servicios de consulta de DOI no están disponibles. Intente más tarde.",
        ) from exc

    return DoiMetadataOut(**metadata.__dict__)

@router.get("/orcid/{orcid}/works", response_model=list[OrcidWorkOut])
def list_orcid_works(
    orcid: str,
    _user: dict = Depends(get_current_professor),
    client: OrcidClient = Depends(get_orcid_client),
):
    """Obras públicas registradas en un perfil ORCID."""
    clean_orcid = normalize_orcid(orcid)
    if not is_valid_orcid(clean_orcid):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "El ORCID debe tener la forma 0000-0000-0000-000X y un dígito verificador válido.",
        )

    try:
        works = client.fetch_works(clean_orcid)
    except ExternalNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No existe un perfil ORCID con ese identificador.") from exc
    except ExternalServiceUnavailableError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "El servicio de ORCID no está disponible. Intente más tarde.",
        ) from exc

    return [OrcidWorkOut(**work.__dict__) for work in works]

@router.post("/upload", response_model=ProductFileUploadOut)
async def upload_and_extract_product_file(file: UploadFile = File(...)):
    """Carga del documento del proyecto y extracción de sus campos (CA10, CA11).

    1. Valida tipo, tamaño, número mágico y calcula el hash de integridad (T-HU04-03).
    2. Extrae los campos que logre identificar (T-HU04-04).

    T-HU04-05 (PGPCECMC-91) cubre los dos casos que no son un PDF de proyecto normal:
      - Formato no reconocido: lo que no es PDF se rechaza en la validación y un PDF ilegible
        (dañado, truncado o protegido) se rechaza aquí con 400 y un mensaje claro, no con un
        error interno. En ambos casos el registro en curso del profesor no se altera.
      - Extracción parcial: si el PDF se lee pero solo se identifican algunos campos (o
        ninguno), la respuesta sigue siendo 200 e incluye en `extraction` qué se identificó y
        qué falta, para que el formulario precargue eso y deje el resto editable.
    """
    # 1. Tipo, tamaño, firma de bytes y hash SHA-256 de integridad.
    file_metadata = await validate_and_process_file(file)

    # 2. Extracción. Solo llegan archivos PDF: la validación rechaza cualquier otro tipo.
    try:
        extraction = await extract_fields_from_pdf(file)
    except UnreadableDocumentError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    return ProductFileUploadOut(
        file=UploadedFileOut(**file_metadata),
        extracted_fields=extraction.fields,
        extraction=ExtractionReportOut(**extraction.as_dict()),
    )
