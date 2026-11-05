"""Pruebas de normalización y validación de identificadores (PGPCECMC-33)."""

import pytest

from app.utils.identifiers import is_valid_doi, is_valid_orcid, normalize_doi, normalize_orcid


@pytest.mark.parametrize(
    "raw",
    [
        "10.1145/3576915.3623102",
        "https://doi.org/10.1145/3576915.3623102",
        "http://dx.doi.org/10.1145/3576915.3623102",
        "doi: 10.1145/3576915.3623102",
        "  DOI:10.1145/3576915.3623102/  ",
        "10.1145/3576915.3623102".upper(),
    ],
)
def test_normalize_doi_variants(raw):
    assert normalize_doi(raw) == "10.1145/3576915.3623102"


@pytest.mark.parametrize("doi,expected", [
    ("10.1145/3576915.3623102", True),
    ("10.1016/j.cell.2020.01.001", True),
    ("10.12/abc", False),        # prefijo muy corto
    ("11.1145/abc", False),      # no empieza con 10.
    ("10.1145/", False),         # sin sufijo
    ("", False),
])
def test_is_valid_doi(doi, expected):
    assert is_valid_doi(doi) is expected


def test_normalize_orcid():
    assert normalize_orcid(" https://orcid.org/0000-0002-1694-233x ") == "0000-0002-1694-233X"


@pytest.mark.parametrize("orcid,expected", [
    ("0000-0002-1825-0097", True),   # ejemplo oficial de ORCID
    ("0000-0001-5109-3700", True),
    ("0000-0002-1694-233X", True),   # dígito verificador X
    ("0000-0002-1825-0098", False),  # dígito verificador incorrecto
    ("0000-0002-1825-009", False),   # incompleto
    ("0000000218250097", False),     # sin guiones
])
def test_is_valid_orcid(orcid, expected):
    assert is_valid_orcid(orcid) is expected
