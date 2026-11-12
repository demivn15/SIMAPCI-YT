/**
 * PR-HU02-02 (PGPCECMC-102), lado de la pantalla - CA06: sin sesión, la vista
 * pública está disponible y las funciones privadas redirigen al login.
 * Responsable: Camilo Vásquez (tester).
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { api } from './services/api';

vi.mock('./services/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const sinSesion = Object.assign(new Error('HTTP 401'), { response: { status: 401 } });

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.get).mockRejectedValue(sinSesion);
});

describe('CA06 · vista pública y funciones privadas sin sesión', () => {
  it('CP-10: la página pública se ve sin sesión', async () => {
    window.history.pushState({}, '', '/');
    render(<App />);

    expect(await screen.findByRole('heading', { name: /Producción científica de la ECMC/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Acceso para profesores' })).toHaveAttribute('href', '/login');
  });

  it('CP-11: el registro de productos sin sesión lleva al login', async () => {
    window.history.pushState({}, '', '/products/new');
    render(<App />);

    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });

  it('CP-12: una ruta desconocida lleva a la vista pública, no al panel privado', async () => {
    window.history.pushState({}, '', '/no-existe');
    render(<App />);

    expect(await screen.findByRole('heading', { name: /Producción científica de la ECMC/ })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });
});
