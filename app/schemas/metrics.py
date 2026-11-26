"""
File: metrics.py
Description: Esquemas de las métricas del dashboard - HU09 y HU10 (CA25, CA27, CA28), de los
filtros comunes y del análisis de redes (coautoría, instituciones, países, líneas y periodos).
Todo es agregado del catálogo consolidado: no expone correos, usuarios ni datos de revisión.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ResearchLineCount(BaseModel):
    research_line: str
    count: int


class ContributionTypeCount(BaseModel):
    contribution_type: str | None = Field(description="Tipo según Crossref/OpenAlex; null si no se conoce")
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
    contribution_types: list[ContributionTypeCount]


class TimelinePoint(BaseModel):
    year: int
    total: int
    citations: int = Field(description="Suma de las citas conocidas de las obras de ese año")
    products_with_citations: int
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
    department: str | None
    products: int
    citations: int
    products_with_citations: int
    h_index: int
    Q1: int
    Q2: int
    Q3: int
    Q4: int
    sin_cuartil: int
    first_year: int
    last_year: int
    main_research_line: str
    coauthored_in_school: int
    betweenness: float | None = Field(description="Intermediación normalizada en la red de coautoría")
    community: int


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


# ---------------------------------------------------------------------------
# Filtros comunes
# ---------------------------------------------------------------------------

class OptionCount(BaseModel):
    value: str
    count: int


class FilterOptions(BaseModel):
    departments: list[str]
    year_min: int | None
    year_max: int | None
    affiliations: list[str]
    contribution_types: list[OptionCount]
    quartiles: list[OptionCount]


# ---------------------------------------------------------------------------
# Redes
# ---------------------------------------------------------------------------

class GraphSummary(BaseModel):
    nodes: int
    edges: int
    density: float
    components: int
    largest_component: int
    average_clustering: float
    communities: int
    modularity: float | None = Field(description="Modularidad de la partición; null si no hay aristas")


class Centralities(BaseModel):
    degree: int = Field(description="Colegas distintos con los que publicó")
    strength: int = Field(description="Suma de obras en coautoría (grado ponderado)")
    betweenness: float | None
    betweenness_weighted: float | None
    closeness: float | None
    eigenvector: float | None = Field(description="Por componente conexa; null si no converge")
    clustering: float | None
    community: int


class NetworkProfessor(Centralities):
    id: str
    full_name: str
    department: str | None
    products: int
    main_research_line: str


class NetworkResponse(BaseModel):
    summary: GraphSummary
    professors: list[NetworkProfessor]


class CoauthorshipNode(BaseModel):
    id: str
    full_name: str
    department: str | None
    products: int
    main_research_line: str
    community: int
    betweenness: float | None
    degree: int


class CoauthorshipResponse(BaseModel):
    summary: GraphSummary
    nodes: list[CoauthorshipNode]
    edges: list[CollaborationEdge]


class BipartiteNode(BaseModel):
    id: str
    kind: Literal["professor", "institution", "country"]
    label: str
    department: str | None
    count: int = Field(description="Profesor: obras con los socios mostrados. Socio: obras de la Escuela con él")


class BipartiteResponse(BaseModel):
    min_count: int
    nodes: list[BipartiteNode]
    edges: list[CollaborationEdge]


class ResearchLineNode(BaseModel):
    id: str
    label: str
    products: int
    professors: int


class ResearchLinesNetworkResponse(BaseModel):
    nodes: list[ResearchLineNode]
    edges: list[CollaborationEdge]


class PeriodNetwork(BaseModel):
    label: str
    year_from: int
    year_to: int
    products: int
    summary: GraphSummary
    nodes: list[CoauthorshipNode]
    edges: list[CollaborationEdge]


class PeriodsResponse(BaseModel):
    periods: list[PeriodNetwork]


# ---------------------------------------------------------------------------
# Ficha del profesor
# ---------------------------------------------------------------------------

class ProfessorNetworkPosition(Centralities):
    betweenness_rank: int = Field(description="Puesto por intermediación dentro de la red (1 = mayor)")
    network_size: int
    community_size: int


class Coauthor(BaseModel):
    id: str
    full_name: str
    department: str | None
    weight: int


class EgoNode(BaseModel):
    id: str
    full_name: str
    department: str | None
    products: int
    community: int
    is_center: bool


class EgoNetwork(BaseModel):
    nodes: list[EgoNode]
    edges: list[CollaborationEdge]


class ProfessorProfile(BaseModel):
    id: str
    full_name: str
    department: str | None
    products: int
    citations: int
    products_with_citations: int
    h_index: int
    Q1: int
    Q2: int
    Q3: int
    Q4: int
    sin_cuartil: int
    first_year: int
    last_year: int
    main_research_line: str
    coauthored_in_school: int
    timeline: list[TimelinePoint]
    research_lines: list[ResearchLineCount]
    network: ProfessorNetworkPosition
    coauthors: list[Coauthor]
    ego_network: EgoNetwork
    institutions: list[InstitutionCount]
    countries: list[CountryCount]
