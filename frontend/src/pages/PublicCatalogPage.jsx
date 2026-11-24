/**
 * Catálogo público de la producción científica (/produccion), sin sesión.
 * T-HU05-01 (PGPCECMC-47): listado y estados de la consulta.  Criterio CA13.
 * T-HU06-01 (PGPCECMC-53): filtros y estado sin resultados.   Criterios CA16, CA17 y CA18.
 *
 * Los filtros y la página viven en la URL (RFL-05): se pueden compartir, el botón «Atrás»
 * del navegador funciona y la descarga de HU11 podrá reutilizar la misma consulta.
 */
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, SearchX } from 'lucide-react';
import PublicShell from '../components/catalog/PublicShell';
import CatalogFilters from '../components/catalog/CatalogFilters';
import CatalogList from '../components/catalog/CatalogList';
import {
  CATALOG_PAGE_SIZE,
  listCatalogProfessors,
  listPublicProducts,
  USES_SAMPLE_DATA,
} from '../services/catalogService';
import {
  EMPTY_FILTERS,
  hasActiveFilters,
  readCatalogParams,
  resultCountLabel,
  toCatalogParams,
} from '../utils/catalogFilters';

function EmptyState({ filtered, onClear }) {
  if (!filtered) {
    return (
      <div className="catalog-empty">
        <h2 className="display">Todavía no hay productos publicados</h2>
        <p>Las publicaciones y los proyectos aparecerán aquí cuando el Revisor los verifique.</p>
      </div>
    );
  }
  // CA17 / RFL-02: sin resultados, sin mostrar productos que no corresponden.
  return (
    <div className="catalog-empty">
      <SearchX size={32} aria-hidden="true" />
      <h2 className="display">Ningún producto coincide con estos filtros</h2>
      <p>Pruebe con otro periodo o quite alguno de los filtros aplicados.</p>
      <button type="button" className="btn btn-outline" onClick={onClear}>
        Limpiar filtros
      </button>
    </div>
  );
}

function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="catalog-pagination" aria-label="Páginas de resultados">
      <button type="button" className="btn btn-outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft size={18} aria-hidden="true" />
        Anterior
      </button>
      <span aria-current="page">
        Página {page} de {totalPages}
      </span>
      <button type="button" className="btn btn-outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Siguiente
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </nav>
  );
}

export default function PublicCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, page } = readCatalogParams(searchParams);
  const resultsRef = useRef(null);
  const previousPage = useRef(page);

  const professorsQuery = useQuery({ queryKey: ['catalogProfessors'], queryFn: listCatalogProfessors });
  const productsQuery = useQuery({
    queryKey: ['publicProducts', filters, page],
    queryFn: () => listPublicProducts({ filters, page }),
    placeholderData: keepPreviousData,
  });

  // Al cambiar de página, el foco va al resumen de resultados (útil con teclado y lector).
  useEffect(() => {
    if (previousPage.current !== page) resultsRef.current?.focus();
    previousPage.current = page;
  }, [page]);

  // RFL-03: cualquier cambio de filtro vuelve a la página 1.
  const applyFilters = (next) => setSearchParams(toCatalogParams(next, 1));
  const goToPage = (nextPage) => setSearchParams(toCatalogParams(filters, nextPage));

  const data = productsQuery.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.page_size || CATALOG_PAGE_SIZE))) : 1;
  const filtered = hasActiveFilters(filters);

  // Un enlace con una página que ya no existe (?page=9 con 2 páginas) lleva a la última válida.
  const pageOutOfRange = Boolean(data && !productsQuery.isPlaceholderData && data.total > 0 && page > totalPages);
  useEffect(() => {
    if (pageOutOfRange) setSearchParams(toCatalogParams(filters, totalPages), { replace: true });
  }, [pageOutOfRange]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PublicShell>
      <div className="catalog-intro">
        <h1 className="display">Producción científica</h1>
        <p>Publicaciones y proyectos de investigación verificados de la Escuela.</p>
        {USES_SAMPLE_DATA && (
          <p className="catalog-sample-note">
            Vista con datos de ejemplo: el catálogo se conectará con los registros reales en T-HU05-05.
          </p>
        )}
      </div>

      <CatalogFilters filters={filters} professors={professorsQuery.data ?? []} onChange={applyFilters} />

      <div className="catalog-results">
        <p ref={resultsRef} tabIndex={-1} className="catalog-count" aria-live="polite">
          {data ? resultCountLabel(data.total) : ''}
        </p>

        {productsQuery.isPending && (
          <div className="catalog-loading" role="status">
            <div className="spinner" aria-hidden="true" />
            Cargando productos…
          </div>
        )}

        {productsQuery.isError && (
          <div className="notice notice-error catalog-error" role="alert">
            <span>No se pudo cargar el catálogo. Revise su conexión e inténtelo de nuevo.</span>
            <button type="button" className="btn btn-outline" onClick={() => productsQuery.refetch()}>
              Reintentar
            </button>
          </div>
        )}

        {data && data.total === 0 && <EmptyState filtered={filtered} onClear={() => applyFilters(EMPTY_FILTERS)} />}

        {data && data.total > 0 && (
          <>
            <CatalogList products={data.items} />
            <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} onPage={goToPage} />
          </>
        )}
      </div>
    </PublicShell>
  );
}
