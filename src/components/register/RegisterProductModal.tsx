import React, { useState, useEffect, useRef } from 'react';
import {
  ScientificProduct,
  ProductType,
  AcademicSemester,
  ProjectStatus,
  PROJECT_STATUS_LABELS,
  OfficialResearchLine,
  TeacherUser,
  ProductAttachment,
} from '../../types';
import { getSchoolByCode } from '../../constants/schools';
import { doiService, OrcidWorkItem } from '../../services/doiService';
import { pdfExtractorService } from '../../services/pdfExtractorService';
import { productService, DuplicateCheckResult } from '../../services/productService';
import {
  X,
  Plus,
  Search,
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sparkles,
  BookOpen,
  FolderGit2,
  PencilLine,
  ShieldCheck,
  FileCheck2,
} from 'lucide-react';
import {
  removeArticleAttachment,
  saveArticleAttachment,
} from '../../services/articleAttachmentService';

interface RegisterProductModalProps {
  initialType?: ProductType;
  lockType?: boolean;
  isOpen: boolean;
  currentUser: TeacherUser | null;
  initialProduct?: ScientificProduct | null;
  onClose: () => void;
  onProductSaved: (product: ScientificProduct) => void;
}

type RegisterTab = 'identifier' | 'pdf' | 'manual';

function semesterForDate(date: string): AcademicSemester {
  const [year, month] = date.split('-').map(Number);
  return `${year}-${month <= 6 ? 1 : 2}` as AcademicSemester;
}

