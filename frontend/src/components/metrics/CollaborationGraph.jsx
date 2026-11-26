/**
 * Red de coautoría entre los profesores de la Escuela.
 * Nodo = profesor (tamaño según sus obras, color según su línea predominante).
 * Arista = obras firmadas juntos (grosor según cuántas).
 *
 * El diseño se calcula una sola vez con d3-force y se dibuja en SVG: así el grafo es estable
 * (no «baila» al cargar) y cada nodo es un elemento enfocable con nombre accesible.
 */
import { useMemo, useState } from 'react';
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';
import {
  displayName,
  formatNumber,
  researchLineColor,
  shortResearchLine,
  shortName,
} from '../../utils/metricsFormat';

const WIDTH = 860;
const HEIGHT = 560;
const PADDING = 48;

const radius = (node) => 6 + Math.sqrt(node.products) * 2.3;
const strokeWidth = (edge) => Math.min(1 + edge.weight * 0.7, 8);

function useLayout(nodes, edges) {
  return useMemo(() => {
    const simNodes = nodes.map((node) => ({ ...node }));
    const simLinks = edges.map((edge) => ({ ...edge }));
    forceSimulation(simNodes)
      .force('link', forceLink(simLinks).id((d) => d.id).distance(110).strength(0.5))
      .force('charge', forceManyBody().strength(-320))
      .force('collide', forceCollide((d) => radius(d) + 16))
      .force('x', forceX(WIDTH / 2).strength(0.07))
      .force('y', forceY(HEIGHT / 2).strength(0.1))
      .stop()
      .tick(400);

    // Encaja el resultado en el lienzo, conservando la proporción.
    const xs = simNodes.map((d) => d.x);
    const ys = simNodes.map((d) => d.y);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const scale = Math.min(
      (WIDTH - 2 * PADDING) / Math.max(maxX - minX, 1),
      (HEIGHT - 2 * PADDING) / Math.max(maxY - minY, 1),
      1.6,
    );
    const offsetX = (WIDTH - (maxX - minX) * scale) / 2;
    const offsetY = (HEIGHT - (maxY - minY) * scale) / 2;
    const positioned = new Map(
      simNodes.map((d) => [d.id, { ...d, x: offsetX + (d.x - minX) * scale, y: offsetY + (d.y - minY) * scale }]),
    );
    return { nodes: [...positioned.values()], positions: positioned };
  }, [nodes, edges]);
}

export default function CollaborationGraph({ nodes, edges }) {
  const { nodes: placed, positions } = useLayout(nodes, edges);
  const [selectedId, setSelectedId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const activeId = hoverId ?? selectedId;

  const neighbors = useMemo(() => {
    const map = new Map(nodes.map((node) => [node.id, []]));
    for (const edge of edges) {
      map.get(edge.source)?.push({ id: edge.target, weight: edge.weight });
      map.get(edge.target)?.push({ id: edge.source, weight: edge.weight });
    }
    for (const list of map.values()) list.sort((a, b) => b.weight - a.weight);
    return map;
  }, [nodes, edges]);

  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const lines = useMemo(() => [...new Set(nodes.map((node) => node.main_research_line))], [nodes]);
  const active = activeId ? byId.get(activeId) : null;
  const activeNeighbors = new Set((neighbors.get(activeId) ?? []).map((item) => item.id));
  const isolated = nodes.filter((node) => (neighbors.get(node.id) ?? []).length === 0).length;

  if (nodes.length === 0) {
    return <p className="metrics-empty">Todavía no hay obras verificadas para dibujar la red.</p>;
  }

  return (
    <div className="metrics-graph">
      <figure className="metrics-graph-figure">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="group"
          aria-label="Red de coautoría entre profesores de la Escuela"
          onMouseLeave={() => setHoverId(null)}
        >
          <g className="metrics-graph-edges">
            {edges.map((edge) => {
              const a = positions.get(edge.source);
              const b = positions.get(edge.target);
              if (!a || !b) return null;
              const touchesActive = activeId && (edge.source === activeId || edge.target === activeId);
              return (
                <line
                  key={`${edge.source}-${edge.target}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  strokeWidth={strokeWidth(edge)}
                  className={activeId ? (touchesActive ? 'is-active' : 'is-dim') : undefined}
                />
              );
            })}
          </g>
          <g>
            {placed.map((node) => {
              const r = radius(node);
              const state = !activeId
                ? ''
                : node.id === activeId
                  ? 'is-active'
                  : activeNeighbors.has(node.id)
                    ? 'is-neighbor'
                    : 'is-dim';
              return (
                <g
                  key={node.id}
                  className={`metrics-graph-node ${state}`}
                  transform={`translate(${node.x} ${node.y})`}
                  tabIndex={0}
                  role="button"
                  aria-pressed={selectedId === node.id}
                  aria-label={`${displayName(node.full_name)}: ${node.products} obras, ${
                    (neighbors.get(node.id) ?? []).length
                  } coautores en la Escuela`}
                  onMouseEnter={() => setHoverId(node.id)}
                  onFocus={() => setHoverId(node.id)}
                  onBlur={() => setHoverId(null)}
                  onClick={() => setSelectedId((current) => (current === node.id ? null : node.id))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedId((current) => (current === node.id ? null : node.id));
                    }
                  }}
                >
                  <circle r={r} fill={researchLineColor(node.main_research_line)} />
                  <text y={r + 15} textAnchor="middle">
                    {shortName(node.full_name)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        <figcaption>
          <ul className="metrics-legend">
            {lines.map((line) => (
              <li key={line}>
                <span className="metrics-swatch is-round" style={{ background: researchLineColor(line) }} aria-hidden="true" />
                {shortResearchLine(line)}
              </li>
            ))}
          </ul>
          <span>Tamaño del círculo: número de obras. Grosor de la línea: obras en coautoría.</span>
        </figcaption>
      </figure>

      <aside className="metrics-graph-panel" aria-live="polite">
        {active ? (
          <>
            <h3>{displayName(active.full_name)}</h3>
            <p>
              {formatNumber(active.products)} obras · línea predominante: {shortResearchLine(active.main_research_line)}
            </p>
            {(neighbors.get(active.id) ?? []).length === 0 ? (
              <p className="metrics-muted">Sin coautorías registradas con otros profesores de la Escuela.</p>
            ) : (
              <>
                <h4>Coautores en la Escuela</h4>
                <ol className="metrics-pairs">
                  {neighbors.get(active.id).map((item) => (
                    <li key={item.id}>
                      <span>{displayName(byId.get(item.id).full_name)}</span>
                      <span className="metrics-bar-value">{formatNumber(item.weight)}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </>
        ) : (
          <>
            <h3>Colaboraciones más frecuentes</h3>
            <ol className="metrics-pairs">
              {edges.slice(0, 6).map((edge) => (
                <li key={`${edge.source}-${edge.target}`}>
                  <span>
                    {shortName(byId.get(edge.source).full_name)} y {shortName(byId.get(edge.target).full_name)}
                  </span>
                  <span className="metrics-bar-value">{formatNumber(edge.weight)}</span>
                </li>
              ))}
            </ol>
            <p className="metrics-muted">
              {formatNumber(edges.length)} parejas de profesores han publicado juntas
              {isolated > 0 ? `; ${isolated} profesores aún no tienen coautorías dentro de la Escuela` : ''}.
              Selecciona un círculo para ver con quién publica cada profesor.
            </p>
          </>
        )}
      </aside>
    </div>
  );
}
