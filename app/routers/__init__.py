"""
File: routers/__init__.py
Description: Re-exports every router so main.py can mount them in one place.
"""

from app.routers import auth, notifications, orcid, projects, public, publications, review, users

__all__ = [
    "auth", "notifications", "orcid", "projects", "public", "publications", "review", "users",
]
