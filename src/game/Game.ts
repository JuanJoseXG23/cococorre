import { attachInput } from './input';
import { difficultyAt, LaneGenerator } from './generator';
import { drawScene, type View } from './render';
import { sfx } from './audio';
import type { CharacterSkin } from './characters';
import {
  COLS, HEART_BONUS, HOP_TIME,
  type DeathCause, type Direction, type GameResult, type Lane, type Mover,
} from './types';

export interface GameCallbacks {
  onScore: (score: number) => void;
  onGameOver: (result: GameResult) => void;
}

export interface GameOptions {
  speedMultiplier: number;
  skin: CharacterSkin;
  callbacks: GameCallbacks;
}

export interface Player {
  x: number;
  row: number;
  fromX: number;
  fromRow: number;
  toX: number;
  toRow: number;
  /** Progreso del salto 0..1, o -1 si está quieto. */
  hop: number;
  facing: Direction;
  /** Tiempo desde la muerte (s). */
  deadFor: number;
  cause: DeathCause | null;
  /** Dirección en la que lo empujó el tren / auto (animación). */
  knock: number;
}

export interface Particle {
  x: number;
  row: number;
  z: number;
  vx: number;
  vrow: number;
  vz: number;
  life: number;
  max: number;
  color: string;
  kind: 'dust' | 'spark' | 'heart' | 'drop';
}

const MOVER_MIN = -8;
const TRAIN_LEN = 12;

/**
 * Motor del juego: mantiene el mundo, procesa la entrada, detecta colisiones
 * y dibuja en un <canvas>. Los carriles se crean delante de la jugadora y se
 * eliminan detrás, así el mapa es infinito sin usar más memoria.
 */
export class Game {
  readonly lanes = new Map<number, Lane>();
  readonly particles: Particle[] = [];
  readonly player: Player = {
    x: Math.floor(COLS / 2), row: 0, fromX: 0, fromRow: 0, toX: 0, toRow: 0,
    hop: -1, facing: 'down', deadFor: 0, cause: null, knock: 0,
  };
  camRow = 0;
  time = 0;
  score = 0;
  maxRow = 0;
  hearts = 0;
  alive = true;
  started = false;

  private ctx: CanvasRenderingContext2D;
  private view: View = { W: 1, H: 1, T: 40, baseY: 1, offsetX: 0, dpr: 1 };
  private generator: LaneGenerator;
  private queued: Direction | null = null;
  private raf = 0;
  private last = 0;
  private paused = false;
  private finished = false;
  private elapsed = 0;
  private bump = 0;
  private detachInput: () => void;
  private resizeObserver: ResizeObserver;

