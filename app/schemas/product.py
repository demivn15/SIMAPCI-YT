"""
File: product.py
Description: Product creation schema and input validations (T-HU03-04, PGPCECMC-35).
"""

from datetime import date
from typing import Literal
from pydantic import BaseModel, Field, field_validator, model_validator

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
            self.project_code = self.project_code.upper()
            self.doi = None
            self.venue = None
        else:
            self.project_code = None
            self.project_status = None
        return self
