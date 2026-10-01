import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { claimReward, watchMyClaims, watchRewards } from '../firebase/rewards';
import { friendlyError } from '../firebase/errors';
import { DIFFICULTY_LABELS, type Claim, type Reward } from '../firebase/types';
import { Confetti, Loading } from '../components/Decorations';
import { BackIcon } from '../components/Icons';
import { Modal } from '../components/Modal';
import { RewardImage } from '../components/RewardImage';
import type { Nav } from '../App';

export function RewardsScreen({ nav }: { nav: Nav }) {
  const { user, profile, config } = useAuth();
  const [rewards, setRewards] = useState<Reward[] | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loadError, setLoadError] = useState('');
  const [confirming, setConfirming] = useState<Reward | null>(null);
  const [busy, setBusy] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [celebrate, setCelebrate] = useState<Reward | null>(null);

  useEffect(() => {
    if (!user) return;
    const a = watchRewards(setRewards, (e) => setLoadError(friendlyError(e)));
    const b = watchMyClaims(user.uid, setClaims);
    return () => {
      a();
      b();
    };
  }, [user]);

  const claimedIds = useMemo(() => new Set(claims.map((c) => c.rewardId)), [claims]);
  const points = profile?.points ?? 0;
  // Las inactivas sólo se muestran si ya fueron reclamadas.
  const visible = (rewards ?? []).filter((r) => r.active || claimedIds.has(r.id));

  const doClaim = async () => {
    if (!user || !confirming) return;
    setBusy(true);
    setClaimError('');
    try {
      const { reward } = await claimReward(user.uid, confirming.id);
      setConfirming(null);
      setCelebrate(reward);
    } catch (e) {
      setClaimError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen wide">
      <div className="content">
        <div className="topbar">
          <button className="icon-btn" onClick={() => nav('menu')} aria-label="Volver"><BackIcon /></button>
          <h1>Recompensas</h1>
          <span className="pill"><small>Puntos</small><strong>{points}</strong></span>
        </div>
        <p className="center muted" style={{ margin: 0 }}>
          Usa tus puntos para desbloquear recompensas. Cada una se puede reclamar una sola vez.
        </p>

        {loadError && <div className="error">{loadError}</div>}
        {!rewards && !loadError && <Loading />}
        {rewards && visible.length === 0 && (
          <div className="card center muted">Aún no hay recompensas disponibles... pronto habrá sorpresas.</div>
        )}

        <div className="rewards-grid">
          {visible.map((r) => {
            const claimed = claimedIds.has(r.id);
            const affordable = points >= r.cost;
            const pct = Math.min(100, Math.round((points / Math.max(1, r.cost)) * 100));
            return (
              <div key={r.id} className={`card reward ${claimed ? 'claimed' : ''}`}>
                <span className={`badge ${r.difficulty}`}>{DIFFICULTY_LABELS[r.difficulty] ?? r.difficulty}</span>
                <div className="img"><RewardImage image={r.image} alt={r.name} /></div>
                <h3>{r.name}</h3>
                <p>{r.description}</p>
                <div className="cost">{r.cost} puntos</div>
                {claimed ? (
                  <div className="claimed-tag">Reclamada ✓</div>
                ) : (
                  <>
                    {!affordable && (
                      <>
                        <div className="progress" aria-label={`${pct}%`}><div style={{ width: `${pct}%` }} /></div>
                        <div className="muted" style={{ fontSize: '0.9rem' }}>Te faltan {r.cost - points} puntos</div>
                      </>
                    )}
                    <button
                      className="btn block"
                      disabled={!affordable}
                      onClick={() => {
                        setClaimError('');
                        setConfirming(r);
                      }}
                    >
                      {affordable ? 'Reclamar' : 'Aún no alcanza'}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <button className="btn block" onClick={() => nav('game')} style={{ maxWidth: 460, alignSelf: 'center' }}>
          Jugar para ganar más
        </button>
      </div>

      {confirming && (
        <Modal onClose={busy ? undefined : () => setConfirming(null)}>
          <div className="center">
            <div style={{ fontSize: 56 }} className="reward"><div className="img" style={{ margin: '0 auto' }}><RewardImage image={confirming.image} alt={confirming.name} /></div></div>
            <h2 style={{ margin: '8px 0' }}>¿Quieres reclamar?</h2>
            <h3 style={{ margin: 0, textTransform: 'uppercase', color: 'var(--rose-dark)' }}>{confirming.name}</h3>
          </div>
          <div className="balance" style={{ marginTop: 16 }}>
            <span>Costo</span><span>{confirming.cost} puntos</span>
            <span>Saldo actual</span><span>{points} puntos</span>
            <span className="total">Después de reclamar</span><span className="total">{points - confirming.cost} puntos</span>
          </div>
          {claimError && <div className="error" style={{ marginTop: 12 }}>{claimError}</div>}
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setConfirming(null)} disabled={busy}>Cancelar</button>
            <button className="btn" onClick={doClaim} disabled={busy}>{busy ? '...' : 'Reclamar'}</button>
          </div>
        </Modal>
      )}

      {celebrate && (
        <>
          <Confetti count={40} />
          <Modal onClose={() => setCelebrate(null)}>
            <div className="celebrate">
              <h2 style={{ color: 'var(--rose-dark)' }}>¡Recompensa reclamada!</h2>
              <p className="muted" style={{ margin: 0 }}>Has desbloqueado:</p>
              <div className="emoji"><RewardImage image={celebrate.image} alt={celebrate.name} /></div>
              <h2 style={{ margin: '4px 0' }}>{celebrate.name}</h2>
              <p>{config.claimMessage}</p>
              <div className="ticket">
                Esta recompensa es válida para:<br />
                <strong>una persona muy especial</strong>
              </div>
              <button className="btn block" style={{ marginTop: 16 }} onClick={() => setCelebrate(null)}>
                Gracias
              </button>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}
