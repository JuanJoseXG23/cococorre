import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { submitGame, type GameSubmitResult } from '../firebase/users';
import { friendlyError } from '../firebase/errors';
import { Confetti, HeartsBackground, Loading } from '../components/Decorations';
import type { GameResult } from '../game/types';
import type { Nav } from '../App';

const CAUSES: Record<GameResult['cause'], string> = {
  car: '🚗 ¡Un carro atropelló a Coco!',
  train: '🚆 ¡El tren pasó muy rápido!',
  water: '💦 ¡Coco cayó al agua!',
  swept: '🌊 ¡El río se llevó a Coco!',
  eagle: '💤 ¡Coco se quedó atrás!',
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
      p = submitGame(user.uid, result.score);
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

  return (
    <div className="screen">
      <HeartsBackground />
      {saved?.newRecord && result.score > 0 && <Confetti />}
      <div className="content">
        <h1 className="gameover-title">💥 GAME OVER</h1>
        <div className="card">
          <p className="center muted" style={{ marginTop: 0 }}>{CAUSES[result.cause]}</p>
          <div className="center muted" style={{ fontWeight: 600 }}>Puntuación</div>
          <div className="big-score">{result.score}</div>
          {result.hearts > 0 && (
            <p className="center muted" style={{ marginBottom: 0 }}>
              Incluye {result.hearts} ❤️ recogido{result.hearts > 1 ? 's' : ''}
            </p>
          )}

          {saved?.newRecord && result.score > 0 && (
            <div className="record-banner" style={{ marginTop: 14 }}>
              ✨ ¡NUEVO RÉCORD! ✨<br />
              <span style={{ fontWeight: 500 }}>{config.recordMessage}</span>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            {!saved && !error && <Loading text="Guardando tus puntos..." />}
            {error && (
              <div className="form">
                <div className="error">No se pudieron guardar los puntos: {error}</div>
                <button className="btn mint block" onClick={save}>Reintentar</button>
              </div>
            )}
            {saved && (
              <div className="balance">
                <span>Saldo anterior</span><span>{saved.previousPoints}</span>
                <span>Partida</span><span style={{ color: 'var(--mint-dark)', fontWeight: 700 }}>+{result.score}</span>
                <span className="total">🪙 Puntos acumulados</span><span className="total">{saved.newPoints}</span>
              </div>
            )}
          </div>
        </div>

        <div className="menu-buttons">
          <button ref={playAgainRef} className="btn big block" onClick={onPlayAgain} disabled={!saved && !error}>
            🔁 VOLVER A JUGAR
          </button>
          <button className="btn yellow block" onClick={() => nav('rewards')} disabled={!saved && !error}>
            🎁 RECOMPENSAS
          </button>
          <button className="btn ghost block" onClick={() => nav('menu')} disabled={!saved && !error}>
            🏠 MENÚ PRINCIPAL
          </button>
        </div>
      </div>
    </div>
  );
}
