/**
 * Ficha del profesor: indicadores, posición en la red con explicaciones, coautores enlazados,
 * y los dos casos de 404 (no existe / sin obras con los filtros elegidos).
 */
import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/api';
import ProfessorProfilePage from './ProfessorProfilePage';
import { currentUrl, metricsApi, notFoundError, renderRoute } from '../testing/analysisFixtures';

vi.mock('../services/api', () => ({ api: { get: vi.fn() } }));

const renderPage = (path) => renderRoute(path, '/docentes/:professorId', <ProfessorProfilePage />);

describe('ProfessorProfilePage', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.get.mockImplementation(metricsApi);
  });

  it('muestra indicadores, posición en la red y coautores con enlace a su ficha', async () => {
    renderPage('/docentes/l');
    expect(await screen.findByRole('heading', { level: 1, name: 'Luis Paredes Ortega' })).toBeInTheDocument();
    expect(screen.getByText(/Departamento de Computación/)).toBeInTheDocument();
    expect(screen.getByText('de 1 obras con citas conocidas')).toBeInTheDocument();

    const position = screen.getByRole('heading', { name: 'Posición en la red de coautoría' }).closest('section');
    for (const label of ['Intermediación', 'Grado', 'Cercanía', 'Vector propio', 'Agrupamiento', 'Comunidad']) {
      expect(within(position).getByText(label)).toBeInTheDocument();
    }
    expect(within(position).getByText(/sirve de puente/)).toBeInTheDocument();
    expect(within(position).getByText('Puesto 2 de 3 en la red.')).toBeInTheDocument();
    expect(within(position).getByText(/solo incluye a los profesores de la Escuela como autores/)).toBeInTheDocument();

    const coauthors = screen.getByRole('heading', { name: 'Coautores en la Escuela' }).closest('section');
    expect(within(coauthors).getByRole('link', { name: 'Ana Morales' })).toHaveAttribute('href', '/docentes/a');
    expect(screen.getByRole('group', { name: 'Red personal de Luis Paredes Ortega' })).toBeInTheDocument();
    expect(screen.getByText('España')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Comparar con otro docente/ })).toHaveAttribute('href', '/comparar?ids=l');
    // No hay enlace al catálogo por profesor: el catálogo aún no acepta ese filtro.
    expect(screen.queryByRole('link', { name: /Ver sus publicaciones/ })).not.toBeInTheDocument();
  });

  it('responde «Profesor no encontrado» a un 404 sin filtros', async () => {
    renderPage('/docentes/no-existe');
    expect(await screen.findByRole('heading', { name: 'Profesor no encontrado' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al directorio' })).toHaveAttribute('href', '/docentes');
    // Un 404 no se reintenta.
    expect(api.get.mock.calls.filter(([url]) => url === '/metrics/professors/no-existe')).toHaveLength(1);
  });

  it('con filtros activos explica que no hay obras y permite quitarlos', async () => {
    api.get.mockImplementation((url, config) =>
      url === '/metrics/professors/l' && config?.params ? Promise.reject(notFoundError()) : metricsApi(url),
    );
    const user = renderPage('/docentes/l?quartile=Q4');
    expect(await screen.findByRole('heading', { name: 'Sin obras con estos filtros' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Quitar los filtros' }));
    expect(currentUrl()).toBe('/docentes/l');
    expect(await screen.findByRole('heading', { level: 1, name: 'Luis Paredes Ortega' })).toBeInTheDocument();
  });
});
