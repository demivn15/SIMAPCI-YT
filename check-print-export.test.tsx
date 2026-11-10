import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openPrintableDocument } from './src/services/printDocument';

const reports: Blob[] = [];
const channels: TestChannel[] = [];
const link = { href: '', target: '', rel: '', click: vi.fn(), remove: vi.fn() };
const revoke = vi.fn();
const parentPrint = vi.fn(() => { throw new Error('Printing must not block the portal'); });

class TestChannel {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  close = vi.fn();
  constructor(public name: string) { channels.push(this); }
}

beforeEach(() => {
  vi.useFakeTimers();
  reports.length = 0;
  channels.length = 0;
  vi.clearAllMocks();
  vi.stubGlobal('BroadcastChannel', TestChannel);
  vi.stubGlobal('window', { setTimeout, clearTimeout, print: parentPrint });
  vi.stubGlobal('document', {
    baseURI: 'https://example.test/red-papers/index.html',
    createElement: () => link,
    body: { appendChild: vi.fn() },
  });
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    reports.push(blob as Blob);
    return `blob:report-${reports.length}`;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revoke);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('independent printable reports', () => {
  it('opens without an opener and confirms readiness before reporting success', async () => {
    const result = openPrintableDocument('<html><head></head><body><h1>Reporte</h1></body></html>');
    const ready = vi.fn();
    void result.then(ready);
    await Promise.resolve();
    expect(ready).not.toHaveBeenCalled();
    expect(link).toMatchObject({ target: '_blank', rel: 'noopener noreferrer' });
    expect(link.remove).toHaveBeenCalledOnce();
    expect(parentPrint).not.toHaveBeenCalled();
    const html = await reports[0].text();
    expect(html).toContain('<base href="https://example.test/red-papers/index.html">');
    expect(html).toContain('await document.fonts.ready');
    expect(html).toContain('window.print()');

    channels[0].onmessage?.({ data: 'opened' });
    expect(await result).toBe(true);
    expect(revoke).toHaveBeenCalledWith('blob:report-1');
    expect(channels[0].close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports a blocked popup as an error and releases its resources', async () => {
    const result = openPrintableDocument('<html><head></head><body>Reporte</body></html>');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await result).toBe(false);
    expect(parentPrint).not.toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith('blob:report-1');
    expect(channels[0].close).toHaveBeenCalledOnce();
  });

  it('keeps concurrent reports separate and cleans up if launching fails', async () => {
    const first = openPrintableDocument('<html><head></head><body>Primero</body></html>');
    const second = openPrintableDocument('<html><head></head><body>Segundo</body></html>');
    expect(channels[0].name).not.toBe(channels[1].name);
    channels[1].onmessage?.({ data: 'opened' });
    expect(await second).toBe(true);
    expect(channels[0].close).not.toHaveBeenCalled();
    channels[0].onmessage?.({ data: 'opened' });
    expect(await first).toBe(true);

    link.click.mockImplementationOnce(() => { throw new Error('Unavailable'); });
    expect(await openPrintableDocument('<html><head></head><body>Tercero</body></html>')).toBe(false);
    expect(channels[2].close).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith('blob:report-3');
    expect(vi.getTimerCount()).toBe(0);
  });
});
