/**
 * PR-HU03-02 (PGPCECMC-104) y PR-HU03-01 (PGPCECMC-103), lado de la pantalla.
 * Responsable: Camilo Vásquez (tester). Parte de T-HU03-08 (PGPCECMC-39).
 *
 * CA07: con un DOI válido se precargan los campos para revisión.
 * CA08: si el servicio externo falla, se informa, se permite el llenado manual y
 *       se conserva lo ya ingresado.
 *
 * El backend se simula: lookupDoi y createProduct se reemplazan con vi.mock; las
 * funciones normalizeDoi e isValidDoi son las reales.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RegisterProductPage from './RegisterProductPage';
import { createProduct, lookupDoi } from '../services/productService';

vi.mock('../services/productService', async (importOriginal) => ({
  ...(await importOriginal()),
  lookupDoi: vi.fn(),
  createProduct: vi.fn(),
}));

const DOI = '10.1145/3576915.3623102';
const METADATOS = {
  doi: DOI,
  title: 'Secure Aggregation for Federated Learning',
  authors: ['María García', 'Juan Pérez'],
  year: 2023,
  venue: 'ACM CCS 2023',
  abstract: 'We propose a protocol.',
  source: 'crossref',
};

/** Error con la misma forma que lanza axios cuando el backend responde con un código HTTP. */
const errorHttp = (status) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

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

beforeEach(() => {
  vi.mocked(lookupDoi).mockReset();
  vi.mocked(createProduct).mockReset();
});

describe('PR-HU03-01 · precarga con DOI válido (CA07)', () => {
  it('CP-01: precarga título, autores, año, revista y resumen', async () => {
    vi.mocked(lookupDoi).mockResolvedValue(METADATOS);
    const usuario = renderizar();

    await usuario.type(campo(/^DOI/), `https://doi.org/${DOI}`);
    await usuario.click(screen.getByRole('button', { name: 'Autocompletar' }));

    await waitFor(() => expect(campo(/^Título/)).toHaveValue(METADATOS.title));
    expect(lookupDoi).toHaveBeenCalledWith(DOI); // el DOI se envía normalizado
    expect(campo(/^Autores/)).toHaveValue('María García, Juan Pérez');
    expect(campo(/^Año/)).toHaveValue('2023');
    expect(campo(/^Revista/)).toHaveValue('ACM CCS 2023');
    expect(campo(/^Resumen/)).toHaveValue('We propose a protocol.');
    expect(screen.getByRole('status')).toHaveTextContent(/Se precargaron 5 campos/);
  });

  it('CP-02: no pisa lo que el profesor ya había escrito', async () => {
    vi.mocked(lookupDoi).mockResolvedValue(METADATOS);
    const usuario = renderizar();

    await usuario.type(campo(/^Título/), 'Mi título corregido');
    await usuario.type(campo(/^DOI/), DOI);
    await usuario.click(screen.getByRole('button', { name: 'Autocompletar' }));

    await waitFor(() => expect(campo(/^Autores/)).toHaveValue('María García, Juan Pérez'));
    expect(campo(/^Título/)).toHaveValue('Mi título corregido');
  });

  it('CP-03: un DOI con formato inválido no consulta al servicio', async () => {
    const usuario = renderizar();

    await usuario.type(campo(/^DOI/), '10.12/abc');
    await usuario.click(screen.getByRole('button', { name: 'Autocompletar' }));

    expect(lookupDoi).not.toHaveBeenCalled();
    expect(screen.getByText('El DOI debe tener la forma 10.xxxx/xxxxx.')).toBeInTheDocument();
  });
});

describe('PR-HU03-02 · caída del servicio externo durante el autocompletado (CA08)', () => {
  const casos = [
    ['servicio no disponible (503)', errorHttp(503), /no está disponible ahora/],
    ['tiempo de espera del backend (504)', errorHttp(504), /no está disponible ahora/],
    ['sin conexión con el servidor', new Error('Network Error'), /No hay conexión con el servidor/],
    ['DOI sin datos (404)', errorHttp(404), /No encontramos datos para este DOI/],
  ];

  it.each(casos)('CP-04 %s: informa el problema y conserva lo ingresado', async (_nombre, error, mensaje) => {
    vi.mocked(lookupDoi).mockRejectedValue(error);
    const usuario = renderizar();

    await usuario.type(campo(/^Título/), 'Título escrito a mano');
    await usuario.type(campo(/^Autores/), 'María García');
    await usuario.type(campo(/^DOI/), DOI);
    await usuario.click(screen.getByRole('button', { name: 'Autocompletar' }));

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent(mensaje);
    expect(aviso).toHaveTextContent(/manualmente/);
    expect(campo(/^Título/)).toHaveValue('Título escrito a mano');
    expect(campo(/^Autores/)).toHaveValue('María García');
    expect(campo(/^DOI/)).toHaveValue(DOI);
  });

  it('CP-05: después de la caída permite completar a mano y guardar', async () => {
    vi.mocked(lookupDoi).mockRejectedValue(errorHttp(503));
    vi.mocked(createProduct).mockResolvedValue({ id: 'p-1', status: 'cargado' });
    const usuario = renderizar();

    await usuario.type(campo(/^DOI/), DOI);
    await usuario.click(screen.getByRole('button', { name: 'Autocompletar' }));
    await screen.findByRole('alert');

    expect(campo(/^Título/)).not.toHaveAttribute('readonly');
    await usuario.type(campo(/^Título/), 'Registro manual');
    await usuario.type(campo(/^Autores/), 'María García, Juan Pérez');
    await usuario.type(campo(/^Año/), '2024');
    await usuario.selectOptions(campo(/^Línea de investigación/), 'Ciencia de datos');
    await usuario.click(screen.getByRole('button', { name: 'Guardar producto' }));

    await waitFor(() => expect(createProduct).toHaveBeenCalledTimes(1));
    expect(createProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Registro manual',
        authors: ['María García', 'Juan Pérez'],
        year: 2024,
        research_line: 'Ciencia de datos',
        doi: DOI,
      }),
    );
    expect(await screen.findByText(/quedó registrado a tu nombre/)).toBeInTheDocument();
  });

  it('CP-06: si falla el guardado, los datos siguen en el formulario', async () => {
    vi.mocked(createProduct).mockRejectedValue(errorHttp(500));
    const usuario = renderizar();

    await usuario.type(campo(/^Título/), 'No se debe perder');
    await usuario.type(campo(/^Autores/), 'María García');
    await usuario.type(campo(/^Año/), '2024');
    await usuario.selectOptions(campo(/^Línea de investigación/), 'Ciencia de datos');
    await usuario.click(screen.getByRole('button', { name: 'Guardar producto' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Tus datos siguen en el formulario/);
    expect(campo(/^Título/)).toHaveValue('No se debe perder');
  });
});
