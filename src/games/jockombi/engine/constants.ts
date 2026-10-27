/**
 * Parámetros de diseño de Jockombi. Unidades: "px virtuales" (el mundo
 * mide 480 de alto y se escala a la pantalla) y segundos.
 * Eje Y hacia abajo: la superficie de la calle está en y = 0.
 */

/** Alto de referencia del mundo; el ancho depende de la pantalla. */
export const VIRTUAL_H = 480;
/** Ancho mínimo visible en horizontal y en vertical (celular de pie). */
export const MIN_VIRTUAL_W = 640;
export const MIN_VIRTUAL_W_PORTRAIT = 440;

/** Paso fijo de la simulación (independiente de los FPS). */
export const STEP = 1 / 120;
/** Máximo de pasos por fotograma (evita la "espiral" al volver de otra pestaña). */
export const MAX_STEPS_PER_FRAME = 12;

// ---------- Salto ----------
// Saltos bajos y rápidos (toque ≈ 2 perritos de alto; mantener ≈ 3,7).
export const GRAVITY = 3300;
export const JUMP_VELOCITY = 700;
/** Mientras se mantiene pulsado (y sube), la gravedad se reduce a este factor. */
export const HOLD_GRAVITY = 0.5;
/** Tiempo máximo que cuenta mantener pulsado. */
export const MAX_HOLD = 0.24;
/** Margen para saltar justo después de salir de un borde. */
export const COYOTE_TIME = 0.09;
/** Si se pulsa un poco antes de aterrizar, el salto se ejecuta al tocar suelo. */
export const JUMP_BUFFER = 0.12;
/** Tolerancia horizontal para seguir pisando el borde de una superficie. */
export const EDGE_TOLERANCE = 6;

// ---------- Velocidad y dificultad ----------
export const BASE_SPEED = 350;
export const MAX_SPEED = 620;
export const PX_PER_METER = 30;
/** Metros en los que la dificultad llega al máximo (después ya no sube). */
export const DIFFICULTY_FULL_AT_M = 2000;

// ---------- Jauría ----------
/** Máximo de perritos en la jauría (rendimiento y equilibrio). Igual que en firestore.rules. */
export const HORDE_MAX = 75;
/** Caja de colisión de un perrito zombi (patas en x, y). */
export const ZOMBIE_HALF_W = 9;
export const ZOMBIE_H = 36;
/** Por debajo de esta profundidad un zombi que cayó ya no se puede salvar. */
export const PIT_DOOM_Y = 10;
/** Desplazamiento vertical y escala de las 3 filas de profundidad de la jauría. */
export const LANE_Y = [4, -3, -10];
export const LANE_SCALE = [1, 0.94, 0.88];

// ---------- Obstáculos ----------
export type VehicleKind = 'car' | 'van' | 'bus' | 'armored';

export interface VehicleSpec {
  label: string;
  w: number;
  h: number;
  /** Zombis necesarios para aplastarlo. */
  req: number;
  /** Gemas al aplastarlo. */
  gems: number;
  /** Pasajeros que se unen a la jauría al aplastarlo. */
  riders: number;
  /** Dificultad (0..1) a partir de la que aparece. */
  minDifficulty: number;
}

export const VEHICLES: Record<VehicleKind, VehicleSpec> = {
  car: { label: 'Auto', w: 132, h: 60, req: 4, gems: 2, riders: 0, minDifficulty: 0 },
  van: { label: 'Furgoneta', w: 164, h: 88, req: 8, gems: 3, riders: 1, minDifficulty: 0.1 },
  bus: { label: 'Bus', w: 270, h: 104, req: 14, gems: 5, riders: 1, minDifficulty: 0.25 },
  armored: { label: 'Blindado', w: 230, h: 110, req: 20, gems: 7, riders: 2, minDifficulty: 0.5 },
};

export const BOMB_RADIUS = 16;
/** Radio de la explosión: los zombis dentro de él se pierden. */
export const BLAST_RADIUS_X = 66;

// ---------- Potenciadores ----------
export type PowerKind = 'giant' | 'magnet' | 'shield' | 'clone';

export interface PowerSpec {
  label: string;
  /** Duración en segundos (0 = instantáneo). */
  duration: number;
  color: string;
  hint: string;
}

export const POWERS: Record<PowerKind, PowerSpec> = {
  giant: { label: 'Gigante', duration: 8, color: '#ff7a45', hint: 'Jocko crece: aplasta vehículos y pisa bombas sin daño' },
  magnet: { label: 'Imán', duration: 10, color: '#4cc3ff', hint: 'Atrae gemas y perritos cercanos' },
  shield: { label: 'Escudo', duration: 15, color: '#b48cff', hint: 'Absorbe el próximo golpe de bomba o vehículo' },
  clone: { label: 'Clonación', duration: 0, color: '#7be36a', hint: '+5 perritos zombis al instante' },
};
export const CLONE_AMOUNT = 5;
