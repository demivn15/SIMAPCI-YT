"""
Pruebas de las métricas de red (app/services/network_service.py) con grafos de resultado
conocido: camino, estrella, grafo desconectado y comunidades deterministas.
"""

import networkx as nx
import pytest

from app.services.network_service import (
    centralities,
    community_index,
    detect_communities,
    eigenvector_by_component,
    graph_summary,
    parse_periods,
)


def _graph(edges, isolated=()):
    graph = nx.Graph()
    graph.add_nodes_from(isolated)
    for a, b, weight in edges:
        graph.add_edge(a, b, weight=weight, distance=1 / weight)
    return graph


def test_path_betweenness_is_one_in_the_middle_and_zero_at_the_ends():
    values = centralities(_graph([("A", "B", 1), ("B", "C", 1)]))
    assert values["B"]["betweenness"] == 1.0
    assert values["A"]["betweenness"] == 0.0 and values["C"]["betweenness"] == 0.0
    assert values["B"]["degree"] == 2 and values["A"]["degree"] == 1
    assert values["B"]["clustering"] == 0.0


def test_star_center_holds_every_shortest_path():
    graph = _graph([("hub", leaf, 1) for leaf in "abcd"])
    values = centralities(graph)
    assert values["hub"]["betweenness"] == 1.0
    assert all(values[leaf]["betweenness"] == 0.0 for leaf in "abcd")
    assert values["hub"]["closeness"] == 1.0
    assert values["hub"]["eigenvector"] > values["a"]["eigenvector"] > 0
    assert graph_summary(graph)["density"] == 0.4


def test_strength_and_weighted_betweenness_use_the_weights():
    # A-B con 3 obras y B-C con 1; A-C con 1. El camino corto ponderado de A a C pasa por B
    # (distancia 1/3 + 1 = 1.33) solo si es menor que la arista directa (1): no lo es.
    graph = _graph([("A", "B", 3), ("B", "C", 1), ("A", "C", 1)])
    values = centralities(graph)
    assert values["A"]["strength"] == 4 and values["B"]["strength"] == 4 and values["C"]["strength"] == 2
    assert values["B"]["betweenness_weighted"] == 0.0
    # Con un atajo muy fuerte por B, el camino ponderado A-C sí pasa por B.
    stronger = centralities(_graph([("A", "B", 5), ("B", "C", 5), ("A", "C", 1)]))
    assert stronger["B"]["betweenness_weighted"] == 1.0
    assert stronger["B"]["betweenness"] == 0.0  # sin pesos, A-C es una arista directa


def test_disconnected_graph_with_isolated_node_and_pair():
    graph = _graph([("A", "B", 1), ("B", "C", 1), ("A", "C", 1), ("D", "E", 2)], isolated=["Z"])
    eigen = eigenvector_by_component(graph)
    assert eigen["Z"] == 0.0
    assert eigen["D"] == 0.0 and eigen["E"] == 0.0  # componente de 2 nodos
    assert eigen["A"] == pytest.approx(eigen["B"]) == pytest.approx(eigen["C"])
    values = centralities(graph)
    assert values["Z"]["closeness"] == 0.0 and values["Z"]["degree"] == 0
    summary = graph_summary(graph)
    assert summary["components"] == 3
    assert summary["largest_component"] == 3
    assert summary["nodes"] == 6 and summary["edges"] == 4


def test_eigenvector_returns_none_when_it_does_not_converge(monkeypatch):
    def fail(*args, **kwargs):
        raise nx.PowerIterationFailedConvergence(1000)

    monkeypatch.setattr(nx, "eigenvector_centrality", fail)
    values = centralities(_graph([("A", "B", 1), ("B", "C", 1)], isolated=["Z"]))
    assert values["A"]["eigenvector"] is None
    assert values["Z"]["eigenvector"] == 0.0


def test_communities_are_deterministic_and_sorted_by_size():
    # Dos triángulos unidos por un puente, más un triángulo extra pegado al primero y un aislado.
    edges = [
        ("a1", "a2", 3), ("a2", "a3", 3), ("a1", "a3", 3), ("a3", "a4", 3), ("a4", "a1", 3),
        ("b1", "b2", 3), ("b2", "b3", 3), ("b1", "b3", 3),
        ("a1", "b1", 1),
    ]
    graph = _graph(edges, isolated=["solo"])
    first = detect_communities(graph)
    assert first == detect_communities(graph)  # semilla fija: mismo resultado
    assert [len(c) for c in first] == [4, 3, 1]
    index = community_index(first)
    assert index["a1"] == index["a4"] == 0
    assert index["b1"] == 1
    assert index["solo"] == 2  # un aislado es su propia comunidad
    summary = graph_summary(graph, first)
    assert summary["communities"] == 3
    assert summary["modularity"] > 0.3


def test_graph_without_edges_has_no_modularity_and_empty_graph_is_safe():
    lonely = _graph([], isolated=["A", "B"])
    assert graph_summary(lonely)["modularity"] is None
    assert [len(c) for c in detect_communities(lonely)] == [1, 1]
    empty = nx.Graph()
    assert centralities(empty) == {}
    assert graph_summary(empty) == {
        "nodes": 0, "edges": 0, "density": 0.0, "components": 0, "largest_component": 0,
        "average_clustering": 0.0, "communities": 0, "modularity": None,
    }


def test_parse_periods():
    assert parse_periods(None) == [(2014, 2018), (2019, 2022), (2023, 2026)]
    assert parse_periods("2010-2015, 2020-2016") == [(2010, 2015), (2016, 2020)]
    with pytest.raises(ValueError):
        parse_periods("2010-15")
