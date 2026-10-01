import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { logout } from '../firebase/auth';
import { Logo } from '../components/Logo';
import { HeartsBackground } from '../components/Decorations';
import { CHARACTERS, getSavedSkin, saveSkin } from '../game/characters';
import type { Nav } from '../App';

export function MenuScreen({ nav }: { nav: Nav }) {
  const { profile, isAdmin, config } = useAuth();
  const [skin, setSkin] = useState(getSavedSkin().id);

  return (
    <div className="screen">
      <HeartsBackground />
      <div className="content">
        <Logo />
        <p className="welcome">{config.welcomeMessage}</p>

        <div className="row" style={{ justifyContent: 'center' }}>
          <span className="pill" style={{ flex: '0 0 auto' }}>👤 {profile?.username}</span>
          <span className="pill" style={{ flex: '0 0 auto' }}>🪙 {profile?.points ?? 0}</span>
          <span className="pill" style={{ flex: '0 0 auto' }}>🏆 {profile?.highScore ?? 0}</span>
        </div>

        <div className="menu-buttons">
          <button className="btn big block" onClick={() => nav('game')}>▶ JUGAR</button>
          <button className="btn yellow big block" onClick={() => nav('rewards')}>🎁 RECOMPENSAS</button>
          <button className="btn sky block" onClick={() => nav('profile')}>❤️ PERFIL</button>
          {isAdmin && (
            <button className="btn lilac block" onClick={() => nav('admin')}>🔐 ADMINISTRACIÓN</button>
          )}
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div className="center muted" style={{ fontWeight: 600, marginBottom: 8 }}>Elige tu personaje</div>
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
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
        </div>

        <button className="btn ghost small" onClick={() => void logout()} style={{ alignSelf: 'center' }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
