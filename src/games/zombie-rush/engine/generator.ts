import { PX_PER_METER, VEHICLES, type VehicleKind } from './constants';
import { difficultyAt, jumpHeight, jumpRange, speedAt } from './physics';
import { PED_LOOKS } from './looks';
import { lerp } from './rng';
import type { Bomb, Crate, Gem, Pedestrian, Platform, Segment, Vehicle } from './types';

/** Lo que el generador necesita del mundo. */
export interface WorldContent {
  ground: Segment[];
  platforms: Platform[];
  vehicles: Vehicle[];
  peds: Pedestrian[];
  bombs: Bomb[];
  gems: Gem[];
  crates: Crate[];
  nextId(): number;
  /** Tamaño actual de la horda (para dar más civiles antes de vehículos grandes). */
  hordeSize(): number;
}

type ChunkKind = 'civilians' | 'gap' | 'bomb' | 'vehicle' | 'platforms';

/** Longitud del tramo seguro al inicio de la partida. */
export const START_RUNWAY = 900;

/**
 * Genera la ciudad por tramos delante de la horda.
 *
 * Reglas para que nunca sea imposible:
 *  - Cada peligro empieza y termina con un tramo de calle libre ("pista") de
 *    al menos medio segundo de carrera + margen: nunca hay un hueco pegado a
 *    una bomba o a un vehículo.
 *  - Los huecos se calculan con el alcance real del salto a la velocidad que
 *    tendrá la horda en ese punto (la velocidad depende de la distancia).
 *  - Los huecos que exigen salto largo sólo aparecen con dificultad alta.
 *  - Todo vehículo se puede saltar o se puede caer sobre su techo.
 */
export class Generator {
  cursor = START_RUNWAY;
  private lastPower = 0;
  private last: ChunkKind = 'civilians';

  constructor(private w: WorldContent, private rng: () => number) {
    w.ground.push({ x0: -4000, x1: START_RUNWAY });
    // Primeros civiles: enseñan la mecánica sin peligros.
    this.ped(560, 0, 380, START_RUNWAY - 20);
    this.ped(760, 0, 620, START_RUNWAY - 20);
    this.gemLine(260, -24, 4, 36);
  }

  fill(untilX: number) {
    let guard = 0;
    while (this.cursor < untilX && guard++ < 50) this.chunk();
  }

  // ------------------------------------------------------------------

  private get meters() {
    return this.cursor / PX_PER_METER;
  }
  private get d() {
    return difficultyAt(this.meters);
  }
  private get speed() {
    return speedAt(this.meters);
  }
  /** Pista libre antes y después de cada peligro. */
  private runway(extra = 0) {
    return this.speed * 0.5 + 90 + extra;
  }

  private chunk() {
    const r = this.rng;
    const d = this.d;
    if (this.cursor - this.lastPower > 3800 + r() * 2200 && this.cursor > 1800) {
      this.powerChunk();
      return;
    }
    const weights: [ChunkKind, number][] = [
      ['civilians', 3.2 - 1.3 * d],
      ['gap', 1.5 + 1.7 * d],
      ['bomb', this.meters < 60 ? 0 : 1 + 1.4 * d],
      ['vehicle', this.meters < 40 ? 0.6 : 1.7 + 0.6 * d],
      ['platforms', 1.1],
    ];
    // Evita repetir el mismo peligro dos veces seguidas.
    const pool = weights.map(([k, wt]) => [k, k === this.last && k !== 'civilians' ? wt * 0.35 : wt] as const);
    const total = pool.reduce((s, [, wt]) => s + wt, 0);
    let pick = r() * total;
    let kind: ChunkKind = 'civilians';
    for (const [k, wt] of pool) {
      pick -= wt;
      if (pick <= 0) {
        kind = k;
        break;
      }
    }
    this.last = kind;
    switch (kind) {
      case 'civilians': return this.civilians();
      case 'gap': return this.gap();
      case 'bomb': return this.bomb();
      case 'vehicle': return this.vehicle();
      case 'platforms': return this.platformsChunk();
    }
  }

  /** Extiende la calle `len` px desde el cursor. */
  private flat(len: number) {
    const g = this.w.ground;
    const last = g[g.length - 1];
    if (last && last.x1 >= this.cursor - 0.5) last.x1 = this.cursor + len;
    else g.push({ x0: this.cursor, x1: this.cursor + len });
    this.cursor += len;
  }

  private ped(x: number, y: number, minX: number, maxX: number) {
    const r = this.rng;
    const look = Math.floor(r() * PED_LOOKS.length);
    const kind = PED_LOOKS[look].kind;
    this.w.peds.push({
      id: this.w.nextId(), look, x, y, minX, maxX,
      vx: 0, lane: Math.floor(r() * 3), phase: r(), panic: false,
      run: kind === 'granny' ? 34 + r() * 14 : kind === 'kid' ? 70 + r() * 30 : 55 + r() * 45,
    });
  }

  private gemLine(x: number, y: number, n: number, step: number) {
    for (let i = 0; i < n; i++) this.w.gems.push({ x: x + i * step, y, taken: false, pulled: false });
  }

