/**
 * Niveles de dificultad según los puntos de la partida.
 * Nivel 1 (0 pts) ... Nivel 10 (270 pts o más). A partir del nivel 10
 * la dificultad ya no sube más, para que el juego nunca sea imposible.
 */
export const POINTS_PER_LEVEL = 30;
export const MAX_LEVEL = 10;

export function levelForScore(score: number): number {
  return Math.min(MAX_LEVEL, 1 + Math.floor(Math.max(0, score) / POINTS_PER_LEVEL));
}

/** 0 en el nivel 1, 1 en el nivel máximo. */
export function difficultyForScore(score: number): number {
  return (levelForScore(score) - 1) / (MAX_LEVEL - 1);
}
