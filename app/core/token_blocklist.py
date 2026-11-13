"""
File: token_blocklist.py
Description: In-memory registry of revoked JWT identifiers (jti). Entries are dropped once the token would have expired anyway.
Process-local: with several workers/instances or after a restart, revocations are lost; use a shared store (e.g. Redis) before scaling out.
"""

import time
from threading import Lock

_revoked: dict[str, float] = {}
_lock = Lock()

def revoke(jti: str, expires_at: float) -> None:
    """Marks a token as revoked until its natural expiration (unix timestamp)."""

    now = time.time()
    with _lock:
        for stale in [key for key, exp in _revoked.items() if exp <= now]:
            del _revoked[stale]
        _revoked[jti] = expires_at

def is_revoked(jti: str) -> bool:
    with _lock:
        return jti in _revoked

def reset() -> None:
    """Clears the registry (used by tests)."""

    with _lock:
        _revoked.clear()
