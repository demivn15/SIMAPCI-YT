"""
T-HU04-05 (PGPCECMC-91) - Manejo de documentos con formato no reconocido o extracción parcial.
Criterios CA10 y CA11 de HU04 «Autocompletar un proyecto de investigación desde su PDF».

Dos comportamientos distintos que no hay que confundir:

  - Formato NO RECONOCIDO (CA11): el documento no se puede leer, así que no hay nada que
    autocompletar. Se rechaza con 400 y un mensaje claro, nunca con un error interno (500).
    Entran aquí lo que no es PDF y el PDF dañado, truncado o protegido.

  - Extracción PARCIAL o VACÍA (CA10): el PDF sí se lee, pero las heurísticas solo identifican
    algunos campos (o ninguno, como en un escaneo sin OCR). Eso NO es un error: la respuesta es
    200 con los campos identificados y el detalle de los que faltan, para que el formulario
    precargue unos y deje el resto editables.

La parte de pantalla (que el registro en curso no se pierda) está en
frontend/src/pages/RegisterProductPage.hu04.test.jsx.
"""

import asyncio
import io

import pytest
from fastapi import UploadFile
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.main import app
from app.utils.file_validation import ALLOWED_MIME_TYPES
from app.utils.pdf_extractor import (
    EXTRACTABLE_FIELDS,
    ExtractionResult,
    UnreadableDocumentError,
    extract_fields_from_pdf,
)
from tests.support.documentos_pdf import (
    PDF_DANADO,
    PDF_SIN_TEXTO,
    PORTADA_PARCIAL,
    pdf_con_texto,
)

UPLOAD_URL = "/api/v1/integrations/upload"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


@pytest.fixture
def profesor() -> TestClient:
    """Sesión de profesor. raise_server_exceptions=False para que un error interno se vea como
    un 500 en la respuesta, igual que lo vería el navegador, y no como una excepción."""
    cliente = TestClient(app, raise_server_exceptions=False)
    cliente.cookies.set(
        "access_token", create_access_token({"sub": "mgarcia", "user_id": "u-1", "role": "professor"})
    )
    return cliente


def _subir(cliente: TestClient, nombre: str, contenido: bytes, tipo: str):
    return cliente.post(UPLOAD_URL, files={"file": (nombre, io.BytesIO(contenido), tipo)})


# --- Formato no reconocido (CA11) ---------------------------------------------------------


def test_solo_se_admite_pdf():
    """HU04 trabaja sobre el PDF del proyecto: ningún otro tipo está en la lista de admitidos."""
    assert list(ALLOWED_MIME_TYPES) == ["application/pdf"]


@pytest.mark.parametrize(
    "nombre, contenido, tipo",
    [
        ("proyecto.docx", b"PK\x03\x04" + b"0" * 64, DOCX),
        ("proyecto.zip", b"PK\x03\x04" + b"0" * 64, "application/zip"),
        ("notas.txt", b"Texto plano", "text/plain"),
    ],
    ids=["docx", "zip", "txt"],
)
def test_un_formato_que_no_es_pdf_se_rechaza_con_mensaje(profesor, nombre, contenido, tipo):
    """CA11: el sistema no sabe leer estos formatos, así que los rechaza antes de procesarlos."""
    respuesta = _subir(profesor, nombre, contenido, tipo)

    assert respuesta.status_code == 400
    assert respuesta.json()["detail"]


def test_un_pdf_ilegible_se_rechaza_con_400_y_no_con_error_interno(profesor):
    """CA11: un PDF con encabezado válido pero sin estructura no puede romper la API."""
    respuesta = _subir(profesor, "proyecto.pdf", PDF_DANADO, "application/pdf")

    assert respuesta.status_code == 400
    detalle = respuesta.json()["detail"]
    assert "dañado" in detalle or "legible" in detalle


def test_la_extraccion_avisa_del_documento_ilegible_con_su_propia_excepcion():
    """El error viaja como excepción de dominio; el endpoint es quien decide el código HTTP."""
    archivo = UploadFile(filename="proyecto.pdf", file=io.BytesIO(PDF_DANADO))

    with pytest.raises(UnreadableDocumentError):
        asyncio.run(extract_fields_from_pdf(archivo))


