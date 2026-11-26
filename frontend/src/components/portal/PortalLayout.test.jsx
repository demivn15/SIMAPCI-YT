/**
 * Portal con pestañas: la misma barra lateral para el visitante y el profesor.
 * - Sin sesión: pestañas públicas y «Iniciar sesión».
 * - Profesor: además «Mi panel», su nombre y «Cerrar sesión».
 * - La pestaña activa lleva aria-current="page"; hay enlace «Ir al contenido» y barra móvil.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PortalLayout from './PortalLayout';

const auth = { user: null, isAuthenticated: false, logout: vi.fn() };
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));

function renderAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<PortalLayout />}>
          <Route path="*" element={<p>Contenido</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  return userEvent.setup();
}

const mainNav = () => screen.getByRole('navigation', { name: 'Navegación principal' });
const tabNames = () => within(mainNav()).getAllByRole('link').map((link) => link.textContent);

const PUBLIC = [
  'Inicio',
  'Publicaciones y proyectos',
  'Docentes',
  'Colaboraciones',
  'Comparar docentes',
  'Cómo leer los indicadores',
];

describe('PortalLayout', () => {
  beforeEach(() => {
    Object.assign(auth, { user: null, isAuthenticated: false });
  });

  it('al visitante le muestra las pestañas públicas y «Iniciar sesión»', () => {
    renderAt('/inicio');
    expect(tabNames()).toEqual(PUBLIC);
    expect(screen.getByRole('link', { name: /Iniciar sesión/ })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: /Cerrar sesión/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Mi panel')).not.toBeInTheDocument();
  });

  it('al profesor le agrega «Mi panel», su nombre y «Cerrar sesión»', () => {
    Object.assign(auth, { user: { name: 'Ana Morales', role: 'professor' }, isAuthenticated: true });
    renderAt('/inicio');
    expect(tabNames()).toEqual(['Mi panel', ...PUBLIC]);
    expect(screen.getByText('Ana Morales')).toBeInTheDocument();
    expect(screen.getByText('Profesor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cerrar sesión/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Iniciar sesión/ })).not.toBeInTheDocument();
  });

  it('el Revisor ve las pestañas públicas (su pantalla aún no existe) y su rol', () => {
    Object.assign(auth, { user: { name: 'Rita', role: 'reviewer' }, isAuthenticated: true });
    renderAt('/inicio');
    expect(tabNames()).toEqual(PUBLIC);
    expect(screen.getByText('Revisor')).toBeInTheDocument();
  });

  it('marca la pestaña activa con aria-current, también en las rutas hijas', () => {
    renderAt('/docentes/abc');
    expect(within(mainNav()).getByRole('link', { name: 'Docentes' })).toHaveAttribute('aria-current', 'page');
    expect(within(mainNav()).getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });

  it('«Mi panel» sigue activo mientras el profesor registra un producto', () => {
    Object.assign(auth, { user: { name: 'Ana', role: 'professor' }, isAuthenticated: true });
    renderAt('/products/new');
    expect(within(mainNav()).getByRole('link', { name: 'Mi panel' })).toHaveAttribute('aria-current', 'page');
  });

  it('ofrece «Ir al contenido», la marca SIMAPCI y la barra móvil con «Más»', async () => {
    const user = renderAt('/colaboraciones');
    expect(screen.getByRole('link', { name: 'Ir al contenido' })).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('link', { name: /SIMAPCI, volver a la bienvenida/ })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/SIMAPC(?!I)/);

    const mobile = screen.getByRole('navigation', { name: 'Navegación móvil' });
    expect(within(mobile).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Inicio',
      'Publicaciones',
      'Docentes',
    ]);
    const more = within(mobile).getByRole('button', { name: 'Más' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await user.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('portal-sidebar')).toHaveClass('is-open');
  });
});
