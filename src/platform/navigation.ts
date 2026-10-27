/**
 * Pantallas de la plataforma. La navegación es por estado + #hash (sin rutas
 * de servidor), así que funciona en GitHub Pages con cualquier nombre de
 * repositorio y recargar una pantalla nunca da 404.
 *
 *   menu       → menú principal de juegos (#)
 *   cococorre  → inicio de CoCoCorre (#cococorre)
 *   game       → partida de CoCoCorre      gameover → resultados de CoCoCorre
 *   jockombi   → Jockombi (#jockombi; #zombie-rush sigue funcionando)
 *   rewards, ranking, profile, admin → pantallas de la cuenta
 */
export type Screen =
  | 'menu' | 'cococorre' | 'game' | 'gameover' | 'jockombi'
  | 'rewards' | 'ranking' | 'profile' | 'admin';

export type Nav = (s: Screen) => void;

/** Pantallas que se pueden abrir directo desde la URL (y con el botón "atrás"). */
export const HASH_OF: Partial<Record<Screen, string>> = {
  menu: '',
  cococorre: 'cococorre',
  jockombi: 'jockombi',
  rewards: 'rewards',
  ranking: 'ranking',
  profile: 'profile',
  admin: 'admin',
};

/** Direcciones antiguas que siguen abriendo la pantalla correcta. */
const LEGACY_HASH: Record<string, Screen> = { 'zombie-rush': 'jockombi' };

export function screenFromHash(hash: string): Screen {
  const h = hash.replace(/^#/, '');
  if (LEGACY_HASH[h]) return LEGACY_HASH[h];
  const found = (Object.entries(HASH_OF) as [Screen, string][]).find(([, v]) => v === h);
  return found ? found[0] : 'menu';
}