  /** Arco de gemas que sugiere la trayectoria de un salto. */
  private gemArc(x0: number, x1: number, peak: number, n = 5, base = -30) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      this.w.gems.push({ x: lerp(x0, x1, t), y: base - Math.sin(Math.PI * t) * peak, taken: false, pulled: false });
    }
  }

  private civilians(len = 520 + this.rng() * 260, count?: number) {
    const r = this.rng;
    const start = this.cursor;
    this.flat(len);
    const n = count ?? 2 + Math.floor(r() * 3) + (this.d > 0.5 && r() < 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const x = start + 70 + ((len - 140) * (k + 0.5)) / n + (r() - 0.5) * 30;
      this.ped(x, 0, start + 10, start + len - 10);
    }
    if (r() < 0.7) this.gemLine(start + 40 + r() * 80, -24, 4 + Math.floor(r() * 3), 36);
  }

  private gap() {
    const r = this.rng;
    const d = this.d;
    this.flat(this.runway());
    const holes = d > 0.35 && r() < 0.3 ? 2 : 1;
    for (let h = 0; h < holes; h++) {
      const speed = this.speed;
      const tap = jumpRange(speed, false);
      // Ancho máximo con salto corto: deja margen para la caja del zombi y para reaccionar.
      let maxW = lerp(0.5, 0.78, d) * (tap - 40);
      // Con dificultad alta, a veces hace falta el salto largo (mantener pulsado).
      if (d > 0.5 && r() < 0.3) maxW = (jumpRange(speed, true) - 50) * 0.85;
      const w = 90 + r() * Math.max(0, maxW - 90);
      const x0 = this.cursor;
      this.gemArc(x0 - 30, x0 + w + 30, Math.min(110, w * 0.45));
      this.cursor += w;
      this.flat(h < holes - 1 ? this.runway(40) : this.runway());
    }
  }

  private bomb() {
    const r = this.rng;
    const d = this.d;
    this.flat(this.runway());
    const two = d > 0.45 && r() < 0.5;
    const b1 = this.cursor + 40;
    this.w.bombs.push({ id: this.w.nextId(), x: b1, y: 0, exploded: false });
    this.gemArc(b1 - 70, b1 + 70, 70, 3, -40);
    if (two) {
      // Separadas lo suficiente para aterrizar y volver a saltar.
      const gap = jumpRange(this.speed, true) + 110;
      this.flat(gap);
      const b2 = this.cursor;
      this.w.bombs.push({ id: this.w.nextId(), x: b2, y: 0, exploded: false });
      this.flat(60);
    } else {
      this.flat(80);
    }
    this.flat(this.runway());
  }

  private vehicle() {
    const r = this.rng;
    const d = this.d;
    const kinds = (Object.keys(VEHICLES) as VehicleKind[]).filter((k) => VEHICLES[k].minDifficulty <= d);
    const kind = kinds[Math.floor(r() * kinds.length)];
    const spec = VEHICLES[kind];
    const horde = this.w.hordeSize();
    // Si a la horda le faltan zombis, a veces hay civiles antes para alcanzarlo.
    if (horde < spec.req && r() < 0.7) this.civilians(420 + r() * 160, Math.min(5, 2 + Math.floor(r() * (spec.req - horde))));
    const moving = (kind === 'car' || kind === 'van') && d > 0.3 && r() < 0.35;
    const rw = this.runway();
    let x: number;
    let minX: number;
    if (moving) {
      // Tramo largo: el vehículo entra por la derecha y avanza hacia la horda.
      const start = this.cursor;
      const len = rw + 900 + spec.w;
      this.flat(len);
      x = start + len - spec.w - 60;
      minX = start + 40;
    } else {
      this.flat(rw);
      x = this.cursor;
      minX = x;
      this.flat(spec.w);
    }
    this.w.vehicles.push({
      id: this.w.nextId(), kind, x, w: spec.w, h: spec.h, req: spec.req,
      vx: moving ? -(110 + 140 * d) : 0, minX, smashed: false, smashT: 0, color: Math.floor(r() * 4),
    });
    // Gemas sobre el techo: premian caer encima.
    if (!moving) this.gemLine(x + spec.w / 2 - 36, -spec.h - 26, 3, 36);
    this.flat(rw);
  }

  private platformsChunk() {
    const r = this.rng;
    const d = this.d;
    this.flat(this.runway());
    const n = 1 + Math.floor(r() * 2.4);
    const overPit = d > 0.25 && r() < 0.5;
    const start = this.cursor;
    const reach = jumpHeight(false) - 40;
    let x = start + (overPit ? 60 : 40);
    let lastY = 0;
    for (let i = 0; i < n; i++) {
      const pw = 190 + r() * 120;
      // Cada plataforma se alcanza con un salto corto desde la anterior (o desde la calle).
      let py = -(95 + r() * 55);
      if (py < lastY - reach) py = lastY - reach;
      const p: Platform = { x0: x, x1: x + pw, y: py, kind: r() < 0.5 ? 'scaffold' : 'awning', color: Math.floor(r() * 4) };
      this.w.platforms.push(p);
      if (r() < 0.6) this.ped(x + pw * (0.4 + r() * 0.3), py, x + 8, x + pw - 8);
      this.gemLine(x + 30, py - 26, Math.max(2, Math.floor(pw / 60)), 40);
      lastY = py;
      x += pw + (i < n - 1 ? 70 + r() * 60 : 0);
    }
    const end = x + 50;
    if (overPit) {
      // Calle hundida bajo las plataformas: hay que ir por arriba.
      this.cursor = end;
    } else {
      this.flat(end - this.cursor);
    }
    this.flat(this.runway());
  }

  private powerChunk() {
    this.lastPower = this.cursor;
    this.flat(this.runway());
    const x = this.cursor + 60;
    this.flat(220);
    this.w.crates.push({ x, y: this.d < 0.3 ? -46 : -96, taken: false });
    this.flat(this.runway());
  }
}
