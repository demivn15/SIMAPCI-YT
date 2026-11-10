import React, { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, FileCheck2, X } from 'lucide-react';
import { ProjectStatus, ScientificProduct, PROJECT_STATUS_LABELS } from '../../types';
import { productService } from '../../services/productService';

interface ProjectTrackingModalProps {
  product: ScientificProduct;
  onClose: () => void;
  onUpdated: (product: ScientificProduct) => void;
}

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;
const parseLines = (value: string) => value.split(/[;\n]+/).map(item => item.trim()).filter(Boolean);
const formattedDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' });

export const ProjectTrackingModal: React.FC<ProjectTrackingModalProps> = ({ product, onClose, onUpdated }) => {
  const projectIsTerminal = product.projectStatus === 'finalizado' || product.projectStatus === 'cancelado';
  const [section, setSection] = useState<'avance' | 'cierre'>(projectIsTerminal ? 'cierre' : 'avance');
  const [periodStart, setPeriodStart] = useState(monthStart());
  const [periodEnd, setPeriodEnd] = useState(today());
  const [progressPercent, setProgressPercent] = useState(25);
  const [summary, setSummary] = useState('');
  const [activities, setActivities] = useState('');
  const [achievedProducts, setAchievedProducts] = useState('');
  const [blockers, setBlockers] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [statusAfterReport, setStatusAfterReport] = useState<'activo' | 'en_pausa'>(product.projectStatus === 'en_pausa' ? 'en_pausa' : 'activo');
  const [closedAt, setClosedAt] = useState(today());
  const [finalStatus, setFinalStatus] = useState<'finalizado' | 'cancelado'>(product.projectStatus === 'cancelado' ? 'cancelado' : 'finalizado');
  const [closureSummary, setClosureSummary] = useState('');
  const [deliveredProducts, setDeliveredProducts] = useState('');
  const [pendingItems, setPendingItems] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const hasClosureReport = !!product.projectClosureReport;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const handleProgressSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    const result = productService.addProjectProgressReport(product.id, {
      periodStart,
      periodEnd,
      progressPercent,
      summary,
      completedActivities: parseLines(activities),
      achievedProducts: parseLines(achievedProducts),
      blockers,
      nextSteps,
      statusAfterReport,
    });
    if (!result.success || !result.product) {
      setNotice({ type: 'error', text: result.error || 'No se pudo guardar el informe.' });
      return;
    }
    onUpdated(result.product);
    setNotice({ type: 'success', text: 'El informe de avance quedó guardado.' });
    setSummary('');
    setActivities('');
    setAchievedProducts('');
    setBlockers('');
    setNextSteps('');
  };

  const handleClosureSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    const result = productService.closeProject(product.id, {
      closedAt,
      finalStatus,
      summary: closureSummary,
      deliveredProducts: parseLines(deliveredProducts),
      pendingItems: parseLines(pendingItems),
      lessonsLearned,
    });
    if (!result.success || !result.product) {
      setNotice({ type: 'error', text: result.error || 'No se pudo guardar el informe de cierre.' });
      return;
    }
    onUpdated(result.product);
    setNotice({ type: 'success', text: 'El informe de cierre quedó guardado.' });
  };

  return <div className="project-tracking-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="project-tracking-modal" role="dialog" aria-modal="true" aria-labelledby="project-tracking-title">
      <header className="project-tracking-header">
        <div><p className="eyebrow">SEGUIMIENTO · PROYECTO</p><h2 id="project-tracking-title">{product.title}</h2><p>Estado actual: <strong>{product.projectStatus ? PROJECT_STATUS_LABELS[product.projectStatus] : 'No indicado'}</strong></p></div>
        <button type="button" className="project-tracking-close" onClick={onClose} aria-label="Cerrar seguimiento"><X size={20}/></button>
      </header>

      <div className="project-tracking-body">
        <section className="project-tracking-history" aria-labelledby="project-tracking-history-title">
          <div className="project-tracking-section-title"><ClipboardList size={18}/><h3 id="project-tracking-history-title">Historial de avances</h3><span>{product.projectProgressReports?.length || 0}</span></div>
          {product.projectProgressReports?.length ? <ol className="project-tracking-report-list">
            {[...product.projectProgressReports].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)).map(report => <li key={report.id}>
              <div className="project-tracking-report-heading"><strong>{report.progressPercent}% de avance</strong><span>{formattedDate(report.periodStart)} – {formattedDate(report.periodEnd)}</span></div>
              <p>{report.summary}</p>
              <div className="project-tracking-report-details"><span>Estado: {PROJECT_STATUS_LABELS[report.statusAfterReport]}</span><span>Próximos pasos: {report.nextSteps}</span></div>
            </li>)}
          </ol> : <p className="project-tracking-empty">Todavía no hay informes de avance.</p>}
        </section>

        {product.projectClosureReport && <section className="project-closure-summary" aria-labelledby="project-closure-summary-title">
          <div className="project-tracking-section-title"><FileCheck2 size={18}/><h3 id="project-closure-summary-title">Informe de cierre</h3></div>
          <p className="project-closure-date">{PROJECT_STATUS_LABELS[product.projectClosureReport.finalStatus]} · {formattedDate(product.projectClosureReport.closedAt)}</p>
          <p>{product.projectClosureReport.summary}</p>
          {product.projectClosureReport.deliveredProducts.length > 0 && <div><strong>Productos entregados</strong><ul>{product.projectClosureReport.deliveredProducts.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>}
          {product.projectClosureReport.pendingItems.length > 0 && <div><strong>Pendientes o continuidad</strong><ul>{product.projectClosureReport.pendingItems.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>}
          {product.projectClosureReport.lessonsLearned && <p><strong>Aprendizajes:</strong> {product.projectClosureReport.lessonsLearned}</p>}
        </section>}

        {!hasClosureReport && <>
          <div className="project-tracking-tabs" role="group" aria-label="Tipo de informe">
            <button type="button" aria-pressed={section === 'avance'} disabled={projectIsTerminal} className={section === 'avance' ? 'selected' : ''} onClick={() => { setSection('avance'); setNotice(null); }}>Registrar avance</button>
            <button type="button" aria-pressed={section === 'cierre'} className={section === 'cierre' ? 'selected' : ''} onClick={() => { setSection('cierre'); setNotice(null); }}>Cerrar proyecto</button>
          </div>

          {section === 'avance' ? <form className="project-tracking-form" onSubmit={handleProgressSubmit}>
            <div className="project-tracking-grid">
              <label>Desde<input type="date" value={periodStart} max={periodEnd} onChange={event => setPeriodStart(event.target.value)} required/></label>
              <label>Hasta<input type="date" value={periodEnd} min={periodStart} max={today()} onChange={event => setPeriodEnd(event.target.value)} required/></label>
              <label>Avance del proyecto (%)<input type="number" min="0" max="100" step="1" value={progressPercent} onChange={event => setProgressPercent(Number(event.target.value))} required/></label>
              <label>Estado después del informe<select value={statusAfterReport} onChange={event => setStatusAfterReport(event.target.value as 'activo' | 'en_pausa')}><option value="activo">Activo</option><option value="en_pausa">En pausa</option></select></label>
            </div>
            <label>Resumen del avance<textarea value={summary} onChange={event => setSummary(event.target.value)} minLength={20} rows={3} required placeholder="Describa qué se avanzó durante este periodo."/></label>
            <label>Actividades realizadas<textarea value={activities} onChange={event => setActivities(event.target.value)} rows={3} required placeholder="Una actividad por línea"/></label>
            <label>Productos o resultados alcanzados<textarea value={achievedProducts} onChange={event => setAchievedProducts(event.target.value)} rows={2} placeholder="Uno por línea, si aplica"/></label>
            <label>Dificultades o riesgos<textarea value={blockers} onChange={event => setBlockers(event.target.value)} rows={2} placeholder="Opcional"/></label>
            <label>Próximos pasos<textarea value={nextSteps} onChange={event => setNextSteps(event.target.value)} minLength={8} rows={2} required placeholder="Indique las tareas del siguiente periodo."/></label>
            <button className="project-tracking-submit" type="submit"><CheckCircle2 size={17}/>Guardar informe de avance</button>
          </form> : <form className="project-tracking-form" onSubmit={handleClosureSubmit}>
            <div className="project-tracking-grid">
              <label>Resultado<select value={finalStatus} onChange={event => setFinalStatus(event.target.value as 'finalizado' | 'cancelado')}><option value="finalizado">Finalizado</option><option value="cancelado">Cancelado</option></select></label>
              <label>Fecha de cierre<input type="date" value={closedAt} max={today()} onChange={event => setClosedAt(event.target.value)} required/></label>
            </div>
            <label>Resumen de cierre<textarea value={closureSummary} onChange={event => setClosureSummary(event.target.value)} minLength={30} rows={4} required placeholder="Explique los resultados generales y el motivo de cierre."/></label>
            <label>Productos y resultados entregados<textarea value={deliveredProducts} onChange={event => setDeliveredProducts(event.target.value)} rows={3} required={finalStatus === 'finalizado'} placeholder="Uno por línea. Obligatorio si el proyecto finalizó."/></label>
            <label>Pendientes o continuidad<textarea value={pendingItems} onChange={event => setPendingItems(event.target.value)} rows={2} placeholder="Opcional"/></label>
            <label>Aprendizajes del proyecto<textarea value={lessonsLearned} onChange={event => setLessonsLearned(event.target.value)} rows={2} placeholder="Opcional"/></label>
            <p className="project-tracking-help">Al guardar el cierre, el estado del proyecto cambiará a {PROJECT_STATUS_LABELS[finalStatus].toLowerCase()} y no se podrán registrar más avances.</p>
            <button className="project-tracking-submit" type="submit"><FileCheck2 size={17}/>Guardar informe de cierre</button>
          </form>}
        </>}

        {notice && <p className={`project-tracking-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
      </div>
      <footer className="project-tracking-footer"><span>ID del sistema: <strong>{product.id}</strong></span><button type="button" onClick={onClose}>Cerrar</button></footer>
    </section>
  </div>;
};
