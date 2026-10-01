/** Columnas jugables (0..COLS-1). */
export const COLS = 9;
/** Duración de un salto de Coco, en segundos. */
export const HOP_TIME = 0.14;
/** Puntos extra por cada corazón recogido. */
export const HEART_BONUS = 3;

export type LaneType = 'grass' | 'road' | 'river' | 'rail';

export type MoverKind = 'car' | 'truck' | 'log' | 'lily' | 'train';

export interface Mover {
  kind: MoverKind;
  /** Borde izquierdo en coordenadas de casilla (puede ser decimal). */
  x: number;
  len: number;
  color: string;
}

export interface Lane {
  row: number;
  type: LaneType;
  /** Casillas bloqueadas por árboles (sólo pasto). */
  trees: Set<number>;
  /** Decoración: flores (sólo pasto). */
  flowers: Set<number>;
  /** Corazones coleccionables (sólo pasto). */
  hearts: Set<number>;
  /** Dirección: 1 derecha, -1 izquierda. */
  dir: number;
  /** Velocidad en casillas/segundo. */
  speed: number;
  movers: Mover[];
  /** Longitud del ciclo en el que se repiten los obstáculos. */
  loop: number;
  // --- Sólo vías de tren ---
  trainTimer: number;
  trainPeriod: number;
  trainActive: boolean;
}

export type DeathCause = 'car' | 'train' | 'water' | 'swept' | 'eagle';

export interface GameResult {
  score: number;
  maxRow: number;
  hearts: number;
  durationMs: number;
  cause: DeathCause;
}

export type Direction = 'up' | 'down' | 'left' | 'right';
