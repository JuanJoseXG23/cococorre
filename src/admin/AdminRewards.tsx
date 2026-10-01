import { useEffect, useState } from 'react';
import {
  createReward, deleteReward, setRewardWithId, updateReward, watchRewards, type RewardInput,
} from '../firebase/rewards';
import { friendlyError } from '../firebase/errors';
import { DIFFICULTY_LABELS, type Reward } from '../firebase/types';
import { DEFAULT_REWARDS } from '../rewards/defaultRewards';
import { Modal } from '../components/Modal';
import { RewardImage } from '../components/RewardImage';
import { Loading } from '../components/Decorations';
import { RewardForm } from './RewardForm';

function toInput(r: Reward): RewardInput {
  return {
    name: r.name, description: r.description, cost: r.cost, difficulty: r.difficulty,
    image: r.image, active: r.active, order: r.order,
  };
}

export function AdminRewards() {
  const [rewards, setRewards] = useState<Reward[] | null>(null);
  const [editing, setEditing] = useState<Reward | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Reward | null>(null);
  const [error, setError] = useState('');

  useEffect(() => watchRewards(setRewards, (e) => setError(friendlyError(e))), []);

  const run = async (fn: () => Promise<void>) => {
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  const seed = () => run(async () => {
    for (const r of DEFAULT_REWARDS) await setRewardWithId(r.id, r.data);
  });

  const nextOrder = (rewards ?? []).reduce((m, r) => Math.max(m, r.order), 0) + 1;

  return (
    <div className="card">
      <div className="topbar" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Recompensas</h2>
        <button className="btn sage small" onClick={() => setEditing('new')}>Nueva recompensa</button>
      </div>
      {error && <div className="error">{error}</div>}
      {!rewards && <Loading />}
      {rewards && rewards.length === 0 && (
        <div className="center" style={{ padding: 16 }}>
          <p className="muted">No hay recompensas todavía.</p>
          <button className="btn sand" onClick={() => void seed()}>Cargar las 5 recompensas iniciales</button>
        </div>
      )}
      {rewards?.map((r) => (
        <div key={r.id} className="admin-reward-row" style={{ opacity: r.active ? 1 : 0.55 }}>
          <div className="img"><RewardImage image={r.image} alt={r.name} /></div>
          <div className="info">
            <strong>{r.name}</strong>{' '}
            <span className={`badge ${r.difficulty}`}>{DIFFICULTY_LABELS[r.difficulty]}</span>{' '}
            {!r.active && <span className="badge off">Inactiva</span>}
            <div className="muted" style={{ fontSize: '0.9rem' }}>{r.description}</div>
            <div style={{ fontWeight: 600 }}>{r.cost} puntos</div>
          </div>
          <div className="actions">
            <button className="btn sky small" onClick={() => setEditing(r)}>Editar</button>
            <button
              className={`btn small ${r.active ? 'ghost' : 'sage'}`}
              onClick={() => void run(() => updateReward(r.id, { active: !r.active }))}
            >
              {r.active ? 'Desactivar' : 'Activar'}
            </button>
            <button className="btn danger small" onClick={() => setDeleting(r)}>Eliminar</button>
          </div>
        </div>
      ))}

      {editing && (
        <Modal>
          <RewardForm
            initial={editing === 'new' ? undefined : toInput(editing)}
            nextOrder={nextOrder}
            onCancel={() => setEditing(null)}
            onSave={async (input) => {
              if (editing === 'new') await createReward(input);
              else await updateReward(editing.id, input);
              setEditing(null);
            }}
          />
        </Modal>
      )}

      {deleting && (
        <Modal onClose={() => setDeleting(null)}>
          <h2>¿Eliminar "{deleting.name}"?</h2>
          <p className="muted">
            Las reclamaciones ya hechas se conservan en el historial. Si sólo quieres ocultarla,
            es mejor <strong>desactivarla</strong>.
          </p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setDeleting(null)}>Cancelar</button>
            <button
              className="btn danger"
              onClick={() => void run(async () => {
                await deleteReward(deleting.id);
                setDeleting(null);
              })}
            >
              Eliminar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
