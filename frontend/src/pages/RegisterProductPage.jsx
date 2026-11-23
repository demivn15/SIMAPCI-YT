/**
 * Formulario de registro de productos - T-HU03-01, T-HU07-04 y T-HU07-05 (PGPCECMC-63).
 * Incluye validación de archivos, autocompletado por DOI y extracción de PDF,
 * con mensajes claros de coincidencia y aviso de verificación no realizada (CA08).
 *
 * Antes de guardar, el formulario verifica si el identificador ya está registrado (CA19): si
 * coincide, no se guarda y se informa con qué coincidió (CA20); si no hay identificador, se
 * guarda igual y la confirmación avisa que no se pudo verificar (CA21).
 *
 * Se muestra como la ventana «Registrar publicación / Registrar proyecto» del prototipo,
 * en un solo formulario (las pruebas de HU03, HU04 y HU07 lo usan así).
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileCheck2,
  FolderGit2,
  Info,
  Plus,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { PRODUCT_TYPES, PROJECT_STATUSES, RESEARCH_LINES } from '../constants/products';
import {
  checkProductExistence,
  createProduct,
  isValidDoi,
  lookupDoi,
  normalizeDoi,
  uploadAndExtractPdf,
} from '../services/productService';
import { validateFileClientSide } from '../utils/fileValidation';

const EMPTY_FORM = {
  type: 'publicacion',
  doi: '',
  title: '',
  authors: '',
  year: '',
  researchLine: '',
  venue: '',
  abstract: '',
  projectCode: '',
  projectStatus: 'activo',
};

const AUTOFILL_FIELDS = ['title', 'authors', 'year', 'venue', 'abstract'];
const CURRENT_YEAR = new Date().getFullYear();

const labelClass = 'field-label';

function toFormValues(metadata) {
  return {
    title: metadata.title || '',
    authors: Array.isArray(metadata.authors) ? metadata.authors.join(', ') : metadata.authors || '',
    year: metadata.year ? String(metadata.year) : '',
    venue: metadata.venue || '',
    abstract: metadata.abstract || '',
  };
}

/**
 * Aviso de la carga del documento, armado con el reporte de extracción del backend
 * (T-HU04-05, PGPCECMC-91; CA10).
 *
 * - 'completa': se identificó todo, solo queda revisar -> aviso informativo.
 * - 'parcial' / 'vacia': el PDF se leyó pero quedan campos sin identificar -> advertencia, para
 *   que el profesor sepa que todavía le toca completarlos a mano antes de guardar.
 *
 * Si la respuesta no trae el reporte, se arma el mensaje con lo que se alcanzó a precargar.
 */
function extractionNotice(extraction, filledCount, keptCount) {
  const kept = keptCount > 0 ? ' Los campos que ya habías escrito se conservaron.' : '';
  const prefilled = filledCount > 0 ? `Se precargaron ${filledCount} campos desde el documento. ` : '';

  if (!extraction?.message) {
    const message =
      filledCount > 0
        ? `${prefilled}Revísalos antes de guardar.`
        : 'El documento no aportó datos para los campos vacíos. Complétalos manualmente.';
    return { kind: filledCount > 0 ? 'info' : 'warning', message: message + kept };
  }

  return {
    kind: extraction.status === 'completa' ? 'info' : 'warning',
    message: `${prefilled}${extraction.message}${kept}`,
  };
}

function validate(form) {
  const errors = {};
  if (!form.title.trim()) errors.title = 'Ingresa el título.';
  if (!form.authors.trim()) {
    errors.authors = form.type === 'publicacion' ? 'Ingresa al menos un autor.' : 'Ingresa al menos un participante.';
  }
  const year = Number(form.year);
  if (!form.year.trim()) errors.year = 'Ingresa el año.';
  else if (!Number.isInteger(year) || year < 1900 || year > CURRENT_YEAR + 1) {
    errors.year = `Ingresa un año entre 1900 y ${CURRENT_YEAR + 1}.`;
  }
  if (!form.researchLine) errors.researchLine = 'Selecciona una línea de investigación.';

  if (form.type === 'publicacion' && form.doi.trim() && !isValidDoi(normalizeDoi(form.doi))) {
    errors.doi = 'El DOI debe tener la forma 10.xxxx/xxxxx.';
  }
  if (form.type === 'proyecto' && !form.projectCode.trim()) {
    errors.projectCode = 'Ingresa el código institucional del proyecto.';
  }
  return errors;
}

