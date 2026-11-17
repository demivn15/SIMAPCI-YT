/**
 * T-HU02-03 (PGPCECMC-27): mientras hay sesión, el frontend renueva el token cada 30 minutos.
 * Si la renovación falla, vuelve a consultar el perfil para que ProtectedRoute lleve al login.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { api } from '../services/api';

vi.mock('../services/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const TREINTA_MIN = 30 * 60 * 1000;

function Usuario() {
  const { user } = useAuth();
  return <p>{user ? `sesión de ${user.username}` : 'sin sesión'}</p>;
}

function renderizar() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <Usuario />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
});

afterEach(() => vi.useRealTimers());

it('renueva el token cada 30 minutos mientras hay sesión', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { username: 'mgarcia', role: 'professor' } });
  vi.mocked(api.post).mockResolvedValue({ data: { message: 'Session refreshed' } });

  renderizar();
  expect(await screen.findByText('sesión de mgarcia')).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();

  await act(async () => {
    vi.advanceTimersByTime(TREINTA_MIN);
  });
  expect(api.post).toHaveBeenCalledWith('/auth/refresh');
});

it('no intenta renovar si no hay sesión', async () => {
  vi.mocked(api.get).mockRejectedValue(Object.assign(new Error('HTTP 401'), { response: { status: 401 } }));

  renderizar();
  expect(await screen.findByText('sin sesión')).toBeInTheDocument();

  await act(async () => {
    vi.advanceTimersByTime(TREINTA_MIN);
  });
  expect(api.post).not.toHaveBeenCalled();
});

it('si la renovación falla vuelve a consultar el perfil', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { username: 'mgarcia', role: 'professor' } });
  vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('HTTP 401'), { response: { status: 401 } }));

  renderizar();
  expect(await screen.findByText('sesión de mgarcia')).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(1);

  await act(async () => {
    vi.advanceTimersByTime(TREINTA_MIN);
  });
  await vi.waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
});
