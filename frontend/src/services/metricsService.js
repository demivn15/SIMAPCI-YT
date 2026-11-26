/**
 * Métricas del dashboard público - HU09 (por profesor) y HU10 (evolución de la Escuela).
 * Rutas sin sesión del backend (app/api/v1/metrics.py): agregados del catálogo verificado.
 */
import { api } from './api';

export async function getMetricsOverview() {
  const { data } = await api.get('/metrics/overview');
  return data;
}

export async function getMetricsTimeline() {
  const { data } = await api.get('/metrics/timeline');
  return data.items;
}

export async function getProfessorMetrics() {
  const { data } = await api.get('/metrics/professors');
  return data.items;
}

export async function getCollaborationMetrics() {
  const { data } = await api.get('/metrics/collaboration');
  return data;
}
