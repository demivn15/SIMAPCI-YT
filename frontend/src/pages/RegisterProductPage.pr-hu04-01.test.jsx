/**
 * PR-HU04-01 (PGPCECMC-105), lado de la pantalla. Criterios CA10 y CA12.
 * Responsable: Camilo Vásquez (tester). Parte de T-HU04-07 (PGPCECMC-46).
 *
 * Procedimiento (Jira): cargar un PDF de proyecto representativo y revisar los campos precargados.
 * Resultado esperado (Jira): se precargan los campos identificables y el profesor puede
 * corregirlos antes de guardar.
 *
 * El backend se simula con la respuesta REAL que da POST /integrations/upload para la portada
 * representativa (PORTADA_PROYECTO de tests/support/portadas_proyecto.py). La parte del backend
 * está en tests/acceptance/test_pr_hu04_01.py.
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

const TITULO = 'Modelos de optimización para redes eléctricas inteligentes';
const RESUMEN =
  'Este proyecto propone modelos de optimización para la operación de redes eléctricas inteligentes con generación distribuida.';

const CAMPOS_EXTRAIDOS = {
  title: TITULO,
  authors: 'María García, Luis Torres, Ana Paz',
  year: '2025',
  research_line: 'Ciencia de datos',
  venue: '',
  abstract: RESUMEN,
  project_code: 'ECMC-2025-04',
};
const ARCHIVO = { filename: 'proyecto.pdf', size: 1047, content_type: 'application/pdf', integrity_sha256: 'a'.repeat(64) };

// Respuestas reales del backend para la portada representativa: la que recibe el formulario de un
// proyecto (envía product_type=proyecto) y la que se obtiene sin indicar el tipo.
const RESPUESTA_PROYECTO = {
  file: ARCHIVO,
  extracted_fields: CAMPOS_EXTRAIDOS,
  extraction: {
    status: 'completa',
    fields_found: ['title', 'authors', 'year', 'research_line', 'abstract', 'project_code'],
    fields_missing: [],
    message: 'Se identificaron los 6 campos del documento. Revísalos y corrígelos antes de guardar.',
  },
};
const RESPUESTA_SIN_TIPO = {
  file: ARCHIVO,
  extracted_fields: CAMPOS_EXTRAIDOS,
  extraction: {
    status: 'parcial',
    fields_found: ['title', 'authors', 'year', 'research_line', 'abstract', 'project_code'],
    fields_missing: ['venue'],
    message:
      'Extracción parcial: se identificaron 6 de 7 campos. Completa manualmente los campos restantes: editorial o evento.',
  },
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

function cargarPdf() {
  const file = new File(['%PDF-1.4'], 'proyecto.pdf', { type: 'application/pdf' });
  fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } });
}

/** El profesor elige «Proyecto de investigación» y carga el PDF de su proyecto. */
async function cargarProyecto(usuario) {
  await usuario.click(screen.getByRole('radio', { name: /Proyecto de investigación/ }));
  cargarPdf();
  await waitFor(() => expect(campo(/^Título/)).toHaveValue(TITULO));
}

beforeEach(() => {
  vi.mocked(uploadAndExtractPdf).mockReset();
  vi.mocked(uploadAndExtractPdf).mockImplementation(async (_file, tipo) =>
    tipo === 'proyecto' ? RESPUESTA_PROYECTO : RESPUESTA_SIN_TIPO,
  );
  vi.mocked(createProduct).mockReset();
  vi.mocked(createProduct).mockResolvedValue({ id: 'p-1', status: 'cargado' });
  vi.mocked(checkProductExistence).mockReset();
  vi.mocked(checkProductExistence).mockResolvedValue({ verifiable: true, exists: false });
});

describe('PR-HU04-01 · precarga de los campos identificables (CA10)', () => {
  it('CP-01: se precargan y marcan los seis campos del proyecto; el estado lo elige el profesor', async () => {
    const usuario = renderizar();

    await cargarProyecto(usuario);

    expect(campo(/^Investigadores participantes/)).toHaveValue('María García, Luis Torres, Ana Paz');
    expect(campo(/^Año de inicio/)).toHaveValue('2025');
    expect(campo(/^Línea de investigación/)).toHaveValue('Ciencia de datos');
    expect(campo(/^Código institucional/)).toHaveValue('ECMC-2025-04');
    expect(campo(/^Resumen/)).toHaveValue(RESUMEN);
    expect(screen.getAllByText('Precargado')).toHaveLength(6);
    expect(campo(/^Código institucional/)).not.toHaveAttribute('readonly');
    expect(campo(/^Estado del proyecto/)).toBeEnabled();
  });

  it('CP-02: el aviso dice cuántos campos se precargaron y pide revisarlos antes de guardar', async () => {
    const usuario = renderizar();

    await cargarProyecto(usuario);

    expect(await screen.findByText(/Se precargaron 6 campos/)).toHaveTextContent(
      /Revísalos y corrígelos antes de guardar/,
    );
  });

  // DEFECTO D-15 corregido (T-HU04-05, PGPCECMC-44): el formulario envía el tipo de producto y
  // el backend solo pide los campos de ese tipo.
  it('CP-03: en un proyecto el aviso no pide completar «editorial o evento»', async () => {
    const usuario = renderizar();

    await cargarProyecto(usuario);

    expect(uploadAndExtractPdf).toHaveBeenCalledWith(expect.any(File), 'proyecto');
    expect(await screen.findByText(/Se precargaron 6 campos/)).not.toHaveTextContent(/editorial o evento/);
  });
});

describe('PR-HU04-01 · revisión y confirmación explícita (CA12)', () => {
  it('CP-04: el profesor corrige lo precargado, y solo se guarda al pulsar «Guardar producto»', async () => {
    const usuario = renderizar();
    await cargarProyecto(usuario);

    await usuario.clear(campo(/^Título/));
    await usuario.type(campo(/^Título/), `${TITULO} - fase 2`);
    await usuario.clear(campo(/^Código institucional/));
    await usuario.type(campo(/^Código institucional/), 'ecmc-2025-05');
    await usuario.selectOptions(campo(/^Estado del proyecto/), 'finalizado');
    expect(createProduct).not.toHaveBeenCalled();

    await usuario.click(guardar());

    await waitFor(() => expect(createProduct).toHaveBeenCalledTimes(1));
    expect(createProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'proyecto',
        title: `${TITULO} - fase 2`,
        authors: ['María García', 'Luis Torres', 'Ana Paz'],
        year: 2025,
        research_line: 'Ciencia de datos',
        abstract: RESUMEN,
        project_code: 'ECMC-2025-05',
        project_status: 'finalizado',
      }),
    );
  });

  it('CP-05: lo corregido pierde la marca «Precargado» y se conserva si se vuelve a cargar el PDF', async () => {
    const usuario = renderizar();
    await cargarProyecto(usuario);

    await usuario.type(campo(/^Título/), ' - fase 2');
    expect(screen.getAllByText('Precargado')).toHaveLength(5);
    cargarPdf();

    expect(await screen.findByText(/se conservaron/)).toBeInTheDocument();
    expect(campo(/^Título/)).toHaveValue(`${TITULO} - fase 2`);
    expect(createProduct).not.toHaveBeenCalled();
  });
});
