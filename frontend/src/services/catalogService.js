/**
 * Fuente de datos del catálogo público - T-HU05-01 (PGPCECMC-47) y T-HU06-01 (PGPCECMC-53).
 *
 * Hoy responde con datos de ejemplo (src/data/catalogSample.js), porque el servicio público aún
 * no existe. Las funciones ya tienen la forma del contrato propuesto, así que la integración
 * (T-HU05-05 y T-HU06-05, Alejandro Ortiz) solo reemplaza su cuerpo por la llamada a la API,
 * cuando Demian publique T-HU05-03 y T-HU06-03. Contrato propuesto (a acordar con Demian):
 *
 *   GET /api/v1/public/products?q=&type=&owner_id=&year_from=&year_to=&research_line=&page=&page_size=
 *     -> 200 { items: PublicProduct[], total, page, page_size }       (sin sesión, solo verificados)
 *   GET /api/v1/public/products/{id}
 *     -> 200 PublicProduct (con abstract) | 404 si no existe o no es público
 *   GET /api/v1/public/professors
 *     -> 200 [{ id, full_name }]   (profesores con productos visibles, para el filtro F-02)
 *
 * PublicProduct (campos públicos de la tabla 3.3, CA14):
 *   { id, type, title, authors[], year, research_line, venue, doi, project_code,
 *     project_status, source, owner: { id, full_name }, abstract? }
 * Nunca incluye estado de revisión, correo, usuario, motivo de rechazo ni datos de auditoría.
 */
import { SAMPLE_PRODUCTS, SAMPLE_PROFESSORS } from '../data/catalogSample';
import { applyCatalogFilters, sortCatalog } from '../utils/catalogFilters';

export const CATALOG_PAGE_SIZE = 10;

/** true mientras el catálogo use datos de ejemplo; la página lo avisa al visitante. */
export const USES_SAMPLE_DATA = true;

// RV-01 (T-HU05-02): el público solo ve productos verificados.
const PUBLIC_STATUS = 'verificado';

/** Deja solo los campos públicos de un producto (CA14). */
function toPublicProduct(product, { withAbstract = false } = {}) {
  const publicProduct = {
    id: product.id,
    type: product.type,
    title: product.title,
    authors: product.authors,
    year: product.year,
    research_line: product.research_line,
    venue: product.venue ?? null,
    doi: product.doi ?? null,
    project_code: product.project_code ?? null,
    project_status: product.project_status ?? null,
    source: product.source,
    owner: product.owner ? { id: product.owner.id, full_name: product.owner.full_name } : null,
  };
  if (withAbstract) publicProduct.abstract = product.abstract ?? null;
  return publicProduct;
}

const visibleProducts = () => SAMPLE_PRODUCTS.filter((product) => product.status === PUBLIC_STATUS);

export async function listPublicProducts({ filters, page = 1, pageSize = CATALOG_PAGE_SIZE }) {
  const matches = sortCatalog(applyCatalogFilters(visibleProducts(), filters));
  const start = (page - 1) * pageSize;
  return {
    items: matches.slice(start, start + pageSize).map((product) => toPublicProduct(product)),
    total: matches.length,
    page,
    page_size: pageSize,
  };
}

/** Devuelve el producto público o null si no existe o no es visible (equivale al 404). */
export async function getPublicProduct(id) {
  const product = visibleProducts().find((item) => item.id === id);
  return product ? toPublicProduct(product, { withAbstract: true }) : null;
}

/** Profesores con al menos un producto visible, ordenados por nombre (filtro F-02). */
export async function listCatalogProfessors() {
  const ownerIds = new Set(visibleProducts().map((product) => product.owner?.id));
  return SAMPLE_PROFESSORS.filter((professor) => ownerIds.has(professor.id))
    .map(({ id, full_name }) => ({ id, full_name }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'es'));
}
