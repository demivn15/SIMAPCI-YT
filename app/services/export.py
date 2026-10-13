"""
File: services/export.py
Description: Builds the CSV/Excel/PDF exports required by charter requirement
             #9 ("Descarga del historial del profesor"): any user must be
             able to download filtered production in CSV, PDF or Excel.
             Implemented with the exact libraries the charter's technical
             resources name: Pandas, openpyxl and ReportLab.
"""

import io
import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def rows_to_dataframe(rows: list[dict], columns: list[str]) -> pd.DataFrame:
    """Normalise a list of row-dicts into a DataFrame with a fixed column order."""
    frame = pd.DataFrame(rows)
    for column in columns:
        if column not in frame.columns:
            frame[column] = None
    return frame[columns] if not frame.empty else pd.DataFrame(columns = columns)


def build_csv(rows: list[dict], columns: list[str]) -> bytes:
    """Serialise the given rows as UTF-8 CSV bytes."""
    frame = rows_to_dataframe(rows, columns)
    return frame.to_csv(index = False).encode("utf-8")


def build_xlsx(rows: list[dict], columns: list[str], sheet_name: str = "Export") -> bytes:
    """Serialise the given rows as an .xlsx workbook."""
    frame = rows_to_dataframe(rows, columns)
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine = "openpyxl") as writer:
        frame.to_excel(writer, index = False, sheet_name = sheet_name[:31] or "Export")
    return buffer.getvalue()


def build_pdf(rows: list[dict], columns: list[str], title: str) -> bytes:
    """Serialise the given rows as a simple landscape PDF table report."""
    buffer = io.BytesIO()
    document = SimpleDocTemplate(buffer, pagesize = landscape(letter))
    styles = getSampleStyleSheet()

    elements = [Paragraph(title, styles["Title"]), Spacer(1, 12)]

    header = [column.replace("_", " ").title() for column in columns]
    data = [header] + [
        [str(row.get(column, "") if row.get(column) is not None else "") for column in columns]
        for row in rows
    ]

    table = Table(data, repeatRows = 1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
    ]))

    elements.append(table)
    document.build(elements)

    return buffer.getvalue()


EXPORT_MEDIA_TYPES = {
    "csv": "text/csv",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}


def build_export(export_format: str, rows: list[dict], columns: list[str], title: str) -> bytes:
    """Single entry point used by the routers: dispatch to the right builder."""
    if export_format == "csv":
        return build_csv(rows, columns)
    if export_format == "xlsx":
        return build_xlsx(rows, columns, sheet_name = title)
    if export_format == "pdf":
        return build_pdf(rows, columns, title)

    raise ValueError(f"Unsupported export format: {export_format}")
