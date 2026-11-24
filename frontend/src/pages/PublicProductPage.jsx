/**
 * Detalle público de un producto (/produccion/:productId), sin sesión.
 * T-HU05-01 (PGPCECMC-47). Criterio CA14: muestra los datos públicos del producto y ningún
 * dato privado de las cuentas (correo, usuario, motivo de rechazo ni autor de la decisión).
 * Si el producto no existe o no es público (cargado o rechazado), se responde igual: así no se
 * revela que existe un registro pendiente (RU-08).
 */
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, FileText, FolderKanban } from 'lucide-react';
import PublicShell from '../components/catalog/PublicShell';
import { getPublicProduct } from '../services/catalogService';
import { productTypeLabel, projectStatusLabel } from '../utils/catalogFilters';

function Field({ label, children }) {
  if (children === null || children === undefined || children === '') return null;
  return (
    <div className="product-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function PublicProductPage() {
  const { productId } = useParams();
  const location = useLocation();
  const backTo = `/produccion${location.state?.fromSearch ?? ''}`;

  const { data: product, isPending, isError, refetch } = useQuery({
    queryKey: ['publicProduct', productId],
    queryFn: () => getPublicProduct(productId),
  });

  const backLink = (
    <Link to={backTo} className="product-back">
      <ArrowLeft size={18} aria-hidden="true" />
      Volver a los resultados
    </Link>
  );

  if (isPending) {
    return (
      <PublicShell>
        {backLink}
        <div className="catalog-loading" role="status">
          <div className="spinner" aria-hidden="true" />
          Cargando producto…
        </div>
      </PublicShell>
    );
  }

  if (isError) {
    return (
      <PublicShell>
        {backLink}
        <div className="notice notice-error catalog-error" role="alert">
          <span>No se pudo cargar el producto. Revise su conexión e inténtelo de nuevo.</span>
          <button type="button" className="btn btn-outline" onClick={() => refetch()}>
            Reintentar
          </button>
        </div>
      </PublicShell>
    );
  }

  if (!product) {
    return (
      <PublicShell>
        {backLink}
        <div className="catalog-empty">
          <h1 className="display">Producto no disponible</h1>
          <p>Este producto no existe o todavía no está publicado en el catálogo.</p>
        </div>
      </PublicShell>
    );
  }

  const isProject = product.type === 'proyecto';
  const Icon = isProject ? FolderKanban : FileText;

  return (
    <PublicShell>
      {backLink}
      <article className="product-detail">
        <header className="product-detail-header">
          <p className="catalog-entry-type">
            <Icon size={18} aria-hidden="true" />
            {productTypeLabel(product.type)}
            {product.source === 'orcid' && <span className="catalog-source">Fuente: ORCID</span>}
          </p>
          <h1 className="display">{product.title}</h1>
          <p className="product-detail-authors">{product.authors.join(', ')}</p>
        </header>

        <dl className="product-fields">
          <Field label="Año">{product.year}</Field>
          <Field label="Línea de investigación">{product.research_line}</Field>
          {isProject ? (
            <>
              <Field label="Código del proyecto">{product.project_code}</Field>
              <Field label="Estado del proyecto">
                {product.project_status ? projectStatusLabel(product.project_status) : null}
              </Field>
            </>
          ) : (
            <>
              <Field label="Revista o medio">{product.venue}</Field>
              <Field label="DOI">
                {product.doi ? (
                  <a href={`https://doi.org/${product.doi}`} target="_blank" rel="noreferrer">
                    {product.doi}
                    <ExternalLink size={15} aria-hidden="true" />
                    <span className="sr-only"> (se abre en otra pestaña)</span>
                  </a>
                ) : null}
              </Field>
            </>
          )}
          <Field label="Profesor responsable">{product.owner?.full_name}</Field>
          <Field label="Fuente">{product.source === 'orcid' ? 'Importado desde ORCID' : 'Registro del profesor'}</Field>
        </dl>

        {product.abstract && (
          <section className="product-abstract" aria-labelledby="abstract-title">
            <h2 id="abstract-title">Resumen</h2>
            <p>{product.abstract}</p>
          </section>
        )}
      </article>
    </PublicShell>
  );
}
