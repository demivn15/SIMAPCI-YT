/**
 * T-HU07-05 (PGPCECMC-63) - Integración de la verificación de existencia con el flujo de registro
 * de HU03 (y de HU04, porque se verifica lo que quedó en el formulario, venga de donde venga).
 * Criterios CA19, CA20 y CA21 de HU07.
 *
 * CA19: al confirmar el registro, el sistema verifica si el producto ya existe antes de guardarlo.
 * CA20: si el identificador coincide, no se crea el producto y se informa la coincidencia.
 * CA21: sin DOI ni código de proyecto se permite continuar, indicando que no se pudo verificar.
 *
 * El backend se simula: checkProductExistence y createProduct se reemplazan con vi.mock. La parte
 * del backend está en tests/acceptance/test_t_hu07_06_verificacion_previa.py.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RegisterProductPage from './RegisterProductPage';
import { checkProductExistence, createProduct } from '../services/productService';

vi.mock('../services/productService', async (importOriginal) => ({
  ...(await importOriginal()),
  lookupDoi: vi.fn(),
  createProduct: vi.fn(),
  checkProductExistence: vi.fn(),
}));

const DOI = '10.1016/j.jcp.2024.112345';
const CODIGO = 'ECMC-2025-07';

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

/** Datos mínimos válidos comunes a publicaciones y proyectos. */
async function llenarDatosComunes(usuario, titulo) {
  await usuario.type(campo(/^Título/), titulo);
  // La etiqueta cambia según el tipo: «Autores» en publicaciones, «Investigadores participantes»
  // en proyectos.
  await usuario.type(campo(/^(Autores|Investigadores participantes)/), 'María García');
  await usuario.type(campo(/^Año/), '2024');
  await usuario.selectOptions(campo(/^Línea de investigación/), 'Computación científica');
}

/** Publicación válida con DOI, lista para guardar. */
async function llenarPublicacionConDoi(usuario, doi = DOI) {
  await usuario.type(campo(/^DOI/), doi);
  await llenarDatosComunes(usuario, 'Métodos espectrales para reacción-difusión');
}

/** Proyecto válido con código institucional, listo para guardar. */
async function llenarProyectoConCodigo(usuario) {
  await usuario.click(screen.getByRole('radio', { name: /Proyecto de investigación/ }));
  await llenarDatosComunes(usuario, 'Optimización de redes eléctricas');
  await usuario.type(campo(/^Código institucional/), CODIGO);
}

beforeEach(() => {
  vi.mocked(createProduct).mockReset();
  vi.mocked(createProduct).mockResolvedValue({ id: 'p-1', status: 'cargado' });
  vi.mocked(checkProductExistence).mockReset();
  vi.mocked(checkProductExistence).mockResolvedValue({ verifiable: true, exists: false });
});

describe('T-HU07-05 · verificación antes de guardar (CA19)', () => {
  it('CP-08: con DOI se consulta la existencia antes de crear el producto', async () => {
    const usuario = renderizar();
    await llenarPublicacionConDoi(usuario, `https://doi.org/${DOI}`);

    await usuario.click(guardar());

    await waitFor(() => expect(createProduct).toHaveBeenCalledTimes(1));
    // El DOI se consulta normalizado, con la misma regla que usa el guardado (RU-02).
    expect(checkProductExistence).toHaveBeenCalledWith({ doi: DOI, projectCode: null });
    expect(vi.mocked(checkProductExistence).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(createProduct).mock.invocationCallOrder[0],
    );
  });

  it('CP-09: con código de proyecto se consulta por el código normalizado', async () => {
    const usuario = renderizar();
    await llenarProyectoConCodigo(usuario);

    await usuario.click(guardar());

    await waitFor(() => expect(createProduct).toHaveBeenCalledTimes(1));
    expect(checkProductExistence).toHaveBeenCalledWith({ doi: null, projectCode: CODIGO });
  });

  it('CP-10: sin identificador no se consulta el servicio, porque no hay nada que verificar', async () => {
    const usuario = renderizar();
    await llenarDatosComunes(usuario, 'Notas de clase de análisis numérico');

    await usuario.click(guardar());

    await waitFor(() => expect(createProduct).toHaveBeenCalledTimes(1));
    expect(checkProductExistence).not.toHaveBeenCalled();
  });
});

