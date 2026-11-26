/**
 * Estructura común del portal (menú lateral con pestañas, barra superior, pie y, en móvil,
 * barra inferior), con el aspecto del prototipo. Es la misma para el visitante y el profesor:
 * - sin sesión, la barra superior ofrece «Iniciar sesión»;
 * - con sesión, el menú muestra el nombre y el rol, y la barra superior «Cerrar sesión».
 * El profesor ve además «Mi panel» (registro de productos). Las secciones que aún no existen
 * (mis registros, revisión del Revisor) no aparecen hasta que se implementen sus historias.
 *
 * Accesibilidad: enlace «Ir al contenido», `aria-current="page"` en la pestaña activa y foco
 * visible (estilo global de portal.css).
 */
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, LogOut, Menu, MoreHorizontal, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SCHOOL } from '../../constants/school';
import { BRAND_NAME, PUBLIC_TABS, ROLE_LABELS, isTabActive, tabsForRole } from './navigation';
import { YachaySymbol } from './Brand';

function TabLink({ tab, pathname, className, onClick, compact = false }) {
  const Icon = tab.icon;
  const active = isTabActive(tab, pathname);
  return (
    <Link
      to={tab.to}
      className={`${className}${active ? ' active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <Icon size={compact ? 20 : 23} aria-hidden="true" />
      <span>{compact ? tab.short : tab.label}</span>
    </Link>
  );
}

export default function PortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const name = user?.name || user?.username || '';
  const tabs = tabsForRole(user?.role);
  const bottomTabs = PUBLIC_TABS.slice(0, 3);
  const closeMenu = () => setMenuOpen(false);

  // Al cambiar de pestaña, la página vuelve arriba (el menú móvil se cierra al elegir la pestaña).
  useEffect(() => {
    window.scrollTo?.({ top: 0, left: 0 });
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const handleLogout = () => {
    logout(null, { onSuccess: () => navigate('/login') });
  };

  return (
    <div className="portal shell">
      <a href="#main-content" className="skip-link">
        Ir al contenido
      </a>

      <header className="portal-topbar">
        <button
          type="button"
          className="menu-button"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
          aria-controls="portal-sidebar"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <div className="topbar-context">
          <span>
            {BRAND_NAME}-{SCHOOL.code}
          </span>
          <span>{SCHOOL.name}</span>
        </div>
        {user ? (
          <button type="button" className="logout-button" onClick={handleLogout}>
            <LogOut size={19} aria-hidden="true" />
            Cerrar sesión
          </button>
        ) : (
          <Link to="/login" className="btn btn-primary shell-login">
            <LogIn size={19} aria-hidden="true" />
            Iniciar sesión
          </Link>
        )}
      </header>

      {menuOpen && <button type="button" className="sidebar-scrim" aria-label="Cerrar menú" onClick={closeMenu} />}

      <aside id="portal-sidebar" className={`portal-sidebar${menuOpen ? ' is-open' : ''}`} data-role={user?.role || 'visitor'}>
        <Link to="/" className="sidebar-brand" onClick={closeMenu} aria-label={`${BRAND_NAME}, volver a la bienvenida`}>
          <YachaySymbol size={48} />
          <span>
            <strong>{BRAND_NAME}</strong>
            <small>Investigación · {SCHOOL.code}</small>
          </span>
        </Link>
        <nav className="sidebar-nav" aria-label="Navegación principal">
          {tabs.map((tab) => (
            <TabLink key={tab.to} tab={tab} pathname={pathname} className="sidebar-link" onClick={closeMenu} />
          ))}
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
        <span>
          {BRAND_NAME} · {SCHOOL.code}
        </span>
        <span>Universidad Yachay Tech</span>
      </footer>

      <nav className="shell-bottom-nav" aria-label="Navegación móvil">
        {bottomTabs.map((tab) => (
          <TabLink key={tab.to} tab={tab} pathname={pathname} className="shell-bottom-link" onClick={closeMenu} compact />
        ))}
        <button
          type="button"
          className={`shell-bottom-link${menuOpen ? ' active' : ''}`}
          aria-expanded={menuOpen}
          aria-controls="portal-sidebar"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <MoreHorizontal size={20} aria-hidden="true" />
          <span>Más</span>
        </button>
      </nav>
    </div>
  );
}
