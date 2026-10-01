import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDb } from './app';
import type { Claim, Reward, UserProfile } from './types';

export type RewardInput = Omit<Reward, 'id' | 'createdAt' | 'updatedAt'>;

export function watchRewards(cb: (r: Reward[]) => void, onError?: (e: unknown) => void): Unsubscribe {
  const q = query(collection(getDb(), 'rewards'), orderBy('order', 'asc'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Reward, 'id'>) }))),
    (e) => onError?.(e),
  );
}

/** Reclamaciones de un usuario. */
export function watchMyClaims(uid: string, cb: (c: Claim[]) => void): Unsubscribe {
  const q = query(collection(getDb(), 'claims'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Claim, 'id'>) }))),
    () => cb([]),
  );
}

export class ClaimError extends Error {}

/**
 * Reclama una recompensa en una transacción atómica:
 *  1. vuelve a leer saldo y recompensa en Firestore,
 *  2. descuenta el costo,
 *  3. crea claims/{uid}_{rewardId} (ID único => no se puede repetir).
 * Las reglas de seguridad rechazan cualquier intento de manipulación.
 */
export async function claimReward(
  uid: string,
  rewardId: string,
): Promise<{ newPoints: number; reward: Reward }> {
  const db = getDb();
  const userRef = doc(db, 'users', uid);
  const rewardRef = doc(db, 'rewards', rewardId);
  const claimRef = doc(db, 'claims', `${uid}_${rewardId}`);
  try {
    return await runTransaction(db, async (tx) => {
      const userSnap = await tx.get(userRef);
      const rewardSnap = await tx.get(rewardRef);
      if (!userSnap.exists()) throw new ClaimError('No se encontró tu perfil.');
      if (!rewardSnap.exists()) throw new ClaimError('Esta recompensa ya no existe.');
      const user = userSnap.data() as UserProfile;
      const reward: Reward = { id: rewardId, ...(rewardSnap.data() as Omit<Reward, 'id'>) };
      if (!reward.active) throw new ClaimError('Esta recompensa no está disponible por ahora.');
      if (user.points < reward.cost) throw new ClaimError('Aún no tienes suficientes puntos.');
      const newPoints = user.points - reward.cost;
      tx.update(userRef, {
        points: newPoints,
        claimedCount: user.claimedCount + 1,
        lastClaim: rewardId,
      });
      tx.set(claimRef, {
        userId: uid,
        username: user.username,
        rewardId,
        rewardName: reward.name,
        cost: reward.cost,
        claimedAt: serverTimestamp(),
      });
      return { newPoints, reward };
    });
  } catch (e) {
    if (e instanceof ClaimError) throw e;
    if ((e as { code?: string }).code === 'permission-denied') {
      throw new ClaimError('No se pudo reclamar: es posible que ya la hayas reclamado.');
    }
    throw e;
  }
}

// ---------- Administración ----------

export async function createReward(input: RewardInput): Promise<void> {
  await addDoc(collection(getDb(), 'rewards'), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function setRewardWithId(id: string, input: RewardInput): Promise<void> {
  await setDoc(doc(getDb(), 'rewards', id), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateReward(id: string, input: Partial<RewardInput>): Promise<void> {
  await updateDoc(doc(getDb(), 'rewards', id), { ...input, updatedAt: serverTimestamp() });
}

export async function deleteReward(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'rewards', id));
}
