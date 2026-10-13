"""
File: config.py
Description: Centralised application settings loaded from environment
             variables, covering every integration required by the RED
             PAPERS charter (database, JWT, ORCID, Crossref/OpenAlex).
"""

from functools import cached_property
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Every configurable value of RED PAPERS / SIMAPCI YT."""

    # --- Application metadata --------------------------------------------
    APP_NAME: str = "RED PAPERS API"
    API_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # --- Database credentials (MySQL/MariaDB or PostgreSQL) ---------------
    DB_USER: str = ""
    DB_PASSWORD: str = ""
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_NAME: str = ""

    # A full SQLAlchemy URL overrides the DB_* values above. Handy for the
    # test-suite (sqlite) or for a managed Postgres instance.
    DATABASE_URL: str | None = None

    # --- JSON Web Tokens ----------------------------------------------------
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    REMEMBER_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # --- ORCID (academic identity provider, replaces generic social login) --
    # Sandbox during development: https://sandbox.orcid.org
    # Production: https://orcid.org
    ORCID_ENVIRONMENT: str = "sandbox"
    ORCID_CLIENT_ID: str | None = None
    ORCID_CLIENT_SECRET: str | None = None

    # --- Bibliometric pipeline (Crossref / OpenAlex) -------------------------
    # Both APIs grant a faster "polite pool" when a contact email is supplied.
    CROSSREF_CONTACT_EMAIL: str | None = None
    OPENALEX_CONTACT_EMAIL: str | None = None

    # --- Governance ---------------------------------------------------------
    # Comma separated emails that are promoted to the ADMIN role (members of
    # the review committee / "consejo de revisión") the moment they register.
    # There is no self-service way to become an admin otherwise.
    ADMIN_BOOTSTRAP_EMAILS: str = ""

    # --- CORS ----------------------------------------------------------------
    CORS_ORIGINS: str = "*"

    model_config = SettingsConfigDict(
        env_file = ".env",
        env_file_encoding = "utf-8",
        extra = "ignore"
    )

    @cached_property
    def sqlalchemy_url(self) -> str:
        """Return the SQLAlchemy URL, preferring an explicit DATABASE_URL."""
        if self.DATABASE_URL:
            return self.DATABASE_URL

        if not self.DB_USER or not self.DB_NAME:
            raise RuntimeError(
                "Database is not configured: set DATABASE_URL, or DB_USER/DB_NAME "
                "(and the remaining DB_* variables) in your .env file."
            )

        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    @cached_property
    def cors_origin_list(self) -> list[str]:
        """Split CORS_ORIGINS into the list expected by CORSMiddleware."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @cached_property
    def admin_bootstrap_email_set(self) -> set[str]:
        """Lower-cased set of emails that are auto-promoted to ADMIN at registration."""
        return {
            email.strip().lower()
            for email in self.ADMIN_BOOTSTRAP_EMAILS.split(",")
            if email.strip()
        }

    @property
    def orcid_is_configured(self) -> bool:
        return bool(self.ORCID_CLIENT_ID and self.ORCID_CLIENT_SECRET)

    @property
    def orcid_api_base_url(self) -> str:
        """Public read API base (no auth needed) for a given environment."""
        return (
            "https://pub.sandbox.orcid.org/v3.0"
            if self.ORCID_ENVIRONMENT == "sandbox"
            else "https://pub.orcid.org/v3.0"
        )

    @property
    def orcid_oauth_base_url(self) -> str:
        """Base used for the authorization-code OAuth 2.0 dance."""
        return (
            "https://sandbox.orcid.org"
            if self.ORCID_ENVIRONMENT == "sandbox"
            else "https://orcid.org"
        )


settings = Settings()
