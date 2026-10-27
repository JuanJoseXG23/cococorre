import {
  BASE_SPEED, DIFFICULTY_FULL_AT_M, GRAVITY, HOLD_GRAVITY, JUMP_VELOCITY, MAX_HOLD, MAX_SPEED,
} from './constants';
import { clamp, lerp } from './rng';

/** Dificultad 0..1 según los metros recorridos (tope en DIFFICULTY_FULL_AT_M). */
export function difficultyAt(meters: number): number {
  return clamp(meters / DIFFICULTY_FULL_AT_M, 0, 1);
}

/** Velocidad de la jauría (px/s) según los metros. Depende de la distancia, no del tiempo ni de los FPS. */
export function speedAt(meters: number): number {
  return lerp(BASE_SPEED, MAX_SPEED, Math.pow(difficultyAt(meters), 0.85));
}

/** Duración de un salto (despegue y aterrizaje a la misma altura). */
export function airTime(hold: boolean): number {
  if (!hold) return (2 * JUMP_VELOCITY) / GRAVITY;
  const g1 = GRAVITY * HOLD_GRAVITY;
  const v1 = JUMP_VELOCITY - g1 * MAX_HOLD;
  const h1 = JUMP_VELOCITY * MAX_HOLD - 0.5 * g1 * MAX_HOLD * MAX_HOLD;
  const t2 = v1 / GRAVITY;
  const h = h1 + (v1 * v1) / (2 * GRAVITY);
  return MAX_HOLD + t2 + Math.sqrt((2 * h) / GRAVITY);
}

/** Altura máxima de un salto. */
export function jumpHeight(hold: boolean): number {
  if (!hold) return (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
  const g1 = GRAVITY * HOLD_GRAVITY;
  const v1 = JUMP_VELOCITY - g1 * MAX_HOLD;
  const h1 = JUMP_VELOCITY * MAX_HOLD - 0.5 * g1 * MAX_HOLD * MAX_HOLD;
  return h1 + (v1 * v1) / (2 * GRAVITY);
}

/** Distancia horizontal que cubre un salto a cierta velocidad. */
export function jumpRange(speed: number, hold: boolean): number {
  return speed * airTime(hold);
}