describe('T-HU07-05 · coincidencia con un producto existente (CA20)', () => {
  it('CP-11: si el DOI ya está registrado no se guarda y se informa la coincidencia', async () => {
    vi.mocked(checkProductExistence).mockResolvedValue({
      verifiable: true,
      exists: true,
      field: 'doi',
      normalized_identifier: DOI,
      public_product_id: null,
    });
    const usuario = renderizar();
    await llenarPublicacionConDoi(usuario);

    await usuario.click(guardar());

    expect(await screen.findByRole('alert')).toHaveTextContent(/Ya existe un producto registrado con este DOI/);
    expect(createProduct).not.toHaveBeenCalled();
    // Los datos siguen en el formulario para que el profesor corrija el identificador.
    expect(campo(/^DOI/)).toHaveValue(DOI);
    expect(campo(/^DOI/)).toHaveFocus();
  });

  it('CP-12: la coincidencia por código de proyecto nombra el código y enfoca su campo', async () => {
    vi.mocked(checkProductExistence).mockResolvedValue({
      verifiable: true,
      exists: true,
      field: 'project_code',
      normalized_identifier: CODIGO,
      public_product_id: null,
    });
    const usuario = renderizar();
    await llenarProyectoConCodigo(usuario);

    await usuario.click(guardar());

    expect(await screen.findByRole('alert')).toHaveTextContent(/este código de proyecto/);
    expect(createProduct).not.toHaveBeenCalled();
    expect(campo(/^Código institucional/)).toHaveFocus();
  });

  it('CP-13: si el producto que coincide ya está verificado, el aviso lo señala (RU-08)', async () => {
    vi.mocked(checkProductExistence).mockResolvedValue({
      verifiable: true,
      exists: true,
      field: 'doi',
      normalized_identifier: DOI,
      public_product_id: 'p-existente',
    });
    const usuario = renderizar();
    await llenarPublicacionConDoi(usuario);

    await usuario.click(guardar());

    expect(await screen.findByRole('alert')).toHaveTextContent(/ya está verificado y publicado/);
    expect(createProduct).not.toHaveBeenCalled();
  });
});

describe('T-HU07-05 · verificación no realizada (CA21)', () => {
  it('CP-14: sin identificador el producto se guarda y la confirmación avisa que no se verificó', async () => {
    const usuario = renderizar();
    await llenarDatosComunes(usuario, 'Notas de clase de análisis numérico');

    await usuario.click(guardar());

    await screen.findByText(/quedó registrado a tu nombre/);
    expect(screen.getByText(/No fue posible verificar si este producto ya existía/)).toHaveTextContent(
      /no tiene DOI ni código de proyecto/,
    );
  });

  it('CP-15: si el servicio de verificación falla, el guardado continúa con el aviso', async () => {
    vi.mocked(checkProductExistence).mockRejectedValue(
      Object.assign(new Error('HTTP 503'), { response: { status: 503 } }),
    );
    const usuario = renderizar();
    await llenarPublicacionConDoi(usuario);

    await usuario.click(guardar());

    await waitFor(() => expect(createProduct).toHaveBeenCalledTimes(1));
    await screen.findByText(/quedó registrado a tu nombre/);
    expect(screen.getByText(/el servicio de verificación no respondió/)).toBeInTheDocument();
  });

  it('CP-16: una verificación correcta y sin coincidencia no muestra ningún aviso extra', async () => {
    const usuario = renderizar();
    await llenarPublicacionConDoi(usuario);

    await usuario.click(guardar());

    await screen.findByText(/quedó registrado a tu nombre/);
    expect(screen.queryByText(/No fue posible verificar/)).not.toBeInTheDocument();
  });
});
