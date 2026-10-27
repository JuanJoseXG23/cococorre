import type { GameEntry } from '../../platform/registry';
import { useAuth } from '../../auth/AuthContext';
import { HordePreview } from './HordePreview';
import { ZOMBIE_RUSH_ID, ZOMBIE_RUSH_NAME } from './meta';
import { useZombieProgress } from './useZombieProgress';

function Cover() {
  return (
    <div className="cover-zombie">
      <div className="cover-zombie-moon" />
      <div className="cover-zombie-city" />
      <HordePreview count={7} night className="cover-canvas" />
    </div>
  );
}

function Progress() {
  const { user } = useAuth();
  const { stats } = useZombieProgress(user?.uid);
  return (
    <>
      <span className="game-chip"><small>Récord</small><strong>{stats.bestDistance} m</strong></span>
      <span className="game-chip"><small>Mayor horda</small><strong>{stats.maxHorde}</strong></span>
      <span className="game-chip"><small>Partidas</small><strong>{stats.gamesPlayed}</strong></span>
    </>
  );
}

export const zombieRushGame: GameEntry = {
  id: ZOMBIE_RUSH_ID,
  name: ZOMBIE_RUSH_NAME,
  tagline: 'Corre, salta y haz crecer la horda',
  description: 'Convierte civiles, esquiva bombas y huecos, y aplasta autos y buses cuando tu horda sea lo bastante grande.',
  screen: 'zombie',
  theme: { from: '#2b2350', to: '#5b3f8a', accent: '#7ed957', accentDark: '#4f9d2f', dark: true },
  Cover,
  Progress,
  badge: 'Nuevo',
};
