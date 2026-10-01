import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDb } from './app';
import type { UserProfile } from './types';
import { syncLeaderboard } from './leaderboard';

function toProfile(uid: string, data: Record<string, unknown>): UserProfile {
  return { uid, ...(data as Omit<UserProfile, 'uid'>) };
}

export async function createUserProfile(uid: string, username: string): Promise<void> {
  await setDoc(doc(getDb(), 'users', uid), {
    username,
    usernameLower: username.toLowerCase(),
    points: 0,
    highScore: 0,
    gamesPlayed: 0,
    lastScore: 0,
    claimedCount: 0,
    lastClaim: null,
    createdAt: serverTimestamp(),
    lastGameAt: serverTimestamp(),
  });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(getDb(), 'users', uid));
  return snap.exists() ? toProfile(uid, snap.data()) : null;
}

export function watchUserProfile(uid: string, cb: (p: UserProfile | null) => void): Unsubscribe {
  return onSnapshot(
    doc(getDb(), 'users', uid),
    (snap) => cb(snap.exists() ? toProfile(uid, snap.data()) : null),
    () => cb(null),
  );
}

/** Comprueba en Firestore si existe /admins/{uid}. */
export async function checkIsAdmin(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(getDb(), 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export interface GameSubmitResult {
  previousPoints: number;
  newPoints: number;
  previousHighScore: number;
  newRecord: boolean;
  profile: UserProfile;
}

/**
 * Registra el final de una partida: suma la puntuación al saldo, actualiza el
 * récord y crea /games/{uid}_{n}. Las reglas de Firestore validan cada valor.
 */
export async function submitGame(uid: string, score: number): Promise<GameSubmitResult> {
  const db = getDb();
  const userRef = doc(db, 'users', uid);
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('No se encontró tu perfil.');
    const u = snap.data() as UserProfile;
    const gamesPlayed = u.gamesPlayed + 1;
    tx.update(userRef, {
      points: u.points + score,
      highScore: Math.max(u.highScore, score),
      gamesPlayed,
      lastScore: score,
      lastGameAt: serverTimestamp(),
    });
    tx.set(doc(db, 'games', `${uid}_${gamesPlayed}`), {
      userId: uid,
      username: u.username,
      score,
      playedAt: serverTimestamp(),
    });
    return {
      previousPoints: u.points,
      newPoints: u.points + score,
      previousHighScore: u.highScore,
      newRecord: score > u.highScore,
      profile: { ...u, uid, highScore: Math.max(u.highScore, score), gamesPlayed },
    };
  });
  // El ranking se actualiza aparte: si fallara, la partida ya quedó guardada
  // y el ranking se corrige solo en el próximo inicio de sesión.
  void syncLeaderboard(result.profile).catch(() => undefined);
  return result;
}
