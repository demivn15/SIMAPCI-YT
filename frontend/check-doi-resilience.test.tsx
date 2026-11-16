import assert from 'node:assert/strict';
import { afterEach, describe, it, vi } from 'vitest';
import { DOI_LOOKUP_TIMEOUT_MS, doiService } from './src/services/doiService';

const UNKNOWN_DOI = '10.9999/resilience.test';

const crossrefBody = {
  message: {
    title: ['Estudio de resiliencia'],
    author: [{ given: 'Ana', family: 'Torres' }],
    published: { 'date-parts': [[2025, 3]] },
    'container-title': ['Revista de prueba'],
  },
};

const jsonResponse = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** fetch que nunca responde y solo termina cuando se aborta la petición. */
const hangingFetch = (_url: string, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('consulta de DOI ante fallos del servicio externo', () => {
  it('resuelve los metadatos cuando Crossref responde', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, crossrefBody)));
    const result = await doiService.resolveDoi(UNKNOWN_DOI);
    assert.equal(result.success, true);
    assert.equal(result.data?.title, 'Estudio de resiliencia');
    assert.equal(result.data?.semester, '2025-1');
  });

  it('no consulta el servicio con un DOI vacío', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await doiService.resolveDoi('   ');
    assert.equal(result.errorCode, 'invalid');
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it('distingue un DOI inexistente (404) de una indisponibilidad del servicio', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(404)));
    const result = await doiService.resolveDoi(UNKNOWN_DOI);
    assert.equal(result.success, false);
    assert.equal(result.errorCode, 'not_found');
    assert.match(result.error ?? '', /manualmente/);
  });

  it('informa indisponibilidad con errores 5xx y límite de peticiones (429)', async () => {
    for (const status of [500, 502, 503, 429]) {
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(status)));
      const result = await doiService.resolveDoi(UNKNOWN_DOI);
      assert.equal(result.errorCode, 'unavailable', `status ${status}`);
      assert.match(result.error ?? '', /no está disponible/);
    }
  });

  it('trata una respuesta que no es JSON válido como indisponibilidad', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 200 })));
    const result = await doiService.resolveDoi(UNKNOWN_DOI);
    assert.equal(result.errorCode, 'unavailable');
  });

  it('informa un error de red cuando no hay conexión', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const result = await doiService.resolveDoi(UNKNOWN_DOI);
    assert.equal(result.success, false);
    assert.equal(result.errorCode, 'network');
    assert.match(result.error ?? '', /conexión/);
  });

  it('aborta la consulta y devuelve timeout cuando el servicio no responde a tiempo', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(hangingFetch));
    const pending = doiService.resolveDoi(UNKNOWN_DOI);
    await vi.advanceTimersByTimeAsync(DOI_LOOKUP_TIMEOUT_MS + 1);
    const result = await pending;
    assert.equal(result.success, false);
    assert.equal(result.errorCode, 'timeout');
    assert.match(result.error ?? '', /tardó demasiado/);
  });

  it('no deja temporizadores activos cuando la consulta termina a tiempo', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, crossrefBody)));
    await doiService.resolveDoi(UNKNOWN_DOI);
    assert.equal(vi.getTimerCount(), 0);
  });

  it('usa el catálogo local sin llamar al servicio externo', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await doiService.resolveDoi('10.1145/3576915.3623102');
    assert.equal(result.success, true);
    assert.equal(result.data?.simulated, true);
    assert.equal(fetchMock.mock.calls.length, 0);
  });
});
