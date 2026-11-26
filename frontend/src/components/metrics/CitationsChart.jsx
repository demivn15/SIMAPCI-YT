/**
 * Citas por año de publicación (Inicio). Suma solo las citas conocidas: una obra con citas
 * desconocidas no suma 0, se cuenta aparte en la ayuda emergente.
 * Las obras recientes tienen menos citas porque han tenido menos tiempo de ser citadas.
 */
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatNumber } from '../../utils/metricsFormat';

function CitationsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="metrics-tooltip">
      <strong>
        {label}: {formatNumber(point.citations)} citas
      </strong>
      <ul>
        <li>
          de {formatNumber(point.products_with_citations)} de {formatNumber(point.total)} obras con citas conocidas
        </li>
      </ul>
    </div>
  );
}

export default function CitationsChart({ timeline }) {
  const data = timeline.filter((point) => point.total > 0);
  return (
    <section className="metrics-section" aria-labelledby="metrics-citations-title">
      <div className="metrics-section-head">
        <div>
          <h2 id="metrics-citations-title">Citas por año de publicación</h2>
          <p>
            Citas que han recibido las obras publicadas cada año. Solo suman las citas conocidas; las obras
            recientes aún no han tenido tiempo de ser citadas.
          </p>
        </div>
      </div>
      {data.length === 0 ? (
        <p className="metrics-empty">No hay obras con los filtros elegidos.</p>
      ) : (
        <div className="metrics-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
              <CartesianGrid stroke="#e5e1dc" vertical={false} />
              <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: '#cfc9c2' }} tick={{ fill: '#64615e', fontSize: 13 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#64615e', fontSize: 13 }} />
              <Tooltip content={<CitationsTooltip />} cursor={{ fill: 'rgba(130, 48, 42, 0.06)' }} />
              <Bar dataKey="citations" name="Citas" fill="#82302a" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
