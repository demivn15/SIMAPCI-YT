/**
 * Colores, textos y explicaciones del análisis de redes (Colaboraciones, Docentes, Comparar y
 * la guía). Las explicaciones de cada centralidad se escriben aquí una sola vez para que la
 * ficha del profesor, la tabla y la guía digan lo mismo.
 */
import { displayName, researchLineColor, shortName, shortResearchLine } from './metricsFormat';

/** Paleta para comunidades: tonos distinguibles que conviven con el rojo ECMC. */
const COMMUNITY_COLORS = ['#82302a', '#2f5d7c', '#5b7a3a', '#b07a1c', '#6b4c8a', '#3f7f78', '#c2523f', '#4a6fa5'];
const NEUTRAL = '#9b958f';

export function communityColor(index, size = 2) {
  // Una «comunidad» de un solo profesor no es un grupo: va en gris.
  if (index === null || index === undefined || size < 2) return NEUTRAL;
  return COMMUNITY_COLORS[index % COMMUNITY_COLORS.length];
}

const DEPARTMENT_COLORS = {
  Matemáticas: '#2f5d7c',
  Computación: '#82302a',
  'Desarrollo Humano': '#5b7a3a',
};

export function departmentColor(department) {
  return DEPARTMENT_COLORS[department] ?? NEUTRAL;
}

export const INSTITUTION_COLOR = '#b07a1c';
export const COUNTRY_COLOR = '#3f7f78';

export const NETWORK_LIMITATION =
  'El volcado solo incluye a los profesores de la Escuela como autores; la colaboración externa se mide por institución y país.';

const decimal = new Intl.NumberFormat('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const precise = new Intl.NumberFormat('es-EC', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export const formatDecimal = (value) => (value === null || value === undefined ? '—' : decimal.format(value));
export const formatPrecise = (value) => (value === null || value === undefined ? '—' : precise.format(value));

/** Centralidades: nombre, explicación en lenguaje simple y ejemplo cotidiano (para la guía). */
export const CENTRALITY_INFO = {
  degree: {
    label: 'Grado',
    short: 'Colegas de la Escuela con los que ha publicado.',
    example: 'Como contar a cuántas personas distintas saludas en el pasillo.',
  },
  strength: {
    label: 'Fuerza',
    short: 'Total de obras en coautoría con colegas de la Escuela (cuenta las repetidas).',
    example: 'No solo a cuántos saludas, sino cuántas veces conversas con cada uno.',
  },
  betweenness: {
    label: 'Intermediación',
    short: 'Cuánto sirve de puente entre colegas que no publican juntos. Va de 0 a 1.',
    example: 'La persona que presenta a dos grupos de amigos que no se conocían.',
  },
  betweenness_weighted: {
    label: 'Intermediación ponderada',
    short: 'Igual que la intermediación, pero los caminos prefieren las colaboraciones frecuentes.',
    example: 'El puente que de verdad se usa, no solo el que existe.',
  },
  closeness: {
    label: 'Cercanía',
    short: 'Qué tan pocos pasos le separan de los demás en la red. Va de 0 a 1.',
    example: 'Vivir en el centro de la ciudad: llegas rápido a cualquier barrio.',
  },
  eigenvector: {
    label: 'Vector propio',
    short: 'Influencia por estar conectado con colegas que a su vez están muy conectados.',
    example: 'No importa solo cuántos amigos tienes, sino qué tan conectados están tus amigos.',
  },
  clustering: {
    label: 'Agrupamiento',
    short: 'Qué tanto sus coautores también publican entre sí. Va de 0 a 1.',
    example: 'Si tus amigos también son amigos entre ellos, tu grupo es muy unido.',
  },
  community: {
    label: 'Comunidad',
    short: 'Grupo de colegas que publican más entre sí que con el resto (detectado con Louvain).',
    example: 'Las mesas que se forman solas en una fiesta.',
  },
};

export function professorNode(item, { colorBy = 'community', sizeBy = 'products', communitySizes = new Map() } = {}) {
  const color =
    colorBy === 'department'
      ? departmentColor(item.department)
      : colorBy === 'line'
        ? researchLineColor(item.main_research_line)
        : communityColor(item.community, communitySizes.get(item.community) ?? 2);
  return {
    id: item.id,
    label: displayName(item.full_name),
    shortLabel: shortName(item.full_name),
    size: sizeBy === 'betweenness' ? (item.betweenness ?? 0) + 0.002 : item.products,
    color,
    shape: 'circle',
    description: [item.department, `${item.products} obras`].filter(Boolean).join(', '),
    href: `/docentes/${item.id}`,
  };
}

export function communitySizes(items) {
  const sizes = new Map();
  for (const item of items) sizes.set(item.community, (sizes.get(item.community) ?? 0) + 1);
  return sizes;
}

/** Leyenda según el criterio de color elegido. */
export function legendFor(colorBy, items) {
  if (colorBy === 'department') {
    const departments = [...new Set(items.map((item) => item.department))];
    return departments.map((department) => ({
      label: department ?? 'Sin departamento',
      color: departmentColor(department),
    }));
  }
  if (colorBy === 'line') {
    const lines = [...new Set(items.map((item) => item.main_research_line))];
    return lines.map((line) => ({ label: shortResearchLine(line), color: researchLineColor(line) }));
  }
  const sizes = communitySizes(items);
  const groups = [...sizes.entries()].filter(([, size]) => size > 1).sort((a, b) => a[0] - b[0]);
  const legend = groups.map(([index, size]) => ({
    label: `Comunidad ${index + 1} (${size})`,
    color: communityColor(index, size),
  }));
  if ([...sizes.values()].some((size) => size === 1)) {
    legend.push({ label: 'Sin grupo (profesor solo)', color: NEUTRAL });
  }
  return legend;
}
