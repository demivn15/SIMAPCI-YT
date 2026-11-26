"""
File: catalog.py
Description: Esquemas del catálogo consolidado - T-HU12-04 (PGPCECMC-97). Criterios CA34 y CA36.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CatalogProductResponse(BaseModel):
    """Un producto del catálogo consolidado, tal como puede verse desde fuera.

    Deliberadamente NO lleva los datos internos que sí tiene ProductResponse: ni el dueño
    (`owner_id`), ni quién revisó, ni cuándo, ni el motivo de la decisión. El catálogo es la
    cara pública de la producción (HU05), así que expone la obra, no el expediente de su
    revisión; un motivo de rechazo, en particular, es información entre el Comité y el autor.

    `status` siempre vale «verificado»: todo lo que sale por aquí está en el catálogo. Se
    incluye para que la respuesta se explique sola cuando se mezcla con otras consultas.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
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
    # Trazabilidad de HU12: de dónde salió la obra consolidada ('manual' revisada u 'orcid').
    source: str
    created_at: datetime


class CatalogListResponse(BaseModel):
    """Página del catálogo consolidado.

    - `total`: cuántos productos verificados hay, para paginar y para mostrar el tamaño de la
      producción sin recorrerla entera.
    - `items`: la página pedida, de la producción más reciente a la más antigua.
    """

    total: int
    items: list[CatalogProductResponse]


class CatalogProfessorResponse(BaseModel):
    """Identificador y nombre público de un profesor con producción publicada."""

    id: str
    full_name: str
