"""
File: schemas/dashboard.py
Description: Response contracts for the public dashboard endpoints (charter
             objective: "Proveer análisis y métricas de impacto").
"""

from pydantic import BaseModel


class ProfessorMetrics(BaseModel):
    user_id: int
    username: str
    full_name: str
    publications_count: int
    projects_count: int
    total_citations: int
    h_index: int


class SchoolSummary(BaseModel):
    active_professors: int
    total_publications: int
    total_projects: int
    total_citations: int
    publications_by_type: dict[str, int]


class TimelinePoint(BaseModel):
    year: int
    publications_count: int


class DashboardResponse(BaseModel):
    """Single payload with everything the landing-page dashboard needs."""

    summary: SchoolSummary
    timeline: list[TimelinePoint]
    professors: list[ProfessorMetrics]
