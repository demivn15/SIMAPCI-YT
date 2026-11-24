/**
 * Controles de filtrado del catálogo - T-HU06-01 (PGPCECMC-53). Criterios CA16 y CA18.
 *
 * - Los selectores se aplican al cambiar; el texto, al pulsar Enter o «Buscar», para no
 *   consultar el servicio con cada tecla.
 * - En pantallas angostas el panel se pliega tras el botón «Filtros», pero las etiquetas de
 *   los filtros activos se ven siempre (CA18: el usuario sabe qué está aplicado).
 */
import { useId, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { PRODUCT_TYPES, RESEARCH_LINES } from '../../constants/products';
import {
  activeFilterChips,
  catalogYears,
  EMPTY_FILTERS,
  hasActiveFilters,
  removeFilterKeys,
} from '../../utils/catalogFilters';

export default function CatalogFilters({ filters, professors, onChange }) {
  const ids = useId();
  const panelId = `${ids}-panel`;
  const [query, setQuery] = useState(filters.q);
  const [panelOpen, setPanelOpen] = useState(false);
  // Si los filtros cambian desde fuera (una etiqueta quitada, «Limpiar filtros» o el botón
  // «Atrás» del navegador), el cuadro de búsqueda muestra el texto vigente.
  const [lastAppliedQuery, setLastAppliedQuery] = useState(filters.q);
  if (filters.q !== lastAppliedQuery) {
    setLastAppliedQuery(filters.q);
    setQuery(filters.q);
  }

  const years = catalogYears();
  const chips = activeFilterChips(filters, professors);
  const activeCount = chips.length;

  const update = (changes) => onChange({ ...filters, ...changes });
  const handleSelect = (key) => (event) => update({ [key]: event.target.value });

  const handleSearch = (event) => {
    event.preventDefault();
    update({ q: query.trim() });
  };

  return (
    <section className="catalog-filters" aria-label="Filtros del catálogo">
      <form role="search" className="catalog-search" onSubmit={handleSearch}>
        <label htmlFor={`${ids}-q`} className="sr-only">
          Buscar por título, autor, DOI, revista o código de proyecto
        </label>
        <Search size={20} aria-hidden="true" className="catalog-search-icon" />
        <input
          id={`${ids}-q`}
          type="search"
          className="field-input catalog-search-input"
          placeholder="Buscar por título, autor, DOI, revista o código"
          value={query}
          maxLength={120}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" className="btn btn-primary">
          Buscar
        </button>
      </form>

      <button
        type="button"
        className="btn btn-outline catalog-filters-toggle"
        aria-expanded={panelOpen}
        aria-controls={panelId}
        onClick={() => setPanelOpen(!panelOpen)}
      >
        <SlidersHorizontal size={18} aria-hidden="true" />
        {activeCount > 0 ? `Filtros (${activeCount})` : 'Filtros'}
      </button>

      <div id={panelId} className={`catalog-filter-grid${panelOpen ? ' is-open' : ''}`}>
        <div>
          <label htmlFor={`${ids}-type`} className="field-label">
            Tipo de producto
          </label>
          <select id={`${ids}-type`} className="field-input" value={filters.type} onChange={handleSelect('type')}>
            <option value="">Todos</option>
            {PRODUCT_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${ids}-owner`} className="field-label">
            Profesor
          </label>
          <select id={`${ids}-owner`} className="field-input" value={filters.owner_id} onChange={handleSelect('owner_id')}>
            <option value="">Todos</option>
            {professors.map((professor) => (
              <option key={professor.id} value={professor.id}>
                {professor.full_name}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="catalog-period">
          <legend className="field-label">Periodo</legend>
          <div className="catalog-period-fields">
            <label htmlFor={`${ids}-from`} className="sr-only">
              Desde el año
            </label>
            <select id={`${ids}-from`} className="field-input" value={filters.year_from} onChange={handleSelect('year_from')}>
              <option value="">Desde</option>
              {years
                .filter((year) => !filters.year_to || year <= filters.year_to)
                .map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
            </select>
            <label htmlFor={`${ids}-to`} className="sr-only">
              Hasta el año
            </label>
            <select id={`${ids}-to`} className="field-input" value={filters.year_to} onChange={handleSelect('year_to')}>
              <option value="">Hasta</option>
              {years
                .filter((year) => !filters.year_from || year >= filters.year_from)
                .map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
            </select>
          </div>
        </fieldset>

        <div className="catalog-line">
          <label htmlFor={`${ids}-line`} className="field-label">
            Línea de investigación
          </label>
          <select
            id={`${ids}-line`}
            className="field-input"
            value={filters.research_line}
            onChange={handleSelect('research_line')}
          >
            <option value="">Todas</option>
            {RESEARCH_LINES.map((line) => (
              <option key={line} value={line}>
                {line}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasActiveFilters(filters) && (
        <div className="catalog-chips">
          <span className="catalog-chips-title" id={`${ids}-chips`}>
            Filtros aplicados
          </span>
          <ul aria-labelledby={`${ids}-chips`}>
            {chips.map((chip) => (
              <li key={chip.id}>
                <button
                  type="button"
                  className="catalog-chip"
                  aria-label={`Quitar filtro ${chip.label}`}
                  onClick={() => onChange(removeFilterKeys(filters, chip.keys))}
                >
                  <span>{chip.label}</span>
                  <X size={15} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="catalog-clear" onClick={() => onChange({ ...EMPTY_FILTERS })}>
            Limpiar filtros
          </button>
        </div>
      )}
    </section>
  );
}
