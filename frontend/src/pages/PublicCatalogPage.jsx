/**
 * Catálogo público de la producción científica (/produccion), sin sesión.
 * T-HU06-05 (PGPCECMC-57): filtros aplicados al listado y reflejados en la URL (CA16, CA18).
 *
 * Los filtros y la página viven en la URL (RFL-05): se pueden compartir, el botón «Atrás»
 * del navegador funciona y la descarga de HU11 podrá reutilizar la misma consulta.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, SearchX } from 'lucide-react';
import PublicShell from '../components/catalog/PublicShell';
import CatalogFilters from '../components/catalog/CatalogFilters';
import CatalogList from '../components/catalog/CatalogList';
import {
  CATALOG_PAGE_SIZE,
  listCatalogProfessors,
  listPublicProducts,
} from '../services/catalogService';
import {
  EMPTY_FILTERS,
  FILTER_KEYS,
  hasActiveFilters,
  readCatalogParams,
  resultCountLabel,
  toCatalogParams,
} from '../utils/catalogFilters';

function EmptyState({ filtered, onClear }) {
  if (filtered) {
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

  return (
    <div className="catalog-empty">
      <SearchX size={32} aria-hidden="true" />
      <h2 className="display">Todavía no hay productos publicados</h2>
      <p>Las publicaciones y los proyectos aparecerán aquí cuando el Revisor los verifique.</p>
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
  const { filters, page } = useMemo(() => readCatalogParams(searchParams), [searchParams]);
  const resultsRef = useRef(null);
  const previousPage = useRef(page);

  const professorsQuery = useQuery({
    queryKey: ['catalogProfessors'],
    queryFn: listCatalogProfessors,
  });
  const productsQuery = useQuery({
    queryKey: ['publicProducts', filters, page],
    queryFn: () => listPublicProducts({ filters, page }),
    placeholderData: (previousData, previousQuery) => {
      const previousFilters = previousQuery?.queryKey?.[1];
      return previousFilters && FILTER_KEYS.every((key) => previousFilters[key] === filters[key])
        ? previousData
        : undefined;
    },
  });

  // Al cambiar de página, el foco va al resumen de resultados (útil con teclado y lector).
  useEffect(() => {
    if (previousPage.current !== page) resultsRef.current?.focus();
    previousPage.current = page;
  }, [page]);

  const applyFilters = (nextFilters) => setSearchParams(toCatalogParams(nextFilters, 1));
  const goToPage = (nextPage) => setSearchParams(toCatalogParams(filters, nextPage));

  const data = productsQuery.data;
  const hasCurrentData = data && !productsQuery.isPlaceholderData;
  const totalPages = hasCurrentData
    ? Math.max(1, Math.ceil(data.total / (data.page_size || CATALOG_PAGE_SIZE)))
    : 1;

  // A page that no longer exists (?page=9 with 2 filtered pages) redirects to the last valid one.
  const pageOutOfRange = Boolean(hasCurrentData && data.total > 0 && page > totalPages);
  useEffect(() => {
    if (pageOutOfRange) setSearchParams(toCatalogParams(filters, totalPages), { replace: true });
  }, [filters, pageOutOfRange, setSearchParams, totalPages]);

  return (
    <PublicShell>
      <div className="catalog-intro">
        <h1 className="display">Producción científica</h1>
        <p>Publicaciones y proyectos de investigación verificados de la Escuela.</p>
      </div>

      <CatalogFilters
        filters={filters}
        professors={professorsQuery.data ?? []}
        onChange={applyFilters}
      />

      <div className="catalog-results">
        <p ref={resultsRef} tabIndex={-1} className="catalog-count" aria-live="polite">
          {hasCurrentData ? resultCountLabel(data.total) : ''}
        </p>

        {(productsQuery.isPending || productsQuery.isPlaceholderData) && (
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

        {professorsQuery.isError && (
          <div className="notice notice-error catalog-error" role="alert">
            <span>No se pudieron cargar las opciones de profesor.</span>
            <button type="button" className="btn btn-outline" onClick={() => professorsQuery.refetch()}>
              Reintentar
            </button>
          </div>
        )}

        {hasCurrentData && data.total === 0 && (
          <EmptyState filtered={hasActiveFilters(filters)} onClear={() => applyFilters(EMPTY_FILTERS)} />
        )}

        {hasCurrentData && data.total > 0 && (
          <>
            <CatalogList products={data.items} />
            <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} onPage={goToPage} />
          </>
        )}
      </div>
    </PublicShell>
  );
}
