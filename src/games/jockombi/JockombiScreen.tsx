import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { BackIcon, PauseIcon, SoundIcon } from '../../components/Icons';
import { Confetti } from '../../components/Decorations';
import { isMuted, setMuted } from '../../game/audio';
import type { Nav } from '../../platform/navigation';
import { JockombiEngine } from './engine/Engine';
import { POWERS, VEHICLES } from './engine/constants';
import type { RunStats } from './engine/types';
import { HordePreview } from './HordePreview';
import { LEADER_NAME, JOCKOMBI_NAME } from './meta';
import { newRunId, recordRun, toPendingRun, type SyncResult, type ZombieStats } from './progress';
import { useJockombiProgress } from './useJockombiProgress';
import { JockombiLogo } from './JockombiLogo';

type Phase = 'home' | 'play' | 'over';

interface Finished {
  run: RunStats;
  before: ZombieStats;
  save: SyncResult | 'saving';
}

/** Jockombi: inicio → partida → resultados, dentro de una sola pantalla de la plataforma. */
export function JockombiScreen({ nav }: { nav: Nav }) {
  const { user } = useAuth();
  const progress = useJockombiProgress(user?.uid);
  const [phase, setPhase] = useState<Phase>('home');
  const [runKey, setRunKey] = useState(0);
  const [finished, setFinished] = useState<Finished | null>(null);
  const beforeRef = useRef<ZombieStats>(progress.stats);

  const play = useCallback(() => {
    beforeRef.current = progress.stats;
    setFinished(null);
    setRunKey((k) => k + 1);
    setPhase('play');
  }, [progress.stats]);

  const onGameOver = useCallback((run: RunStats) => {
    const before = beforeRef.current;
    setFinished({ run, before, save: 'saving' });
    setPhase('over');
    if (!user) return;
    // Se guarda primero en este dispositivo y luego en la nube (sin duplicar).
    recordRun(user.uid, toPendingRun(newRunId(), run)).then((save) =>
      setFinished((f) => (f && f.run === run ? { ...f, save } : f)),
    );
  }, [user]);

  if (phase === 'play') {
    return (
      <PlayView
        key={runKey}
        best={beforeRef.current.bestDistance}
        onGameOver={onGameOver}
        onRestart={play}
        onHome={() => setPhase('home')}
        onMenu={() => nav('menu')}
      />
    );
  }
  if (phase === 'over' && finished) {
    return <ResultsView data={finished} onPlayAgain={play} onHome={() => setPhase('home')} onMenu={() => nav('menu')} />;
  }
  return <HomeView stats={progress.stats} pending={progress.pendingCount} cloud={progress.cloudState} onPlay={play} onMenu={() => nav('menu')} />;
}

// ---------------------------------------------------------------- Inicio

