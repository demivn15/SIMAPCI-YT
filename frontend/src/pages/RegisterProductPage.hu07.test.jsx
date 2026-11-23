/**
 * PR-HU07-02 (PGPCECMC-112), lado de la pantalla. Criterio CA21.
 * Responsable: Camilo Vásquez (tester). Parte de T-HU07-06 (PGPCECMC-64).
 *
 * CA21: si el producto no tiene DOI ni código de proyecto, el sistema permite continuar e
 *       indica que no fue posible verificar su existencia.
 *
 * El backend se simula: createProduct se reemplaza con vi.mock. La parte del backend está en
 * tests/acceptance/test_pr_hu07_02.py.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RegisterProductPage from './RegisterProductPage';
import { createProduct } from '../services/productService';

vi.mock('../services/productService', async (importOriginal) => ({
  ...(await importOriginal()),
  lookupDoi: vi.fn(),
  createProduct: vi.fn(),
}));

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

/** Llena una publicación válida sin DOI y pulsa «Guardar producto». */
async function guardarSinDoi(usuario) {
  await usuario.type(campo(/^Título/), 'Notas de clase de análisis numérico');
  await usuario.type(campo(/^Autores/), 'María García');
  await usuario.type(campo(/^Año/), '2024');
  await usuario.selectOptions(campo(/^Línea de investigación/), 'Computación científica');
  await usuario.click(screen.getByRole('button', { name: 'Guardar producto' }));
}

beforeEach(() => {
  vi.mocked(createProduct).mockReset();
  vi.mocked(createProduct).mockResolvedValue({ id: 'p-1', status: 'cargado', doi: null });
});

describe('PR-HU07-02 · registro sin DOI ni código de proyecto (CA21)', () => {
  it('CP-06: sin DOI el formulario permite guardar y envía el producto sin identificador', async () => {
    const usuario = renderizar();

    await guardarSinDoi(usuario);

    await waitFor(() => expect(createProduct).toHaveBeenCalledTimes(1));
    expect(createProduct).toHaveBeenCalledWith(expect.objectContaining({ doi: null }));
    expect(await screen.findByText(/quedó registrado a tu nombre/)).toBeInTheDocument();
  });

  // DEFECTO D-06 corregido en T-HU07-05 (PGPCECMC-63): la confirmación ya muestra el aviso de
  // verificación no realizada cuando el producto se guarda sin identificador.
  it('CP-07: después de guardar sin DOI se avisa que no se verificó si ya existía', async () => {
    const usuario = renderizar();

    await guardarSinDoi(usuario);

    await screen.findByText(/quedó registrado a tu nombre/);
    expect(screen.getByText(/no (fue posible|se pudo) verificar/i)).toBeInTheDocument();
  });
});
