/**
 * Pestañas del portal (PortalLayout). Las públicas son iguales para el visitante y el profesor;
 * el profesor ve además «Mi panel». Las tres primeras públicas van en la barra inferior móvil.
 */
import { BookOpen, GitCompareArrows, HelpCircle, Home, LayoutDashboard, Network, Users } from 'lucide-react';

export const BRAND_NAME = 'SIMAPCI';

export const ROLE_LABELS = { professor: 'Profesor', reviewer: 'Revisor' };

export const PUBLIC_TABS = [
  { to: '/inicio', label: 'Inicio', short: 'Inicio', icon: Home },
  { to: '/produccion', label: 'Publicaciones y proyectos', short: 'Publicaciones', icon: BookOpen },
  { to: '/docentes', label: 'Docentes', short: 'Docentes', icon: Users },
  { to: '/colaboraciones', label: 'Colaboraciones', short: 'Colaboraciones', icon: Network },
  { to: '/comparar', label: 'Comparar docentes', short: 'Comparar', icon: GitCompareArrows },
  { to: '/guia', label: 'Cómo leer los indicadores', short: 'Guía', icon: HelpCircle },
];

/** El panel también está activo mientras se registra un producto (/products/new). */
const PROFESSOR_TABS = [
  { to: '/dashboard', label: 'Mi panel', short: 'Mi panel', icon: LayoutDashboard, also: ['/products/new'] },
];

/** El Revisor aún no tiene pantalla propia (pendiente): ve las pestañas públicas. */
export function tabsForRole(role) {
  return role === 'professor' ? [...PROFESSOR_TABS, ...PUBLIC_TABS] : PUBLIC_TABS;
}

export function isTabActive(tab, pathname) {
  return [tab.to, ...(tab.also ?? [])].some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