function toPayload(form) {
  const isPublication = form.type === 'publicacion';
  return {
    type: form.type,
    title: form.title.trim(),
    authors: form.authors.split(',').map((name) => name.trim()).filter(Boolean),
    year: Number(form.year),
    research_line: form.researchLine,
    abstract: form.abstract.trim() || null,
    doi: isPublication && form.doi.trim() ? normalizeDoi(form.doi) : null,
    venue: isPublication ? form.venue.trim() || null : null,
    project_code: isPublication ? null : form.projectCode.trim().toUpperCase(),
    project_status: isPublication ? null : form.projectStatus,
  };
}

function lookupErrorMessage(error) {
  if (!error?.response) {
    // Sin "response": la petición no llegó a nuestro servidor (apagado o sin red)
    return 'Verificación no realizada: no hay conexión con el servidor. Puedes completar los campos manualmente; tus datos se conservan.';
  }
  if (error.response.status === 404) {
    return 'No encontramos datos para este DOI. Puedes completar o corregir los campos manualmente.';
  }
  if (error.response.status === 503 || error.response.status === 504) {
    return 'Verificación no realizada: El servicio externo no está disponible o excedió el tiempo de espera. Continúa llenando los campos manualmente.';
  }
  return 'El servicio de consulta externa no está disponible ahora. Puedes completar los campos manualmente.';
}

// --- Verificación previa de existencia (HU07, T-HU07-05 / PGPCECMC-63) --------------------

/**
 * Consulta si el identificador del producto ya está registrado, antes de guardarlo (CA19).
 *
 * Devuelve `{ exists, field, publicProductId, unverified }`:
 *   - Sin DOI ni código de proyecto no hay nada que consultar (regla RU-06): no se llama al
 *     servicio y se marca `unverified: 'sin-identificador'` para el aviso de CA21.
 *   - Si el servicio no responde, tampoco se bloquea el guardado: `POST /products` repite la
 *     verificación y contesta 409 si el producto ya existía. Se marca `unverified: 'servicio'`
 *     para decirle al profesor que la verificación no se pudo hacer.
 */
async function verifyExistence({ doi, project_code: projectCode }) {
  if (!doi && !projectCode) {
    return { exists: false, unverified: 'sin-identificador' };
  }

  try {
    const result = await checkProductExistence({ doi, projectCode });
    // Se envió un identificador, así que el servicio debería poder verificarlo; si dice que no,
    // se trata como una verificación no realizada en vez de afirmar que el producto es nuevo.
    if (!result?.verifiable) return { exists: false, unverified: 'servicio' };

    return {
      exists: Boolean(result.exists),
      field: result.field,
      publicProductId: result.public_product_id ?? null,
    };
  } catch {
    return { exists: false, unverified: 'servicio' };
  }
}

/** Mensaje de coincidencia: el producto no se guarda y se informa con qué coincidió (CA20). */
function duplicateMessage({ field, publicProductId }) {
  const identifier = field === 'project_code' ? 'código de proyecto' : 'DOI';
  const message =
    `Ya existe un producto registrado con este ${identifier}, así que no se guardó para no duplicarlo. ` +
    'Revisa el identificador o corrige los datos antes de intentarlo de nuevo.';

  // RU-08: solo se puede señalar el producto existente si ya está verificado y es público.
  return publicProductId
    ? `${message} El producto que coincide ya está verificado y publicado en la producción científica de la Escuela.`
    : message;
}

/** Aviso de verificación no realizada en la confirmación del guardado (CA21). */
const UNVERIFIED_MESSAGES = {
  'sin-identificador':
    'No fue posible verificar si este producto ya existía, porque no tiene DOI ni código de proyecto.',
  servicio:
    'No fue posible verificar si este producto ya existía: el servicio de verificación no respondió. El producto se guardó de todas formas.',
};

