"""
File: metrics.py
Description: Rutas públicas de métricas del dashboard - HU09 y HU10 - y del análisis de redes.
Sin sesión, como el catálogo: son agregados de la producción verificada.
Todas aceptan los mismos filtros (departamento, periodo, afiliación, tipo y cuartil).
Propuesta a validar con el cliente: si las métricas por profesor deben ser públicas.
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.metrics import (
    BipartiteResponse,
    CoauthorshipResponse,
    CollaborationResponse,
    FilterOptions,
    MetricsOverview,
    NetworkResponse,
    PeriodsResponse,
    ProfessorMetricsResponse,
    ProfessorProfile,
    ResearchLinesNetworkResponse,
    TimelineResponse,
)
from app.services import metrics_service, network_service
from app.services.metrics_service import MetricFilters

router = APIRouter(prefix="/metrics", tags=["Metrics"])


def metric_filters(
    department: str | None = Query(None, max_length=80, description="Departamento de algún profesor acreditado"),
    year_from: int | None = Query(None, ge=1900, le=2100, description="Desde este año (incluido)"),
    year_to: int | None = Query(None, ge=1900, le=2100, description="Hasta este año (incluido)"),
    affiliation: Literal["all", "yachay"] = Query("all", description="«yachay»: solo afiliación Yachay confirmada"),
    contribution_type: str | None = Query(None, max_length=40, description="Tipo según Crossref/OpenAlex"),
    quartile: Literal["Q1", "Q2", "Q3", "Q4", "sin_cuartil"] | None = Query(None, description="Cuartil SJR"),
) -> MetricFilters:
    """Filtros comunes. Un periodo invertido se intercambia; un texto vacío no filtra."""
    return MetricFilters(
        department=(department or "").strip() or None,
        year_from=year_from,
        year_to=year_to,
        affiliation=affiliation,
        contribution_type=(contribution_type or "").strip() or None,
        quartile=quartile,
    )


@router.get("/filters", response_model=FilterOptions)
def get_filter_options(db: Session = Depends(get_db)):
    """Available filter options: departments, year range, contribution types and quartiles."""
    return metrics_service.filter_options(db)


@router.get("/overview", response_model=MetricsOverview)
def get_overview(filters: MetricFilters = Depends(metric_filters), db: Session = Depends(get_db)):
    """School totals: products, citations, h-index, quartiles, research lines and contribution types (HU10)."""
    return metrics_service.overview(db, filters)


@router.get("/timeline", response_model=TimelineResponse)
def get_timeline(filters: MetricFilters = Depends(metric_filters), db: Session = Depends(get_db)):
    """Production and known citations per year, split by SJR quartile (HU10, CA28)."""
    return {"items": metrics_service.timeline(db, filters)}


@router.get("/professors", response_model=ProfessorMetricsResponse)
def get_professors(filters: MetricFilters = Depends(metric_filters), db: Session = Depends(get_db)):
    """Products, citations, h-index, department, betweenness and community per professor (HU09, CA25, CA27)."""
    return {"items": network_service.professors_with_network(db, filters)}


@router.get("/professors/{professor_id}", response_model=ProfessorProfile)
def get_professor_profile(
    professor_id: str, filters: MetricFilters = Depends(metric_filters), db: Session = Depends(get_db)
):
    """Public profile of one professor: metrics, timeline, lines, co-authors, ego network and partners."""
    try:
        return network_service.professor_profile(db, professor_id, filters)
    except network_service.ProfessorWithoutFilteredWorks:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El profesor no tiene obras verificadas con los filtros elegidos.",
        )
    except network_service.ProfessorNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profesor no encontrado.")


@router.get("/collaboration", response_model=CollaborationResponse)
def get_collaboration(filters: MetricFilters = Depends(metric_filters), db: Session = Depends(get_db)):
    """Co-authorship graph among the School's professors and external collaboration."""
    return metrics_service.collaboration(db, filters)


@router.get("/network", response_model=NetworkResponse)
def get_network(filters: MetricFilters = Depends(metric_filters), db: Session = Depends(get_db)):
    """Co-authorship graph metrics and every professor's centralities."""
    return network_service.network(db, filters)


@router.get("/networks/coauthorship", response_model=CoauthorshipResponse)
def get_coauthorship_network(filters: MetricFilters = Depends(metric_filters), db: Session = Depends(get_db)):
    """Internal co-authorship network: nodes with department, community and betweenness, plus weighted edges."""
    return network_service.coauthorship(db, filters)


@router.get("/networks/institutions", response_model=BipartiteResponse)
def get_institutions_network(
    min_count: int = Query(3, ge=1, le=100, description="Mínimo de obras para mostrar una institución"),
    filters: MetricFilters = Depends(metric_filters),
    db: Session = Depends(get_db),
):
    """Bipartite network professor ↔ external institution (Yachay excluded)."""
    return network_service.institutions_network(db, filters, min_count)


@router.get("/networks/countries", response_model=BipartiteResponse)
def get_countries_network(filters: MetricFilters = Depends(metric_filters), db: Session = Depends(get_db)):
    """Bipartite network professor ↔ country of co-authoring institutions (Ecuador excluded)."""
    return network_service.countries_network(db, filters)


@router.get("/networks/research-lines", response_model=ResearchLinesNetworkResponse)
def get_research_lines_network(filters: MetricFilters = Depends(metric_filters), db: Session = Depends(get_db)):
    """Research lines network: node size = works, edge weight = professors publishing in both lines."""
    return network_service.research_lines_network(db, filters)


@router.get("/networks/periods", response_model=PeriodsResponse)
def get_periods_network(
    periods: str | None = Query(
        None, max_length=120, description="Periodos AAAA-AAAA separados por coma (por defecto 2014-2018,2019-2022,2023-2026)"
    ),
    filters: MetricFilters = Depends(metric_filters),
    db: Session = Depends(get_db),
):
    """Co-authorship network per period, to compare how collaboration grows."""
    try:
        parsed = network_service.parse_periods(periods)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error))
    return network_service.periods_network(db, filters, parsed)
