"""
File: metrics_service.py
Author: Jhony Alfonso Peñaherrera
Description: Métricas de producción científica para el dashboard - HU09 (por profesor) y HU10
(evolución de la Escuela). Criterios CA25, CA26, CA27 y CA28. Incluye los filtros comunes del
análisis (departamento, periodo, afiliación, tipo de contribución y cuartil).

Reglas:
- Solo cuenta lo que está en el catálogo consolidado (estado «verificado»), igual que la vista
  pública: lo pendiente o rechazado no suma.
- Una obra se acredita a su dueño y a los demás profesores registrados que figuran entre sus
  autores (coautoría dentro de la Escuela). Así un artículo compartido cuenta para ambos.
- Citas desconocidas (NULL) no suman ni cuentan como 0 en el índice h.
- El índice h se calcula aquí con su definición estándar (CA26): el mayor h tal que h obras
  tienen al menos h citas cada una.
- Los filtros se aplican una sola vez, al leer las obras (`load_works`), y todos los cálculos
  (indicadores, evolución, profesores y redes) parten de ese mismo conjunto.

Se calcula en memoria: con el volumen de la ECMC (cientos de obras) es inmediato. Si el
catálogo crece, la optimización va en T-HU09-04 (vistas, caché o precálculo).
"""

from __future__ import annotations

import unicodedata
from collections import Counter, defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from itertools import combinations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.product_bibliometrics import QUARTILES, ProductBibliometrics
from app.models.user import ROLE_PROFESSOR, User
from app.services.catalog_service import CATALOG_STATUS

NO_QUARTILE = "sin_cuartil"
QUARTILE_FILTERS = (*QUARTILES, NO_QUARTILE)
AFFILIATION_ALL = "all"
AFFILIATION_YACHAY = "yachay"
TOP_EXTERNAL = 12


@dataclass(frozen=True)
class MetricFilters:
    """Filtros comunes de todas las métricas. Inmutable, para poder usarlo como clave."""

    department: str | None = None
    year_from: int | None = None
    year_to: int | None = None
    affiliation: str = AFFILIATION_ALL
    contribution_type: str | None = None
    quartile: str | None = None

    def __post_init__(self) -> None:
        # Un rango invertido (desde 2024 hasta 2020) se interpreta como el rango correcto.
        if self.year_from is not None and self.year_to is not None and self.year_from > self.year_to:
            start, end = self.year_to, self.year_from
            object.__setattr__(self, "year_from", start)
            object.__setattr__(self, "year_to", end)


NO_FILTERS = MetricFilters()


def h_index(citations: Iterable[int | None]) -> int:
    """Índice h estándar; las citas desconocidas (None) se ignoran."""
    known = sorted((c for c in citations if c is not None), reverse=True)
    h = 0
    for position, value in enumerate(known, start=1):
        if value >= position:
            h = position
        else:
            break
    return h


def _name_key(name: str | None) -> str:
    text = unicodedata.normalize("NFD", name or "")
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return " ".join(text.lower().replace(",", " ").split())


@dataclass
class _Work:
    product: Product
    metrics: ProductBibliometrics | None
    credited: list[str]  # ids de profesores

    @property
    def citations(self) -> int | None:
        return self.metrics.citations if self.metrics else None

    @property
    def quartile(self) -> str:
        return (self.metrics.sjr_quartile if self.metrics else None) or NO_QUARTILE

    @property
    def year(self) -> int:
        return self.product.year

    @property
    def research_line(self) -> str:
        return self.product.research_line

    @property
    def institutions(self) -> list[str]:
        return (self.metrics.institutions if self.metrics else None) or []

    @property
    def countries(self) -> list[str]:
        return (self.metrics.countries if self.metrics else None) or []


