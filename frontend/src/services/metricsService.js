/**
 * Métricas y análisis de redes - HU09 (por profesor), HU10 (evolución de la Escuela) y redes de
 * colaboración. Rutas sin sesión del backend (app/api/v1/metrics.py): agregados del catálogo
 * verificado. Todas aceptan los filtros comunes (`params`, ver utils/analysisFilters.js).
 */
import { api } from './api';

// Sin filtros no se envía `params`: la URL queda igual que antes de los filtros comunes.
const get = async (url, params) =>
  (await api.get(url, params && Object.keys(params).length > 0 ? { params } : undefined)).data;

export const getFilterOptions = () => get('/metrics/filters');

export const getMetricsOverview = (params) => get('/metrics/overview', params);

export async function getMetricsTimeline(params) {
  return (await get('/metrics/timeline', params)).items;
}

export async function getProfessorMetrics(params) {
  return (await get('/metrics/professors', params)).items;
}

export const getProfessorProfile = (professorId, params) =>
  get(`/metrics/professors/${encodeURIComponent(professorId)}`, params);

export const getCollaborationMetrics = (params) => get('/metrics/collaboration', params);

export const getNetworkMetrics = (params) => get('/metrics/network', params);

export const getCoauthorshipNetwork = (params) => get('/metrics/networks/coauthorship', params);

export const getInstitutionsNetwork = (params, minCount) =>
  get('/metrics/networks/institutions', { ...params, min_count: minCount });

export const getCountriesNetwork = (params) => get('/metrics/networks/countries', params);

export const getResearchLinesNetwork = (params) => get('/metrics/networks/research-lines', params);

export const getPeriodsNetwork = (params) => get('/metrics/networks/periods', params);
