/** Configuración general del juego. */
export const GAME_NAME = 'CoCoCorre';
export const PLAYER_NAME = 'María Isabel';

/**
 * Firebase Authentication necesita un correo. Convertimos el "usuario" en un
 * correo interno que nunca recibe mensajes: juanita -> juanita@cococorre.app
 * ⚠️ Si lo cambias, cámbialo también en firestore.rules.
 */
export const USERNAME_EMAIL_DOMAIN = 'cococorre.app';

export const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,20}$/;
export const MIN_PASSWORD_LENGTH = 6;
