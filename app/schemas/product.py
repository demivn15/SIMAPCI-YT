"""
File: product.py
Description: Product creation schema, ORCID import schema, review decisions, and input validations (T-HU03-04, T-HU12-02, T-HU12-03).
"""

from datetime import date, datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.utils.identifiers import is_valid_doi, normalize_doi, normalize_project_code

MIN_YEAR = 1900
RESEARCH_LINES = (
    "Ecuaciones diferenciales, análisis matemático, modelamiento y optimización",
    "Ciencia de datos",
    "Computación científica",
    "Inteligencia artificial",
    "Tecnologías de la información",
    "Ciencia, Tecnología y Sociedad",
)
PROJECT_STATUSES = ("activo", "en_pausa", "finalizado", "cancelado")


def _canonical_doi(value: str | None) -> str | None:
    """Normaliza el DOI y exige el formato 10.<prefijo>/<sufijo> (regla RU-02, T-HU07-02).

    Un texto vacío equivale a no tener DOI (CA21). Antes había tres versiones de esta
    normalización; ahora todas usan app/utils/identifiers.py.
    """
    if value is None:
        return None
    doi = normalize_doi(value)
    if not doi:
        return None
    if not is_valid_doi(doi):
        raise ValueError("DOI is not valid. Expected format: 10.<prefix>/<suffix>.")
    return doi


class ProductCreate(BaseModel):
    type: Literal["publicacion", "proyecto"]
    title: str = Field(min_length=1, max_length=500)
    authors: list[str] = Field(min_length=1)
    year: int
    research_line: str
    abstract: str | None = None
    doi: str | None = None
    venue: str | None = Field(default=None, max_length=500)
    project_code: str | None = Field(default=None, max_length=64)
    project_status: str | None = None

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title is required.")
        return value

    @field_validator("authors")
    @classmethod
    def authors_not_blank(cls, value: list[str]) -> list[str]:
        cleaned = [name.strip() for name in value if name and name.strip()]
        if not cleaned:
            raise ValueError("At least one author or participant is required.")
        return cleaned

    @field_validator("year")
    @classmethod
    def year_in_range(cls, value: int) -> int:
        if not MIN_YEAR <= value <= date.today().year + 1:
            raise ValueError(f"Year must be between {MIN_YEAR} and {date.today().year + 1}.")
        return value

    @field_validator("research_line")
    @classmethod
    def research_line_in_catalog(cls, value: str) -> str:
        if value not in RESEARCH_LINES:
            raise ValueError("Research line is not valid.")
        return value

    @field_validator("doi")
    @classmethod
    def doi_in_canonical_form(cls, value: str | None) -> str | None:
        return _canonical_doi(value)

    @field_validator("abstract", "venue", "project_code")
    @classmethod
    def empty_as_none(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None

    @model_validator(mode="after")
    def fields_match_type(self) -> "ProductCreate":
        if self.type == "proyecto":
            if not self.project_code:
                raise ValueError("Project code is required for projects.")
            if self.project_status not in PROJECT_STATUSES:
                raise ValueError("Invalid project status.")
            # RU-03 (T-HU07-02): misma forma que usa la verificación de existencia
            self.project_code = normalize_project_code(self.project_code)
            self.doi = None
            self.venue = None
        else:
            self.project_code = None
            self.project_status = None
        return self


class OrcidItemImport(BaseModel):
    """Esquema para mapear y validar los datos importados automáticamente desde ORCID (CA34)."""
    external_id: str = Field(..., description="Identificador externo o Put-Code de ORCID")
    title: str = Field(min_length=1, max_length=500)
    authors: list[str] = Field(min_length=1)
    year: int
    research_line: str = "Ciencia de datos"  # Línea por defecto o mapeada
    abstract: Optional[str] = None
    doi: Optional[str] = None
    venue: Optional[str] = Field(default=None, max_length=500)
    type: Literal["publicacion"] = "publicacion"

    @field_validator("doi")
    @classmethod
    def doi_canonical(cls, value: str | None) -> str | None:
        return _canonical_doi(value)

    # D-07: lo importado cumple las mismas reglas de año y línea que el registro manual (ProductCreate).
    @field_validator("year")
    @classmethod
    def year_in_range(cls, value: int) -> int:
        if not MIN_YEAR <= value <= date.today().year + 1:
            raise ValueError(f"Year must be between {MIN_YEAR} and {date.today().year + 1}.")
        return value

    @field_validator("research_line")
    @classmethod
    def research_line_in_catalog(cls, value: str) -> str:
        if value not in RESEARCH_LINES:
            raise ValueError("Research line is not valid.")
        return value


class ReviewDecisionSchema(BaseModel):
    """Esquema para la decisión del consejo de revisión sobre publicaciones pendientes (CA36)."""
    decision: Literal["verificado", "rechazado"] = Field(..., description="Aprobar ('verificado') o rechazar ('rechazado')")
    reason: Optional[str] = Field(None, description="Motivo obligatorio en caso de rechazo (CA23)")

    @model_validator(mode="after")
    def validate_reason_if_rejected(self) -> "ReviewDecisionSchema":
        if self.decision == "rechazado" and (not self.reason or not self.reason.strip()):
            raise ValueError("A reason is required when rejecting a product.")
        return self


class ProductResponse(BaseModel):
    """
    Producto guardado, tal como queda en la base de datos (incluye dueño, estado y trazabilidad HU12).
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    school: str
    status: str
    type: str
    title: str
    authors: list[str]
    year: int
    research_line: str
    abstract: str | None = None
    doi: str | None = None
    venue: str | None = None
    project_code: str | None = None
    project_status: str | None = None
    
    # Nuevos campos de trazabilidad (HU12)
    source: str
    external_id: str | None = None
    reviewed_by: str | None = None
    reviewed_at: datetime | None = None
    review_reason: str | None = None

    created_at: datetime
    updated_at: datetime


class ProductExistenceResponse(BaseModel):
    """
    Respuesta de GET /api/v1/products/exists - T-HU07-02 (PGPCECMC-60).

    - verifiable=False: no se envió DOI ni código; el registro puede continuar con el
      aviso de verificación no realizada (CA21).
    - exists=True: el identificador ya está registrado (CA20); field dice cuál coincidió.
    - public_product_id: solo si el producto existente es visible públicamente (RU-08),
      para enlazar su detalle sin revelar productos pendientes o rechazados.
    """

    verifiable: bool
    exists: bool
    field: Optional[Literal["doi", "project_code"]] = None
    normalized_identifier: Optional[str] = None
    public_product_id: Optional[str] = None
