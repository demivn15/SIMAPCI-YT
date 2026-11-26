/**
 * Inicio (la Escuela en cifras) - HU09 y HU10, con los filtros comunes del análisis.
 * La tabla por profesor y la red de coautoría se prueban en Docentes y en NetworkGraph.
 */
import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/api';
import PublicMetricsPage from './PublicMetricsPage';
import { displayName, formatShare, shortName } from '../utils/metricsFormat';
import { currentUrl, metricsApi, renderRoute } from '../testing/analysisFixtures';

vi.mock('../services/api', () => ({ api: { get: vi.fn() } }));

const renderPage = (path = '/inicio') => renderRoute(path, '/inicio', <PublicMetricsPage />);

describe('PublicMetricsPage (Inicio)', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.get.mockImplementation(metricsApi);
  });

  it('muestra los indicadores de la Escuela con su fuente y fecha de corte', async () => {
    renderPage();
    expect(await screen.findByText('Índice h de la Escuela')).toBeInTheDocument();
    expect(screen.getByText('de 2 obras con citas conocidas')).toBeInTheDocument();
    expect(screen.getByText(/ORCID, OpenAlex, Crossref y\s+SCImago/)).toBeInTheDocument();
    expect(screen.getByText(/fecha de corte: 10 de noviembre de 2026/)).toBeInTheDocument();
    expect(screen.getByText('España')).toBeInTheDocument();
    expect(screen.getByText('Universitat Politècnica de Catalunya')).toBeInTheDocument();
  });

  it('agrega los gráficos de citas por año y de tipo de contribución', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Citas por año de publicación' })).toBeInTheDocument();
    const types = screen.getByRole('heading', { name: 'Tipo de contribución' }).closest('section');
    expect(within(types).getByText('Artículo de revista')).toBeInTheDocument();
    // Una obra sin tipo conocido no se esconde: se muestra como tal.
    expect(within(types).getByText('Sin tipo registrado')).toBeInTheDocument();
  });

  it('aplica los filtros de la URL a todas las consultas y los cambia en la URL', async () => {
    const user = renderPage('/inicio?department=Matemáticas&year_from=2025&year_to=2020');
    await screen.findByText('Índice h de la Escuela');
    const expected = { department: 'Matemáticas', year_from: '2020', year_to: '2025' };
    for (const url of ['/metrics/overview', '/metrics/timeline', '/metrics/collaboration']) {
      expect(api.get).toHaveBeenCalledWith(url, { params: expected });
    }

    await user.selectOptions(screen.getByRole('combobox', { name: 'Cuartil SJR' }), 'Q1');
    expect(currentUrl()).toContain('quartile=Q1');
    expect(currentUrl()).toContain('department=Matem');
    expect(api.get).toHaveBeenCalledWith('/metrics/overview', { params: { ...expected, quartile: 'Q1' } });

    await user.click(screen.getByRole('button', { name: /Restablecer/ }));
    expect(currentUrl()).toBe('/inicio');
  });

  it('ignora valores de filtros que no existen', async () => {
    renderPage('/inicio?quartile=Q9&affiliation=todas&department=Física&year_from=20x4');
    await screen.findByText('Índice h de la Escuela');
    expect(api.get).toHaveBeenLastCalledWith('/metrics/collaboration', undefined);
    expect(screen.getByText('Sin filtros: toda la producción verificada.')).toBeInTheDocument();
  });

  it('avisa y permite reintentar si el servicio falla', async () => {
    api.get.mockImplementation((url) => (url === '/metrics/filters' ? metricsApi(url) : Promise.reject(new Error('Network Error'))));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las métricas');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('formato de métricas', () => {
  it('normaliza nombres en mayúsculas y abrevia sin perder apellidos', () => {
    expect(displayName('ISIDRO RAFAEL AMARO MARTÍN')).toBe('Isidro Rafael Amaro Martín');
    expect(shortName('ISIDRO RAFAEL AMARO MARTÍN')).toBe('I. Amaro Martín');
    expect(shortName('Manuel Eugenio Morocho-Cayamcela')).toBe('M. Morocho-Cayamcela');
    expect(shortName('Mayorga-Zambrano, J.')).toBe('J. Mayorga-Zambrano');
    expect(shortName('Franklin José Camacho')).toBe('F. José Camacho');
    expect(shortName('Saba Infante')).toBe('S. Infante');
  });

  it('muestra porcentajes y valores desconocidos', () => {
    expect(formatShare(0.5564)).toBe('56 %');
    expect(formatShare(null)).toBe('—');
  });
});
