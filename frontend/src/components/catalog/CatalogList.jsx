/**
 * Listado público de productos - T-HU05-01 (PGPCECMC-47). Criterio CA13.
 *
 * Se presenta como una bibliografía agrupada por año (RFL-04: del más reciente al más antiguo).
 * En escritorio el año ocupa una columna propia; en móvil queda como encabezado de su grupo.
 * Cada entrada muestra solo datos públicos (tabla 3.3); el detalle está en /produccion/:id.
 */
import { Link, useLocation } from 'react-router-dom';
import { FileText, FolderKanban } from 'lucide-react';
import { groupByYear, productTypeLabel, projectStatusLabel } from '../../utils/catalogFilters';

function EntryMeta({ product }) {
  if (product.type === 'proyecto') {
    return (
      <p className="catalog-entry-meta">
        <span>Código {product.project_code}</span>
        {product.project_status && (
          <span className={`project-status project-status-${product.project_status}`}>
            {projectStatusLabel(product.project_status)}
          </span>
        )}
      </p>
    );
  }
  return product.venue ? (
    <p className="catalog-entry-meta">
      <cite>{product.venue}</cite>
    </p>
  ) : null;
}

export default function CatalogList({ products }) {
  const location = useLocation();
  // El detalle recibe la búsqueda actual para que «Volver a los resultados» no pierda los filtros.
  const linkState = { fromSearch: location.search };

  return (
    <div className="catalog-list">
      {groupByYear(products).map((group) => (
        <section key={group.year} className="catalog-year" aria-labelledby={`year-${group.year}`}>
          <h2 id={`year-${group.year}`} className="display catalog-year-label">
            {group.year}
          </h2>
          <ol className="catalog-entries">
            {group.items.map((product) => {
              const Icon = product.type === 'proyecto' ? FolderKanban : FileText;
              return (
                <li key={product.id} className="catalog-entry">
                  <p className="catalog-entry-type">
                    <Icon size={17} aria-hidden="true" />
                    {productTypeLabel(product.type)}
                    {product.source === 'orcid' && <span className="catalog-source">Fuente: ORCID</span>}
                  </p>
                  <h3 className="catalog-entry-title">
                    <Link to={`/produccion/${encodeURIComponent(product.id)}`} state={linkState}>
                      {product.title}
                    </Link>
                  </h3>
                  <p className="catalog-entry-authors">{product.authors.join(', ')}</p>
                  <EntryMeta product={product} />
                  <p className="catalog-entry-line">{product.research_line}</p>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
