/** Keep the browser's blocking print dialog out of the portal's browsing context. */
export function openPrintableDocument(html: string): Promise<boolean> {
  return new Promise((resolve) => {
    let channel: BroadcastChannel | undefined;
    let objectUrl: string | undefined;
    let timeout: number | undefined;
    let settled = false;
    const finish = (success: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      channel?.close();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(success);
    };

    try {
      const channelName = `simapc-print-${crypto.getRandomValues(new Uint32Array(4)).join('-')}`;
      channel = new BroadcastChannel(channelName);
      channel.onmessage = (event) => {
        if (event.data === 'opened') finish(true);
      };

      // A Blob document needs an explicit base to load the same local fonts on GitHub Pages.
      const baseUrl = document.baseURI.replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      })[character]!);
      const printScript = `<script>
        const channel = new BroadcastChannel(${JSON.stringify(channelName)});
        channel.postMessage('opened');
        channel.close();
        window.addEventListener('load', async () => {
          await document.fonts.ready;
          window.focus();
          window.print();
        }, { once: true });
      </script>`;
      const documentHtml = html
        .replace('<head>', `<head><base href="${baseUrl}">`)
        .replace('</body>', `${printScript}</body>`);
      objectUrl = URL.createObjectURL(new Blob([documentHtml], { type: 'text/html;charset=utf-8' }));
      timeout = window.setTimeout(() => finish(false), 10_000);

      // noopener puts printing in an independent context. Its readiness message also
      // distinguishes a successfully opened report from a browser-blocked popup.
      const link = document.createElement('a');
      link.href = objectUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
      }
    } catch {
      finish(false);
    }
  });
}
