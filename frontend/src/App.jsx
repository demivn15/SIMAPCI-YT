import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PortalLayout from './components/portal/PortalLayout';
import LoginPage from './pages/LoginPage';
import PublicHomePage from './pages/PublicHomePage';
import DashboardPage from './pages/DashboardPage';
import RegisterProductPage from './pages/RegisterProductPage';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes (CA06: la vista pública no exige sesión) */}
            <Route path="/" element={<PublicHomePage />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Routes Guard */}
            <Route element={<ProtectedRoute allowedRoles={['professor']} />}>
              {/* Menú lateral, barra superior y pie del portal */}
              <Route element={<PortalLayout />}>
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
