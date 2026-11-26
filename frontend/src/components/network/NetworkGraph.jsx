/**
 * Grafo de red reutilizable (coautoría, redes bipartitas, líneas, periodos y red personal).
 * Generaliza el antiguo CollaborationGraph del dashboard de métricas.
 *
 * - El diseño se calcula UNA vez con d3-force (sin animación) y se dibuja en SVG: el grafo no
 *   «baila» al cargar y cada nodo es un elemento enfocable con nombre accesible.
 * - Fuerzas: la repulsión es igual para todos los nodos (no depende del tamaño) y una fuerza
 *   radial acerca al centro a los nodos con más conexiones y aleja a los que tienen pocas o
 *   ninguna. Así un nodo grande (muchas obras) con pocas conexiones no queda en el centro
 *   aparentando ser el eje de la red.
 * - Al pasar el cursor o enfocar un nodo se resaltan sus vecinos; un clic (o Enter) lo fija.
 * - En móvil el lienzo conserva un ancho mínimo legible y se desplaza en horizontal.
 *
 * Nodo: { id, label, size, color, shape: 'circle' | 'square', description?, href? }
 * Arista: { source, target, weight }
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { forceCollide, forceLink, forceManyBody, forceRadial, forceSimulation, forceX, forceY } from 'd3-force';
import { formatNumber } from '../../utils/metricsFormat';

const PADDING = 44;
const TICKS = 360;

function radiusScale(nodes, minRadius, maxRadius) {
  const max = Math.max(1, ...nodes.map((node) => node.size || 0));
  return (node) => minRadius + Math.sqrt((node.size || 0) / max) * (maxRadius - minRadius);
}

function useLayout(nodes, edges, width, height, radius) {
  return useMemo(() => {
    const degree = new Map(nodes.map((node) => [node.id, 0]));
    for (const edge of edges) {
      degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    }
    const maxDegree = Math.max(1, ...degree.values());
    const ring = Math.min(width, height) / 2;
    const simNodes = nodes.map((node) => ({ ...node, degree: degree.get(node.id) ?? 0 }));
    const ids = new Set(simNodes.map((node) => node.id));
    const simLinks = edges
      .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
      .map((edge) => ({ ...edge }));

    // Radio objetivo: los nodos más conectados cerca del centro, los menos conectados hacia
    // fuera y los aislados en un anillo exterior.
    // El tamaño del nodo NO interviene: solo su número de conexiones.
    const share = (d) => Math.sqrt(d.degree / maxDegree);
    const target = (d) => (d.degree === 0 ? ring * 0.95 : ring * (0.85 - 0.75 * share(d)));
    // Enlaces suaves: no arrastran al centro a un nodo con una sola conexión (por grande que sea);
    // los pares que publican mucho juntos quedan algo más cerca.
    const linkStrength = (link) => 0.1 + 0.025 * Math.min(link.weight, 8);

    forceSimulation(simNodes)
      .force(
        'link',
        forceLink(simLinks)
          .id((d) => d.id)
          .distance((link) => 70 + radius(link.source) + radius(link.target))
          .strength(linkStrength),
      )
      .force('charge', forceManyBody().strength(-360).distanceMax(ring * 1.6))
      // El radio de choque deja sitio a la etiqueta bajo el círculo.
      .force('collide', forceCollide((d) => radius(d) + 18).iterations(3))
      .force(
        'radial',
        forceRadial(target, 0, 0).strength((d) => (d.degree === 0 ? 0.4 : 0.3 - 0.15 * share(d))),
      )
      .force('x', forceX(0).strength(0.02))
      .force('y', forceY(0).strength(0.03))
      .stop()
      .tick(TICKS);

    // Encaja el resultado en el lienzo. El dibujo sale casi circular y el lienzo es apaisado:
    // se permite estirar en horizontal hasta 1,5 veces para aprovechar el ancho sin deformar
    // demasiado (las distancias en una red no tienen unidades).
    const xs = simNodes.map((d) => d.x);
    const ys = simNodes.map((d) => d.y);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const scaleY = Math.min((height - 2 * PADDING) / Math.max(maxY - minY, 1), 1.4);
    const scaleX = Math.min((width - 2 * PADDING) / Math.max(maxX - minX, 1), scaleY * 1.5, 2);
    const offsetX = (width - (maxX - minX) * scaleX) / 2;
    const offsetY = (height - (maxY - minY) * scaleY) / 2;
    return new Map(
      simNodes.map((d) => [d.id, { ...d, x: offsetX + (d.x - minX) * scaleX, y: offsetY + (d.y - minY) * scaleY }]),
    );
  }, [nodes, edges, width, height, radius]);
}

function DefaultDetails({ node, neighbors, byId, neighborNoun }) {
  return (
    <>
      <h3>{node.label}</h3>
      {node.description && <p>{node.description}</p>}
      {node.href && (
        <p>
          <Link to={node.href} className="network-detail-link">
            Ver ficha
          </Link>
        </p>
      )}
      {neighbors.length === 0 ? (
        <p className="metrics-muted">Sin conexiones en esta red.</p>
      ) : (
        <>
          <h4>
            {neighbors.length} {neighborNoun}
          </h4>
          <ol className="metrics-pairs">
            {neighbors.map((item) => (
              <li key={item.id}>
                <span>{byId.get(item.id)?.label}</span>
                <span className="metrics-bar-value">{formatNumber(item.weight)}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}

export default function NetworkGraph({
  nodes,
  edges,
  title,
  legend = [],
  caption,
  width = 860,
  height = 560,
  minWidth = 640,
  minRadius = 6,
  maxRadius = 26,
  labelLimit = 40,
  neighborNoun = 'conexiones',
  emptyMessage = 'No hay datos para dibujar esta red con los filtros elegidos.',
  idleDetails = null,
  showPanel = true,
  compact = false,
}) {
  const radius = useMemo(() => radiusScale(nodes, minRadius, maxRadius), [nodes, minRadius, maxRadius]);
  const positions = useLayout(nodes, edges, width, height, radius);
  const [selectedId, setSelectedId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const activeId = hoverId ?? selectedId;

  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const neighbors = useMemo(() => {
    const map = new Map(nodes.map((node) => [node.id, []]));
    for (const edge of edges) {
      map.get(edge.source)?.push({ id: edge.target, weight: edge.weight });
      map.get(edge.target)?.push({ id: edge.source, weight: edge.weight });
    }
    for (const list of map.values()) list.sort((a, b) => b.weight - a.weight);
    return map;
  }, [nodes, edges]);

  // Etiquetas: todas si la red es pequeña; si no, solo las de los nodos más grandes (el nodo
  // activo y sus vecinos siempre muestran la suya).
  const labelled = useMemo(() => {
    if (nodes.length <= labelLimit) return new Set(nodes.map((node) => node.id));
    return new Set([...nodes].sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, labelLimit).map((n) => n.id));
  }, [nodes, labelLimit]);

  if (nodes.length === 0) {
    return <p className="metrics-empty">{emptyMessage}</p>;
  }

  const active = activeId ? byId.get(activeId) : null;
  const activeNeighbors = new Set((neighbors.get(activeId) ?? []).map((item) => item.id));
  const toggle = (id) => setSelectedId((current) => (current === id ? null : id));
  // Las aristas se dibujan de la más débil a la más fuerte, para que las fuertes queden encima.
  const sortedEdges = [...edges].sort((a, b) => a.weight - b.weight);
  const maxWeight = Math.max(1, ...edges.map((edge) => edge.weight));

  return (
    <div className={`network-graph${showPanel ? '' : ' is-bare'}${compact ? ' is-compact' : ''}`}>
      <figure className="network-figure">
        <div className="network-scroll" tabIndex={-1}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ minWidth }}
            role="group"
            aria-label={title}
            onMouseLeave={() => setHoverId(null)}
          >
            <g className="network-edges">
              {sortedEdges.map((edge) => {
                const a = positions.get(edge.source);
                const b = positions.get(edge.target);
                if (!a || !b) return null;
                const touches = activeId && (edge.source === activeId || edge.target === activeId);
                return (
                  <line
                    key={`${edge.source}|${edge.target}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    strokeWidth={1 + (5 * edge.weight) / maxWeight}
                    className={activeId ? (touches ? 'is-active' : 'is-dim') : undefined}
                  />
                );
              })}
            </g>
            <g>
              {[...positions.values()].map((node) => {
                const r = radius(node);
                const state = !activeId
                  ? ''
                  : node.id === activeId
                    ? 'is-active'
                    : activeNeighbors.has(node.id)
                      ? 'is-neighbor'
                      : 'is-dim';
                const showLabel = labelled.has(node.id) || node.id === activeId || activeNeighbors.has(node.id);
                const count = (neighbors.get(node.id) ?? []).length;
                return (
                  <g
                    key={node.id}
                    className={`network-node ${state}${node.emphasis ? ' is-emphasis' : ''}`}
                    transform={`translate(${node.x} ${node.y})`}
                    tabIndex={0}
                    role="button"
                    aria-pressed={selectedId === node.id}
                    aria-label={`${node.label}${node.description ? `, ${node.description}` : ''}, ${count} ${
                      count === 1 ? 'conexión' : 'conexiones'
                    }`}
                    onMouseEnter={() => setHoverId(node.id)}
                    onFocus={() => setHoverId(node.id)}
                    onBlur={() => setHoverId(null)}
                    onClick={() => toggle(node.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggle(node.id);
                      } else if (event.key === 'Escape') {
                        setSelectedId(null);
                      }
                    }}
                  >
                    {node.shape === 'square' ? (
                      <rect x={-r} y={-r} width={2 * r} height={2 * r} rx={3} fill={node.color} />
                    ) : (
                      <circle r={r} fill={node.color} />
                    )}
                    {showLabel && (
                      <text y={r + 14} textAnchor="middle">
                        {node.shortLabel ?? node.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
        {(legend.length > 0 || caption) && (
          <figcaption>
            {legend.length > 0 && (
              <ul className="metrics-legend">
                {legend.map((item) => (
                  <li key={item.label}>
                    <span
                      className={`metrics-swatch${item.shape === 'square' ? '' : ' is-round'}`}
                      style={{ background: item.color }}
                      aria-hidden="true"
                    />
                    {item.label}
                  </li>
                ))}
              </ul>
            )}
            {caption && <span>{caption}</span>}
          </figcaption>
        )}
      </figure>

      {showPanel && (
        <aside className="metrics-graph-panel network-panel" aria-live="polite">
          {active ? (
            <DefaultDetails
              node={active}
              neighbors={neighbors.get(active.id) ?? []}
              byId={byId}
              neighborNoun={neighborNoun}
            />
          ) : (
            idleDetails ?? <p className="metrics-muted">Selecciona un nodo para ver sus conexiones.</p>
          )}
        </aside>
      )}
    </div>
  );
}
