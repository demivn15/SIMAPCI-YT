/**
 * Catálogos del formulario de productos - T-HU03-01 (PGPCECMC-32).
 * Valores tomados del modelo de dominio del prototipo (src/types/index.ts y
 * src/constants/schools.ts). Los "value" son los que se envían a la API.
 */

export const PRODUCT_TYPES = [
  { value: 'publicacion', label: 'Publicación científica' },
  { value: 'proyecto', label: 'Proyecto de investigación' },
];

// Líneas de investigación oficiales de la ECMC
export const RESEARCH_LINES = [
  'Ecuaciones diferenciales, análisis matemático, modelamiento y optimización',
  'Ciencia de datos',
  'Computación científica',
  'Inteligencia artificial',
  'Tecnologías de la información',
  'Ciencia, Tecnología y Sociedad',
];

export const PROJECT_STATUSES = [
  { value: 'activo', label: 'Activo' },
  { value: 'en_pausa', label: 'En pausa' },
  { value: 'finalizado', label: 'Finalizado' },
  { value: 'cancelado', label: 'Cancelado' },
];
