// frontend/src/utils/fileValidation.js
//
// Validación del archivo antes de enviarlo - T-HU04-03 y T-HU04-05 (PGPCECMC-91). Criterio CA11.
//
// HU04 autocompleta el proyecto desde su PDF, así que el PDF es el único formato que el sistema
// sabe leer: cualquier otro se rechaza aquí mismo, sin gastar una subida, y el registro en curso
// se conserva intacto. El backend repite la validación en app/utils/file_validation.py.

const MAX_SIZE_MB = 25;
const ALLOWED_TYPES = ['application/pdf'];

export function validateFileClientSide(file) {
  if (!file) {
    return { valid: false, error: 'No se seleccionó ningún archivo.' };
  }

  // Formato no reconocido: solo PDF.
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Formato no válido: el documento del proyecto debe ser un archivo PDF.',
    };
  }

  // Tamaño permitido.
  const sizeInMB = file.size / (1024 * 1024);
  if (sizeInMB > MAX_SIZE_MB) {
    return {
      valid: false,
      error: `El archivo pesa ${sizeInMB.toFixed(2)} MB y el máximo permitido es ${MAX_SIZE_MB} MB.`,
    };
  }

  return { valid: true };
}
