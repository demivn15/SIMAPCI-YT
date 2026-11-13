"""
File: app/core/token_blocklist.py
Description: In-memory or database-backed token blocklist for tracking logged-out tokens.
"""
blacklisted_tokens: set[str] = set()


def add_to_blocklist(token: str) -> None:
    blacklisted_tokens.add(token)


def is_token_blacklisted(token: str) -> bool:
    return token in blacklisted_tokens

_blocklist = set() # or your existing token storage variable

def reset():
    """Clears the blocklist for testing purposes."""
    _blocklist.clear()
