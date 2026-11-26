"""
File: metrics.py
Description: Esquemas de las métricas del dashboard - HU09 y HU10 (CA25, CA27, CA28).
Todo es agregado del catálogo consolidado: no expone correos, usuarios ni datos de revisión.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class ResearchLineCount(BaseModel):
    research_line: str
    count: int


class QuartileCounts(BaseModel):
    Q1: int
    Q2: int
    Q3: int
    Q4: int
    sin_cuartil: int


class MetricsOverview(BaseModel):
    total_products: int
    publications: int
    projects: int
    professors: int
    citations_total: int
    products_with_citations: int = Field(description="Obras con citas conocidas; las demás no suman")
    h_index: int = Field(description="Índice h de la Escuela, calculado con las citas conocidas")
    quartiles: QuartileCounts
    q1_q2_share: float | None
    open_access_share: float | None
    international_share: float | None
    year_from: int | None
    year_to: int | None
    data_as_of: datetime | None
    research_lines: list[ResearchLineCount]


class TimelinePoint(BaseModel):
    year: int
    total: int
    citations: int
    Q1: int
    Q2: int
    Q3: int
    Q4: int
    sin_cuartil: int


class TimelineResponse(BaseModel):
    items: list[TimelinePoint]


class ProfessorMetrics(BaseModel):
    id: str
    full_name: str
    products: int
    citations: int
    h_index: int
    Q1: int
    Q2: int
    Q3: int
    Q4: int
    first_year: int
    last_year: int
    main_research_line: str
    coauthored_in_school: int


class ProfessorMetricsResponse(BaseModel):
    items: list[ProfessorMetrics]


class CollaborationNode(BaseModel):
    id: str
    full_name: str
    products: int
    main_research_line: str


class CollaborationEdge(BaseModel):
    source: str
    target: str
    weight: int


class CountryCount(BaseModel):
    code: str
    count: int


class InstitutionCount(BaseModel):
    name: str
    count: int


class CollaborationResponse(BaseModel):
    nodes: list[CollaborationNode]
    edges: list[CollaborationEdge]
    countries: list[CountryCount]
    institutions: list[InstitutionCount]
