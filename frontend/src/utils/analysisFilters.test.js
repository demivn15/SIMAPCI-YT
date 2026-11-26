/**
 * Filtros comunes del análisis en la URL: lectura validada, escritura y parámetros de la API.
 * Incluye la selección de «Comparar docentes» (`?ids=`).
 */
import { describe, expect, it } from 'vitest';
import {
  EMPTY_ANALYSIS_FILTERS,
  contributionTypeLabel,
  describeAnalysisFilters,
  readAnalysisFilters,
  toApiParams,
  writeAnalysisFilters,
} from './analysisFilters';
import { readCompareIds, writeCompareIds } from './compareSelection';

const params = (text) => new URLSearchParams(text);
const OPTIONS = {
  departments: ['Computación', 'Matemáticas'],
  contribution_types: [{ value: 'journal-article', count: 3 }],
};

describe('readAnalysisFilters', () => {
  it('lee los filtros válidos', () => {
    const search =
      'department=Matemáticas&year_from=2018&year_to=2022&affiliation=yachay&contribution_type=journal-article&quartile=sin_cuartil';
    expect(readAnalysisFilters(params(search), OPTIONS)).toEqual({
      department: 'Matemáticas',
      year_from: '2018',
      year_to: '2022',
      affiliation: 'yachay',
      contribution_type: 'journal-article',
      quartile: 'sin_cuartil',
    });
  });

  it('ignora valores inválidos o que no existen en las opciones', () => {
    const search = 'department=Física&year_from=20x4&year_to=3000&affiliation=todas&contribution_type=%3Cscript%3E&quartile=Q5';
    expect(readAnalysisFilters(params(search), OPTIONS)).toEqual(EMPTY_ANALYSIS_FILTERS);
  });

  it('sin opciones cargadas solo valida la forma', () => {
    expect(readAnalysisFilters(params('department=Física')).department).toBe('Física');
    expect(readAnalysisFilters(params('department=Física'), OPTIONS).department).toBe('');
  });

  it('intercambia un periodo invertido', () => {
    const filters = readAnalysisFilters(params('year_from=2024&year_to=2019'));
    expect([filters.year_from, filters.year_to]).toEqual(['2019', '2024']);
  });
});

describe('writeAnalysisFilters y toApiParams', () => {
  it('escribe solo los filtros con valor y conserva los demás parámetros', () => {
    const next = writeAnalysisFilters(params('vista=paises&quartile=Q2&ids=a,b'), {
      ...EMPTY_ANALYSIS_FILTERS,
      department: 'Computación',
    });
    expect(next.get('vista')).toBe('paises');
    expect(next.get('ids')).toBe('a,b');
    expect(next.get('department')).toBe('Computación');
    expect(next.has('quartile')).toBe(false);
  });

  it('pasa a la API solo los filtros activos', () => {
    expect(toApiParams({ ...EMPTY_ANALYSIS_FILTERS, quartile: 'Q1', affiliation: 'yachay' })).toEqual({
      quartile: 'Q1',
      affiliation: 'yachay',
    });
    expect(toApiParams(EMPTY_ANALYSIS_FILTERS)).toEqual({});
  });

  it('describe los filtros y traduce los tipos de contribución', () => {
    const filters = { ...EMPTY_ANALYSIS_FILTERS, year_from: '2020', contribution_type: 'book-chapter' };
    expect(describeAnalysisFilters(filters)).toEqual(['Desde 2020', 'Tipo: Capítulo de libro']);
    expect(contributionTypeLabel(null)).toBe('Sin tipo registrado');
    expect(contributionTypeLabel('tipo-nuevo')).toBe('tipo-nuevo');
  });
});

describe('selección de Comparar en la URL', () => {
  it('lee como máximo 4 identificadores válidos y sin repetir', () => {
    expect(readCompareIds(params('ids=a,b,a,%3Cx%3E,c,d,e'))).toEqual(['a', 'b', 'c', 'd']);
    expect(readCompareIds(params(''))).toEqual([]);
  });

  it('escribe la selección y la borra si queda vacía', () => {
    expect(writeCompareIds(params('quartile=Q1'), ['a', 'b']).get('ids')).toBe('a,b');
    expect(writeCompareIds(params('ids=a'), []).toString()).toBe('');
  });
});
