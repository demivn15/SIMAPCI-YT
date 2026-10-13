"""
File: routers/orcid.py
Description: ORCID integration. Per the charter this replaces a generic
             social-login provider: ORCID both signs a professor in/up AND
             drives the "autocompletado con ORCID" automated registration of
             publications (requirement #3).
"""

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_database_session
from app.models.common import ProductSource, VerificationStatus
from app.models.publication import PublicationModel, PublicationType
from app.models.user import UserModel, UserRole
from app.schemas.orcid import (
    OrcidImportRequest,
    OrcidLinkRequest,
    OrcidWorksListResponse,
    OrcidWorkSummary,
)
from app.schemas.publication import PublicationResponse
from app.schemas.token import TokenPair
from app.integrations import orcid_client
from app.security.dependencies import get_current_active_user
from app.security.sessions import issue_token_pair

router = APIRouter(prefix = "/orcid", tags = ["ORCID"])

STATE_COOKIE_NAME = "orcid_oauth_state"


def _require_orcid_configured():
    if not settings.orcid_is_configured:
        raise HTTPException(
            status_code = status.HTTP_503_SERVICE_UNAVAILABLE,
            detail = "ORCID login is not configured on this server (ORCID_CLIENT_ID/SECRET missing)."
        )


def _callback_redirect_uri(request: Request) -> str:
    return str(request.url_for("orcid_callback"))


@router.get(
    "/login",
    summary = "Start 'Sign in with ORCID'",
    description = (
        "Redirects the browser to the ORCID consent screen. On return, the "
        "professor is signed in (or registered, if this is their first time) "
        "using their ORCID iD as the account's academic identity."
    ),
    responses = {503: {"description": "ORCID is not configured on this server."}}
)
def orcid_login(request: Request):
    """Send the browser to ORCID's consent screen."""
    _require_orcid_configured()

    state = orcid_client.generate_state()
    authorize_url = orcid_client.build_authorize_url(_callback_redirect_uri(request), state)

    response = RedirectResponse(authorize_url)
    response.set_cookie(STATE_COOKIE_NAME, state, httponly = True, max_age = 600, samesite = "lax")
    return response


@router.get(
    "/callback",
    response_model = TokenPair,
    name = "orcid_callback",
    summary = "Finish 'Sign in with ORCID' and issue application tokens",
    description = (
        "ORCID redirects here with an authorization code. The API verifies it, "
        "reads the ORCID iD, finds or creates the matching professor account and "
        "returns its own JWT pair."
    ),
    responses = {
        400: {"description": "Invalid/expired state, or ORCID rejected the exchange."},
        503: {"description": "ORCID is not configured on this server."},
    }
)
def orcid_callback(
    request: Request,
    code: str,
    state: str,
    db: Session = Depends(get_database_session),
    orcid_oauth_state: str | None = Cookie(default = None)
):
    """Turn the ORCID response into a local professor account and a JWT pair."""
    _require_orcid_configured()

    if not orcid_oauth_state or orcid_oauth_state != state:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Missing or mismatched OAuth state; please restart the ORCID sign-in."
        )

    try:
        identity = orcid_client.exchange_code_for_identity(code, _callback_redirect_uri(request))
    except orcid_client.OrcidError as error:
        raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail = str(error))

    user = db.query(UserModel).filter(UserModel.orcid_id == identity.orcid_id).first()

    if user is None:
        display_name = identity.name or orcid_client.fetch_public_record_name(identity.orcid_id) or identity.orcid_id
        base_username = identity.orcid_id.replace("-", "")
        username = base_username
        suffix = 1
        while db.query(UserModel).filter(UserModel.username == username).first():
            suffix += 1
            username = f"{base_username}{suffix}"

        user = UserModel(
            username = username,
            full_name = display_name,
            email = f"{identity.orcid_id}@orcid.placeholder",
            hashed_password = None,
            role = UserRole.PROFESSOR,
            orcid_id = identity.orcid_id,
            orcid_access_token = identity.access_token,
            is_active = True
        )
        db.add(user)
    else:
        user.orcid_access_token = identity.access_token

    db.commit()
    db.refresh(user)

    if not user.is_active:
        raise HTTPException(status_code = status.HTTP_403_FORBIDDEN, detail = "This account has been deactivated.")

    tokens = issue_token_pair(db, user, remember_me = False)

    response = Response(content = tokens.model_dump_json(), media_type = "application/json")
    response.delete_cookie(STATE_COOKIE_NAME)
    return response


