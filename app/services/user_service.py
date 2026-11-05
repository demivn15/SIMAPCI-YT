"""
File: user_service.py
Author: Jhony Alfonso Peñaherrera
Description: Servicio de creación de cuenta y control de duplicados - T-HU01-03 (PGPCECMC-20).

Con LDAP, "registrarse" ya no significa crear usuario y contraseña: la identidad
y la contraseña las valida el directorio institucional. Este servicio crea el
perfil del profesor en nuestra BD la primera vez que inicia sesión
("aprovisionamiento en el primer acceso") y, en los accesos siguientes,
reutiliza el mismo registro sin duplicarlo.

El servicio no conoce HTTP: lanza excepciones de dominio y es el endpoint el que
las traduce a códigos de estado. Así se puede probar sin levantar la API.
"""

from dataclasses import dataclass
from datetime import datetime, timezone

from app.models.user import AUTH_PROVIDER_LDAP, User
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


# --- Datos de entrada y salida ------------------------------------------------

@dataclass(frozen=True)
class LdapIdentity:
    """Identidad que devuelve LDAPService tras autenticar al usuario."""

    username: str
    full_name: str
    email: str | None


@dataclass(frozen=True)
class ProvisioningResult:
    user: User
    created: bool  # True solo en el primer acceso (permite mostrar la confirmación de CA01)


# --- Errores de dominio -------------------------------------------------------

class AccountProvisioningError(Exception):
    """Error base del aprovisionamiento de cuentas."""


class IncompleteIdentityError(AccountProvisioningError):
    """LDAP no entregó un dato obligatorio (por ejemplo, el correo)."""


class EmailAlreadyRegisteredError(AccountProvisioningError):
    """El correo ya pertenece a otra cuenta (CA02: no se duplican datos)."""


class InactiveAccountError(AccountProvisioningError):
    """La cuenta existe pero fue desactivada."""


# --- Servicio -----------------------------------------------------------------

def _utcnow() -> datetime:
    # DATETIME de MySQL no guarda zona horaria: se almacena UTC sin tzinfo
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _normalize(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip().lower()
    return value or None


class UserService:

    @staticmethod
    def get_by_username(db: Session, username: str) -> User | None:
        return db.scalar(select(User).where(User.username == _normalize(username)))

    @staticmethod
    def get_by_email(db: Session, email: str) -> User | None:
        return db.scalar(select(User).where(User.email == _normalize(email)))

    @classmethod
    def provision_from_ldap(cls, db: Session, identity: LdapIdentity) -> ProvisioningResult:
        """Devuelve la cuenta del usuario autenticado, creándola si es su primer acceso.

        Reglas:
        1. El usuario se reconoce por su username de LDAP (uid), que no cambia.
        2. Si ya existe: se actualiza last_login_at y se sincronizan nombre y correo.
        3. Si no existe: se crea con rol "professor" y estado activo.
        4. Un correo nunca puede quedar en dos cuentas (CA02).
        """

        username = _normalize(identity.username)
        email = _normalize(identity.email)
        full_name = (identity.full_name or "").strip() or username

        if not username:
            raise IncompleteIdentityError("El directorio institucional no devolvió un nombre de usuario.")
        if not email:
            raise IncompleteIdentityError("El directorio institucional no devolvió un correo para este usuario.")

        existing = cls.get_by_username(db, username)
        if existing is not None:
            return ProvisioningResult(user=cls._sync_existing(db, existing, email, full_name), created=False)

        # Control de duplicados ANTES de insertar: así el error es claro y no
        # depende de interpretar el mensaje de la BD.
        if cls.get_by_email(db, email) is not None:
            raise EmailAlreadyRegisteredError("Ya existe una cuenta asociada a este correo institucional.")

        user = User(
            username=username,
            email=email,
            full_name=full_name,
            auth_provider=AUTH_PROVIDER_LDAP,
            last_login_at=_utcnow(),
        )
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            # Carrera: dos primeros accesos simultáneos del mismo profesor (p. ej.,
            # doble clic). El otro request ya creó la cuenta; el índice único lo
            # impidió aquí. Se recupera la existente en vez de fallar.
            db.rollback()
            existing = cls.get_by_username(db, username)
            if existing is None:
                # No fue el username: el correo lo tomó otra cuenta en ese instante
                raise EmailAlreadyRegisteredError("Ya existe una cuenta asociada a este correo institucional.")
            return ProvisioningResult(user=cls._sync_existing(db, existing, email, full_name), created=False)

        db.refresh(user)
        return ProvisioningResult(user=user, created=True)

    @classmethod
    def _sync_existing(cls, db: Session, user: User, email: str, full_name: str) -> User:
        if not user.is_active:
            raise InactiveAccountError("La cuenta está desactivada.")

        # Si el correo cambió en LDAP, solo se actualiza si nadie más lo usa
        if user.email != email:
            owner = cls.get_by_email(db, email)
            if owner is not None and owner.id != user.id:
                raise EmailAlreadyRegisteredError("Ya existe una cuenta asociada a este correo institucional.")
            user.email = email

        if full_name and user.full_name != full_name:
            user.full_name = full_name

        user.last_login_at = _utcnow()
        db.commit()
        db.refresh(user)
        return user
