// frontend/src/utils/fileValidation.js

const MAX_SIZE_MB = 25;
const ALLOWED_TYPES = [
  'application/pdf',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

export function validateFileClientSide(file) {
  if (!file) {
    return { valid: false, error: "No file selected." };
  }

  // Check file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { 
      valid: false, 
      error: "Invalid file format. Only PDF, DOCX, and ZIP files are allowed." 
    };
  }

  // Check file size
  const sizeInMB = file.size / (1024 * 1024);
  if (sizeInMB > MAX_SIZE_MB) {
    return { 
      valid: false, 
      error: `File is too large (${sizeInMB.toFixed(2)}MB). Max size is ${MAX_SIZE_MB}MB.` 
    };
  }

  return { valid: true };
}
