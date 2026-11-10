import { ProductAttachment } from '../types';

const DATABASE_NAME = 'red-papers-private-files';
const DATABASE_VERSION = 1;
const STORE_NAME = 'article-attachments';

interface StoredAttachment {
  id: string;
  blob: Blob;
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('El almacenamiento de archivos no está disponible en este navegador.'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir el almacenamiento privado.'));
  });
}

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() || `article-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function saveArticleAttachment(file: File, isSynthetic = false): Promise<ProductAttachment> {
  const id = makeId();
  if (!isSynthetic) {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put({ id, blob: file.slice(0, file.size, 'application/pdf') } satisfies StoredAttachment);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('No se pudo guardar el artículo.'));
      transaction.onabort = () => reject(transaction.error || new Error('Se canceló el guardado del artículo.'));
    }).finally(() => database.close());
  }

  return {
    id,
    fileName: file.name,
    mimeType: 'application/pdf',
    size: file.size,
    ...(isSynthetic ? { isSynthetic: true } : {}),
  };
}

export async function removeArticleAttachment(id: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('No se pudo retirar el archivo.'));
  }).finally(() => database.close());
}

function buildSyntheticPdf(): Blob {
  const lines = [
    'SIMAPC | Universidad Yachay Tech',
    'ARTICULO DE INVESTIGACION',
    'ANALISIS DE DATOS PARA INVESTIGACION ACADEMICA',
    '',
    'Titulo: Analisis de datos para investigacion academica',
    'Autores: Equipo de investigacion ECMC',
    'Fecha: 15 de mayo de 2025',
    '',
    'Resumen: Analisis de metodos de procesamiento y visualizacion de datos para apoyar la investigacion academica.',
    'Escuela de Ciencias Matematicas y Computacionales, Universidad Yachay Tech.',
  ];
  const commands = [
    'BT',
    '/F1 16 Tf',
    '54 780 Td',
    `(${lines[0]}) Tj`,
    '/F1 11 Tf',
    ...lines.slice(1).flatMap((line) => ['0 -24 Td', `(${line}) Tj`]),
    'ET',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

export function createSyntheticArticleFile(): File {
  return new File([buildSyntheticPdf()], 'articulo-investigacion-ecmc.pdf', { type: 'application/pdf' });
}

function getStoredBlob(id: string): Promise<Blob> {
  return openDatabase().then((database) => new Promise<Blob>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => {
      const attachment = request.result as StoredAttachment | undefined;
      if (!attachment?.blob) {
        reject(new Error('No se encontró el archivo en este navegador. Vuelve a adjuntarlo para continuar.'));
        return;
      }
      resolve(attachment.blob);
    };
    request.onerror = () => reject(request.error || new Error('No se pudo leer el artículo adjunto.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  }));
}

export async function downloadArticleAttachment(attachment: ProductAttachment): Promise<void> {
  const blob = attachment.isSynthetic ? buildSyntheticPdf() : await getStoredBlob(attachment.id);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
