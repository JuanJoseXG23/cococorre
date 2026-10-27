import type { PedKind } from './types';

/**
 * Apariencia de los personajes (sólo datos; el dibujo está en sprites.ts).
 * Cada civil, al convertirse, se transforma en un zombi que conserva su
 * ropa y su peinado: así la horda nunca parece un grupo de clones.
 */
export interface PedLook {
  kind: PedKind;
  skin: string;
  hair: string;
  top: string;
  bottom: string;
  /** Detalle propio: corbata, sombrero, gorra, cinta... */
  extra: string;
  /** 0 corto · 1 largo/cola · 2 moño · 3 gorra · 4 cinta · 5 sombrero */
  hairStyle: number;
  scale: number;
}

export const PED_LOOKS: PedLook[] = [
  { kind: 'office', skin: '#f1c7a5', hair: '#3b2a20', top: '#2f4a7a', bottom: '#2a2f3d', extra: '#e04b4b', hairStyle: 0, scale: 1 },
  { kind: 'office', skin: '#a8714f', hair: '#1d1714', top: '#5b5f6b', bottom: '#33363f', extra: '#f2c14e', hairStyle: 0, scale: 1 },
  { kind: 'lady', skin: '#f5d0b5', hair: '#8a4b2a', top: '#e0558b', bottom: '#e0558b', extra: '#ffd1e1', hairStyle: 1, scale: 0.97 },
  { kind: 'lady', skin: '#7b4a33', hair: '#1f1612', top: '#2bb3a3', bottom: '#2bb3a3', extra: '#ffffff', hairStyle: 1, scale: 0.97 },
  { kind: 'kid', skin: '#f3c9a0', hair: '#5a3a22', top: '#ffc93c', bottom: '#3d6fb6', extra: '#e8453c', hairStyle: 3, scale: 0.74 },
  { kind: 'kid', skin: '#c48a62', hair: '#2b1d16', top: '#7bd389', bottom: '#4b4f73', extra: '#3c7be8', hairStyle: 3, scale: 0.72 },
  { kind: 'granny', skin: '#f0cfb8', hair: '#d9d9e3', top: '#8e6bbf', bottom: '#5d4a7a', extra: '#c9b8e8', hairStyle: 2, scale: 0.92 },
  { kind: 'granny', skin: '#9c6a4c', hair: '#c9c9d4', top: '#d8794b', bottom: '#6b4a3a', extra: '#f5d7a1', hairStyle: 2, scale: 0.9 },
  { kind: 'jogger', skin: '#e9b48f', hair: '#2d2420', top: '#b6f24a', bottom: '#2c2c35', extra: '#ff5c8a', hairStyle: 4, scale: 1 },
  { kind: 'jogger', skin: '#6e432e', hair: '#141010', top: '#ff8a3d', bottom: '#2c3550', extra: '#ffffff', hairStyle: 4, scale: 1 },
  { kind: 'tourist', skin: '#f7d6bf', hair: '#c98b3c', top: '#ff7a59', bottom: '#d8c49a', extra: '#fff1b8', hairStyle: 5, scale: 1 },
  { kind: 'tourist', skin: '#b98260', hair: '#3a2a20', top: '#3fa7d6', bottom: '#e8dcc0', extra: '#ffe08a', hairStyle: 5, scale: 1 },
];

export interface ZombieLook {
  skin: string;
  skinDark: string;
  hair: string;
  shirt: string;
  pants: string;
  extra: string;
  hairStyle: number;
  scale: number;
  /** Ojo grande a la izquierda o a la derecha. */
  eyeSwap: boolean;
  /** Líder: gorro naranja y ojos brillantes. */
  leader: boolean;
}

const ZOMBIE_SKINS: [string, string][] = [
  ['#9ed06b', '#78a64c'],
  ['#86c08f', '#5f9a6b'],
  ['#b3cf7a', '#8aa755'],
  ['#8fbfa8', '#679a84'],
];

/** Mezcla un color con gris para la ropa "gastada" del zombi. */
function worn(hex: string, amt = 0.28): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (128 - c) * amt);
  const r = mix(n >> 16), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export const LEADER_LOOK: ZombieLook = {
  skin: '#8fd16a', skinDark: '#69a84a', hair: '#2b2b33', shirt: '#6a5acd', pants: '#3a3550',
  extra: '#ff8a2a', hairStyle: 6, scale: 1.06, eyeSwap: false, leader: true,
};

/** Un zombi por cada civil (mismo índice) + el líder al final. */
export const ZOMBIE_LOOKS: ZombieLook[] = [
  ...PED_LOOKS.map((p, i): ZombieLook => {
    const [skin, skinDark] = ZOMBIE_SKINS[i % ZOMBIE_SKINS.length];
    return {
      skin, skinDark, hair: worn(p.hair, 0.15), shirt: worn(p.top), pants: worn(p.bottom),
      extra: worn(p.extra, 0.2), hairStyle: p.hairStyle, scale: Math.max(0.82, p.scale), eyeSwap: i % 2 === 1, leader: false,
    };
  }),
  LEADER_LOOK,
];

export const LEADER_LOOK_INDEX = ZOMBIE_LOOKS.length - 1;
