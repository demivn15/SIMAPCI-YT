"""
File: network_service.py
Author: Jhony Alfonso Peñaherrera
Description: Análisis de redes de la producción científica de la Escuela con networkx:
coautoría interna, redes bipartitas con instituciones y países externos, red de líneas de
investigación, evolución por periodos y ficha del profesor.

Reglas:
- Parte del mismo conjunto de obras que las demás métricas (`metrics_service.load_works`), con
  los mismos filtros: solo obras «verificado».
- Grafo de coautoría interna: nodo = profesor con al menos una obra en el conjunto filtrado;
  arista = obras firmadas juntos, con `weight` (número de obras) y `distance = 1 / weight`
  (más obras juntos = más «cerca», para los cálculos de caminos más cortos).
- El volcado solo trae a los profesores de la Escuela como autores: la colaboración externa
  se mide por institución y país, no por persona.
- Las comunidades usan Louvain con semilla fija (42) para que el resultado sea el mismo en cada
  consulta; se numeran por tamaño (la 0 es la mayor).

Sin caché: con unas 800 obras y unas 30 personas, el grafo y todas sus centralidades se
calculan en milisegundos. Si el catálogo crece, se puede cachear por combinación de filtros
más el `max(updated_at)` de los productos.
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from collections.abc import Iterable
from itertools import combinations

import networkx as nx
from sqlalchemy.orm import Session

from app.models.user import ROLE_PROFESSOR, User
from app.services.metrics_service import (
    NO_FILTERS,
    MetricFilters,
    _Work,
    is_external_institution,
    load_works,
    professor_summary,
    timeline_points,
    works_by_professor,
)

COMMUNITY_SEED = 42
DEFAULT_PERIODS: tuple[tuple[int, int], ...] = ((2014, 2018), (2019, 2022), (2023, 2026))
DEFAULT_INSTITUTION_MIN_COUNT = 3
TOP_PARTNERS = 10
HOME_COUNTRY = "EC"
_PERIOD = re.compile(r"^\s*(\d{4})\s*-\s*(\d{4})\s*$")


def _round(value: float | None) -> float | None:
    return None if value is None else round(float(value), 4)


# ---------------------------------------------------------------------------
# 1. Grafo de coautoría y métricas (funciones puras sobre networkx)
# ---------------------------------------------------------------------------

def coauthorship_graph(works: Iterable[_Work], users: dict[str, User]) -> nx.Graph:
    graph = nx.Graph()
    lines: dict[str, Counter] = defaultdict(Counter)
    products: Counter = Counter()
    for work in works:
        credited = sorted(set(work.credited))
        for professor_id in credited:
            products[professor_id] += 1
            lines[professor_id][work.research_line] += 1
            graph.add_node(professor_id)
        for a, b in combinations(credited, 2):
            weight = graph.edges[a, b]["weight"] + 1 if graph.has_edge(a, b) else 1
            graph.add_edge(a, b, weight=weight)
    for a, b, data in graph.edges(data=True):
        data["distance"] = 1 / data["weight"]
    for professor_id in graph.nodes:
        user = users[professor_id]
        graph.nodes[professor_id].update(
            full_name=user.full_name,
            department=user.department,
            products=products[professor_id],
            main_research_line=lines[professor_id].most_common(1)[0][0],
        )
    return graph


def detect_communities(graph: nx.Graph) -> list[set]:
    """Comunidades con Louvain (semilla fija), de la mayor a la menor.

    Sin aristas, cada nodo es su propia comunidad. Los nodos aislados también quedan solos.
    El desempate por el menor identificador hace que la numeración sea estable.
    """
    if graph.number_of_nodes() == 0:
        return []
    if graph.number_of_edges() == 0:
        communities = [{node} for node in graph.nodes]
    else:
        communities = nx.community.louvain_communities(graph, weight="weight", seed=COMMUNITY_SEED)
    return sorted(communities, key=lambda members: (-len(members), min(str(m) for m in members)))


def community_index(communities: list[set]) -> dict:
    return {node: index for index, members in enumerate(communities) for node in members}


def eigenvector_by_component(graph: nx.Graph) -> dict:
    """Centralidad de vector propio, calculada en cada componente conexa de más de 2 nodos.

    En un grafo desconectado el vector propio global no está bien definido, por eso se calcula
    por componente. Los nodos aislados o en parejas valen 0. Si el método no converge, esos
    nodos quedan en None (null en la API) en lugar de producir un error.
    Ojo: cada componente se normaliza por separado, así que solo se comparan valores de la
    misma componente.
    """
    result: dict = {node: 0.0 for node in graph.nodes}
    for component in nx.connected_components(graph):
        if len(component) <= 2:
            continue
        try:
            values = nx.eigenvector_centrality(graph.subgraph(component), weight="weight", max_iter=1000)
        except nx.PowerIterationFailedConvergence:
            values = {node: None for node in component}
        result.update(values)
    return result


def centralities(graph: nx.Graph, communities: list[set] | None = None) -> dict[str, dict]:
    """Centralidades por nodo: grado, fuerza, intermediación (con y sin pesos), cercanía,
    vector propio, agrupamiento y comunidad."""
    if communities is None:
        communities = detect_communities(graph)
    betweenness = nx.betweenness_centrality(graph, normalized=True)
    betweenness_weighted = nx.betweenness_centrality(graph, normalized=True, weight="distance")
    closeness = nx.closeness_centrality(graph, distance="distance")
    clustering = nx.clustering(graph)
    eigenvector = eigenvector_by_component(graph)
    community = community_index(communities)
    return {
        node: {
            "degree": graph.degree(node),
            "strength": graph.degree(node, weight="weight"),
            "betweenness": _round(betweenness[node]),
            "betweenness_weighted": _round(betweenness_weighted[node]),
            "closeness": _round(closeness[node]),
            "eigenvector": _round(eigenvector[node]),
            "clustering": _round(clustering[node]),
            "community": community[node],
        }
        for node in graph.nodes
    }


def graph_summary(graph: nx.Graph, communities: list[set] | None = None) -> dict:
    """Métricas del grafo completo."""
    if communities is None:
        communities = detect_communities(graph)
    nodes = graph.number_of_nodes()
    has_edges = graph.number_of_edges() > 0
    return {
        "nodes": nodes,
        "edges": graph.number_of_edges(),
        "density": _round(nx.density(graph)) if nodes > 1 else 0.0,
        "components": nx.number_connected_components(graph) if nodes else 0,
        "largest_component": max((len(c) for c in nx.connected_components(graph)), default=0),
        "average_clustering": _round(nx.average_clustering(graph)) if nodes else 0.0,
        "communities": len(communities),
        # Sin aristas la modularidad no está definida (división entre cero).
        "modularity": _round(nx.community.modularity(graph, communities, weight="weight")) if has_edges else None,
    }


def _edges(graph: nx.Graph) -> list[dict]:
    edges = [
        {"source": min(a, b), "target": max(a, b), "weight": data["weight"]}
        for a, b, data in graph.edges(data=True)
    ]
    return sorted(edges, key=lambda e: (-e["weight"], e["source"], e["target"]))


def _school_network(db: Session, filters: MetricFilters):
    works, users = load_works(db, filters)
    graph = coauthorship_graph(works, users)
    communities = detect_communities(graph)
    return works, users, graph, communities, centralities(graph, communities)


# ---------------------------------------------------------------------------
# 2. Vistas de la API
# ---------------------------------------------------------------------------

def network(db: Session, filters: MetricFilters = NO_FILTERS) -> dict:
    """Métricas del grafo de coautoría y centralidades de cada profesor."""
    _, _, graph, communities, values = _school_network(db, filters)
    professors = [
        {
            "id": node,
            "full_name": data["full_name"],
            "department": data["department"],
            "products": data["products"],
            "main_research_line": data["main_research_line"],
            **values[node],
        }
        for node, data in graph.nodes(data=True)
    ]
    professors.sort(key=lambda p: (-(p["betweenness"] or 0), -p["products"], p["full_name"]))
    return {"summary": graph_summary(graph, communities), "professors": professors}


def professors_with_network(db: Session, filters: MetricFilters = NO_FILTERS) -> list[dict]:
    """Métricas por profesor (CA25) con su departamento, intermediación y comunidad."""
    works, users, _, _, values = _school_network(db, filters)
    items = []
    for professor_id, own in works_by_professor(works).items():
        item = professor_summary(users[professor_id], own)
        item["betweenness"] = values[professor_id]["betweenness"]
        item["community"] = values[professor_id]["community"]
        items.append(item)
    items.sort(key=lambda item: (-item["products"], item["full_name"]))
    return items


def coauthorship(db: Session, filters: MetricFilters = NO_FILTERS) -> dict:
    _, _, graph, communities, values = _school_network(db, filters)
    nodes = [
        {
            "id": node,
            "full_name": data["full_name"],
            "department": data["department"],
            "products": data["products"],
            "main_research_line": data["main_research_line"],
            "community": values[node]["community"],
            "betweenness": values[node]["betweenness"],
            "degree": values[node]["degree"],
        }
        for node, data in graph.nodes(data=True)
    ]
    nodes.sort(key=lambda n: (-n["products"], n["full_name"]))
    return {"summary": graph_summary(graph, communities), "nodes": nodes, "edges": _edges(graph)}


def _bipartite(works: list[_Work], users: dict[str, User], partners_of, kind: str, prefix: str, min_count: int) -> dict:
    """Red bipartita profesor ↔ socio externo (institución o país).

    Un socio entra si aparece en al menos `min_count` obras del conjunto filtrado; la arista
    profesor-socio pesa el número de obras del profesor con ese socio.
    """
    partner_works: Counter = Counter()
    links: Counter = Counter()
    for work in works:
        partners = set(partners_of(work))
        partner_works.update(partners)
        for professor_id in set(work.credited):
            for partner in partners:
                links[(professor_id, partner)] += 1
    kept = {partner for partner, count in partner_works.items() if count >= min_count}
    edges = [
        {"source": professor_id, "target": f"{prefix}{partner}", "weight": weight}
        for (professor_id, partner), weight in links.items()
        if partner in kept
    ]
    edges.sort(key=lambda e: (-e["weight"], e["source"], e["target"]))
    professor_links: Counter = Counter()
    for edge in edges:
        professor_links[edge["source"]] += edge["weight"]
    nodes = [
        {
            "id": professor_id,
            "kind": "professor",
            "label": users[professor_id].full_name,
            "department": users[professor_id].department,
            "count": count,
        }
        for professor_id, count in professor_links.items()
    ]
    nodes += [
        {"id": f"{prefix}{partner}", "kind": kind, "label": partner, "department": None, "count": partner_works[partner]}
        for partner in kept
    ]
    nodes.sort(key=lambda n: (n["kind"] != "professor", -n["count"], n["label"]))
    return {"nodes": nodes, "edges": edges}


def institutions_network(
    db: Session, filters: MetricFilters = NO_FILTERS, min_count: int = DEFAULT_INSTITUTION_MIN_COUNT
) -> dict:
    works, users = load_works(db, filters)
    result = _bipartite(
        works, users, lambda w: [i for i in w.institutions if is_external_institution(i)],
        "institution", "inst:", min_count,
    )
    return {"min_count": min_count, **result}


def countries_network(db: Session, filters: MetricFilters = NO_FILTERS, min_count: int = 1) -> dict:
    works, users = load_works(db, filters)
    result = _bipartite(
        works, users, lambda w: [c for c in w.countries if c and c != HOME_COUNTRY], "country", "country:", min_count
    )
    return {"min_count": min_count, **result}


def research_lines_network(db: Session, filters: MetricFilters = NO_FILTERS) -> dict:
    """Nodo = línea (tamaño = obras); arista = profesores que publican en ambas líneas."""
    works, _ = load_works(db, filters)
    products = Counter(w.research_line for w in works)
    lines_by_professor: dict[str, set] = defaultdict(set)
    for work in works:
        for professor_id in work.credited:
            lines_by_professor[professor_id].add(work.research_line)
    professors_per_line = Counter(line for lines in lines_by_professor.values() for line in lines)
    shared: Counter = Counter()
    for lines in lines_by_professor.values():
        for a, b in combinations(sorted(lines), 2):
            shared[(a, b)] += 1
    return {
        "nodes": [
            {"id": line, "label": line, "products": count, "professors": professors_per_line[line]}
            for line, count in products.most_common()
        ],
        "edges": [
            {"source": a, "target": b, "weight": w}
            for (a, b), w in sorted(shared.items(), key=lambda item: (-item[1], item[0]))
        ],
    }


def parse_periods(text: str | None) -> list[tuple[int, int]]:
    """Lee «2014-2018,2019-2022». Un periodo invertido se corrige; uno mal escrito es un error."""
    if not text or not text.strip():
        return list(DEFAULT_PERIODS)
    periods = []
    for chunk in text.split(","):
        match = _PERIOD.match(chunk)
        if not match:
            raise ValueError(f"Periodo inválido: {chunk.strip()!r}. Use el formato AAAA-AAAA.")
        start, end = sorted((int(match.group(1)), int(match.group(2))))
        periods.append((start, end))
    if len(periods) > 6:
        raise ValueError("Se admiten como máximo 6 periodos.")
    return periods


def periods_network(db: Session, filters: MetricFilters = NO_FILTERS, periods: list[tuple[int, int]] | None = None) -> dict:
    """Red de coautoría por periodo, para ver cómo crece la colaboración."""
    works, users = load_works(db, filters)
    result = []
    for start, end in periods or DEFAULT_PERIODS:
        subset = [w for w in works if start <= w.year <= end]
        graph = coauthorship_graph(subset, users)
        communities = detect_communities(graph)
        values = centralities(graph, communities)
        nodes = [
            {
                "id": node,
                "full_name": data["full_name"],
                "department": data["department"],
                "products": data["products"],
                "main_research_line": data["main_research_line"],
                "community": values[node]["community"],
                "betweenness": values[node]["betweenness"],
                "degree": values[node]["degree"],
            }
            for node, data in graph.nodes(data=True)
        ]
        nodes.sort(key=lambda n: (-n["products"], n["full_name"]))
        result.append({
            "label": f"{start}–{end}",
            "year_from": start,
            "year_to": end,
            "products": len(subset),
            "summary": graph_summary(graph, communities),
            "nodes": nodes,
            "edges": _edges(graph),
        })
    return {"periods": result}


class ProfessorNotFound(LookupError):
    """El profesor no existe, no es profesor o no tiene obras verificadas."""


class ProfessorWithoutFilteredWorks(LookupError):
    """El profesor existe, pero los filtros dejan fuera todas sus obras."""


def professor_profile(db: Session, professor_id: str, filters: MetricFilters = NO_FILTERS) -> dict:
    """Ficha pública del profesor. No expone correo ni usuario."""
    user = db.get(User, professor_id)
    if user is None or user.role != ROLE_PROFESSOR:
        raise ProfessorNotFound(professor_id)
    if filters != NO_FILTERS:
        all_works, _ = load_works(db)
        if not any(professor_id in w.credited for w in all_works):
            raise ProfessorNotFound(professor_id)

    works, users, graph, communities, values = _school_network(db, filters)
    own = [w for w in works if professor_id in w.credited]
    if not own:
        if filters == NO_FILTERS:
            raise ProfessorNotFound(professor_id)
        raise ProfessorWithoutFilteredWorks(professor_id)

    neighbors = sorted(graph.neighbors(professor_id), key=lambda n: (-graph.edges[professor_id, n]["weight"], n))
    coauthors = [
        {
            "id": n,
            "full_name": graph.nodes[n]["full_name"],
            "department": graph.nodes[n]["department"],
            "weight": graph.edges[professor_id, n]["weight"],
        }
        for n in neighbors
    ]
    ego = graph.subgraph([professor_id, *neighbors])
    ego_nodes = [
        {
            "id": n,
            "full_name": graph.nodes[n]["full_name"],
            "department": graph.nodes[n]["department"],
            "products": graph.nodes[n]["products"],
            "community": values[n]["community"],
            "is_center": n == professor_id,
        }
        for n in ego.nodes
    ]
    institutions = Counter(i for w in own for i in set(w.institutions) if is_external_institution(i))
    countries = Counter(c for w in own for c in set(w.countries) if c and c != HOME_COUNTRY)
    lines = Counter(w.research_line for w in own)
    ranked = sorted(graph.nodes, key=lambda n: -(values[n]["betweenness"] or 0))
    return {
        **professor_summary(user, own),
        "timeline": timeline_points(own),
        "research_lines": [{"research_line": line, "count": count} for line, count in lines.most_common()],
        "network": {
            **values[professor_id],
            "betweenness_rank": ranked.index(professor_id) + 1,
            "network_size": graph.number_of_nodes(),
            "community_size": len(communities[values[professor_id]["community"]]),
        },
        "coauthors": coauthors,
        "ego_network": {"nodes": ego_nodes, "edges": _edges(ego)},
        "institutions": [{"name": n, "count": c} for n, c in institutions.most_common(TOP_PARTNERS)],
        "countries": [{"code": c, "count": n} for c, n in countries.most_common(TOP_PARTNERS)],
    }
