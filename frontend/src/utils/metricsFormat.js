/**
 * Formato y colores del dashboard de métricas (HU09 y HU10).
 */
import { RESEARCH_LINES } from '../constants/products';

const numberFormat = new Intl.NumberFormat('es-EC');
const regionNames = new Intl.DisplayNames(['es'], { type: 'region' });

export const formatNumber = (value) => (value === null || value === undefined ? '—' : numberFormat.format(value));

export const formatShare = (value) =>
  value === null || value === undefined ? '—' : `${Math.round(value * 100)} %`;

export function countryName(code) {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Cuartiles: del rojo ECMC (Q1) hacia tonos claros; «sin cuartil» en gris neutro. */
export const QUARTILE_SERIES = [
  { key: 'Q1', label: 'Q1', color: '#82302a' },
  { key: 'Q2', label: 'Q2', color: '#c2523f' },
  { key: 'Q3', label: 'Q3', color: '#e39a7f' },
  { key: 'Q4', label: 'Q4', color: '#f0cbb9' },
  { key: 'sin_cuartil', label: 'Sin cuartil SJR', color: '#d6d0c9' },
];

const LINE_COLORS = ['#2f5d7c', '#82302a', '#5b7a3a', '#b07a1c', '#6b4c8a', '#3f7f78'];
const UNCLASSIFIED_COLOR = '#9b958f';

/** Color fijo por línea de investigación oficial, para que coincida en todos los gráficos. */
export function researchLineColor(line) {
  const index = RESEARCH_LINES.indexOf(line);
  return index === -1 ? UNCLASSIFIED_COLOR : LINE_COLORS[index % LINE_COLORS.length];
}

/** Nombre corto para la línea: las oficiales son largas para una leyenda. */
export function shortResearchLine(line) {
  if (line?.startsWith('Ecuaciones diferenciales')) return 'Ecuaciones y optimización';
  return line;
}

const isUpperCase = (text) => text === text.toUpperCase() && text !== text.toLowerCase();

/** Corrige nombres escritos todo en mayúsculas en el origen («ISIDRO AMARO» → «Isidro Amaro»). */
export function displayName(name = '') {
  if (!isUpperCase(name)) return name;
  return name
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (match, separator, letter) => separator + letter.toUpperCase());
}

const initial = (word) => `${word.charAt(0).toUpperCase()}.`;

/**
 * Nombre corto para el grafo: inicial del nombre y apellidos («I. Amaro Martín»).
 * Heurística para nombres hispanos, sin adivinar cuál palabra es el apellido cuando hay
 * tres (puede ser «Juan Astudillo León» o «Franklin José Camacho»): se conservan ambas.
 * «Apellido, Nombre» se invierte y un apellido compuesto con guion se usa tal cual.
 */
export function shortName(name = '') {
  const clean = displayName(name).trim();
  if (clean.includes(',')) {
    const [last, first] = clean.split(',').map((part) => part.trim());
    return first ? `${initial(first)} ${last}` : last;
  }
  const tokens = clean.split(/\s+/);
  if (tokens.length === 1) return tokens[0];
  const hyphenated = tokens.slice(1).find((token) => token.includes('-'));
  if (hyphenated) return `${initial(tokens[0])} ${hyphenated}`;
  if (tokens.length <= 3) return `${initial(tokens[0])} ${tokens.slice(1).join(' ')}`;
  return `${initial(tokens[0])} ${tokens.slice(2).join(' ')}`;
}
