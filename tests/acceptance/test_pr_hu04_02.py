"""
PR-HU04-02 (PGPCECMC-106) - Prueba de validación de HU04 "Autocompletar un proyecto de
investigación desde su PDF". Rechazo de archivos no PDF, dañados o de tamaño excedido.
Criterio: CA11.
Responsable: Camilo Vásquez (tester). Parte de T-HU04-07 (PGPCECMC-46).

Procedimiento (Jira): cargar un archivo que no es PDF, uno dañado y uno que excede el tamaño
permitido.
Resultado esperado (Jira): los tres casos se rechazan con mensaje claro y el registro en curso
no se altera.

Ruta probada: POST /api/v1/integrations/upload (T-HU04-03, PGPCECMC-42). La parte de la pantalla
(«el registro en curso no se altera») está en frontend/src/pages/RegisterProductPage.hu04.test.jsx.
"""

import io

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.main import app

UPLOAD_URL = "/api/v1/integrations/upload"
LIMITE_MB = 25

# PDF mínimo con estructura válida (catálogo y páginas)
PDF_VALIDO = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n"
    b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n"
    b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF"
)
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


@pytest.fixture
def profesor() -> TestClient:
    """Sesión de profesor. raise_server_exceptions=False: un error interno se ve como 500, igual
    que lo vería el navegador."""
    cliente = TestClient(app, raise_server_exceptions=False)
    cliente.cookies.set(
        "access_token", create_access_token({"sub": "mgarcia", "user_id": "u-1", "role": "professor"})
    )
    return cliente


def _subir(cliente: TestClient, nombre: str, contenido: bytes, tipo: str):
    return cliente.post(UPLOAD_URL, files={"file": (nombre, io.BytesIO(contenido), tipo)})


def test_cp01_un_pdf_valido_se_acepta(profesor):
    """CP-01 · CA11 (control): un PDF bien formado pasa la validación."""
    respuesta = _subir(profesor, "proyecto.pdf", PDF_VALIDO, "application/pdf")

    assert respuesta.status_code == 200
    assert len(respuesta.json()["file"]["integrity_sha256"]) == 64


@pytest.mark.parametrize(
    "nombre, contenido, tipo",
    [
        ("notas.txt", b"Texto plano, no es un PDF", "text/plain"),
        ("portada.png", b"\x89PNG\r\n\x1a\n" + b"0" * 32, "image/png"),
    ],
    ids=["texto", "imagen"],
)
def test_cp02_un_archivo_que_no_es_pdf_se_rechaza(profesor, nombre, contenido, tipo):
    """CP-02 · CA11: un archivo que no es PDF se rechaza con un mensaje."""
    respuesta = _subir(profesor, nombre, contenido, tipo)

    assert respuesta.status_code == 400
    assert respuesta.json()["detail"]


def test_cp03_un_archivo_renombrado_a_pdf_se_rechaza(profesor):
    """CP-03 · CA11: un archivo que dice ser PDF pero no lo es (contenido de texto) se rechaza."""
    respuesta = _subir(profesor, "proyecto.pdf", b"Esto no es un PDF aunque se llame asi", "application/pdf")

    assert respuesta.status_code == 400
    assert respuesta.json()["detail"]


def test_cp04_un_pdf_que_excede_el_tamano_se_rechaza(profesor):
    """CP-04 · CA11: un PDF de más de 25 MB se rechaza con 413 y un mensaje con el límite."""
    grande = b"%PDF-1.4\n" + b"0" * ((LIMITE_MB + 1) * 1024 * 1024)

    respuesta = _subir(profesor, "proyecto.pdf", grande, "application/pdf")

    assert respuesta.status_code == 413
    assert str(LIMITE_MB) in respuesta.json()["detail"]


@pytest.mark.xfail(
    strict=True,
    reason="DEFECTO D-08: app/utils/file_validation.py acepta DOCX y ZIP además de PDF, pero CA11 y "
    "HU04 piden rechazar todo lo que no sea PDF (también el frontend los permite en fileValidation.js). "
    "T-HU04-03 (PGPCECMC-42).",
)
@pytest.mark.parametrize(
    "nombre, tipo",
    [("proyecto.docx", DOCX), ("proyecto.zip", "application/zip")],
    ids=["docx", "zip"],
)
def test_cp05_docx_y_zip_se_rechazan_porque_no_son_pdf(profesor, nombre, tipo):
    """CP-05 · CA11: DOCX y ZIP no son PDF, así que también se rechazan."""
    respuesta = _subir(profesor, nombre, b"PK\x03\x04" + b"0" * 64, tipo)

    assert respuesta.status_code in (400, 415)


@pytest.mark.xfail(
    strict=True,
    reason="DEFECTO D-09: un PDF dañado (encabezado %PDF pero sin estructura) pasa la validación y "
    "pdfplumber lanza PdfminerException al extraer; la API responde 500 sin mensaje claro. La "
    "validación de integridad debería rechazarlo con 400. T-HU04-03 (PGPCECMC-42).",
)
def test_cp06_un_pdf_danado_se_rechaza_con_mensaje_claro(profesor):
    """CP-06 · CA11: un PDF dañado se rechaza con 400 y mensaje, nunca con un error interno (500)."""
    respuesta = _subir(profesor, "proyecto.pdf", b"%PDF-1.4\n contenido roto sin estructura", "application/pdf")

    assert respuesta.status_code == 400
    assert respuesta.json()["detail"]
