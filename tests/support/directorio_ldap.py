"""
Directorio LDAP simulado para las pruebas del Sprint 1 (Camilo Vásquez, tester).

A diferencia de las pruebas existentes, que reemplazan TODO
LDAPService.authenticate_and_authorize_professor, este doble deja correr el código
real de LDAPService (filtro de búsqueda, bind del usuario y verificación del grupo de
profesores) contra un directorio en memoria de ldap3 (estrategia MOCK_SYNC).
Así las pruebas de aceptación cubren también la integración con el directorio.

Uso en una prueba:
    from tests.support.directorio_ldap import instalar_directorio, PROFESOR
    instalar_directorio(monkeypatch)
"""

from ldap3 import MOCK_SYNC, OFFLINE_SLAPD_2_4, Connection, Server
from ldap3.core.exceptions import LDAPSocketOpenError

from app.core.config import settings
from app.services import ldap_service

# Configuración propia del directorio simulado. Se fija aquí (y se aplica con
# monkeypatch) para no depender de las variables de entorno: por ejemplo, el CI
# define LDAP_BIND_DN="cn:admin,..." (con ':'), que no es un DN válido.
CONFIG_DIRECTORIO = {
    "LDAP_BIND_DN": "cn=admin,dc=yachaytech,dc=edu,dc=ec",
    "LDAP_BIND_PASSWORD": "clave-cuenta-de-servicio",
    "LDAP_USER_BASE_DN": "ou=people,dc=yachaytech,dc=edu,dc=ec",
    "LDAP_GROUP_BASE_DN": "ou=groups,dc=yachaytech,dc=edu,dc=ec",
    "LDAP_PROFESSOR_GROUP_CN": "professors",
}

GRUPO_PROFESORES = "cn=professors,ou=groups,dc=yachaytech,dc=edu,dc=ec"
GRUPO_ESTUDIANTES = "cn=students,ou=groups,dc=yachaytech,dc=edu,dc=ec"

PROFESOR = {
    "uid": "mgarcia",
    "password": "Clave-Prof-2026!",
    "cn": "María García",
    "mail": "mgarcia@yachaytech.edu.ec",
    "groups": [GRUPO_PROFESORES],
}
OTRO_PROFESOR = {
    "uid": "jperez",
    "password": "Otra-Clave-2026!",
    "cn": "Juan Pérez",
    "mail": "jperez@yachaytech.edu.ec",
    "groups": [GRUPO_PROFESORES],
}
ESTUDIANTE = {
    "uid": "lestudiante",
    "password": "Clave-Est-2026!",
    "cn": "Luis Estudiante",
    "mail": "lestudiante@yachaytech.edu.ec",
    "groups": [GRUPO_ESTUDIANTES],
}

USUARIOS_POR_DEFECTO = (PROFESOR, OTRO_PROFESOR, ESTUDIANTE)


def dn_de(usuario: dict) -> str:
    return f"uid={usuario['uid']},{CONFIG_DIRECTORIO['LDAP_USER_BASE_DN']}"


def instalar_directorio(monkeypatch, usuarios=USUARIOS_POR_DEFECTO) -> Server:
    """Hace que LDAPService hable con un directorio en memoria con estos usuarios."""

    for clave, valor in CONFIG_DIRECTORIO.items():
        monkeypatch.setattr(settings, clave, valor)

    servidor = Server("directorio-simulado", get_info=OFFLINE_SLAPD_2_4)
    carga = Connection(
        servidor,
        user=settings.LDAP_BIND_DN,
        password=settings.LDAP_BIND_PASSWORD,
        client_strategy=MOCK_SYNC,
    )
    # Cuenta de servicio con la que el backend busca usuarios (paso 1 del login)
    carga.strategy.add_entry(
        settings.LDAP_BIND_DN, {"userPassword": settings.LDAP_BIND_PASSWORD, "sn": "admin"}
    )
    for usuario in usuarios:
        carga.strategy.add_entry(
            dn_de(usuario),
            {
                "objectClass": ["inetOrgPerson"],
                "uid": usuario["uid"],
                "cn": usuario["cn"],
                "sn": usuario["cn"].split()[-1],
                "mail": usuario["mail"],
                "userPassword": usuario["password"],
                "memberOf": usuario["groups"],
            },
        )

    def server_simulado(*_args, **_kwargs):
        return servidor

    def connection_simulada(server, **kwargs):
        return Connection(server, client_strategy=MOCK_SYNC, **kwargs)

    monkeypatch.setattr(ldap_service, "Server", server_simulado)
    monkeypatch.setattr(ldap_service, "Connection", connection_simulada)
    return servidor


def directorio_caido(monkeypatch) -> None:
    """Simula que el servidor LDAP no responde (caída o tiempo de espera agotado)."""

    def connection_caida(*_args, **_kwargs):
        raise LDAPSocketOpenError("socket connection error while opening: timed out")

    monkeypatch.setattr(ldap_service, "Connection", connection_caida)
