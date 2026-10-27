/**
 * Apariencia de los perritos (sólo datos; el dibujo está en sprites.ts).
 * Cada perrito de la calle, al contagiarse, se vuelve un perrito zombi que
 * conserva su raza y su pelaje (con un tono verdoso): así la jauría nunca
 * parece un grupo de clones. El líder es Jocko, el Border Collie blue
 * merle (los mismos colores que en CoCoCorre).
 */
export type EarType = 'pointy' | 'semi' | 'floppy' | 'fluffy' | 'fold';
export type TailType = 'curl' | 'flag' | 'long' | 'plume' | 'pom' | 'stub' | 'thin';
export type Marking = 'none' | 'merle' | 'spots' | 'saddle' | 'mask';

export interface DogLook {
  breed: string;
  /** Pelaje principal, zonas oscuras, pecho/panza claros. */
  coat: string;
  dark: string;
  light: string;
  /** Color de la cabeza si es distinto del cuerpo (Yorkshire). */
  head?: string;
  ear: EarType;
  tail: TailType;
  marking: Marking;
  /** Hocico: largo en px virtuales. */
  snout: number;
  /** Largo de las patas y medidas del cuerpo (radios). */
  legH: number;
  bodyRX: number;
  bodyRY: number;
  /** Pelaje esponjoso (Pomerania, caniche, collie). */
  fluffy: boolean;
  /** Pecho blanco y patitas blancas. */
  whiteChest: boolean;
  collar: string;
  scale: number;
  /** --- Sólo zombis --- */
  zombie: boolean;
  leader: boolean;
}

type Base = Omit<DogLook, 'zombie' | 'leader'>;

/** Perritos de la calle (se contagian al tocarlos). */
export const PED_LOOKS: DogLook[] = ([
  { breed: 'Pomerania', coat: '#efe2cc', dark: '#d9c4a2', light: '#fff8ec', ear: 'pointy', tail: 'curl', marking: 'none', snout: 3, legH: 8, bodyRX: 11, bodyRY: 9, fluffy: true, whiteChest: false, collar: '#8fb8a4', scale: 0.82 },
  { breed: 'Pomerania', coat: '#df9f5d', dark: '#c47a3e', light: '#f6d9b2', ear: 'pointy', tail: 'curl', marking: 'none', snout: 3, legH: 8, bodyRX: 11, bodyRY: 9, fluffy: true, whiteChest: false, collar: '#96b8d2', scale: 0.82 },
  { breed: 'Beagle', coat: '#c98b4f', dark: '#2f2a28', light: '#f7f2e9', ear: 'floppy', tail: 'flag', marking: 'saddle', snout: 6, legH: 12, bodyRX: 14, bodyRY: 7.5, fluffy: false, whiteChest: true, collar: '#e8453c', scale: 0.95 },
  { breed: 'Yorkshire', coat: '#5d6574', dark: '#474e5c', light: '#d6a46c', head: '#d6a46c', ear: 'pointy', tail: 'thin', marking: 'none', snout: 3.5, legH: 8, bodyRX: 10, bodyRY: 6.5, fluffy: false, whiteChest: false, collar: '#e07a9a', scale: 0.78 },
  { breed: 'Labrador', coat: '#e2b46a', dark: '#c9964c', light: '#f3d9a8', ear: 'floppy', tail: 'long', marking: 'none', snout: 7, legH: 14, bodyRX: 16, bodyRY: 8.5, fluffy: false, whiteChest: false, collar: '#3c7be8', scale: 1.05 },
  { breed: 'Dálmata', coat: '#f7f5f0', dark: '#1f1d22', light: '#ffffff', ear: 'floppy', tail: 'long', marking: 'spots', snout: 7, legH: 15, bodyRX: 15, bodyRY: 8, fluffy: false, whiteChest: false, collar: '#e04b4b', scale: 1.05 },
  { breed: 'Salchicha', coat: '#8a4b2a', dark: '#5e3019', light: '#b8774c', ear: 'floppy', tail: 'thin', marking: 'none', snout: 7, legH: 5.5, bodyRX: 17, bodyRY: 6, fluffy: false, whiteChest: false, collar: '#ffc93c', scale: 0.88 },
  { breed: 'Pug', coat: '#e6cfa3', dark: '#2b2523', light: '#f3e4c4', ear: 'fold', tail: 'curl', marking: 'mask', snout: 1.5, legH: 9, bodyRX: 11, bodyRY: 8, fluffy: false, whiteChest: false, collar: '#7bd389', scale: 0.82 },
  { breed: 'Caniche', coat: '#f4f0f6', dark: '#d9cfe0', light: '#ffffff', ear: 'fluffy', tail: 'pom', marking: 'none', snout: 6, legH: 13, bodyRX: 12, bodyRY: 7.5, fluffy: true, whiteChest: false, collar: '#ff5c8a', scale: 0.9 },
  { breed: 'Corgi', coat: '#e08a3c', dark: '#b8682a', light: '#fbf3e6', ear: 'pointy', tail: 'stub', marking: 'none', snout: 5, legH: 6, bodyRX: 14, bodyRY: 7.5, fluffy: false, whiteChest: true, collar: '#3fa7d6', scale: 0.9 },
  { breed: 'Chihuahua', coat: '#d9a066', dark: '#b07a44', light: '#f2d2a8', ear: 'pointy', tail: 'thin', marking: 'none', snout: 3, legH: 8, bodyRX: 9, bodyRY: 6, fluffy: false, whiteChest: false, collar: '#ff8a3d', scale: 0.72 },
  { breed: 'Husky', coat: '#8e96a3', dark: '#3d424c', light: '#f5f6f8', ear: 'pointy', tail: 'curl', marking: 'mask', snout: 6, legH: 14, bodyRX: 15, bodyRY: 8, fluffy: false, whiteChest: true, collar: '#b6f24a', scale: 1.0 },
] as Base[]).map((b) => ({ ...b, zombie: false, leader: false }));

/** Mezcla dos colores hex (t = 0 → a, 1 → b). */
export function mixHex(a: string, b: string, t: number): string {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((x >> s) & 255) + (((y >> s) & 255) - ((x >> s) & 255)) * t);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

const ROT = '#7fc56a';

/** Versión zombi de un perrito: el mismo pelaje con tono verdoso. */
function zombify(l: DogLook): DogLook {
  return {
    ...l,
    coat: mixHex(l.coat, ROT, 0.38),
    dark: mixHex(l.dark, ROT, 0.22),
    light: mixHex(l.light, ROT, 0.32),
    head: l.head ? mixHex(l.head, ROT, 0.38) : undefined,
    zombie: true,
  };
}

/** Jocko: Border Collie blue merle (gris azulado con manchas negras y blanco). */
export const LEADER_LOOK: DogLook = {
  breed: 'Border Collie', coat: '#9aa3b0', dark: '#3e434d', light: '#f5f3ef', ear: 'semi', tail: 'plume',
  marking: 'merle', snout: 6, legH: 14, bodyRX: 15.5, bodyRY: 8.2, fluffy: true, whiteChest: true,
  collar: '#ff7a2a', scale: 1.08, zombie: true, leader: true,
};

/** Un perrito zombi por cada perrito de la calle (mismo índice) + Jocko al final. */
export const ZOMBIE_LOOKS: DogLook[] = [...PED_LOOKS.map(zombify), LEADER_LOOK];

export const LEADER_LOOK_INDEX = ZOMBIE_LOOKS.length - 1;