# --- Extracción parcial y vacía (CA10) ----------------------------------------------------


def test_una_portada_incompleta_precarga_lo_identificado_y_reporta_lo_que_falta(profesor):
    """CA10: se precarga lo que se logró identificar y el resto queda señalado como faltante."""
    respuesta = _subir(profesor, "proyecto.pdf", pdf_con_texto(PORTADA_PARCIAL), "application/pdf")

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    extraccion = cuerpo["extraction"]

    assert extraccion["status"] == "parcial"
    assert set(extraccion["fields_found"]) == {"title", "authors", "year", "abstract"}
    assert set(extraccion["fields_missing"]) == {"research_line", "venue"}

    # Los campos identificados llegan con su valor; los que faltan, vacíos y editables.
    campos = cuerpo["extracted_fields"]
    assert campos["title"] == "Modelamiento de ecuaciones diferenciales en redes complejas"
    assert campos["authors"] == "Maria Garcia, Luis Torres"
    assert campos["year"] == "2024"
    assert "redes complejas" in campos["abstract"]
    assert campos["research_line"] == ""
    assert campos["venue"] == ""


def test_el_aviso_de_extraccion_parcial_nombra_los_campos_por_completar(profesor):
    """El profesor tiene que saber qué le toca llenar a mano, no solo que faltan datos."""
    respuesta = _subir(profesor, "proyecto.pdf", pdf_con_texto(PORTADA_PARCIAL), "application/pdf")

    mensaje = respuesta.json()["extraction"]["message"]
    assert "parcial" in mensaje.lower()
    assert "línea de investigación" in mensaje
    assert "editorial o evento" in mensaje


def test_un_pdf_sin_texto_no_es_un_error_y_pide_completar_a_mano(profesor):
    """CA10: un escaneo sin OCR se procesa igual; simplemente no aporta campos."""
    respuesta = _subir(profesor, "escaneo.pdf", PDF_SIN_TEXTO, "application/pdf")

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()

    assert cuerpo["extraction"]["status"] == "vacia"
    assert cuerpo["extraction"]["fields_found"] == []
    assert sorted(cuerpo["extraction"]["fields_missing"]) == sorted(EXTRACTABLE_FIELDS)
    assert "manualmente" in cuerpo["extraction"]["message"]
    assert all(valor == "" for valor in cuerpo["extracted_fields"].values())

    # El archivo sí se validó: su hash de integridad se devuelve igual (T-HU04-03).
    assert len(cuerpo["file"]["integrity_sha256"]) == 64


def test_la_respuesta_siempre_trae_todos_los_campos_extraibles(profesor):
    """El formulario espera un contrato fijo: las claves no cambian según lo que se identifique."""
    respuesta = _subir(profesor, "proyecto.pdf", pdf_con_texto(PORTADA_PARCIAL), "application/pdf")

    assert sorted(respuesta.json()["extracted_fields"]) == sorted(EXTRACTABLE_FIELDS)


# --- Clasificación del resultado (unidad) -------------------------------------------------


@pytest.mark.parametrize(
    "campos, esperado",
    [
        ({}, "vacia"),
        ({name: "" for name in EXTRACTABLE_FIELDS}, "vacia"),
        ({"title": "Un proyecto"}, "parcial"),
        ({name: "dato" for name in EXTRACTABLE_FIELDS}, "completa"),
    ],
    ids=["sin_campos", "todos_vacios", "un_campo", "todos_los_campos"],
)
def test_el_estado_de_la_extraccion_refleja_cuanto_se_identifico(campos, esperado):
    assert ExtractionResult(fields=campos).status == esperado


def test_un_campo_en_blanco_cuenta_como_faltante():
    """Un título que quedó como cadena vacía no está «identificado»: hay que completarlo."""
    resultado = ExtractionResult(fields={"title": "", "year": "2024"})

    assert resultado.found == ["year"]
    assert "title" in resultado.missing
