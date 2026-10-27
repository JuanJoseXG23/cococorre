import type { GameEntry } from '../../platform/registry';
import { useAuth } from '../../auth/AuthContext';
import { HordePreview } from './HordePreview';
import { JOCKOMBI_DATA_ID, JOCKOMBI_NAME } from './meta';
import { useJockombiProgress } from './useJockombiProgress';

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
  const { stats } = useJockombiProgress(user?.uid);
  return (
    <>
      <span className="game-chip"><small>Récord</small><strong>{stats.bestDistance} m</strong></span>
      <span className="game-chip"><small>Mayor jauría</small><strong>{stats.maxHorde}</strong></span>
      <span className="game-chip"><small>Partidas</small><strong>{stats.gamesPlayed}</strong></span>
    </>
  );
}

export const jockombiGame: GameEntry = {
  id: JOCKOMBI_DATA_ID,
  name: JOCKOMBI_NAME,
  tagline: 'Corre, salta y haz crecer la jauría zombi',
  description: 'Guía a Jocko, contagia a otros perritos, esquiva bombas y huecos, y aplasta autos y buses cuando tu jauría sea lo bastante grande.',
  screen: 'jockombi',
  theme: { from: '#2b2350', to: '#5b3f8a', accent: '#7ed957', accentDark: '#4f9d2f', dark: true },
  Cover,
  Progress,
  badge: 'Nuevo',
};
