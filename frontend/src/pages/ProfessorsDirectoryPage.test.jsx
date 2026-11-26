/**
 * Docentes: directorio con buscador, filtros comunes y orden; cada profesor enlaza a su ficha.
 * Incluye la prueba de orden de la tabla que antes vivía en el dashboard de métricas.
 */
import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/api';
import ProfessorsDirectoryPage from './ProfessorsDirectoryPage';
import { currentUrl, metricsApi, renderRoute } from '../testing/analysisFixtures';

vi.mock('../services/api', () => ({ api: { get: vi.fn() } }));

const renderPage = (path = '/docentes') => renderRoute(path, '/docentes', <ProfessorsDirectoryPage />);
const names = (table) => within(table).getAllByRole('rowheader').map((cell) => cell.textContent);

describe('ProfessorsDirectoryPage', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.get.mockImplementation(metricsApi);
  });

  it('lista a los profesores con departamento e intermediación, y enlaza a su ficha', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    expect(names(table)[0]).toMatch(/^Luis Paredes Ortega/); // por obras, de mayor a menor
    expect(within(table).getByRole('link', { name: 'Ana Morales' })).toHaveAttribute('href', '/docentes/a');
    expect(within(table).getByRole('columnheader', { name: /Departamento/ })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: /Intermediación/ })).toBeInTheDocument();
    expect(screen.getByText('3 de 3 profesores')).toBeInTheDocument();
  });

  it('ordena por columna y por el selector, y guarda el orden en la URL', async () => {
    const user = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: /Índice h/ }));
    expect(names(table)[0]).toMatch(/^Ana Morales/);
    expect(within(table).getByRole('columnheader', { name: /Índice h/ })).toHaveAttribute('aria-sort', 'descending');
    expect(currentUrl()).toContain('orden=h_index');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Ordenar por' }), 'betweenness');
    expect(names(table)[0]).toMatch(/^Luis Paredes Ortega/);
    expect(currentUrl()).toContain('orden=betweenness');
  });

  it('busca por nombre sin distinguir tildes ni mayúsculas', async () => {
    const user = renderPage();
    await screen.findByRole('table');
    await user.type(screen.getByRole('searchbox', { name: 'Buscar profesor por nombre' }), 'pia');
    expect(names(screen.getByRole('table'))).toHaveLength(1);
    expect(names(screen.getByRole('table'))[0]).toMatch(/^Pía Torres/);
    expect(screen.getByText('1 de 3 profesores')).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: 'Buscar profesor por nombre' }));
    await user.type(screen.getByRole('searchbox', { name: 'Buscar profesor por nombre' }), 'zzz');
    expect(screen.getByText('Ningún profesor coincide con la búsqueda o los filtros elegidos.')).toBeInTheDocument();
  });

  it('filtra por departamento con los filtros comunes', async () => {
    const user = renderPage();
    await screen.findByRole('table');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Departamento' }), 'Computación');
    expect(api.get).toHaveBeenLastCalledWith('/metrics/professors', { params: { department: 'Computación' } });
    expect(currentUrl()).toContain('department=Computaci');
  });
});
