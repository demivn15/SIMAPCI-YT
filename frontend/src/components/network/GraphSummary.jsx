/**
 * Métricas de un grafo completo (densidad, componentes, modularidad…), como lista de
 * definiciones: cada cifra con su nombre y una pista de cómo leerla.
 */
import { formatNumber } from '../../utils/metricsFormat';
import { formatDecimal, formatPrecise } from '../../utils/networkFormat';

export default function GraphSummary({ summary, compact = false }) {
  const items = [
    { label: 'Profesores', value: formatNumber(summary.nodes) },
    { label: 'Parejas que publican juntas', value: formatNumber(summary.edges) },
    { label: 'Densidad', value: formatPrecise(summary.density), note: 'parejas posibles que sí publican juntas' },
    { label: 'Componentes', value: formatNumber(summary.components), note: `la mayor reúne ${formatNumber(summary.largest_component)}` },
    { label: 'Agrupamiento promedio', value: formatDecimal(summary.average_clustering) },
    { label: 'Comunidades', value: formatNumber(summary.communities), note: 'incluye profesores sin coautorías' },
    { label: 'Modularidad', value: formatDecimal(summary.modularity), note: 'sobre 0,3: grupos marcados' },
  ];
  const shown = compact ? items.filter((item) => ['Profesores', 'Parejas que publican juntas', 'Densidad', 'Componentes', 'Modularidad'].includes(item.label)) : items;
  return (
    <dl className={`network-summary${compact ? ' is-compact' : ''}`}>
      {shown.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>
            <span className="network-summary-value">{item.value}</span>
            {item.note && !compact && <span className="network-summary-note">{item.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
