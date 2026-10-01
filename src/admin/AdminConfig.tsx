import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { saveGameConfig } from '../firebase/gameConfig';
import { friendlyError } from '../firebase/errors';
import type { GameConfig } from '../firebase/types';

export function AdminConfig() {
  const { config, reloadConfig } = useAuth();
  const [cfg, setCfg] = useState<GameConfig>(config);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof GameConfig>(k: K, v: GameConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const save = async () => {
    setBusy(true);
    setMsg('');
    setError('');
    try {
      await saveGameConfig({
        ...cfg,
        milestoneMessages: cfg.milestoneMessages.map((m) => m.trim()).filter(Boolean),
      });
      await reloadConfig();
      setMsg('Configuración guardada.');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>Configuración</h2>
      <div className="form">
        <div className="field">
          <label>Velocidad de los obstáculos: {cfg.speedMultiplier.toFixed(2)}×</label>
          <input
            type="range"
            min={0.6}
            max={1.5}
            step={0.05}
            value={cfg.speedMultiplier}
            onChange={(e) => set('speedMultiplier', Number(e.target.value))}
          />
          <span className="muted" style={{ fontSize: '0.85rem' }}>Menos de 1 = más fácil · más de 1 = más difícil</span>
        </div>
        <div className="field">
          <label>Mensaje de ánimo cada N puntos</label>
          <input className="input" type="number" min={0} value={cfg.milestoneEvery} onChange={(e) => set('milestoneEvery', Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
        </div>
        <div className="field">
          <label>Mensajes de ánimo (uno por línea)</label>
          <textarea className="input" rows={5} value={cfg.milestoneMessages.join('\n')} onChange={(e) => set('milestoneMessages', e.target.value.split('\n'))} />
        </div>
        <div className="field">
          <label>Mensaje de bienvenida (menú)</label>
          <input className="input" value={cfg.welcomeMessage} onChange={(e) => set('welcomeMessage', e.target.value)} />
        </div>
        <div className="field">
          <label>Mensaje de nuevo récord</label>
          <input className="input" value={cfg.recordMessage} onChange={(e) => set('recordMessage', e.target.value)} />
        </div>
        <div className="field">
          <label>Mensaje al reclamar una recompensa</label>
          <input className="input" value={cfg.claimMessage} onChange={(e) => set('claimMessage', e.target.value)} />
        </div>
        {msg && <div className="success">{msg}</div>}
        {error && <div className="error">{error}</div>}
        <button className="btn sage block" onClick={() => void save()} disabled={busy}>
          {busy ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  );
}
