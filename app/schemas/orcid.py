"""
File: schemas/orcid.py
Description: Request/response contracts for the ORCID-assisted registration
             flow (charter: "automatiza el registro de productos académicos
             mediante el identificador ORCID de cada profesor").
"""

from pydantic import BaseModel, Field


class OrcidLinkRequest(BaseModel):
    """
    Payload accepted by POST /orcid/link.

    The frontend drives the ORCID consent screen itself (it already has a
    "connect ORCID" button pointed at its own redirect target) and then posts
    the resulting authorization code back here, together with the exact
    redirect_uri it used -- ORCID requires it to match on both legs.
    """

    code: str = Field(description = "Authorization code returned by ORCID.")
    redirect_uri: str = Field(description = "The exact redirect_uri used to obtain the code.")


class OrcidWorkSummary(BaseModel):
    """One entry from a professor's public ORCID works list."""

    put_code: int
    title: str | None
    type: str | None
    year: int | None
    doi: str | None
    journal_title: str | None
    already_imported: bool = False


class OrcidWorksListResponse(BaseModel):
    orcid_id: str
    works: list[OrcidWorkSummary]


class OrcidImportRequest(BaseModel):
    """Payload accepted by POST /orcid/import: which works to bring in as publications."""

    put_codes: list[int] = Field(min_length = 1, description = "put-codes selected from /orcid/works.")
