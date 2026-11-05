"""
File: user_store.py
Description: In-memory registry of registered professors. Only the password hash is kept, never the plain password.
Data is lost on restart; replace with a persistent repository before production use.
"""

from threading import Lock

class DuplicateUserError(Exception):
    """Raised when an account with the same email already exists."""

_users: dict[str, dict] = {}
_lock = Lock()

def create_user(email: str, full_name: str, school: str, password_hash: str) -> dict:
    with _lock:
        if email in _users:
            raise DuplicateUserError(email)
        _users[email] = {
            "email": email,
            "full_name": full_name,
            "school": school,
            "password_hash": password_hash
        }
        return _users[email]

def get_user(email: str) -> dict | None:
    with _lock:
        return _users.get(email)

def reset() -> None:
    """Clears the store (used by tests)."""

    with _lock:
        _users.clear()
