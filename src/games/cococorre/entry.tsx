import type { GameEntry } from '../../platform/registry';
import { useAuth } from '../../auth/AuthContext';
import { CharacterPreview } from '../../components/CharacterPreview';
import { getSavedSkin } from '../../game/characters';
import { GAME_NAME } from '../../config';

/**
 * CoCoCorre sigue viviendo en src/game (motor) y src/screens (pantallas);
 * aquí sólo se registra en la plataforma, sin modificar su código.
 */
function Cover() {
  const { profile } = useAuth();
  const skin = getSavedSkin(profile?.heartsTotal ?? 0);
  return (
    <div className="cover-coco">
      <div className="cover-coco-road" />
      <div className="cover-coco-road two" />
      <div className="cover-coco-pet">
        <CharacterPreview skin={skin} size={118} animate />
      </div>
    </div>
  );
}

function Progress() {
  const { profile } = useAuth();
  return (
    <>
      <span className="game-chip"><small>Récord</small><strong>{profile?.highScore ?? 0}</strong></span>
      <span className="game-chip"><small>Puntos</small><strong>{profile?.points ?? 0}</strong></span>
      <span className="game-chip"><small>Corazones</small><strong>{profile?.heartsTotal ?? 0}</strong></span>
    </>
  );
}

export const cococorreGame: GameEntry = {
  id: 'cococorre',
  name: GAME_NAME,
  tagline: 'Ayuda a Coco a cruzar la ciudad',
  description: 'Calles, ríos y trenes. Gana puntos para tus recompensas y recoge corazones para desbloquear personajes.',
  screen: 'cococorre',
  theme: { from: '#d9f0e3', to: '#f8eaef', accent: '#d4849a', accentDark: '#b4677d' },
  Cover,
  Progress,
};
