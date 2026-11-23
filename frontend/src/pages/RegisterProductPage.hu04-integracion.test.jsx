/**
 * T-HU04-06 (PGPCECMC-45) - Integración de la extracción del PDF con el formulario de registro
 * de HU03. Criterios CA10 y CA12 de HU04.
 *
 * CA10: se precargan los campos que el sistema logre identificar y el resto queda editable.
 * CA12: el profesor puede corregir lo precargado y el sistema solo guarda tras su confirmación
 *       explícita, que es pulsar «Guardar producto».
 *
 * El backend se simula: uploadAndExtractPdf, checkProductExistence y createProduct se reemplazan
 * con vi.mock. El rechazo de archivos inválidos está en RegisterProductPage.hu04.test.jsx y el
 * manejo de la extracción parcial en RegisterProductPage.hu04-extraccion.test.jsx.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RegisterProductPage from './RegisterProductPage';
import { checkProductExistence, createProduct, uploadAndExtractPdf } from '../services/productService';

vi.mock('../services/productService', async (importOriginal) => ({
  ...(await importOriginal()),
  lookupDoi: vi.fn(),
  createProduct: vi.fn(),
  checkProductExistence: vi.fn(),
  uploadAndExtractPdf: vi.fn(),
}));

const CAMPOS_VACIOS = { title: '', authors: '', year: '', research_line: '', venue: '', abstract: '' };

/** Respuesta del backend con los campos extraídos y su reporte (contrato de T-HU04-05). */
function respuesta(extracted_fields) {
  const fields = { ...CAMPOS_VACIOS, ...extracted_fields };
  const found = Object.keys(fields).filter((name) => fields[name]);
  const missing = Object.keys(fields).filter((name) => !fields[name]);
  return {
    file: { filename: 'proyecto.pdf', integrity_sha256: 'a'.repeat(64) },
    extracted_fields: fields,
    extraction: {
      status: missing.length === 0 ? 'completa' : found.length === 0 ? 'vacia' : 'parcial',
      fields_found: found,
      fields_missing: missing,
      message: `Extracción de prueba: ${found.length} campos.`,
    },
  };
}

const PORTADA = {
  title: 'Modelamiento de redes complejas',
  authors: 'María García, Luis Torres',
  year: '2024',
  abstract: 'Este proyecto estudia la dinámica de redes complejas.',
};

function renderizar() {
  const usuario = userEvent.setup();
  render(
    <MemoryRouter>
      <RegisterProductPage />
    </MemoryRouter>,
  );
  return usuario;
}

const campo = (nombre) => screen.getByLabelText(nombre);
const guardar = () => screen.getByRole('button', { name: 'Guardar producto' });

/** Elige el PDF en el campo de carga. */
function cargarPdf() {
  const file = new File(['%PDF-1.4'], 'proyecto.pdf', { type: 'application/pdf' });
  fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } });
}

/** Cambia el formulario al tipo «Proyecto de investigación». */
function elegirProyecto(usuario) {
  return usuario.click(screen.getByRole('radio', { name: /Proyecto de investigación/ }));
}

beforeEach(() => {
  vi.mocked(uploadAndExtractPdf).mockReset();
  vi.mocked(createProduct).mockReset();
  vi.mocked(createProduct).mockResolvedValue({ id: 'p-1', status: 'cargado' });
  vi.mocked(checkProductExistence).mockReset();
  vi.mocked(checkProductExistence).mockResolvedValue({ verifiable: true, exists: false });
});

