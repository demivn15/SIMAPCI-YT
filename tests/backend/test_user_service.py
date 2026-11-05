"""
Pruebas unitarias de T-HU01-03 (PGPCECMC-20): servicio de creación de cuenta y
control de duplicados. Llaman al servicio directamente, sin pasar por HTTP.
"""

import pytest

from app.models.user import User
from app.services.user_service import (
    EmailAlreadyRegisteredError,
    InactiveAccountError,
    IncompleteIdentityError,
    LdapIdentity,
    UserService,
)

PROFESSOR = LdapIdentity(
    username="professor",
    full_name="Hubert Farnsworth",
    email="professor@planetexpress.com",
)


# --- CA01: se crea la cuenta en el primer acceso ------------------------------

def test_first_login_creates_account(db_session):
    result = UserService.provision_from_ldap(db_session, PROFESSOR)

    assert result.created is True
    assert result.user.username == "professor"
    assert result.user.email == "professor@planetexpress.com"
    assert result.user.role == "professor"
    assert result.user.last_login_at is not None
    assert db_session.query(User).count() == 1


def test_identity_is_normalized_before_saving(db_session):
    identity = LdapIdentity(username=" Professor ", full_name="Hubert", email="Professor@PlanetExpress.com")
    result = UserService.provision_from_ldap(db_session, identity)

    assert result.user.username == "professor"
    assert result.user.email == "professor@planetexpress.com"


def test_missing_full_name_falls_back_to_username(db_session):
    identity = LdapIdentity(username="professor", full_name="  ", email="professor@planetexpress.com")
    assert UserService.provision_from_ldap(db_session, identity).user.full_name == "professor"


# --- CA02: no se duplican datos -----------------------------------------------

def test_second_login_reuses_account_without_duplicating(db_session):
    first = UserService.provision_from_ldap(db_session, PROFESSOR)
    second = UserService.provision_from_ldap(db_session, PROFESSOR)

    assert second.created is False
    assert second.user.id == first.user.id
    assert db_session.query(User).count() == 1


def test_username_with_different_case_is_the_same_account(db_session):
    UserService.provision_from_ldap(db_session, PROFESSOR)
    again = LdapIdentity(username="PROFESSOR", full_name="Hubert Farnsworth", email="professor@planetexpress.com")

    assert UserService.provision_from_ldap(db_session, again).created is False
    assert db_session.query(User).count() == 1


def test_email_owned_by_another_account_is_rejected(db_session):
    UserService.provision_from_ldap(db_session, PROFESSOR)
    impostor = LdapIdentity(username="otro", full_name="Otro", email="PROFESSOR@planetexpress.com")

    with pytest.raises(EmailAlreadyRegisteredError):
        UserService.provision_from_ldap(db_session, impostor)
    assert db_session.query(User).count() == 1


def test_changed_name_and_email_in_ldap_are_synchronized(db_session):
    UserService.provision_from_ldap(db_session, PROFESSOR)
    updated = LdapIdentity(username="professor", full_name="Prof. Farnsworth", email="farnsworth@planetexpress.com")

    user = UserService.provision_from_ldap(db_session, updated).user
    assert user.full_name == "Prof. Farnsworth"
    assert user.email == "farnsworth@planetexpress.com"


def test_email_change_to_an_email_already_taken_is_rejected(db_session):
    UserService.provision_from_ldap(db_session, PROFESSOR)
    UserService.provision_from_ldap(
        db_session, LdapIdentity(username="hermes", full_name="Hermes", email="hermes@planetexpress.com")
    )
    takeover = LdapIdentity(username="professor", full_name="Hubert", email="hermes@planetexpress.com")

    with pytest.raises(EmailAlreadyRegisteredError):
        UserService.provision_from_ldap(db_session, takeover)


# --- Casos de error -----------------------------------------------------------

def test_missing_email_is_rejected(db_session):
    with pytest.raises(IncompleteIdentityError):
        UserService.provision_from_ldap(db_session, LdapIdentity(username="professor", full_name="H", email=None))
    assert db_session.query(User).count() == 0


def test_inactive_account_cannot_log_in(db_session):
    user = UserService.provision_from_ldap(db_session, PROFESSOR).user
    user.is_active = False
    db_session.commit()

    with pytest.raises(InactiveAccountError):
        UserService.provision_from_ldap(db_session, PROFESSOR)


def test_existing_reviewer_keeps_reviewer_role(db_session):
    # Los Revisores se asignan por script; iniciar sesión no debe degradarlos a professor
    db_session.add(User(username="professor", email="professor@planetexpress.com", full_name="H", role="reviewer"))
    db_session.commit()

    assert UserService.provision_from_ldap(db_session, PROFESSOR).user.role == "reviewer"


def test_concurrent_first_login_recovers_existing_account(db_session, monkeypatch):
    """Simula dos primeros accesos simultáneos: cuando esta petición busca al
    usuario aún no existe, pero otra lo crea antes del INSERT. El índice único
    rechaza el duplicado y el servicio devuelve la cuenta ya creada."""
    original = UserService.provision_from_ldap(db_session, PROFESSOR).user

    real_get_by_username = UserService.get_by_username
    calls = {"n": 0}

    def get_by_username_stale_first(db, username):
        calls["n"] += 1
        return None if calls["n"] == 1 else real_get_by_username(db, username)

    monkeypatch.setattr(UserService, "get_by_username", staticmethod(get_by_username_stale_first))
    # La comprobación previa de correo tampoco lo ve todavía
    monkeypatch.setattr(UserService, "get_by_email", staticmethod(lambda db, email: None))

    result = UserService.provision_from_ldap(db_session, PROFESSOR)
    assert result.created is False
    assert result.user.id == original.id
    assert db_session.query(User).count() == 1
