/**
 * Estructura del portal con sesión (menú lateral, barra superior y pie), con el aspecto
 * del prototipo. El menú solo muestra secciones que ya existen; las demás (producción,
 * docentes, mis registros, avisos) se agregan cuando se implementen sus historias.
 */
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SCHOOL } from '../../constants/school';
import { YachaySymbol } from './Brand';

const ROLE_LABELS = { professor: 'Profesor', reviewer: 'Comité Científico' };

export default function PortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const name = user?.name || user?.username || '';
  const closeMenu = () => setMenuOpen(false);

  const handleLogout = () => {
    logout(null, { onSuccess: () => navigate('/login') });
  };

  return (
    <div className="portal">
      <a href="#main-content" className="skip-link">
        Ir al contenido
      </a>

      <header className="portal-topbar">
        <button
          type="button"
          className="menu-button"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <div className="topbar-context">
          <span>SIMAPC-{SCHOOL.code}</span>
          <span>{SCHOOL.name}</span>
        </div>
        <button type="button" className="logout-button" onClick={handleLogout}>
          <LogOut size={19} aria-hidden="true" />
          Cerrar sesión
        </button>
      </header>

      {menuOpen && <button type="button" className="sidebar-scrim" aria-label="Cerrar menú" onClick={closeMenu} />}

      <aside className={`portal-sidebar${menuOpen ? ' is-open' : ''}`}>
        <NavLink to="/dashboard" className="sidebar-brand" onClick={closeMenu}>
          <YachaySymbol size={48} />
          <span>
            <strong>SIMAPC</strong>
            <small>Investigación · {SCHOOL.code}</small>
          </span>
        </NavLink>
        <nav className="sidebar-nav" aria-label="Navegación principal">
          <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} onClick={closeMenu}>
            <Home size={23} aria-hidden="true" />
            Inicio
          </NavLink>
        </nav>
        {user && (
          <div className="sidebar-profile">
            <span className="profile-initial" aria-hidden="true">
              {name.charAt(0).toUpperCase()}
            </span>
            <span>
              <strong>{name}</strong>
              <small>{ROLE_LABELS[user.role] || 'Profesor'}</small>
            </span>
          </div>
        )}
      </aside>

      <main id="main-content" tabIndex={-1} className="portal-main">
        <Outlet />
      </main>

      <footer className="portal-footer">
        <span>SIMAPC · {SCHOOL.code}</span>
        <span>Universidad Yachay Tech</span>
      </footer>
    </div>
  );
}