  constructor(private canvas: HTMLCanvasElement, private opts: GameOptions) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D no disponible');
    this.ctx = ctx;
    this.generator = new LaneGenerator(opts.speedMultiplier);
    this.ensureLanes();
    this.detachInput = attachInput(canvas, (d) => this.move(d));
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();
  }

  get skin() {
    return this.opts.skin;
  }

  start() {
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (!p) this.last = performance.now();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.detachInput();
    this.resizeObserver.disconnect();
    this.lanes.clear();
    this.particles.length = 0;
  }

  /** Mover a Coco (también lo usan los botones táctiles). */
  move(dir: Direction) {
    if (!this.alive || this.paused) return;
    const p = this.player;
    if (p.hop >= 0) {
      this.queued = dir;
      return;
    }
    const dr = dir === 'up' ? 1 : dir === 'down' ? -1 : 0;
    const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    p.facing = dir;
    const targetRow = p.row + dr;
    const target = this.lane(targetRow);
    let tx = p.x + dx;
    if (target.type !== 'river') tx = Math.round(tx);
    if (tx < -0.45 || tx > COLS - 0.55) {
      this.bump = 0.12;
      return;
    }
    if (target.type === 'grass' && target.trees.has(Math.round(tx))) {
      this.bump = 0.12;
      return;
    }
    p.fromX = p.x;
    p.fromRow = p.row;
    p.toX = tx;
    p.toRow = targetRow;
    p.hop = 0;
    this.started = true;
    sfx.hop();
    this.spawn(p.x + 0.5, p.row, 3, 'dust', '#ffffff');
  }

  // ------------------------------------------------------------------

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) this.update(dt);
    drawScene(this.ctx, this, this.view);
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
    // Casilla: que quepan las 9 columnas en móvil y ~11 filas en escritorio.
    const T = Math.max(18, Math.min(W / (COLS + 1), H / 11));
    this.view = { W, H, T, baseY: H * 0.7, offsetX: W / 2 - (COLS * T) / 2, dpr };
  }

  lane(row: number): Lane {
    let l = this.lanes.get(row);
    if (!l) {
      l = this.generator.create(row);
      this.lanes.set(row, l);
    }
    return l;
  }

  private ensureLanes() {
    const rowsAbove = Math.ceil(this.view.baseY / this.view.T) + 4;
    const rowsBelow = Math.ceil((this.view.H - this.view.baseY) / this.view.T) + 3;
    const top = Math.ceil(Math.max(this.camRow, this.player.row)) + rowsAbove;
    // Se generan en orden para que los grupos de carriles tengan sentido.
    let r = Math.max(...this.lanes.keys(), -1) + 1;
    for (; r <= top; r++) this.lane(r);
    const minRow = Math.floor(this.camRow) - rowsBelow;
    for (const key of this.lanes.keys()) {
      if (key < minRow) this.lanes.delete(key);
    }
    // Filas detrás del inicio: pasto decorativo.
    for (let b = minRow; b < 0; b++) if (!this.lanes.has(b)) this.lanes.set(b, this.generator.create(b));
  }

  private update(dt: number) {
    this.time += dt;
    if (this.bump > 0) this.bump -= dt;
    if (this.started && this.alive) this.elapsed += dt;
    this.updateLanes(dt);
    this.updatePlayer(dt);
    this.updateParticles(dt);
    this.updateCamera(dt);
    this.ensureLanes();
  }

  private updateLanes(dt: number) {
    const minVisible = this.camRow - 12;
    for (const lane of this.lanes.values()) {
      if (lane.type === 'rail') {
        this.updateRail(lane, dt, lane.row > minVisible);
        continue;
      }
      if (lane.speed === 0) continue;
      const step = lane.dir * lane.speed * dt;
      for (const m of lane.movers) {
        m.x += step;
        if (lane.dir > 0 && m.x >= MOVER_MIN + lane.loop) m.x -= lane.loop;
        else if (lane.dir < 0 && m.x + m.len < MOVER_MIN) m.x += lane.loop;
      }
    }
  }

  private updateRail(lane: Lane, dt: number, visible: boolean) {
    if (!lane.trainActive) {
      const before = lane.trainTimer;
      lane.trainTimer -= dt;
      if (visible && this.alive && before > 1.3 && lane.trainTimer <= 1.3) sfx.bell();
      if (lane.trainTimer <= 0) {
        lane.trainActive = true;
        lane.movers = [{
          kind: 'train', len: TRAIN_LEN, color: '#ef476f',
          x: lane.dir > 0 ? MOVER_MIN - TRAIN_LEN : COLS - MOVER_MIN,
        }];
      }
      return;
    }
    const t = lane.movers[0];
    t.x += lane.dir * lane.speed * dt;
    if ((lane.dir > 0 && t.x > COLS - MOVER_MIN) || (lane.dir < 0 && t.x + t.len < MOVER_MIN)) {
      lane.trainActive = false;
      lane.movers = [];
      lane.trainTimer = lane.trainPeriod * (0.8 + Math.random() * 0.4);
    }
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    if (!this.alive) {
      p.deadFor += dt;
      if (p.cause === 'train' || p.cause === 'car') p.x += p.knock * dt * (p.cause === 'train' ? 14 : 0);
      if (p.deadFor > 1.4 && !this.finished) {
        this.finished = true;
        this.opts.callbacks.onGameOver({
          score: this.score,
          maxRow: this.maxRow,
          hearts: this.hearts,
          durationMs: Math.round(this.elapsed * 1000),
          cause: p.cause ?? 'car',
        });
      }
      return;
    }

    if (p.hop >= 0) {
      p.hop += dt / HOP_TIME;
      // Si salta desde un tronco, el destino se sigue moviendo con el río.
      const t = Math.min(1, p.hop);
      p.x = p.fromX + (p.toX - p.fromX) * t;
      p.row = t < 0.5 ? p.fromRow : p.toRow;
      if (p.hop >= 1) {
        p.hop = -1;
        p.x = p.toX;
        p.row = p.toRow;
        this.land();
        if (this.alive && this.queued) {
          const q = this.queued;
          this.queued = null;
          this.move(q);
        }
      }
    } else {
      const lane = this.lane(p.row);
      if (lane.type === 'river') {
        const under = this.moverUnder(lane, p.x + 0.5);
        if (under && lane.speed) p.x += lane.dir * lane.speed * dt;
        if (p.x + 0.5 < 0 || p.x + 0.5 > COLS) return this.die('swept');
      }
    }
    this.checkCollisions();
  }

  private land() {
    const p = this.player;
    const lane = this.lane(p.row);
    if (lane.type === 'river') {
      const m = this.moverUnder(lane, p.x + 0.5);
      if (!m) return this.die('water');
      if (m.kind === 'lily') p.x = m.x;
    } else {
      p.x = Math.round(p.x);
      this.spawn(p.x + 0.5, p.row, 4, 'dust', '#ffffff');
    }
    if (p.row > this.maxRow) {
      this.maxRow = p.row;
      this.updateScore();
    }
    if (lane.type === 'grass' && lane.hearts.has(p.x)) {
      lane.hearts.delete(p.x);
      this.hearts++;
      sfx.heart();
      this.spawn(p.x + 0.5, p.row, 10, 'heart', '#ff4f81');
      this.updateScore();
    }
  }

  private moverUnder(lane: Lane, cx: number): Mover | undefined {
    return lane.movers.find((m) => cx >= m.x - 0.15 && cx <= m.x + m.len + 0.15);
  }

  private checkCollisions() {
    const p = this.player;
    const lane = this.lane(p.row);
    if (lane.type !== 'road' && lane.type !== 'rail') return;
    const left = p.x + 0.22;
    const right = p.x + 0.78;
    for (const m of lane.movers) {
      if (right > m.x + 0.06 && left < m.x + m.len - 0.06) {
        p.knock = lane.dir;
        return this.die(m.kind === 'train' ? 'train' : 'car');
      }
    }
  }

  private updateCamera(dt: number) {
    const p = this.player;
    if (this.started && this.alive) {
      const d = difficultyAt(this.maxRow);
      this.camRow += (0.22 + 0.5 * d) * dt;
    }
    if (p.row > this.camRow) this.camRow += (p.row - this.camRow) * Math.min(1, dt * 6);
    const rowsBelow = (this.view.H - this.view.baseY) / this.view.T;
    if (this.alive && p.row < this.camRow - rowsBelow + 0.6) this.die('eagle');
  }

  private updateScore() {
    const s = this.maxRow + this.hearts * HEART_BONUS;
    if (s !== this.score) {
      this.score = s;
      this.opts.callbacks.onScore(s);
    }
  }

  private die(cause: DeathCause) {
    if (!this.alive) return;
    this.alive = false;
    this.player.cause = cause;
    this.player.deadFor = 0;
    this.player.hop = -1;
    if (cause === 'water') {
      sfx.splash();
      this.spawn(this.player.x + 0.5, this.player.row, 14, 'drop', '#bfeaff');
    } else {
      sfx.crash();
      this.spawn(this.player.x + 0.5, this.player.row, 12, 'spark', '#ffd54f');
    }
  }

  private spawn(x: number, row: number, n: number, kind: Particle['kind'], color: string) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = kind === 'dust' ? 0.6 : 1.6;
      this.particles.push({
        x, row, z: 0.1,
        vx: Math.cos(a) * sp * Math.random(),
        vrow: Math.sin(a) * sp * Math.random() * 0.6,
        vz: kind === 'dust' ? 0.4 : 1.5 + Math.random() * 2,
        life: 0, max: kind === 'dust' ? 0.35 : 0.9, color, kind,
      });
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.life += dt;
      q.x += q.vx * dt;
      q.row += q.vrow * dt;
      q.z = Math.max(0, q.z + q.vz * dt);
      q.vz -= (q.kind === 'heart' ? 1.5 : 6) * dt;
      if (q.life >= q.max) this.particles.splice(i, 1);
    }
  }

  /** Desplazamiento lateral de "choque" contra un árbol o borde. */
  get bumpOffset() {
    return this.bump > 0 ? Math.sin(this.bump * 80) * 0.04 : 0;
  }
}
