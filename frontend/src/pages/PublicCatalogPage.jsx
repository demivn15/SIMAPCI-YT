/**
 * Catálogo público de la producción científica (/produccion), sin sesión.
 * T-HU05-05 (PGPCECMC-51): listado, paginación y estado sin resultados de la API. Criterio CA13.
 *
 * Los filtros y la página viven en la URL (RFL-05): se pueden compartir, el botón «Atrás»
 * del navegador funciona y la descarga de HU11 podrá reutilizar la misma consulta.
 */
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, SearchX } from 'lucide-react';
import CatalogList from '../components/catalog/CatalogList';
import { CATALOG_PAGE_SIZE, listPublicProducts } from '../services/catalogService';
import { EMPTY_FILTERS, FILTER_KEYS, readCatalogParams, resultCountLabel, toCatalogParams } from '../utils/catalogFilters';

function EmptyState() {
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
  const { page } = readCatalogParams(searchParams);
  const hasLegacyFilters = FILTER_KEYS.some((key) => searchParams.has(key));
  const resultsRef = useRef(null);
  const previousPage = useRef(page);

  const productsQuery = useQuery({
    queryKey: ['publicProducts', page],
    queryFn: () => listPublicProducts({ page }),
    placeholderData: keepPreviousData,
  });

  // Al cambiar de página, el foco va al resumen de resultados (útil con teclado y lector).
  useEffect(() => {
    if (previousPage.current !== page) resultsRef.current?.focus();
    previousPage.current = page;
  }, [page]);

  const goToPage = (nextPage) => setSearchParams(toCatalogParams(EMPTY_FILTERS, nextPage));

  const data = productsQuery.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.page_size || CATALOG_PAGE_SIZE))) : 1;

  // Filter query parameters belong to HU06, which is not supported by the catalogue API yet.
  useEffect(() => {
    if (hasLegacyFilters) setSearchParams(toCatalogParams(EMPTY_FILTERS, page), { replace: true });
  }, [hasLegacyFilters, page, setSearchParams]);

  // A page that no longer exists (?page=9 with 2 pages) redirects to the last valid one.
  const pageOutOfRange = Boolean(data && !productsQuery.isPlaceholderData && data.total > 0 && page > totalPages);
  useEffect(() => {
    if (pageOutOfRange) setSearchParams(toCatalogParams(EMPTY_FILTERS, totalPages), { replace: true });
  }, [pageOutOfRange, setSearchParams, totalPages]);

  return (
    <>
      <div className="catalog-intro">
        <h1 className="display">Producción científica</h1>
        <p>Publicaciones y proyectos de investigación verificados de la Escuela.</p>
      </div>

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

        {data && data.total === 0 && <EmptyState />}

        {data && data.total > 0 && (
          <>
            <CatalogList products={data.items} />
            <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} onPage={goToPage} />
          </>
        )}
      </div>
    </>
  );
}
