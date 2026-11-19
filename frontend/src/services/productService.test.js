/**
 * Pruebas de normalizeDoi y checkProductExistence - T-HU07-02 (PGPCECMC-60).
 * normalizeDoi debe dar el mismo resultado que normalize_doi() del backend.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { checkProductExistence, isValidDoi, normalizeDoi } from './productService';

const DOI = '10.1145/3576915.3623102';

describe('normalizeDoi (regla RU-02)', () => {
  it.each([
    DOI,
    `https://doi.org/${DOI}`,
    `http://dx.doi.org/${DOI}`,
    `https://www.doi.org/${DOI}`,
    `doi.org/${DOI}`,
    `doi: ${DOI}`,
    `  DOI:${DOI.toUpperCase()}/  `,
    'https://doi.org/10.1145%2F3576915.3623102',
  ])('%s queda en forma canónica y es válido', (raw) => {
    expect(normalizeDoi(raw)).toBe(DOI);
    expect(isValidDoi(normalizeDoi(raw))).toBe(true);
  });

  it('no falla con un "%" suelto', () => {
    expect(normalizeDoi('10.1145/abc%')).toBe('10.1145/abc%');
  });
});

describe('checkProductExistence', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('envía solo los identificadores presentes', async () => {
    const respuesta = { verifiable: true, exists: false, field: null, normalized_identifier: DOI, public_product_id: null };
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: respuesta });

    await expect(checkProductExistence({ doi: DOI })).resolves.toEqual(respuesta);
    expect(get).toHaveBeenCalledWith('/products/exists', { params: { doi: DOI } });

    await checkProductExistence({ projectCode: 'ECMC-2024-01' });
    expect(get).toHaveBeenLastCalledWith('/products/exists', { params: { project_code: 'ECMC-2024-01' } });
  });
});
