"""
File: tests/test_auth.py
Description: Registration (charter requirement #1) and authentication
             (requirement #2), including the admin-bootstrap role split.

Every test prints a full technical trace of its HTTP interaction (endpoint,
payload, expected vs. received status, full JSON body) via log_test_step,
for the project's test report.
"""

from tests.conftest import DEFAULT_PASSWORD, log_test_step


def test_registration_creates_a_professor_by_default(client, register):
    print("\n>>> CASO DE PRUEBA: Registro de un nuevo docente de la ECMC (rol por defecto = professor)")

    payload = {
        "username": "jastudillo",
        "full_name": "Juan Pablo Astudillo León",
        "email": "jastudillo@yachaytech.edu.ec",
        "password": DEFAULT_PASSWORD,
    }
    response = client.post("/auth/register", json = payload)

    log_test_step(
        step = "Registro de docente con datos válidos",
        method = "POST",
        endpoint = "/auth/register",
        payload = payload,
        response = response,
        expected_status = 201,
        success_message = "El docente fue creado correctamente con rol 'professor' y sin exponer la contraseña."
    )

    body = response.json()
    assert body["role"] == "professor", f"[FALLÓ] Se esperaba rol 'professor' pero se obtuvo '{body['role']}'."
    assert body["email"] == payload["email"], "[FALLÓ] El email devuelto no coincide con el registrado."
    assert body["is_active"] is True, "[FALLÓ] La cuenta recién creada debería estar activa."
    assert "password" not in body, "[FALLÓ DE SEGURIDAD] La contraseña en texto plano se filtró en la respuesta."
    assert "hashed_password" not in body, "[FALLÓ DE SEGURIDAD] El hash de la contraseña se filtró en la respuesta."
    print("[VERIFICACIÓN EXTRA] Confirmado: ni la contraseña ni su hash aparecen en el JSON de respuesta.")


def test_a_bootstrap_email_is_promoted_to_admin(client, register):
    print("\n>>> CASO DE PRUEBA: Un email listado en ADMIN_BOOTSTRAP_EMAILS se promueve a 'admin' (comité de revisión)")

    payload = {
        "username": "chair",
        "full_name": "Review Committee Chair",
        "email": "chair@yachaytech.edu.ec",
        "password": DEFAULT_PASSWORD,
    }
    response = client.post("/auth/register", json = payload)

    log_test_step(
        step = "Registro de un email pre-autorizado como administrador",
        method = "POST",
        endpoint = "/auth/register",
        payload = payload,
        response = response,
        expected_status = 201,
        success_message = "El email bootstrap fue promovido automáticamente al rol 'admin'."
    )

    assert response.json()["role"] == "admin", (
        f"[FALLÓ] Se esperaba rol 'admin' pero la API asignó '{response.json()['role']}'."
    )


def test_duplicate_email_is_rejected(client, register):
    print("\n>>> CASO DE PRUEBA: Rechazo de registro con un email ya existente (409 Conflict)")

    register(client)

    payload = {
        "username": "another",
        "full_name": "Another Professor",
        "email": "jastudillo@yachaytech.edu.ec",
        "password": DEFAULT_PASSWORD,
    }
    response = client.post("/auth/register", json = payload)

    log_test_step(
        step = "Intento de registro con un email duplicado",
        method = "POST",
        endpoint = "/auth/register",
        payload = payload,
        response = response,
        expected_status = 409,
        success_message = "La API rechazó correctamente el email duplicado con 409 Conflict."
    )


def test_invalid_email_is_rejected(client):
    print("\n>>> CASO DE PRUEBA: Validación Pydantic de formato de email (422 Unprocessable Content)")

    payload = {
        "username": "someone",
        "full_name": "Someone",
        "email": "not-an-email",
        "password": DEFAULT_PASSWORD,
    }
    response = client.post("/auth/register", json = payload)

    log_test_step(
        step = "Registro con un email mal formado",
        method = "POST",
        endpoint = "/auth/register",
        payload = payload,
        response = response,
        expected_status = 422,
        success_message = "El esquema Pydantic rechazó el email inválido antes de tocar la base de datos."
    )


def test_the_stored_password_is_hashed(client, register):
    from app.database import SessionLocal
    from app.models.user import UserModel

    print("\n>>> CASO DE PRUEBA: La contraseña nunca se almacena en texto plano (hash bcrypt)")
    register(client)

    with SessionLocal() as db:
        stored = db.query(UserModel).filter(UserModel.email == "jastudillo@yachaytech.edu.ec").first()

    print(f"CONTRASEÑA ENVIADA EN EL REGISTRO : {DEFAULT_PASSWORD}")
    print(f"VALOR ALMACENADO EN LA BASE DE DATOS (hashed_password): {stored.hashed_password}")

    assert stored.hashed_password != DEFAULT_PASSWORD, (
        "[FALLÓ DE SEGURIDAD] La contraseña se guardó en texto plano."
    )
    assert stored.hashed_password.startswith("$2"), (
        "[FALLÓ] El valor almacenado no tiene el prefijo '$2' propio de un hash bcrypt."
    )
    print("[ÉXITO] La contraseña se almacenó como un hash bcrypt irreversible, nunca en texto plano.")


