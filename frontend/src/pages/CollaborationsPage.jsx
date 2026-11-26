/**
 * Colaboraciones: redes de la producción de la Escuela, con los filtros comunes del análisis.
 *   1. Coautoría interna (color por comunidad, departamento o línea; tamaño por obras o
 *      intermediación), con la tabla de centralidades y las métricas del grafo.
 *   2. Instituciones externas (bipartita profesor ↔ institución, con mínimo de obras).
 *   3. Países (bipartita profesor ↔ país, nombres en español).
 *   4. Líneas de investigación.
 *   5. Evolución por periodos (un grafo pequeño por periodo, lado a lado).
 * La vista elegida vive en la URL (`vista`), junto a los filtros.
 */
import { useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import AnalysisFilters from '../components/analysis/AnalysisFilters';
import { ErrorState, LoadingState } from '../components/analysis/QueryState';
import NetworkGraph from '../components/network/NetworkGraph';
import GraphSummary from '../components/network/GraphSummary';
import CentralityTable from '../components/network/CentralityTable';
import useAnalysisFilters from '../hooks/useAnalysisFilters';
import {
  getCoauthorshipNetwork,
  getCountriesNetwork,
  getInstitutionsNetwork,
  getNetworkMetrics,
  getPeriodsNetwork,
  getResearchLinesNetwork,
} from '../services/metricsService';
import { countryName, displayName, formatNumber, researchLineColor, shortName, shortResearchLine } from '../utils/metricsFormat';
import {
  COUNTRY_COLOR,
  INSTITUTION_COLOR,
  NETWORK_LIMITATION,
  communitySizes,
  departmentColor,
  legendFor,
  professorNode,
} from '../utils/networkFormat';

const VIEWS = [
  { id: 'coautoria', label: 'Coautoría interna' },
  { id: 'instituciones', label: 'Instituciones externas' },
  { id: 'paises', label: 'Países' },
  { id: 'lineas', label: 'Líneas de investigación' },
  { id: 'periodos', label: 'Evolución por periodos' },
];

function Limitation() {
  return <p className="network-limitation">{NETWORK_LIMITATION}</p>;
}

function Segmented({ label, value, options, onChange }) {
  const id = useId();
  return (
    <div className="network-control">
      <span id={id}>{label}</span>
      <div className="metrics-toggle" role="group" aria-labelledby={id}>
        {options.map((option) => (
          <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function useNetworkQuery(key, fn, apiParams, extra = []) {
  return useQuery({ queryKey: ['metrics', 'networks', key, apiParams, ...extra], queryFn: fn });
}

function CoauthorshipView({ apiParams }) {
  const [colorBy, setColorBy] = useState('community');
  const [sizeBy, setSizeBy] = useState('products');
  const graph = useNetworkQuery('coauthorship', () => getCoauthorshipNetwork(apiParams), apiParams);
  const metrics = useNetworkQuery('network', () => getNetworkMetrics(apiParams), apiParams);

  const nodes = useMemo(() => {
    if (!graph.data) return [];
    const sizes = communitySizes(graph.data.nodes);
    return graph.data.nodes.map((item) => professorNode(item, { colorBy, sizeBy, communitySizes: sizes }));
  }, [graph.data, colorBy, sizeBy]);

  if (graph.isPending || metrics.isPending) return <LoadingState>Calculando la red…</LoadingState>;
  if (graph.isError || metrics.isError) return <ErrorState queries={[graph, metrics].filter((q) => q.isError)} />;

  const top = graph.data.edges.slice(0, 6);
  const names = new Map(graph.data.nodes.map((node) => [node.id, node.full_name]));
  return (
    <>
      <div className="network-controls">
        <Segmented
          label="Color por"
          value={colorBy}
          onChange={setColorBy}
          options={[
            { value: 'community', label: 'Comunidad' },
            { value: 'department', label: 'Departamento' },
            { value: 'line', label: 'Línea' },
          ]}
        />
        <Segmented
          label="Tamaño por"
          value={sizeBy}
          onChange={setSizeBy}
          options={[
            { value: 'products', label: 'Obras' },
            { value: 'betweenness', label: 'Intermediación' },
          ]}
        />
      </div>
      <NetworkGraph
        nodes={nodes}
        edges={graph.data.edges}
        title="Red de coautoría entre profesores de la Escuela"
        legend={legendFor(colorBy, graph.data.nodes)}
        caption={`Tamaño: ${sizeBy === 'products' ? 'número de obras' : 'intermediación'}. Grosor de la línea: obras en coautoría. Los profesores sin coautorías quedan en el borde.`}
        neighborNoun="coautores en la Escuela"
        idleDetails={
          <>
            <h3>Colaboraciones más frecuentes</h3>
            <ol className="metrics-pairs">
              {top.map((edge) => (
                <li key={`${edge.source}-${edge.target}`}>
                  <span>
                    {shortName(names.get(edge.source))} y {shortName(names.get(edge.target))}
                  </span>
                  <span className="metrics-bar-value">{formatNumber(edge.weight)}</span>
                </li>
              ))}
            </ol>
            <p className="metrics-muted">Selecciona un círculo para ver con quién publica cada profesor.</p>
          </>
        }
      />
      <Limitation />
      <section className="metrics-section" aria-labelledby="network-summary-title">
        <div className="metrics-section-head">
          <div>
            <h2 id="network-summary-title">La red en números</h2>
            <p>Métricas del grafo completo de coautoría interna.</p>
          </div>
        </div>
        <GraphSummary summary={metrics.data.summary} />
      </section>
      <section className="metrics-section" aria-labelledby="network-table-title">
        <div className="metrics-section-head">
          <div>
            <h2 id="network-table-title">Centralidades por profesor</h2>
            <p>Pulse un encabezado para ordenar. «Cómo leer los indicadores» explica cada medida.</p>
          </div>
        </div>
        <CentralityTable professors={metrics.data.professors} />
      </section>
    </>
  );
}

function bipartiteNodes(data, partnerColor, partnerLabel) {
  return data.nodes.map((node) =>
    node.kind === 'professor'
      ? {
          id: node.id,
          label: displayName(node.label),
          shortLabel: shortName(node.label),
          size: node.count,
          color: departmentColor(node.department),
          shape: 'circle',
          description: node.department ?? undefined,
          href: `/docentes/${node.id}`,
        }
      : {
          id: node.id,
          label: partnerLabel(node.label),
          size: node.count,
          color: partnerColor,
          shape: 'square',
          description: `${node.count} obras de la Escuela`,
        },
  );
}

function bipartiteLegend(data, partnerColor, partnerName) {
  const departments = [...new Set(data.nodes.filter((n) => n.kind === 'professor').map((n) => n.department))];
  return [
    ...departments.map((d) => ({ label: `Profesor · ${d ?? 'sin departamento'}`, color: departmentColor(d) })),
    { label: partnerName, color: partnerColor, shape: 'square' },
  ];
}

const MIN_COUNT_OPTIONS = [1, 2, 3, 5, 8, 12];

function InstitutionsView({ apiParams }) {
  const [minCount, setMinCount] = useState(3);
  const query = useNetworkQuery('institutions', () => getInstitutionsNetwork(apiParams, minCount), apiParams, [minCount]);
  const nodes = useMemo(() => (query.data ? bipartiteNodes(query.data, INSTITUTION_COLOR, (label) => label) : []), [query.data]);

  return (
    <>
      <div className="network-controls">
        <label className="analysis-field network-min-count">
          <span>Mínimo de obras por institución</span>
          <select className="field-input" value={minCount} onChange={(event) => setMinCount(Number(event.target.value))}>
            {MIN_COUNT_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value === 1 ? 'Todas' : `${value} o más`}
              </option>
            ))}
          </select>
        </label>
      </div>
      {query.isPending && <LoadingState>Calculando la red…</LoadingState>}
      {query.isError && <ErrorState queries={[query]} />}
      {query.data && (
        <NetworkGraph
          nodes={nodes}
          edges={query.data.edges}
          title="Red de profesores e instituciones externas"
          legend={bipartiteLegend(query.data, INSTITUTION_COLOR, 'Institución externa')}
          caption="Círculos: profesores. Cuadrados: instituciones (sin Yachay Tech). Grosor: obras compartidas."
          neighborNoun="conexiones"
          labelLimit={14}
          height={620}
          emptyMessage="No hay instituciones externas con ese mínimo de obras y los filtros elegidos."
        />
      )}
      <Limitation />
    </>
  );
}

function CountriesView({ apiParams }) {
  const query = useNetworkQuery('countries', () => getCountriesNetwork(apiParams), apiParams);
  const nodes = useMemo(
    () => (query.data ? bipartiteNodes(query.data, COUNTRY_COLOR, (code) => countryName(code)) : []),
    [query.data],
  );
  if (query.isPending) return <LoadingState>Calculando la red…</LoadingState>;
  if (query.isError) return <ErrorState queries={[query]} />;
  return (
    <>
      <NetworkGraph
        nodes={nodes}
        edges={query.data.edges}
        title="Red de profesores y países de las instituciones coautoras"
        legend={bipartiteLegend(query.data, COUNTRY_COLOR, 'País (sin Ecuador)')}
        caption="Círculos: profesores. Cuadrados: países de las instituciones coautoras. Grosor: obras compartidas."
        labelLimit={20}
        height={600}
        emptyMessage="No hay obras con coautores de otros países con los filtros elegidos."
      />
      <Limitation />
    </>
  );
}

function ResearchLinesView({ apiParams }) {
  const query = useNetworkQuery('research-lines', () => getResearchLinesNetwork(apiParams), apiParams);
  const nodes = useMemo(
    () =>
      (query.data?.nodes ?? []).map((node) => ({
        id: node.id,
        label: shortResearchLine(node.label),
        size: node.products,
        color: researchLineColor(node.label),
        shape: 'circle',
        description: `${node.products} obras, ${node.professors} profesores`,
      })),
    [query.data],
  );
  if (query.isPending) return <LoadingState>Calculando la red…</LoadingState>;
  if (query.isError) return <ErrorState queries={[query]} />;
  return (
    <>
      <NetworkGraph
        nodes={nodes}
        edges={query.data.edges}
        title="Red de líneas de investigación"
        width={760}
        height={480}
        minRadius={14}
        maxRadius={40}
        neighborNoun="líneas conectadas (profesores en ambas)"
        caption="Tamaño: obras de la línea. Grosor: profesores que publican en ambas líneas. Clasificación provisional por palabras clave."
      />
      <Limitation />
    </>
  );
}

function PeriodsView({ apiParams }) {
  const query = useNetworkQuery('periods', () => getPeriodsNetwork(apiParams), apiParams);
  if (query.isPending) return <LoadingState>Calculando las redes por periodo…</LoadingState>;
  if (query.isError) return <ErrorState queries={[query]} />;
  const departments = [...new Set(query.data.periods.flatMap((p) => p.nodes.map((n) => n.department)))];
  return (
    <>
      <p className="metrics-muted">
        La misma red de coautoría interna en cada periodo, para ver cómo crece la colaboración. Color: departamento.
      </p>
      <ul className="metrics-legend network-periods-legend">
        {departments.map((d) => (
          <li key={d ?? 'none'}>
            <span className="metrics-swatch is-round" style={{ background: departmentColor(d) }} aria-hidden="true" />
            {d ?? 'Sin departamento'}
          </li>
        ))}
      </ul>
      <div className="network-periods">
        {query.data.periods.map((period) => (
          <section key={period.label} className="network-period" aria-labelledby={`period-${period.year_from}`}>
            <h3 id={`period-${period.year_from}`}>
              {period.label} <small>{formatNumber(period.products)} obras</small>
            </h3>
            <NetworkGraph
              nodes={period.nodes.map((item) => professorNode(item, { colorBy: 'department' }))}
              edges={period.edges}
              title={`Red de coautoría ${period.label}`}
              width={420}
              height={340}
              minWidth={300}
              maxRadius={16}
              labelLimit={0}
              showPanel={false}
              compact
              emptyMessage="Sin obras en este periodo con los filtros elegidos."
            />
            <GraphSummary summary={period.summary} compact />
          </section>
        ))}
      </div>
      <Limitation />
    </>
  );
}

export default function CollaborationsPage() {
  const { filters, apiParams, setFilters, resetFilters, options } = useAnalysisFilters();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = VIEWS.some((item) => item.id === searchParams.get('vista')) ? searchParams.get('vista') : 'coautoria';
  const selectView = (id) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (id === 'coautoria') next.delete('vista');
        else next.set('vista', id);
        return next;
      },
      { replace: true },
    );

  const onKeyDown = (event) => {
    const index = VIEWS.findIndex((item) => item.id === view);
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = VIEWS[(index + step + VIEWS.length) % VIEWS.length];
    selectView(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };

  return (
    <>
      <header className="catalog-intro metrics-intro">
        <h1 className="display">Colaboraciones</h1>
        <p>Con quién publican los profesores de la Escuela: entre ellos, con otras instituciones y con otros países.</p>
      </header>

      <AnalysisFilters filters={filters} options={options} onChange={setFilters} onReset={resetFilters} />

      <div className="network-tabs" role="tablist" aria-label="Redes de colaboración" onKeyDown={onKeyDown}>
        {VIEWS.map((item) => (
          <button
            key={item.id}
            id={`tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={view === item.id}
            aria-controls="network-panel"
            tabIndex={view === item.id ? 0 : -1}
            onClick={() => selectView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div id="network-panel" role="tabpanel" aria-labelledby={`tab-${view}`} className="metrics-body network-body">
        {view === 'coautoria' && <CoauthorshipView apiParams={apiParams} />}
        {view === 'instituciones' && <InstitutionsView apiParams={apiParams} />}
        {view === 'paises' && <CountriesView apiParams={apiParams} />}
        {view === 'lineas' && <ResearchLinesView apiParams={apiParams} />}
        {view === 'periodos' && <PeriodsView apiParams={apiParams} />}
      </div>
    </>
  );
}