def load_works(db: Session, filters: MetricFilters = NO_FILTERS) -> tuple[list[_Work], dict[str, User]]:
    """Obras verificadas que pasan los filtros, con los profesores acreditados en cada una.

    Periodo, afiliación, tipo y cuartil se filtran en la consulta. El departamento se filtra
    después de acreditar: una obra pasa si alguno de sus profesores es de ese departamento.
    """
    query = (
        select(Product, ProductBibliometrics)
        .outerjoin(ProductBibliometrics, ProductBibliometrics.product_id == Product.id)
        .where(Product.status == CATALOG_STATUS)
    )
    if filters.year_from is not None:
        query = query.where(Product.year >= filters.year_from)
    if filters.year_to is not None:
        query = query.where(Product.year <= filters.year_to)
    if filters.affiliation == AFFILIATION_YACHAY:
        query = query.where(ProductBibliometrics.yachay_affiliation == "si")
    if filters.contribution_type:
        query = query.where(ProductBibliometrics.contribution_type == filters.contribution_type)
    if filters.quartile == NO_QUARTILE:
        # Sin fila de indicadores, el outer join deja el cuartil en NULL: tampoco tiene cuartil.
        query = query.where(ProductBibliometrics.sjr_quartile.is_(None))
    elif filters.quartile:
        query = query.where(ProductBibliometrics.sjr_quartile == filters.quartile)

    rows = db.execute(query).all()
    professors = {u.id: u for u in db.scalars(select(User).where(User.role == ROLE_PROFESSOR))}
    by_name = {_name_key(u.full_name): u.id for u in professors.values()}

    works = []
    for product, metrics in rows:
        credited = [product.owner_id] if product.owner_id in professors else []
        for author in product.authors or []:
            professor_id = by_name.get(_name_key(author))
            if professor_id and professor_id not in credited:
                credited.append(professor_id)
        if filters.department and not any(professors[pid].department == filters.department for pid in credited):
            continue
        works.append(_Work(product, metrics, credited))
    return works, professors


def _share(part: int, whole: int) -> float | None:
    return round(part / whole, 4) if whole else None


def overview(db: Session, filters: MetricFilters = NO_FILTERS) -> dict:
    works, _ = load_works(db, filters)
    with_metrics = [w for w in works if w.metrics]
    known_citations = [w.citations for w in works if w.citations is not None]
    quartiles = Counter(w.quartile for w in works)
    with_quartile = sum(quartiles[q] for q in QUARTILES)
    open_access_known = [w.metrics.is_open_access for w in with_metrics if w.metrics.is_open_access is not None]
    collaboration_known = [
        w.metrics.collaboration_type
        for w in with_metrics
        if w.metrics.collaboration_type in ("institucional", "nacional", "internacional")
    ]
    years = [w.year for w in works]
    retrieved = [w.metrics.retrieved_at for w in with_metrics if w.metrics.retrieved_at]
    lines = Counter(w.research_line for w in works)
    types = Counter(w.metrics.contribution_type if w.metrics else None for w in works)

    return {
        "total_products": len(works),
        "publications": sum(1 for w in works if w.product.type == "publicacion"),
        "projects": sum(1 for w in works if w.product.type == "proyecto"),
        "professors": len({pid for w in works for pid in w.credited}),
        "citations_total": sum(known_citations),
        "products_with_citations": len(known_citations),
        "h_index": h_index(known_citations),
        "quartiles": {q: quartiles[q] for q in QUARTILE_FILTERS},
        "q1_q2_share": _share(quartiles["Q1"] + quartiles["Q2"], with_quartile),
        "open_access_share": _share(sum(open_access_known), len(open_access_known)),
        "international_share": _share(collaboration_known.count("internacional"), len(collaboration_known)),
        "year_from": min(years) if years else None,
        "year_to": max(years) if years else None,
        "data_as_of": max(retrieved) if retrieved else None,
        "research_lines": [{"research_line": line, "count": count} for line, count in lines.most_common()],
        "contribution_types": [
            {"contribution_type": kind, "count": count}
            for kind, count in sorted(types.items(), key=lambda item: (-item[1], item[0] or "~"))
        ],
    }


def timeline_points(works: Iterable[_Work]) -> list[dict]:
    """Producción por año, desglosada por cuartil SJR, con las citas conocidas."""
    by_year: dict[int, dict] = {}
    for work in works:
        year = by_year.setdefault(
            work.year,
            {
                "year": work.year,
                "total": 0,
                "citations": 0,
                "products_with_citations": 0,
                **{q: 0 for q in QUARTILE_FILTERS},
            },
        )
        year["total"] += 1
        year[work.quartile] += 1
        if work.citations is not None:
            year["citations"] += work.citations
            year["products_with_citations"] += 1
    return [by_year[year] for year in sorted(by_year)]


