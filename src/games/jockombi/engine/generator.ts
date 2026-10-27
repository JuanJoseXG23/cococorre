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
  /** Tamaño actual de la jauría (para dar más perritos antes de vehículos grandes). */
  hordeSize(): number;
}

type ChunkKind = 'strays' | 'gap' | 'bomb' | 'vehicle' | 'platforms';

/** Longitud del tramo seguro al inicio de la partida. */
export const START_RUNWAY = 900;

/**
 * Genera la ciudad por tramos delante de la jauría.
 *
 * Reglas para que nunca sea imposible:
 *  - Cada peligro empieza y termina con un tramo de calle libre ("pista") de
 *    al menos medio segundo de carrera + margen: nunca hay un hueco pegado a
 *    una bomba o a un vehículo.
 *  - Los huecos se calculan con el alcance real del salto a la velocidad que
 *    tendrá la jauría en ese punto (la velocidad depende de la distancia).
 *  - Los huecos que exigen salto largo sólo aparecen con dificultad alta.
 *  - Todo vehículo se puede saltar o se puede caer sobre su techo.
 */
export class Generator {
  cursor = START_RUNWAY;
  private lastPower = 0;
  private last: ChunkKind = 'strays';

  constructor(private w: WorldContent, private rng: () => number) {
    w.ground.push({ x0: -4000, x1: START_RUNWAY });
    // Primeros perritos: enseñan la mecánica sin peligros.
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
    // Se acorta con la dificultad: los peligros llegan casi seguidos.
    const d = this.d;
    return this.speed * lerp(0.42, 0.3, d) + lerp(80, 50, d) + extra;
  }