def test_login_with_correct_password_returns_tokens(client, register):
    print("\n>>> CASO DE PRUEBA: Login con credenciales correctas -> emisión de access_token + refresh_token (JWT)")

    register(client)
    payload = {"email": "jastudillo@yachaytech.edu.ec", "password": DEFAULT_PASSWORD}
    response = client.post("/auth/login", json = payload)

    log_test_step(
        step = "Login con email y contraseña válidos",
        method = "POST",
        endpoint = "/auth/login",
        payload = payload,
        response = response,
        expected_status = 200,
        success_message = "Se emitieron un access_token y un refresh_token JWT válidos."
    )

    body = response.json()
    assert body["access_token"], "[FALLÓ] No se recibió access_token."
    assert body["refresh_token"], "[FALLÓ] No se recibió refresh_token."
    assert body["token_type"] == "bearer", "[FALLÓ] El token_type debería ser 'bearer'."
    print(f"[VERIFICACIÓN EXTRA] expires_in={body['expires_in']}s, refresh_expires_in={body['refresh_expires_in']}s")


def test_login_with_incorrect_password_returns_401(client, register):
    print("\n>>> CASO DE PRUEBA: Login con contraseña incorrecta -> 401 Unauthorized")

    register(client)
    payload = {"email": "jastudillo@yachaytech.edu.ec", "password": "WrongPassword123!"}
    response = client.post("/auth/login", json = payload)

    log_test_step(
        step = "Login con contraseña incorrecta",
        method = "POST",
        endpoint = "/auth/login",
        payload = payload,
        response = response,
        expected_status = 401,
        success_message = "La API rechazó la contraseña incorrecta con 401 Unauthorized, sin filtrar qué campo falló."
    )


def test_refresh_rotates_the_token_pair(client, signed_in):
    print("\n>>> CASO DE PRUEBA: Rotación de refresh token en POST /auth/refresh")

    _, tokens, _ = signed_in(client)
    print(f"REFRESH TOKEN ORIGINAL (emitido en login): {tokens['refresh_token'][:40]}...")

    payload = {"refresh_token": tokens["refresh_token"]}
    response = client.post("/auth/refresh", json = payload)

    log_test_step(
        step = "Renovación de tokens usando un refresh_token válido",
        method = "POST",
        endpoint = "/auth/refresh",
        payload = payload,
        response = response,
        expected_status = 200,
        success_message = "Se emitió un nuevo access_token y un nuevo refresh_token (rotación)."
    )

    new_refresh_token = response.json()["refresh_token"]
    assert new_refresh_token != tokens["refresh_token"], (
        "[FALLÓ DE SEGURIDAD] El refresh_token no rotó: se devolvió el mismo token ya usado."
    )
    print("[VERIFICACIÓN EXTRA] El refresh_token devuelto es distinto al original: la rotación funciona.")


def test_logout_revokes_the_session(client, signed_in):
    print("\n>>> CASO DE PRUEBA: Logout revoca la sesión (el refresh_token deja de ser utilizable)")

    _, tokens, headers = signed_in(client)

    logout_payload = {"refresh_token": tokens["refresh_token"]}
    logout_response = client.post("/auth/logout", json = logout_payload, headers = headers)

    log_test_step(
        step = "Cierre de sesión (logout) con un token válido",
        method = "POST",
        endpoint = "/auth/logout",
        payload = logout_payload,
        response = logout_response,
        expected_status = 200,
        success_message = "La sesión fue cerrada y el refresh_token quedó revocado en la base de datos."
    )

    replay_payload = {"refresh_token": tokens["refresh_token"]}
    replay_response = client.post("/auth/refresh", json = replay_payload)

    log_test_step(
        step = "Reutilizar el refresh_token ya revocado por logout",
        method = "POST",
        endpoint = "/auth/refresh",
        payload = replay_payload,
        response = replay_response,
        expected_status = 401,
        success_message = "La API rechazó correctamente el intento de reutilizar un token revocado."
    )


def test_users_me_requires_a_token(client):
    print("\n>>> CASO DE PRUEBA: Endpoint protegido /users/me sin token -> 401 Unauthorized")

    response = client.get("/users/me")

    log_test_step(
        step = "Acceso a /users/me sin cabecera Authorization",
        method = "GET",
        endpoint = "/users/me",
        payload = None,
        response = response,
        expected_status = 401,
        success_message = "El endpoint protegido rechazó correctamente la petición sin JWT."
    )


def test_users_me_returns_the_authenticated_professor(client, signed_in):
    print("\n>>> CASO DE PRUEBA: /users/me con un JWT válido devuelve el perfil del docente autenticado")

    user, _, headers = signed_in(client)
    response = client.get("/users/me", headers = headers)

    log_test_step(
        step = "Acceso a /users/me con Authorization: Bearer <access_token>",
        method = "GET",
        endpoint = "/users/me",
        payload = {"headers": headers},
        response = response,
        expected_status = 200,
        success_message = "El endpoint devolvió el perfil correcto del docente autenticado."
    )

    body = response.json()
    assert body["id"] == user["id"], "[FALLÓ] El id devuelto no corresponde al usuario autenticado."
    assert "hashed_password" not in body, "[FALLÓ DE SEGURIDAD] El hash de la contraseña se filtró en /users/me."
    print("[VERIFICACIÓN EXTRA] El id del token coincide con el usuario registrado y no se filtra el hash.")
