import { useEffect, useRef, useState } from 'react';
import { Game } from '../game/Game';
import { getSavedSkin } from '../game/characters';
import { isMuted, setMuted, sfx } from '../game/audio';
import { MAX_LEVEL } from '../game/difficulty';
import type { GameResult } from '../game/types';
import { useAuth } from '../auth/AuthContext';
import { PauseIcon, SoundIcon } from '../components/Icons';

interface Toast {
  id: number;
  text: string;
  kind?: 'record' | 'level';
}

export function GameScreen({ onGameOver, onExit }: { onGameOver: (r: GameResult) => void; onExit: () => void }) {
  const { profile, config } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const [showHint, setShowHint] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  const highScore = profile?.highScore ?? 0;
  // Referencias para usar valores actuales dentro de los callbacks del motor.
  const latest = useRef({ highScore, config, recordShown: false, onGameOver });
  latest.current.highScore = highScore;
  latest.current.config = config;
  latest.current.onGameOver = onGameOver;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const game = new Game(canvas, {
      speedMultiplier: config.speedMultiplier || 1,
      skin: getSavedSkin(),
      callbacks: {
        onScore: (s) => {
          setScore(s);
          setShowHint(false);
          const l = latest.current;
          if (!l.recordShown && l.highScore > 0 && s > l.highScore) {
            l.recordShown = true;
            sfx.milestone();
            setToast({ id: Date.now(), text: `Nuevo récord\n${l.config.recordMessage}`, kind: 'record' });
          } else if (l.config.milestoneEvery > 0 && s > 0 && s % l.config.milestoneEvery === 0) {
            const msgs = l.config.milestoneMessages;
            if (msgs.length) {
              sfx.milestone();
              const idx = Math.floor(s / l.config.milestoneEvery - 1) % msgs.length;
              setToast({ id: Date.now(), text: msgs[idx] });
            }
          }
        },
        onLevel: (lvl) => {
          setLevel(lvl);
          setToast((t) =>
            t?.kind === 'record' ? t : {
              id: Date.now(),
              text: lvl === MAX_LEVEL ? `Nivel ${lvl} · máximo` : `Nivel ${lvl}`,
              kind: 'level',
            },
          );
        },
        onGameOver: (r) => latest.current.onGameOver(r),
      },
    });
    gameRef.current = game;
    game.start();
    canvas.focus();

    const onVisibility = () => {
      if (document.hidden) {
        game.setPaused(true);
        setPaused(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      game.destroy();
      gameRef.current = null;
    };
    // El juego se crea una sola vez por montaje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3100);
    return () => clearTimeout(t);
  }, [toast]);

  const togglePause = () => {
    const p = !paused;
    setPaused(p);
    gameRef.current?.setPaused(p);
  };

  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  return (
    <div className="game-root">
      <canvas ref={canvasRef} tabIndex={0} aria-label="Juego CoCoCorre" />
      <div className="hud">
        <div className="hud-score">
          <div className="points">PUNTOS: {score}</div>
          <div className="record">RÉCORD: {Math.max(highScore, score)}</div>
          <span className="level-tag">Nivel {level}</span>
        </div>
        <div className="hud-actions">
          <button className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Activar sonido' : 'Silenciar'}>
            <SoundIcon muted={muted} />
          </button>
          <button className="icon-btn" onClick={togglePause} aria-label="Pausa"><PauseIcon /></button>
        </div>
      </div>
      {showHint && (
        <div className="hint">
          {isTouch ? 'Toca para avanzar · desliza para moverte' : 'Usa las flechas o WASD para mover a Coco'}
        </div>
      )}
      {toast && (
        <div key={toast.id} className={`toast ${toast.kind ?? ''}`} style={{ whiteSpace: 'pre-line' }}>
          {toast.text}
        </div>
      )}
      {paused && (
        <div className="pause-overlay">
          <div className="card center" style={{ width: '100%', maxWidth: 340 }}>
            <h2>En pausa</h2>
            <p className="muted">Coco te espera.</p>
            <div className="menu-buttons">
              <button className="btn big block" onClick={togglePause}>Continuar</button>
              <button className="btn ghost block" onClick={onExit}>Salir al menú</button>
            </div>
            <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 0 }}>
              Si sales ahora, esta partida no suma puntos.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
