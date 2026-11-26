/**
 * Colaboraciones: vista de coautoría interna (grafo, métricas y tabla de centralidades), la
 * limitación de los datos y el cambio de vista guardado en la URL.
 */
import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/api';
import CollaborationsPage from './CollaborationsPage';
import { currentUrl, metricsApi, renderRoute } from '../testing/analysisFixtures';

vi.mock('../services/api', () => ({ api: { get: vi.fn() } }));

const renderPage = (path = '/colaboraciones') => renderRoute(path, '/colaboraciones', <CollaborationsPage />);

describe('CollaborationsPage', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.get.mockImplementation((url, config) => {
      if (url === '/metrics/networks/countries') {
        return Promise.resolve({
          data: {
            min_count: 1,
            nodes: [
              { id: 'l', kind: 'professor', label: 'LUIS PAREDES ORTEGA', department: 'Computación', count: 1 },
              { id: 'country:ES', kind: 'country', label: 'ES', department: null, count: 1 },
            ],
            edges: [{ source: 'l', target: 'country:ES', weight: 1 }],
          },
        });
      }
      return metricsApi(url, config);
    });
  });

  it('muestra la red de coautoría, sus métricas y la tabla de centralidades', async () => {
    renderPage();
    expect(await screen.findByRole('group', { name: 'Red de coautoría entre profesores de la Escuela' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Coautoría interna' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/solo incluye a los profesores de la Escuela como autores/)).toBeInTheDocument();
    expect(screen.getByText('Modularidad')).toBeInTheDocument();

    const table = screen.getByRole('table');
    const first = within(table).getAllByRole('rowheader')[0];
    expect(first).toHaveTextContent('Luis Paredes Ortega'); // ordenada por intermediación
    expect(within(first).getByRole('link')).toHaveAttribute('href', '/docentes/l');
  });

  it('cambia el color por departamento y la vista de países, con nombres en español', async () => {
    const user = renderPage();
    await screen.findByRole('group', { name: /Red de coautoría/ });
    const colorBy = screen.getByRole('group', { name: 'Color por' });
    await user.click(within(colorBy).getByRole('button', { name: 'Departamento' }));
    expect(within(colorBy).getByRole('button', { name: 'Departamento' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText('Matemáticas').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('tab', { name: 'Países' }));
    expect(currentUrl()).toBe('/colaboraciones?vista=paises');
    expect(await screen.findByRole('button', { name: /^España/ })).toBeInTheDocument();
    expect(screen.getByText(/solo incluye a los profesores de la Escuela como autores/)).toBeInTheDocument();
  });
});
