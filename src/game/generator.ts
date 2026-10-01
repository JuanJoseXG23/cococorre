import { COLS, type Lane, type LaneType, type Mover } from './types';

/**
 * Generador procedural de carriles.
 * Se crean por "grupos" (p. ej. 3 carreteras seguidas) y la dificultad
 * depende de la fila: más velocidad, más obstáculos y menos zonas seguras.
 */

const CAR_COLORS = ['#ff6b9a', '#ffb347', '#7ec8e3', '#b39ddb', '#ffd54f', '#81c784', '#f06292'];
const TRUCK_COLORS = ['#ef5350', '#5c6bc0', '#26a69a', '#8d6e63'];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

/** 0 al inicio, 1 en la fila 300 o más. */
export function difficultyAt(row: number): number {
  return Math.min(1, Math.max(0, row / 300));
}

function baseLane(row: number, type: LaneType): Lane {
  return {
    row,
    type,
    trees: new Set(),
    flowers: new Set(),
    hearts: new Set(),
    dir: 1,
    speed: 0,
    movers: [],
    loop: COLS + 16,
    trainTimer: 0,
    trainPeriod: 0,
    trainActive: false,
  };
}

/** Coloca obstáculos repetidos a lo largo del ciclo del carril. */
function fillMovers(lane: Lane, makeLen: () => number, makeGap: () => number, kind: (len: number) => Mover['kind'], color: (len: number) => string) {
  let pos = rand(0, 3);
  for (;;) {
    const len = makeLen();
    // Deja espacio para que el último no se superponga con el primero al dar la vuelta.
    if (pos + len > lane.loop - 1.5) break;
    lane.movers.push({ kind: kind(len), x: pos - 8, len, color: color(len) });
    pos += len + makeGap();
  }
}

export class LaneGenerator {
  private queue: LaneType[] = [];
  private lastType: LaneType = 'grass';
  private lastRiverDir = 1;
  /** Columna que siempre queda libre de árboles para garantizar un camino. */
  private pathCol = Math.floor(COLS / 2);

  constructor(private speedMultiplier: number) {}

  create(row: number): Lane {
    if (row <= 4) return this.grass(row, true);
    if (this.queue.length === 0) this.planGroup(row);
    const type = this.queue.shift()!;
    this.lastType = type;
    switch (type) {
      case 'road':
        return this.road(row);
      case 'river':
        return this.river(row);
      case 'rail':
        return this.rail(row);
      default:
        return this.grass(row, false);
    }
  }

  private planGroup(row: number) {
    const d = difficultyAt(row);
    // Después de un tramo peligroso, casi siempre una zona segura al inicio.
    if (this.lastType !== 'grass' && Math.random() < 0.85 - 0.45 * d) {
      this.queue.push(...Array(Math.random() < 0.5 - 0.4 * d ? 2 : 1).fill('grass'));
      return;
    }
    const options: [LaneType, number][] = [
      ['grass', 0.25 - 0.15 * d],
      ['road', 0.45],
      ['river', row > 8 ? 0.25 + 0.05 * d : 0],
      ['rail', row > 25 ? 0.08 + 0.12 * d : 0],
    ];
    const total = options.reduce((s, o) => s + o[1], 0);
    let r = Math.random() * total;
    let type: LaneType = 'grass';
    for (const [t, w] of options) {
      if ((r -= w) <= 0) { type = t; break; }
    }
    const count =
      type === 'road' ? randInt(1, 2 + Math.round(3 * d)) :
      type === 'river' ? randInt(1, 1 + Math.round(2 * d)) :
      type === 'rail' ? randInt(1, d > 0.5 ? 2 : 1) :
      randInt(1, 2);
    this.queue.push(...Array(count).fill(type));
  }

  private grass(row: number, start: boolean): Lane {
    const lane = baseLane(row, 'grass');
    const d = difficultyAt(row);
    this.pathCol = Math.min(COLS - 1, Math.max(0, this.pathCol + randInt(-1, 1)));
    const density = start ? 0 : 0.15 + 0.2 * d;
    for (let c = 0; c < COLS; c++) {
      if (c === this.pathCol) continue;
      if (start && row === 0 && (c === 0 || c === COLS - 1)) lane.trees.add(c);
      else if (Math.random() < density) lane.trees.add(c);
    }
    // Árboles decorativos fuera del área jugable.
    for (const c of [-6, -5, -4, -3, -2, -1, COLS, COLS + 1, COLS + 2, COLS + 3, COLS + 4, COLS + 5]) {
      if (Math.random() < 0.55) lane.trees.add(c);
    }
    for (let c = 0; c < COLS; c++) {
      if (!lane.trees.has(c) && Math.random() < 0.12) lane.flowers.add(c);
    }
    if (!start && Math.random() < 0.14) {
      const free = [...Array(COLS).keys()].filter((c) => !lane.trees.has(c));
      if (free.length) lane.hearts.add(pick(free));
    }
    return lane;
  }

  private road(row: number): Lane {
    const lane = baseLane(row, 'road');
    const d = difficultyAt(row);
    lane.dir = Math.random() < 0.5 ? 1 : -1;
    lane.speed = (rand(1.1, 2.2) + d * 4.2) * this.speedMultiplier;
    const trucks = row > 20;
    fillMovers(
      lane,
      () => (trucks && Math.random() < 0.3 ? 2 : 1),
      () => rand(Math.max(1.8, 5 - 3.2 * d), Math.max(3.5, 10 - 6 * d)),
      (len) => (len > 1 ? 'truck' : 'car'),
      (len) => (len > 1 ? pick(TRUCK_COLORS) : pick(CAR_COLORS)),
    );
    return lane;
  }

  private river(row: number): Lane {
    const lane = baseLane(row, 'river');
    const d = difficultyAt(row);
    // Algunos ríos tienen hojas de lirio quietas.
    if (d < 0.6 && Math.random() < 0.25) {
      lane.speed = 0;
      const cols = [...Array(COLS).keys()].filter(() => Math.random() < 0.45);
      if (cols.length < 3) cols.push(0, Math.floor(COLS / 2), COLS - 1);
      for (const c of new Set(cols)) lane.movers.push({ kind: 'lily', x: c, len: 1, color: '#66bb6a' });
      return lane;
    }
    this.lastRiverDir = -this.lastRiverDir;
    lane.dir = this.lastRiverDir;
    lane.speed = (rand(0.8, 1.5) + d * 1.6) * this.speedMultiplier;
    fillMovers(
      lane,
      () => Math.max(1, randInt(2, 4) - Math.round(1.5 * d)),
      () => rand(1.2, 2.4 + 1.2 * d),
      () => 'log',
      () => '#a1683a',
    );
    return lane;
  }

  private rail(row: number): Lane {
    const lane = baseLane(row, 'rail');
    const d = difficultyAt(row);
    lane.dir = Math.random() < 0.5 ? 1 : -1;
    lane.speed = 24 * Math.min(1.3, this.speedMultiplier);
    lane.trainPeriod = rand(4, 7) - d * 1.8;
    lane.trainTimer = rand(1.5, lane.trainPeriod);
    return lane;
  }
}
