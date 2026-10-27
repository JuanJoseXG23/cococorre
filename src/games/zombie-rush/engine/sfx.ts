import { tone } from '../../../game/audio';
import type { GameSound } from './types';

/**
 * Sonidos sintetizados (sin archivos). Comparten el botón de silencio con
 * CoCoCorre (game/audio.ts). Cada sonido se limita a uno por fotograma.
 */
const SOUNDS: Record<GameSound, () => void> = {
  jump: () => tone(300, 0.12, 'square', 0.035, 520),
  land: () => tone(140, 0.06, 'triangle', 0.04),
  convert: () => {
    tone(180, 0.12, 'sawtooth', 0.05, 90);
    setTimeout(() => tone(520, 0.1, 'square', 0.03, 760), 60);
  },
  gem: () => tone(1250, 0.07, 'sine', 0.05, 1650),
  explode: () => {
    tone(120, 0.45, 'sawtooth', 0.09, 40);
    tone(60, 0.5, 'square', 0.05, 30);
  },
  smash: () => {
    tone(200, 0.25, 'square', 0.07, 70);
    setTimeout(() => tone(660, 0.12, 'triangle', 0.05, 990), 90);
  },
  hit: () => tone(220, 0.18, 'sawtooth', 0.06, 90),
  fall: () => tone(500, 0.4, 'triangle', 0.05, 80),
  power: () => {
    tone(523, 0.1, 'square', 0.05);
    setTimeout(() => tone(659, 0.1, 'square', 0.05), 90);
    setTimeout(() => tone(784, 0.18, 'square', 0.05), 180);
  },
  shield: () => tone(880, 0.25, 'sine', 0.06, 440),
  over: () => {
    tone(330, 0.25, 'triangle', 0.06, 220);
    setTimeout(() => tone(220, 0.4, 'triangle', 0.06, 110), 220);
  },
  warn: () => {
    tone(740, 0.1, 'square', 0.04);
    setTimeout(() => tone(740, 0.1, 'square', 0.04), 140);
  },
  record: () => {
    tone(660, 0.12, 'sine', 0.07);
    setTimeout(() => tone(880, 0.12, 'sine', 0.07), 110);
    setTimeout(() => tone(1100, 0.22, 'sine', 0.07), 220);
  },
};

export function playSounds(queue: GameSound[]) {
  if (!queue.length) return;
  const unique = new Set(queue);
  queue.length = 0;
  for (const s of unique) SOUNDS[s]();
}
