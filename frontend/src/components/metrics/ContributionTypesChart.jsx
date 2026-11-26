/**
 * Distribución de las obras por tipo de contribución (Crossref/OpenAlex), en barras
 * horizontales. Los tipos se muestran tal como llegan de la fuente: «Artículo (sin precisar)»
 * y «Artículo de revista» pueden ser lo mismo y quedan pendientes de unificar.
 */
import { formatNumber } from '../../utils/metricsFormat';
import { contributionTypeLabel } from '../../utils/analysisFilters';

const VISIBLE = 8;

export default function ContributionTypesChart({ types }) {
  const visible = types.slice(0, VISIBLE);
  const rest = types.slice(VISIBLE).reduce((sum, item) => sum + item.count, 0);
  const rows = rest > 0 ? [...visible, { contribution_type: '__rest', count: rest }] : visible;
  const max = Math.max(1, ...rows.map((item) => item.count));
  const total = types.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className="metrics-section" aria-labelledby="metrics-types-title">
      <div className="metrics-section-head">
        <div>
          <h2 id="metrics-types-title">Tipo de contribución</h2>
          <p>Según Crossref y OpenAlex. Los nombres se muestran como llegan de la fuente.</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="metrics-empty">No hay obras con los filtros elegidos.</p>
      ) : (
        <ul className="metrics-bars">
          {rows.map((item) => {
            const label = item.contribution_type === '__rest' ? 'Otros tipos' : contributionTypeLabel(item.contribution_type);
            return (
              <li key={item.contribution_type ?? 'none'}>
                <span className="metrics-bar-label" title={item.contribution_type ?? undefined}>
                  {label}
                </span>
                <span className="metrics-bar-track" aria-hidden="true">
                  <span className="metrics-bar-fill" style={{ width: `${(item.count / max) * 100}%` }} />
                </span>
                <span className="metrics-bar-value">
                  {formatNumber(item.count)}
                  <span className="network-sr-only"> de {formatNumber(total)} obras</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
