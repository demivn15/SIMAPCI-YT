/**
 * Producción por línea de investigación. La línea de las obras importadas es provisional
 * (clasificación por palabras clave), y el gráfico lo dice.
 */
import { formatNumber, researchLineColor, shortResearchLine } from '../../utils/metricsFormat';

export default function ResearchLinesChart({ lines }) {
  const max = Math.max(1, ...lines.map((line) => line.count));
  return (
    <section className="metrics-section" aria-labelledby="metrics-lines-title">
      <div className="metrics-section-head">
        <div>
          <h2 id="metrics-lines-title">Líneas de investigación</h2>
          <p>Clasificación provisional de las obras importadas, pendiente de revisión.</p>
        </div>
      </div>
      <ul className="metrics-bars">
        {lines.map((line) => (
          <li key={line.research_line}>
            <span className="metrics-bar-label" title={line.research_line}>
              {shortResearchLine(line.research_line)}
            </span>
            <span className="metrics-bar-track" aria-hidden="true">
              <span
                className="metrics-bar-fill"
                style={{ width: `${(line.count / max) * 100}%`, background: researchLineColor(line.research_line) }}
              />
            </span>
            <span className="metrics-bar-value">{formatNumber(line.count)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
