import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { watchMyClaims, watchRewards } from '../firebase/rewards';
import type { Claim, Reward } from '../firebase/types';
import { HeartsBackground } from '../components/Decorations';
import { CocoFace } from '../components/Logo';
import type { Nav } from '../App';

export function formatDate(ts: { toDate: () => Date } | null | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

export function ProfileScreen({ nav }: { nav: Nav }) {
  const { profile, user } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);

  useEffect(() => {
    if (!user) return;
    const a = watchMyClaims(user.uid, setClaims);
    const b = watchRewards(setRewards);
    return () => {
      a();
      b();
    };
  }, [user]);

  const total = rewards.filter((r) => r.active || claims.some((c) => c.rewardId === r.id)).length;

  return (
    <div className="screen">
      <HeartsBackground />
      <div className="content">
        <div className="topbar">
          <button className="icon-btn" onClick={() => nav('menu')} aria-label="Volver">⬅</button>
          <h1>❤️ Perfil</h1>
          <span style={{ width: 44 }} />
        </div>
        <div className="card center">
          <div style={{ width: 90, margin: '0 auto' }}><CocoFace /></div>
          <h2 style={{ margin: '4px 0 16px' }}>{profile?.username}</h2>
          <div className="stats">
            <div className="stat"><div className="label">Puntos</div><div className="value">🪙 {profile?.points ?? 0}</div></div>
            <div className="stat"><div className="label">Récord</div><div className="value">🏆 {profile?.highScore ?? 0}</div></div>
            <div className="stat"><div className="label">Partidas</div><div className="value">🎮 {profile?.gamesPlayed ?? 0}</div></div>
            <div className="stat"><div className="label">Recompensas</div><div className="value">🎁 {claims.length}/{total}</div></div>
          </div>
        </div>

        <div className="card">
          <h2>🎁 Mis recompensas</h2>
          {claims.length === 0 && <p className="muted">Todavía no has reclamado ninguna. ¡A jugar!</p>}
          {[...claims]
            .sort((a, b) => (b.claimedAt?.toMillis() ?? 0) - (a.claimedAt?.toMillis() ?? 0))
            .map((c) => (
              <div key={c.id} className="admin-reward-row">
                <div className="info">
                  <strong>{c.rewardName}</strong>
                  <div className="muted" style={{ fontSize: '0.9rem' }}>{formatDate(c.claimedAt)}</div>
                </div>
                <span className="claimed-tag">RECLAMADA ✓</span>
              </div>
            ))}
        </div>
        <button className="btn block" onClick={() => nav('game')}>▶ JUGAR</button>
      </div>
    </div>
  );
}
