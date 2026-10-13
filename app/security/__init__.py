"""
File: security/__init__.py
Description: Re-exports the authentication helpers used by the routers.
"""

from app.security.dependencies import (
    get_current_active_user,
    get_current_user,
    oauth2_scheme,
    require_admin,
)
from app.security.jwt import (
    ACCESS_TOKEN_TYPE,
    REFRESH_TOKEN_TYPE,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.security.sessions import (
    SessionError,
    issue_token_pair,
    revoke_all_sessions,
    revoke_session,
    rotate_token_pair,
)

__all__ = [
    "ACCESS_TOKEN_TYPE", "REFRESH_TOKEN_TYPE", "SessionError",
    "create_access_token", "create_refresh_token", "decode_token",
    "get_current_active_user", "get_current_user", "require_admin",
    "hash_password", "issue_token_pair", "oauth2_scheme",
    "revoke_all_sessions", "revoke_session", "rotate_token_pair", "verify_password",
]
