/**
 * Comparar docentes: de 2 a 4 profesores lado a lado, con los filtros comunes del análisis.
 * La selección vive en la URL (`?ids=a,b`), así la comparación se puede compartir.
 * - Tabla de métricas y centralidades.
 * - Barras agrupadas (obras, índice h y cuartiles; las citas en un gráfico aparte, por escala).
 * - Evolución anual superpuesta (una línea por profesor).
 * - Coautores en común dentro de la Escuela.
 */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AnalysisFilters from '../components/analysis/AnalysisFilters';
import { ErrorState, LoadingState } from '../components/analysis/QueryState';
import useAnalysisFilters from '../hooks/useAnalysisFilters';
import { getNetworkMetrics, getProfessorMetrics, getProfessorProfile } from '../services/metricsService';
import { displayName, formatNumber, shortName } from '../utils/metricsFormat';
import { CENTRALITY_INFO, formatPrecise } from '../utils/networkFormat';
import { readCompareIds, writeCompareIds, MAX_COMPARE } from '../utils/compareSelection';

const SERIES_COLORS = ['#82302a', '#2f5d7c', '#b07a1c', '#5b7a3a'];

const plain = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const ROWS = [
  { key: 'department', label: 'Departamento', format: (v) => v ?? '—' },
  { key: 'products', label: 'Obras', format: formatNumber },
  { key: 'citations', label: 'Citas (conocidas)', format: formatNumber },
  { key: 'h_index', label: 'Índice h', format: formatNumber },
  { key: 'Q1', label: 'Q1', format: formatNumber },
  { key: 'Q2', label: 'Q2', format: formatNumber },
  { key: 'Q3', label: 'Q3', format: formatNumber },
  { key: 'Q4', label: 'Q4', format: formatNumber },
  { key: 'period', label: 'Periodo', format: (v) => v },
  { key: 'degree', label: CENTRALITY_INFO.degree.label, format: formatNumber },
  { key: 'strength', label: CENTRALITY_INFO.strength.label, format: formatNumber },
  { key: 'betweenness', label: CENTRALITY_INFO.betweenness.label, format: formatPrecise },
  { key: 'closeness', label: CENTRALITY_INFO.closeness.label, format: formatPrecise },
  { key: 'eigenvector', label: CENTRALITY_INFO.eigenvector.label, format: formatPrecise },
  { key: 'clustering', label: CENTRALITY_INFO.clustering.label, format: formatPrecise },
  { key: 'community', label: CENTRALITY_INFO.community.label, format: (v) => (v === undefined || v === null ? '—' : v + 1) },
];

