import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDb } from './app';
import { DEFAULT_CONFIG, type GameConfig } from './types';

export async function loadGameConfig(): Promise<GameConfig> {
  try {
    const snap = await getDoc(doc(getDb(), 'config', 'game'));
    if (!snap.exists()) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...(snap.data() as Partial<GameConfig>) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveGameConfig(cfg: GameConfig): Promise<void> {
  await setDoc(doc(getDb(), 'config', 'game'), cfg);
}
