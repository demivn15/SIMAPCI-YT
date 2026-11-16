import re
import pdfplumber
from fastapi import UploadFile

async def extract_fields_from_pdf(file: UploadFile) -> dict:
    """
    Extracts metadata fields (Title, Authors, Year, Abstract/Resumen) 
    from an uploaded project PDF document using text scraping and regex patterns.
    """
    extracted_data = {
        "title": "",
        "authors": "",
        "year": "",
        "research_line": "",
        "publisher_venue": "",
        "abstract": ""
    }

    # Read PDF content using pdfplumber from file stream
    with pdfplumber.open(file.file) as pdf:
        full_text = ""
        # Typically, project metadata lives on the first 1 or 2 pages (Cover page)
        for page in pdf.pages[:2]:
            text = page.extract_text()
            if text:
                full_text += text + "\n"

    # Reset file pointer after reading
    await file.seek(0)

    lines = [line.strip() for line in full_text.split("\n") if line.strip()]

    # --- Heuristic Parsing Rules ---
    
    # 1. Title: Usually the first prominent non-empty line or largest text block
    if lines:
        extracted_data["title"] = lines[0]

    # 2. Year: Look for 4-digit years between 2000 and current year (2026)
    year_match = re.search(r'\b(20[0-2][0-6])\b', full_text)
    if year_match:
        extracted_data["year"] = year_match.group(1)

    # 3. Authors: Look for keywords like "Autores:", "Autor:", etc.
    for i, line in enumerate(lines):
        if re.search(r'^(autores?|integrantes?)\s*[:\-]', line, re.IGNORECASE):
            # Extract content from same line or next line
            parts = re.split(r'[:\-]', line, 1)
            if len(parts) > 1 and parts[1].strip():
                extracted_data["authors"] = parts[1].strip()
            elif i + 1 < len(lines):
                extracted_data["authors"] = lines[i + 1]
            break

    # 4. Resumen / Abstract: Look for keyword and grab subsequent text block
    for i, line in enumerate(lines):
        if re.search(r'^(resumen|abstract)\s*[:\-]*$', line, re.IGNORECASE):
            abstract_lines = []
            for j in range(i + 1, min(i + 6, len(lines))):
                # Stop if we hit another header-like line
                if re.match(r'^[A-Z\s]{4,}:', lines[j]):
                    break
                abstract_lines.append(lines[j])
            extracted_data["abstract"] = " ".join(abstract_lines)
            break

    return extracted_data