function saveErrorMessage(error) {
  if (!error?.response) return 'No hay conexión con el servidor. Tus datos siguen en el formulario; inténtalo de nuevo.';
  if (error.response.status === 409) return 'Ya existe un producto registrado con este DOI o código de proyecto.';
  if (error.response.status === 422) return 'Algunos datos no son válidos. Revisa el formulario e inténtalo de nuevo.';
  return 'No se pudo guardar el producto. Tus datos siguen en el formulario; inténtalo de nuevo en unos minutos.';
}

// T-HU07-04: el aviso «warning» es el de verificación no realizada
const NOTICE_ICONS = { info: CheckCircle2, error: AlertCircle, warning: AlertTriangle };

// Errores y advertencias se anuncian de inmediato a lectores de pantalla (role="alert");
// los avisos informativos, de forma discreta (role="status"). CA08 / PR-HU03-02.
function Notice({ kind, children }) {
  const role = kind === 'error' || kind === 'warning' ? 'alert' : 'status';
  const Icon = NOTICE_ICONS[kind];
  return (
    <div className={`notice notice-${kind}`} role={role}>
      <Icon size={16} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error">
      {message}
    </p>
  );
}

function focusField(name) {
  document.getElementById(name)?.focus();
}

function PrefilledBadge({ show }) {
  if (!show) return null;
  return <span className="prefilled">Precargado</span>;
}

// El inicio abre el registro con el tipo elegido (?tipo=publicacion o ?tipo=proyecto)
function initialForm(type) {
  return { ...EMPTY_FORM, type: type === 'proyecto' ? 'proyecto' : 'publicacion' };
}

