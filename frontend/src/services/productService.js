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

/**
 * Deja el DOI en su forma canónica: sin "https://doi.org/", sin "doi:" y en minúsculas.
 * Misma regla que normalizeDoi() del prototipo, para detectar duplicados igual.
 */
export function normalizeDoi(rawDoi) {
  if (!rawDoi) return '';
  return rawDoi
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '')
    .replace(/^doi:\s*/, '')
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
export async function createProduct(product) {
  const { data } = await api.post('/products', product);
  return data;
}
