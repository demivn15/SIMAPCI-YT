"""
Documentos PDF de prueba para HU04 «Autocompletar un proyecto de investigación desde su PDF».

Se construyen a mano para no depender de archivos binarios en el repositorio ni de una librería
de escritura de PDF. `pdf_con_texto()` produce un PDF legible cuyo texto se puede extraer;
`PDF_SIN_TEXTO` y `PDF_DANADO` cubren los casos límite de T-HU04-05 (PGPCECMC-91).
"""

# PDF bien formado con una página vacía: se abre sin problema pero no tiene texto que extraer.
# Es lo que produce, por ejemplo, un documento escaneado sin OCR.
PDF_SIN_TEXTO = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n"
    b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n"
    b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF"
)

# Lleva el encabezado %PDF, así que pasa la validación de bytes, pero no tiene estructura:
# pdfplumber no puede abrirlo ("No /Root object!").
PDF_DANADO = b"%PDF-1.4\n contenido roto sin estructura"


def pdf_con_texto(lineas: list[str]) -> bytes:
    """PDF de una página con cada elemento de `lineas` en un renglón, en Helvetica 12.

    Solo admite texto Latin-1 sin paréntesis ni barras invertidas, que es suficiente para las
    portadas de prueba y evita tener que escapar cadenas PDF.
    """
    for linea in lineas:
        if any(caracter in linea for caracter in "()\\"):
            raise ValueError(f"El texto de prueba no puede llevar paréntesis ni '\\': {linea!r}")

    comandos = ["BT", "/F1 12 Tf", "14 TL", "1 0 0 1 50 740 Tm"]
    for linea in lineas:
        comandos.append(f"({linea}) Tj")
        comandos.append("T*")
    comandos.append("ET")
    contenido = "\n".join(comandos).encode("latin-1")

    objetos = [
        b"<</Type/Catalog/Pages 2 0 R>>",
        b"<</Type/Pages/Kids[3 0 R]/Count 1>>",
        b"<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]"
        b"/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>",
        b"<</Length " + str(len(contenido)).encode() + b">>\nstream\n" + contenido + b"\nendstream",
        b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    ]

    salida = bytearray(b"%PDF-1.4\n")
    posiciones = []
    for numero, cuerpo in enumerate(objetos, start=1):
        posiciones.append(len(salida))
        salida += str(numero).encode() + b" 0 obj\n" + cuerpo + b"\nendobj\n"

    inicio_xref = len(salida)
    total = len(objetos) + 1
    salida += b"xref\n0 " + str(total).encode() + b"\n0000000000 65535 f \n"
    for posicion in posiciones:
        salida += b"%010d 00000 n \n" % posicion
    salida += (
        b"trailer\n<</Size " + str(total).encode() + b"/Root 1 0 R>>\n"
        b"startxref\n" + str(inicio_xref).encode() + b"\n%%EOF"
    )
    return bytes(salida)


# Portada típica de un proyecto: título, autores, año y resumen. No trae línea de investigación
# ni editorial/evento, así que la extracción es PARCIAL (el caso normal de CA10).
PORTADA_PARCIAL = [
    "Modelamiento de ecuaciones diferenciales en redes complejas",
    "Autores: Maria Garcia, Luis Torres",
    "Escuela de Ciencias Matematicas y Computacionales - 2024",
    "Resumen",
    "Este proyecto estudia la dinamica de redes complejas",
    "mediante ecuaciones diferenciales acopladas.",
]
