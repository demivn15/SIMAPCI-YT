/**
 * Servicio de productos del frontend - T-HU03-01 (PGPCECMC-32).
 *
 * Define el CONTRATO que el formulario espera del backend. Los endpoints
 * todavía no existen; se implementan en:
 *   - GET  /integrations/doi/{doi}  -> T-HU03-02 (PGPCECMC-33, adaptador DOI/ORCID)
 *   - POST /products                -> T-HU03-03/04/05 (mapeo, validación y persistencia)
 * Si el backend cambia este contrato, solo hay que ajustar este archivo.
 */
import { api } from './api';

/** Decodifica "%2F" y similares; si el texto trae un "%" suelto, lo deja como está. */
function decodeUrlText(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * Deja el DOI en su forma canónica (regla RU-02, T-HU07-02 / PGPCECMC-60): sin
 * "https://doi.org/", "https://www.doi.org/", "doi.org/" ni "doi:", con "%2F"
 * decodificado y en minúsculas. Misma regla que normalize_doi() del backend
 * (app/utils/identifiers.py), para detectar duplicados igual en ambos lados.
 */
export function normalizeDoi(rawDoi) {
  if (!rawDoi) return '';
  return decodeUrlText(rawDoi.trim())
    .toLowerCase()
    .replace(/^(?:(?:https?:\/\/)?(?:www\.|dx\.)?doi\.org\/|doi:\s*)/, '')
    .trim()
    .replace(/\/+$/, '');
}

/** Un DOI siempre empieza con "10." seguido del prefijo, una barra y un sufijo. */
export function isValidDoi(doi) {
  return /^10\.\d{4,9}\/\S+$/.test(doi);
}

/**
 * Consulta los metadatos de un DOI para precargar el formulario (CA07).
 * Respuesta esperada (200): { doi, title, authors: string[], year, venue, abstract }
 * 404 = el DOI no existe · 502/503/504 = el servicio externo no responde (CA08)
 */
export async function lookupDoi(doi) {
  const { data } = await api.get(`/integrations/doi/${encodeURIComponent(doi)}`);
  return data;
}

/**
 * Registra el producto a nombre del profesor autenticado (CA09).
 * Respuesta esperada (201): { id, status: 'cargado', ... }
 * 409 = DOI o código de proyecto ya registrado · 422 = datos inválidos
 */
/**
 * Consulta previa de existencia (T-HU07-02, PGPCECMC-60; CA19, CA20, CA21).
 * GET /products/exists?doi=...&project_code=...  (requiere sesión de profesor)
 * Respuesta (200): { verifiable, exists, field, normalized_identifier, public_product_id }
 *   - verifiable=false: no hay identificador; se puede seguir con el aviso de CA21.
 *   - exists=true: ya está registrado; field indica si coincidió el DOI o el código.
 *   - public_product_id: solo si el producto existente es público (para enlazarlo).
 * 422 = DOI con formato inválido. Es informativa: POST /products vuelve a verificar (409).
 * Su uso en el formulario corresponde a T-HU07-05 (PGPCECMC-63).
 */
export async function checkProductExistence({ doi, projectCode } = {}) {
  const params = {};
  if (doi) params.doi = doi;
  if (projectCode) params.project_code = projectCode;
  const { data } = await api.get('/products/exists', { params });
  return data;
}

export async function createProduct(product) {
  const { data } = await api.post('/products', product);
  return data;
}

export const uploadAndExtractPdf = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/api/v1/integrations/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};