export const RegisterProductModal: React.FC<RegisterProductModalProps> = ({
  initialType = 'publicacion',
  lockType = false,
  isOpen,
  currentUser,
  initialProduct = null,
  onClose,
  onProductSaved,
}) => {
  const researchLines = getSchoolByCode(currentUser?.school)?.researchLines || [];
  const [activeTab, setActiveTab] = useState<RegisterTab>('manual');
  const [productType, setProductType] = useState<ProductType>(initialProduct?.type||initialType);
  useEffect(()=>{if(productType==='proyecto' && activeTab==='identifier')setActiveTab('manual');},[productType,activeTab]);

  // Campos del formulario
  const [title, setTitle] = useState(initialProduct?.title||'');
  const [authorsText, setAuthorsText] = useState(initialProduct?(initialProduct.type==='proyecto'&&initialProduct.projectParticipants?.length?initialProduct.projectParticipants:initialProduct.authors).join(', '):(currentUser?.name||''));
  const [productDate, setProductDate] = useState(initialProduct?.publicationDate||initialProduct?.projectStartDate|| (initialProduct?`${initialProduct.year}-01-01`:''));
  const [researchLine, setResearchLine] = useState<OfficialResearchLine>(
    initialProduct?.researchLine||'Computación científica'
  );
  const [abstract, setAbstract] = useState(initialProduct?.abstract||'');
  const [doi, setDoi] = useState(initialProduct?.doi||'');
  const [projectCode, setProjectCode] = useState(initialProduct?.projectCode||'');
  const [venue, setVenue] = useState(initialProduct?.venue||initialProduct?.fundingVenue||'');
  const [volumeIssue, setVolumeIssue] = useState(initialProduct?.volumeIssue||'');
  const [articleFile, setArticleFile] = useState<File | null>(null);
  const [articleFileError, setArticleFileError] = useState<string | null>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(!!initialProduct?.privacyConsentAt);
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>(initialProduct?.projectStatus||'activo');
  const [projectDirector, setProjectDirector] = useState(initialProduct?.projectDirector||currentUser?.name||'');
  const [projectEndDate, setProjectEndDate] = useState(initialProduct?.projectEndDate||'');
  const [projectDurationMonths, setProjectDurationMonths] = useState(initialProduct?.projectDurationMonths?String(initialProduct.projectDurationMonths):'');
  const [expectedProductsText, setExpectedProductsText] = useState(initialProduct?.expectedProducts?.join('\n')||'');

  // Estados de carga e integración
  const [simulatedAutofill, setSimulatedAutofill] = useState(false);
  const [identifierInput, setIdentifierInput] = useState('');
  const [isSearchingId, setIsSearchingId] = useState(false);
  const [idSearchMessage, setIdSearchMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    simulated?: boolean;
  } | null>(null);

  // Obras encontradas por ORCID
  const [orcidWorks, setOrcidWorks] = useState<OrcidWorkItem[]>([]);

  // Estados de PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfExtracting, setPdfExtracting] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState<string | null>(null);

  // Validación y guardado
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [step, setStep] = useState(1);
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen || !currentUser || currentUser.role==='reviewer_demo') return;
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if(event.key==='Escape') onClose();
      if(event.key==='Tab') {
        const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input,select,textarea,[tabindex="0"]') || []).filter(el=>el.getClientRects().length>0);
        const first=elements[0],last=elements[elements.length-1];
        if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialogRef.current)){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',handleKey);
    return ()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',handleKey);previous?.focus();};
  },[isOpen,currentUser?.role]);
  useEffect(()=>{contentRef.current?.scrollTo(0,0);dialogRef.current?.focus();},[step]);
  if (!isOpen || !currentUser || currentUser.role==='reviewer_demo') return null;

  // Manejador de autocompletado por DOI u ORCID
  const handleSearchIdentifier = async () => {
    const raw = identifierInput.trim();
    if (!raw) {
      setIdSearchMessage({ type: 'error', text: 'Por favor ingresa un DOI o un ID ORCID.' });
      return;
    }

    setIsSearchingId(true);
    setIdSearchMessage(null);
    setOrcidWorks([]);

    // Detección si es un formato de ORCID (0000-000X-XXXX-XXXX)
    if (/^\d{4}-\d{4}-\d{4}-[\dX]{4}$/.test(raw)) {
      try {
        const works = await doiService.searchByOrcid(raw);
        setIsSearchingId(false);
        if (works.length > 0) {
          setOrcidWorks(works);
          setIdSearchMessage({
            type: 'info',
            simulated: works.some(work => work.simulated),
            text: `Se encontraron ${works.length} obras en el perfil ORCID. Selecciona una para precargar sus metadatos.`,
          });
        } else {
          setIdSearchMessage({
            type: 'info',
            text: 'No se encontraron obras públicas asociadas a este identificador ORCID.',
          });
        }
      } catch {
        setIsSearchingId(false);
        setIdSearchMessage({
          type: 'error',
          text: 'No fue posible conectar con el servicio de ORCID. Puedes ingresar los datos manualmente.',
        });
      }
      return;
    }

    // Si es DOI
    try {
      const res = await doiService.resolveDoi(raw);
      setIsSearchingId(false);
      if (res.success && res.data) {
        setSimulatedAutofill(res.data.simulated);
        setTitle(res.data.title);
        setAuthorsText(res.data.authors.join(', '));
        setProductDate('');
        setDoi(res.data.doi);
        setVenue(res.data.venue);
        setAbstract(res.data.abstract);
        if (res.data.researchLine) {
          setResearchLine(res.data.researchLine);
        }
        setIdSearchMessage({
          type: 'success',
          simulated: res.data.simulated,
          text: '¡Metadatos recuperados exitosamente! Verifica los campos y ajusta lo que consideres necesario.',
        });
      } else {
        setIdSearchMessage({
          type: 'error',
          text:
            res.error ||
            'No se encontraron metadatos para el identificador ingresado. Los campos previos se han conservado.',
        });
      }
    } catch {
      setIsSearchingId(false);
      setIdSearchMessage({
        type: 'error',
        text: 'Error de conexión con el servicio de identificadores. Puedes continuar con captura manual.',
      });
    }
  };

  const handleSelectOrcidWork = (work: OrcidWorkItem) => {
    setSimulatedAutofill(work.simulated);
    setTitle(work.title);
    setProductDate('');
    setVenue(work.venue);
    setDoi(work.doi || '');
    setAbstract(work.abstract);
    setResearchLine(work.researchLine);
    if (!lockType) setProductType(work.type === 'proyecto' ? 'proyecto' : 'publicacion');
    setOrcidWorks([]);
    setIdSearchMessage({
      type: 'success',
      simulated: work.simulated,
      text: `Obra seleccionada: "${work.title}". Campos precargados para revisión.`,
    });
  };

  // Manejador de extracción desde PDF de proyecto
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPdfFile(file);
    setPdfError(null);
    setPdfSuccessMessage(null);
    setPdfExtracting(true);

    const result = await pdfExtractorService.extractProjectMetadata(file);
    setPdfExtracting(false);

    if (result.success && result.data) {
      setSimulatedAutofill(result.data.simulated);
      if (!lockType) setProductType('proyecto');
      setTitle(result.data.title);
      setProjectCode(result.data.projectCode || '');
      setProjectDirector(result.data.director || '');
      setAuthorsText(result.data.participants.join(', '));
      setProductDate('');
      setResearchLine(result.data.researchLine);
      setAbstract(result.data.abstract);
      setVenue(result.data.fundingVenue || '');
      setPdfSuccessMessage(
        `${result.data.simulated ? 'Simulado · ' : ''}${result.warning ||
          'Metadatos básicos extraídos del documento PDF. Revisa y completa los campos antes de guardar.'}`
      );
    } else {
      setPdfError(
        result.error ||
          'No se pudo extraer información del archivo. Recuerda que puedes completar el registro de forma manual.'
      );
    }
  };

  const handleArticleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setArticleFileError(null);
    if (file.size > 10 * 1024 * 1024) {
      setArticleFile(null);
      setArticleFileError('El artículo no puede superar los 10 MB.');
      input.value = '';
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setArticleFile(null);
      setArticleFileError('Adjunte el artículo en formato PDF.');
      input.value = '';
      return;
    }

    const signature = await file.slice(0, 5).text();
    if (signature !== '%PDF-') {
      setArticleFile(null);
      setArticleFileError('El archivo seleccionado no parece ser un PDF válido.');
      input.value = '';
      return;
    }

    setArticleFile(file);
    input.value = '';
  };

  // Manejador del guardado final (HU03, HU07, HU08)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setDuplicateWarning(null);
    if(step<3){
      if(!title.trim()){setErrorMessage('Escriba el título para continuar.');return;}
      if(step===2&&!authorsText.trim()){setErrorMessage('Escriba al menos un autor.');return;}
      if(step===2&&!productDate){setErrorMessage(productType==='publicacion'?'Indique la fecha de publicación.':'Indique la fecha de inicio del proyecto.');return;}
      if(step===2&&productType==='publicacion'&&!abstract.trim()){setErrorMessage('Escriba el resumen de la publicación.');return;}
      if(step===2&&productType==='publicacion'&&!articleFile&&!initialProduct?.articleAttachment){setErrorMessage('Adjunte el artículo en PDF para continuar.');return;}
      if(step===2&&productType==='publicacion'&&!privacyAccepted){setErrorMessage('Confirme la política de privacidad del artículo.');return;}
      if(step===2&&productType==='proyecto'){
        if(!projectDurationMonths||Number(projectDurationMonths)<1){setErrorMessage('Indique la duración estimada del proyecto en meses.');return;}
        if(!expectedProductsText.trim()){setErrorMessage('Indique los productos que se espera alcanzar en el proyecto.');return;}
        if(projectEndDate&&projectEndDate<productDate){setErrorMessage('La fecha de cierre no puede ser anterior al inicio del proyecto.');return;}
      }
      setStep(step+1);return;
    }

    if (!title.trim()) {
      setErrorMessage('El título del producto es obligatorio.');
      return;
    }

    const authors = authorsText
      .split(/[,;\n]/)
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    if (authors.length === 0) {
      setErrorMessage('Debes indicar al menos un autor o investigador.');
      return;
    }
    if(!productDate){setErrorMessage(productType==='publicacion'?'Indique la fecha de publicación.':'Indique la fecha de inicio del proyecto.');return;}
    if (productType === 'publicacion' && !articleFile && !initialProduct?.articleAttachment) {
      setStep(2);
      setErrorMessage('Adjunte el artículo en PDF para continuar.');
      return;
    }
    if (productType === 'publicacion' && !privacyAccepted) {
      setStep(2);
      setErrorMessage('Confirme la política de privacidad del artículo.');
      return;
    }
    if (productType === 'publicacion' && !abstract.trim()) {
      setStep(2);
      setErrorMessage('Escriba el resumen de la publicación.');
      return;
    }

    const ownerId = currentUser ? currentUser.id : 'doc-001';

    // Verificación de duplicados antes de persistir (HU07)
    let articleAttachment: ProductAttachment | undefined;
    if (productType === 'publicacion' && articleFile) {
      try {
        articleAttachment = await saveArticleAttachment(articleFile);
      } catch (error) {
        setStep(2);
        setErrorMessage(error instanceof Error ? error.message : 'No se pudo guardar el artículo adjunto.');
        return;
      }
    }

    const productPayload = {
      type: productType,
      title: title.trim(),
      authors,
      school: currentUser?.school || 'ECMC',
      year: Number(productDate.slice(0,4)),
      semester: semesterForDate(productDate),
      publicationDate: productType === 'publicacion' ? productDate : undefined,
      projectStartDate: productType === 'proyecto' ? productDate : undefined,
      projectEndDate: productType === 'proyecto' ? projectEndDate || undefined : undefined,
      researchLine,
      abstract: abstract.trim() || 'Sin resumen registrado.',
      doi: productType === 'publicacion' ? doi.trim() || undefined : undefined,
      venue: productType === 'publicacion' ? venue.trim() || undefined : undefined,
      volumeIssue: productType === 'publicacion' ? volumeIssue.trim() || undefined : undefined,
      articleAttachment: productType === 'publicacion' ? articleAttachment||initialProduct?.articleAttachment : undefined,
      privacyConsentAt: productType === 'publicacion' ? initialProduct?.privacyConsentAt||new Date().toISOString() : undefined,
      projectCode: productType === 'proyecto' ? projectCode.trim() || undefined : undefined,
      fundingVenue: productType === 'proyecto' ? venue.trim() || undefined : undefined,
      projectStatus: productType === 'proyecto' ? projectStatus : undefined,
      projectDirector: productType === 'proyecto' ? projectDirector.trim() || undefined : undefined,
      projectParticipants: productType === 'proyecto' ? authors : undefined,
      projectDurationMonths: productType === 'proyecto' ? Number(projectDurationMonths) : undefined,
      expectedProducts: productType === 'proyecto' ? expectedProductsText.split(/[;\n]+/).map(item=>item.trim()).filter(Boolean) : undefined,
    };

    const saveResult = initialProduct
      ? productService.updateObservedProduct(initialProduct.id, productPayload)
      : productService.createProduct(productPayload, ownerId);

    if (!saveResult.success) {
      if (articleAttachment && !articleAttachment.isSynthetic) {
        void removeArticleAttachment(articleAttachment.id).catch(() => undefined);
      }
      setErrorMessage(saveResult.error || (initialProduct?'No se pudieron guardar las correcciones.':'No se pudo crear el producto.'));
      return;
    }

    if (saveResult.warning) setDuplicateWarning(saveResult.warning);
    if (saveResult.product) {
      const previousAttachment = initialProduct?.articleAttachment;
      if (previousAttachment && articleAttachment && previousAttachment.id !== articleAttachment.id && !previousAttachment.isSynthetic) {
        void removeArticleAttachment(previousAttachment.id).catch(() => undefined);
      }
      onProductSaved(saveResult.product);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="register-heading" tabIndex={-1} className="registration-dialog bg-white max-w-3xl w-full shadow-2xl border border-neutral-200 overflow-hidden">
        {/* Encabezado */}
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-50 text-[var(--school-ink)]">
              {initialProduct?<PencilLine className="w-5 h-5"/>:<Plus className="w-5 h-5 stroke-[3]"/>}
            </div>
            <div>
              <h2 id="register-heading" className="text-base font-bold text-neutral-900">
                {initialProduct?'Corregir producto observado':productType === 'publicacion' ? 'Registrar publicación' : 'Registrar proyecto'}
              </h2>
              <p className="text-xs text-neutral-500">
                {initialProduct?'Revise las observaciones y vuelva a enviar el producto al Comité Científico.':'Complete los datos y verifique la información antes de guardar.'}
                {simulatedAutofill && <> · <strong>Simulado</strong></>}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar registro"
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <ol className="registration-steps" aria-label="Pasos del registro">{(initialProduct?['Datos básicos','Autores y detalles','Confirmar y reenviar']:['Datos básicos','Autores y detalles','Confirmar y guardar']).map((name,index)=><li key={name} aria-current={step===index+1?'step':undefined} className={step===index+1?'current':step>index+1?'complete':''}><span>{index+1}</span>{name}</li>)}</ol>
        {initialProduct?.rejectionReason&&<div className="mx-6 mt-4 flex items-start gap-2 bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true"/><span><strong>Observación del Comité Científico:</strong> {initialProduct.rejectionReason}</span></div>}
        {!initialProduct&&step===1 && <>
        {/* Pestañas de Vía de Ingreso */}
        <div className="px-6 pt-3 flex items-center gap-2 overflow-x-auto">
          {productType==='publicacion' && <button
            onClick={() => setActiveTab('identifier')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'identifier'
                ? 'border-[var(--school-accent)] text-[var(--school-ink)]'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Buscar con DOI / ORCID</span>
          </button>}

          {productType === 'proyecto' && <button
            onClick={() => setActiveTab('pdf')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'pdf'
                ? 'border-[var(--school-accent)] text-[var(--school-ink)]'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Usar un PDF</span>
          </button>}

          <button
            onClick={() => setActiveTab('manual')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'manual'
                ? 'border-[var(--school-accent)] text-[var(--school-ink)]'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Escribir los datos</span>
          </button>
        </div>

        </>}
        {/* Contenido según pestaña */}
        <div ref={contentRef} className="registration-content p-6 overflow-y-auto space-y-5">
          {/* Pestaña 1: Asistente DOI / ORCID */}
          {!initialProduct&&step===1 && productType==='publicacion' && activeTab === 'identifier' && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--school-ink)]" />
                  <span>Búsqueda Asistida por Identificador</span>
                </span>
                <span className="text-[11px] text-neutral-400">
                  Crossref / OpenAlex / ORCID
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={identifierInput}
                  onChange={(e) => setIdentifierInput(e.target.value)}
                  placeholder="Ej. 10.1145/3576915.3623102  o  0000-0002-1825-0097"
                  className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 text-xs focus:ring-1 focus:ring-[var(--school-accent)] bg-white tabular-nums"
                />
                <button
                  type="button"
                  onClick={handleSearchIdentifier}
                  disabled={isSearchingId}
                  className="px-4 py-2 bg-[var(--school-ink)] hover:bg-[var(--school-ink)] disabled:bg-neutral-300 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{isSearchingId ? 'Buscando...' : 'Consultar'}</span>
                </button>
              </div>

              {idSearchMessage && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                    idSearchMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : idSearchMessage.type === 'error'
                      ? 'bg-red-50 text-red-800 border border-red-200'
                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                  }`}
                >
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{idSearchMessage.simulated && <><strong>Simulado</strong> · </>}{idSearchMessage.text}</span>
                </div>
              )}

              {/* Lista de obras si la búsqueda fue por ORCID */}
              {orcidWorks.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-bold text-neutral-500 uppercase">
                    Obras encontradas en ORCID:
                  </span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {orcidWorks.map((work) => (
                      <div
                        key={work.id}
                        onClick={() => handleSelectOrcidWork(work)}
                        className="p-2.5 cursor-pointer transition-all flex items-center justify-between text-xs group"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-neutral-900 group-hover:text-[var(--school-ink)] truncate">
                            {work.title}
                          </p>
                          <p className="text-[10px] text-neutral-500">
                            {work.simulated && <><strong>Simulado</strong> · </>}
                            {work.venue} • {work.year}
                          </p>
                        </div>
                        <span className="px-2 py-1 text-neutral-700 text-[10px] font-semibold shrink-0 group-hover:bg-[var(--school-ink)] group-hover:text-white transition-colors">
                          Seleccionar
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pestaña 2: Asistente PDF de Proyecto */}
          {step===1 && productType === 'proyecto' && activeTab === 'pdf' && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-[var(--school-ink)]" />
                  <span>Documento del proyecto</span>
                </span>
                <span className="text-[11px] text-neutral-400">PDF máx. 10 MB · <strong>Simulado</strong></span>
              </div>

              <div className="p-6 text-center transition-colors">
                <input
                  type="file"
                  id="project-pdf-input"
                  accept="application/pdf"
                  onChange={handlePdfUpload}
                  className="hidden"
                />
                <label
                  htmlFor="project-pdf-input"
                  className="cursor-pointer flex flex-col items-center space-y-2"
                >
                  <Upload className="w-8 h-8 text-neutral-400" />
                  <span className="text-xs font-semibold text-neutral-700">
                    {pdfFile ? pdfFile.name : 'Haz clic para subir el documento PDF del proyecto'}
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    Se validará tipo, tamaño e integridad antes de la extracción de metadatos básicos.
                  </span>
                </label>
              </div>

              {pdfExtracting && (
                <p className="text-xs text-[var(--school-ink)] font-semibold text-center animate-pulse">
                  Procesando documento y extrayendo metadatos...
                </p>
              )}

              {pdfError && (
                <div className="p-3 bg-red-50 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{pdfError}</span>
                </div>
              )}

              {pdfSuccessMessage && (
                <div className="p-3 bg-emerald-50 text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{pdfSuccessMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* Formulario Principal de Datos */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Mensajes de error o advertencia */}
            {errorMessage && (
              <div role="alert" className="p-3 bg-red-50 text-xs text-red-700 flex items-start gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {duplicateWarning && (
              <div className="p-3 bg-amber-50 text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{duplicateWarning}</span>
              </div>
            )}

            {step===1 && <>
            {/* Alternador solo para entradas sin tipo elegido */}
            {!lockType && <div>
              <label className="block font-semibold text-neutral-700 mb-1.5">
                Tipo de Producto Académico *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setProductType('publicacion'); setActiveTab('manual'); }}
                  className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    productType === 'publicacion'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs'
                      : 'border-neutral-200 hover:bg-neutral-50 text-neutral-600'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Publicación Científica</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setProductType('proyecto'); setActiveTab('manual'); }}
                  className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    productType === 'proyecto'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-xs'
                      : 'border-neutral-200 hover:bg-neutral-50 text-neutral-600'
                  }`}
                >
                  <FolderGit2 className="w-4 h-4" />
                  <span>Proyecto de Investigación</span>
                </button>
              </div>
            </div>}

            {/* Título */}
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Título del Producto *
              </label>
              <input aria-label="Título del Producto"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título completo de la publicación o proyecto..."
                required
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs focus:ring-1 focus:ring-[var(--school-accent)]"
              />
            </div>

            </>}
            {step===2 && <>
            {/* Autores */}
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                {productType==='publicacion'?'Autores':'Investigadores participantes'} (separados por coma) *
              </label>
              <input aria-label={productType==='publicacion'?'Autores (separados por coma)':'Investigadores participantes (separados por coma)'}
                type="text"
                value={authorsText}
                onChange={(e) => setAuthorsText(e.target.value)}
                placeholder="Ej. Juan Pablo Astudillo León, Elena Valdivieso Castro"
                required
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs focus:ring-1 focus:ring-[var(--school-accent)]"
              />
            </div>

            {/* Fecha del producto y línea de investigación */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">{productType==='publicacion'?'Fecha de publicación *':'Fecha de inicio del proyecto *'}</label>
                <input aria-label={productType==='publicacion'?'Fecha de publicación':'Fecha de inicio del proyecto'} type="date" value={productDate} onChange={e=>setProductDate(e.target.value)} required className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs focus:ring-1 focus:ring-[var(--school-accent)] bg-white"/>
                <small className="mt-1 block text-neutral-500">El año se obtendrá automáticamente de esta fecha.</small>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Línea de Investigación *
                </label>
              <select aria-label="Línea de Investigación"
                  value={researchLine}
                  onChange={(e) => setResearchLine(e.target.value as OfficialResearchLine)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs focus:ring-1 focus:ring-[var(--school-accent)] bg-white"
                >
                  {researchLines.map((line) => (
                    <option key={line} value={line}>
                      {line}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {productType==='proyecto'&&<fieldset className="project-registration-fields"><legend>Datos de planificación del proyecto</legend><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block font-semibold text-neutral-700">Estado del proyecto *<select value={projectStatus} onChange={e=>setProjectStatus(e.target.value as ProjectStatus)} required className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs">{(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map(status=><option key={status} value={status}>{PROJECT_STATUS_LABELS[status]}</option>)}</select></label>
              <label className="block font-semibold text-neutral-700">Duración estimada (meses) *<input type="number" min={1} max={600} step={1} value={projectDurationMonths} onChange={e=>setProjectDurationMonths(e.target.value)} placeholder="Ej. 18" required className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs"/></label>
              <label className="block font-semibold text-neutral-700">Dirección del proyecto<input value={projectDirector} onChange={e=>setProjectDirector(e.target.value)} placeholder="Nombre de quien dirige" className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs"/></label>
              <label className="block font-semibold text-neutral-700">Fecha de cierre prevista<input type="date" min={productDate||undefined} value={projectEndDate} onChange={e=>setProjectEndDate(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs"/></label>
              <label className="block font-semibold text-neutral-700 sm:col-span-2">Productos esperados *<textarea value={expectedProductsText} onChange={e=>setExpectedProductsText(e.target.value)} rows={3} required placeholder="Escriba un producto esperado por línea (ej. artículo científico, prototipo, dataset)" className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs resize-y"/><small className="mt-1 block font-normal text-neutral-500">Separe cada resultado esperado en una línea.</small></label>
            </div></fieldset>}

            {/* Campos condicionales por tipo de producto */}
            {productType === 'publicacion' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Identificador DOI (Opcional)
                  </label>
              <input aria-label="Identificador DOI (Opcional)"
                    type="text"
                    value={doi}
                    onChange={(e) => setDoi(e.target.value)}
                    placeholder="DOI oficial, si ya fue asignado"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs tabular-nums focus:ring-1 focus:ring-[var(--school-accent)]"
                  />
                  <small className="mt-1 block text-neutral-500">Si la publicación aún no tiene un DOI oficial, deje este campo vacío.</small>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Revista, Conferencia o Editorial
                  </label>
              <input aria-label="Revista, Conferencia o Editorial"
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="Ej. ACM CCS 2025 / IEEE Transactions..."
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs focus:ring-1 focus:ring-[var(--school-accent)]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Volumen, número o páginas (opcional)
                  </label>
                  <input
                    aria-label="Volumen, número o páginas"
                    type="text"
                    value={volumeIssue}
                    onChange={(e) => setVolumeIssue(e.target.value)}
                    placeholder="Ej. Vol. 12, Núm. 2, pp. 35-48"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs focus:ring-1 focus:ring-[var(--school-accent)]"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Código Institucional del Proyecto
                  </label>
              <input aria-label="Código Institucional del Proyecto"
                    type="text"
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    placeholder={`Ej. ${currentUser?.school || 'ECMC'}-INV-2024-008`}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs tabular-nums focus:ring-1 focus:ring-[var(--school-accent)]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Fondo o Programa de Financiamiento
                  </label>
              <input aria-label="Fondo o Programa de Financiamiento"
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="Ej. Convocatoria Semilla Yachay Tech..."
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs focus:ring-1 focus:ring-[var(--school-accent)]"
                  />
                </div>
              </div>
            )}

            {productType === 'publicacion' && (
              <section className="space-y-3 bg-[#fffaf7] p-4" aria-labelledby="article-upload-title">
                <div className="flex items-start gap-2">
                  <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 school-accent-text" aria-hidden="true" />
                  <div>
                    <h3 id="article-upload-title" className="font-bold text-neutral-800">Artículo completo en PDF <span className="school-accent-text">*</span></h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">Es obligatorio adjuntar el artículo para que el Comité Científico pueda verificar la publicación. Máximo 10 MB.</p>
                  </div>
                </div>
                <input id="publication-article-input" type="file" accept="application/pdf,.pdf" onChange={handleArticleUpload} className="sr-only" aria-label="Adjuntar artículo completo en PDF" />
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="publication-article-input" className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 font-semibold text-neutral-700 school-accent-hover">
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    {articleFile ? 'Cambiar archivo' : initialProduct?.articleAttachment ? 'Reemplazar artículo PDF' : 'Seleccionar artículo PDF'}
                  </label>
                  {(articleFile || initialProduct?.articleAttachment) && <span className="min-w-0 text-[11px] text-neutral-700"><strong className="break-all">{articleFile?.name || initialProduct?.articleAttachment?.fileName}</strong>{articleFile && articleFile.size > 0 && ` · ${(articleFile.size / (1024 * 1024)).toFixed(2)} MB`}</span>}
                </div>
                {articleFileError && <p role="alert" className="text-[11px] font-medium text-red-700">{articleFileError}</p>}
                <div className="flex items-start gap-2 p-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#47745e]" aria-hidden="true" />
                  <label className="flex cursor-pointer items-start gap-2 text-[11px] leading-relaxed text-neutral-700">
                    <input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} className="mt-0.5 school-accent-checkbox" />
                    <span><strong>Política de privacidad *</strong><br />Confirmo que tengo autorización para compartir este archivo con el Comité Científico. Se utilizará únicamente para verificar la información y no se mostrará en el catálogo público.</span>
                  </label>
                </div>
                <p className="text-[10px] text-neutral-500">El archivo se utiliza únicamente para la verificación y no se muestra en el catálogo público.</p>
              </section>
            )}

            {/* Resumen */}
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Resumen Académico (Abstract) *
              </label>
              <textarea aria-label="Resumen Académico (Abstract)"
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                rows={3}
                placeholder="Descripción concisa de la metodología y resultados del trabajo..."
                required={productType === 'publicacion'}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs focus:ring-1 focus:ring-[var(--school-accent)] resize-none"
              />
            </div>

            </>}
            {step===3 && <section className="review-summary"><h3>{initialProduct?'Revise las correcciones antes de reenviar':'Verifique la información del registro'}</h3><dl><dt>Tipo</dt><dd>{productType==='publicacion'?'Publicación':'Proyecto'}</dd><dt>Título</dt><dd>{title}</dd><dt>{productType==='publicacion'?'Autores':'Participantes'}</dt><dd>{authorsText}</dd><dt>{productType==='publicacion'?'Fecha de publicación':'Inicio del proyecto'}</dt><dd>{productDate}</dd>{productType==='proyecto'&&<><dt>Estado del proyecto</dt><dd>{PROJECT_STATUS_LABELS[projectStatus]}</dd><dt>Duración</dt><dd>{projectDurationMonths} meses</dd><dt>Dirección</dt><dd>{projectDirector||'No indicada'}</dd><dt>Productos esperados</dt><dd>{expectedProductsText}</dd></>}<dt>Línea de investigación</dt><dd>{researchLine}</dd>{productType==='publicacion'&&<><dt>Artículo</dt><dd>{articleFile?.name||initialProduct?.articleAttachment?.fileName||'No adjunto'}</dd><dt>Privacidad</dt><dd>{privacyAccepted?'Autorización confirmada para revisión privada':'Pendiente de confirmación'}</dd><dt>Identificador</dt><dd>{doi?'Registrado; se mostrará al verificarse':'Sin DOI registrado'}</dd><dt>Medio / revista</dt><dd>{venue||'No indicado'}</dd><dt>Volumen / número</dt><dd>{volumeIssue||'No indicado'}</dd></>}<dt>Resumen</dt><dd>{abstract||'No indicado'}</dd></dl></section>}
            {/* Aviso sobre estado inicial "cargado" (Sección 8) */}
            <div className="p-3 text-[11px] text-neutral-600 flex items-start gap-2">
              <Info className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
              <span>
                {initialProduct
                  ? <>Al reenviar, el producto quedará <strong>pendiente de verificación</strong> y el Comité Científico recibirá la versión corregida.</>
                  : <>Al guardar, su trabajo quedará <strong>cargado para revisión</strong>. Recibirá las novedades en Avisos.</>}
              </span>
            </div>

            {/* Botones de acción */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={()=>step>1?setStep(step-1):onClose()}
                className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-50 font-semibold"
              >
                {step>1?'Atrás':'Cancelar'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[var(--school-ink)] hover:bg-[var(--school-ink)] text-white font-bold transition-colors"
              >
                {step<3?'Continuar':initialProduct?'Confirmar y reenviar':'Confirmar y guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