export default function RegisterProductPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  const bodyRef = useRef(null);
  const [form, setForm] = useState(() => initialForm(searchParams.get('tipo')));
  const [errors, setErrors] = useState({});
  const [lookup, setLookup] = useState({ status: 'idle' });
  const [prefilled, setPrefilled] = useState([]);
  const [save, setSave] = useState({ status: 'idle' });
  
  const [fileMetadata, setFileMetadata] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadNotice, setUploadNotice] = useState(null); // { kind: 'info' | 'warning' | 'error', message: '' }

  const isPublication = form.type === 'publicacion';
  const isSaving = save.status === 'saving';
  const isLookingUp = lookup.status === 'loading';

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
    if (prefilled.includes(name)) setPrefilled((prev) => prev.filter((field) => field !== name));
  };

  const fieldProps = (name) => ({
    id: name,
    name,
    value: form[name],
    onChange: (event) => setField(name, event.target.value),
    readOnly: isSaving,
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
    className: 'field-input',
  });

  const handleTypeChange = (type) => {
    setForm((prev) => ({ ...prev, type }));
    setErrors({});
    setLookup({ status: 'idle' });
    setFileMetadata(null);
    setUploadNotice(null);
  };

  // Subida del PDF y extracción de campos (T-HU04-03 / T-HU04-04 / T-HU07-04), con el manejo de
  // documentos de formato no reconocido o extracción parcial de T-HU04-05 (PGPCECMC-91).
  //
  // Pase lo que pase, el registro en curso se conserva: ni un formato rechazado ni una extracción
  // fallida borran lo que el profesor ya escribió (CA11), y los campos que no se logran
  // identificar quedan vacíos y editables para que los complete a mano (CA10).
  const handleFileUpload = async (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setUploadNotice(null);

    // Formato no reconocido o tamaño excedido: se rechaza sin llegar a enviar el archivo.
    const validation = validateFileClientSide(selectedFile);
    if (!validation.valid) {
      setUploadNotice({ kind: 'error', message: validation.error });
      return;
    }

    setIsExtracting(true);
    try {
      const result = await uploadAndExtractPdf(selectedFile);
      setFileMetadata(result.file);

      const extracted = result.extracted_fields || {};
      const values = toFormValues(extracted);

      const filled = AUTOFILL_FIELDS.filter((field) => values[field] && !form[field].trim());
      const kept = AUTOFILL_FIELDS.filter((field) => values[field] && form[field].trim());

      setForm((prev) => {
        const next = { ...prev };
        filled.forEach((field) => {
          next[field] = values[field];
        });
        return next;
      });
      setPrefilled((prev) => Array.from(new Set([...prev, ...filled])));

      setUploadNotice(extractionNotice(result.extraction, filled.length, kept.length));
    } catch (error) {
      // Aviso de verificación no realizada (T-HU07-04) permitiendo llenado manual
      const message = error.response?.data?.detail ||
        'Verificación no realizada: No se pudo procesar el documento automáticamente. Puedes completar los campos manualmente; tu información se conserva.';
      setUploadNotice({ kind: 'warning', message });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAutocomplete = async () => {
    if (isLookingUp) return;
    const doi = normalizeDoi(form.doi);

    if (!isValidDoi(doi)) {
      setErrors((prev) => ({ ...prev, doi: 'El DOI debe tener la forma 10.xxxx/xxxxx.' }));
      focusField('doi');
      return;
    }

    setLookup({ status: 'loading' });
    try {
      const values = toFormValues(await lookupDoi(doi));

      const filled = AUTOFILL_FIELDS.filter((field) => values[field] && !form[field].trim());
      const kept = AUTOFILL_FIELDS.filter((field) => values[field] && form[field].trim());

      setForm((prev) => {
        const next = { ...prev, doi };
        filled.forEach((field) => {
          next[field] = values[field];
        });
        return next;
      });
      setPrefilled(filled);
      setErrors((prev) => {
        const next = { ...prev, doi: undefined };
        filled.forEach((field) => {
          next[field] = undefined;
        });
        return next;
      });

      let message =
        filled.length > 0
          ? `Coincidencia exitosa: Se precargaron ${filled.length} campos desde el DOI. Revísalos antes de guardar.`
          : 'El DOI no aportó datos nuevos para los campos vacíos.';
      if (kept.length > 0) message += ' Los campos que ya habías escrito no se modificaron.';
      setLookup({ status: 'done', message });
    } catch (error) {
      // Aviso de verificación no realizada (T-HU07-04)
      setLookup({ status: 'error', message: lookupErrorMessage(error) });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSaving) return;

    const validation = validate(form);
    setErrors(validation);
    const firstInvalid = Object.keys(validation).find((field) => validation[field]);
    if (firstInvalid) {
      setSave({ status: 'error', kind: 'validation', message: 'Revisa los campos marcados antes de guardar.' });
      focusField(firstInvalid);
      return;
    }

    setSave({ status: 'saving' });
    const payload = toPayload(form);

    // CA19: antes de guardar se verifica si el identificador ya está registrado. Aplica tanto al
    // registro manual de HU03 como a los datos que vinieron del DOI o del PDF de HU04: lo que se
    // verifica es lo que quedó en el formulario, sin importar cómo llegó.
    const verification = await verifyExistence(payload);

    // CA20: si coincide, no se guarda nada y se informa con qué identificador coincidió.
    if (verification.exists) {
      setSave({ status: 'error', kind: 'duplicate', message: duplicateMessage(verification) });
      focusField(verification.field === 'project_code' ? 'projectCode' : 'doi');
      return;
    }

    try {
      await createProduct(payload);
      // CA21: se permite continuar, pero la confirmación dice si no se pudo verificar.
      setSave({ status: 'saved', unverified: verification.unverified });
      bodyRef.current?.scrollTo?.({ top: 0 });
    } catch (error) {
      setSave({ status: 'error', message: saveErrorMessage(error) });
    }
  };

  const close = () => navigate('/dashboard');

  // La ventana recibe el foco al abrirse y se cierra con Escape
  useEffect(() => {
    dialogRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') navigate('/dashboard');
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  const resetForm = () => {
    setForm(initialForm(form.type));
    setErrors({});
    setPrefilled([]);
    setLookup({ status: 'idle' });
    setSave({ status: 'idle' });
    setFileMetadata(null);
    setUploadNotice(null);
  };

  return (
    <div className="modal-overlay">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-heading"
        tabIndex={-1}
        className="register-dialog"
      >
        <div className="register-header">
          <div className="register-title">
            <span className="register-icon">
              <Plus size={20} strokeWidth={3} aria-hidden="true" />
            </span>
            <div>
              <h2 id="register-heading" className="display">
                {isPublication ? 'Registrar publicación' : 'Registrar proyecto'}
              </h2>
              <p>Complete los datos y verifique la información antes de guardar.</p>
            </div>
          </div>
          <button type="button" className="icon-button" aria-label="Cerrar registro" onClick={close}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div ref={bodyRef} className="register-body">
          {save.status === 'saved' ? (
            <div role="status" className="register-form">
              <div className="notice notice-info">
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>
                  <strong>Producto registrado.</strong> «{form.title.trim()}» quedó registrado a tu nombre con estado{' '}
                  <strong>cargado</strong>. Un Revisor lo verificará y recibirás una notificación con el resultado.
                </span>
              </div>
              {/* Aviso de verificación no realizada (CA21, T-HU07-05) */}
              {save.unverified && <Notice kind="warning">{UNVERIFIED_MESSAGES[save.unverified]}</Notice>}
              <div className="form-actions">
                <Link to="/dashboard" className="btn btn-outline">
                  Volver al inicio
                </Link>
                <button type="button" onClick={resetForm} className="btn btn-primary">
                  Registrar otro producto
                </button>
              </div>
            </div>
          ) : (
            <>
              {save.status === 'error' && (save.kind !== 'validation' || Object.values(errors).some(Boolean)) && (
                <Notice kind="error">{save.message}</Notice>
              )}

              <form className="register-form" onSubmit={handleSubmit} noValidate aria-busy={isSaving}>
                <fieldset>
                  <legend className={labelClass}>Tipo de producto *</legend>
                  <div className="type-options">
                    {PRODUCT_TYPES.map((option) => {
                      const selected = form.type === option.value;
                      const Icon = option.value === 'publicacion' ? BookOpen : FolderGit2;
                      return (
                        <label
                          key={option.value}
                          data-type={option.value}
                          className={`type-option${selected ? ' is-selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="type"
                            value={option.value}
                            checked={selected}
                            onChange={() => handleTypeChange(option.value)}
                            disabled={isSaving}
                            className="sr-only"
                          />
                          <Icon size={16} aria-hidden="true" />
                          {option.label}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                {/* Autocompletado por DOI (CA07, CA08, T-HU07-04) */}
                {isPublication && (
                  <div className="form-panel">
                    <p className="form-panel-title">
                      <Sparkles size={15} aria-hidden="true" />
                      Búsqueda asistida por DOI
                    </p>
                    <div>
                      <label htmlFor="doi" className={labelClass}>
                        DOI
                      </label>
                      <p className="field-hint" id="doi-hint">
                        Si la publicación tiene DOI, úsalo para completar los datos automáticamente.
                      </p>
                      <div className="inline-field">
                        <input
                          {...fieldProps('doi')}
                          type="text"
                          autoComplete="off"
                          spellCheck={false}
                          placeholder="p. ej., 10.1145/3576915.3623102"
                          aria-describedby={['doi-hint', errors.doi && 'doi-error'].filter(Boolean).join(' ')}
                        />
                        <button
                          type="button"
                          onClick={handleAutocomplete}
                          aria-disabled={isLookingUp || isSaving}
                          className="btn btn-primary"
                        >
                          <Search size={15} aria-hidden="true" />
                          {isLookingUp ? 'Buscando...' : 'Autocompletar'}
                        </button>
                      </div>
                      <FieldError id="doi-error" message={errors.doi} />
                    </div>
                    {(lookup.status === 'done' || lookup.status === 'error') && (
                      <Notice kind={lookup.status === 'done' ? 'info' : 'warning'}>{lookup.message}</Notice>
                    )}
                  </div>
                )}

                {/* Subida de archivo y extracción con mensajes de coincidencia y aviso de verificación no realizada (T-HU07-04) */}
                <div className="form-panel">
                  <p className="form-panel-title">
                    <FileCheck2 size={15} aria-hidden="true" />
                    Cargar documento del proyecto (PDF)
                  </p>
                  <p className="field-hint" id="file-hint">
                    Sube el PDF del documento para validar su integridad y extraer los campos automáticamente. Los
                    campos que no se puedan identificar quedan vacíos para que los completes a mano.
                  </p>
                  <input
                    id="product-file"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handleFileUpload}
                    disabled={isSaving || isExtracting}
                    aria-describedby="file-hint"
                    className="sr-only"
                  />
                  <div className="file-row">
                    <label htmlFor="product-file" className="btn btn-outline">
                      <Upload size={16} aria-hidden="true" />
                      {fileMetadata ? 'Cambiar archivo' : 'Seleccionar archivo'}
                    </label>
                    {fileMetadata && !uploadNotice && (
                      <span>
                        Archivo validado: <strong>{fileMetadata.filename}</strong> (SHA-256:{' '}
                        {fileMetadata.integrity_sha256?.slice(0, 12)}...)
                      </span>
                    )}
                    {isExtracting && <span>Validando archivo y extrayendo campos del documento...</span>}
                  </div>
                  {uploadNotice && <Notice kind={uploadNotice.kind}>{uploadNotice.message}</Notice>}
                </div>

                {/* Datos comunes del formulario */}
                <div>
                  <label htmlFor="title" className={labelClass}>
                    Título *<PrefilledBadge show={prefilled.includes('title')} />
                  </label>
                  <input {...fieldProps('title')} type="text" placeholder="Título completo de la publicación o proyecto" />
                  <FieldError id="title-error" message={errors.title} />
                </div>

                <div>
                  <label htmlFor="authors" className={labelClass}>
                    {isPublication ? 'Autores *' : 'Investigadores participantes *'}
                    <PrefilledBadge show={prefilled.includes('authors')} />
                  </label>
                  <input {...fieldProps('authors')} type="text" placeholder="Separados por coma" />
                  <FieldError id="authors-error" message={errors.authors} />
                </div>

                <div className="grid-year">
                  <div>
                    <label htmlFor="year" className={labelClass}>
                      {isPublication ? 'Año *' : 'Año de inicio *'}
                      <PrefilledBadge show={prefilled.includes('year')} />
                    </label>
                    <input {...fieldProps('year')} type="text" inputMode="numeric" maxLength={4} placeholder="p. ej., 2025" />
                    <FieldError id="year-error" message={errors.year} />
                  </div>

                  <div>
                    <label htmlFor="researchLine" className={labelClass}>
                      Línea de investigación *
                    </label>
                    <select {...fieldProps('researchLine')} disabled={isSaving}>
                      <option value="">Selecciona una línea</option>
                      {RESEARCH_LINES.map((line) => (
                        <option key={line} value={line}>
                          {line}
                        </option>
                      ))}
                    </select>
                    <FieldError id="researchLine-error" message={errors.researchLine} />
                  </div>
                </div>

                {isPublication ? (
                  <div>
                    <label htmlFor="venue" className={labelClass}>
                      Revista, congreso o editorial
                      <PrefilledBadge show={prefilled.includes('venue')} />
                    </label>
                    <input {...fieldProps('venue')} type="text" />
                  </div>
                ) : (
                  <div className="grid-2">
                    <div>
                      <label htmlFor="projectCode" className={labelClass}>
                        Código institucional del proyecto *
                      </label>
                      <input {...fieldProps('projectCode')} type="text" placeholder="p. ej., ECMC-INV-2024-008" />
                      <FieldError id="projectCode-error" message={errors.projectCode} />
                    </div>
                    <div>
                      <label htmlFor="projectStatus" className={labelClass}>
                        Estado del proyecto *
                      </label>
                      <select {...fieldProps('projectStatus')} disabled={isSaving}>
                        {PROJECT_STATUSES.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="abstract" className={labelClass}>
                    Resumen
                    <PrefilledBadge show={prefilled.includes('abstract')} />
                  </label>
                  <textarea {...fieldProps('abstract')} rows={4} />
                </div>

                <p className="form-note">
                  <Info size={16} aria-hidden="true" />
                  <span>
                    Al guardar, su trabajo quedará <strong>cargado para revisión</strong> y recibirá una notificación con
                    el resultado.
                  </span>
                </p>

                <div className="form-actions">
                  <Link to="/dashboard" className="btn btn-outline">
                    Cancelar
                  </Link>
                  <button type="submit" aria-disabled={isSaving} className="btn btn-primary">
                    {isSaving ? 'Guardando...' : 'Guardar producto'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
