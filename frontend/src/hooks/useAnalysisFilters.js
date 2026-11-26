/**
 * Filtros comunes del análisis, leídos y escritos en la URL (ver utils/analysisFilters.js).
 * Las opciones salen de GET /metrics/filters y se piden una sola vez por sesión de navegación.
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getFilterOptions } from '../services/metricsService';
import {
  EMPTY_ANALYSIS_FILTERS,
  readAnalysisFilters,
  toApiParams,
  writeAnalysisFilters,
} from '../utils/analysisFilters';

export const FILTER_OPTIONS_KEY = ['metrics', 'filters'];

export default function useAnalysisFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const optionsQuery = useQuery({
    queryKey: FILTER_OPTIONS_KEY,
    queryFn: getFilterOptions,
    staleTime: 10 * 60 * 1000,
  });
  const options = optionsQuery.data ?? null;

  const filters = useMemo(() => readAnalysisFilters(searchParams, options), [searchParams, options]);
  const apiParams = useMemo(() => toApiParams(filters), [filters]);

  const setFilters = useCallback(
    (next) => setSearchParams((current) => writeAnalysisFilters(current, next), { replace: true }),
    [setSearchParams],
  );
  const resetFilters = useCallback(() => setFilters(EMPTY_ANALYSIS_FILTERS), [setFilters]);

  return { filters, apiParams, setFilters, resetFilters, options, optionsQuery };
}
