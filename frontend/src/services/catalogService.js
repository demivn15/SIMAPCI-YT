/**
 * Servicio del catálogo público - T-HU05-05 (PGPCECMC-51) y T-HU06-05 (PGPCECMC-57).
 */
import { api } from './api';

export const CATALOG_PAGE_SIZE = 10;

export async function listPublicProducts({
  filters = {},
  page = 1,
  pageSize = CATALOG_PAGE_SIZE,
} = {}) {
  const params = {
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
  for (const [key, value] of Object.entries(filters)) {
    if (value) params[key] = value;
  }

  const { data } = await api.get('/products/catalog', {
    params,
  });

  return {
    items: data.items,
    total: data.total,
    page,
    page_size: pageSize,
  };
}

export async function listCatalogProfessors() {
  const { data } = await api.get('/products/catalog/professors');
  return data;
}

/** Devuelve null si el producto no existe o no está publicado; propaga los demás errores. */
export async function getPublicProduct(id) {
  try {
    const { data } = await api.get(`/products/catalog/${encodeURIComponent(id)}`);
    return data;
  } catch (error) {
    if (error.response?.status === 404) return null;
    throw error;
  }
}
