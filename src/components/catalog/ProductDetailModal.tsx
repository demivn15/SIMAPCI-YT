import React, { useState } from 'react';
import { ScientificProduct, PROJECT_STATUS_LABELS } from '../../types';
import { normalizeDoi } from '../../services/doiService';
import { productDateLabel, productStatusLabel, productCitationValue, productCitationLabel } from '../../services/productPresentation';
import { CitationStyle, formatProductCitation } from '../../services/citationService';
import {
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  Users,
  FileText,
  Quote,
  Shield,
  Copy,
  Check,
} from 'lucide-react';

interface ProductDetailModalProps {
  product: ScientificProduct | null;
  onClose: () => void;
  onEdit?: () => void;
  showStatus?: boolean;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, onClose, onEdit, showStatus = false }) => {
  const [citationStyle, setCitationStyle] = useState<CitationStyle>('APA 7');
  const [copiedCitation, setCopiedCitation] = useState(false);
  if (!product) return null;

  const isPublicacion = product.type === 'publicacion';
  const isVerificado = product.status === 'verificado';
  const isCargado = product.status === 'cargado';
  const isRechazado = product.status === 'rechazado';
  const source = product.bibliographicSource;
  const citations = productCitationValue(product);
  const citation = formatProductCitation(isVerificado ? product : { ...product, doi: undefined }, citationStyle);

  const cleanDoi = isVerificado ? normalizeDoi(product.doi) : '';
  const doiUrl = cleanDoi ? `https://doi.org/${cleanDoi}` : null;
  const venue = product.venue || product.fundingVenue;

  const copyCitation = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(citation);
      } else {
        const field = document.createElement('textarea');
        field.value = citation;
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        if (!copied) throw new Error('copy failed');
      }
      setCopiedCitation(true);
      window.setTimeout(() => setCopiedCitation(false), 1800);
    } catch {
      setCopiedCitation(false);
    }
  };

  return (
    <div className="product-detail-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className="product-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-detail-title"
      >
        <header className="product-detail-header">
          <div className="product-detail-meta">
            <span className={`product-detail-kind ${isPublicacion ? 'is-publication' : 'is-project'}`}>
              {isPublicacion ? 'Publicación científica' : 'Proyecto de investigación'}
            </span>
            <span className="product-detail-meta-divider" aria-hidden="true">·</span>
            <span>{productDateLabel(product)}</span>
            <span className="product-detail-meta-divider" aria-hidden="true">·</span>
            <span className="product-detail-research-line">
              {product.researchLine || 'Línea no asignada'}
              {source?.researchLineClassification ? ' · Sugerencia temporal' : ''}
            </span>
          </div>

          <button
            onClick={onClose}
            className="product-detail-close-icon"
            aria-label="Cerrar detalle del producto"
          >
            <X size={21} aria-hidden="true" />
          </button>
        </header>

        <div className="product-detail-content">
          {(showStatus || source) && (
            <div className={`product-detail-status ${isVerificado ? 'is-verified' : isCargado ? 'is-pending' : 'is-rejected'}`}>
              {source ? <><FileText size={17} /><span>{productStatusLabel(product)}</span></> : <>
                {isVerificado && <><CheckCircle2 size={17} /><span>{productStatusLabel(product)} / Certificado</span></>}
                {isCargado && <><Clock size={17} /><span>{productStatusLabel(product)}</span></>}
                {isRechazado && <><AlertTriangle size={17} /><span>{productStatusLabel(product)}</span></>}
              </>}
            </div>
          )}

          <div className="product-detail-intro">
            <p className="product-detail-eyebrow">Ficha del producto</p>
            <h2 id="product-detail-title">{product.title}</h2>
            {(venue || source) && (
              <p className="product-detail-venue">
                <span>{isPublicacion ? 'Publicado en' : 'Entidad o fondo'}</span>
                <strong>{venue || 'No disponible'}</strong>
                {product.volumeIssue && <span className="product-detail-volume">{product.volumeIssue}</span>}
              </p>
            )}
          </div>

          {showStatus && isRechazado && product.rejectionReason && (
            <div className="product-detail-observation">
              <div><Shield size={17} /><strong>Observación del Comité Científico</strong></div>
              <p>{product.rejectionReason}</p>
            </div>
          )}

          <section className="product-detail-section" aria-labelledby="product-detail-authors">
            <h3 id="product-detail-authors"><Users size={18} aria-hidden="true" />{source ? 'Investigadores vinculados por ORCID' : isPublicacion ? 'Autores' : 'Investigadores participantes'}</h3>
            <div className="product-detail-author-list">
              {(product.type === 'proyecto' && product.projectParticipants?.length ? product.projectParticipants : product.authors).map((author, index) => (
                <span key={`${author}-${index}`} className="product-detail-author">{author}</span>
              ))}
              {!product.authors.length && !product.projectParticipants?.length && <span className="product-detail-author">No disponible</span>}
            </div>
          </section>

          <section className="product-detail-section" aria-labelledby="product-detail-abstract">
            <h3 id="product-detail-abstract"><FileText size={18} aria-hidden="true" />Resumen académico (abstract)</h3>
            <div className="product-detail-abstract">{product.abstract?.trim() || 'No disponible'}</div>
          </section>

          {source && <section className="product-detail-section" aria-labelledby="product-detail-source">
            <h3 id="product-detail-source"><FileText size={18} aria-hidden="true" />Fuente bibliográfica</h3>
            <p><strong>Fuente:</strong> {source.dataset || 'No disponible'}</p>
            <p><strong>Tipo de publicación:</strong> {source.publicationType || 'No disponible'}</p>
            <p><strong>Cuartil SJR:</strong> {source.sjrQuartile || 'No disponible'}</p>
            <p><strong>Índice SJR:</strong> {source.sjrScore ?? 'No disponible'}</p>
            {source.researchLineClassification && <p><strong>Clasificación temática:</strong> sugerencia temporal del diccionario ({source.researchLineClassification.strength} coincidencia; {source.researchLineClassification.matchedKeywords.join(', ')}).</p>}
          </section>}

          <section className="product-detail-section product-detail-citation-copy" aria-labelledby="product-detail-citation-title">
            <div className="product-detail-citation-heading"><h3 id="product-detail-citation-title"><Quote size={18} aria-hidden="true"/>Cita bibliográfica</h3><span>Copie una referencia lista para usar</span></div>
            <div className="product-detail-citation-styles" role="group" aria-label="Formato de cita">
              {(['APA 7', 'IEEE', 'Vancouver'] as CitationStyle[]).map(style=><button type="button" key={style} aria-pressed={citationStyle===style} className={citationStyle===style?'selected':''} onClick={()=>setCitationStyle(style)}>{style}</button>)}
            </div>
            <blockquote className="product-detail-citation-text">{citation}</blockquote>
            {source && <p>El archivo solo incluye investigadores vinculados por ORCID; compruebe la autoría completa en el DOI antes de citar.</p>}
            <button type="button" className="product-detail-copy-citation" onClick={copyCitation}>{copiedCitation?<Check size={16} aria-hidden="true"/>:<Copy size={16} aria-hidden="true"/>}{copiedCitation?'Cita copiada':`Copiar cita ${citationStyle}`}</button>
          </section>

          <div className="product-detail-information">
            <section className="product-detail-card" aria-labelledby="product-detail-identifier">
              <h3 id="product-detail-identifier">Identificador digital</h3>
              <p className="product-detail-identifier-value">
                {isVerificado && product.doi && <>DOI: {product.doi}</>}
                {product.projectCode && <>Código: {product.projectCode}</>}
                {(!isVerificado || !product.doi) && !product.projectCode && 'Sin identificador publicado'}
              </p>
              {doiUrl && (
                <a
                  href={doiUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="product-detail-doi-link"
                >
                  Abrir enlace DOI oficial <ExternalLink size={15} aria-hidden="true" />
                </a>
              )}
            </section>

            <section className="product-detail-card product-detail-citations" aria-labelledby="product-detail-citations">
              <h3 id="product-detail-citations">Impacto de citas</h3>
              <div className="product-detail-citation-count">
                <Quote size={20} aria-hidden="true" />
                <strong>{productCitationLabel(product)}</strong>
                {citations !== null && <span>{citations === 1 ? 'cita registrada' : 'citas registradas'}</span>}
              </div>
              <p>Registro bibliométrico</p>
            </section>
            {product.type==='proyecto'&&<section className="product-detail-card product-detail-project-status" aria-labelledby="product-detail-project-status"><h3 id="product-detail-project-status">Estado y duración del proyecto</h3><dl><div><dt>Estado</dt><dd>{product.projectStatus?PROJECT_STATUS_LABELS[product.projectStatus]:'No registrado'}</dd></div>{product.projectDirector&&<div><dt>Dirección</dt><dd>{product.projectDirector}</dd></div>}<div><dt>Duración estimada</dt><dd>{product.projectDurationMonths?`${product.projectDurationMonths} meses`:'No registrada'}</dd></div><div><dt>Inicio</dt><dd>{product.projectStartDate||product.year}</dd></div>{product.projectEndDate&&<div><dt>Cierre previsto</dt><dd>{product.projectEndDate}</dd></div>}</dl>{product.expectedProducts&&product.expectedProducts.length>0&&<div className="product-detail-expected-products"><strong>Productos esperados</strong><ul>{product.expectedProducts.map((item,index)=><li key={`${item}-${index}`}>{item}</li>)}</ul></div>}</section>}
          </div>
        </div>

        <footer className="product-detail-footer">
          <p><span>ID Sistema</span><strong>{product.id}</strong></p>
          {showStatus&&isRechazado&&onEdit&&<button type="button" onClick={onEdit} className="product-detail-edit-button">Corregir y reenviar</button>}
          <button onClick={onClose} className="product-detail-close-button">Cerrar ventana</button>
        </footer>
      </section>
    </div>
  );
};
