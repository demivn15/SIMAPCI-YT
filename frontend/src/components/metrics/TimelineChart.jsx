/**
 * Evolución anual de la producción, apilada por cuartil SJR - HU10 (CA28).
 * Por defecto muestra desde 2010; el resto de la serie queda a un clic.
 */
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { QUARTILE_SERIES, formatNumber } from '../../utils/metricsFormat';

const RECENT_FROM = 2010;

function TimelineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, item) => sum + (item.value || 0), 0);
  return (
    <div className="metrics-tooltip">
      <strong>
        {label}: {formatNumber(total)} {total === 1 ? 'publicación' : 'publicaciones'}
      </strong>
      <ul>
        {[...payload].reverse().map((item) =>
          item.value ? (
            <li key={item.dataKey}>
              <span className="metrics-swatch" style={{ background: item.color }} aria-hidden="true" />
              {item.name}: {formatNumber(item.value)}
            </li>
          ) : null,
        )}
      </ul>
    </div>
  );
}

export default function TimelineChart({ timeline }) {
  const [showAll, setShowAll] = useState(false);
  const data = useMemo(
    () => (showAll ? timeline : timeline.filter((point) => point.year >= RECENT_FROM)),
    [timeline, showAll],
  );
  const hasOlder = timeline.some((point) => point.year < RECENT_FROM);

  return (
    <section className="metrics-section" aria-labelledby="metrics-timeline-title">
      <div className="metrics-section-head">
        <div>
          <h2 id="metrics-timeline-title">Publicaciones por año</h2>
          <p>Cada barra se divide según el cuartil SJR de la revista o congreso donde se publicó.</p>
        </div>
        {hasOlder && (
          <div className="metrics-toggle" role="group" aria-label="Periodo del gráfico">
            <button type="button" aria-pressed={!showAll} onClick={() => setShowAll(false)}>
              Desde {RECENT_FROM}
            </button>
            <button type="button" aria-pressed={showAll} onClick={() => setShowAll(true)}>
              Toda la serie
            </button>
          </div>
        )}
      </div>
      <div className="metrics-chart metrics-chart-tall">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="#e5e1dc" vertical={false} />
            <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: '#cfc9c2' }} tick={{ fill: '#64615e', fontSize: 13 }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#64615e', fontSize: 13 }} />
            <Tooltip content={<TimelineTooltip />} cursor={{ fill: 'rgba(130, 48, 42, 0.06)' }} />
            <Legend
              iconType="square"
              wrapperStyle={{ fontSize: 14, paddingTop: 8 }}
              formatter={(value) => <span className="metrics-legend-text">{value}</span>}
            />
            {QUARTILE_SERIES.map((series) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                name={series.label}
                stackId="year"
                fill={series.color}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
