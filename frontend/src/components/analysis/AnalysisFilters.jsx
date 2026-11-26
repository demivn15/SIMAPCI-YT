/**
 * Filtros comunes del análisis (Inicio, Docentes, Colaboraciones y Comparar): departamento,
 * periodo, afiliación, tipo de contribución y cuartil, más «Restablecer».
 *
 * Cada cambio se escribe en la URL al momento (no hay botón «Aplicar»): así el enlace se puede
 * compartir y el botón «Atrás» funciona. En móvil quedan plegados tras «Mostrar filtros».
 */
import { useId, useState } from 'react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import {
  AFFILIATION_OPTIONS,
  QUARTILE_OPTIONS,
  contributionTypeLabel,
  describeAnalysisFilters,
  hasActiveAnalysisFilters,
} from '../../utils/analysisFilters';
import { formatNumber } from '../../utils/metricsFormat';

function yearRange(options) {
  if (!options?.year_min || !options?.year_max) return [];
  const years = [];
  for (let year = options.year_max; year >= options.year_min; year -= 1) years.push(String(year));
  return years;
}

export default function AnalysisFilters({ filters, options, onChange, onReset, showDepartment = true }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const years = yearRange(options);
  const active = hasActiveAnalysisFilters(filters);
  const summary = describeAnalysisFilters(filters);
  const update = (key) => (event) => onChange({ ...filters, [key]: event.target.value });

  return (
    <section className={`analysis-filters${open ? ' is-open' : ''}`} aria-labelledby={`${id}-title`}>
      <div className="analysis-filters-head">
        <h2 id={`${id}-title`} className="analysis-filters-title">
          <SlidersHorizontal size={18} aria-hidden="true" />
          Filtros
        </h2>
        <button
          type="button"
          className="btn btn-outline analysis-filters-toggle"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen(!open)}
        >
          {open ? 'Ocultar filtros' : 'Mostrar filtros'}
          {active && <span className="analysis-filters-count">{summary.length}</span>}
        </button>
      </div>

      <div id={`${id}-body`} className="analysis-filters-body">
        {showDepartment && (
          <label className="analysis-field">
            <span>Departamento</span>
            <select className="field-input" value={filters.department} onChange={update('department')}>
              <option value="">Todos</option>
              {(options?.departments ?? []).map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="analysis-field analysis-field-year">
          <span>Desde</span>
          <select className="field-input" value={filters.year_from} onChange={update('year_from')}>
            <option value="">Inicio</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label className="analysis-field analysis-field-year">
          <span>Hasta</span>
          <select className="field-input" value={filters.year_to} onChange={update('year_to')}>
            <option value="">Hoy</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="analysis-field analysis-affiliation">
          <legend>Afiliación</legend>
          <div className="analysis-segmented">
            {AFFILIATION_OPTIONS.map((option) => (
              <label key={option.value || 'all'} className={filters.affiliation === option.value ? 'is-selected' : ''}>
                <input
                  type="radio"
                  name={`${id}-affiliation`}
                  value={option.value}
                  checked={filters.affiliation === option.value}
                  onChange={update('affiliation')}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="analysis-field">
          <span>Tipo de contribución</span>
          <select className="field-input" value={filters.contribution_type} onChange={update('contribution_type')}>
            <option value="">Todos</option>
            {(options?.contribution_types ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {contributionTypeLabel(option.value)} ({formatNumber(option.count)})
              </option>
            ))}
          </select>
        </label>

        <label className="analysis-field analysis-field-quartile">
          <span>Cuartil SJR</span>
          <select className="field-input" value={filters.quartile} onChange={update('quartile')}>
            <option value="">Todos</option>
            {QUARTILE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="btn btn-outline analysis-reset" onClick={onReset} disabled={!active}>
          <RotateCcw size={16} aria-hidden="true" />
          Restablecer
        </button>
      </div>

      <p className="analysis-filters-summary" aria-live="polite">
        {active ? `Filtros activos: ${summary.join(' · ')}.` : 'Sin filtros: toda la producción verificada.'}
      </p>
    </section>
  );
}
