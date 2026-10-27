/**
 * Identidad del juego. Cambia el nombre aquí y se actualiza en el menú,
 * la pantalla de inicio, la pausa y el perfil.
 *
 * ⚠️ JOCKOMBI_DATA_ID es la ruta de los datos en Firestore
 * (users/{uid}/gameStats/zombie-rush) y aparece en firestore.rules:
 * no lo cambies o se perdería el acceso al progreso guardado.
 */
export const JOCKOMBI_DATA_ID = 'zombie-rush';
export const JOCKOMBI_NAME = 'Jockombi';
/** Partes del logotipo en dos colores (deben formar el nombre). */
export const JOCKOMBI_LOGO: [string, string] = ['Jock', 'ombi'];
/** El perrito zombi con el que empieza cada partida: Border Collie blue merle. */
export const LEADER_NAME = 'Jocko';
