/**
 * Dashboard público de métricas - HU09 (por profesor) y HU10 (evolución de la Escuela).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/api';
import PublicMetricsPage from './PublicMetricsPage';
import { displayName, formatShare, shortName } from '../utils/metricsFormat';

vi.mock('../services/api', () => ({ api: { get: vi.fn() } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false, user: null }) }));

const responses = {
  '/metrics/overview': {
    total_products: 3, publications: 3, projects: 0, professors: 2, citations_total: 13,
    products_with_citations: 2, h_index: 2,
    quartiles: { Q1: 1, Q2: 0, Q3: 1, Q4: 0, sin_cuartil: 1 },
    q1_q2_share: 0.5, open_access_share: 0.5, international_share: 0.5,
    year_from: 2024, year_to: 2025, data_as_of: '2026-11-10T13:40:53',
    research_lines: [{ research_line: 'Ciencia de datos', count: 3 }],
  },
  '/metrics/timeline': {
    items: [
      { year: 2024, total: 2, citations: 13, Q1: 1, Q2: 0, Q3: 1, Q4: 0, sin_cuartil: 0 },
      { year: 2025, total: 1, citations: 0, Q1: 0, Q2: 0, Q3: 0, Q4: 0, sin_cuartil: 1 },
    ],
  },
  '/metrics/professors': {
    items: [
      { id: 'a', full_name: 'Ana Morales', products: 2, citations: 13, h_index: 2, Q1: 1, Q2: 0, Q3: 1, Q4: 0,
        first_year: 2024, last_year: 2024, main_research_line: 'Ciencia de datos', coauthored_in_school: 1 },
      { id: 'l', full_name: 'LUIS PAREDES ORTEGA', products: 3, citations: 10, h_index: 1, Q1: 1, Q2: 0, Q3: 0, Q4: 0,
        first_year: 2024, last_year: 2025, main_research_line: 'Ciencia de datos', coauthored_in_school: 1 },
    ],
  },
  '/metrics/collaboration': {
    nodes: [
      { id: 'l', full_name: 'LUIS PAREDES ORTEGA', products: 3, main_research_line: 'Ciencia de datos' },
      { id: 'a', full_name: 'Ana Morales', products: 2, main_research_line: 'Ciencia de datos' },
    ],
    edges: [{ source: 'a', target: 'l', weight: 1 }],
    countries: [{ code: 'ES', count: 1 }],
    institutions: [{ name: 'Universitat Politècnica de Catalunya', count: 1 }],
  },
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/metricas']}>
        <PublicMetricsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe('PublicMetricsPage', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.get.mockImplementation((url) => Promise.resolve({ data: responses[url] }));
  });

  it('muestra los indicadores de la Escuela con su fuente', async () => {
    renderPage();
    expect(await screen.findByText('Índice h de la Escuela')).toBeInTheDocument();
    expect(screen.getByText('de 2 obras con citas conocidas')).toBeInTheDocument();
    expect(screen.getByText(/ORCID, OpenAlex y SCImago/)).toBeInTheDocument();
    expect(screen.getByText('España')).toBeInTheDocument();
    expect(screen.getByText('Universitat Politècnica de Catalunya')).toBeInTheDocument();
  });

  it('ordena la tabla de profesores al pulsar una columna', async () => {
    const user = renderPage();
    const table = await screen.findByRole('table');
    const names = () => within(table).getAllByRole('rowheader').map((cell) => cell.textContent);
    expect(names()[0]).toMatch(/^Luis Paredes Ortega/); // por obras, de mayor a menor
    await user.click(within(table).getByRole('button', { name: /Índice h/ }));
    expect(names()[0]).toMatch(/^Ana Morales/);
    expect(within(table).getByRole('columnheader', { name: /Índice h/ })).toHaveAttribute('aria-sort', 'descending');
  });

  it('al elegir un profesor en la red muestra sus coautores', async () => {
    const user = renderPage();
    await user.click(await screen.findByRole('button', { name: /Ana Morales: 2 obras, 1 coautores/ }));
    const panel = screen.getByRole('heading', { level: 3, name: 'Ana Morales' }).closest('aside');
    expect(within(panel).getByText('Luis Paredes Ortega')).toBeInTheDocument();
  });

  it('avisa y permite reintentar si el servicio falla', async () => {
    api.get.mockRejectedValue(new Error('Network Error'));
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
