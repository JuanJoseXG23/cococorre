import {
  collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, type Timestamp,
} from 'firebase/firestore';
import { getDb } from './app';
import type { UserProfile } from './types';

export interface LeaderboardEntry {
  uid: string;
  username: string;
  highScore: number;
  gamesPlayed: number;
  updatedAt: Timestamp | null;
}

export function leaderboardData(p: Pick<UserProfile, 'username' | 'highScore' | 'gamesPlayed'>) {
  return {
    username: p.username,
    highScore: p.highScore,
    gamesPlayed: p.gamesPlayed,
    updatedAt: serverTimestamp(),
  };
}

/** Publica (o corrige) la entrada del ranking con los datos actuales del perfil. */
export async function syncLeaderboard(p: UserProfile): Promise<void> {
  await setDoc(doc(getDb(), 'leaderboard', p.uid), leaderboardData(p));
}

export async function loadLeaderboard(max = 50): Promise<LeaderboardEntry[]> {
  const q = query(collection(getDb(), 'leaderboard'), orderBy('highScore', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<LeaderboardEntry, 'uid'>) }));
}
