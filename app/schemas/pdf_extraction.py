"""
File: schemas/pdf_extraction.py
Description: Response contract for the basic PDF metadata autocomplete
             endpoints (charter requirement #3).
"""

from pydantic import BaseModel


class PdfExtractionResponse(BaseModel):
    """
    Suggested field values only. Nothing is saved from this call alone: the
    professor must review and submit them through POST /publications or
    POST /projects, per the charter's PDF-extraction risk mitigation.
    """

    title: str | None
    authors: str | None
    year: int | None
    doi: str | None
    page_count: int