function ProfessorPicker({ professors, selected, onAdd, onRemove }) {
  const [query, setQuery] = useState('');
  const chosen = new Set(selected);
  const needle = plain(query).trim();
  const matches = needle
    ? professors.filter((p) => !chosen.has(p.id) && plain(displayName(p.full_name)).includes(needle)).slice(0, 8)
    : [];
  const full = selected.length >= MAX_COMPARE;
  const byId = new Map(professors.map((p) => [p.id, p]));

  return (
    <section className="analysis-picker" aria-labelledby="compare-picker-title">
      <h2 id="compare-picker-title" className="analysis-filters-title">
        Profesores a comparar ({selected.length} de {MAX_COMPARE})
      </h2>
      <ul className="analysis-chips">
        {selected.map((id, index) => (
          <li key={id} style={{ borderColor: SERIES_COLORS[index] }}>
            <span className="metrics-swatch is-round" style={{ background: SERIES_COLORS[index] }} aria-hidden="true" />
            {byId.get(id) ? displayName(byId.get(id).full_name) : 'Profesor sin obras con estos filtros'}
            <button type="button" aria-label={`Quitar a ${byId.get(id) ? displayName(byId.get(id).full_name) : 'este profesor'}`} onClick={() => onRemove(id)}>
              <X size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <label className="analysis-search">
        <span className="network-sr-only">Buscar profesor para agregar</span>
        <input
          type="search"
          className="field-input"
          placeholder={full ? `Máximo ${MAX_COMPARE} profesores` : 'Buscar profesor por nombre para agregar'}
          value={query}
          disabled={full}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {matches.length > 0 && (
        <ul className="analysis-matches" aria-label="Resultados de la búsqueda">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onAdd(p.id);
                  setQuery('');
                }}
              >
                <Plus size={16} aria-hidden="true" />
                {displayName(p.full_name)}
                <small>{p.department ?? ''}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {needle && matches.length === 0 && !full && <p className="metrics-muted">Ningún profesor coincide con «{query}».</p>}
    </section>
  );
}

export default function ComparePage() {
  const { filters, apiParams, setFilters, resetFilters, options } = useAnalysisFilters();
  const [searchParams, setSearchParams] = useSearchParams();
  const ids = readCompareIds(searchParams);
  const setIds = (next) => setSearchParams((current) => writeCompareIds(current, next), { replace: true });

  const professorsQuery = useQuery({
    queryKey: ['metrics', 'professors', apiParams],
    queryFn: () => getProfessorMetrics(apiParams),
  });
  const networkQuery = useQuery({
    queryKey: ['metrics', 'networks', 'network', apiParams],
    queryFn: () => getNetworkMetrics(apiParams),
    enabled: ids.length >= 2,
  });
  const profileQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['metrics', 'professor', id, apiParams],
      queryFn: () => getProfessorProfile(id, apiParams),
      enabled: ids.length >= 2,
      retry: (count, error) => error?.response?.status !== 404 && count < 2,
    })),
  });

  const professors = useMemo(() => professorsQuery.data ?? [], [professorsQuery.data]);
  const metricsById = useMemo(() => new Map(professors.map((p) => [p.id, p])), [professors]);
  const networkById = useMemo(
    () => new Map((networkQuery.data?.professors ?? []).map((p) => [p.id, p])),
    [networkQuery.data],
  );
  const selected = ids
    .map((id, index) => ({ id, color: SERIES_COLORS[index], metrics: metricsById.get(id), network: networkById.get(id) }))
    .filter((item) => item.metrics);
  const missing = ids.filter((id) => professorsQuery.data && !metricsById.has(id));

  const ready = ids.length >= 2 && selected.length >= 2;
  const profilesLoading = profileQueries.some((q) => q.isPending);
  const profiles = profileQueries.map((q) => q.data).filter(Boolean);

  const groupedBars = ['products', 'h_index', 'Q1', 'Q2', 'Q3', 'Q4'].map((key) => {
    const row = { metric: { products: 'Obras', h_index: 'Índice h' }[key] ?? key };
    for (const item of selected) row[item.id] = item.metrics[key];
    return row;
  });
  const citationBars = [{ metric: 'Citas', ...Object.fromEntries(selected.map((s) => [s.id, s.metrics.citations])) }];

  const years = [...new Set(profiles.flatMap((p) => p.timeline.map((t) => t.year)))].sort((a, b) => a - b);
  const evolution = years.map((year) => {
    const row = { year };
    for (const profile of profiles) row[profile.id] = profile.timeline.find((t) => t.year === year)?.total ?? 0;
    return row;
  });

  const chosen = new Set(ids);
  const [firstProfile, ...otherProfiles] = profiles;
  const commonCoauthors =
    profiles.length < 2
      ? []
      : firstProfile.coauthors
          .filter((c) => !chosen.has(c.id) && otherProfiles.every((p) => p.coauthors.some((o) => o.id === c.id)))
          .map((c) => ({ ...c, weights: profiles.map((p) => p.coauthors.find((o) => o.id === c.id).weight) }));
  const directLinks = profiles.flatMap((p) =>
    p.coauthors.filter((c) => ids.includes(c.id) && p.id < c.id).map((c) => ({ a: p.id, b: c.id, weight: c.weight })),
  );

  const nameOf = (id) => displayName(metricsById.get(id)?.full_name ?? '');
  const valueOf = (item, key) => {
    if (key === 'period') {
      const m = item.metrics;
      return m.first_year === m.last_year ? `${m.first_year}` : `${m.first_year}–${m.last_year}`;
    }
    if (key in item.metrics) return item.metrics[key];
    return item.network?.[key];
  };

  return (
    <>
      <header className="catalog-intro metrics-intro">
        <h1 className="display">Comparar docentes</h1>
        <p>Elija de 2 a {MAX_COMPARE} profesores para ver sus indicadores y su posición en la red lado a lado.</p>
      </header>

      <AnalysisFilters filters={filters} options={options} onChange={setFilters} onReset={resetFilters} />

      {professorsQuery.isPending && <LoadingState>Cargando profesores…</LoadingState>}
      {professorsQuery.isError && <ErrorState queries={[professorsQuery]} />}

      {professorsQuery.data && (
        <ProfessorPicker
          professors={professors}
          selected={ids}
          onAdd={(id) => setIds([...ids, id])}
          onRemove={(id) => setIds(ids.filter((item) => item !== id))}
        />
      )}

      {missing.length > 0 && (
        <p className="notice notice-info">
          {missing.length === 1 ? 'Un profesor elegido no tiene' : `${missing.length} profesores elegidos no tienen`} obras
          verificadas con los filtros actuales y no se muestra en la comparación.
        </p>
      )}

      {professorsQuery.data && !ready && (
        <p className="metrics-empty">Agregue al menos dos profesores para comparar.</p>
      )}

      {professorsQuery.data && ready && (
        <div className="metrics-body">
          <section className="metrics-section" aria-labelledby="compare-table-title">
            <div className="metrics-section-head">
              <div>
                <h2 id="compare-table-title">Indicadores lado a lado</h2>
                <p>Las centralidades se calculan en la red de coautoría de la Escuela con los mismos filtros.</p>
              </div>
            </div>
            <div className="metrics-table-wrap">
              <table className="metrics-table analysis-compare-table">
                <thead>
                  <tr>
                    <th scope="col">Indicador</th>
                    {selected.map((item) => (
                      <th key={item.id} scope="col" className="is-numeric">
                        <Link to={`/docentes/${item.id}`} className="network-person-link" style={{ borderColor: item.color }}>
                          {shortName(item.metrics.full_name)}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr key={row.key}>
                      <th scope="row">{row.label}</th>
                      {selected.map((item) => (
                        <td key={item.id} className="is-numeric">
                          {row.format(valueOf(item, row.key))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="metrics-columns analysis-compare-charts">
            <section className="metrics-section" aria-labelledby="compare-bars-title">
              <div className="metrics-section-head">
                <div>
                  <h2 id="compare-bars-title">Obras, índice h y cuartiles</h2>
                </div>
              </div>
              <div className="metrics-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupedBars} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                    <CartesianGrid stroke="#e5e1dc" vertical={false} />
                    <XAxis dataKey="metric" tickLine={false} tick={{ fill: '#64615e', fontSize: 13 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#64615e', fontSize: 13 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    {selected.map((item) => (
                      <Bar key={item.id} dataKey={item.id} name={shortName(item.metrics.full_name)} fill={item.color} isAnimationActive={false} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="metrics-section" aria-labelledby="compare-citations-title">
              <div className="metrics-section-head">
                <div>
                  <h2 id="compare-citations-title">Citas conocidas</h2>
                  <p>Aparte, porque su escala es mucho mayor.</p>
                </div>
              </div>
              <div className="metrics-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={citationBars} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="#e5e1dc" vertical={false} />
                    <XAxis dataKey="metric" tickLine={false} tick={{ fill: '#64615e', fontSize: 13 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#64615e', fontSize: 13 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    {selected.map((item) => (
                      <Bar key={item.id} dataKey={item.id} name={shortName(item.metrics.full_name)} fill={item.color} isAnimationActive={false} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="metrics-section" aria-labelledby="compare-evolution-title">
            <div className="metrics-section-head">
              <div>
                <h2 id="compare-evolution-title">Obras por año</h2>
                <p>Una línea por profesor.</p>
              </div>
            </div>
            {profilesLoading ? (
              <LoadingState>Cargando la evolución…</LoadingState>
            ) : (
              <div className="metrics-chart metrics-chart-tall">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolution} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                    <CartesianGrid stroke="#e5e1dc" vertical={false} />
                    <XAxis dataKey="year" tickLine={false} tick={{ fill: '#64615e', fontSize: 13 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#64615e', fontSize: 13 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    {selected.map((item) => (
                      <Line
                        key={item.id}
                        type="monotone"
                        dataKey={item.id}
                        name={shortName(item.metrics.full_name)}
                        stroke={item.color}
                        strokeWidth={2.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="metrics-section" aria-labelledby="compare-common-title">
            <div className="metrics-section-head">
              <div>
                <h2 id="compare-common-title">Coautores en común</h2>
                <p>Profesores de la Escuela que han publicado con todos los elegidos.</p>
              </div>
            </div>
            {directLinks.length > 0 && (
              <p>
                {directLinks
                  .map((link) => `${nameOf(link.a)} y ${nameOf(link.b)} han publicado juntos ${link.weight} ${link.weight === 1 ? 'vez' : 'veces'}`)
                  .join('. ')}
                .
              </p>
            )}
            {profilesLoading ? null : commonCoauthors.length === 0 ? (
              <p className="metrics-empty">No tienen coautores en común dentro de la Escuela.</p>
            ) : (
              <ol className="metrics-pairs">
                {commonCoauthors.map((c) => (
                  <li key={c.id}>
                    <Link to={`/docentes/${c.id}`} className="network-person-link">
                      {displayName(c.full_name)}
                    </Link>
                    <span className="metrics-bar-value">{c.weights.join(' · ')}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </>
  );
}
