/**
 * T-HU07-06 (PGPCECMC-64), lado de la pantalla. Pruebas de duplicados y de variantes de formato
 * del identificador en el formulario de registro. Criterios CA19, CA20 y CA21 de HU07.
 * Responsable: Camilo Vásquez (tester).
 *
 * Complementa las pruebas de la integración (RegisterProductPage.hu07-verificacion.test.jsx,
 * T-HU07-05) con los recorridos completos de un profesor: pegar el DOI en otro formato, corregir
 * después de una coincidencia, verificar datos que vinieron del autocompletado, un duplicado que
 * aparece entre la consulta y el guardado, y el doble clic en «Guardar».
 *
 * El backend se simula: checkProductExistence, createProduct y lookupDoi se reemplazan con
 * vi.mock; normalizeDoi e isValidDoi son las reales. La parte del backend y los tiempos de
 * respuesta están en tests/acceptance/test_t_hu07_06_verificacion_previa.py y
 * tests/performance/test_t_hu07_06_tiempos.py.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RegisterProductPage from './RegisterProductPage';
import { checkProductExistence, createProduct, lookupDoi } from '../services/productService';

vi.mock('../services/productService', async (importOriginal) => ({
  ...(await importOriginal()),
  lookupDoi: vi.fn(),
  createProduct: vi.fn(),
  checkProductExistence: vi.fn(),
}));

const DOI = '10.1016/j.jcp.2024.112345';
const OTRO_DOI = '10.1016/j.jcp.2024.998877';
const TITULO = 'Métodos espectrales para reacción-difusión';

const NO_EXISTE = { verifiable: true, exists: false };
const EXISTE = { verifiable: true, exists: true, field: 'doi', normalized_identifier: DOI, public_product_id: null };

// Formas en que un profesor puede pegar el mismo DOI (las mismas de PR-HU07-01 y del backend)
const VARIANTES_DEL_DOI = [
  ['mayúsculas', DOI.toUpperCase()],
  ['URL completa', `https://doi.org/${DOI}`],
  ['URL en mayúsculas', `HTTPS://DOI.ORG/${DOI.toUpperCase()}`],
  ['URL antigua dx.doi.org', `http://dx.doi.org/${DOI}`],
  ['prefijo doi:', `doi: ${DOI}`],
  ['barra codificada %2F', DOI.replace('/', '%2F')],
  ['espacios y barra final', `  ${DOI}/  `],
];

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
const guardar = () => screen.getByRole('button', { name: /Guardar producto|Guardando/ });

async function llenarPublicacion(usuario, doi = DOI) {
  await usuario.type(campo(/^DOI/), doi);
  await usuario.type(campo(/^Título/), TITULO);
  await usuario.type(campo(/^Autores/), 'María García');
  await usuario.type(campo(/^Año/), '2024');
  await usuario.selectOptions(campo(/^Línea de investigación/), 'Computación científica');
}

/** Promesa que la prueba resuelve cuando quiere, para observar la pantalla mientras se verifica. */
function pendiente() {
  let resolver;
  const promesa = new Promise((resolve) => {
    resolver = resolve;
  });
  return { promesa, resolver };
}

beforeEach(() => {
  vi.mocked(lookupDoi).mockReset();
  vi.mocked(createProduct).mockReset();
  vi.mocked(createProduct).mockResolvedValue({ id: 'p-1', status: 'cargado' });
  vi.mocked(checkProductExistence).mockReset();
  vi.mocked(checkProductExistence).mockResolvedValue(NO_EXISTE);
});

describe('T-HU07-06 · variantes de formato del DOI en el formulario (CA19)', () => {
  it.each(VARIANTES_DEL_DOI)(
    'CP-01 %s: el formulario acepta el DOI pegado así y lo verifica en su forma canónica',
    async (_nombre, variante) => {
      const usuario = renderizar();
      await llenarPublicacion(usuario, variante);

      await usuario.click(guardar());

      await waitFor(() => expect(createProduct).toHaveBeenCalledTimes(1));
      expect(checkProductExistence).toHaveBeenCalledWith({ doi: DOI, projectCode: null });
      expect(vi.mocked(createProduct).mock.calls[0][0].doi).toBe(DOI);
      expect(screen.queryByText('El DOI debe tener la forma 10.xxxx/xxxxx.')).not.toBeInTheDocument();
    },
  );
});

