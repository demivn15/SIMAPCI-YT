/**
 * Métricas por profesor - HU09 (CA25). Tabla ordenable por cada columna; sin posiciones de
 * ranking ni puntaje compuesto (propuesta a validar con el decano).
 * La usa el directorio de Docentes: cada nombre enlaza a la ficha del profesor y el orden se
 * puede controlar desde fuera (selector «Ordenar por»).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { displayName, formatNumber, researchLineColor, shortResearchLine } from '../../utils/metricsFormat';
import { formatPrecise } from '../../utils/networkFormat';

const COLUMNS = [
  { key: 'full_name', label: 'Profesor', numeric: false },
  { key: 'department', label: 'Departamento', numeric: false },
  { key: 'products', label: 'Obras', numeric: true },
  { key: 'citations', label: 'Citas', numeric: true },
  { key: 'h_index', label: 'Índice h', numeric: true },
  { key: 'Q1', label: 'Q1', numeric: true },
  { key: 'Q2', label: 'Q2', numeric: true },
  { key: 'Q3', label: 'Q3', numeric: true },
  { key: 'Q4', label: 'Q4', numeric: true },
  { key: 'betweenness', label: 'Intermediación', numeric: true },
  { key: 'last_year', label: 'Periodo', numeric: true },
];

const DEFAULT_PROFESSOR_SORT = Object.freeze({ key: 'products', direction: 'desc' });

function sortProfessors(professors, sort) {
  return [...professors].sort((a, b) => {
    const left = a[sort.key] ?? (typeof b[sort.key] === 'string' ? '' : -1);
    const right = b[sort.key] ?? (typeof a[sort.key] === 'string' ? '' : -1);
    const order =
      typeof left === 'string' ? displayName(left).localeCompare(displayName(right), 'es') : left - right;
    return sort.direction === 'asc' ? order : -order;
  });
}

export default function ProfessorsTable({ professors, sort: controlledSort, onSortChange, caption }) {
  const [localSort, setLocalSort] = useState(DEFAULT_PROFESSOR_SORT);
  const sort = controlledSort ?? localSort;
  const setSort = onSortChange ?? setLocalSort;
  const hasNetwork = professors.some((row) => row.betweenness !== undefined);
  const columns = COLUMNS.filter(
    (column) => hasNetwork || (column.key !== 'department' && column.key !== 'betweenness'),
  );

  const rows = useMemo(() => sortProfessors(professors, sort), [professors, sort]);

  const toggle = (column) =>
    setSort(
      sort.key === column.key
        ? { key: column.key, direction: sort.direction === 'asc' ? 'desc' : 'asc' }
        : { key: column.key, direction: column.numeric ? 'desc' : 'asc' },
    );

  return (
    <section className="metrics-section" aria-labelledby="metrics-professors-title">
      <div className="metrics-section-head">
        <div>
          <h2 id="metrics-professors-title">Producción por profesor</h2>
          <p>
            {caption ??
              'Una obra en coautoría cuenta para cada profesor que la firma. El índice h se calcula con las citas conocidas.'}
          </p>
        </div>
      </div>
      <div className="metrics-table-wrap">
        <table className="metrics-table">
          <thead>
            <tr>
              {columns.map((column) => {
                const active = sort.key === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={column.numeric ? 'is-numeric' : undefined}
                    aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button type="button" onClick={() => toggle(column)}>
                      {column.label}
                      {active &&
                        (sort.direction === 'asc' ? (
                          <ArrowUp size={14} aria-hidden="true" />
                        ) : (
                          <ArrowDown size={14} aria-hidden="true" />
                        ))}
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
                  <Link to={`/docentes/${row.id}`} className="metrics-professor network-person-link">
                    {displayName(row.full_name)}
                  </Link>
                  <span className="metrics-professor-line">
                    <span
                      className="metrics-swatch is-round"
                      style={{ background: researchLineColor(row.main_research_line) }}
                      aria-hidden="true"
                    />
                    {shortResearchLine(row.main_research_line)}
                  </span>
                </th>
                {hasNetwork && <td>{row.department ?? '—'}</td>}
                <td className="is-numeric">{formatNumber(row.products)}</td>
                <td className="is-numeric">{formatNumber(row.citations)}</td>
                <td className="is-numeric is-strong">{formatNumber(row.h_index)}</td>
                <td className="is-numeric">{formatNumber(row.Q1)}</td>
                <td className="is-numeric">{formatNumber(row.Q2)}</td>
                <td className="is-numeric">{formatNumber(row.Q3)}</td>
                <td className="is-numeric">{formatNumber(row.Q4)}</td>
                {hasNetwork && <td className="is-numeric">{formatPrecise(row.betweenness)}</td>}
                <td className="is-numeric metrics-period">
                  {row.first_year === row.last_year ? row.first_year : `${row.first_year}–${row.last_year}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
