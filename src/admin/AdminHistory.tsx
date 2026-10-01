import { useCallback, useEffect, useState } from 'react';
import { listClaims, listGames } from '../firebase/admin';
import { friendlyError } from '../firebase/errors';
import type { Claim, GameRecord } from '../firebase/types';
import { Loading } from '../components/Decorations';

function date(ts: Claim['claimedAt']) {
  return ts ? ts.toDate().toLocaleDateString('es-CO', { dateStyle: 'medium' }) : '—';
}
function time(ts: Claim['claimedAt']) {
  return ts ? ts.toDate().toLocaleTimeString('es-CO', { timeStyle: 'short' }) : '—';
}

export function AdminHistory() {
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [games, setGames] = useState<GameRecord[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    listClaims().then(setClaims).catch((e) => setError(friendlyError(e)));
    listGames().then(setGames).catch((e) => setError(friendlyError(e)));
  }, []);
  useEffect(load, [load]);

  return (
    <>
      <div className="card">
        <div className="topbar" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>📜 Reclamaciones</h2>
          <button className="btn ghost small" onClick={load}>🔄 Actualizar</button>
        </div>
        {error && <div className="error">{error}</div>}
        {!claims && !error && <Loading />}
        {claims && claims.length === 0 && <p className="muted">Todavía nadie ha reclamado recompensas.</p>}
        {claims && claims.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Usuario</th><th>Recompensa</th><th>Costo</th><th>Fecha</th><th>Hora</th></tr></thead>
              <tbody>
                {claims.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.username}</strong></td>
                    <td>{c.rewardName}</td>
                    <td>🪙 {c.cost}</td>
                    <td>{date(c.claimedAt)}</td>
                    <td>{time(c.claimedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="card">
        <h2>🎮 Últimas partidas</h2>
        {!games && !error && <Loading />}
        {games && games.length === 0 && <p className="muted">Aún no hay partidas registradas.</p>}
        {games && games.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Usuario</th><th>Puntos</th><th>Fecha</th><th>Hora</th></tr></thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.id}>
                    <td><strong>{g.username}</strong></td>
                    <td>{g.score}</td>
                    <td>{date(g.playedAt)}</td>
                    <td>{time(g.playedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
