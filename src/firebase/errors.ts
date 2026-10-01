/** Convierte errores de Firebase en mensajes entendibles en español. */
export function friendlyError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Ese usuario ya existe. Prueba con otro nombre.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'Usuario o contraseña incorrectos.';
    case 'auth/weak-password':
      return 'La contraseña es muy débil (mínimo 6 caracteres).';
    case 'auth/invalid-email':
      return 'El usuario tiene caracteres no permitidos.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera un momento y vuelve a intentarlo.';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
    case 'auth/operation-not-allowed':
      return 'El inicio de sesión con correo/contraseña no está activado en Firebase.';
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      return 'La API key de Firebase no es válida. Revisa las variables de entorno.';
    case 'permission-denied':
      return 'Operación no permitida.';
    default:
      if (err instanceof Error && err.message) return err.message;
      return 'Ocurrió un error inesperado.';
  }
}