describe('T-HU04-06 · precarga de los campos del formulario desde el PDF (CA10)', () => {
  it('CP-17: los campos identificados se precargan y se marcan como precargados', async () => {
    vi.mocked(uploadAndExtractPdf).mockResolvedValue(respuesta(PORTADA));
    renderizar();

    cargarPdf();

    await waitFor(() => expect(campo(/^Título/)).toHaveValue(PORTADA.title));
    expect(campo(/^Autores/)).toHaveValue(PORTADA.authors);
    expect(campo(/^Año/)).toHaveValue('2024');
    expect(campo(/^Resumen/)).toHaveValue(PORTADA.abstract);
    expect(screen.getAllByText('Precargado')).toHaveLength(4);
  });

  it('CP-18: la línea de investigación extraída se selecciona si es una línea oficial', async () => {
    vi.mocked(uploadAndExtractPdf).mockResolvedValue(
      respuesta({ ...PORTADA, research_line: 'Ciencia de datos' }),
    );
    renderizar();

    cargarPdf();

    await waitFor(() => expect(campo(/^Línea de investigación/)).toHaveValue('Ciencia de datos'));
  });

  it('CP-19: una línea de investigación dentro de un texto más largo también se reconoce', async () => {
    vi.mocked(uploadAndExtractPdf).mockResolvedValue(
      respuesta({ ...PORTADA, research_line: 'Línea de investigación: Computación científica' }),
    );
    renderizar();

    cargarPdf();

    await waitFor(() => expect(campo(/^Línea de investigación/)).toHaveValue('Computación científica'));
  });

  it('CP-20: una línea que no está en el catálogo deja el campo vacío para que el profesor elija', async () => {
    vi.mocked(uploadAndExtractPdf).mockResolvedValue(
      respuesta({ ...PORTADA, research_line: 'Robótica submarina' }),
    );
    const usuario = renderizar();

    cargarPdf();

    await waitFor(() => expect(campo(/^Título/)).toHaveValue(PORTADA.title));
    expect(campo(/^Línea de investigación/)).toHaveValue('');
    await usuario.selectOptions(campo(/^Línea de investigación/), 'Inteligencia artificial');
    expect(campo(/^Línea de investigación/)).toHaveValue('Inteligencia artificial');
  });

  it('CP-21: en un proyecto no se cuenta la revista, porque ese campo no está en pantalla', async () => {
    vi.mocked(uploadAndExtractPdf).mockResolvedValue(
      respuesta({ ...PORTADA, venue: 'Journal of Computational Physics' }),
    );
    const usuario = renderizar();
    await elegirProyecto(usuario);

    cargarPdf();

    await waitFor(() => expect(campo(/^Título/)).toHaveValue(PORTADA.title));
    expect(screen.queryByLabelText(/^Revista/)).not.toBeInTheDocument();
    // Título, investigadores, año y resumen: la revista extraída no suma.
    expect(await screen.findByRole('alert')).toHaveTextContent(/Se precargaron 4 campos/);
  });

  it('CP-22: en una publicación la revista sí se precarga', async () => {
    vi.mocked(uploadAndExtractPdf).mockResolvedValue(
      respuesta({ ...PORTADA, venue: 'Journal of Computational Physics' }),
    );
    renderizar();

    cargarPdf();

    await waitFor(() => expect(campo(/^Revista/)).toHaveValue('Journal of Computational Physics'));
  });

  it('CP-23: el código institucional extraído se precarga en mayúsculas', async () => {
    vi.mocked(uploadAndExtractPdf).mockResolvedValue(
      respuesta({ ...PORTADA, project_code: 'ecmc-inv-2024-008' }),
    );
    const usuario = renderizar();
    await elegirProyecto(usuario);

    cargarPdf();

    await waitFor(() => expect(campo(/^Código institucional/)).toHaveValue('ECMC-INV-2024-008'));
  });
});

describe('T-HU04-06 · revisión y confirmación explícita (CA12)', () => {
  it('CP-24: cargar el PDF no guarda nada por sí solo', async () => {
    vi.mocked(uploadAndExtractPdf).mockResolvedValue(respuesta(PORTADA));
    renderizar();

    cargarPdf();

    await waitFor(() => expect(campo(/^Título/)).toHaveValue(PORTADA.title));
    expect(createProduct).not.toHaveBeenCalled();
    expect(screen.queryByText(/quedó registrado a tu nombre/)).not.toBeInTheDocument();
  });

  it('CP-25: el profesor corrige lo precargado y se guarda lo corregido, no lo extraído', async () => {
    vi.mocked(uploadAndExtractPdf).mockResolvedValue(
      respuesta({ ...PORTADA, research_line: 'Ciencia de datos' }),
    );
    const usuario = renderizar();

    cargarPdf();
    await waitFor(() => expect(campo(/^Título/)).toHaveValue(PORTADA.title));

    await usuario.clear(campo(/^Título/));
    await usuario.type(campo(/^Título/), 'Título corregido por el profesor');
    await usuario.click(guardar());

    await waitFor(() => expect(createProduct).toHaveBeenCalledTimes(1));
    expect(createProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Título corregido por el profesor',
        authors: ['María García', 'Luis Torres'],
        year: 2024,
        research_line: 'Ciencia de datos',
      }),
    );
  });

  it('CP-26: al corregir un campo precargado se le quita la marca de precargado', async () => {
    vi.mocked(uploadAndExtractPdf).mockResolvedValue(respuesta(PORTADA));
    const usuario = renderizar();

    cargarPdf();
    await waitFor(() => expect(screen.getAllByText('Precargado')).toHaveLength(4));

    await usuario.type(campo(/^Título/), ' revisado');

    expect(screen.getAllByText('Precargado')).toHaveLength(3);
  });

  it('CP-27: lo que el profesor ya había escrito no se pisa con lo del documento', async () => {
    vi.mocked(uploadAndExtractPdf).mockResolvedValue(respuesta(PORTADA));
    const usuario = renderizar();
    await usuario.type(campo(/^Título/), 'Mi título');

    cargarPdf();

    expect(await screen.findByRole('alert')).toHaveTextContent(/se conservaron/);
    expect(campo(/^Título/)).toHaveValue('Mi título');
    expect(campo(/^Autores/)).toHaveValue(PORTADA.authors);
  });
});
