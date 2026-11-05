/**
 * Mensajes de error del inicio de sesión - T-HU02-01 (PGPCECMC-25), criterio CA05.
 *
 * La pantalla NO muestra el texto que devuelve el backend: traduce el código HTTP
 * a un mensaje propio. Así no se revelan detalles internos (el backend responde,
 * por ejemplo, "unauthorized user role (Professors only)"), todos los mensajes
 * quedan en español y la pantalla no depende de cómo redacte el backend sus errores.
 */

export const LOGIN_ERROR_MESSAGES = {
  invalidCredentials: 'Usuario o contraseña incorrectos. Revisa tus datos e inténtalo de nuevo.',
  inactiveAccount: 'Tu cuenta está desactivada. Comunícate con la ECMC para reactivarla.',
  emailConflict: 'Tu correo institucional ya está asociado a otra cuenta. Comunícate con la ECMC.',
  incompleteForm: 'Completa tu usuario y tu contraseña.',
  serviceUnavailable: 'El servicio de acceso no responde. Inténtalo de nuevo en unos minutos.',
  noConnection: 'No hay conexión con el servidor. Revisa tu conexión e inténtalo de nuevo.',
};

/**
 * Convierte el error de axios del login en un mensaje para el usuario.
 * @param {unknown} error Error lanzado por api.post('/auth/login')
 * @returns {string}
 */
export function getLoginErrorMessage(error) {
  // Sin "response": la petición nunca llegó al servidor (servidor apagado, sin red)
  if (!error?.response) return LOGIN_ERROR_MESSAGES.noConnection;

  switch (error.response.status) {
    case 401:
      return LOGIN_ERROR_MESSAGES.invalidCredentials;
    case 403:
      return LOGIN_ERROR_MESSAGES.inactiveAccount;
    case 409:
      return LOGIN_ERROR_MESSAGES.emailConflict;
    case 422:
      return LOGIN_ERROR_MESSAGES.incompleteForm;
    default:
      // 5xx (incluye 502: el directorio institucional no entregó datos) y cualquier otro
      return LOGIN_ERROR_MESSAGES.serviceUnavailable;
  }
}
