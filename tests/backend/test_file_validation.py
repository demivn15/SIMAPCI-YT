import io
from fastapi import status
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Use your actual mounted route prefix, e.g., /api/v1/integrations/upload
ENDPOINT_URL = "/api/v1/integrations/upload"

def test_upload_valid_pdf():
    # A structurally valid minimal PDF containing necessary catalog objects (/Root, /Pages)
    pdf_content = (
        b"%PDF-1.4\n"
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n"
        b"xref\n0 4\n0000000000 65535 f \n"
        b"0000000009 00000 n \n"
        b"0000000056 00000 n \n"
        b"0000000111 00000 n \n"
        b"trailer<</Size 4/Root 1 0 R>>\n"
        b"startxref\n178\n%%EOF"
    )
    file_file = io.BytesIO(pdf_content)
    file_file.seek(0)

    response = client.post(
        ENDPOINT_URL,
        files={"file": ("research_paper.pdf", file_file, "application/pdf")}
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    
    assert "file" in data
    assert data["file"]["filename"] == "research_paper.pdf"
    assert "integrity_sha256" in data["file"]
    assert len(data["file"]["integrity_sha256"]) == 64

def test_upload_invalid_mime_type():
    fake_content = b"MZ\x90\x00\x03\x00\x00\x00Executable content disguised as PDF"
    file_file = io.BytesIO(fake_content)

    response = client.post(
        ENDPOINT_URL,
        files={"file": ("malicious.pdf", file_file, "application/pdf")}
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "does not match" in response.json()["detail"].lower()


def test_upload_unsupported_file_type():
    txt_content = b"Plain text file content not allowed."
    file_file = io.BytesIO(txt_content)

    response = client.post(
        ENDPOINT_URL,
        files={"file": ("notes.txt", file_file, "text/plain")}
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "invalid file type" in response.json()["detail"].lower()


def test_upload_exceeds_size_limit(monkeypatch):
    from app.utils import file_validation
    monkeypatch.setattr(file_validation, "MAX_FILE_SIZE_MB", 1)
    
    large_content = b"%PDF-1.4\n" + (b"A" * (2 * 1024 * 1024))
    file_file = io.BytesIO(large_content)

    response = client.post(
        ENDPOINT_URL,
        files={"file": ("huge_document.pdf", file_file, "application/pdf")}
    )

    assert response.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    assert "exceeds" in response.json()["detail"].lower()
