/**
 * Catálogo público - T-HU05-01 (PGPCECMC-47) y T-HU06-01 (PGPCECMC-53).
 * Criterios CA13, CA14 (HU05) y CA16, CA17, CA18 (HU06); reglas RV-01 y RFL-01 a RFL-05.
 *
 * Usa la fuente de datos de ejemplo (services/catalogService.js), sin backend ni sesión.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import PublicCatalogPage from './PublicCatalogPage';
import PublicProductPage from './PublicProductPage';
import AccessScreen from '../components/portal/AccessScreen';

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false, user: null }) }));

/** Muestra la búsqueda actual de la URL para comprobar RFL-05. */
function UrlProbe() {
  const location = useLocation();
  return <output data-testid="url">{location.pathname + location.search}</output>;
}

function renderAt(path) {
  const user = userEvent.setup();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<AccessScreen />} />
          <Route path="/produccion" element={<PublicCatalogPage />} />
          <Route path="/produccion/:productId" element={<PublicProductPage />} />
        </Routes>
        <UrlProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return user;
}

const entryTitles = () => screen.queryAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
const url = () => screen.getByTestId('url').textContent;

describe('listado público (HU05)', () => {
  it('CA13: un visitante ve el listado sin iniciar sesión, solo con productos verificados (RV-01)', async () => {
    renderAt('/produccion');

    expect(await screen.findByText('14 productos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Iniciar sesión/ })).toHaveAttribute('href', '/login');
    expect(screen.queryByText(/Borrador pendiente/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Registro rechazado/)).not.toBeInTheDocument();
  });

  it('agrupa por año, del más reciente al más antiguo, y pagina de 10 en 10', async () => {
    const user = renderAt('/produccion');
    await screen.findByText('14 productos');

    const years = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(years.slice(0, 2)).toEqual(['2025', '2024']);
    expect(entryTitles()).toHaveLength(10);

    await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(url()).toBe('/produccion?page=2');
    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
    expect(entryTitles()).toHaveLength(4);
  });

  it('el inicio público enlaza al catálogo', async () => {
    const user = renderAt('/');
    await user.click(screen.getByRole('link', { name: /Consultar la producción científica/ }));
    expect(url()).toBe('/produccion');
  });
});

describe('filtros (HU06)', () => {
  it('CA16 y RFL-01: combina tipo, profesor y periodo, y los refleja en la URL', async () => {
    const user = renderAt('/produccion');
    await screen.findByText('14 productos');

    await user.selectOptions(screen.getByLabelText('Tipo de producto'), 'publicacion');
    await user.selectOptions(screen.getByLabelText('Profesor'), 'prof-ana');
    await user.selectOptions(screen.getByLabelText('Desde el año'), '2021');

    expect(await screen.findByText('2 productos')).toBeInTheDocument();
    expect(url()).toBe('/produccion?type=publicacion&owner_id=prof-ana&year_from=2021');
    expect(entryTitles()).toEqual([
      'Redes neuronales informadas por la física para ecuaciones de reacción-difusión',
      'Clasificación de especies de anfibios andinos a partir de sus vocalizaciones',
    ]);
  });

  it('CA18: muestra los filtros activos y permite quitarlos uno por uno', async () => {
    const user = renderAt('/produccion?type=proyecto&year_from=2023&year_to=2025');
    await screen.findByText('3 productos');

    const chips = within(screen.getByRole('list', { name: 'Filtros aplicados' }));
    expect(chips.getByRole('button', { name: 'Quitar filtro Tipo: Proyecto de investigación' })).toBeInTheDocument();

    await user.click(chips.getByRole('button', { name: 'Quitar filtro Periodo: 2023 a 2025' }));
    expect(url()).toBe('/produccion?type=proyecto');
    expect(await screen.findByText('4 productos')).toBeInTheDocument();
  });

  it('la búsqueda de texto se aplica al confirmar y vuelve a la página 1 (RFL-03)', async () => {
    const user = renderAt('/produccion?page=2');
    await screen.findByText('Página 2 de 2');

    await user.type(screen.getByRole('searchbox'), 'optimizacion{Enter}');

    expect(url()).toBe('/produccion?q=optimizacion');
    expect(await screen.findByText('1 producto')).toBeInTheDocument();
    expect(entryTitles()).toEqual(['Optimización de rutas para el transporte público de Ibarra']);
  });

  it('CA17: sin coincidencias muestra el estado vacío y «Limpiar filtros» restaura el listado', async () => {
    const user = renderAt('/produccion?type=proyecto&q=topolog%C3%ADa');

    expect(await screen.findByRole('heading', { name: 'Ningún producto coincide con estos filtros' })).toBeInTheDocument();
    expect(entryTitles()).toEqual([]);

    const emptyState = screen.getByRole('heading', { name: /Ningún producto/ }).parentElement;
    await user.click(within(emptyState).getByRole('button', { name: 'Limpiar filtros' }));

    expect(url()).toBe('/produccion');
    expect(await screen.findByText('14 productos')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('un enlace con valores inválidos no rompe la página', async () => {
    renderAt('/produccion?type=libro&year_from=abc');
    expect(await screen.findByText('14 productos')).toBeInTheDocument();
  });
});

describe('detalle público (HU05, CA14)', () => {
  it('muestra los datos públicos y ningún dato privado de la cuenta', async () => {
    renderAt('/produccion/p-01');

    expect(
      await screen.findByRole('heading', { level: 1, name: /Redes neuronales informadas por la física/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Journal of Computational Physics')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /10.5555\/simapci.2025.001/ })).toHaveAttribute(
      'href',
      'https://doi.org/10.5555/simapci.2025.001',
    );
    expect(screen.getByText('Importado desde ORCID')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Resumen' })).toBeInTheDocument();
    expect(screen.queryByText(/@yachaytech\.edu\.ec/)).not.toBeInTheDocument();
  });

  it('un proyecto muestra su código y estado en lugar de revista y DOI', async () => {
    renderAt('/produccion/p-03');

    expect(await screen.findByText('ECMC-2025-03')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.queryByText('DOI')).not.toBeInTheDocument();
  });

  it.each(['p-15', 'p-16', 'no-existe'])('%s: un producto no público o inexistente no se muestra (RU-08)', async (id) => {
    renderAt(`/produccion/${id}`);
    expect(await screen.findByRole('heading', { name: 'Producto no disponible' })).toBeInTheDocument();
    expect(screen.queryByText(/No visible para el público/)).not.toBeInTheDocument();
  });

  it('«Volver a los resultados» conserva los filtros con los que se llegó', async () => {
    const user = renderAt('/produccion?type=proyecto');
    await screen.findByText('4 productos');

    await user.click(screen.getByRole('link', { name: 'Simulación de flujos de lava en arquitecturas GPU' }));
    await screen.findByRole('heading', { level: 1, name: /Simulación de flujos de lava/ });
    await user.click(screen.getByRole('link', { name: /Volver a los resultados/ }));

    expect(url()).toBe('/produccion?type=proyecto');
    expect(await screen.findByText('4 productos')).toBeInTheDocument();
  });
});
