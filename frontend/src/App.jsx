import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PortalLayout from './components/portal/PortalLayout';
import LoginPage from './pages/LoginPage';
import PublicHomePage from './pages/PublicHomePage';
import PublicCatalogPage from './pages/PublicCatalogPage';
import PublicProductPage from './pages/PublicProductPage';
import DashboardPage from './pages/DashboardPage';
import RegisterProductPage from './pages/RegisterProductPage';

// Carga diferida: las librerías de gráficos (recharts, d3-force) solo se descargan al abrir
// una pestaña de análisis.
const PublicMetricsPage = lazy(() => import('./pages/PublicMetricsPage'));
const ProfessorsDirectoryPage = lazy(() => import('./pages/ProfessorsDirectoryPage'));
const ProfessorProfilePage = lazy(() => import('./pages/ProfessorProfilePage'));
const CollaborationsPage = lazy(() => import('./pages/CollaborationsPage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const IndicatorsGuidePage = lazy(() => import('./pages/IndicatorsGuidePage'));

const queryClient = new QueryClient();

function Deferred({ children }) {
  return (
    <Suspense
      fallback={
        <div className="catalog-loading" role="status">
          <div className="spinner" aria-hidden="true" />
          Cargando…
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Bienvenida e inicio de sesión, fuera del portal (CA06: la vista pública no exige sesión) */}
            <Route path="/" element={<PublicHomePage />} />
            <Route path="/login" element={<LoginPage />} />
            {/* El antiguo dashboard de métricas ahora es la pestaña Inicio */}
            <Route path="/metricas" element={<Navigate to="/inicio" replace />} />

            {/* Portal con pestañas: el mismo menú para el visitante y el profesor */}
            <Route element={<PortalLayout />}>
              {/* Pestañas públicas, sin sesión */}
              <Route path="/inicio" element={<Deferred><PublicMetricsPage /></Deferred>} />
              {/* Catálogo público sin sesión (HU05, CA13 y CA14; filtros de HU06) */}
              <Route path="/produccion" element={<PublicCatalogPage />} />
              <Route path="/produccion/:productId" element={<PublicProductPage />} />
              <Route path="/docentes" element={<Deferred><ProfessorsDirectoryPage /></Deferred>} />
              <Route path="/docentes/:professorId" element={<Deferred><ProfessorProfilePage /></Deferred>} />
              <Route path="/colaboraciones" element={<Deferred><CollaborationsPage /></Deferred>} />
              <Route path="/comparar" element={<Deferred><ComparePage /></Deferred>} />
              <Route path="/guia" element={<Deferred><IndicatorsGuidePage /></Deferred>} />

              {/* Pestañas del profesor */}
              <Route element={<ProtectedRoute allowedRoles={['professor']} />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                {/* El registro se abre como ventana sobre el inicio, como en el prototipo */}
                <Route
                  path="/products/new"
                  element={
                    <>
                      <DashboardPage />
                      <RegisterProductPage />
                    </>
                  }
                />
              </Route>
            </Route>

            {/* Fallback Catch-all Redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
