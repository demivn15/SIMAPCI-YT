/**
 * Colaboración externa: países e instituciones con los que más publica la Escuela.
 * Ecuador y Yachay Tech se excluyen en el backend: aquí solo aparece la colaboración externa.
 */
import { countryName, formatNumber } from '../../utils/metricsFormat';

export default function ExternalCollaboration({ countries, institutions }) {
  const maxCountry = Math.max(1, ...countries.map((item) => item.count));
  return (
    <section className="metrics-section" aria-labelledby="metrics-external-title">
      <div className="metrics-section-head">
        <div>
          <h2 id="metrics-external-title">Colaboración externa</h2>
          <p>Obras firmadas junto a autores de otros países e instituciones.</p>
        </div>
      </div>
      {countries.length === 0 ? (
        <p className="metrics-empty">Todavía no hay obras con coautores de otros países.</p>
      ) : (
        <div className="metrics-external">
          <div>
            <h3>Países</h3>
            <ul className="metrics-bars metrics-bars-compact">
              {countries.slice(0, 8).map((item) => (
                <li key={item.code}>
                  <span className="metrics-bar-label">{countryName(item.code)}</span>
                  <span className="metrics-bar-track" aria-hidden="true">
                    <span className="metrics-bar-fill" style={{ width: `${(item.count / maxCountry) * 100}%` }} />
                  </span>
                  <span className="metrics-bar-value">{formatNumber(item.count)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Instituciones</h3>
            <ol className="metrics-institutions">
              {institutions.slice(0, 8).map((item) => (
                <li key={item.name}>
                  <span>{item.name}</span>
                  <span className="metrics-bar-value">{formatNumber(item.count)}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
