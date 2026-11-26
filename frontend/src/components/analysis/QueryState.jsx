/**
 * Estado de carga y de error común a las páginas de análisis (Inicio, Docentes, Colaboraciones
 * y Comparar), con el mismo aspecto que el catálogo.
 */
export function LoadingState({ children = 'Calculando…' }) {
  return (
    <div className="catalog-loading" role="status">
      <div className="spinner" aria-hidden="true" />
      {children}
    </div>
  );
}

export function ErrorState({ queries, children = 'No se pudieron cargar los datos. Revise su conexión e inténtelo de nuevo.' }) {
  return (
    <div className="notice notice-error catalog-error" role="alert">
      <span>{children}</span>
      <button type="button" className="btn btn-outline" onClick={() => queries.forEach((query) => query.refetch())}>
        Reintentar
      </button>
    </div>
  );
}

/** Nota de fuente y fecha de corte de los datos. */
const dateFormat = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });

export function SourceNote({ overview }) {
  if (!overview) return null;
  return (
    <p className="catalog-sample-note">
      Calculado con {overview.total_products} obras verificadas
      {overview.year_from ? ` (${overview.year_from}–${overview.year_to})` : ''}. Fuente: ORCID, OpenAlex, Crossref y
      SCImago
      {overview.data_as_of ? `; fecha de corte: ${dateFormat.format(new Date(overview.data_as_of))}` : ''}.
    </p>
  );
}
