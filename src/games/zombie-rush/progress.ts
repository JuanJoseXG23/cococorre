import { doc, onSnapshot, runTransaction, serverTimestamp, setDoc, type Timestamp, type Unsubscribe } from 'firebase/firestore';
import { getDb } from '../../firebase/app';
import { ZOMBIE_RUSH_ID } from './meta';
import type { RunStats } from './engine/types';

/**
 * Progreso persistente de Jockombi, separado de CoCoCorre:
 *
 *   users/{uid}/gameStats/zombie-rush            ← estadísticas acumuladas
 *   users/{uid}/gameStats/zombie-rush/runs/{id}  ← una entrada por partida
 *
 * No toca users/{uid} (saldo de puntos, récord y recompensas de CoCoCorre).
 * Cada partida tiene un ID único generado en el navegador: las reglas exigen
 * que `runs/{id}` no exista antes, así que reintentar el envío (por ejemplo
 * tras perder la conexión) nunca suma la misma partida dos veces.
 *
 * Sin conexión (o si las reglas aún no están publicadas) la partida queda en
 * una cola en este dispositivo y se sincroniza después, en orden.
 */
export interface ZombieStats {
  bestDistance: number;
  maxHorde: number;
  totalConverted: number;
  totalGems: number;
  gamesPlayed: number;
  lastDistance: number;
  lastRunId: string;
  lastPlayedAt: Timestamp | null;
  bestDistanceAt: Timestamp | null;
  maxHordeAt: Timestamp | null;
  createdAt?: Timestamp | null;
}

export interface PendingRun {
  runId: string;
  distance: number;
  maxHorde: number;
  converted: number;
  gems: number;
  durationMs: number;
  /** Fecha local (ms) en que terminó. */
  endedAt: number;
}

export const EMPTY_STATS: ZombieStats = {
  bestDistance: 0, maxHorde: 0, totalConverted: 0, totalGems: 0, gamesPlayed: 0, lastDistance: 0,
  lastRunId: '', lastPlayedAt: null, bestDistanceAt: null, maxHordeAt: null,
};

/** Límites que también comprueban las reglas de Firestore. */
const MAX_DISTANCE = 60000;
const MAX_HORDE = 75;

const statsRef = (uid: string) => doc(getDb(), 'users', uid, 'gameStats', ZOMBIE_RUSH_ID);
const runRef = (uid: string, runId: string) => doc(getDb(), 'users', uid, 'gameStats', ZOMBIE_RUSH_ID, 'runs', runId);

// ---------------------------------------------------------------- Almacenamiento local

const pendingKey = (uid: string) => `zr.pending.${uid}`;
const cacheKey = (uid: string) => `zr.cache.${uid}`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sin almacenamiento: el progreso se intenta guardar directo en la nube */
  }
}

export function getPending(uid: string): PendingRun[] {
  return readJson<PendingRun[]>(pendingKey(uid), []);
}

function setPending(uid: string, list: PendingRun[]) {
  writeJson(pendingKey(uid), list.slice(-200));
  notify(uid);
}

/** Copia local de las últimas estadísticas de la nube (para verlas sin conexión). */
export function getCachedStats(uid: string): ZombieStats | null {
  const c = readJson<Omit<ZombieStats, 'lastPlayedAt' | 'bestDistanceAt' | 'maxHordeAt'> | null>(cacheKey(uid), null);
  return c ? { ...c, lastPlayedAt: null, bestDistanceAt: null, maxHordeAt: null } : null;
}

function setCachedStats(uid: string, s: ZombieStats) {
  const { lastPlayedAt: _a, bestDistanceAt: _b, maxHordeAt: _c, createdAt: _d, ...plain } = s;
  writeJson(cacheKey(uid), plain);
}

// ---------------------------------------------------------------- Suscripción

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();
function notify(uid: string) {
  listeners.get(uid)?.forEach((l) => l());
}
export function onPendingChange(uid: string, l: Listener): () => void {
  let set = listeners.get(uid);
  if (!set) listeners.set(uid, (set = new Set()));
  set.add(l);
  return () => set!.delete(l);
}

/**
 * Escucha las estadísticas en la nube. `cb(null)` si el documento aún no
 * existe; `onError` si no se pueden leer (sin conexión o reglas sin publicar).
 */
export function watchZombieStats(uid: string, cb: (s: ZombieStats | null) => void, onError: (e: unknown) => void): Unsubscribe {
  return onSnapshot(
    statsRef(uid),
    (snap) => {
      if (!snap.exists()) return cb(null);
      const s = { ...EMPTY_STATS, ...(snap.data() as Partial<ZombieStats>) };
      setCachedStats(uid, s);
      cb(s);
    },
    onError,
  );
}

