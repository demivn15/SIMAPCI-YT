/**
 * Filtros del catálogo público - T-HU06-01 (PGPCECMC-53). Criterios CA16, CA17 y CA18.
 *
 * Reglas del documento "Reglas y definiciones del Sprint 2" (T-HU06-02, propuesta a validar):
 *   F-01 tipo · F-02 profesor · F-03 periodo (rango de años) · F-04 línea · F-05 texto
 *   RFL-01 los filtros se combinan con «y»    RFL-03 al cambiar un filtro se vuelve a la página 1
 *   RFL-04 orden por año descendente y título  RFL-05 los filtros viven en la URL
 *
 * Los nombres de los parámetros son los sugeridos para el servicio (tabla 4.4), para que la
 * URL de la página y la consulta a la API (T-HU06-03) y la descarga (HU11) usen los mismos.
 */
import { PRODUCT_TYPES, PROJECT_STATUSES, RESEARCH_LINES } from '../constants/products';

export const EMPTY_FILTERS = Object.freeze({
  q: '',
  type: '',
  owner_id: '',
  year_from: '',
  year_to: '',
  research_line: '',
});

export const FILTER_KEYS = Object.keys(EMPTY_FILTERS);

/** Primer año con producción registrada de la ECMC (datos importados de ORCID). */
export const FIRST_CATALOG_YEAR = 2011;

/** Años disponibles en los selectores de periodo, del más reciente al más antiguo. */
export function catalogYears(currentYear = new Date().getFullYear()) {
  const years = [];
  for (let year = currentYear; year >= FIRST_CATALOG_YEAR; year -= 1) years.push(String(year));
  return years;
}

const VALID_TYPES = new Set(PRODUCT_TYPES.map((option) => option.value));
const VALID_LINES = new Set(RESEARCH_LINES);
const YEAR_PATTERN = /^\d{4}$/;

/**
 * Lee los filtros y la página desde la URL. Ignora valores que no existen (por ejemplo, un
 * tipo inventado), para que un enlace alterado no deje la página en un estado imposible.
 */
export function readCatalogParams(searchParams) {
  const get = (key) => (searchParams.get(key) || '').trim();
  const filters = { ...EMPTY_FILTERS };

  filters.q = get('q').slice(0, 120);
  if (VALID_TYPES.has(get('type'))) filters.type = get('type');
  filters.owner_id = get('owner_id').slice(0, 64);
  if (YEAR_PATTERN.test(get('year_from'))) filters.year_from = get('year_from');
  if (YEAR_PATTERN.test(get('year_to'))) filters.year_to = get('year_to');
  if (VALID_LINES.has(get('research_line'))) filters.research_line = get('research_line');

  // Un rango invertido (desde 2024 hasta 2020) se interpreta como el rango correcto.
  if (filters.year_from && filters.year_to && filters.year_from > filters.year_to) {
    [filters.year_from, filters.year_to] = [filters.year_to, filters.year_from];
  }

  const page = Number.parseInt(get('page'), 10);
  return { filters, page: Number.isInteger(page) && page > 1 ? page : 1 };
}

/** Escribe filtros y página como parámetros de URL; omite los vacíos y la página 1. */
export function toCatalogParams(filters, page = 1) {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = (filters[key] || '').trim();
    if (value) params.set(key, value);
  }
  if (page > 1) params.set('page', String(page));
  return params;
}

export function hasActiveFilters(filters) {
  return FILTER_KEYS.some((key) => (filters[key] || '').trim() !== '');
}

function periodLabel(from, to) {
  if (from && to) return from === to ? `Año ${from}` : `${from} a ${to}`;
  if (from) return `Desde ${from}`;
  return `Hasta ${to}`;
}

/**
 * Etiquetas de los filtros activos (CA18). El periodo es una sola etiqueta aunque use dos
 * parámetros; al quitarla se borran ambos.
 */
export function activeFilterChips(filters, professors = []) {
  const chips = [];
  if (filters.q) chips.push({ id: 'q', label: `Texto: «${filters.q}»`, keys: ['q'] });
  if (filters.type) {
    const type = PRODUCT_TYPES.find((option) => option.value === filters.type);
    chips.push({ id: 'type', label: `Tipo: ${type?.label ?? filters.type}`, keys: ['type'] });
  }
  if (filters.owner_id) {
    const professor = professors.find((item) => item.id === filters.owner_id);
    chips.push({ id: 'owner_id', label: `Profesor: ${professor?.full_name ?? 'seleccionado'}`, keys: ['owner_id'] });
  }
  if (filters.year_from || filters.year_to) {
    chips.push({
      id: 'period',
      label: `Periodo: ${periodLabel(filters.year_from, filters.year_to)}`,
      keys: ['year_from', 'year_to'],
    });
  }
  if (filters.research_line) {
    chips.push({ id: 'research_line', label: `Línea: ${filters.research_line}`, keys: ['research_line'] });
  }
  return chips;
}

export function removeFilterKeys(filters, keys) {
  const next = { ...filters };
  for (const key of keys) next[key] = '';
  return next;
}

/** Texto sin tildes y en minúsculas, para que «optimizacion» encuentre «optimización». */
function searchable(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Aplica los filtros a una lista en memoria (RFL-01), principalmente para las pruebas.
 * En producción, el backend aplica los mismos criterios antes de contar y paginar.
 */
export function applyCatalogFilters(products, filters) {
  const query = searchable(filters.q).trim();
  const from = filters.year_from ? Number(filters.year_from) : null;
  const to = filters.year_to ? Number(filters.year_to) : null;

  return products.filter((product) => {
    if (filters.type && product.type !== filters.type) return false;
    if (filters.owner_id && product.owner?.id !== filters.owner_id) return false;
    if (from !== null && product.year < from) return false;
    if (to !== null && product.year > to) return false;
    if (filters.research_line && product.research_line !== filters.research_line) return false;
    if (query) {
      const haystack = searchable(
        [product.title, ...(product.authors || []), product.doi, product.venue, product.project_code].join(' '),
      );
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

/** RFL-04: del año más reciente al más antiguo y, dentro del año, por título. */
export function sortCatalog(products) {
  return [...products].sort((a, b) => b.year - a.year || a.title.localeCompare(b.title, 'es'));
}

/** Agrupa una página de resultados por año, conservando el orden recibido. */
export function groupByYear(products) {
  const groups = [];
  for (const product of products) {
    const last = groups[groups.length - 1];
    if (last && last.year === product.year) last.items.push(product);
    else groups.push({ year: product.year, items: [product] });
  }
  return groups;
}

export function productTypeLabel(type) {
  return PRODUCT_TYPES.find((option) => option.value === type)?.label ?? type;
}

export function projectStatusLabel(status) {
  return PROJECT_STATUSES.find((option) => option.value === status)?.label ?? status;
}

export function resultCountLabel(total) {
  return total === 1 ? '1 producto' : `${total} productos`;
}
