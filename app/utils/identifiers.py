"""
File: identifiers.py
Author: Jhony Alfonso Peñaherrera
Description: Normalización y validación de DOI y ORCID - T-HU03-02 (PGPCECMC-33).

Las mismas reglas que normalizeDoi() del frontend y del prototipo: así un DOI se
escribe igual en todo el sistema y el control de duplicados de productos
(T-HU03-04) puede comparar DOI normalizados.
"""

import re

_DOI_PREFIXES = re.compile(r"^(?:https?://(?:dx\.)?doi\.org/|doi:\s*)", re.IGNORECASE)
_DOI_PATTERN = re.compile(r"^10\.\d{4,9}/\S+$")

_ORCID_PREFIX = re.compile(r"^https?://(?:www\.)?orcid\.org/", re.IGNORECASE)
_ORCID_PATTERN = re.compile(r"^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$")


def normalize_doi(raw: str | None) -> str:
    """'https://doi.org/10.1145/ABC' -> '10.1145/abc'. Los DOI no distinguen mayúsculas."""
    if not raw:
        return ""
    doi = _DOI_PREFIXES.sub("", raw.strip())
    return doi.strip().lower().rstrip("/")


def is_valid_doi(doi: str) -> bool:
    """Un DOI tiene la forma 10.<prefijo de 4 a 9 dígitos>/<sufijo>."""
    return bool(_DOI_PATTERN.match(doi or ""))


def normalize_orcid(raw: str | None) -> str:
    """'https://orcid.org/0000-0002-1694-233x' -> '0000-0002-1694-233X'."""
    if not raw:
        return ""
    return _ORCID_PREFIX.sub("", raw.strip()).upper()


def _orcid_check_digit(base_digits: str) -> str:
    """Dígito verificador ISO 7064 MOD 11-2, el que usa ORCID."""
    total = 0
    for digit in base_digits:
        total = (total + int(digit)) * 2
    result = (12 - total % 11) % 11
    return "X" if result == 10 else str(result)


def is_valid_orcid(orcid: str) -> bool:
    """Formato 0000-0000-0000-000X y dígito verificador correcto.

    El dígito verificador detecta errores de tipeo (un número cambiado o dos
    invertidos) sin necesidad de consultar a ORCID.
    """
    if not _ORCID_PATTERN.match(orcid or ""):
        return False
    digits = orcid.replace("-", "")
    return _orcid_check_digit(digits[:-1]) == digits[-1]