/** Crea el documento de estadísticas en cero (requisito de las reglas antes de la primera partida). */
export async function ensureZombieStats(uid: string): Promise<void> {
  await setDoc(statsRef(uid), {
    bestDistance: 0, maxHorde: 0, totalConverted: 0, totalGems: 0, gamesPlayed: 0, lastDistance: 0, lastRunId: '',
    lastPlayedAt: serverTimestamp(), bestDistanceAt: null, maxHordeAt: null, createdAt: serverTimestamp(),
  });
}

// ---------------------------------------------------------------- Registro de partidas

/** ID aleatorio de partida (letras y números, como exigen las reglas). */
export function newRunId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
}

export function toPendingRun(runId: string, s: RunStats): PendingRun {
  const distance = Math.max(0, Math.min(MAX_DISTANCE, Math.floor(s.distance)));
  return {
    runId,
    distance,
    maxHorde: Math.max(1, Math.min(MAX_HORDE, Math.floor(s.maxHorde))),
    converted: Math.max(0, Math.min(Math.floor(s.converted), Math.floor(distance / 2) + 20)),
    gems: Math.max(0, Math.min(Math.floor(s.gems), distance + 50)),
    durationMs: Math.max(Math.round(s.durationMs), distance * 40),
    endedAt: Date.now(),
  };
}

/** Guarda la partida en la cola local (nunca se pierde) y la intenta subir. */
export function recordRun(uid: string, run: PendingRun): Promise<SyncResult> {
  const list = getPending(uid);
  if (!list.some((r) => r.runId === run.runId)) setPending(uid, [...list, run]);
  return syncPending(uid);
}

export type SyncResult = 'synced' | 'pending' | 'offline';

class NeedsStatsDoc extends Error {}

const syncing = new Map<string, Promise<SyncResult>>();

/** Sube las partidas pendientes, en orden. Nunca lanza errores. */
export function syncPending(uid: string): Promise<SyncResult> {
  const running = syncing.get(uid);
  if (running) return running.then(() => syncPending(uid));
  const p = doSync(uid).finally(() => syncing.delete(uid));
  syncing.set(uid, p);
  return p;
}

async function doSync(uid: string): Promise<SyncResult> {
  let list = getPending(uid);
  if (!list.length) return 'synced';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  const db = getDb();
  for (const run of [...list]) {
    try {
      await runTransaction(db, async (tx) => {
        const rRef = runRef(uid, run.runId);
        const sRef = statsRef(uid);
        const already = await tx.get(rRef);
        if (already.exists()) return; // ya estaba guardada: no se vuelve a sumar
        const snap = await tx.get(sRef);
        if (!snap.exists()) throw new NeedsStatsDoc();
        const b = { ...EMPTY_STATS, ...(snap.data() as Partial<ZombieStats>) };
        const newBest = run.distance > b.bestDistance;
        const newHorde = run.maxHorde > b.maxHorde;
        tx.update(sRef, {
          bestDistance: newBest ? run.distance : b.bestDistance,
          maxHorde: newHorde ? run.maxHorde : b.maxHorde,
          totalConverted: b.totalConverted + run.converted,
          totalGems: b.totalGems + run.gems,
          gamesPlayed: b.gamesPlayed + 1,
          lastDistance: run.distance,
          lastRunId: run.runId,
          lastPlayedAt: serverTimestamp(),
          bestDistanceAt: newBest ? serverTimestamp() : b.bestDistanceAt,
          maxHordeAt: newHorde ? serverTimestamp() : b.maxHordeAt,
        });
        tx.set(rRef, {
          distance: run.distance, maxHorde: run.maxHorde, converted: run.converted, gems: run.gems,
          durationMs: run.durationMs, playedAt: serverTimestamp(),
        });
      });
      list = list.filter((r) => r.runId !== run.runId);
      setPending(uid, list);
    } catch (e) {
      if (e instanceof NeedsStatsDoc) {
        // Primera partida: se crea el documento y se reintenta más tarde
        // (las reglas piden un tiempo mínimo entre partidas).
        try {
          await ensureZombieStats(uid);
        } catch (e2) {
          console.warn('[Jockombi] No se pudo crear el progreso en la nube', e2);
        }
      } else {
        console.warn('[Jockombi] Partida pendiente de sincronizar', e);
      }
      return (e as { code?: string })?.code === 'unavailable' ? 'offline' : 'pending';
    }
  }
  return 'synced';
}

// ---------------------------------------------------------------- Vista combinada

/** Estadísticas a mostrar: las de la nube + las partidas que aún no se subieron. */
export function mergeStats(base: ZombieStats | null, pending: PendingRun[]): ZombieStats {
  const s: ZombieStats = { ...(base ?? EMPTY_STATS) };
  for (const r of pending) {
    if (r.runId === s.lastRunId) continue;
    s.bestDistance = Math.max(s.bestDistance, r.distance);
    s.maxHorde = Math.max(s.maxHorde, r.maxHorde);
    s.totalConverted += r.converted;
    s.totalGems += r.gems;
    s.gamesPlayed += 1;
    s.lastDistance = r.distance;
  }
  return s;
}
