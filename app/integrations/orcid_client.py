"""
File: integrations/orcid_client.py
Description: Thin client for ORCID, the academic identity provider that
             replaces a generic social login per the charter. Two things are
             implemented: (1) the OAuth 2.0 "Sign in with ORCID" flow used for
             registration/login, and (2) read-only calls against the public
             ORCID API used to auto-import a professor's publication record.

Kept free of FastAPI/authlib so it can be unit tested by mocking httpx alone.
"""

import re
import secrets
from dataclasses import dataclass
import httpx
from app.config import settings

ORCID_ID_PATTERN = re.compile(r"^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$")


class OrcidError(Exception):
    """Raised when ORCID cannot be reached or returns something unexpected."""


def is_valid_orcid_id(value: str) -> bool:
    """Check the 0000-0000-0000-0000 checksum-digit shape of an ORCID iD."""
    return bool(ORCID_ID_PATTERN.match(value))


def generate_state() -> str:
    """A CSRF-protection token for the OAuth authorize/callback round trip."""
    return secrets.token_urlsafe(32)


def build_authorize_url(redirect_uri: str, state: str, scope: str = "/authenticate") -> str:
    """Build the URL that sends the browser to the ORCID consent screen."""
    params = httpx.QueryParams({
        "client_id": settings.ORCID_CLIENT_ID,
        "response_type": "code",
        "scope": scope,
        "redirect_uri": redirect_uri,
        "state": state,
    })
    return f"{settings.orcid_oauth_base_url}/oauth/authorize?{params}"


@dataclass
class OrcidIdentity:
    """What ORCID hands back once the authorization code is redeemed."""

    orcid_id: str
    name: str | None
    access_token: str


def exchange_code_for_identity(code: str, redirect_uri: str) -> OrcidIdentity:
    """
    Redeem the authorization code for an access token.

    Unlike most OAuth providers, ORCID returns the authenticated person's
    ORCID iD directly in the token response body (field "orcid"), so no
    separate userinfo call is needed for the "/authenticate" scope.
    """
    try:
        response = httpx.post(
            f"{settings.orcid_oauth_base_url}/oauth/token",
            data = {
                "client_id": settings.ORCID_CLIENT_ID,
                "client_secret": settings.ORCID_CLIENT_SECRET,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
            },
            headers = {"Accept": "application/json"},
            timeout = 10.0
        )
        response.raise_for_status()
    except httpx.HTTPError as error:
        raise OrcidError(f"ORCID rejected the token exchange: {error}") from error

    body = response.json()
    orcid_id = body.get("orcid")
    if not orcid_id:
        raise OrcidError("ORCID did not return an ORCID iD with this token.")

    return OrcidIdentity(
        orcid_id = orcid_id,
        name = body.get("name"),
        access_token = body.get("access_token", "")
    )


def fetch_public_record_name(orcid_id: str) -> str | None:
    """Best-effort fetch of the public display name for an ORCID iD."""
    try:
        response = httpx.get(
            f"{settings.orcid_api_base_url}/{orcid_id}/person",
            headers = {"Accept": "application/json"},
            timeout = 10.0
        )
        response.raise_for_status()
    except httpx.HTTPError:
        return None

    body = response.json()
    name_block = body.get("name") or {}
    credit_name = (name_block.get("credit-name") or {}).get("value")
    if credit_name:
        return credit_name

    given = (name_block.get("given-names") or {}).get("value", "")
    family = (name_block.get("family-name") or {}).get("value", "")
    full_name = f"{given} {family}".strip()
    return full_name or None


def _first_external_id(external_ids_block: dict, id_type: str) -> str | None:
    """Pull one external identifier (e.g. 'doi') out of ORCID's external-ids block."""
    for entry in (external_ids_block or {}).get("external-id", []):
        if entry.get("external-id-type") == id_type:
            return entry.get("external-id-value")
    return None


def fetch_works_summary(orcid_id: str) -> list[dict]:
    """
    List every work on a professor's public ORCID record.

    Returns a lightweight summary per work (one per put-code) so the
    professor can pick which ones to import, without yet fetching every
    work's full detail record.
    """
    try:
        response = httpx.get(
            f"{settings.orcid_api_base_url}/{orcid_id}/works",
            headers = {"Accept": "application/json"},
            timeout = 10.0
        )
        response.raise_for_status()
    except httpx.HTTPError as error:
        raise OrcidError(f"Could not read the ORCID works record: {error}") from error

    summaries = []
    for group in response.json().get("group", []):
        for work_summary in group.get("work-summary", []):
            summaries.append({
                "put_code": work_summary.get("put-code"),
                "title": (work_summary.get("title") or {}).get("title", {}).get("value"),
                "type": work_summary.get("type"),
                "year": (
                    (work_summary.get("publication-date") or {}).get("year") or {}
                ).get("value"),
                "doi": _first_external_id(work_summary.get("external-ids"), "doi"),
                "journal_title": (work_summary.get("journal-title") or {}).get("value"),
            })

    return summaries


def fetch_work_detail(orcid_id: str, put_code: str) -> dict:
    """Fetch the full detail of a single work, identified by its put-code."""
    try:
        response = httpx.get(
            f"{settings.orcid_api_base_url}/{orcid_id}/work/{put_code}",
            headers = {"Accept": "application/json"},
            timeout = 10.0
        )
        response.raise_for_status()
    except httpx.HTTPError as error:
        raise OrcidError(f"Could not read ORCID work {put_code}: {error}") from error

    work = response.json()
    contributors = [
        contributor.get("credit-name", {}).get("value")
        for contributor in (work.get("contributors") or {}).get("contributor", [])
        if contributor.get("credit-name")
    ]

    return {
        "put_code": work.get("put-code"),
        "title": (work.get("title") or {}).get("title", {}).get("value"),
        "type": work.get("type"),
        "year": ((work.get("publication-date") or {}).get("year") or {}).get("value"),
        "doi": _first_external_id(work.get("external-ids"), "doi"),
        "journal_title": (work.get("journal-title") or {}).get("value"),
        "short_description": work.get("short-description"),
        "authors": ", ".join(contributors) if contributors else None,
    }