def timeline(db: Session, filters: MetricFilters = NO_FILTERS) -> list[dict]:
    """Producción por año (CA28), desglosada por cuartil SJR, con las citas conocidas."""
    works, _ = load_works(db, filters)
    return timeline_points(works)


def works_by_professor(works: Iterable[_Work]) -> dict[str, list[_Work]]:
    per_professor: dict[str, list[_Work]] = defaultdict(list)
    for work in works:
        for professor_id in work.credited:
            per_professor[professor_id].append(work)
    return per_professor


def professor_summary(professor: User, own: list[_Work]) -> dict:
    """Indicadores de un profesor sobre sus obras (CA25). `own` no puede estar vacío."""
    quartiles = Counter(w.quartile for w in own)
    citations = [w.citations for w in own]
    years = [w.year for w in own]
    lines = Counter(w.research_line for w in own)
    return {
        "id": professor.id,
        "full_name": professor.full_name,
        "department": professor.department,
        "products": len(own),
        "citations": sum(c for c in citations if c is not None),
        "products_with_citations": sum(1 for c in citations if c is not None),
        "h_index": h_index(citations),
        **{q: quartiles[q] for q in QUARTILE_FILTERS},
        "first_year": min(years),
        "last_year": max(years),
        "main_research_line": lines.most_common(1)[0][0],
        "coauthored_in_school": sum(1 for w in own if len(w.credited) > 1),
    }


def professors(db: Session, filters: MetricFilters = NO_FILTERS) -> list[dict]:
    """Métricas por profesor (CA25). Un profesor sin obras no aparece con datos inventados (CA27)."""
    works, users = load_works(db, filters)
    items = [
        professor_summary(users[professor_id], own) for professor_id, own in works_by_professor(works).items()
    ]
    items.sort(key=lambda item: (-item["products"], item["full_name"]))
    return items


def is_external_institution(name: str) -> bool:
    """La colaboración externa excluye a Yachay Tech, se escriba como se escriba."""
    return "yachay" not in _name_key(name)


def collaboration(db: Session, filters: MetricFilters = NO_FILTERS) -> dict:
    """Grafo de coautoría entre profesores de la Escuela y colaboración externa."""
    works, users = load_works(db, filters)
    products_per_professor: Counter = Counter()
    lines_per_professor: dict[str, Counter] = defaultdict(Counter)
    edges: Counter = Counter()
    countries: Counter = Counter()
    institutions: Counter = Counter()

    for work in works:
        for professor_id in work.credited:
            products_per_professor[professor_id] += 1
            lines_per_professor[professor_id][work.research_line] += 1
        for a, b in combinations(sorted(work.credited), 2):
            edges[(a, b)] += 1
        for code in set(work.countries):
            if code != "EC":
                countries[code] += 1
        for name in set(work.institutions):
            if is_external_institution(name):
                institutions[name] += 1

    nodes = [
        {
            "id": pid,
            "full_name": users[pid].full_name,
            "products": count,
            "main_research_line": lines_per_professor[pid].most_common(1)[0][0],
        }
        for pid, count in products_per_professor.most_common()
    ]
    return {
        "nodes": nodes,
        "edges": [{"source": a, "target": b, "weight": w} for (a, b), w in edges.most_common()],
        "countries": [{"code": c, "count": n} for c, n in countries.most_common(TOP_EXTERNAL)],
        "institutions": [{"name": i, "count": n} for i, n in institutions.most_common(TOP_EXTERNAL)],
    }


def filter_options(db: Session) -> dict:
    """Opciones de los filtros, calculadas sobre todo el catálogo verificado (sin filtrar)."""
    works, users = load_works(db)
    departments = sorted(
        {users[pid].department for w in works for pid in w.credited if users[pid].department},
        key=_name_key,
    )
    years = [w.year for w in works]
    types = Counter(w.metrics.contribution_type for w in works if w.metrics and w.metrics.contribution_type)
    quartiles = Counter(w.quartile for w in works)
    return {
        "departments": departments,
        "year_min": min(years) if years else None,
        "year_max": max(years) if years else None,
        "affiliations": [AFFILIATION_ALL, AFFILIATION_YACHAY],
        "contribution_types": [
            {"value": kind, "count": count}
            for kind, count in sorted(types.items(), key=lambda item: (-item[1], item[0]))
        ],
        "quartiles": [{"value": q, "count": quartiles[q]} for q in QUARTILE_FILTERS],
    }
