/**
 * Pantallas de la plataforma. La navegación es por estado + #hash (sin rutas
 * de servidor), así que funciona en GitHub Pages con cualquier nombre de
 * repositorio y recargar una pantalla nunca da 404.
 *
 *   menu       → menú principal de juegos (#)
 *   cococorre  → inicio de CoCoCorre (#cococorre)
 *   game       → partida de CoCoCorre      gameover → resultados de CoCoCorre
 *   zombie     → Zombie Rush (#zombie-rush)
 *   rewards, ranking, profile, admin → pantallas de la cuenta
 */
export type Screen =
  | 'menu' | 'cococorre' | 'game' | 'gameover' | 'zombie'
  | 'rewards' | 'ranking' | 'profile' | 'admin';

export type Nav = (s: Screen) => void;

/** Pantallas que se pueden abrir directo desde la URL (y con el botón "atrás"). */
export const HASH_OF: Partial<Record<Screen, string>> = {
  menu: '',
  cococorre: 'cococorre',
  zombie: 'zombie-rush',
  rewards: 'rewards',
  ranking: 'ranking',
  profile: 'profile',
  admin: 'admin',
};

export function screenFromHash(hash: string): Screen {
  const h = hash.replace(/^#/, '');
  const found = (Object.entries(HASH_OF) as [Screen, string][]).find(([, v]) => v === h);
  return found ? found[0] : 'menu';
}