@router.post(
    "/link",
    response_model = TokenPair,
    summary = "Link an ORCID iD to the currently authenticated account",
    description = (
        "For a professor who already has a local (email/password) account and "
        "wants to attach their ORCID iD. The frontend must drive the ORCID "
        "consent screen itself and post the resulting `code`/`redirect_uri` here."
    ),
    responses = {
        400: {"description": "ORCID rejected the exchange."},
        409: {"description": "That ORCID iD is already linked to a different account."},
    }
)
def link_orcid(
    payload: OrcidLinkRequest,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session)
):
    """Attach an ORCID iD, obtained out-of-band, to the signed-in professor."""
    _require_orcid_configured()

    try:
        identity = orcid_client.exchange_code_for_identity(payload.code, payload.redirect_uri)
    except orcid_client.OrcidError as error:
        raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail = str(error))

    existing = db.query(UserModel).filter(UserModel.orcid_id == identity.orcid_id).first()
    if existing is not None and existing.id != current_user.id:
        raise HTTPException(
            status_code = status.HTTP_409_CONFLICT,
            detail = "This ORCID iD is already linked to another account."
        )

    current_user.orcid_id = identity.orcid_id
    current_user.orcid_access_token = identity.access_token
    db.add(current_user)
    db.commit()

    return issue_token_pair(db, current_user, remember_me = False)


@router.get(
    "/works",
    response_model = OrcidWorksListResponse,
    summary = "List the works on the professor's public ORCID record",
    description = "Reads the professor's own ORCID works, so they can pick which ones to import.",
    responses = {400: {"description": "The account has no ORCID iD linked yet."}}
)
def list_orcid_works(
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session)
):
    """List every work on the professor's public ORCID record."""
    if not current_user.orcid_id:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Link an ORCID iD first via GET /orcid/login or POST /orcid/link."
        )

    try:
        summaries = orcid_client.fetch_works_summary(current_user.orcid_id)
    except orcid_client.OrcidError as error:
        raise HTTPException(status_code = status.HTTP_502_BAD_GATEWAY, detail = str(error))

    imported_put_codes = {
        row[0] for row in
        db.query(PublicationModel.orcid_put_code)
        .filter(PublicationModel.owner_id == current_user.id, PublicationModel.orcid_put_code.isnot(None))
        .all()
    }

    works = [
        OrcidWorkSummary(
            put_code = summary["put_code"],
            title = summary["title"],
            type = summary["type"],
            year = int(summary["year"]) if summary["year"] else None,
            doi = summary["doi"],
            journal_title = summary["journal_title"],
            already_imported = str(summary["put_code"]) in imported_put_codes
        )
        for summary in summaries
    ]

    return OrcidWorksListResponse(orcid_id = current_user.orcid_id, works = works)


@router.post(
    "/import",
    response_model = list[PublicationResponse],
    status_code = status.HTTP_201_CREATED,
    summary = "Import selected ORCID works as verified publications",
    description = (
        "Creates one Publication per selected put-code, sourced from ORCID. "
        "Per charter requirement #7, ORCID-sourced records are trusted and "
        "marked VERIFIED immediately, skipping the manual review committee."
    ),
    responses = {400: {"description": "The account has no ORCID iD linked yet."}}
)
def import_orcid_works(
    payload: OrcidImportRequest,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session)
):
    """Pull the selected ORCID works into the local database as publications."""
    if not current_user.orcid_id:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Link an ORCID iD first via GET /orcid/login or POST /orcid/link."
        )

    created: list[PublicationModel] = []

    for put_code in payload.put_codes:
        already_imported = (
            db.query(PublicationModel)
            .filter(
                PublicationModel.owner_id == current_user.id,
                PublicationModel.orcid_put_code == str(put_code)
            )
            .first()
        )
        if already_imported:
            created.append(already_imported)
            continue

        try:
            detail = orcid_client.fetch_work_detail(current_user.orcid_id, str(put_code))
        except orcid_client.OrcidError as error:
            raise HTTPException(status_code = status.HTTP_502_BAD_GATEWAY, detail = str(error))

        try:
            publication_type = PublicationType((detail.get("type") or "").lower())
        except ValueError:
            publication_type = PublicationType.OTHER

        publication = PublicationModel(
            title = detail.get("title") or "(Untitled ORCID work)",
            abstract = detail.get("short_description"),
            publication_type = publication_type,
            venue = detail.get("journal_title"),
            year = int(detail["year"]) if detail.get("year") else None,
            authors = detail.get("authors"),
            doi = detail.get("doi"),
            orcid_put_code = str(put_code),
            source = ProductSource.ORCID,
            status = VerificationStatus.VERIFIED,
            is_public = True,
            owner_id = current_user.id
        )
        db.add(publication)
        created.append(publication)

    db.commit()
    for publication in created:
        db.refresh(publication)

    return created
