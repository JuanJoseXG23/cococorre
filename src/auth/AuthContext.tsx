import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getAuthOrThrow } from '../firebase/app';
import { checkIsAdmin, createUserProfile, watchUserProfile } from '../firebase/users';
import { loadGameConfig } from '../firebase/gameConfig';
import { syncLeaderboard } from '../firebase/leaderboard';
import { friendlyError } from '../firebase/errors';
import { USERNAME_EMAIL_DOMAIN } from '../config';
import { DEFAULT_CONFIG, type GameConfig, type UserProfile } from '../firebase/types';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  /** Mensaje si no se pudo cargar o crear el perfil (en vez de esperar para siempre). */
  profileError: string;
  /** Vuelve a intentar crear el perfil que falta. */
  retryProfile: () => Promise<void>;
  /** Verificado contra /admins/{uid} en Firestore (y protegido por las reglas). */
  isAdmin: boolean;
  config: GameConfig;
  loading: boolean;
  /** true si la conexión con Firebase tarda demasiado (para mostrar ayuda). */
  slow: boolean;
  reloadConfig: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** juanita@cococorre.app -> juanita */
function usernameFromUser(u: User): string {
  return (u.email ?? '').replace(`@${USERNAME_EMAIL_DOMAIN}`, '');
}

/** Tiempo de espera antes de reparar un perfil que no existe (deja terminar el registro). */
const REPAIR_DELAY_MS = 3500;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);
  const repairing = useRef(false);

  // Si Firebase no responde (mala señal, red que bloquea Google...), avisar en vez de esperar en silencio.
  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => onAuthStateChanged(getAuthOrThrow(), (u) => {
    setUser(u);
    setProfileError('');
    if (!u) {
      setProfile(null);
      setIsAdmin(false);
      setLoading(false);
    }
  }), []);

  /** Crea el perfil si la cuenta existe en Authentication pero no en Firestore. */
  const repairProfile = useCallback(async (u: User) => {
    if (repairing.current) return;
    repairing.current = true;
    setProfileError('');
    try {
      await createUserProfile(u.uid, usernameFromUser(u));
    } catch (e) {
      setProfileError(friendlyError(e));
    } finally {
      repairing.current = false;
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    let first = true;
    let repairTimer: ReturnType<typeof setTimeout> | undefined;
    const unsub = watchUserProfile(
      user.uid,
      (p) => {
        setProfile(p);
        clearTimeout(repairTimer);
        if (p) {
          setProfileError('');
          if (first) {
            first = false;
            setLoading(false);
            // Asegura que todas las jugadoras registradas aparezcan en el ranking.
            void syncLeaderboard(p).catch(() => undefined);
          }
        } else {
          // El perfil no existe: si sigue sin aparecer, se crea automáticamente.
          repairTimer = setTimeout(() => void repairProfile(user), REPAIR_DELAY_MS);
        }
      },
      (e) => {
        setProfileError(friendlyError(e));
        setLoading(false);
      },
    );
    // Nunca bloquear la pantalla de carga para siempre.
    const timer = setTimeout(() => setLoading(false), 6000);
    void checkIsAdmin(user.uid).then(setIsAdmin);
    void loadGameConfig().then(setConfig);
    return () => {
      unsub();
      clearTimeout(timer);
      clearTimeout(repairTimer);
    };
  }, [user, repairProfile]);

  const retryProfile = useCallback(async () => {
    if (user) await repairProfile(user);
  }, [user, repairProfile]);

  const reloadConfig = useCallback(async () => {
    setConfig(await loadGameConfig());
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, profileError, retryProfile, isAdmin, config, loading, slow, reloadConfig }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
