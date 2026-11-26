/**
 * Dashboard público de métricas - HU09 (por profesor) y HU10 (evolución de la Escuela).
 * Lee los agregados de /api/v1/metrics/*, calculados sobre el catálogo verificado.
 */
import { useQueries } from '@tanstack/react-query';
import PublicShell from '../components/catalog/PublicShell';
import IndicatorStrip from '../components/metrics/IndicatorStrip';
import TimelineChart from '../components/metrics/TimelineChart';
import ResearchLinesChart from '../components/metrics/ResearchLinesChart';
import ExternalCollaboration from '../components/metrics/ExternalCollaboration';
import CollaborationGraph from '../components/metrics/CollaborationGraph';
import ProfessorsTable from '../components/metrics/ProfessorsTable';
import {
  getCollaborationMetrics,
  getMetricsOverview,
  getMetricsTimeline,
  getProfessorMetrics,
} from '../services/metricsService';

const dateFormat = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });

export default function PublicMetricsPage() {
  const [overview, timeline, professors, collaboration] = useQueries({
    queries: [
      { queryKey: ['metrics', 'overview'], queryFn: getMetricsOverview },
      { queryKey: ['metrics', 'timeline'], queryFn: getMetricsTimeline },
      { queryKey: ['metrics', 'professors'], queryFn: getProfessorMetrics },
      { queryKey: ['metrics', 'collaboration'], queryFn: getCollaborationMetrics },
    ],
  });
  const all = [overview, timeline, professors, collaboration];
  const isLoading = all.some((query) => query.isPending);
  const failed = all.filter((query) => query.isError);

  return (
    <PublicShell>
      <header className="catalog-intro metrics-intro">
        <h1 className="display">Métricas de producción</h1>
        <p>Lo que publican los profesores de la Escuela, cómo evoluciona y con quién colaboran.</p>
        {overview.data && (
          <p className="catalog-sample-note">
            Calculado con {overview.data.total_products} obras verificadas
            {overview.data.year_from ? ` (${overview.data.year_from}–${overview.data.year_to})` : ''}. Citas,
            cuartiles y colaboración según ORCID, OpenAlex y SCImago
            {overview.data.data_as_of ? `, consultados el ${dateFormat.format(new Date(overview.data.data_as_of))}` : ''}.
          </p>
        )}
      </header>

      {isLoading && (
        <div className="catalog-loading" role="status">
          <div className="spinner" aria-hidden="true" />
          Calculando métricas…
        </div>
      )}

      {!isLoading && failed.length > 0 && (
        <div className="notice notice-error catalog-error" role="alert">
          <span>No se pudieron cargar las métricas. Revise su conexión e inténtelo de nuevo.</span>
          <button type="button" className="btn btn-outline" onClick={() => failed.forEach((query) => query.refetch())}>
            Reintentar
          </button>
        </div>
      )}

      {!isLoading && failed.length === 0 && (
        <div className="metrics-body">
          <IndicatorStrip overview={overview.data} />
          <TimelineChart timeline={timeline.data} />

          <section className="metrics-section metrics-section-graph" aria-labelledby="metrics-graph-title">
            <div className="metrics-section-head">
              <div>
                <h2 id="metrics-graph-title">Red de coautoría en la Escuela</h2>
                <p>Quién publica con quién entre los profesores de la Escuela.</p>
              </div>
            </div>
            <CollaborationGraph nodes={collaboration.data.nodes} edges={collaboration.data.edges} />
          </section>

          <div className="metrics-columns">
            <ResearchLinesChart lines={overview.data.research_lines} />
            <ExternalCollaboration
              countries={collaboration.data.countries}
              institutions={collaboration.data.institutions}
            />
          </div>

          <ProfessorsTable professors={professors.data} />
        </div>
      )}
    </PublicShell>
  );
}
