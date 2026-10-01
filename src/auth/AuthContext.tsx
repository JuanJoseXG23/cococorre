import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getAuthOrThrow } from '../firebase/app';
import { checkIsAdmin, watchUserProfile } from '../firebase/users';
import { loadGameConfig } from '../firebase/gameConfig';
import { DEFAULT_CONFIG, type GameConfig, type UserProfile } from '../firebase/types';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  /** Verificado contra /admins/{uid} en Firestore (y protegido por las reglas). */
  isAdmin: boolean;
  config: GameConfig;
  loading: boolean;
  reloadConfig: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(getAuthOrThrow(), (u) => {
    setUser(u);
    if (!u) {
      setProfile(null);
      setIsAdmin(false);
      setLoading(false);
    }
  }), []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    let first = true;
    const unsub = watchUserProfile(user.uid, (p) => {
      setProfile(p);
      if (first && p) {
        first = false;
        setLoading(false);
      }
    });
    // Si el perfil tarda (registro en curso), no bloquear para siempre.
    const timer = setTimeout(() => setLoading(false), 6000);
    void checkIsAdmin(user.uid).then(setIsAdmin);
    void loadGameConfig().then(setConfig);
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, [user]);

  const reloadConfig = useCallback(async () => {
    setConfig(await loadGameConfig());
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, config, loading, reloadConfig }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
