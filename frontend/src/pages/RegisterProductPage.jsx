/**
 * Formulario de registro de productos - T-HU03-01 (PGPCECMC-32).
 * HU03: registrar una publicación o un proyecto con autocompletado por identificador.
 *   CA07: con un DOI válido, el sistema precarga los campos disponibles para revisión.
 *   CA08: si no hay datos o el servicio externo falla, se informa, se permite el
 *         llenado manual y se conserva lo ya escrito.
 *   CA09: al guardar con los campos obligatorios, el producto queda asociado al
 *         profesor con estado «cargado» y se muestra una confirmación.
 * Estilo: el mismo de LoginPage y DashboardPage (Tailwind, grises y azul).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PRODUCT_TYPES, PROJECT_STATUSES, RESEARCH_LINES } from '../constants/products';
import { createProduct, isValidDoi, lookupDoi, normalizeDoi } from '../services/productService';

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

// Campos que el autocompletado puede llenar, en el orden en que aparecen
const AUTOFILL_FIELDS = ['title', 'authors', 'year', 'venue', 'abstract'];

const CURRENT_YEAR = new Date().getFullYear();

const inputClass = (hasError) =>
  'appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-slate-400 ' +
  'focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ' +
  (hasError ? 'border-red-400' : 'border-slate-300');

const labelClass = 'block text-sm font-medium text-slate-700';

/** Convierte la respuesta del DOI al formato del formulario (autores como texto). */
function toFormValues(metadata) {
  return {
    title: metadata.title || '',
    authors: Array.isArray(metadata.authors) ? metadata.authors.join(', ') : metadata.authors || '',
    year: metadata.year ? String(metadata.year) : '',
    venue: metadata.venue || '',
    abstract: metadata.abstract || '',
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

/** Arma el cuerpo de POST /products. El dueño y la Escuela los toma el backend de la sesión. */
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
  if (!error?.response) return 'No hay conexión con el servidor. Puedes completar los campos manualmente.';
  if (error.response.status === 404) {
    return 'No encontramos datos para este DOI. Revisa que esté bien escrito o completa los campos manualmente.';
  }
  return 'El servicio de consulta de DOI no está disponible ahora. Puedes completar los campos manualmente.';
}

function saveErrorMessage(error) {
  if (!error?.response) return 'No hay conexión con el servidor. Tus datos siguen en el formulario; inténtalo de nuevo.';
  if (error.response.status === 409) return 'Ya existe un producto registrado con este DOI o código de proyecto.';
  if (error.response.status === 422) return 'Algunos datos no son válidos. Revisa el formulario e inténtalo de nuevo.';
  return 'No se pudo guardar el producto. Tus datos siguen en el formulario; inténtalo de nuevo en unos minutos.';
}

const NOTICE_STYLES = {
  info: 'bg-blue-50 border-blue-400 text-blue-800',
  error: 'bg-red-50 border-red-400 text-red-700',
};

function Notice({ kind, children }) {
  return (
    <div className={`border-l-4 p-4 text-sm ${NOTICE_STYLES[kind]}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-sm text-red-600">
      {message}
    </p>
  );
}

/** Lleva el foco al campo indicado (los campos usan su nombre como id). */
function focusField(name) {
  document.getElementById(name)?.focus();
}

function PrefilledBadge({ show }) {
  if (!show) return null;
  return <span className="ml-2 text-xs font-medium text-blue-700">Precargado</span>;
}

export default function RegisterProductPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  // lookup: { status: 'idle' | 'loading' | 'done' | 'error', message?: string }
  const [lookup, setLookup] = useState({ status: 'idle' });
  const [prefilled, setPrefilled] = useState([]);
  // save: { status: 'idle' | 'saving' | 'saved' | 'error', message?: string }
  const [save, setSave] = useState({ status: 'idle' });

  const isPublication = form.type === 'publicacion';
  const isSaving = save.status === 'saving';
  const isLookingUp = lookup.status === 'loading';

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
    // Si la persona edita un campo precargado, deja de marcarse como tal
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
    className: inputClass(errors[name]),
  });

  const handleTypeChange = (type) => {
    setForm((prev) => ({ ...prev, type }));
    setErrors({});
    setLookup({ status: 'idle' });
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

      // Solo se llenan los campos VACÍOS: lo que la persona ya escribió no se pisa (CA08)
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
          ? `Se precargaron ${filled.length} campos desde el DOI. Revísalos antes de guardar.`
          : 'El DOI no aportó datos nuevos para los campos vacíos.';
      if (kept.length > 0) message += ' Los campos que ya habías escrito no se modificaron.';
      setLookup({ status: 'done', message });
    } catch (error) {
      // Lo ya ingresado se conserva: el formulario no se toca (CA08)
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
    try {
      await createProduct(toPayload(form));
      setSave({ status: 'saved' });
      window.scrollTo({ top: 0 });
    } catch (error) {
      setSave({ status: 'error', message: saveErrorMessage(error) });
    }
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setPrefilled([]);
    setLookup({ status: 'idle' });
    setSave({ status: 'idle' });
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-800">Portal de profesores</h1>
        <Link to="/dashboard" className="text-sm font-medium text-blue-600 hover:text-blue-800">
          Volver al panel
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto mt-10 mb-16 px-6">
        {/* text-left: el index.css heredado de la plantilla de Vite centra todo el texto;
            en un formulario las etiquetas y errores se leen mejor alineados a la izquierda */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-left">
          {save.status === 'saved' ? (
            /* ---------- Confirmación (CA09) ---------- */
            <div role="status">
              <h2 className="text-2xl font-semibold text-slate-900 mb-2">Producto registrado</h2>
              <p className="text-slate-600 mb-6">
                «{form.title.trim()}» quedó registrado a tu nombre con estado <strong>cargado</strong>. Un Revisor lo
                verificará y recibirás una notificación con el resultado.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Registrar otro producto
                </button>
                <Link
                  to="/dashboard"
                  className="py-2 px-4 rounded-md border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Volver al panel
                </Link>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-slate-900 mb-2">Registrar producto</h2>
              <p className="text-slate-600 mb-6">
                Registra una publicación o un proyecto de investigación. Los campos con * son obligatorios.
              </p>

              {/* El resumen de validación desaparece cuando ya no quedan campos con error */}
              {save.status === 'error' && (save.kind !== 'validation' || Object.values(errors).some(Boolean)) && (
                <div className="mb-6">
                  <Notice kind="error">{save.message}</Notice>
                </div>
              )}

              <form className="space-y-6" onSubmit={handleSubmit} noValidate aria-busy={isSaving}>
                {/* ---------- Tipo de producto ---------- */}
                <fieldset>
                  <legend className={labelClass}>Tipo de producto *</legend>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {PRODUCT_TYPES.map((option) => (
                      <label
                        key={option.value}
                        className={`flex items-center gap-3 rounded-md border px-4 py-3 text-sm cursor-pointer ${
                          form.type === option.value
                            ? 'border-blue-500 bg-blue-50 text-slate-900'
                            : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="type"
                          value={option.value}
                          checked={form.type === option.value}
                          onChange={() => handleTypeChange(option.value)}
                          disabled={isSaving}
                          className="h-4 w-4 text-blue-600"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                {/* ---------- Autocompletado por DOI (CA07, CA08) ---------- */}
                {isPublication && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <label htmlFor="doi" className={labelClass}>
                      DOI
                    </label>
                    <p className="text-sm text-slate-500" id="doi-hint">
                      Si la publicación tiene DOI, úsalo para completar los datos automáticamente.
                    </p>
                    <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                      <div className="flex-1">
                        <input
                          {...fieldProps('doi')}
                          type="text"
                          autoComplete="off"
                          spellCheck={false}
                          placeholder="p. ej., 10.1145/3576915.3623102"
                          aria-describedby={['doi-hint', errors.doi && 'doi-error'].filter(Boolean).join(' ')}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAutocomplete}
                        aria-disabled={isLookingUp || isSaving}
                        className="py-2 px-4 rounded-md border border-blue-600 text-sm font-medium text-blue-600 bg-white hover:bg-blue-50 aria-disabled:opacity-50 aria-disabled:cursor-wait"
                      >
                        {isLookingUp ? 'Buscando...' : 'Autocompletar'}
                      </button>
                    </div>
                    <FieldError id="doi-error" message={errors.doi} />
                    {(lookup.status === 'done' || lookup.status === 'error') && (
                      <div className="mt-3">
                        <Notice kind={lookup.status === 'done' ? 'info' : 'error'}>{lookup.message}</Notice>
                      </div>
                    )}
                  </div>
                )}

                {/* ---------- Datos comunes ---------- */}
                <div>
                  <label htmlFor="title" className={labelClass}>
                    Título *<PrefilledBadge show={prefilled.includes('title')} />
                  </label>
                  <div className="mt-1">
                    <input {...fieldProps('title')} type="text" />
                  </div>
                  <FieldError id="title-error" message={errors.title} />
                </div>

                <div>
                  <label htmlFor="authors" className={labelClass}>
                    {isPublication ? 'Autores *' : 'Investigadores participantes *'}
                    <PrefilledBadge show={prefilled.includes('authors')} />
                  </label>
                  <div className="mt-1">
                    <input {...fieldProps('authors')} type="text" placeholder="Separados por coma" />
                  </div>
                  <FieldError id="authors-error" message={errors.authors} />
                </div>

                <div className="grid gap-6 sm:grid-cols-[10rem_1fr]">
                  <div>
                    <label htmlFor="year" className={labelClass}>
                      {isPublication ? 'Año *' : 'Año de inicio *'}
                      <PrefilledBadge show={prefilled.includes('year')} />
                    </label>
                    <div className="mt-1">
                      <input {...fieldProps('year')} type="text" inputMode="numeric" maxLength={4} placeholder="p. ej., 2025" />
                    </div>
                    <FieldError id="year-error" message={errors.year} />
                  </div>

                  <div>
                    <label htmlFor="researchLine" className={labelClass}>
                      Línea de investigación *
                    </label>
                    <div className="mt-1">
                      <select {...fieldProps('researchLine')} disabled={isSaving} readOnly={undefined}>
                        <option value="">Selecciona una línea</option>
                        {RESEARCH_LINES.map((line) => (
                          <option key={line} value={line}>
                            {line}
                          </option>
                        ))}
                      </select>
                    </div>
                    <FieldError id="researchLine-error" message={errors.researchLine} />
                  </div>
                </div>

                {/* ---------- Datos según el tipo ---------- */}
                {isPublication ? (
                  <div>
                    <label htmlFor="venue" className={labelClass}>
                      Revista, congreso o editorial
                      <PrefilledBadge show={prefilled.includes('venue')} />
                    </label>
                    <div className="mt-1">
                      <input {...fieldProps('venue')} type="text" />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <label htmlFor="projectCode" className={labelClass}>
                        Código institucional del proyecto *
                      </label>
                      <div className="mt-1">
                        <input {...fieldProps('projectCode')} type="text" placeholder="p. ej., ECMC-INV-2024-008" />
                      </div>
                      <FieldError id="projectCode-error" message={errors.projectCode} />
                    </div>
                    <div>
                      <label htmlFor="projectStatus" className={labelClass}>
                        Estado del proyecto *
                      </label>
                      <div className="mt-1">
                        <select {...fieldProps('projectStatus')} disabled={isSaving} readOnly={undefined}>
                          {PROJECT_STATUSES.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="abstract" className={labelClass}>
                    Resumen
                    <PrefilledBadge show={prefilled.includes('abstract')} />
                  </label>
                  <div className="mt-1">
                    <textarea {...fieldProps('abstract')} rows={4} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="submit"
                    aria-disabled={isSaving}
                    className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 aria-disabled:opacity-50 aria-disabled:cursor-wait transition-colors"
                  >
                    {isSaving ? 'Guardando...' : 'Guardar producto'}
                  </button>
                  <Link to="/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                    Cancelar
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
