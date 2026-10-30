"""
File: config.py
Author: Demian Viteri
Description: Application Settings: app name, secret key, api-cors config, ldap config, variable-loading from .env file.
"""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "Institutional Auth API"
    SECRET_KEY: str # Used to sign JWTs (keep this secret!)
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int # 8 hours session lifetime

    # Accepts a list of origins (e.g., http://localhost:5173 for Vite)
    BACKEND_CORS_ORIGINS: list[str] = Field(
        default=["http://localhost:5173", "http://localhost:3000"]
    )

    # LDAP Connection Settings
    LDAP_SERVER_URI: str # e.g., ldaps://ldap.institution.edu:636
    
    # Service Account (Used by the backend to search for users/groups)
    LDAP_BIND_DN: str # e.g., cn=admin,dc=institution,dc=edu
    LDAP_BIND_PASSWORD: str

    # Directory Structure
    LDAP_USER_BASE_DN: str # e.g., ou=people,dc=institution,dc=edu
    LDAP_GROUP_BASE_DN: str # e.g., ou=groups,dc=institution,dc=edu
    
    # Authorization Filter for Professors
    LDAP_PROFESSOR_GROUP_CN: str # Common Name of the professor group

    # Tell Pydantic to load variables from a local .env file if present
    model_config = SettingsConfigDict(
        env_file = ".env",
        env_file_encoding = "utf-8",
        extra = "ignore"
    )

settings = Settings()
