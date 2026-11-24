"""
T-HU04-07 (PGPCECMC-46) - Pruebas de HU04 "Autocompletar un proyecto de investigación desde su
PDF" con PDFs representativos y casos inválidos. Criterios: CA10, CA11 y CA12.
Responsable: Camilo Vásquez (tester).

Esta tarea reúne:
  - PR-HU04-01 (PGPCECMC-105): tests/acceptance/test_pr_hu04_01.py y
    frontend/src/pages/RegisterProductPage.pr-hu04-01.test.jsx (CA10 y CA12).
  - PR-HU04-02 (PGPCECMC-106): tests/acceptance/test_pr_hu04_02.py y
    frontend/src/pages/RegisterProductPage.hu04.test.jsx (CA11).
Aquí se agregan las variantes de portada que un profesor puede subir y los casos inválidos que
no cubre PR-HU04-02.

Ruta probada: POST /api/v1/integrations/upload. Los PDF se arman en
tests/support/portadas_proyecto.py; el PDF sin texto viene de tests/support/documentos_pdf.py.
"""

import hashlib
import io

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.main import app
from tests.support.documentos_pdf import PDF_SIN_TEXTO
from tests.support.portadas_proyecto import PORTADA_PROYECTO, pdf_de_paginas

UPLOAD_URL = "/api/v1/integrations/upload"

# Variantes de portada: líneas del PDF (una lista por página) y campos que deben precargarse.
VARIANTES = {
    "autores en la misma línea": (
        [["Análisis numérico de ecuaciones de reacción-difusión", "Autores: Juan Pérez, Ana Paz",
          "Quito, 2024", "Resumen", "Se estudian esquemas numéricos estables."]],
        {"title": "Análisis numérico de ecuaciones de reacción-difusión", "authors": "Juan Pérez, Ana Paz",
         "year": "2024", "abstract": "Se estudian esquemas numéricos estables."},
    ),
    "integrantes en la línea siguiente": (
        [["Aprendizaje automático para datos climáticos", "Integrantes:", "Luis Torres, María García",
          "Año 2023"]],
        {"title": "Aprendizaje automático para datos climáticos", "authors": "Luis Torres, María García",
         "year": "2023"},
    ),
    "resumen en inglés": (
        [["Graph neural networks for power grids", "Autores: Ana Paz", "2025", "Abstract",
          "We study graph neural networks for grid stability."]],
        {"title": "Graph neural networks for power grids", "authors": "Ana Paz", "year": "2025",
         "abstract": "We study graph neural networks for grid stability."},
    ),
    "datos en la segunda página": (
        [["Criptografía poscuántica aplicada"], ["Autores: Juan Pérez", "2022", "Resumen",
                                                  "Evaluamos esquemas basados en retículos."]],
        {"title": "Criptografía poscuántica aplicada", "authors": "Juan Pérez", "year": "2022",
         "abstract": "Evaluamos esquemas basados en retículos."},
    ),
}


def _cliente(rol: str | None = "professor") -> TestClient:
    """Cliente con sesión del rol indicado; None es un visitante sin sesión."""
    cliente = TestClient(app, raise_server_exceptions=False)
    if rol:
        cliente.cookies.set("access_token", create_access_token({"sub": "usuario", "user_id": "u-1", "role": rol}))
    return cliente


def _subir(cliente: TestClient, contenido: bytes, nombre: str = "proyecto.pdf"):
    return cliente.post(UPLOAD_URL, files={"file": (nombre, io.BytesIO(contenido), "application/pdf")})


@pytest.mark.parametrize("variante", VARIANTES.keys())
def test_cp01_las_variantes_de_portada_precargan_lo_que_traen(variante):
    """CP-01 · CA10: portadas con otra distribución (autores en la misma línea o en la siguiente,
    resumen en inglés, datos en la segunda página) precargan los campos que traen."""
    paginas, esperado = VARIANTES[variante]

    respuesta = _subir(_cliente(), pdf_de_paginas(paginas))

    assert respuesta.status_code == 200
    campos = respuesta.json()["extracted_fields"]
    assert {nombre: campos[nombre] for nombre in esperado} == esperado


def test_cp02_un_pdf_escaneado_no_es_error_y_deja_todo_para_completar():
    """CP-02 · CA10: un PDF sin texto (escaneado) se acepta, no precarga nada y lo informa como
    extracción vacía para que el profesor complete a mano."""
    respuesta = _subir(_cliente(), PDF_SIN_TEXTO)

    assert respuesta.status_code == 200
    assert respuesta.json()["extraction"]["status"] == "vacia"
    assert not any(respuesta.json()["extracted_fields"].values())


@pytest.mark.parametrize(
    "contenido",
    [b"", pdf_de_paginas([PORTADA_PROYECTO])[:400]],
    ids=["archivo-vacio", "pdf-cortado-a-la-mitad"],
)
def test_cp03_un_archivo_vacio_o_cortado_se_rechaza_con_mensaje(contenido):
    """CP-03 · CA11: un archivo vacío o un PDF que se cortó al copiarlo se rechazan con 400 y un
    mensaje, nunca con un error interno."""
    respuesta = _subir(_cliente(), contenido)

    assert respuesta.status_code == 400
    assert respuesta.json()["detail"]


def test_cp04_la_huella_de_integridad_corresponde_al_archivo():
    """CP-04 · CA11: la huella SHA-256 que devuelve la carga es la del archivo subido, y el mismo
    PDF da siempre la misma huella y los mismos campos."""
    contenido = pdf_de_paginas([PORTADA_PROYECTO])

    primera, segunda = _subir(_cliente(), contenido).json(), _subir(_cliente(), contenido).json()

    assert primera["file"]["integrity_sha256"] == hashlib.sha256(contenido).hexdigest()
    assert primera["file"]["size"] == len(contenido)
    assert primera == segunda


# DEFECTO D-16 corregido (T-HU04-03, PGPCECMC-42): /integrations/upload ya exige sesión de profesor.
@pytest.mark.parametrize("rol, codigo", [(None, 401), ("student", 403)], ids=["sin-sesion", "estudiante"])
def test_cp05_solo_un_profesor_con_sesion_puede_cargar_el_pdf(rol, codigo):
    """CP-05 · CA10 (actor: profesor autenticado): sin sesión la carga responde 401 y con otro
    rol 403; el PDF no se procesa."""
    respuesta = _subir(_cliente(rol), pdf_de_paginas([PORTADA_PROYECTO]))

    assert respuesta.status_code == codigo
