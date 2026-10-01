import { collection, doc, getDocs, limit, orderBy, query, updateDoc } from 'firebase/firestore';
import { getDb } from './app';
import type { Claim, GameRecord, UserProfile } from './types';

export async function listUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(getDb(), 'users'));
  return snap.docs
    .map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) }))
    .sort((a, b) => b.points - a.points);
}

export async function listClaims(): Promise<Claim[]> {
  const q = query(collection(getDb(), 'claims'), orderBy('claimedAt', 'desc'), limit(300));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Claim, 'id'>) }));
}

export async function listGames(): Promise<GameRecord[]> {
  const q = query(collection(getDb(), 'games'), orderBy('playedAt', 'desc'), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GameRecord, 'id'>) }));
}

/** Sólo un administrador puede hacerlo (validado por las reglas). */
export async function setUserPoints(uid: string, points: number): Promise<void> {
  await updateDoc(doc(getDb(), 'users', uid), { points });
}
