/**
 * Estructura de las páginas públicas del catálogo (HU05 y HU06): misma cabecera y pie que la
 * pantalla de acceso, para que el visitante no note un cambio al pasar del inicio al catálogo.
 * Con sesión iniciada, el botón lleva al panel en lugar de al inicio de sesión.
 */
import { Link } from 'react-router-dom';
import { LayoutDashboard, LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SCHOOL } from '../../constants/school';
import { YachayLogo } from '../portal/Brand';

export default function PublicShell({ children }) {
  const { isAuthenticated } = useAuth();

  return (
    <div className="catalog-shell">
      <a href="#main-content" className="skip-link">
        Ir al contenido
      </a>

      <header className="access-header catalog-shell-header">
        <Link to="/" className="access-brand catalog-brand" aria-label="Inicio de SIMAPC">
          <YachayLogo width={110} />
          <span>
            <strong>SIMAPC</strong>
            <small>{SCHOOL.shortName}</small>
          </span>
        </Link>
        {isAuthenticated ? (
          <Link to="/dashboard" className="btn btn-outline">
            <LayoutDashboard size={19} aria-hidden="true" />
            Ir a mi panel
          </Link>
        ) : (
          <Link to="/login" className="btn btn-primary">
            <LogIn size={19} aria-hidden="true" />
            Iniciar sesión
          </Link>
        )}
      </header>

      <main id="main-content" tabIndex={-1} className="catalog-main">
        {children}
      </main>

      <footer className="access-footer catalog-shell-footer">
        <span>{SCHOOL.name}</span>
        <span>Universidad Yachay Tech</span>
      </footer>
    </div>
  );
}
