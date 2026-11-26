"""
File: metrics_service.py
Author: Jhony Alfonso Peñaherrera
Description: Métricas de producción científica para el dashboard - HU09 (por profesor) y HU10
(evolución de la Escuela). Criterios CA25, CA26, CA27 y CA28.

Reglas:
- Solo cuenta lo que está en el catálogo consolidado (estado «verificado»), igual que la vista
  pública: lo pendiente o rechazado no suma.
- Una obra se acredita a su dueño y a los demás profesores registrados que figuran entre sus
  autores (coautoría dentro de la Escuela). Así un artículo compartido cuenta para ambos.
- Citas desconocidas (NULL) no suman ni cuentan como 0 en el índice h.
- El índice h se calcula aquí con su definición estándar (CA26): el mayor h tal que h obras
  tienen al menos h citas cada una.

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
TOP_EXTERNAL = 12


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


def _load(db: Session) -> tuple[list[_Work], dict[str, User]]:
    rows = db.execute(
        select(Product, ProductBibliometrics)
        .outerjoin(ProductBibliometrics, ProductBibliometrics.product_id == Product.id)
        .where(Product.status == CATALOG_STATUS)
    ).all()
    professors = {u.id: u for u in db.scalars(select(User).where(User.role == ROLE_PROFESSOR))}
    by_name = {_name_key(u.full_name): u.id for u in professors.values()}

    works = []
    for product, metrics in rows:
        credited = [product.owner_id] if product.owner_id in professors else []
        for author in product.authors or []:
            professor_id = by_name.get(_name_key(author))
            if professor_id and professor_id not in credited:
                credited.append(professor_id)
        works.append(_Work(product, metrics, credited))
    return works, professors


def _share(part: int, whole: int) -> float | None:
    return round(part / whole, 4) if whole else None


def overview(db: Session) -> dict:
    works, _ = _load(db)
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
    years = [w.product.year for w in works]
    retrieved = [w.metrics.retrieved_at for w in with_metrics if w.metrics.retrieved_at]
    lines = Counter(w.product.research_line for w in works)

    return {
        "total_products": len(works),
        "publications": sum(1 for w in works if w.product.type == "publicacion"),
        "projects": sum(1 for w in works if w.product.type == "proyecto"),
        "professors": len({pid for w in works for pid in w.credited}),
        "citations_total": sum(known_citations),
        "products_with_citations": len(known_citations),
        "h_index": h_index(known_citations),
        "quartiles": {q: quartiles[q] for q in (*QUARTILES, NO_QUARTILE)},
        "q1_q2_share": _share(quartiles["Q1"] + quartiles["Q2"], with_quartile),
        "open_access_share": _share(sum(open_access_known), len(open_access_known)),
        "international_share": _share(collaboration_known.count("internacional"), len(collaboration_known)),
        "year_from": min(years) if years else None,
        "year_to": max(years) if years else None,
        "data_as_of": max(retrieved) if retrieved else None,
        "research_lines": [{"research_line": line, "count": count} for line, count in lines.most_common()],
    }


def timeline(db: Session) -> list[dict]:
    """Producción por año (CA28), desglosada por cuartil SJR, con las citas conocidas."""
    works, _ = _load(db)
    by_year: dict[int, dict] = {}
    for work in works:
        year = by_year.setdefault(
            work.product.year,
            {"year": work.product.year, "total": 0, "citations": 0, **{q: 0 for q in (*QUARTILES, NO_QUARTILE)}},
        )
        year["total"] += 1
        year[work.quartile] += 1
        year["citations"] += work.citations or 0
    return [by_year[year] for year in sorted(by_year)]


def professors(db: Session) -> list[dict]:
    """Métricas por profesor (CA25). Un profesor sin obras no aparece con datos inventados (CA27)."""
    works, users = _load(db)
    per_professor: dict[str, list[_Work]] = defaultdict(list)
    for work in works:
        for professor_id in work.credited:
            per_professor[professor_id].append(work)

    items = []
    for professor_id, own in per_professor.items():
        quartiles = Counter(w.quartile for w in own)
        citations = [w.citations for w in own]
        years = [w.product.year for w in own]
        lines = Counter(w.product.research_line for w in own)
        items.append({
            "id": professor_id,
            "full_name": users[professor_id].full_name,
            "products": len(own),
            "citations": sum(c for c in citations if c is not None),
            "h_index": h_index(citations),
            **{q: quartiles[q] for q in QUARTILES},
            "first_year": min(years),
            "last_year": max(years),
            "main_research_line": lines.most_common(1)[0][0],
            "coauthored_in_school": sum(1 for w in own if len(w.credited) > 1),
        })
    items.sort(key=lambda item: (-item["products"], item["full_name"]))
    return items


def collaboration(db: Session) -> dict:
    """Grafo de coautoría entre profesores de la Escuela y colaboración externa."""
    works, users = _load(db)
    products_per_professor: Counter = Counter()
    lines_per_professor: dict[str, Counter] = defaultdict(Counter)
    edges: Counter = Counter()
    countries: Counter = Counter()
    institutions: Counter = Counter()

    for work in works:
        for professor_id in work.credited:
            products_per_professor[professor_id] += 1
            lines_per_professor[professor_id][work.product.research_line] += 1
        for a, b in combinations(sorted(work.credited), 2):
            edges[(a, b)] += 1
        if work.metrics:
            for code in set(work.metrics.countries or []):
                if code != "EC":
                    countries[code] += 1
            for name in set(work.metrics.institutions or []):
                if "yachay" not in name.lower():
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
