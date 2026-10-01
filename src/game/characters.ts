/**
 * Personajes del juego. Los que tienen `unlockHearts > 0` se desbloquean al
 * juntar esa cantidad de corazones (en total, sumando todas las partidas;
 * los corazones NO se gastan).
 *
 * Colores:
 *  - body: pelaje principal · bodyDark: zonas oscuras (melena, manto, cola)
 *  - ears: orejas · belly: marcas claras (cara, pecho, patas)
 *  - accent: detalle propio de la raza (moño, manchas, mejillas...)
 */
export type Breed = 'pomerania' | 'yorkie' | 'collie' | 'beagle' | 'hamster';

export interface CharacterSkin {
  id: string;
  name: string;
  breed: Breed;
  breedLabel: string;
  /** Corazones necesarios para desbloquearlo (0 = disponible desde el inicio). */
  unlockHearts: number;
  body: string;
  bodyDark: string;
  ears: string;
  belly: string;
  collar: string;
  accent: string;
}

export const CHARACTERS: CharacterSkin[] = [
  // Coco de verdad: Pomerania sable gris oscuro con marcas canela.
  {
    id: 'coco', name: 'Coco', breed: 'pomerania', breedLabel: 'Pomerania', unlockHearts: 0,
    body: '#4f4749', bodyDark: '#3a3335', ears: '#2c2527', belly: '#c99a6b', collar: '#d4849a', accent: '#7a5a44',
  },
  {
    id: 'coco-crema', name: 'Coco Crema', breed: 'pomerania', breedLabel: 'Pomerania', unlockHearts: 0,
    body: '#efe2cc', bodyDark: '#dcc8a8', ears: '#c9ab84', belly: '#fff8ec', collar: '#8fb8a4', accent: '#e3cfae',
  },
  {
    id: 'coco-naranja', name: 'Coco Naranja', breed: 'pomerania', breedLabel: 'Pomerania', unlockHearts: 0,
    body: '#df9f5d', bodyDark: '#c9854a', ears: '#b06d32', belly: '#f6d9b2', collar: '#96b8d2', accent: '#c47a3e',
  },
  // Tony: Yorkshire, manto gris acero y cabeza canela, con moñito.
  {
    id: 'tony', name: 'Tony', breed: 'yorkie', breedLabel: 'Yorkshire', unlockHearts: 10,
    body: '#5d6574', bodyDark: '#474e5c', ears: '#b98352', belly: '#d6a46c', collar: '#96b8d2', accent: '#e07a9a',
  },
  // Jocko: Border Collie blue merle (gris azulado con manchas negras y blanco).
  {
    id: 'jocko', name: 'Jocko', breed: 'collie', breedLabel: 'Border Collie blue merle', unlockHearts: 25,
    body: '#9aa3b0', bodyDark: '#3e434d', ears: '#3e434d', belly: '#f5f3ef', collar: '#d4849a', accent: '#5f6672',
  },
  // Toby: Beagle tricolor (manto negro, canela y blanco).
  {
    id: 'toby', name: 'Toby', breed: 'beagle', breedLabel: 'Beagle', unlockHearts: 45,
    body: '#c98b4f', bodyDark: '#2f2a28', ears: '#8a5a33', belly: '#f7f2e9', collar: '#8fb8a4', accent: '#a86d38',
  },
  // Cachetes José: hámster ruso negrito con café.
  {
    id: 'cachetes', name: 'Cachetes José', breed: 'hamster', breedLabel: 'Hámster ruso', unlockHearts: 75,
    body: '#3d322e', bodyDark: '#2a221f', ears: '#5a4840', belly: '#9c7556', collar: '#d4849a', accent: '#c49a72',
  },
];

export function isUnlocked(c: CharacterSkin, heartsTotal: number): boolean {
  return heartsTotal >= c.unlockHearts;
}

/** Personajes que se desbloquean al pasar de `before` a `after` corazones. */
export function newlyUnlocked(before: number, after: number): CharacterSkin[] {
  return CHARACTERS.filter((c) => c.unlockHearts > before && c.unlockHearts <= after);
}

const KEY = 'cococorre.skin';

/** Personaje elegido; si está bloqueado (p. ej. en otro dispositivo), vuelve a Coco. */
export function getSavedSkin(heartsTotal = 0): CharacterSkin {
  let id: string | null = null;
  try {
    id = localStorage.getItem(KEY);
  } catch {
    /* almacenamiento no disponible */
  }
  const c = CHARACTERS.find((x) => x.id === id);
  return c && isUnlocked(c, heartsTotal) ? c : CHARACTERS[0];
}

export function saveSkin(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* almacenamiento no disponible */
  }
}
