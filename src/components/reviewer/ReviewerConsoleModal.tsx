import React, { useState } from 'react';
import { ScientificProduct, ProductStatus, PRODUCT_STATUS_LABELS, PROJECT_STATUS_LABELS } from '../../types';
import { productDateLabel } from '../../services/productPresentation';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle as ObservationIcon,
  Clock,
  AlertTriangle,
  Info,
  Check,
  Download,
  FileText,
} from 'lucide-react';
import { downloadArticleAttachment } from '../../services/articleAttachmentService';

interface ReviewerConsoleModalProps {
  products: ScientificProduct[];
  schoolCode?: string;
  onUpdateStatus: (
    productId: string,
    newStatus: ProductStatus,
    reason?: string
  ) => { success: boolean; error?: string };
}

type ReviewerFilter = 'pendientes' | 'verificados' | 'todos';

export const ReviewerConsoleModal: React.FC<ReviewerConsoleModalProps> = ({
  products,
  schoolCode = 'ECMC',
  onUpdateStatus,
}) => {
  const [filterMode, setFilterMode] = useState<ReviewerFilter>('pendientes');
  const [selectedProductId, setSelectedProductId] = useState<string>(
    products.find((p) => p.status === 'cargado')?.id || products[0]?.id || ''
  );
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isDownloadingArticle, setIsDownloadingArticle] = useState(false);


  // Filtrar lista izquierda según pestaña
  const filteredProducts = products.filter((p) => {
    if (filterMode === 'pendientes') return p.status === 'cargado';
    if (filterMode === 'verificados') return p.status === 'verificado';
    return true;
  });

  const selectedProduct =
    filteredProducts.find((p) => p.id === selectedProductId) || filteredProducts[0];

  const handleDownloadArticle = async () => {
    if (!selectedProduct?.articleAttachment) return;
    setIsDownloadingArticle(true);
    setActionNotice(null);
    try {
      await downloadArticleAttachment(selectedProduct.articleAttachment);
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : 'No se pudo descargar el artículo adjunto.');
    } finally {
      setIsDownloadingArticle(false);
    }
  };

  const handleVerify = () => {
    if (!selectedProduct) return;
    const res = onUpdateStatus(selectedProduct.id, 'verificado');
    if (res.success) {
      setActionNotice(
        `Producto "${selectedProduct.title}" verificado y certificado. Se ha notificado al autor.`
      );
      setShowRejectForm(false);
      setTimeout(() => setActionNotice(null), 3500);
    }
  };

  const handleReject = () => {
    if (!selectedProduct) return;
    if (!rejectionReason.trim()) {
      setActionNotice('Indica qué información debe corregirse o completarse.');
      return;
    }

    const res = onUpdateStatus(selectedProduct.id, 'rechazado', rejectionReason);
    if (res.success) {
      setActionNotice(
        `Producto "${selectedProduct.title}" puesto en observación. El docente recibió la información solicitada.`
      );
      setShowRejectForm(false);
      setRejectionReason('');
      setTimeout(() => setActionNotice(null), 3500);
    }
  };

  return (
    <section className="reviewer-page" aria-labelledby="reviewer-title">
      <div>
        <div className="reviewer-heading">
          <p className="eyebrow">REVISIÓN ACADÉMICA · {schoolCode}</p>
          <h1 id="reviewer-title">Comité Científico</h1>
          <p>Verifique la información registrada y comunique sus observaciones al docente.</p>
        </div>

        {actionNotice && (
          <div className="bg-neutral-900 text-white px-5 py-2 text-xs flex items-center justify-between shrink-0">
            <span>{actionNotice}</span>
            <button onClick={() => setActionNotice(null)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 3. Cuerpo de la Consola: Dos Columnas */}
        <div className="reviewer-workspace">
          {/* Columna Izquierda: Bandeja de Entrada */}
          <div className="reviewer-inbox">
            {/* Pestañas de la Bandeja */}
            <div className="p-3 flex items-center gap-1 text-xs font-semibold">
              <button
                onClick={() => setFilterMode('pendientes')}
                className={`flex-1 py-1.5 px-2 rounded-md transition-all text-center ${
                  filterMode === 'pendientes'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                Pendientes (
                {products.filter((p) => p.status === 'cargado').length})
              </button>
              <button
                onClick={() => setFilterMode('verificados')}
                className={`flex-1 py-1.5 px-2 rounded-md transition-all text-center ${
                  filterMode === 'verificados'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                Verificados
              </button>
              <button
                onClick={() => setFilterMode('todos')}
                className={`flex-1 py-1.5 px-2 rounded-md transition-all text-center ${
                  filterMode === 'todos'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                Todos ({products.length})
              </button>
            </div>

            {/* Lista de productos */}
            <div className="reviewer-list divide-y divide-neutral-200">
              {filteredProducts.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-400">
                  No hay productos en esta bandeja.
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const isSelected = selectedProduct?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedProductId(p.id);setShowRejectForm(false);setRejectionReason('');}}}
                      onClick={() => {
                        setSelectedProductId(p.id);
                        setShowRejectForm(false);
                        setRejectionReason('');
                      }}
                      className={`p-3.5 cursor-pointer transition-colors text-xs space-y-1.5 ${
                        isSelected
                          ? 'bg-red-50 border-l-4 border-red-500 shadow-xs'
                          : 'hover:bg-neutral-100/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-[10px] font-bold">
                        <span className="uppercase text-neutral-400">
                          {p.type === 'publicacion' ? 'PUBLICACIÓN' : 'PROYECTO'}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            p.status === 'verificado'
                              ? 'bg-emerald-100 text-emerald-800'
                              : p.status === 'cargado'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {PRODUCT_STATUS_LABELS[p.status]}
                        </span>
                      </div>

                      <h4
                        className={`font-bold line-clamp-2 ${
                          isSelected ? 'text-neutral-900' : 'text-neutral-700'
                        }`}
                      >
                        {p.title}
                      </h4>

                      <div className="text-[11px] text-neutral-500 truncate">
                        {p.authors[0]} · {productDateLabel(p)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Columna Derecha: Detalle y Acciones del Dictamen (Captura 12) */}
          <div className="reviewer-detail">
            {selectedProduct ? (
              <div className="space-y-5">
                {/* Metadatos superiores */}
                <div className="flex items-center justify-between text-xs text-neutral-500 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-neutral-700 uppercase">
                      {selectedProduct.type === 'publicacion'
                        ? 'PUBLICACIÓN CIENTÍFICA'
                        : 'PROYECTO DE INVESTIGACIÓN'}
                    </span>
                    <span>·</span>
                    <span>{selectedProduct.year}</span>
                  </div>
                  <span className="tabular-nums text-[11px] text-neutral-400">
                    ID: {selectedProduct.id}
                  </span>
                </div>

                {/* Título */}
                <h3 className="text-xl font-bold text-neutral-900 leading-snug">
                  {selectedProduct.title}
                </h3>

                {/* Docente / Medio */}
                <div className="text-xs text-neutral-600 space-y-1">
                  <p>
                    <strong className="text-neutral-700">Docente / Investigadores:</strong>{' '}
                    {selectedProduct.authors.join(', ')}
                  </p>
                  {(selectedProduct.venue || selectedProduct.fundingVenue) && (
                    <p>
                      <strong className="text-neutral-700">Medio / Fondo:</strong>{' '}
                      <span className="italic">
                        {selectedProduct.venue || selectedProduct.fundingVenue}
                      </span>
                    </p>
                  )}
                </div>

                {selectedProduct.type==='proyecto'&&<section className="review-project-summary" aria-label="Planificación del proyecto"><h4>Planificación del proyecto</h4><dl><div><dt>Estado</dt><dd>{selectedProduct.projectStatus?PROJECT_STATUS_LABELS[selectedProduct.projectStatus]:'No indicado'}</dd></div><div><dt>Dirección</dt><dd>{selectedProduct.projectDirector||'No indicada'}</dd></div><div><dt>Duración</dt><dd>{selectedProduct.projectDurationMonths?`${selectedProduct.projectDurationMonths} meses`:'No indicada'}</dd></div><div><dt>Inicio</dt><dd>{selectedProduct.projectStartDate||selectedProduct.year}</dd></div>{selectedProduct.projectEndDate&&<div><dt>Cierre previsto</dt><dd>{selectedProduct.projectEndDate}</dd></div>}</dl>{selectedProduct.expectedProducts&&selectedProduct.expectedProducts.length>0&&<div><strong>Productos esperados:</strong><ul>{selectedProduct.expectedProducts.map((item,index)=><li key={`${item}-${index}`}>{item}</li>)}</ul></div>}</section>}

                {selectedProduct.type === 'proyecto' && ((selectedProduct.projectProgressReports?.length || 0) > 0 || selectedProduct.projectClosureReport) && <details className="review-project-history">
                  <summary>Informes de seguimiento ({selectedProduct.projectProgressReports?.length || 0}){selectedProduct.projectClosureReport ? ' · incluye cierre' : ''}</summary>
                  <div className="review-project-history-body">
                    {[...(selectedProduct.projectProgressReports || [])].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)).map(report => <article key={report.id}>
                      <div className="review-project-history-heading"><strong>Avance: {report.progressPercent}%</strong><span>{new Date(`${report.periodStart}T12:00:00`).toLocaleDateString('es-EC')} – {new Date(`${report.periodEnd}T12:00:00`).toLocaleDateString('es-EC')}</span></div>
                      <p>{report.summary}</p>
                      <p><strong>Actividades:</strong> {report.completedActivities.join(' · ')}</p>
                      {report.achievedProducts.length > 0 && <p><strong>Resultados:</strong> {report.achievedProducts.join(' · ')}</p>}
                      {report.blockers && <p><strong>Dificultades:</strong> {report.blockers}</p>}
                      <p><strong>Próximos pasos:</strong> {report.nextSteps}</p>
                    </article>)}
                    {selectedProduct.projectClosureReport && <article className="review-project-closure">
                      <div className="review-project-history-heading"><strong>Informe de cierre · {PROJECT_STATUS_LABELS[selectedProduct.projectClosureReport.finalStatus]}</strong><span>{new Date(`${selectedProduct.projectClosureReport.closedAt}T12:00:00`).toLocaleDateString('es-EC')}</span></div>
                      <p>{selectedProduct.projectClosureReport.summary}</p>
                      {selectedProduct.projectClosureReport.deliveredProducts.length > 0 && <p><strong>Productos entregados:</strong> {selectedProduct.projectClosureReport.deliveredProducts.join(' · ')}</p>}
                      {selectedProduct.projectClosureReport.pendingItems.length > 0 && <p><strong>Pendientes:</strong> {selectedProduct.projectClosureReport.pendingItems.join(' · ')}</p>}
                      {selectedProduct.projectClosureReport.lessonsLearned && <p><strong>Aprendizajes:</strong> {selectedProduct.projectClosureReport.lessonsLearned}</p>}
                    </article>}
                  </div>
                </details>}

                {/* Resumen del documento */}
                <div>
                  <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Resumen del Documento
                  </h4>
                  <div className="p-3.5 text-xs text-neutral-700 leading-relaxed">
                    {selectedProduct.abstract}
                  </div>
                </div>

                {/* Identificador y Línea de Investigación */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">
                      Identificador
                    </span>
                    <span className="tabular-nums font-bold text-neutral-800">
                      {selectedProduct.status === 'verificado' && selectedProduct.doi
                        ? `DOI: ${selectedProduct.doi}`
                        : selectedProduct.projectCode
                        ? `CÓDIGO: ${selectedProduct.projectCode}`
                        : 'Sin identificador verificado'}
                    </span>
                  </div>

                  <div className="p-3">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">
                      Línea de Investigación
                    </span>
                    <span className="font-medium text-neutral-800">
                      {selectedProduct.researchLine}
                    </span>
                  </div>
                </div>

                {selectedProduct.type === 'publicacion' && selectedProduct.articleAttachment && (
                  <section className="bg-[#fffaf7] p-3.5" aria-label="Artículo adjunto para revisión privada">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 school-accent-text" aria-hidden="true" />
                        <div className="min-w-0 text-xs">
                          <strong className="block text-neutral-800">Artículo adjunto · revisión privada</strong>
                          <span className="mt-1 block break-all text-neutral-600">{selectedProduct.articleAttachment.fileName}</span>
                          {selectedProduct.privacyConsentAt && <span className="mt-1 block text-[10px] text-neutral-500">Aceptó la política de privacidad antes del envío.</span>}
                        </div>
                      </div>
                      <button type="button" onClick={handleDownloadArticle} disabled={isDownloadingArticle} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 school-accent-hover disabled:cursor-wait disabled:opacity-60">
                        <Download className="h-4 w-4" aria-hidden="true" />{isDownloadingArticle ? 'Preparando…' : 'Descargar PDF'}
                      </button>
                    </div>
                    <p className="mt-2 pl-6 text-[10px] text-neutral-500">El archivo se muestra aquí para verificación; no forma parte del catálogo público.</p>
                  </section>
                )}

                {/* Sección de Dictamen */}
                <div className="pt-4 space-y-3">
                  <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                    Verificar información del producto
                  </h4>

                  {/* Formulario de observación */}
                  {showRejectForm ? (
                    <div className="p-4 bg-amber-50 space-y-3 text-xs animate-in fade-in">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span>Información por completar o corregir (obligatoria)</span>
                      </div>
                      <textarea aria-label="Información por completar o corregir"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Indica qué dato, evidencia o ajuste hace falta para verificar la información..."
                        rows={3}
                        className="w-full p-2.5 rounded-lg border border-amber-300 text-xs focus:ring-1 focus:ring-amber-500 bg-white resize-none"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowRejectForm(false)}
                          className="px-3 py-1.5 rounded-lg border border-neutral-300 text-neutral-700 bg-white font-semibold"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleReject}
                          className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition-colors"
                        >
                          Enviar observación al docente
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Botón de verificación */}
                      <button
                        onClick={handleVerify}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Verificar Información</span>
                      </button>

                      {/* Acción para solicitar ajustes */}
                      <button
                        onClick={() => setShowRejectForm(true)}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-300 text-amber-800 hover:bg-amber-50 font-bold text-xs transition-colors"
                      >
                          <ObservationIcon className="w-4 h-4" />
                        <span>Solicitar corrección</span>
                      </button>

                      {selectedProduct.status !== 'cargado' && (
                        <button
                          onClick={() => onUpdateStatus(selectedProduct.id, 'cargado')}
                          className="text-xs text-neutral-500 hover:text-neutral-800 underline ml-auto"
                        >
                          Regresar a pendiente de verificación
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-neutral-400 text-xs">
                Selecciona un producto de la bandeja para auditar.
              </div>
            )}

            {/* Pie institucional */}
            <div className="mt-8 pt-3 flex items-center justify-between text-xs text-neutral-400">
              <span className="text-[11px]">
                La verificación actualiza los indicadores institucionales y el historial de
                cargo docente.
              </span>

            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
