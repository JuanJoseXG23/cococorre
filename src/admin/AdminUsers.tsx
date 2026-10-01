import { useCallback, useEffect, useState } from 'react';
import { listUsers, setUserPoints } from '../firebase/admin';
import { friendlyError } from '../firebase/errors';
import type { UserProfile } from '../firebase/types';
import { Loading } from '../components/Decorations';
import { Modal } from '../components/Modal';
import { formatDate } from '../screens/ProfileScreen';

export function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [error, setError] = useState('');
  const [gift, setGift] = useState<UserProfile | null>(null);
  const [amount, setAmount] = useState(50);

  const load = useCallback(() => {
    setError('');
    listUsers().then(setUsers).catch((e) => setError(friendlyError(e)));
  }, []);
  useEffect(load, [load]);

  const giveGift = async () => {
    if (!gift) return;
    try {
      await setUserPoints(gift.uid, Math.max(0, gift.points + amount));
      setGift(null);
      load();
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  return (
    <div className="card">
      <div className="topbar" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Usuarios</h2>
        <button className="btn ghost small" onClick={load}>Actualizar</button>
      </div>
      {error && <div className="error">{error}</div>}
      {!users && !error && <Loading />}
      {users && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuario</th><th>Puntos</th><th>Récord</th><th>Partidas</th><th>Reclamadas</th><th>Registro</th><th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid}>
                  <td><strong>{u.username}</strong></td>
                  <td>{u.points}</td>
                  <td>{u.highScore}</td>
                  <td>{u.gamesPlayed}</td>
                  <td>{u.claimedCount}</td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>
                    <button className="btn sand small" onClick={() => setGift(u)}>Ajustar puntos</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {gift && (
        <Modal onClose={() => setGift(null)}>
          <h2>Puntos para {gift.username}</h2>
          <p className="muted">Saldo actual: {gift.points}. Usa un número negativo para quitar puntos.</p>
          <input className="input" type="number" step={1} value={amount} onChange={(e) => setAmount(Math.floor(Number(e.target.value) || 0))} />
          <p>Nuevo saldo: <strong>{Math.max(0, gift.points + amount)}</strong></p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setGift(null)}>Cancelar</button>
            <button className="btn sage" onClick={() => void giveGift()}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
