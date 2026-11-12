"""
File: user.py
Author: Demian Viteri
Description: Expose login endpoint; receive user credentials, run them through LDAP service and, if valid, set secure token cookie.
"""

# app/models/user.py
AUTH_PROVIDER_LOCAL = "local"
AUTH_PROVIDER_LDAP = "ldap"

class User(Base):
    # ... existing fields ...
    auth_provider: Mapped[str] = mapped_column(String(20), nullable=False, default=AUTH_PROVIDER_LDAP)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True) # Only for local users
