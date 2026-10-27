import type { PowerKind, VehicleKind } from './constants';

/** Un salto del líder. Cada zombi lo repite al pasar por la misma x (efecto "ola"). */
export interface JumpEvent {
  id: number;
  x: number;
  /** Segundos que se mantuvo pulsado (crece mientras siga pulsado). */
  hold: number;
  released: boolean;
}

export interface Zombie {
  id: number;
  /** Índice en ZOMBIE_LOOKS (o -1 para el líder original). */
  look: number;
  x: number;
  y: number;
  vy: number;
  /** Posición relativa al ancla de la jauría (se acerca suavemente a su puesto). */
  off: number;
  /** Fila de profundidad (0 delante, 2 detrás) y su desplazamiento visual suavizado. */
  lane: number;
  laneY: number;
  grounded: boolean;
  coyote: number;
  /** Salto en curso (para saber cuánto mantenerlo). */
  jump: JumpEvent | null;
  holdT: number;
  /** Último salto procesado. */
  lastEv: number;
  /** Salto pendiente (si pasó por el punto de salto estando en el aire). */
  pending: JumpEvent | null;
  pendingT: number;
  /** Fase de la animación de carrera (0..1). */
  phase: number;
  /** Tiempo restante del "aplastamiento" al aterrizar. */
  squash: number;
  /** Tiempo desde que se unió (animación de aparición). */
  age: number;
}

export interface Segment {
  x0: number;
  x1: number;
}

export interface Platform {
  x0: number;
  x1: number;
  y: number;
  kind: 'scaffold' | 'awning';
  color: number;
}

export interface Vehicle {
  id: number;
  kind: VehicleKind;
  x: number;
  w: number;
  h: number;
  req: number;
  /** Velocidad propia (negativa = viene hacia la jauría). */
  vx: number;
  /** No puede pasar de aquí (borde de su tramo de calle). */
  minX: number;
  smashed: boolean;
  smashT: number;
  color: number;
}

/** Perrito de la calle (todavía no contagiado). */
export interface Pedestrian {
  id: number;
  look: number;
  x: number;
  y: number;
  vx: number;
  minX: number;
  maxX: number;
  lane: number;
  phase: number;
  panic: boolean;
  /** Velocidad de huida. */
  run: number;
}

export interface Bomb {
  id: number;
  x: number;
  y: number;
  exploded: boolean;
}

export interface Gem {
  x: number;
  y: number;
  taken: boolean;
  pulled: boolean;
}

export interface Crate {
  x: number;
  y: number;
  taken: boolean;
}

export interface Corpse {
  look: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  life: number;
  lane: number;
  /** true si cayó a un hueco (se dibuja detrás del borde de la calle). */
  inPit: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
  kind: 'dot' | 'ring' | 'spark' | 'smoke' | 'gem';
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  size: number;
}

export interface ActivePower {
  kind: PowerKind;
  t: number;
  max: number;
}

export type GameSound =
  | 'jump' | 'convert' | 'gem' | 'explode' | 'smash' | 'hit' | 'fall'
  | 'power' | 'shield' | 'over' | 'warn' | 'record' | 'land';

/** Estadísticas reales de una partida. */
export interface RunStats {
  distance: number;
  maxHorde: number;
  converted: number;
  gems: number;
  vehiclesSmashed: number;
  powerups: number;
  durationMs: number;
}
