/**
 * Pruebas de la lógica de filtros - T-HU06-01 (PGPCECMC-53). Reglas F-01 a F-05 y RFL-01 a RFL-05.
 */
import { describe, expect, it } from 'vitest';
import { SAMPLE_PRODUCTS } from '../data/catalogSample';
import {
  activeFilterChips,
  applyCatalogFilters,
  catalogYears,
  EMPTY_FILTERS,
  groupByYear,
  readCatalogParams,
  removeFilterKeys,
  sortCatalog,
  toCatalogParams,
} from './catalogFilters';

const verified = SAMPLE_PRODUCTS.filter((product) => product.status === 'verificado');
const filters = (changes) => ({ ...EMPTY_FILTERS, ...changes });

describe('URL de los filtros (RFL-05)', () => {
  it('ida y vuelta: lo que se escribe en la URL se vuelve a leer igual', () => {
    const original = filters({ q: 'redes', type: 'publicacion', year_from: '2020', year_to: '2024' });
    const params = toCatalogParams(original, 3);

    expect(params.toString()).toBe('q=redes&type=publicacion&year_from=2020&year_to=2024&page=3');
    expect(readCatalogParams(params)).toEqual({ filters: original, page: 3 });
  });

  it('omite los filtros vacíos y la página 1', () => {
    expect(toCatalogParams(EMPTY_FILTERS, 1).toString()).toBe('');
  });

  it('ignora valores inválidos de un enlace alterado', () => {
    const { filters: read, page } = readCatalogParams(
      new URLSearchParams('type=libro&year_from=20x4&research_line=Otra&page=-2'),
    );
    expect(read).toEqual(EMPTY_FILTERS);
    expect(page).toBe(1);
  });

  it('corrige un periodo invertido', () => {
    const { filters: read } = readCatalogParams(new URLSearchParams('year_from=2024&year_to=2020'));
    expect([read.year_from, read.year_to]).toEqual(['2020', '2024']);
  });
});

describe('aplicación de filtros (RFL-01)', () => {
  it('combina todos los criterios con «y»', () => {
    const result = applyCatalogFilters(
      verified,
      filters({ type: 'publicacion', owner_id: 'prof-ana', year_from: '2021', year_to: '2025' }),
    );
    expect(result.map((product) => product.id).sort()).toEqual(['p-01', 'p-07']);
  });

  it('el periodo incluye ambos extremos', () => {
    const result = applyCatalogFilters(verified, filters({ year_from: '2024', year_to: '2024' }));
    expect(result.every((product) => product.year === 2024)).toBe(true);
    expect(result).toHaveLength(3);
  });

  it('la búsqueda no distingue tildes ni mayúsculas y cubre título, autores, DOI, revista y código', () => {
    expect(applyCatalogFilters(verified, filters({ q: 'LIENARD' }))[0].id).toBe('p-04');
    expect(applyCatalogFilters(verified, filters({ q: 'ecmc-2023-02' }))[0].id).toBe('p-09');
    expect(applyCatalogFilters(verified, filters({ q: '10.5555/simapci.2019' }))[0].id).toBe('p-14');
    expect(applyCatalogFilters(verified, filters({ q: 'nonlinearity' }))[0].id).toBe('p-14');
    expect(applyCatalogFilters(verified, filters({ q: 'salazar' }))).toHaveLength(5);
  });

  it('sin coincidencias devuelve una lista vacía (CA17)', () => {
    expect(applyCatalogFilters(verified, filters({ type: 'proyecto', q: 'topología' }))).toEqual([]);
  });
});

describe('orden y agrupación (RFL-04)', () => {
  it('ordena por año descendente y luego por título', () => {
    const sorted = sortCatalog(verified);
    const years = sorted.map((product) => product.year);
    expect(years).toEqual([...years].sort((a, b) => b - a));
    const of2025 = sorted.filter((product) => product.year === 2025).map((product) => product.title);
    expect(of2025).toEqual([...of2025].sort((a, b) => a.localeCompare(b, 'es')));
  });

  it('agrupa por año sin repetir grupos', () => {
    const groups = groupByYear(sortCatalog(verified));
    expect(groups.map((group) => group.year)).toEqual([2025, 2024, 2023, 2022, 2021, 2020, 2019]);
  });
});

describe('filtros activos (CA18)', () => {
  const professors = [{ id: 'prof-ana', full_name: 'Ana Morales Vega' }];

  it('describe cada filtro con su valor legible y el periodo como una sola etiqueta', () => {
    const chips = activeFilterChips(
      filters({ type: 'proyecto', owner_id: 'prof-ana', year_from: '2020', year_to: '2024' }),
      professors,
    );
    expect(chips.map((chip) => chip.label)).toEqual([
      'Tipo: Proyecto de investigación',
      'Profesor: Ana Morales Vega',
      'Periodo: 2020 a 2024',
    ]);
  });

  it('al quitar el periodo se borran ambos años', () => {
    const period = activeFilterChips(filters({ year_from: '2020', year_to: '2024' }))[0];
    expect(removeFilterKeys(filters({ year_from: '2020', year_to: '2024' }), period.keys)).toEqual(EMPTY_FILTERS);
  });
});

it('los años del periodo van del actual hasta 2011', () => {
  const years = catalogYears(2026);
  expect(years[0]).toBe('2026');
  expect(years.at(-1)).toBe('2011');
});
