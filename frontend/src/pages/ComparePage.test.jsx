/**
 * Comparar docentes: la selección vive en la URL (`?ids=a,b`), de 2 a 4 profesores, con tabla
 * lado a lado y coautores en común.
 */
import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/api';
import ComparePage from './ComparePage';
import { currentUrl, metricsApi, renderRoute } from '../testing/analysisFixtures';

vi.mock('../services/api', () => ({ api: { get: vi.fn() } }));

const renderPage = (path) => renderRoute(path, '/comparar', <ComparePage />);

describe('ComparePage', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.get.mockImplementation(metricsApi);
  });

  it('lee la selección de la URL y compara lado a lado', async () => {
    renderPage('/comparar?ids=a,p');
    const table = await screen.findByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(headers).toEqual(['Indicador', 'A. Morales', 'P. Torres']);
    const row = (label) => within(table).getByRole('rowheader', { name: label }).closest('tr');
    expect(within(row('Índice h')).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['2', '0']);
    expect(within(row('Departamento')).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'Matemáticas',
      'Computación',
    ]);
    // Ana y Pía no publican juntas, pero ambas lo hacen con Luis.
    const common = await screen.findByRole('heading', { name: 'Coautores en común' });
    expect(await within(common.closest('section')).findByRole('link', { name: 'Luis Paredes Ortega' })).toHaveAttribute(
      'href',
      '/docentes/l',
    );
  });

  it('agrega y quita profesores escribiendo la selección en la URL', async () => {
    const user = renderPage('/comparar?ids=a');
    expect(await screen.findByText('Agregue al menos dos profesores para comparar.')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Buscar profesor para agregar' }), 'luis');
    await user.click(screen.getByRole('button', { name: /Luis Paredes Ortega/ }));
    expect(currentUrl()).toBe('/comparar?ids=a%2Cl');
    expect(await screen.findByRole('table')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Quitar a Ana Morales' }));
    expect(currentUrl()).toBe('/comparar?ids=l');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('ignora identificadores inválidos o repetidos en la URL', async () => {
    renderPage('/comparar?ids=a,a,%3Cx%3E');
    expect(await screen.findByText('Profesores a comparar (1 de 4)')).toBeInTheDocument();
  });
});
