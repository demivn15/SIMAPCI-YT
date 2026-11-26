/**
 * Ficha pública del profesor (/docentes/:professorId) - HU09 (CA25) y análisis de redes.
 * Indicadores, evolución anual por cuartil, líneas, posición en la red (cada centralidad con
 * una frase en lenguaje simple), red personal, coautores en la Escuela, e instituciones y
 * países con los que colabora. Respeta los filtros comunes del análisis.
 *
 * No hay enlace «Ver sus publicaciones»: el catálogo público aún no acepta filtro por profesor
 * (HU06 pendiente en la API).
 */
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, GitCompareArrows } from 'lucide-react';
import AnalysisFilters from '../components/analysis/AnalysisFilters';
import { ErrorState, LoadingState } from '../components/analysis/QueryState';
import TimelineChart from '../components/metrics/TimelineChart';
import ResearchLinesChart from '../components/metrics/ResearchLinesChart';
import ExternalCollaboration from '../components/metrics/ExternalCollaboration';
import NetworkGraph from '../components/network/NetworkGraph';
import useAnalysisFilters from '../hooks/useAnalysisFilters';
import { getProfessorProfile } from '../services/metricsService';
import { hasActiveAnalysisFilters } from '../utils/analysisFilters';
import { displayName, formatNumber, shortName, shortResearchLine } from '../utils/metricsFormat';
import {
  CENTRALITY_INFO,
  NETWORK_LIMITATION,
  departmentColor,
  formatDecimal,
  formatPrecise,
} from '../utils/networkFormat';

const POSITION_KEYS = ['betweenness', 'degree', 'closeness', 'eigenvector', 'clustering', 'community'];

function positionValue(key, network) {
  if (key === 'degree') return formatNumber(network.degree);
  if (key === 'community') return `${network.community + 1}`;
  return formatPrecise(network[key]);
}

function positionNote(key, network) {
  if (key === 'betweenness') return `Puesto ${network.betweenness_rank} de ${network.network_size} en la red.`;
  if (key === 'degree') return `${formatNumber(network.strength)} obras en coautoría con ellos.`;
  if (key === 'community') {
    return network.community_size > 1
      ? `Grupo de ${network.community_size} profesores que publican sobre todo entre sí.`
      : 'Todavía no forma grupo con otros profesores de la Escuela.';
  }
  if (key === 'eigenvector' && network.eigenvector === null) return 'No se pudo calcular para esta red.';
  return null;
}

