/**
 * Indicadores de la Escuela (HU10). Lista de definiciones: cada cifra con su nombre y, cuando
 * hace falta, cómo se calculó, para que no se lea fuera de contexto.
 */
import { formatNumber, formatShare } from '../../utils/metricsFormat';

export default function IndicatorStrip({ overview }) {
  const items = [
    { label: 'Publicaciones verificadas', value: formatNumber(overview.publications) },
    { label: 'Profesores con producción', value: formatNumber(overview.professors) },
    {
      label: 'Citas',
      value: formatNumber(overview.citations_total),
      note: `de ${formatNumber(overview.products_with_citations)} obras con citas conocidas`,
    },
    { label: 'Índice h de la Escuela', value: formatNumber(overview.h_index) },
    {
      label: 'En revistas Q1 o Q2',
      value: formatShare(overview.q1_q2_share),
      note: 'de las obras con cuartil SJR',
    },
    {
      label: 'Con coautores de otros países',
      value: formatShare(overview.international_share),
      note: 'de las obras con colaboración identificada',
    },
  ];

  return (
    <dl className="metrics-indicators">
      {items.map((item) => (
        <div key={item.label} className="metrics-indicator">
          <dt>{item.label}</dt>
          <dd>
            <span className="metrics-indicator-value">{item.value}</span>
            {item.note && <span className="metrics-indicator-note">{item.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
