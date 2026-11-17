"""
File: ldap_service.py
Author: Demian Viteri
Description: LDAP logic: connection, authentication, group membership verification.
"""

import logging

from app.core.config import settings
from fastapi import HTTPException, status
from ldap3 import Server, Connection, ALL, SUBTREE
from ldap3.core.exceptions import LDAPException, LDAPSocketOpenError
from ldap3.utils.conv import escape_filter_chars

logger = logging.getLogger(__name__)

# Único mensaje que ve el cliente cuando el directorio falla (CA05: no revelar detalles
# internos). El detalle técnico queda solo en el log del servidor (PGPCECMC-22).
DIRECTORY_UNAVAILABLE = "Institutional directory service is temporarily unreachable. Please try again later."


def _directory_unavailable() -> HTTPException:
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=DIRECTORY_UNAVAILABLE)


class LDAPService:
    @staticmethod
    def _get_service_connection() -> Connection:
        """Creates an LDAP connection using the backend service account for directory searches."""

        try:
            server = Server(settings.LDAP_SERVER_URI, 
                            get_info = ALL, 
                            connect_timeout = 5
            )
            conn = Connection(
                server,
                user=settings.LDAP_BIND_DN,
                password=settings.LDAP_BIND_PASSWORD.get_secret_value(),
                auto_bind=True
            )

            return conn
        except LDAPSocketOpenError:
            # Server is down, unreachable, or timed out
            logger.warning("LDAP directory unreachable", exc_info=True)
            raise _directory_unavailable()
        except Exception:
            # Otros errores de configuración o del directorio: el detalle va al log, nunca a la respuesta
            logger.exception("LDAP connection initialization failed")
            raise _directory_unavailable()

    @classmethod
    def authenticate_and_authorize_professor(cls, username: str, password: str) -> dict | None:
        """
        Authenticates a user against LDAP and verifies they belong to the professor group.
        Returns user details dictionary if successful, or None/raises an error if it fails.
        """

        # Reject blank credentials up front: an empty password turns into an anonymous
        # (unauthenticated) LDAP bind, which many servers accept as "success".
        if not username or not username.strip() or not password:
            return None

        try:
            # Step 1: Search for the user using the service account
            with cls._get_service_connection() as conn:
                # Common filters: (uid={username}) for OpenLDAP or (sAMAccountName={username}) for Active Directory
                # The username is escaped so characters like * ( ) \ cannot alter the filter (LDAP injection).
                search_filter = f"(uid={escape_filter_chars(username)})"
                
                conn.search(
                    search_base = settings.LDAP_USER_BASE_DN,
                    search_filter = search_filter,
                    search_scope = SUBTREE,
                    attributes = ['cn', 'mail', 'uid', 'memberOf']
                )

                if not conn.entries:
                    return None # User not found

                user_entry = conn.entries[0]
                user_dn = user_entry.entry_dn

            # Step 2: Attempt to bind with the user's own credentials (Authentication)
            # This verifies the password is correct without storing or seeing it.
            try:
                server = Server(settings.LDAP_SERVER_URI, 
                                get_info = ALL,
                                connect_timeout = 5
                )
                user_conn = Connection(server, user = user_dn, password = password)
            
                if not user_conn.bind():
                    return None # Invalid password
            except LDAPSocketOpenError:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Institutional directory service is temporarily unreachable."
                )

            # Step 3: Authorization Check (Verify Professor Group Membership)
            # Depending on the LDAP schema, membership is checked via 'memberOf' attribute 
            # or by querying the group container directly.
            is_professor = cls._verify_professor_membership(user_dn, user_entry)
            
            if not is_professor:
                return None # User is authenticated, but not authorized as a professor

            # Return basic user payload for session creation
            return {
                # El uid que entrega el directorio, no el texto que escribió el usuario
                "username": str(user_entry.uid) if hasattr(user_entry, 'uid') else username,
                "full_name": str(user_entry.cn) if hasattr(user_entry, 'cn') else username,
                "email": str(user_entry.mail) if hasattr(user_entry, 'mail') else None,
                "dn": user_dn
            }

        except LDAPException:
            # Error del directorio en la búsqueda o el bind: 503 genérico, el detalle solo en el log
            logger.exception("LDAP directory error")
            raise _directory_unavailable()

    @classmethod
    def _verify_professor_membership(cls, user_dn: str, user_entry) -> bool:
        """Checks if the user belongs to the designated professor group."""
        
        # Method A: Check 'memberOf' attribute if supported by the directory schema
        if hasattr(user_entry, 'memberOf') and user_entry.memberOf:
            group_identifier = settings.LDAP_PROFESSOR_GROUP_CN.lower()
            for group in user_entry.memberOf:
                if group_identifier in str(group).lower():
                    return True

        # Method B: Fallback / explicit group search query if memberOf is missing
        try:
            with cls._get_service_connection() as conn:
                # Search for the group object and check if the user is listed in its members
                group_filter = f"(&(objectClass=group)(cn={escape_filter_chars(settings.LDAP_PROFESSOR_GROUP_CN)})(member={escape_filter_chars(user_dn)}))"
                conn.search(
                    search_base = settings.LDAP_GROUP_BASE_DN,
                    search_filter = group_filter,
                    search_scope = SUBTREE
                )
                if len(conn.entries) > 0:
                    return True
        except Exception:
            pass

        return False
