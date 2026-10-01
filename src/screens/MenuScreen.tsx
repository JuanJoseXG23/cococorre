import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { logout } from '../firebase/auth';
import { Logo } from '../components/Logo';
import { HeartIcon } from '../components/Icons';
import { CharacterPreview } from '../components/CharacterPreview';
import { CHARACTERS, getSavedSkin, isUnlocked, saveSkin, type CharacterSkin } from '../game/characters';
import type { Nav } from '../App';

export function MenuScreen({ nav }: { nav: Nav }) {
  const { profile, isAdmin, config } = useAuth();
  const hearts = profile?.heartsTotal ?? 0;
  const [skin, setSkin] = useState(getSavedSkin(hearts).id);
  /** Personaje bloqueado que la jugadora tocó (para mostrar cuánto falta). */
  const [hintId, setHintId] = useState('');

  const pick = (c: CharacterSkin) => {
    if (!isUnlocked(c, hearts)) {
      setHintId(c.id);
      return;
    }
    setHintId('');
    setSkin(c.id);
    saveSkin(c.id);
  };

  const unlockedCount = CHARACTERS.filter((c) => isUnlocked(c, hearts)).length;
  const hinted = CHARACTERS.find((c) => c.id === hintId && !isUnlocked(c, hearts));
  const missing = hinted ? hinted.unlockHearts - hearts : 0;
  const hint = hinted
    ? `Te faltan ${missing} ${missing === 1 ? 'corazón' : 'corazones'} para desbloquear a ${hinted.name} (${hinted.breedLabel}).`
    : '';

  return (
    <div className="screen">
      <div className="content">
        <Logo />
        <p className="welcome">{config.welcomeMessage}</p>

        <div className="chips">
          <span className="pill"><small>Jugadora</small><strong>{profile?.username}</strong></span>
          <span className="pill"><small>Puntos</small><strong>{profile?.points ?? 0}</strong></span>
          <span className="pill"><small>Récord</small><strong>{profile?.highScore ?? 0}</strong></span>
        </div>

        <div className="menu-buttons">
          <button className="btn big block" onClick={() => nav('game')}>Jugar</button>
          <div className="menu-grid">
            <button className="btn sand" onClick={() => nav('rewards')}>Recompensas</button>
            <button className="btn sage" onClick={() => nav('ranking')}>Ranking</button>
          </div>
          <button className="btn sky block" onClick={() => nav('profile')}>Mi perfil</button>
          {isAdmin && (
            <button className="btn lilac block" onClick={() => nav('admin')}>Administración</button>
          )}
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div className="char-header">
            <span>Personajes <span className="muted">· {unlockedCount}/{CHARACTERS.length}</span></span>
            <span className="hearts-count"><HeartIcon /> {hearts}</span>
          </div>
          <div className="char-grid">
            {CHARACTERS.map((c) => {
              const unlocked = isUnlocked(c, hearts);
              return (
                <button
                  key={c.id}
                  className={`char ${skin === c.id ? 'selected' : ''} ${unlocked ? '' : 'locked'}`}
                  onClick={() => pick(c)}
                  aria-label={unlocked ? `Elegir a ${c.name}` : `${c.name}: bloqueado, requiere ${c.unlockHearts} corazones`}
                >
                  <CharacterPreview skin={c} size={58} locked={!unlocked} />
                  <span className="char-name">{c.name}</span>
                  {unlocked ? (
                    <span className="char-breed">{c.breedLabel}</span>
                  ) : (
                    <span className="char-lock"><HeartIcon size={12} /> {c.unlockHearts}</span>
                  )}
                </button>
              );
            })}
          </div>
          {hint ? (
            <p className="char-hint">{hint}</p>
          ) : (
            <p className="char-hint muted">Recoge corazones en el camino para desbloquear nuevos personajes.</p>
          )}
        </div>

        <button className="link-btn" onClick={() => void logout()}>Cerrar sesión</button>
      </div>
    </div>
  );
}
