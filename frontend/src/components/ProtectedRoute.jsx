import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ allowedRoles }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="portal-state" role="status">
        <div>
          <div className="spinner" aria-hidden="true"></div>
          <p>Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated but without one of the required roles: show 403 instead of the private page.
  // This only improves the UX; the backend enforces the real authorization on every private endpoint.
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return (
      <div className="portal-state">
        <div role="alert">
          <h1 className="display">Acceso denegado</h1>
          <p>Su cuenta no tiene los permisos necesarios para ver esta página.</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
