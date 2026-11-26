/**
 * Filtros comunes del análisis de producción y de redes (Inicio, Docentes, Colaboraciones y
 * Comparar): departamento, periodo, afiliación, tipo de contribución y cuartil.
 *
 * Igual que utils/catalogFilters.js, los filtros viven en la URL y se validan al leerlos: un
 * valor que no existe se ignora, para que un enlace alterado no deje la página en un estado
 * imposible. Los nombres de los parámetros son los mismos de la API (app/api/v1/metrics.py).
 */

export const EMPTY_ANALYSIS_FILTERS = Object.freeze({
  department: '',
  year_from: '',
  year_to: '',
  affiliation: '',
  contribution_type: '',
  quartile: '',
});

export const ANALYSIS_FILTER_KEYS = Object.keys(EMPTY_ANALYSIS_FILTERS);

export const AFFILIATION_OPTIONS = [
  { value: '', label: 'Trayectoria completa' },
  { value: 'yachay', label: 'Solo con afiliación Yachay' },
];

export const QUARTILE_OPTIONS = [
  { value: 'Q1', label: 'Q1' },
  { value: 'Q2', label: 'Q2' },
  { value: 'Q3', label: 'Q3' },
  { value: 'Q4', label: 'Q4' },
  { value: 'sin_cuartil', label: 'Sin cuartil SJR' },
];

const VALID_QUARTILES = new Set(QUARTILE_OPTIONS.map((option) => option.value));
const YEAR_PATTERN = /^\d{4}$/;
// Texto libre con un tope de longitud y sin caracteres de control (departamento y tipo).
const TEXT_PATTERN = /^[\p{L}\p{N} .,'()-]{1,80}$/u;

/** Tipos de contribución de Crossref/OpenAlex, en español. */
const CONTRIBUTION_LABELS = {
  'journal-article': 'Artículo de revista',
  article: 'Artículo (sin precisar)',
  'book-chapter': 'Capítulo de libro',
  'proceedings-article': 'Artículo en actas de congreso',
  'conference-paper': 'Ponencia en congreso',
  'conference-abstract': 'Resumen de congreso',
  'posted-content': 'Contenido publicado en línea',
  preprint: 'Preprint',
  dissertation: 'Tesis',
  book: 'Libro',
  'edited-book': 'Libro editado',
  monograph: 'Monografía',
  dataset: 'Conjunto de datos',
  'data-set': 'Conjunto de datos (data-set)',
  'journal-issue': 'Número de revista',
  journal: 'Revista',
  report: 'Informe',
  software: 'Software',
  'online-resource': 'Recurso en línea',
  other: 'Otro',
};

export function contributionTypeLabel(type) {
  if (!type) return 'Sin tipo registrado';
  return CONTRIBUTION_LABELS[type] ?? type;
}

/**
 * Lee los filtros desde la URL. Con `options` (respuesta de /metrics/filters) también descarta
 * departamentos y tipos que no existen; sin ellas, solo valida la forma.
 */
export function readAnalysisFilters(searchParams, options = null) {
  const get = (key) => (searchParams.get(key) || '').trim();
  const filters = { ...EMPTY_ANALYSIS_FILTERS };

  const department = get('department');
  if (TEXT_PATTERN.test(department) && (!options || options.departments.includes(department))) {
    filters.department = department;
  }
  for (const key of ['year_from', 'year_to']) {
    const year = get(key);
    if (YEAR_PATTERN.test(year) && Number(year) >= 1900 && Number(year) <= 2100) filters[key] = year;
  }
  if (get('affiliation') === 'yachay') filters.affiliation = 'yachay';
  const type = get('contribution_type');
  if (
    TEXT_PATTERN.test(type) &&
    (!options || options.contribution_types.some((option) => option.value === type))
  ) {
    filters.contribution_type = type;
  }
  if (VALID_QUARTILES.has(get('quartile'))) filters.quartile = get('quartile');

  // Un rango invertido (desde 2024 hasta 2020) se interpreta como el rango correcto.
  if (filters.year_from && filters.year_to && filters.year_from > filters.year_to) {
    [filters.year_from, filters.year_to] = [filters.year_to, filters.year_from];
  }
  return filters;
}

/**
 * Escribe los filtros en la URL sin tocar los demás parámetros de la página (por ejemplo, la
 * vista de Colaboraciones o los profesores elegidos en Comparar). Omite los vacíos.
 */
export function writeAnalysisFilters(searchParams, filters) {
  const params = new URLSearchParams(searchParams);
  for (const key of ANALYSIS_FILTER_KEYS) {
    const value = (filters[key] || '').trim();
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return params;
}

/** Parámetros para la API: solo los filtros con valor. */
export function toApiParams(filters) {
  const params = {};
  for (const key of ANALYSIS_FILTER_KEYS) {
    if (filters[key]) params[key] = filters[key];
  }
  return params;
}

export function hasActiveAnalysisFilters(filters) {
  return ANALYSIS_FILTER_KEYS.some((key) => Boolean(filters[key]));
}

/** Resumen legible de los filtros activos, para notas y estados vacíos. */
export function describeAnalysisFilters(filters) {
  const parts = [];
  if (filters.department) parts.push(`Departamento: ${filters.department}`);
  if (filters.year_from || filters.year_to) {
    if (filters.year_from && filters.year_to) parts.push(`Periodo: ${filters.year_from}–${filters.year_to}`);
    else if (filters.year_from) parts.push(`Desde ${filters.year_from}`);
    else parts.push(`Hasta ${filters.year_to}`);
  }
  if (filters.affiliation === 'yachay') parts.push('Solo con afiliación Yachay');
  if (filters.contribution_type) parts.push(`Tipo: ${contributionTypeLabel(filters.contribution_type)}`);
  if (filters.quartile) {
    parts.push(`Cuartil: ${QUARTILE_OPTIONS.find((option) => option.value === filters.quartile)?.label}`);
  }
  return parts;
}
