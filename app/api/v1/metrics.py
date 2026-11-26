"""
File: metrics.py
Description: Rutas públicas de métricas del dashboard - HU09 y HU10.
Sin sesión, como el catálogo: son agregados de la producción verificada.
Propuesta a validar con el cliente: si las métricas por profesor deben ser públicas.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.metrics import (
    CollaborationResponse,
    MetricsOverview,
    ProfessorMetricsResponse,
    TimelineResponse,
)
from app.services import metrics_service

router = APIRouter(prefix="/metrics", tags=["Metrics"])


@router.get("/overview", response_model=MetricsOverview)
def get_overview(db: Session = Depends(get_db)):
    """School totals: products, citations, h-index, quartiles and research lines (HU10)."""
    return metrics_service.overview(db)


@router.get("/timeline", response_model=TimelineResponse)
def get_timeline(db: Session = Depends(get_db)):
    """Production per year split by SJR quartile (HU10, CA28)."""
    return {"items": metrics_service.timeline(db)}


@router.get("/professors", response_model=ProfessorMetricsResponse)
def get_professors(db: Session = Depends(get_db)):
    """Products, citations and h-index per professor (HU09, CA25, CA27)."""
    return {"items": metrics_service.professors(db)}


@router.get("/collaboration", response_model=CollaborationResponse)
def get_collaboration(db: Session = Depends(get_db)):
    """Co-authorship graph among the School's professors and external collaboration."""
    return metrics_service.collaboration(db)
