import { MAX_STEPS_PER_FRAME, MIN_VIRTUAL_W, MIN_VIRTUAL_W_PORTRAIT, STEP, VIRTUAL_H } from './constants';
import { attachJumpInput } from './input';
import { Renderer, type View } from './render';
import { playSounds } from './sfx';
import { LEADER_SCREEN, LEADER_SCREEN_PORTRAIT, World } from './world';
import type { RunStats } from './types';

export interface EngineOptions {
  /** Récord personal en metros (se muestra en el HUD). */
  bestDistance: number;
  seed?: number;
  onGameOver: (stats: RunStats) => void;
  /** El jugador pidió pausar con el teclado (P / Esc). */
  onPauseKey: () => void;
}

/**
 * Motor de Zombie Rush: un único bucle requestAnimationFrame que avanza la
 * simulación con paso fijo (misma física a 30, 60 o 144 Hz) y dibuja.
 * `destroy()` cancela el bucle y quita todos los listeners: una partida
 * anterior nunca puede seguir modificando una nueva.
 */
export class ZombieRushEngine {
  readonly world: World;
  private renderer: Renderer;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private paused = false;
  private destroyed = false;
  private finished = false;
  private detachInput: () => void;
  private resizeObserver: ResizeObserver;

  constructor(private canvas: HTMLCanvasElement, private opts: EngineOptions) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D no disponible');
    this.world = new World({ seed: opts.seed, bestDistance: opts.bestDistance });
    this.renderer = new Renderer(ctx);
    this.resize();
    this.renderer.sprites.warm();
    this.detachInput = attachJumpInput(canvas, {
      onPress: () => {
        if (!this.paused) this.world.press();
      },
      onRelease: () => this.world.release(),
      onPause: () => this.opts.onPauseKey(),
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    if (import.meta.env.DEV) (window as unknown as { __zombieRush?: ZombieRushEngine }).__zombieRush = this;
  }

  start() {
    if (this.raf || this.destroyed) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  get isPaused() {
    return this.paused;
  }

  setPaused(p: boolean) {
    if (this.destroyed) return;
    this.paused = p;
    this.world.release();
    this.last = performance.now();
    this.acc = 0;
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.detachInput();
    this.resizeObserver.disconnect();
    const g = window as unknown as { __zombieRush?: ZombieRushEngine };
    if (g.__zombieRush === this) delete g.__zombieRush;
  }

  private frame = (now: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    // Límite de 0,1 s: al volver de otra pestaña no hay un "salto" de simulación.
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (!this.paused) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= STEP && n < MAX_STEPS_PER_FRAME) {
        this.world.step(STEP);
        this.acc -= STEP;
        n++;
      }
      if (n === MAX_STEPS_PER_FRAME) this.acc = 0;
      playSounds(this.world.sounds);
    }
    this.renderer.draw(this.world, this.opts.bestDistance);
    if (this.world.state === 'over' && !this.finished) {
      this.finished = true;
      this.opts.onGameOver(this.world.result());
    }
  };

  private resize() {
    const parent = this.canvas.parentElement ?? this.canvas;
    const W = parent.clientWidth || window.innerWidth;
    const H = parent.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    // Horizontal: se ven al menos 480 de alto y 640 de ancho virtuales.
    // Vertical (celular de pie): se acerca la cámara y el líder va más atrás.
    const portrait = H > W * 1.1;
    const scale = Math.min(H / VIRTUAL_H, W / (portrait ? MIN_VIRTUAL_W_PORTRAIT : MIN_VIRTUAL_W));
    const vw = W / scale;
    const vh = H / scale;
    const groundY = portrait ? Math.max(400, vh * 0.6) : Math.min(vh * 0.8, 400 + (vh - VIRTUAL_H) * 0.45);
    const view: View = { W, H, dpr, scale, vw, vh, groundY };
    this.renderer.setView(view);
    this.world.setViewWidth(vw, portrait ? LEADER_SCREEN_PORTRAIT : LEADER_SCREEN);
    if (this.raf) this.renderer.draw(this.world, this.opts.bestDistance);
  }
}
