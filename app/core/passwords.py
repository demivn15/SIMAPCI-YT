"""
File: passwords.py
Description: Password hashing (PBKDF2-HMAC-SHA256, random per-user salt) and constant-time verification. Plain passwords are never stored.
"""

import base64
import hashlib
import hmac
import secrets

SCHEME = "pbkdf2_sha256"
ITERATIONS = 600_000
SALT_BYTES = 16

def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")

def _derive(password: str, salt: bytes, iterations: int) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)

def hash_password(password: str) -> str:
    """Returns a self-describing hash: scheme$iterations$salt$digest."""

    salt = secrets.token_bytes(SALT_BYTES)
    digest = _derive(password, salt, ITERATIONS)
    return f"{SCHEME}${ITERATIONS}${_b64(salt)}${_b64(digest)}"

def verify_password(password: str, stored_hash: str) -> bool:
    """Checks a password against a stored hash. Malformed hashes never verify."""

    try:
        scheme, iterations, salt_b64, digest_b64 = stored_hash.split("$")
        if scheme != SCHEME:
            return False
        expected = base64.b64decode(digest_b64)
        actual = _derive(password, base64.b64decode(salt_b64), int(iterations))
    except (ValueError, TypeError):
        return False

    return hmac.compare_digest(actual, expected)
