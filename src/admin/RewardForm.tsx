import { useState, type FormEvent } from 'react';
import type { RewardInput } from '../firebase/rewards';
import { DIFFICULTY_LABELS, type RewardDifficulty } from '../firebase/types';
import { RewardImage } from '../components/RewardImage';
import { imageFileToDataUrl } from './imageUtils';

const EMOJIS = ['🎁', '🤗', '💋', '🍫', '⚽', '🍦', '🍕', '🎬', '💐', '🌹', '☕', '🍰', '💆‍♀️', '🧸', '✈️', '🏖️', '🎮', '🍿', '💌', '🌮'];

const DEFAULT_COST: Record<RewardDifficulty, number> = { facil: 100, media: 300, dificil: 500, epica: 1000 };

interface Props {
  initial?: RewardInput;
  nextOrder: number;
  onSave: (r: RewardInput) => Promise<void>;
  onCancel: () => void;
}

export function RewardForm({ initial, nextOrder, onSave, onCancel }: Props) {
  const [r, setR] = useState<RewardInput>(
    initial ?? { name: '', description: '', cost: 100, difficulty: 'facil', image: '🎁', active: true, order: nextOrder },
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof RewardInput>(k: K, v: RewardInput[K]) => setR((prev) => ({ ...prev, [k]: v }));

  const onFile = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      set('image', await imageFileToDataUrl(file));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!r.name.trim()) return setError('Escribe un nombre.');
    if (!Number.isInteger(r.cost) || r.cost < 0) return setError('El costo debe ser un número entero positivo.');
    setBusy(true);
    try {
      await onSave({ ...r, name: r.name.trim(), description: r.description.trim() });
    } catch (err) {
      setError((err as Error).message || 'No se pudo guardar.');
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <h2 style={{ margin: 0 }}>{initial ? 'Editar recompensa' : 'Nueva recompensa'}</h2>
      <div className="field">
        <label>Nombre</label>
        <input className="input" maxLength={60} value={r.name} onChange={(e) => set('name', e.target.value)} />
      </div>
      <div className="field">
        <label>Descripción</label>
        <textarea className="input" rows={2} maxLength={300} value={r.description} onChange={(e) => set('description', e.target.value)} />
      </div>
      <div className="row">
        <div className="field">
          <label>Dificultad</label>
          <select
            className="input"
            value={r.difficulty}
            onChange={(e) => {
              const d = e.target.value as RewardDifficulty;
              set('difficulty', d);
              if (!initial) set('cost', DEFAULT_COST[d]);
            }}
          >
            {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Costo (puntos)</label>
          <input
            className="input"
            type="number"
            min={0}
            step={1}
            value={r.cost}
            onChange={(e) => set('cost', Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          />
        </div>
        <div className="field">
          <label>Orden (escalera)</label>
          <input className="input" type="number" step={1} value={r.order} onChange={(e) => set('order', Math.floor(Number(e.target.value) || 0))} />
        </div>
      </div>
      <div className="field">
        <label>Imagen</label>
        <div className="row" style={{ alignItems: 'center' }}>
          <div className="reward" style={{ flex: '0 0 auto', minWidth: 0 }}>
            <div className="img"><RewardImage image={r.image} alt="vista previa" /></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="emoji-choices">
              {EMOJIS.map((em) => (
                <button type="button" key={em} className={r.image === em ? 'selected' : ''} onClick={() => set('image', em)}>{em}</button>
              ))}
            </div>
            <input className="input" placeholder="…o pega un emoji / URL https://" value={r.image.startsWith('data:') ? '(imagen subida)' : r.image} onChange={(e) => set('image', e.target.value)} />
            <label className="btn ghost small" style={{ alignSelf: 'flex-start' }}>
              Subir imagen
              <input type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
            </label>
          </div>
        </div>
      </div>
      <label className="check">
        <input type="checkbox" checked={r.active} onChange={(e) => set('active', e.target.checked)} />
        Activa (visible y reclamable)
      </label>
      {error && <div className="error">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button type="submit" className="btn sage" disabled={busy}>{busy ? 'Guardando...' : 'Guardar'}</button>
      </div>
    </form>
  );
}
