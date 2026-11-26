/**
 * Servicio del catálogo público - T-HU05-05 (PGPCECMC-51).
 *
 * Usa las rutas públicas del catálogo consolidado. Los filtros de HU06 se integrarán cuando
 * el backend publique el contrato correspondiente.
 */
import { api } from './api';

export const CATALOG_PAGE_SIZE = 10;

export async function listPublicProducts({ page = 1, pageSize = CATALOG_PAGE_SIZE } = {}) {
  const { data } = await api.get('/products/catalog', {
    params: {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    },
  });

  return {
    items: data.items,
    total: data.total,
    page,
    page_size: pageSize,
  };
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
