/**
 * Datos y utilidades compartidas por las pruebas de las páginas de análisis (Inicio, Docentes,
 * ficha, Colaboraciones y Comparar). Solo se usa en pruebas.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

export const FILTER_OPTIONS = {
  departments: ['Computación', 'Matemáticas'],
  year_min: 2016,
  year_max: 2025,
  affiliations: ['all', 'yachay'],
  contribution_types: [
    { value: 'journal-article', count: 2 },
    { value: 'book-chapter', count: 1 },
  ],
  quartiles: [
    { value: 'Q1', count: 1 },
    { value: 'Q2', count: 0 },
    { value: 'Q3', count: 1 },
    { value: 'Q4', count: 0 },
    { value: 'sin_cuartil', count: 1 },
  ],
};

export const OVERVIEW = {
  total_products: 3, publications: 3, projects: 0, professors: 2, citations_total: 13,
  products_with_citations: 2, h_index: 2,
  quartiles: { Q1: 1, Q2: 0, Q3: 1, Q4: 0, sin_cuartil: 1 },
  q1_q2_share: 0.5, open_access_share: 0.5, international_share: 0.5,
  year_from: 2024, year_to: 2025, data_as_of: '2026-11-10T13:40:53',
  research_lines: [{ research_line: 'Ciencia de datos', count: 3 }],
  contribution_types: [
    { contribution_type: 'journal-article', count: 2 },
    { contribution_type: null, count: 1 },
  ],
};

export const TIMELINE = {
  items: [
    { year: 2024, total: 2, citations: 13, products_with_citations: 2, Q1: 1, Q2: 0, Q3: 1, Q4: 0, sin_cuartil: 0 },
    { year: 2025, total: 1, citations: 0, products_with_citations: 0, Q1: 0, Q2: 0, Q3: 0, Q4: 0, sin_cuartil: 1 },
  ],
};

export const ANA = {
  id: 'a', full_name: 'Ana Morales', department: 'Matemáticas', products: 2, citations: 13,
  products_with_citations: 2, h_index: 2, Q1: 1, Q2: 0, Q3: 1, Q4: 0, sin_cuartil: 0,
  first_year: 2024, last_year: 2024, main_research_line: 'Ciencia de datos', coauthored_in_school: 1,
  betweenness: 0, community: 0,
};

export const LUIS = {
  id: 'l', full_name: 'LUIS PAREDES ORTEGA', department: 'Computación', products: 3, citations: 10,
  products_with_citations: 1, h_index: 1, Q1: 1, Q2: 0, Q3: 0, Q4: 0, sin_cuartil: 2,
  first_year: 2024, last_year: 2025, main_research_line: 'Ciencia de datos', coauthored_in_school: 2,
  betweenness: 0.6667, community: 0,
};

export const PIA = {
  id: 'p', full_name: 'Pía Torres', department: 'Computación', products: 1, citations: 0,
  products_with_citations: 1, h_index: 0, Q1: 0, Q2: 0, Q3: 0, Q4: 0, sin_cuartil: 1,
  first_year: 2025, last_year: 2025, main_research_line: 'Inteligencia artificial', coauthored_in_school: 1,
  betweenness: 0, community: 0,
};

export const PROFESSORS = { items: [ANA, LUIS, PIA] };

const centrality = (item, extra) => ({
  id: item.id, full_name: item.full_name, department: item.department, products: item.products,
  main_research_line: item.main_research_line, community: 0, ...extra,
});

export const NETWORK = {
  summary: { nodes: 3, edges: 2, density: 0.6667, components: 1, largest_component: 3, average_clustering: 0, communities: 1, modularity: 0 },
  professors: [
    centrality(LUIS, { degree: 2, strength: 2, betweenness: 1, betweenness_weighted: 1, closeness: 1, eigenvector: 0.7071, clustering: 0 }),
    centrality(ANA, { degree: 1, strength: 1, betweenness: 0, betweenness_weighted: 0, closeness: 0.6667, eigenvector: 0.5, clustering: 0 }),
    centrality(PIA, { degree: 1, strength: 1, betweenness: 0, betweenness_weighted: 0, closeness: 0.6667, eigenvector: 0.5, clustering: 0 }),
  ],
};

export const COAUTHORSHIP = {
  summary: NETWORK.summary,
  nodes: [LUIS, ANA, PIA].map((item) => ({
    id: item.id, full_name: item.full_name, department: item.department, products: item.products,
    main_research_line: item.main_research_line, community: 0, betweenness: item.betweenness, degree: 1,
  })),
  edges: [
    { source: 'a', target: 'l', weight: 1 },
    { source: 'l', target: 'p', weight: 1 },
  ],
};

export function profileOf(item, coauthors) {
  return {
    ...item,
    timeline: [{ year: 2024, total: item.products, citations: item.citations, products_with_citations: 1, Q1: item.Q1, Q2: 0, Q3: item.Q3, Q4: 0, sin_cuartil: item.sin_cuartil }],
    research_lines: [{ research_line: item.main_research_line, count: item.products }],
    network: {
      degree: coauthors.length, strength: coauthors.length, betweenness: item.betweenness, betweenness_weighted: item.betweenness,
      closeness: 0.6667, eigenvector: 0.5, clustering: 0, community: 0, betweenness_rank: 2, network_size: 3, community_size: 3,
    },
    coauthors,
    ego_network: {
      nodes: [
        { id: item.id, full_name: item.full_name, department: item.department, products: item.products, community: 0, is_center: true },
        ...coauthors.map((c) => ({ id: c.id, full_name: c.full_name, department: c.department, products: 1, community: 0, is_center: false })),
      ],
      edges: coauthors.map((c) => ({ source: item.id, target: c.id, weight: c.weight })),
    },
    institutions: [{ name: 'Universitat Politècnica de Catalunya', count: 1 }],
    countries: [{ code: 'ES', count: 1 }],
  };
}

export const PROFILES = {
  a: profileOf(ANA, [{ id: 'l', full_name: LUIS.full_name, department: LUIS.department, weight: 1 }]),
  l: profileOf(LUIS, [
    { id: 'a', full_name: ANA.full_name, department: ANA.department, weight: 1 },
    { id: 'p', full_name: PIA.full_name, department: PIA.department, weight: 1 },
  ]),
  p: profileOf(PIA, [{ id: 'l', full_name: LUIS.full_name, department: LUIS.department, weight: 1 }]),
};

export function notFoundError() {
  const error = new Error('not found');
  error.response = { status: 404 };
  return error;
}

/** Respuestas por defecto de la API de métricas para `api.get(url, { params })`. */
export function metricsApi(url) {
  const fixed = {
    '/metrics/filters': FILTER_OPTIONS,
    '/metrics/overview': OVERVIEW,
    '/metrics/timeline': TIMELINE,
    '/metrics/professors': PROFESSORS,
    '/metrics/collaboration': {
      nodes: [], edges: [],
      countries: [{ code: 'ES', count: 1 }],
      institutions: [{ name: 'Universitat Politècnica de Catalunya', count: 1 }],
    },
    '/metrics/network': NETWORK,
    '/metrics/networks/coauthorship': COAUTHORSHIP,
  };
  if (fixed[url]) return Promise.resolve({ data: fixed[url] });
  const profile = url.match(/^\/metrics\/professors\/(.+)$/);
  if (profile) {
    const data = PROFILES[decodeURIComponent(profile[1])];
    return data ? Promise.resolve({ data }) : Promise.reject(notFoundError());
  }
  return Promise.reject(new Error(`URL no simulada: ${url}`));
}

// Módulo solo de pruebas: la recarga en caliente no aplica, así que puede mezclar datos y componentes.
// eslint-disable-next-line react-refresh/only-export-components
function UrlProbe() {
  const location = useLocation();
  return <output data-testid="url">{location.pathname + location.search}</output>;
}

export const currentUrl = () => screen.getByTestId('url').textContent;

/** Renderiza una página en la ruta indicada, con TanStack Query y una sonda de la URL. */
export function renderRoute(path, routePath, element) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
        <UrlProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}
