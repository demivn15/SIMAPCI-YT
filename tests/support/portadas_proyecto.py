"""
PDF de proyectos de investigación para las pruebas de HU04 (PR-HU04-01 y T-HU04-07).

`pdf_de_paginas()` arma un PDF de varias páginas con texto en español (tildes y eñes, en la
codificación WinAnsi), para que la portada se parezca a la de un proyecto real de la Escuela.
Se construye a mano para no guardar archivos binarios en el repositorio.

Las portadas siguen los campos que T-HU04-02 (PGPCECMC-41) definió para extraer: título, código
del proyecto, participantes, año y resumen, con la línea de investigación como sugerencia. La
plantilla oficial de la Escuela todavía está pendiente (P-11); cuando llegue, conviene ajustar
PORTADA_PROYECTO a ella.
"""


def _texto_pdf(linea: str) -> bytes:
    """Cadena literal de PDF: escapa paréntesis y barras, y codifica en WinAnsi (cp1252)."""
    escapada = linea.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    return b"(" + escapada.encode("cp1252") + b")"


def pdf_de_paginas(paginas: list[list[str]]) -> bytes:
    """PDF con una página por elemento de `paginas`; cada línea va en un renglón (Helvetica 12)."""
    fuente = len(paginas) * 2 + 3
    objetos: list[bytes] = [
        b"<</Type/Catalog/Pages 2 0 R>>",
        b"<</Type/Pages/Kids[" + b" ".join(f"{3 + 2 * i} 0 R".encode() for i in range(len(paginas)))
        + b"]/Count " + str(len(paginas)).encode() + b">>",
    ]
    for i, lineas in enumerate(paginas):
        comandos = [b"BT", b"/F1 12 Tf", b"14 TL", b"1 0 0 1 50 740 Tm"]
        for linea in lineas:
            comandos += [_texto_pdf(linea) + b" Tj", b"T*"]
        comandos.append(b"ET")
        contenido = b"\n".join(comandos)
        objetos.append(
            b"<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 "
            + str(fuente).encode() + b" 0 R>>>>/Contents " + str(4 + 2 * i).encode() + b" 0 R>>"
        )
        objetos.append(b"<</Length " + str(len(contenido)).encode() + b">>\nstream\n" + contenido + b"\nendstream")
    objetos.append(b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>")

    salida = bytearray(b"%PDF-1.4\n")
    posiciones = []
    for numero, cuerpo in enumerate(objetos, start=1):
        posiciones.append(len(salida))
        salida += str(numero).encode() + b" 0 obj\n" + cuerpo + b"\nendobj\n"
    inicio_xref = len(salida)
    salida += b"xref\n0 " + str(len(objetos) + 1).encode() + b"\n0000000000 65535 f \n"
    for posicion in posiciones:
        salida += f"{posicion:010d} 00000 n \n".encode()
    salida += b"trailer<</Size " + str(len(objetos) + 1).encode() + b"/Root 1 0 R>>\nstartxref\n"
    salida += str(inicio_xref).encode() + b"\n%%EOF"
    return bytes(salida)


# Portada representativa de un proyecto de la ECMC con todos los campos de T-HU04-02.
TITULO = "Modelos de optimización para redes eléctricas inteligentes"
CODIGO = "ECMC-2025-04"
INVESTIGADOR_PRINCIPAL = "María García"
INTEGRANTES = ["Luis Torres", "Ana Paz"]
LINEA = "Ciencia de datos"
ANIO = "2025"
RESUMEN = (
    "Este proyecto propone modelos de optimización para la operación de redes eléctricas "
    "inteligentes con generación distribuida."
)

PORTADA_PROYECTO = [
    TITULO,
    f"Código del proyecto: {CODIGO}",
    f"Investigador principal: {INVESTIGADOR_PRINCIPAL}",
    f"Integrantes: {', '.join(INTEGRANTES)}",
    f"Línea de investigación: {LINEA}",
    f"Escuela de Ciencias Matemáticas y Computacionales (ECMC) - {ANIO}",
    "Resumen",
    "Este proyecto propone modelos de optimización para la operación de redes eléctricas",
    "inteligentes con generación distribuida.",
]