function Indicators({ profile }) {
  const items = [
    { label: 'Obras verificadas', value: formatNumber(profile.products) },
    {
      label: 'Citas',
      value: formatNumber(profile.citations),
      note: `de ${formatNumber(profile.products_with_citations)} obras con citas conocidas`,
    },
    { label: 'Índice h', value: formatNumber(profile.h_index), note: 'con las citas conocidas' },
    { label: 'En revistas Q1 o Q2', value: formatNumber(profile.Q1 + profile.Q2) },
    { label: 'Obras con colegas de la Escuela', value: formatNumber(profile.coauthored_in_school) },
    {
      label: 'Periodo',
      value: profile.first_year === profile.last_year ? `${profile.first_year}` : `${profile.first_year}–${profile.last_year}`,
    },
  ];
  return (
    <dl className="metrics-indicators">
      {items.map((item) => (
        <div key={item.label} className="metrics-indicator">
          <dt>{item.label}</dt>
          <dd>
            <span className="metrics-indicator-value">{item.value}</span>
            {item.note && <span className="metrics-indicator-note">{item.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function NotFound({ filtered, onReset }) {
  return (
    <div className="catalog-empty" role="alert">
      <h2 className="display">{filtered ? 'Sin obras con estos filtros' : 'Profesor no encontrado'}</h2>
      <p>
        {filtered
          ? 'Este profesor no tiene obras verificadas que cumplan los filtros elegidos.'
          : 'No existe un profesor con producción verificada en esta dirección.'}
      </p>
      {filtered ? (
        <button type="button" className="btn btn-outline" onClick={onReset}>
          Quitar los filtros
        </button>
      ) : (
        <Link to="/docentes" className="btn btn-outline">
          Ir al directorio
        </Link>
      )}
    </div>
  );
}

export default function ProfessorProfilePage() {
  const { professorId } = useParams();
  const { filters, apiParams, setFilters, resetFilters, options } = useAnalysisFilters();
  const profileQuery = useQuery({
    queryKey: ['metrics', 'professor', professorId, apiParams],
    queryFn: () => getProfessorProfile(professorId, apiParams),
    retry: (count, error) => error?.response?.status !== 404 && count < 2,
  });
  const profile = profileQuery.data;
  const notFound = profileQuery.error?.response?.status === 404;

  const backLink = (
    <Link to="/docentes" className="product-back">
      <ArrowLeft size={18} aria-hidden="true" />
      Volver a Docentes
    </Link>
  );

  if (profileQuery.isPending) {
    return (
      <>
        {backLink}
        <LoadingState>Cargando la ficha…</LoadingState>
      </>
    );
  }

  if (profileQuery.isError) {
    return (
      <>
        {backLink}
        <AnalysisFilters filters={filters} options={options} onChange={setFilters} onReset={resetFilters} />
        {notFound ? (
          <NotFound filtered={hasActiveAnalysisFilters(filters)} onReset={resetFilters} />
        ) : (
          <ErrorState queries={[profileQuery]}>No se pudo cargar la ficha. Revise su conexión e inténtelo de nuevo.</ErrorState>
        )}
      </>
    );
  }

  const network = profile.network;
  const egoNodes = profile.ego_network.nodes.map((node) => ({
    id: node.id,
    label: displayName(node.full_name),
    shortLabel: shortName(node.full_name),
    size: node.products,
    color: node.is_center ? '#ef4035' : departmentColor(node.department),
    shape: 'circle',
    emphasis: node.is_center,
    description: [node.department, `${node.products} obras`].filter(Boolean).join(', '),
    href: node.is_center ? undefined : `/docentes/${node.id}`,
  }));
  const egoDepartments = [...new Set(profile.ego_network.nodes.filter((n) => !n.is_center).map((n) => n.department))];

  return (
    <>
      {backLink}
      <header className="catalog-intro metrics-intro analysis-profile-head">
        <h1 className="display">{displayName(profile.full_name)}</h1>
        <p>
          {[profile.department ? `Departamento de ${profile.department}` : null, `Línea predominante: ${shortResearchLine(profile.main_research_line)}`]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <Link to={`/comparar?ids=${encodeURIComponent(profile.id)}`} className="btn btn-outline analysis-compare-link">
          <GitCompareArrows size={18} aria-hidden="true" />
          Comparar con otro docente
        </Link>
      </header>

      <AnalysisFilters filters={filters} options={options} onChange={setFilters} onReset={resetFilters} />

      <div className="metrics-body">
        <Indicators profile={profile} />
        <TimelineChart timeline={profile.timeline} />

        <section className="metrics-section" aria-labelledby="profile-position-title">
          <div className="metrics-section-head">
            <div>
              <h2 id="profile-position-title">Posición en la red de coautoría</h2>
              <p>Cómo se ubica en la red de la Escuela. {NETWORK_LIMITATION}</p>
            </div>
          </div>
          <dl className="analysis-position">
            {POSITION_KEYS.map((key) => (
              <div key={key}>
                <dt>{CENTRALITY_INFO[key].label}</dt>
                <dd>
                  <span className="analysis-position-value">{positionValue(key, network)}</span>
                  <span className="analysis-position-text">{CENTRALITY_INFO[key].short}</span>
                  {positionNote(key, network) && <span className="analysis-position-note">{positionNote(key, network)}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="metrics-columns">
          <section className="metrics-section" aria-labelledby="profile-ego-title">
            <div className="metrics-section-head">
              <div>
                <h2 id="profile-ego-title">Red personal</h2>
                <p>El profesor (en rojo) y los colegas de la Escuela con quienes publicó.</p>
              </div>
            </div>
            <NetworkGraph
              nodes={egoNodes}
              edges={profile.ego_network.edges}
              title={`Red personal de ${displayName(profile.full_name)}`}
              width={520}
              height={380}
              minWidth={320}
              maxRadius={22}
              showPanel={false}
              compact
              legend={[
                { label: displayName(profile.full_name), color: '#ef4035' },
                ...egoDepartments.map((d) => ({ label: d ?? 'Sin departamento', color: departmentColor(d) })),
              ]}
              caption="Tamaño: obras. Grosor: obras en coautoría."
              emptyMessage="Sin red personal con los filtros elegidos."
            />
          </section>

          <section className="metrics-section" aria-labelledby="profile-coauthors-title">
            <div className="metrics-section-head">
              <div>
                <h2 id="profile-coauthors-title">Coautores en la Escuela</h2>
                <p>Número de obras firmadas juntos.</p>
              </div>
            </div>
            {profile.coauthors.length === 0 ? (
              <p className="metrics-empty">Sin coautorías registradas con otros profesores de la Escuela.</p>
            ) : (
              <ol className="metrics-pairs">
                {profile.coauthors.map((coauthor) => (
                  <li key={coauthor.id}>
                    <Link to={`/docentes/${coauthor.id}`} className="network-person-link">
                      {displayName(coauthor.full_name)}
                    </Link>
                    <span className="metrics-bar-value">{formatNumber(coauthor.weight)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="metrics-columns">
          <ResearchLinesChart lines={profile.research_lines} />
          <ExternalCollaboration countries={profile.countries} institutions={profile.institutions} />
        </div>

        <p className="metrics-muted analysis-footnote">
          Intermediación ponderada: {formatPrecise(network.betweenness_weighted)} · fuerza:{' '}
          {formatNumber(network.strength)} · agrupamiento: {formatDecimal(network.clustering)}. Vea «Cómo leer los
          indicadores» para el detalle de cada medida.
        </p>
      </div>
    </>
  );
}
