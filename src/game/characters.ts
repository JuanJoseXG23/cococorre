/**
 * Personajes disponibles. Para agregar uno nuevo basta con añadir una
 * entrada a esta lista (colores del perrito).
 */
export interface CharacterSkin {
  id: string;
  name: string;
  emoji: string;
  body: string;
  bodyDark: string;
  ears: string;
  belly: string;
  collar: string;
}

export const CHARACTERS: CharacterSkin[] = [
  { id: 'coco', name: 'Coco', emoji: '🐶', body: '#c98a55', bodyDark: '#a46a3a', ears: '#7a4a2a', belly: '#f3d9b8', collar: '#ff4f81' },
  { id: 'coco-nieve', name: 'Coco Nieve', emoji: '🤍', body: '#f4f1ec', bodyDark: '#d8d1c6', ears: '#c9b8a6', belly: '#ffffff', collar: '#7ec8e3' },
  { id: 'coco-choco', name: 'Coco Choco', emoji: '🍫', body: '#6d4430', bodyDark: '#523222', ears: '#3b2318', belly: '#a77b5e', collar: '#ffd54f' },
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
