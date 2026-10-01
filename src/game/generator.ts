import { COLS, type Lane, type LaneType, type Mover } from './types';
import { difficultyForScore } from './difficulty';

/**
 * Generador procedural de carriles.
 * Se crean por "grupos" (p. ej. 3 carreteras seguidas). La dificultad depende
 * de los PUNTOS que tendrá la jugadora al llegar a ese carril: más velocidad,
 * más obstáculos y menos zonas seguras, siempre con límites para que nunca
 * sea imposible (ver comentarios "tope").
 */

const CAR_COLORS = ['#e8a0b4', '#f2c48d', '#9cc5de', '#b8a9d9', '#a8d5ba', '#f0b8a0'];
const TRUCK_COLORS = ['#c97b8e', '#7f93c4', '#6fb3a2', '#a88a74'];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

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

  /**
   * @param projectedScore puntos estimados que tendrá la jugadora al llegar a una fila
   *                       (fila + bonus de corazones ya recogidos).
   */
  constructor(private speedMultiplier: number, private projectedScore: (row: number) => number) {}

  private d(row: number) {
    return difficultyForScore(this.projectedScore(row));
  }

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
    const d = this.d(row);
    // Tras un tramo peligroso suele venir una zona segura (tope: al menos 45 % de las veces).
    if (this.lastType !== 'grass' && Math.random() < 0.85 - 0.4 * d) {
      this.queue.push(...Array(Math.random() < 0.5 - 0.35 * d ? 2 : 1).fill('grass'));
      return;
    }
    const options: [LaneType, number][] = [
      ['grass', 0.25 - 0.12 * d],
      ['road', 0.45],
      ['river', row > 8 ? 0.25 + 0.05 * d : 0],
      ['rail', row > 25 ? 0.06 + 0.1 * d : 0],
    ];
    const total = options.reduce((s, o) => s + o[1], 0);
    let r = Math.random() * total;
    let type: LaneType = 'grass';
    for (const [t, w] of options) {
      if ((r -= w) <= 0) { type = t; break; }
    }
    const count =
      type === 'road' ? randInt(1, 2 + Math.round(2 * d)) : // tope: 4 carreteras seguidas
      type === 'river' ? randInt(1, 1 + Math.round(1.5 * d)) : // tope: 3 ríos seguidos
      type === 'rail' ? randInt(1, d > 0.6 ? 2 : 1) :
      randInt(1, 2);
    this.queue.push(...Array(count).fill(type));
  }

  private grass(row: number, start: boolean): Lane {
    const lane = baseLane(row, 'grass');
    const d = this.d(row);
    this.pathCol = Math.min(COLS - 1, Math.max(0, this.pathCol + randInt(-1, 1)));
    const density = start ? 0 : 0.15 + 0.15 * d;
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
      if (!lane.trees.has(c) && Math.random() < 0.1) lane.flowers.add(c);
    }
    if (!start && Math.random() < 0.14) {
      const free = [...Array(COLS).keys()].filter((c) => !lane.trees.has(c));
      if (free.length) lane.hearts.add(pick(free));
    }
    return lane;
  }

  private road(row: number): Lane {
    const lane = baseLane(row, 'road');
    const d = this.d(row);
    lane.dir = Math.random() < 0.5 ? 1 : -1;
    // Tope: ~5 casillas/s (Coco cruza un carril en 0,14 s).
    lane.speed = (rand(1.1, 2.0) + d * 3) * this.speedMultiplier;
    const trucks = row > 20;
    fillMovers(
      lane,
      () => (trucks && Math.random() < 0.2 + 0.2 * d ? 2 : 1),
      // Tope: el hueco mínimo entre autos nunca baja de 2,2 casillas.
      () => rand(Math.max(2.2, 5 - 2.8 * d), Math.max(4, 10 - 6 * d)),
      (len) => (len > 1 ? 'truck' : 'car'),
      (len) => (len > 1 ? pick(TRUCK_COLORS) : pick(CAR_COLORS)),
    );
    return lane;
  }

  private river(row: number): Lane {
    const lane = baseLane(row, 'river');
    const d = this.d(row);
    // Algunos ríos tienen hojas de lirio quietas (más comunes al inicio).
    if (Math.random() < 0.3 - 0.2 * d) {
      lane.speed = 0;
      const cols = [...Array(COLS).keys()].filter(() => Math.random() < 0.45);
      if (cols.length < 3) cols.push(0, Math.floor(COLS / 2), COLS - 1);
      for (const c of new Set(cols)) lane.movers.push({ kind: 'lily', x: c, len: 1, color: '#7fb98a' });
      return lane;
    }
    this.lastRiverDir = -this.lastRiverDir;
    lane.dir = this.lastRiverDir;
    lane.speed = (rand(0.8, 1.4) + d * 1.2) * this.speedMultiplier;
    fillMovers(
      lane,
      // Tope: los troncos nunca miden menos de 2 casillas.
      () => Math.max(2, randInt(2, 4) - Math.round(d)),
      // Tope: el hueco entre troncos nunca supera 3,2 casillas.
      () => rand(1.2, 2.2 + d),
      () => 'log',
      () => '#a1754f',
    );
    return lane;
  }

  private rail(row: number): Lane {
    const lane = baseLane(row, 'rail');
    const d = this.d(row);
    lane.dir = Math.random() < 0.5 ? 1 : -1;
    lane.speed = 24 * Math.min(1.3, this.speedMultiplier);
    // Tope: siempre al menos ~3 s entre trenes, con aviso del semáforo.
    lane.trainPeriod = rand(4.5, 7) - d * 1.5;
    lane.trainTimer = rand(1.5, lane.trainPeriod);
    return lane;
  }
}
