import React from 'react';
import { YachayLogo } from './SchoolLogo';

export function PortalEntryLoading() {
  return <div className="portal-loading" role="status" aria-live="polite">
    <YachayLogo width={112} />
    <span>Cargando la escuela…</span>
  </div>;
}
