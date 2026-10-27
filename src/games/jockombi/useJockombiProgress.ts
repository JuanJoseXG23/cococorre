import { useEffect, useMemo, useState } from 'react';
import {
  ensureZombieStats, getCachedStats, getPending, mergeStats, onPendingChange, syncPending, watchZombieStats,
  type ZombieStats,
} from './progress';

export type CloudState = 'loading' | 'ok' | 'unavailable';

/**
 * Estadísticas de Jockombi del usuario: nube + partidas pendientes de
 * subir. Reintenta la sincronización al volver la conexión y cada 30 s.
 */
export function useJockombiProgress(uid: string | undefined) {
  const [cloud, setCloud] = useState<ZombieStats | null>(() => (uid ? getCachedStats(uid) : null));
  const [cloudState, setCloudState] = useState<CloudState>('loading');
  const [pending, setPendingList] = useState(() => (uid ? getPending(uid) : []));

  useEffect(() => {
    if (!uid) return;
    setPendingList(getPending(uid));
    return onPendingChange(uid, () => setPendingList(getPending(uid)));
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    let ensured = false;
    const unsub = watchZombieStats(
      uid,
      (s) => {
        setCloudState('ok');
        if (s) {
          setCloud(s);
        } else if (!ensured) {
          // Primera vez: se crea el progreso en cero (lo exigen las reglas).
          ensured = true;
          ensureZombieStats(uid).catch((e) => console.warn('[Jockombi] No se pudo crear el progreso', e));
        }
      },
      (e) => {
        console.warn('[Jockombi] Progreso en la nube no disponible; se usa el de este dispositivo', e);
        setCloudState('unavailable');
      },
    );
    void syncPending(uid);
    const timer = setInterval(() => {
      if (getPending(uid).length) void syncPending(uid);
    }, 30000);
    const onOnline = () => void syncPending(uid);
    window.addEventListener('online', onOnline);
    return () => {
      unsub();
      clearInterval(timer);
      window.removeEventListener('online', onOnline);
    };
  }, [uid]);

  const stats = useMemo(() => mergeStats(cloud, pending), [cloud, pending]);
  return { stats, pendingCount: pending.length, cloudState };
}
