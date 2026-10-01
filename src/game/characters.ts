/**
 * Personajes disponibles (Pomeranias). Para agregar uno nuevo basta con
 * añadir una entrada a esta lista.
 *  - body: pelaje principal · bodyDark: melena y cola
 *  - ears: orejas · belly: marcas claras (cara, pecho, patas)
 */
export interface CharacterSkin {
  id: string;
  name: string;
  body: string;
  bodyDark: string;
  ears: string;
  belly: string;
  collar: string;
}

export const CHARACTERS: CharacterSkin[] = [
  // Coco de verdad: sable gris oscuro con marcas canela.
  { id: 'coco', name: 'Coco', body: '#4f4749', bodyDark: '#3a3335', ears: '#2c2527', belly: '#c99a6b', collar: '#d4849a' },
  { id: 'coco-crema', name: 'Coco Crema', body: '#efe2cc', bodyDark: '#dcc8a8', ears: '#c9ab84', belly: '#fff8ec', collar: '#8fb8a4' },
  { id: 'coco-naranja', name: 'Coco Naranja', body: '#df9f5d', bodyDark: '#c9854a', ears: '#b06d32', belly: '#f6d9b2', collar: '#96b8d2' },
];

const KEY = 'cococorre.skin';

export function getSavedSkin(): CharacterSkin {
  let id: string | null = null;
  try {
    id = localStorage.getItem(KEY);
  } catch {
    /* almacenamiento no disponible */
  }
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

export function saveSkin(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* almacenamiento no disponible */
  }
}
