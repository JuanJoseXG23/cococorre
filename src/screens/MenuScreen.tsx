import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { logout } from '../firebase/auth';
import { Logo } from '../components/Logo';
import { CHARACTERS, getSavedSkin, saveSkin } from '../game/characters';
import type { Nav } from '../App';

export function MenuScreen({ nav }: { nav: Nav }) {
  const { profile, isAdmin, config } = useAuth();
  const [skin, setSkin] = useState(getSavedSkin().id);

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
          <div className="center muted" style={{ marginBottom: 8, fontSize: '0.9rem' }}>Personaje</div>
          <div className="skin-picker">
            {CHARACTERS.map((c) => (
              <button
                key={c.id}
                className={skin === c.id ? 'selected' : ''}
                onClick={() => {
                  setSkin(c.id);
                  saveSkin(c.id);
                }}
              >
                <span className="swatch" style={{ background: c.body }} />
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <button className="link-btn" onClick={() => void logout()}>Cerrar sesión</button>
      </div>
    </div>
  );
}
