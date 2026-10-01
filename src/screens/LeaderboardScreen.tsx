import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { loadLeaderboard, type LeaderboardEntry } from '../firebase/leaderboard';
import { friendlyError } from '../firebase/errors';
import { Loading } from '../components/Decorations';
import { BackIcon } from '../components/Icons';
import type { Nav } from '../App';

/** Top global: mejores récords de todas las jugadoras registradas. */
export function LeaderboardScreen({ nav }: { nav: Nav }) {
  const { user, profile } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    loadLeaderboard(50).then(setEntries).catch((e) => setError(friendlyError(e)));
  }, []);
  useEffect(load, [load]);

  const myPos = entries ? entries.findIndex((e) => e.uid === user?.uid) : -1;

  return (
    <div className="screen">
      <div className="content">
        <div className="topbar">
          <button className="icon-btn" onClick={() => nav('menu')} aria-label="Volver"><BackIcon /></button>
          <h1>Ranking global</h1>
          <span style={{ width: 42 }} />
        </div>

        {profile && (
          <p className="center muted" style={{ margin: 0 }}>
            {myPos >= 0
              ? `Vas en el puesto ${myPos + 1} con un récord de ${profile.highScore}.`
              : `Tu récord es ${profile.highScore}. ¡Juega para entrar al top!`}
          </p>
        )}

        <div className="card">
          {error && <div className="error">{error}</div>}
          {!entries && !error && <Loading />}
          {entries && entries.length === 0 && <p className="muted center">Todavía no hay récords. ¡Sé la primera!</p>}
          {entries && entries.length > 0 && (
            <div className="rank-list">
              {entries.map((e, i) => (
                <div key={e.uid} className={`rank-row ${e.uid === user?.uid ? 'me' : ''}`}>
                  <span className={`rank-pos ${i < 3 ? `p${i + 1}` : ''}`}>{i + 1}</span>
                  <span className="rank-name">
                    {e.username}
                    <small>{e.gamesPlayed} {e.gamesPlayed === 1 ? 'partida' : 'partidas'}</small>
                  </span>
                  <span className="rank-score">{e.highScore}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="menu-grid">
          <button className="btn ghost" onClick={load}>Actualizar</button>
          <button className="btn" onClick={() => nav('game')}>Jugar</button>
        </div>
      </div>
    </div>
  );
}