describe('T-HU07-06 · duplicado detectado antes de guardar (CA20)', () => {
  it('CP-02: si el DOI ya existe no se guarda, se avisa y el registro en curso se conserva', async () => {
    vi.mocked(checkProductExistence).mockResolvedValue(EXISTE);
    const usuario = renderizar();
    await llenarPublicacion(usuario, `https://doi.org/${DOI.toUpperCase()}`);

    await usuario.click(guardar());

    expect(await screen.findByRole('alert')).toHaveTextContent(/Ya existe un producto registrado con este DOI/);
    expect(createProduct).not.toHaveBeenCalled();
    expect(campo(/^Título/)).toHaveValue(TITULO);
    expect(campo(/^Autores/)).toHaveValue('María García');
    expect(campo(/^DOI/)).toHaveValue(`https://doi.org/${DOI.toUpperCase()}`);
  });

  it('CP-03: después del aviso, el profesor corrige el DOI y el producto se guarda', async () => {
    vi.mocked(checkProductExistence).mockResolvedValueOnce(EXISTE).mockResolvedValueOnce(NO_EXISTE);
    const usuario = renderizar();
    await llenarPublicacion(usuario);
    await usuario.click(guardar());
    await screen.findByRole('alert');

    await usuario.clear(campo(/^DOI/));
    await usuario.type(campo(/^DOI/), OTRO_DOI);
    await usuario.click(guardar());

    expect(await screen.findByText(/quedó registrado a tu nombre/)).toBeInTheDocument();
    expect(checkProductExistence).toHaveBeenLastCalledWith({ doi: OTRO_DOI, projectCode: null });
    expect(createProduct).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createProduct).mock.calls[0][0].doi).toBe(OTRO_DOI);
  });

  it('CP-04: los datos que vinieron del autocompletado por DOI también se verifican antes de guardar', async () => {
    vi.mocked(lookupDoi).mockResolvedValue({
      doi: DOI,
      title: TITULO,
      authors: ['María García', 'Juan Pérez'],
      year: 2024,
      venue: 'Journal of Computational Physics',
      abstract: 'Resumen.',
    });
    vi.mocked(checkProductExistence).mockResolvedValue(EXISTE);
    const usuario = renderizar();
    await usuario.type(campo(/^DOI/), `https://doi.org/${DOI}`);
    await usuario.click(screen.getByRole('button', { name: 'Autocompletar' }));
    await waitFor(() => expect(campo(/^Título/)).toHaveValue(TITULO));
    await usuario.selectOptions(campo(/^Línea de investigación/), 'Computación científica');

    await usuario.click(guardar());

    await waitFor(() => expect(checkProductExistence).toHaveBeenCalledWith({ doi: DOI, projectCode: null }));
    expect(createProduct).not.toHaveBeenCalled();
    expect(campo(/^Título/)).toHaveValue(TITULO);
  });
});

describe('T-HU07-06 · confiabilidad del guardado', () => {
  it('CP-05: si otro registro gana entre la consulta y el guardado (409), se avisa y no se pierde nada', async () => {
    // La consulta dice «no existe», pero al guardar el backend ya tiene el DOI: la restricción
    // única de la BD (T-HU07-03) es la garantía final ante dos envíos casi simultáneos.
    vi.mocked(createProduct).mockRejectedValue(
      Object.assign(new Error('HTTP 409'), { response: { status: 409, data: { detail: 'Duplicate DOI' } } }),
    );
    const usuario = renderizar();
    await llenarPublicacion(usuario);

    await usuario.click(guardar());

    expect(await screen.findByRole('alert')).toHaveTextContent(/Ya existe un producto registrado/);
    expect(screen.queryByText(/quedó registrado a tu nombre/)).not.toBeInTheDocument();
    expect(campo(/^Título/)).toHaveValue(TITULO);
    expect(campo(/^DOI/)).toHaveValue(DOI);
  });

  it('CP-06: mientras se verifica, «Guardar» queda deshabilitado y un segundo clic no envía dos veces', async () => {
    const { promesa, resolver } = pendiente();
    vi.mocked(checkProductExistence).mockReturnValue(promesa);
    const usuario = renderizar();
    await llenarPublicacion(usuario);

    await usuario.click(guardar());
    expect(guardar()).toHaveAttribute('aria-disabled', 'true');
    await usuario.click(guardar());
    resolver(NO_EXISTE);

    expect(await screen.findByText(/quedó registrado a tu nombre/)).toBeInTheDocument();
    expect(checkProductExistence).toHaveBeenCalledTimes(1);
    expect(createProduct).toHaveBeenCalledTimes(1);
  });
});
