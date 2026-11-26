/**
 * Docentes: directorio de los profesores con producción verificada - HU09 (CA25, CA27).
 * Buscador por nombre, filtros comunes del análisis (incluye departamento) y orden por obras,
 * citas, índice h o intermediación. Cada profesor enlaza a su ficha (/docentes/:id).
 * El texto buscado y el orden viven en la URL (`q`, `orden`), igual que los filtros.
 */
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import AnalysisFilters from '../components/analysis/AnalysisFilters';
import { ErrorState, LoadingState } from '../components/analysis/QueryState';
import ProfessorsTable from '../components/metrics/ProfessorsTable';
import useAnalysisFilters from '../hooks/useAnalysisFilters';
import { getProfessorMetrics } from '../services/metricsService';
import { displayName, formatNumber } from '../utils/metricsFormat';

const DIRECTORY_SORTS = [
  { value: 'products', label: 'Obras' },
  { value: 'citations', label: 'Citas' },
  { value: 'h_index', label: 'Índice h' },
  { value: 'betweenness', label: 'Intermediación' },
];

// Además de los cuatro órdenes del selector, se puede ordenar por cualquier columna de la tabla.
const TABLE_SORT_KEYS = new Set(['full_name', 'department', 'products', 'citations', 'h_index', 'Q1', 'Q2', 'Q3', 'Q4', 'betweenness', 'last_year']);

const plain = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export default function ProfessorsDirectoryPage() {
  const { filters, apiParams, setFilters, resetFilters, options } = useAnalysisFilters();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = (searchParams.get('q') || '').slice(0, 80);
  const sortKey = TABLE_SORT_KEYS.has(searchParams.get('orden')) ? searchParams.get('orden') : 'products';
  const sortInSelect = DIRECTORY_SORTS.some((option) => option.value === sortKey);
  const direction = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';

  const professorsQuery = useQuery({
    queryKey: ['metrics', 'professors', apiParams],
    queryFn: () => getProfessorMetrics(apiParams),
  });

  const rows = useMemo(() => {
    const needle = plain(query).trim();
    const all = professorsQuery.data ?? [];
    return needle ? all.filter((row) => plain(displayName(row.full_name)).includes(needle)) : all;
  }, [professorsQuery.data, query]);

  const updateParam = (changes) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );

  const onSortChange = (sort) =>
    updateParam({ orden: sort.key, dir: sort.direction === 'desc' ? '' : 'asc' });

  return (
    <>
      <header className="catalog-intro metrics-intro">
        <h1 className="display">Docentes</h1>
        <p>Profesores de la Escuela con producción verificada. Abra una ficha para ver su trayectoria y su red.</p>
      </header>

      <AnalysisFilters filters={filters} options={options} onChange={setFilters} onReset={resetFilters} />

      <div className="analysis-toolbar">
        <label className="analysis-search">
          <span className="network-sr-only">Buscar profesor por nombre</span>
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            className="field-input"
            placeholder="Buscar por nombre"
            value={query}
            onChange={(event) => updateParam({ q: event.target.value })}
          />
        </label>
        <label className="analysis-field analysis-sort">
          <span>Ordenar por</span>
          <select
            className="field-input"
            value={sortInSelect ? sortKey : ''}
            onChange={(event) => updateParam({ orden: event.target.value, dir: '' })}
          >
            {!sortInSelect && (
              <option value="" disabled>
                Columna de la tabla
              </option>
            )}
            {DIRECTORY_SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className="analysis-count" aria-live="polite">
          {professorsQuery.data ? `${formatNumber(rows.length)} de ${formatNumber(professorsQuery.data.length)} profesores` : ''}
        </p>
      </div>

      {professorsQuery.isPending && <LoadingState>Cargando profesores…</LoadingState>}
      {professorsQuery.isError && <ErrorState queries={[professorsQuery]} />}
      {professorsQuery.data && rows.length === 0 && (
        <p className="metrics-empty">Ningún profesor coincide con la búsqueda o los filtros elegidos.</p>
      )}
      {professorsQuery.data && rows.length > 0 && (
        <ProfessorsTable
          professors={rows}
          sort={{ key: sortKey, direction }}
          onSortChange={onSortChange}
          caption="Una obra en coautoría cuenta para cada profesor que la firma. El índice h se calcula con las citas conocidas; la intermediación mide cuánto sirve de puente en la red de coautoría."
        />
      )}
    </>
  );
}
