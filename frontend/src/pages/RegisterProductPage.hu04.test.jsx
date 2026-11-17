/**
 * PR-HU04-02 (PGPCECMC-106), lado de la pantalla. Criterio CA11.
 * Responsable: Camilo Vásquez (tester). Parte de T-HU04-07 (PGPCECMC-46).
 *
 * CA11: si el archivo no es un PDF, está dañado o excede el tamaño permitido, se rechaza con un
 *       mensaje claro sin afectar el registro en curso.
 *
 * El backend se simula: uploadAndExtractPdf se reemplaza con vi.mock. La parte del backend está
 * en tests/acceptance/test_pr_hu04_02.py.
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

const MB = 1024 * 1024;

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

/** Archivo de prueba; `tamano` permite simular archivos grandes sin crearlos de verdad. */
function archivo(nombre, tipo, tamano = 100) {
  const file = new File(['contenido'], nombre, { type: tipo });
  Object.defineProperty(file, 'size', { value: tamano });
  return file;
}

/** Elige un archivo en el campo de carga (sin el filtro «accept» del navegador). */
function cargar(file) {
  fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } });
}

/** Escribe datos en el formulario: es el «registro en curso» que no debe perderse. */
async function escribirRegistroEnCurso(usuario) {
  await usuario.type(campo(/^Título/), 'Proyecto escrito a mano');
  await usuario.type(campo(/^Autores/), 'María García');
}

function registroIntacto() {
  expect(campo(/^Título/)).toHaveValue('Proyecto escrito a mano');
  expect(campo(/^Autores/)).toHaveValue('María García');
}

beforeEach(() => {
  vi.mocked(uploadAndExtractPdf).mockReset();
});

describe('PR-HU04-02 · rechazo de archivos inválidos sin perder el registro en curso (CA11)', () => {
  it('CP-07: un archivo que no es PDF se rechaza sin enviarlo y sin tocar el formulario', async () => {
    const usuario = renderizar();
    await escribirRegistroEnCurso(usuario);

    cargar(archivo('notas.txt', 'text/plain'));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(uploadAndExtractPdf).not.toHaveBeenCalled();
    registroIntacto();
  });

  it('CP-08: un PDF de más de 25 MB se rechaza sin enviarlo y sin tocar el formulario', async () => {
    const usuario = renderizar();
    await escribirRegistroEnCurso(usuario);

    cargar(archivo('proyecto.pdf', 'application/pdf', 26 * MB));

    expect(await screen.findByRole('alert')).toHaveTextContent(/25/);
    expect(uploadAndExtractPdf).not.toHaveBeenCalled();
    registroIntacto();
  });

  it('CP-09: si el backend rechaza el PDF (dañado), se avisa y el formulario se conserva', async () => {
    vi.mocked(uploadAndExtractPdf).mockRejectedValue(
      Object.assign(new Error('HTTP 400'), { response: { status: 400, data: { detail: 'El archivo está dañado.' } } }),
    );
    const usuario = renderizar();
    await escribirRegistroEnCurso(usuario);

    cargar(archivo('proyecto.pdf', 'application/pdf'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/dañado/);
    registroIntacto();
  });

  // DEFECTO D-08: fileValidation.js acepta DOCX y ZIP, pero CA11 pide rechazar todo lo que no sea
  // PDF. it.fails pasa mientras el defecto exista; cuando se corrija, cambiar it.fails por it.
  // Relacionado con T-HU04-03 (PGPCECMC-42).
  it.fails('CP-10: un DOCX se rechaza en la pantalla porque no es PDF', async () => {
    vi.mocked(uploadAndExtractPdf).mockResolvedValue({ file: { filename: 'p.docx' }, extracted_fields: {} });
    renderizar();

    cargar(archivo('proyecto.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));

    expect(await screen.findByRole('alert', {}, { timeout: 500 })).toBeInTheDocument();
    expect(uploadAndExtractPdf).not.toHaveBeenCalled();
  });
});