function HomeView({ stats, pending, cloud, onPlay, onMenu }: {
  stats: ZombieStats;
  pending: number;
  cloud: string;
  onPlay: () => void;
  onMenu: () => void;
}) {
  const playRef = useRef<HTMLButtonElement>(null);
  useEffect(() => playRef.current?.focus(), []);
  const portrait = typeof window !== 'undefined' && window.matchMedia('(orientation: portrait) and (max-width: 700px)').matches;

  return (
    <div className="screen zr-screen">
      <div className="content zr-content">
        <div className="topbar">
          <button className="icon-btn zr-icon" onClick={onMenu} aria-label="Volver al menú de juegos"><BackIcon /></button>
          <span className="zr-chip">Endless runner</span>
          <span style={{ width: 42 }} />
        </div>

        <JockombiLogo />
        <div className="zr-hero">
          <HordePreview count={8} night className="zr-hero-canvas" />
        </div>
        <p className="zr-tagline">
          Guía a {LEADER_NAME}, el Border Collie zombi, contagia a otros perritos y haz crecer la jauría más grande.
        </p>

        <button ref={playRef} className="btn big block zr-play" onClick={onPlay}>JUGAR</button>

        <div className="zr-stats">
          <div className="zr-stat"><span>Récord</span><strong>{stats.bestDistance} m</strong></div>
          <div className="zr-stat"><span>Mayor jauría</span><strong>{stats.maxHorde}</strong></div>
          <div className="zr-stat"><span>Contagiados</span><strong>{stats.totalConverted}</strong></div>
          <div className="zr-stat"><span>Partidas</span><strong>{stats.gamesPlayed}</strong></div>
        </div>
        {(pending > 0 || cloud === 'unavailable') && (
          <p className="zr-note">
            {pending > 0
              ? `${pending} ${pending === 1 ? 'partida guardada' : 'partidas guardadas'} en este dispositivo · se ${pending === 1 ? 'sincronizará' : 'sincronizarán'} solas.`
              : 'Progreso guardado en este dispositivo; se sincronizará cuando haya conexión.'}
          </p>
        )}

        <div className="zr-card">
          <h2>Cómo se juega</h2>
          <ul className="zr-howto">
            <li><b>Saltar:</b> toca la pantalla, clic, Espacio o ↑. <b>Mantén</b> para saltar más alto y más lejos.</li>
            <li><b>Perritos:</b> tócalos para contagiarlos. Cada uno se une a tu jauría.</li>
            <li><b>Huecos y bombas:</b> los perritos que caen o están cerca de la explosión se pierden.</li>
            <li>
              <b>Vehículos:</b> el número indica cuántos perritos necesitas para aplastarlo
              (auto {VEHICLES.car.req}, furgoneta {VEHICLES.van.req}, bus {VEHICLES.bus.req}, blindado {VEHICLES.armored.req}).
              Si no alcanzas, ¡sáltalo o cae sobre el techo!
            </li>
            <li><b>Cajas ?:</b> {Object.values(POWERS).map((p) => p.label).join(', ')}.</li>
            <li>La partida termina cuando no queda ningún perrito. <b>P</b> o <b>Esc</b> pausa.</li>
          </ul>
        </div>
        {portrait && <p className="zr-note">Consejo: gira el teléfono para ver más calle.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Partida

function PlayView({ best, onGameOver, onRestart, onHome, onMenu }: {
  best: number;
  onGameOver: (r: RunStats) => void;
  onRestart: () => void;
  onHome: () => void;
  onMenu: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<JockombiEngine | null>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const [hint, setHint] = useState(true);
  const latest = useRef({ onGameOver, togglePause: () => {} });
  latest.current.onGameOver = onGameOver;

  const setPause = useCallback((p: boolean) => {
    const e = engineRef.current;
    if (!e || e.world.state !== 'running') return;
    e.setPaused(p);
    setPaused(p);
  }, []);
  latest.current.togglePause = () => setPause(!engineRef.current?.isPaused);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const engine = new JockombiEngine(canvas, {
      bestDistance: best,
      onGameOver: (r) => latest.current.onGameOver(r),
      onPauseKey: () => latest.current.togglePause(),
    });
    engineRef.current = engine;
    engine.start();
    canvas.focus();
    const onVisibility = () => {
      if (document.hidden) setPause(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    const hintTimer = setTimeout(() => setHint(false), 4500);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(hintTimer);
      engine.destroy();
      engineRef.current = null;
    };
    // El motor se crea una sola vez por partida (la `key` del componente cambia al reiniciar).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };
  const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  return (
    <div className="game-root zr-root">
      <canvas ref={canvasRef} tabIndex={0} aria-label={`Juego ${JOCKOMBI_NAME}`} />
      <div className="zr-hud-actions">
        <button className="icon-btn zr-icon" onClick={toggleMute} aria-label={muted ? 'Activar sonido' : 'Silenciar'}>
          <SoundIcon muted={muted} />
        </button>
        <button className="icon-btn zr-icon" onClick={() => setPause(true)} aria-label="Pausa"><PauseIcon /></button>
      </div>
      {hint && !paused && (
        <div className="hint zr-hint">
          {isTouch ? 'Toca para saltar · mantén para saltar más' : 'Espacio / ↑ / clic para saltar · mantén para saltar más'}
        </div>
      )}
      {paused && (
        <div className="pause-overlay zr-pause">
          <div className="zr-card center" style={{ width: '100%', maxWidth: 340 }}>
            <h2>En pausa</h2>
            <p className="zr-muted">La jauría te espera.</p>
            <div className="menu-buttons">
              <button className="btn big block zr-play" onClick={() => setPause(false)}>Continuar</button>
              <button className="btn sage block" onClick={onRestart}>Reiniciar</button>
              <button className="btn ghost block" onClick={onHome}>Inicio de {JOCKOMBI_NAME}</button>
              <button className="btn ghost block" onClick={onMenu}>Menú de juegos</button>
            </div>
            <p className="zr-muted" style={{ fontSize: '0.85rem', marginBottom: 0 }}>
              Si sales o reinicias, esta partida no se guarda.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Resultados

function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

const SAVE_TEXT: Record<Finished['save'], string> = {
  saving: 'Guardando...',
  synced: 'Progreso guardado en tu cuenta ✓',
  pending: 'Guardado en este dispositivo · se sincronizará con tu cuenta automáticamente.',
  offline: 'Sin conexión: guardado en este dispositivo · se sincronizará al volver internet.',
};

function ResultsView({ data, onPlayAgain, onHome, onMenu }: {
  data: Finished;
  onPlayAgain: () => void;
  onHome: () => void;
  onMenu: () => void;
}) {
  const { run, before, save } = data;
  const distance = useCountUp(run.distance);
  const newRecord = run.distance > before.bestDistance;
  const newHorde = run.maxHorde > before.maxHorde;
  const playRef = useRef<HTMLButtonElement>(null);
  useEffect(() => playRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onPlayAgain();
      }
    };
    // Pequeña espera: que el salto que terminó la partida no reinicie sin querer.
    const t = setTimeout(() => window.addEventListener('keydown', onKey), 600);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [onPlayAgain]);

  return (
    <div className="screen zr-screen">
      {newRecord && run.distance > 0 && <Confetti count={40} />}
      <div className="content zr-content zr-results">
        <h1 className="zr-over-title">¡La jauría cayó!</h1>
        <div className="zr-card center zr-pop">
          <div className="zr-muted">Distancia</div>
          <div className="zr-big">{distance} m</div>
          {newRecord && before.bestDistance > 0 && <div className="zr-record">¡Nuevo récord!</div>}
          {newRecord && before.bestDistance === 0 && run.distance > 0 && <div className="zr-record">¡Primer récord!</div>}
          <div className="zr-compare">
            <span>Récord anterior</span><strong>{before.bestDistance} m</strong>
            <span>Récord actual</span><strong>{Math.max(before.bestDistance, run.distance)} m</strong>
          </div>
        </div>
        <div className="zr-stats">
          <div className={`zr-stat ${newHorde ? 'hot' : ''}`}><span>Mayor jauría</span><strong>{run.maxHorde}</strong>{newHorde && <em>récord</em>}</div>
          <div className="zr-stat"><span>Contagiados</span><strong>{run.converted}</strong></div>
          <div className="zr-stat"><span>Gemas</span><strong>{run.gems}</strong></div>
          <div className="zr-stat"><span>Vehículos</span><strong>{run.vehiclesSmashed}</strong></div>
        </div>
        <p className={`zr-note ${save === 'synced' ? 'ok' : ''}`}>{SAVE_TEXT[save]}</p>
        <div className="menu-buttons">
          <button ref={playRef} className="btn big block zr-play" onClick={onPlayAgain}>VOLVER A JUGAR</button>
          <div className="menu-grid">
            <button className="btn ghost" onClick={onHome}>Inicio del juego</button>
            <button className="btn ghost" onClick={onMenu}>MENÚ PRINCIPAL</button>
          </div>
        </div>
      </div>
    </div>
  );
}
