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

    # Database Settings (MySQL 8, utf8mb4). La URL real va en .env; este valor
    # por defecto apunta al contenedor MySQL de docker-compose.yml.
    DATABASE_URL: str = "mysql+pymysql://simapci:simapci@localhost:3306/simapci?charset=utf8mb4"
    # Imprime el SQL generado en consola (solo para depurar en local)
    DATABASE_ECHO: bool = False

    # External integrations (T-HU03-02, PGPCECMC-33)
    CROSSREF_API_URL: str = "https://api.crossref.org"
    OPENALEX_API_URL: str = "https://api.openalex.org"
    ORCID_API_URL: str = "https://pub.orcid.org/v3.0"
    # Correo de contacto para el "polite pool" de Crossref y OpenAlex (atienden
    # más rápido y con menos bloqueos a quien se identifica). Opcional.
    INTEGRATIONS_CONTACT_EMAIL: str = ""
    # Tiempo máximo de espera por servicio externo, en segundos
    INTEGRATIONS_TIMEOUT_SECONDS: float = 5.0

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

    COOKIE_SECURE: bool

    # Tell Pydantic to load variables from a local .env file if present
    model_config = SettingsConfigDict(
        env_file = ".env",
        env_file_encoding = "utf-8",
        extra = "ignore"
    )

settings = Settings()