  private chunk() {
    const r = this.rng;
    const d = this.d;
    if (this.cursor - this.lastPower > 3800 + r() * 2200 && this.cursor > 1800) {
      this.powerChunk();
      return;
    }
    const weights: [ChunkKind, number][] = [
      ['strays', 2.4 - 1.2 * d],
      ['gap', 2 + 2 * d],
      ['bomb', this.meters < 40 ? 0 : 1.4 + 1.6 * d],
      ['vehicle', this.meters < 40 ? 0.6 : 1.8 + 0.8 * d],
      ['platforms', 1.1],
    ];
    // Evita repetir el mismo peligro dos veces seguidas.
    const pool = weights.map(([k, wt]) => [k, k === this.last && k !== 'strays' ? wt * 0.35 : wt] as const);
    const total = pool.reduce((s, [, wt]) => s + wt, 0);
    let pick = r() * total;
    let kind: ChunkKind = 'strays';
    for (const [k, wt] of pool) {
      pick -= wt;
      if (pick <= 0) {
        kind = k;
        break;
      }
    }
    this.last = kind;
    switch (kind) {
      case 'strays': return this.strays();
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
    // Los perritos grandes huyen más rápido que los pequeños (patas cortas = más lentos).
    const l = PED_LOOKS[look];
    this.w.peds.push({
      id: this.w.nextId(), look, x, y, minX, maxX,
      vx: 0, lane: Math.floor(r() * 3), phase: r(), panic: false,
      run: (70 + l.legH * 6 + r() * 40) * lerp(1, 1.35, this.d),
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

  private strays(len = 520 + this.rng() * 260, count?: number) {
    const r = this.rng;
    const start = this.cursor;
    this.flat(len);
    // Pocos perritos sueltos: cada uno cuenta.
    const n = count ?? 1 + Math.floor(r() * (2.6 - this.d));
    for (let k = 0; k < n; k++) {
      const x = start + 70 + ((len - 140) * (k + 0.5)) / n + (r() - 0.5) * 30;
      this.ped(x, 0, start + 10, start + len - 10);
    }
    // A veces uno espera encima de una caseta: hay que saltar justo para alcanzarlo.
    if (r() < 0.35) {
      const px = start + 120 + r() * (len - 320);
      const py = -(50 + r() * 25);
      this.w.platforms.push({ x0: px, x1: px + 110, y: py, kind: 'awning', color: Math.floor(r() * 4) });
      this.ped(px + 55, py, px + 8, px + 102);
    }
    if (r() < 0.7) this.gemLine(start + 40 + r() * 80, -24, 4 + Math.floor(r() * 3), 36);
  }

  private gap() {
    const r = this.rng;
    const d = this.d;
    this.flat(this.runway());
    // Con dificultad, series de 2 o 3 huecos con poca calle entre ellos.
    const holes = d > 0.2 && r() < 0.25 + 0.35 * d ? (d > 0.55 && r() < 0.4 ? 3 : 2) : 1;
    for (let h = 0; h < holes; h++) {
      const speed = this.speed;
      const tap = jumpRange(speed, false);
      // Ancho máximo con salto corto: deja margen para la caja del zombi y para reaccionar.
      let maxW = lerp(0.62, 0.88, d) * (tap - 30);
      // A veces hace falta el salto largo (mantener pulsado).
      if (d > 0.25 && r() < 0.2 + 0.25 * d) maxW = (jumpRange(speed, true) - 50) * 0.88;
      const minW = lerp(100, 140, d);
      const w = minW + r() * Math.max(0, maxW - minW);
      const x0 = this.cursor;
      this.gemArc(x0 - 30, x0 + w + 30, Math.min(70, w * 0.4));
      this.cursor += w;
      // Entre huecos de una serie: lo justo para aterrizar y volver a saltar.
      this.flat(h < holes - 1 ? Math.max(120, speed * 0.28) : this.runway());
    }
  }

  private bomb() {
    const r = this.rng;
    const d = this.d;
    this.flat(this.runway());
    // Filas de bombas: hay que encadenar saltos con buen ritmo.
    const n = d > 0.15 && r() < 0.3 + 0.4 * d ? (d > 0.5 && r() < 0.45 ? 3 : 2) : 1;
    const b1 = this.cursor + 40;
    this.w.bombs.push({ id: this.w.nextId(), x: b1, y: 0, exploded: false });
    this.gemArc(b1 - 70, b1 + 70, 50, 3, -40);
    for (let i = 1; i < n; i++) {
      // Separadas lo justo para aterrizar y volver a saltar.
      this.flat(jumpRange(this.speed, false) + lerp(130, 80, d) + (i === 1 ? 40 : 0));
      this.w.bombs.push({ id: this.w.nextId(), x: this.cursor, y: 0, exploded: false });
    }
    this.flat(n > 1 ? 60 : 80);
    this.flat(this.runway());
  }

  private vehicle() {
    const r = this.rng;
    const d = this.d;
    const kinds = (Object.keys(VEHICLES) as VehicleKind[]).filter((k) => VEHICLES[k].minDifficulty <= d);
    const kind = kinds[Math.floor(r() * kinds.length)];
    const spec = VEHICLES[kind];
    const horde = this.w.hordeSize();
    // Si a la jauría le faltan perritos, a veces hay perritos antes para alcanzarlo.
    if (horde < spec.req && r() < 0.45) this.strays(420 + r() * 160, Math.min(3, 1 + Math.floor(r() * (spec.req - horde))));
    const moving = (kind === 'car' || kind === 'van') && d > 0.2 && r() < 0.45;
    const rw = this.runway();
    let x: number;
    let minX: number;
    if (moving) {
      // Tramo largo: el vehículo entra por la derecha y avanza hacia la jauría.
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
      vx: moving ? -(140 + 180 * d) : 0, minX, smashed: false, smashT: 0, color: Math.floor(r() * 4),
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
    const reach = jumpHeight(true) - 45;
    let x = start + (overPit ? 60 : 40);
    let lastY = 0;
    for (let i = 0; i < n; i++) {
      const pw = 190 + r() * 120;
      // Cada plataforma se alcanza con un salto largo desde la anterior (o desde la calle).
      let py = -(70 + r() * 50);
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
