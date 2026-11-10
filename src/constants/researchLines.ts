import { OfficialResearchLine } from '../types';
import { SCHOOLS } from './schools';

/**
 * 6 Líneas de investigación oficiales y centralizadas de la Escuela de Ciencias
 * Matemáticas y Computacionales (ECMC) de Yachay Tech.
 * Conforme a la sección 4 de requerimientos: usar exclusivamente estos nombres.
 */
export const OFFICIAL_RESEARCH_LINES: readonly OfficialResearchLine[] = SCHOOLS.find((school) => school.code === 'ECMC')!.researchLines;
export const ALL_OFFICIAL_RESEARCH_LINES: readonly OfficialResearchLine[] = [...new Set(SCHOOLS.flatMap((school) => school.researchLines))];

/** Sub-líneas demostrativas para que cada docente pueda precisar su perfil. */
export const OFFICIAL_RESEARCH_SUBLINES: Partial<Record<OfficialResearchLine, readonly string[]>> = {
  'Ecuaciones diferenciales, análisis matemático, modelamiento y optimización': [
    'Ecuaciones diferenciales parciales',
    'Análisis numérico y métodos computacionales',
    'Modelamiento matemático y optimización',
  ],
  'Ciencia de datos': [
    'Minería de datos y aprendizaje estadístico',
    'Bioinformática y análisis de datos biológicos',
    'Análisis de datos topológicos',
  ],
  'Computación científica': [
    'Computación de alto rendimiento',
    'Simulación y métodos numéricos',
    'Algoritmos distribuidos y computación paralela',
  ],
  'Inteligencia artificial': [
    'Aprendizaje profundo',
    'Procesamiento de lenguaje natural',
    'Inteligencia artificial explicable',
  ],
  'Tecnologías de la información': [
    'Ciberseguridad y criptografía',
    'Sistemas distribuidos y redes',
    'Ingeniería de software',
  ],
  'Ciencia, Tecnología y Sociedad': [
    'Brecha digital e inclusión tecnológica',
    'Innovación y política científica',
    'Ciencia abierta y comunicación pública',
  ],
};

export const ACADEMIC_SEMESTERS = [
  '2021-1', '2021-2',
  '2022-1', '2022-2',
  '2023-1', '2023-2',
  '2024-1', '2024-2',
  '2025-1', '2025-2',
  '2026-1', '2026-2',
] as const;

export const ESCUELA_NAME = 'Escuela de Ciencias Matemáticas y Computacionales';
export const ESCUELA_CODE = 'ECMC';
export const INSTITUTION_NAME = 'Yachay Tech';
export const ALLOWED_EMAIL_DOMAIN = '@yachaytech.edu.ec';
