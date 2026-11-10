/**
 * T-HU01-06 (PGPCECMC-23) y T-HU01-07 (PGPCECMC-24): integración de la interfaz con el
 * servicio de registro (primer acceso) y mensajes de resultado. Criterios CA01, CA02, CA05.
 * Responsable: Camilo Vásquez.
 *
 * El backend se simula reemplazando api.post; la sesión se simula con useAuth.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from './DashboardPage';
import LoginPage from './LoginPage';
import { api } from '../services/api';
import { ACCOUNT_CREATED_MESSAGE, LOGIN_ERROR_MESSAGES } from '../utils/loginMessages';

vi.mock('../services/api', () => ({ api: { post: vi.fn(), get: vi.fn() } }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    user: { name: 'María García', username: 'mgarcia', email: 'mgarcia@yachaytech.edu.ec', role: 'professor' },
    logout: vi.fn(),
  }),
}));

const errorHttp = (status) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

function renderizarLogin() {
  const usuario = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return usuario;
}

async function iniciarSesion(usuario) {
  await usuario.type(screen.getByPlaceholderText('p. ej., jperez'), 'mgarcia');
  await usuario.type(screen.getByPlaceholderText('••••••••'), 'Clave-Prof-2026!');
  await usuario.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
}

beforeEach(() => {
  vi.mocked(api.post).mockReset();
});

describe('T-HU01-06 · confirmación del registro en el primer acceso (CA01)', () => {
  it('CP-01: primer acceso (account_created = true) muestra la confirmación en el panel', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { message: 'Login successful', account_created: true } });
    const usuario = renderizarLogin();

    await iniciarSesion(usuario);

    expect(await screen.findByRole('status')).toHaveTextContent(ACCOUNT_CREATED_MESSAGE);
    expect(api.post).toHaveBeenCalledWith('/auth/login', { username: 'mgarcia', password: 'Clave-Prof-2026!' });
  });

  it('CP-02: accesos siguientes (account_created = false) no repiten la confirmación', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { message: 'Login successful', account_created: false } });
    const usuario = renderizarLogin();

    await iniciarSesion(usuario);

    expect(await screen.findByText(/Welcome back/)).toBeInTheDocument();
    expect(screen.queryByText(ACCOUNT_CREATED_MESSAGE)).not.toBeInTheDocument();
  });
});

describe('T-HU01-07 · mensajes de rechazo del registro y del acceso (CA02, CA05)', () => {
  const casos = [
    [401, LOGIN_ERROR_MESSAGES.invalidCredentials],
    [403, LOGIN_ERROR_MESSAGES.inactiveAccount],
    [409, LOGIN_ERROR_MESSAGES.emailConflict],
    [422, LOGIN_ERROR_MESSAGES.incompleteForm],
    [503, LOGIN_ERROR_MESSAGES.serviceUnavailable],
  ];

  it.each(casos)('CP-03 HTTP %i: muestra un mensaje propio y se queda en el login', async (status, mensaje) => {
    vi.mocked(api.post).mockRejectedValue(errorHttp(status));
    const usuario = renderizarLogin();

    await iniciarSesion(usuario);

    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('CP-04: el mensaje no muestra el texto técnico del backend', async () => {
    const error = errorHttp(401);
    error.response.data = { detail: 'Invalid institutional credentials or unauthorized user role (Professors only).' };
    vi.mocked(api.post).mockRejectedValue(error);
    const usuario = renderizarLogin();

    await iniciarSesion(usuario);

    expect(await screen.findByRole('alert')).not.toHaveTextContent(/Professors only/);
  });
});
