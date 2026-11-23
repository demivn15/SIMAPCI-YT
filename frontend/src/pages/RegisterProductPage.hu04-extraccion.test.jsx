/**
 * T-HU04-05 (PGPCECMC-91) - Manejo de documentos con formato no reconocido o extracción parcial,
 * lado de la pantalla. Criterios CA10 y CA11 de HU04.
 *
 * CA10: de un PDF válido se precargan los campos que el sistema logre identificar y el resto
 *       queda editable para que el profesor los complete.
 *
 * Lo que se verifica aquí es que una extracción incompleta NO se trate como un fallo: los campos
 * identificados se precargan, los que faltan quedan vacíos y editables, y el aviso le dice al
 * profesor qué le toca completar. El rechazo de archivos inválidos está en
 * RegisterProductPage.hu04.test.jsx y la parte del backend en tests/backend/test_pdf_extraction.py.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RegisterProductPage from './RegisterProductPage';
import { uploadAndExtractPdf } from '../services/productService';

vi.mock('../services/productService', async (importOriginal) => ({
  ...(await importOriginal()),
  lookupDoi: vi.fn(),
  createProduct: vi.fn(),
  uploadAndExtractPdf: vi.fn(),
}));

const CAMPOS_VACIOS = { title: '', authors: '', year: '', research_line: '', venue: '', abstract: '' };

/** Respuesta del backend: campos extraídos + reporte de extracción. */
function respuesta(extracted_fields, extraction) {
  return {
    file: { filename: 'proyecto.pdf', integrity_sha256: 'a'.repeat(64) },
    extracted_fields: { ...CAMPOS_VACIOS, ...extracted_fields },
    extraction,
  };
}

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

/** Elige un PDF en el campo de carga. */
function cargarPdf() {
  const file = new File(['%PDF-1.4'], 'proyecto.pdf', { type: 'application/pdf' });
  fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } });
}

beforeEach(() => {
  vi.mocked(uploadAndExtractPdf).mockReset();
});

describe('T-HU04-05 · extracción parcial desde el PDF (CA10)', () => {
  it('CP-11: precarga los campos identificados y deja vacíos y editables los que faltan', async () => {
    vi.mocked(uploadAndExtractPdf).mockResolvedValue(
      respuesta(
        { title: 'Modelamiento de redes complejas', authors: 'María García, Luis Torres', year: '2024' },
        {
          status: 'parcial',
          fields_found: ['title', 'authors', 'year'],
          fields_missing: ['research_line', 'venue', 'abstract'],
          message:
            'Extracción parcial: se identificaron 3 de 6 campos. Completa manualmente los campos ' +
            'restantes: línea de investigación, editorial o evento, resumen.',
        },
      ),
    );
    const usuario = renderizar();

    cargarPdf();

    expect(await screen.findByRole('alert')).toHaveTextContent(/Extracción parcial/);
    expect(campo(/^Título/)).toHaveValue('Modelamiento de redes complejas');
    expect(campo(/^Autores/)).toHaveValue('María García, Luis Torres');
    expect(campo(/^Año/)).toHaveValue('2024');

    // Lo que no se identificó queda vacío y el profesor lo puede escribir.
    expect(campo(/^Resumen/)).toHaveValue('');
    await usuario.type(campo(/^Resumen/), 'Resumen escrito a mano');
    expect(campo(/^Resumen/)).toHaveValue('Resumen escrito a mano');
  });

  it('CP-12: el aviso de extracción parcial nombra los campos que faltan por completar', async () => {
    vi.mocked(uploadAndExtractPdf).mockResolvedValue(
      respuesta(
        { title: 'Un proyecto' },
        {
          status: 'parcial',
          fields_found: ['title'],
          fields_missing: ['authors'],
          message: 'Extracción parcial: se identificaron 1 de 6 campos. Completa manualmente los campos restantes: autores.',
        },
      ),
    );
    renderizar();

    cargarPdf();

    expect(await screen.findByRole('alert')).toHaveTextContent(/autores/);
  });

  it('CP-13: un PDF sin texto no se trata como error y pide completar a mano', async () => {
    vi.mocked(uploadAndExtractPdf).mockResolvedValue(
      respuesta(
        {},
        {
          status: 'vacia',
          fields_found: [],
          fields_missing: ['title', 'authors', 'year', 'research_line', 'venue', 'abstract'],
          message:
            'No se pudo identificar ningún campo en el documento: puede ser un PDF escaneado o sin ' +
            'texto seleccionable. Completa los campos manualmente.',
        },
      ),
    );
    const usuario = renderizar();
    await usuario.type(campo(/^Título/), 'Título escrito a mano');

    cargarPdf();

    expect(await screen.findByRole('alert')).toHaveTextContent(/manualmente/);
    // El registro en curso no se altera (CA11).
    expect(campo(/^Título/)).toHaveValue('Título escrito a mano');
  });

  it('CP-14: una extracción sin campos por completar se anuncia como aviso informativo', async () => {
    vi.mocked(uploadAndExtractPdf).mockResolvedValue(
      respuesta(
        {
          title: 'Un proyecto',
          authors: 'María García',
          year: '2024',
          research_line: 'Ciencia de datos',
          venue: 'ECMC',
          abstract: 'Resumen del proyecto',
        },
        {
          status: 'completa',
          fields_found: ['title', 'authors', 'year', 'research_line', 'venue', 'abstract'],
          fields_missing: [],
          message: 'Se identificaron los 6 campos del documento. Revísalos y corrígelos antes de guardar.',
        },
      ),
    );
    renderizar();

    cargarPdf();

    expect(await screen.findByRole('status')).toHaveTextContent(/Se identificaron los 6 campos/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('CP-15: los campos que el profesor ya había escrito no se pisan con los del documento', async () => {
    vi.mocked(uploadAndExtractPdf).mockResolvedValue(
      respuesta(
        { title: 'Título del PDF', year: '2024' },
        {
          status: 'parcial',
          fields_found: ['title', 'year'],
          fields_missing: ['authors', 'research_line', 'venue', 'abstract'],
          message: 'Extracción parcial: se identificaron 2 de 6 campos. Completa manualmente los campos restantes: autores.',
        },
      ),
    );
    const usuario = renderizar();
    await usuario.type(campo(/^Título/), 'Mi título corregido');

    cargarPdf();

    expect(await screen.findByRole('alert')).toHaveTextContent(/se conservaron/);
    expect(campo(/^Título/)).toHaveValue('Mi título corregido');
    expect(campo(/^Año/)).toHaveValue('2024');
  });
});
