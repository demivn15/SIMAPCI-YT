/**
 * Catálogo público - T-HU05-05 (PGPCECMC-51).
 * Verifica la integración con la API, paginación, estados vacío/error y detalle público.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/api';
import { SAMPLE_PRODUCTS } from '../data/catalogSample';
import { sortCatalog } from '../utils/catalogFilters';
import PublicCatalogPage from './PublicCatalogPage';
import PublicProductPage from './PublicProductPage';
import AccessScreen from '../components/portal/AccessScreen';

vi.mock('../services/api', () => ({ api: { get: vi.fn() } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false, user: null }) }));

const publicProducts = sortCatalog(SAMPLE_PRODUCTS.filter((product) => product.status === 'verificado')).map(
  (product) => {
    const publicProduct = { ...product };
    delete publicProduct.owner;
    return publicProduct;
  },
);

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

function notFoundError() {
  const error = new Error('not found');
  error.response = { status: 404 };
  return error;
}

beforeEach(() => {
  api.get.mockImplementation(async (path, { params } = {}) => {
    if (path === '/products/catalog') {
      const { limit, offset } = params;
      return {
        data: {
          total: publicProducts.length,
          items: publicProducts.slice(offset, offset + limit),
        },
      };
    }

    const id = decodeURIComponent(path.slice('/products/catalog/'.length));
    const product = publicProducts.find((item) => item.id === id);
    if (!product) throw notFoundError();
    return { data: { ...product, abstract: product.abstract ?? null } };
  });
});

describe('listado público (HU05)', () => {
  it('carga productos verificados sin requerir sesión y usa la paginación de la API', async () => {
    renderAt('/produccion');

    expect(await screen.findByText('14 productos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Iniciar sesión/ })).toHaveAttribute('href', '/login');
    expect(screen.queryByText(/Borrador pendiente/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Registro rechazado/)).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/products/catalog', { params: { limit: 10, offset: 0 } });
  });

  it('avanza de página con offset y conserva la página en la URL', async () => {
    const user = renderAt('/produccion');
    await screen.findByText('14 productos');

    const years = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(years.slice(0, 2)).toEqual(['2025', '2024']);
    expect(entryTitles()).toHaveLength(10);

    await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(url()).toBe('/produccion?page=2');
    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
    expect(entryTitles()).toHaveLength(4);
    expect(api.get).toHaveBeenLastCalledWith('/products/catalog', { params: { limit: 10, offset: 10 } });
  });

  it('limpia parámetros de filtros que el endpoint actual no soporta', async () => {
    renderAt('/produccion?type=proyecto&page=2');

    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
    expect(url()).toBe('/produccion?page=2');
  });

  it('muestra el estado vacío cuando el API no tiene productos verificados', async () => {
    api.get.mockResolvedValueOnce({ data: { total: 0, items: [] } });
    renderAt('/produccion');

    expect(await screen.findByRole('heading', { name: 'Todavía no hay productos publicados' })).toBeInTheDocument();
    expect(screen.getByText('0 productos')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Páginas de resultados' })).not.toBeInTheDocument();
  });

  it('muestra errores de red y permite reintentar sin confundirlos con un catálogo vacío', async () => {
    api.get.mockRejectedValueOnce(new Error('network error'));
    const user = renderAt('/produccion');

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el catálogo.');
    expect(screen.queryByRole('heading', { name: 'Todavía no hay productos publicados' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('14 productos')).toBeInTheDocument();
  });

  it('el inicio público enlaza al catálogo', async () => {
    const user = renderAt('/');
    await user.click(screen.getByRole('link', { name: /Consultar la producción científica/ }));
    expect(url()).toBe('/produccion');
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
    expect(screen.queryByText('Profesor responsable')).not.toBeInTheDocument();
  });

  it('un proyecto muestra su código y estado en lugar de revista y DOI', async () => {
    renderAt('/produccion/p-03');

    expect(await screen.findByText('ECMC-2025-03')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.queryByText('DOI')).not.toBeInTheDocument();
  });

  it.each(['p-15', 'p-16', 'no-existe'])('%s: un producto no público o inexistente no se muestra', async (id) => {
    renderAt(`/produccion/${id}`);
    expect(await screen.findByRole('heading', { name: 'Producto no disponible' })).toBeInTheDocument();
  });

  it('«Volver a los resultados» conserva la página desde la que se llegó', async () => {
    const user = renderAt('/produccion?page=2');
    await screen.findByText('Página 2 de 2');

    await user.click(screen.getByRole('link', { name: /Análisis espacio-temporal de casos de dengue/ }));
    await screen.findByRole('heading', { level: 1, name: /Análisis espacio-temporal de casos de dengue/ });
    await user.click(screen.getByRole('link', { name: /Volver a los resultados/ }));

    expect(url()).toBe('/produccion?page=2');
    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
  });
});
