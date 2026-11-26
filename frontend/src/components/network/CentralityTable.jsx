/**
 * Tabla ordenable de centralidades por profesor (Colaboraciones › Coautoría interna).
 * Cada encabezado explica en su título qué mide la columna (ver utils/networkFormat.js).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { displayName, formatNumber } from '../../utils/metricsFormat';
import { CENTRALITY_INFO, formatPrecise } from '../../utils/networkFormat';

const COLUMNS = [
  { key: 'full_name', label: 'Profesor', numeric: false },
  { key: 'department', label: 'Departamento', numeric: false },
  { key: 'degree', label: 'Grado', numeric: true, format: formatNumber },
  { key: 'strength', label: 'Fuerza', numeric: true, format: formatNumber },
  { key: 'betweenness', label: 'Intermediación', numeric: true, format: formatPrecise },
  { key: 'betweenness_weighted', label: 'Interm. ponderada', numeric: true, format: formatPrecise },
  { key: 'closeness', label: 'Cercanía', numeric: true, format: formatPrecise },
  { key: 'eigenvector', label: 'Vector propio', numeric: true, format: formatPrecise },
  { key: 'clustering', label: 'Agrupamiento', numeric: true, format: formatPrecise },
  { key: 'community', label: 'Comunidad', numeric: true, format: (value) => formatNumber(value + 1) },
];

function compare(a, b, key) {
  const left = a[key];
  const right = b[key];
  if (left === null || left === undefined) return right === null || right === undefined ? 0 : -1;
  if (right === null || right === undefined) return 1;
  if (typeof left === 'string') return displayName(left).localeCompare(displayName(right), 'es');
  return left - right;
}

export default function CentralityTable({ professors }) {
  const [sort, setSort] = useState({ key: 'betweenness', direction: 'desc' });
  const rows = useMemo(() => {
    const sorted = [...professors].sort((a, b) => compare(a, b, sort.key));
    return sort.direction === 'asc' ? sorted : sorted.reverse();
  }, [professors, sort]);

  const toggle = (column) =>
    setSort((current) =>
      current.key === column.key
        ? { key: column.key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key: column.key, direction: column.numeric ? 'desc' : 'asc' },
    );

  return (
    <div className="metrics-table-wrap">
      <table className="metrics-table network-table">
        <caption className="network-sr-only">Centralidades por profesor; pulse un encabezado para ordenar.</caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => {
              const active = sort.key === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={column.numeric ? 'is-numeric' : undefined}
                  aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  title={CENTRALITY_INFO[column.key]?.short}
                >
                  <button type="button" onClick={() => toggle(column)}>
                    {column.label}
                    {active &&
                      (sort.direction === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />)}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">
                <Link to={`/docentes/${row.id}`} className="network-person-link">
                  {displayName(row.full_name)}
                </Link>
              </th>
              <td>{row.department ?? '—'}</td>
              {COLUMNS.slice(2).map((column) => (
                <td key={column.key} className="is-numeric">
                  {column.format(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
