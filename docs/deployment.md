# Despliegue de la API de login

## Intento: Render (plan gratuito)

`render.yaml` en la raíz define un servicio web (`uvicorn app.main:app`) con health check en `GET /`.
Para desplegarlo: Render → New → Blueprint → seleccionar este repositorio → completar las variables `LDAP_*`.

## Estado y limitaciones

- **No se completó el despliegue desde la terminal**: Render y Koyeb exigen una cuenta y autorizar el acceso al repositorio desde su web; eso no se puede automatizar sin las credenciales de la persona dueña de la cuenta.
- **El login depende de un servidor LDAP.** El LDAP de pruebas (`docker-compose.yml`, `rroemhild/test-openldap`) corre solo en local. Los planes gratuitos no incluyen un LDAP ni permiten levantar contenedores adicionales, así que en Render se desplegaría la API, pero `POST /api/v1/auth/login` devolvería error 5xx/503 hasta apuntar `LDAP_SERVER_URI` a un directorio accesible por internet.
- Lo que sí funciona sin LDAP: `GET /` (health check) y la validación de entrada (422).
- El plan gratuito de Render duerme el servicio tras inactividad (primer request lento) y `secure=False` en la cookie debe pasar a `True` al servir por HTTPS.
- El frontend estático ya se despliega en GitHub Pages con `.github/workflows/pages.yml`.

## Evidencia de CI

`docs/ci-evidence/` contiene los logs del run con fallo de lint (`ruff`) y del run con fallo de test (`pytest`); el PR #40 terminó en verde y se fusionó a `main`.
