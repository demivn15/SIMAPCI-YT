"""
File: pdf_extractor.py
Description: Extracción de campos desde el PDF del proyecto (T-HU04-04) y manejo de documentos
             con formato no reconocido o extracción parcial (T-HU04-05, PGPCECMC-91).
             Criterios CA10 y CA11.

Reglas de T-HU04-05:
  - Formato no reconocido: si el archivo lleva encabezado %PDF pero no es un PDF legible
    (dañado, truncado, cifrado), la extracción no puede seguir y se lanza
    UnreadableDocumentError. El endpoint la traduce a 400 con un mensaje claro: nunca a un
    error interno 500 (defecto D-08/D-09 de PR-HU04-02).
  - Extracción parcial: si el PDF se lee pero las heurísticas solo identifican algunos campos
    (o ninguno, como en un PDF escaneado), NO es un error. Se devuelve lo que se logró
    identificar junto con el detalle de lo que falta, para que el formulario precargue esos
    campos y deje el resto editables (CA10).
"""

import re
from dataclasses import dataclass, field

import pdfplumber
from fastapi import UploadFile
from pdfminer.psexceptions import PSException
from pdfplumber.utils.exceptions import PdfminerException

# Campos que las heurísticas pueden identificar en el documento del proyecto (T-HU04-02).
# El orden es el que se usa al enumerar los campos faltantes en el mensaje.
EXTRACTABLE_FIELDS = ("title", "authors", "year", "research_line", "venue", "abstract")

# Nombres en español para el mensaje que lee el profesor.
FIELD_LABELS = {
    "title": "título",
    "authors": "autores",
    "year": "año",
    "research_line": "línea de investigación",
    "venue": "editorial o evento",
    "abstract": "resumen",
}

# Solo se revisan las primeras páginas: la portada es donde vive la metadata del proyecto.
COVER_PAGES = 2

COMPLETE = "completa"
PARTIAL = "parcial"
EMPTY = "vacia"


class DocumentExtractionError(Exception):
    """Error base de la extracción de campos desde un documento."""


class UnreadableDocumentError(DocumentExtractionError):
    """El archivo no es un PDF legible: formato no reconocido, dañado o cifrado (CA11)."""


@dataclass
class ExtractionResult:
    """Resultado de la extracción, con el detalle de qué se identificó y qué falta (CA10)."""

    fields: dict[str, str] = field(default_factory=dict)

    @property
    def found(self) -> list[str]:
        """Campos que la extracción sí logró identificar."""
        return [name for name in EXTRACTABLE_FIELDS if self.fields.get(name)]

    @property
    def missing(self) -> list[str]:
        """Campos que quedan vacíos y el profesor debe completar o corregir."""
        return [name for name in EXTRACTABLE_FIELDS if not self.fields.get(name)]

    @property
    def status(self) -> str:
        """'completa' si se identificó todo, 'vacia' si nada, 'parcial' en cualquier otro caso."""
        if not self.found:
            return EMPTY
        if not self.missing:
            return COMPLETE
        return PARTIAL

    @property
    def message(self) -> str:
        """Aviso para el profesor; el formulario lo muestra tal cual."""
        total = len(EXTRACTABLE_FIELDS)
        if self.status == EMPTY:
            return (
                "No se pudo identificar ningún campo en el documento: puede ser un PDF escaneado "
                "o sin texto seleccionable. Completa los campos manualmente."
            )
        if self.status == COMPLETE:
            return (
                f"Se identificaron los {total} campos del documento. "
                "Revísalos y corrígelos antes de guardar."
            )
        faltantes = ", ".join(FIELD_LABELS[name] for name in self.missing)
        return (
            f"Extracción parcial: se identificaron {len(self.found)} de {total} campos. "
            f"Completa manualmente los campos restantes: {faltantes}."
        )

    def as_dict(self) -> dict:
        """Forma del resultado que viaja al frontend."""
        return {
            "status": self.status,
            "fields_found": self.found,
            "fields_missing": self.missing,
            "message": self.message,
        }


def _read_cover_text(file: UploadFile) -> str:
    """Texto de las primeras páginas. Lanza UnreadableDocumentError si el PDF no se puede abrir."""
    try:
        with pdfplumber.open(file.file) as pdf:
            paginas = pdf.pages[:COVER_PAGES]
            textos = [page.extract_text() or "" for page in paginas]
    except (PdfminerException, PSException, ValueError, OSError) as exc:
        # El archivo pasó la validación de bytes (empieza con %PDF) pero no es un PDF legible.
        raise UnreadableDocumentError(
            "El archivo no es un PDF legible: puede estar dañado, incompleto o protegido con "
            "contraseña. Verifica el documento o completa los campos manualmente."
        ) from exc

    return "\n".join(texto for texto in textos if texto)


def _parse_fields(full_text: str) -> dict[str, str]:
    """Heurísticas de portada (T-HU04-04). Cada campo que no se reconoce queda vacío."""
    extracted = {name: "" for name in EXTRACTABLE_FIELDS}
    lines = [line.strip() for line in full_text.split("\n") if line.strip()]

    # 1. Título: la primera línea con contenido de la portada.
    if lines:
        extracted["title"] = lines[0]

    # 2. Año: cuatro dígitos entre 2000 y 2026.
    year_match = re.search(r"\b(20[0-2][0-6])\b", full_text)
    if year_match:
        extracted["year"] = year_match.group(1)

    # 3. Autores: tras una etiqueta "Autores:" / "Integrantes:", en la misma línea o la siguiente.
    for i, line in enumerate(lines):
        if re.search(r"^(autores?|integrantes?)\s*[:\-]", line, re.IGNORECASE):
            parts = re.split(r"[:\-]", line, maxsplit=1)
            if len(parts) > 1 and parts[1].strip():
                extracted["authors"] = parts[1].strip()
            elif i + 1 < len(lines):
                extracted["authors"] = lines[i + 1]
            break

    # 4. Resumen / Abstract: el bloque de texto que sigue al encabezado.
    for i, line in enumerate(lines):
        if re.search(r"^(resumen|abstract)\s*[:\-]*$", line, re.IGNORECASE):
            abstract_lines = []
            for j in range(i + 1, min(i + 6, len(lines))):
                # Se corta al llegar a otro encabezado.
                if re.match(r"^[A-Z\s]{4,}:", lines[j]):
                    break
                abstract_lines.append(lines[j])
            extracted["abstract"] = " ".join(abstract_lines)
            break

    return extracted


async def extract_fields_from_pdf(file: UploadFile) -> ExtractionResult:
    """
    Extrae del PDF del proyecto los campos que logre identificar (título, autores, año,
    resumen) y reporta cuáles quedaron vacíos.

    Lanza UnreadableDocumentError si el documento no se puede leer (CA11). Una extracción
    parcial o vacía no es un error: se devuelve igual para que el profesor complete el resto
    (CA10).
    """
    full_text = _read_cover_text(file)

    # Se devuelve el puntero al inicio por si luego se almacena el archivo.
    await file.seek(0)

    return ExtractionResult(fields=_parse_fields(full_text))
