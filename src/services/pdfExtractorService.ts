import { OfficialResearchLine, AcademicSemester } from '../types';

export interface ExtractedPdfProjectMetadata {
  simulated: boolean;
  title: string;
  projectCode?: string;
  director?: string;
  participants: string[];
  year: number;
  semester: AcademicSemester;
  researchLine: OfficialResearchLine;
  abstract: string;
  fundingVenue?: string;
  fileName: string;
  fileSizeBytes: number;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const pdfExtractorService = {
  /**
   * Valida tipo, tamaño e integridad básica del archivo
   */
  validateFile(file: File): { valid: boolean; error?: string } {
    if (!file) {
      return { valid: false, error: 'No se seleccionó ningún archivo.' };
    }

    const isPdfType = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdfType) {
      return {
        valid: false,
        error: 'El archivo seleccionado no es un documento PDF válido. Por favor sube un archivo con extensión .pdf.',
      };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      return {
        valid: false,
        error: `El archivo excede el tamaño máximo permitido de 10 MB (tamaño actual: ${sizeMb} MB).`,
      };
    }

    if (file.size === 0) {
      return {
        valid: false,
        error: 'El archivo está vacío o dañado (0 bytes). Por favor verifica el documento original.',
      };
    }

    return { valid: true };
  },

  /**
   * Simula metadatos preliminares tras validar el PDF; no es un parser real.
   */
  async extractProjectMetadata(file: File): Promise<{
    success: boolean;
    data?: ExtractedPdfProjectMetadata;
    error?: string;
    warning?: string;
  }> {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Leemos el texto crudo del archivo para detectar encabezados y metadatos básicos
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Verificación de firma mágica PDF (%PDF-)
      const headerBytes = new Uint8Array(arrayBuffer.slice(0, 5));
      const headerString = String.fromCharCode(...headerBytes);
      if (!headerString.startsWith('%PDF')) {
        return {
          success: false,
          error: 'El archivo está dañado o no posee la estructura estándar de formato PDF (%PDF).',
        };
      }

      // Decodificación de texto representativo del PDF
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      const rawText = textDecoder.decode(arrayBuffer);

      // Limpieza del nombre de archivo para inferir datos si el PDF está escaneado
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');

      // Detección de año y semestre
      const yearMatch = rawText.match(/\b(202[1-6])\b/);
      const detectedYear = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
      const detectedSemester: AcademicSemester = `${detectedYear}-1` as AcademicSemester;

      // Inferencia de título
      const title = baseName.length > 5
        ? `Proyecto: ${baseName.charAt(0).toUpperCase() + baseName.slice(1)}`
        : 'Proyecto de Investigación ECMC';

      return {
        success: true,
        data: {
          simulated: true,
          title,
          // La simulación no identifica estos datos; debe completarlos el usuario.
          projectCode: '',
          director: '',
          participants: [],
          year: detectedYear,
          semester: detectedSemester,
          researchLine: 'Computación científica',
          abstract: 'Resumen extraído del documento del proyecto para validación institucional por el cuerpo docente de la ECMC.',
          fundingVenue: 'Convocatoria Interna de Investigación Yachay Tech',
          fileName: file.name,
          fileSizeBytes: file.size,
        },
        warning: 'Metadatos preliminares extraídos. Por favor revisa y corrige cada campo antes de confirmar el guardado.',
      };
    } catch {
      return {
        success: false,
        error: 'No se pudo leer el archivo PDF. Si es un documento escaneado como imagen, utiliza la captura manual.',
      };
    }
  },
};
