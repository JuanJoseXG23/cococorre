/**
 * Identidad del juego. Cambia el nombre aquí y se actualiza en el menú,
 * la pantalla de inicio, la pausa y el perfil.
 *
 * ⚠️ ZOMBIE_RUSH_ID es la ruta de los datos en Firestore
 * (users/{uid}/gameStats/zombie-rush) y aparece en firestore.rules:
 * no lo cambies o se perdería el acceso al progreso guardado.
 */
export const ZOMBIE_RUSH_ID = 'zombie-rush';
export const ZOMBIE_RUSH_NAME = 'Jockombi';
/** Partes del logotipo en dos colores (deben formar el nombre). */
export const ZOMBIE_RUSH_LOGO: [string, string] = ['Jock', 'ombi'];
/** El zombi con el que empieza cada partida. */
export const LEADER_NAME = 'Zeta';
