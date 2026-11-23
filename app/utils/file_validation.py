"""
File: file_validation.py
Description: Validación de tipo, tamaño e integridad del archivo cargado (T-HU04-03) y rechazo
             de los formatos no reconocidos (T-HU04-05, PGPCECMC-91). Criterio CA11.

HU04 es «Autocompletar un proyecto de investigación desde su PDF»: el único formato que el
sistema sabe leer es PDF, así que cualquier otro se rechaza aquí (defecto D-08 de PR-HU04-02).
Un PDF con el encabezado correcto pero ilegible no se distingue por sus bytes: de ese caso se
encarga la extracción (app/utils/pdf_extractor.py) y el endpoint lo traduce a 400.
"""

import hashlib
from fastapi import HTTPException, UploadFile, status

# Único tipo admitido y su número mágico (firma de los primeros bytes).
ALLOWED_MIME_TYPES = {
    "application/pdf": [b"%PDF"],
}

MAX_FILE_SIZE_MB = 25
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


async def validate_and_process_file(file: UploadFile) -> dict:
  # 1. Read the initial bytes for magic number inspection & size checking
  header_chunk = await file.read(2048)
  file_size = len(header_chunk)

  # Check content type header first
  if file.content_type not in ALLOWED_MIME_TYPES:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=(
            f"Invalid file type: {file.content_type}. Allowed types:"
            f" {list(ALLOWED_MIME_TYPES.keys())}"
        ),
    )

  # 2. Verify Magic Numbers (File Signature)
  valid_signature = False
  for expected_magic in ALLOWED_MIME_TYPES[file.content_type]:
    if header_chunk.startswith(expected_magic):
      valid_signature = True
      break

  if not valid_signature:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="File content does not match its declared extension/MIME type.",
    )

  # 3. Read and compute integrity hash while enforcing total size limit
  sha256_hash = hashlib.sha256()
  sha256_hash.update(header_chunk)

  while True:
    chunk = await file.read(1024 * 64)  # Read in 64kb chunks
    if not chunk:
      break
    file_size += len(chunk)
    if file_size > (MAX_FILE_SIZE_MB * 1024 * 1024):
      raise HTTPException(
          status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
          detail=(
              "File size exceeds the maximum limit of"
              f" {MAX_FILE_SIZE_MB}MB."
          ),
      )
    sha256_hash.update(chunk)

  # Reset file pointer if needed for subsequent storage operations
  await file.seek(0)

  return {
      "filename": file.filename,
      "size": file_size,
      "content_type": file.content_type,
      "integrity_sha256": sha256_hash.hexdigest(),
  }
