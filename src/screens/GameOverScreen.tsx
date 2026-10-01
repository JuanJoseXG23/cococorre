import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { submitGame, type GameSubmitResult } from '../firebase/users';
import { friendlyError } from '../firebase/errors';
import { Confetti, Loading } from '../components/Decorations';
import { levelForScore } from '../game/difficulty';
import { newlyUnlocked } from '../game/characters';
import { CharacterPreview } from '../components/CharacterPreview';
import type { GameResult } from '../game/types';
import type { Nav } from '../App';

const CAUSES: Record<GameResult['cause'], string> = {
  car: 'Un carro atropelló a Coco.',
  train: 'El tren pasó muy rápido.',
  water: 'Coco cayó al agua.',
  swept: 'El río se llevó a Coco.',
  eagle: 'La ola de corazones alcanzó a Coco.',
};

/** Evita registrar la misma partida dos veces (p. ej. con React StrictMode). */
const submitted = new Map<GameResult, Promise<GameSubmitResult>>();

export function GameOverScreen({ result, nav, onPlayAgain }: { result: GameResult; nav: Nav; onPlayAgain: () => void }) {
  const { user, config } = useAuth();
  const [saved, setSaved] = useState<GameSubmitResult | null>(null);
  const [error, setError] = useState('');
  const playAgainRef = useRef<HTMLButtonElement>(null);

  const save = useCallback(() => {
    if (!user) return;
    setError('');
    let p = submitted.get(result);
    if (!p) {
      p = submitGame(user.uid, result.score, result.hearts);
      submitted.set(result, p);
    }
    p.then(setSaved).catch((e) => {
      submitted.delete(result);
      setError(friendlyError(e));
    });
  }, [user, result]);

  useEffect(save, [save]);

  useEffect(() => {
    if (saved) playAgainRef.current?.focus();
  }, [saved]);

  // Enter / espacio = volver a jugar
  useEffect(() => {
    if (!saved) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onPlayAgain();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saved, onPlayAgain]);

  const newRecord = Boolean(saved?.newRecord && result.score > 0);
  const unlocked = saved?.heartsSaved ? newlyUnlocked(saved.heartsBefore, saved.heartsBefore + result.hearts) : [];
  const busy = !saved && !error;

  return (
    <div className="screen">
      {(newRecord || unlocked.length > 0) && <Confetti />}
      <div className="content">
        <h1 className="gameover-title">Fin del juego</h1>
        <div className="card">
          <p className="center muted" style={{ marginTop: 0 }}>{CAUSES[result.cause]}</p>
          <div className="center muted">Puntuación</div>
          <div className="big-score">{result.score}</div>
          <p className="center muted" style={{ marginBottom: 0 }}>
            Llegaste al nivel {levelForScore(result.score)}
            {result.hearts > 0 && ` · ${result.hearts} ${result.hearts > 1 ? 'corazones' : 'corazón'}`}
          </p>

          {unlocked.map((c) => (
            <div key={c.id} className="unlock-banner">
              <CharacterPreview skin={c} size={56} />
              <div>
                <strong>¡Desbloqueaste a {c.name}!</strong>
                <div className="muted" style={{ fontSize: '0.9rem' }}>{c.breedLabel} · elígelo en el menú</div>
              </div>
            </div>
          ))}

          {newRecord && (
            <div className="record-banner" style={{ marginTop: 14 }}>
              ¡Nuevo récord!<br />
              <span style={{ fontWeight: 400 }}>{config.recordMessage}</span>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            {busy && <Loading text="Guardando tus puntos..." />}
            {error && (
              <div className="form">
                <div className="error">No se pudieron guardar los puntos: {error}</div>
                <button className="btn sage block" onClick={save}>Reintentar</button>
              </div>
            )}
            {saved && (
              <div className="balance">
                <span>Saldo anterior</span><span>{saved.previousPoints}</span>
                <span>Partida</span><span className="positive">+{result.score}</span>
                <span className="total">Puntos acumulados</span><span className="total">{saved.newPoints}</span>
              </div>
            )}
          </div>
        </div>

        <div className="menu-buttons">
          <button ref={playAgainRef} className="btn big block" onClick={onPlayAgain} disabled={busy}>
            Volver a jugar
          </button>
          <div className="menu-grid">
            <button className="btn sand" onClick={() => nav('rewards')} disabled={busy}>Recompensas</button>
            <button className="btn sage" onClick={() => nav('ranking')} disabled={busy}>Ranking</button>
          </div>
          <button className="btn ghost block" onClick={() => nav('menu')} disabled={busy}>Menú principal</button>
        </div>
      </div>
    </div>
  );
}
