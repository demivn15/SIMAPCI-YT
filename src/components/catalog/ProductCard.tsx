import React from 'react';
import { ScientificProduct, PROJECT_STATUS_LABELS } from '../../types';
import { BookOpen, FolderOpen, ArrowRight, CheckCircle2, Clock, ExternalLink, AlertTriangle, PencilLine } from 'lucide-react';
import { normalizeDoi } from '../../services/doiService';
import { productDateLabel, productStatusLabel } from '../../services/productPresentation';

export const ProductCard: React.FC<{
  product: ScientificProduct;
  onClick: () => void;
  onEdit?: () => void;
  showStatus?: boolean;
}> = ({ product, onClick, onEdit, showStatus = false }) => {
  const Icon = product.type === 'publicacion' ? BookOpen : FolderOpen;
  const Status = product.bibliographicSource ? BookOpen : product.status === 'verificado'
    ? CheckCircle2
    : product.status === 'rechazado' ? AlertTriangle : Clock;
  const doi = product.type === 'publicacion' && product.status === 'verificado' ? normalizeDoi(product.doi) : '';

  return (
    <article className="product-row">
      <div className="product-type-icon"><Icon /></div>
      <div className="product-row-body">
        <div className="product-meta">
          <span>{product.type === 'publicacion' ? 'Publicación' : 'Proyecto'} · {productDateLabel(product)}{product.type==='proyecto'&&product.projectStatus?` · ${PROJECT_STATUS_LABELS[product.projectStatus]}`:''}</span>
          {(showStatus || product.bibliographicSource) && (
            <span className={`status-label status-${product.status}`}>
              <Status size={17} />
              {productStatusLabel(product)}
            </span>
          )}
        </div>
        <h3><button onClick={onClick}>{product.title}</button></h3>
        <p>{product.authors.join(' · ')}</p>
        {doi && (
          <a
            className="product-doi-link"
            href={`https://doi.org/${doi}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir DOI ${doi} en una pestaña nueva`}
          >
            <span>DOI: {doi}</span>
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        )}
        <span className="product-line">
          {product.researchLine || 'Línea no asignada'}
          {product.bibliographicSource?.researchLineClassification && <small> · Sugerencia temporal</small>}
        </span>
      </div>
      <div className="product-row-actions">
        {onEdit&&<button type="button" className="product-edit" onClick={onEdit}><PencilLine size={16} aria-hidden="true"/>Corregir y reenviar</button>}
        <button type="button" className="product-open" onClick={onClick} aria-label={`Ver detalle: ${product.title}`}>
          Ver detalle<ArrowRight size={19} />
        </button>
      </div>
    </article>
  );
};
