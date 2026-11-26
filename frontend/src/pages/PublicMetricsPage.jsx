/**
 * Inicio: la Escuela en cifras - HU09 (por profesor) y HU10 (evolución de la Escuela).
 * Lee los agregados de /api/v1/metrics/*, calculados sobre el catálogo verificado, con los
 * filtros comunes del análisis (en la URL). La red de coautoría y la tabla por profesor viven
 * ahora en las pestañas Colaboraciones y Docentes.
 */
import { useQueries } from '@tanstack/react-query';
import AnalysisFilters from '../components/analysis/AnalysisFilters';
import { ErrorState, LoadingState, SourceNote } from '../components/analysis/QueryState';
import IndicatorStrip from '../components/metrics/IndicatorStrip';
import TimelineChart from '../components/metrics/TimelineChart';
import CitationsChart from '../components/metrics/CitationsChart';
import ContributionTypesChart from '../components/metrics/ContributionTypesChart';
import ResearchLinesChart from '../components/metrics/ResearchLinesChart';
import ExternalCollaboration from '../components/metrics/ExternalCollaboration';
import useAnalysisFilters from '../hooks/useAnalysisFilters';
import { getCollaborationMetrics, getMetricsOverview, getMetricsTimeline } from '../services/metricsService';

export default function PublicMetricsPage() {
  const { filters, apiParams, setFilters, resetFilters, options } = useAnalysisFilters();
  const [overview, timeline, collaboration] = useQueries({
    queries: [
      { queryKey: ['metrics', 'overview', apiParams], queryFn: () => getMetricsOverview(apiParams) },
      { queryKey: ['metrics', 'timeline', apiParams], queryFn: () => getMetricsTimeline(apiParams) },
      { queryKey: ['metrics', 'collaboration', apiParams], queryFn: () => getCollaborationMetrics(apiParams) },
    ],
  });
  const all = [overview, timeline, collaboration];
  const isLoading = all.some((query) => query.isPending);
  const failed = all.filter((query) => query.isError);

  return (
    <>
      <header className="catalog-intro metrics-intro">
        <h1 className="display">La Escuela en cifras</h1>
        <p>Lo que publican los profesores de la Escuela, cómo evoluciona y con quién colaboran.</p>
        <SourceNote overview={overview.data} />
      </header>

      <AnalysisFilters filters={filters} options={options} onChange={setFilters} onReset={resetFilters} />

      {isLoading && <LoadingState>Calculando métricas…</LoadingState>}

      {!isLoading && failed.length > 0 && (
        <ErrorState queries={failed}>No se pudieron cargar las métricas. Revise su conexión e inténtelo de nuevo.</ErrorState>
      )}

      {!isLoading && failed.length === 0 && (
        <div className="metrics-body">
          <IndicatorStrip overview={overview.data} />
          <TimelineChart timeline={timeline.data} />
          <div className="metrics-columns">
            <CitationsChart timeline={timeline.data} />
            <ContributionTypesChart types={overview.data.contribution_types} />
          </div>
          <div className="metrics-columns">
            <ResearchLinesChart lines={overview.data.research_lines} />
            <ExternalCollaboration
              countries={collaboration.data.countries}
              institutions={collaboration.data.institutions}
            />
          </div>
        </div>
      )}
    </>
  );
}
