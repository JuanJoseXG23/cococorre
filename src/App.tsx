import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './auth/AuthContext';
import { forgetSessionAndReload, logout } from './firebase/auth';
import { AuthScreen } from './auth/AuthScreen';
import { MenuScreen } from './screens/MenuScreen';
import { GameScreen } from './screens/GameScreen';
import { GameOverScreen } from './screens/GameOverScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { RewardsScreen } from './rewards/RewardsScreen';
import { AdminScreen } from './admin/AdminScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { HubScreen } from './platform/HubScreen';
import { Loading } from './components/Decorations';
import { Logo } from './components/Logo';
import { HASH_OF, screenFromHash, type Nav, type Screen } from './platform/navigation';
import type { GameResult } from './game/types';

export type { Nav, Screen } from './platform/navigation';

// El motor de Zombie Rush se descarga sólo al abrir el juego.
const ZombieRushScreen = lazy(() => import('./games/zombie-rush/ZombieRushScreen').then((m) => ({ default: m.ZombieRushScreen })));

export function App() {
  const { user, profile, profileError, retryProfile, loading, slow } = useAuth();
  const [retrying, setRetrying] = useState(false);
  // Al recargar con #zombie-rush, #rewards... se abre esa pantalla directamente.
  const [screen, setScreen] = useState<Screen>(() => screenFromHash(location.hash));
  const [result, setResult] = useState<GameResult | null>(null);
  const [gameKey, setGameKey] = useState(0);

  const nav: Nav = useCallback((s) => {
    setScreen(s);
    if (s === 'game') setGameKey((k) => k + 1);
    // El botón "atrás" del celular regresa al menú en vez de salir de la página.
    const h = HASH_OF[s];
    if (h === undefined) return;
    const hash = h ? `#${h}` : '';
    if (location.hash !== hash) history.pushState(null, '', hash || location.pathname + location.search);
  }, []);

  useEffect(() => {
    const onPop = () => setScreen(screenFromHash(location.hash));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Al cerrar sesión, volver al menú inicial (sólo si había una sesión: al
  // cargar la página `user` empieza en null y no debe borrar el #hash).
  const hadUser = useRef(false);
  useEffect(() => {
    if (user) {
      hadUser.current = true;
    } else if (hadUser.current) {
      hadUser.current = false;
      setScreen('menu');
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="screen">
        <div className="content">
          <Logo />
          <Loading />
          {slow && (
            <div className="card center">
              <h2>Está tardando más de lo normal</h2>
              <p className="muted">
                No logramos comunicarnos con el servidor. Revisa tu conexión a internet
                (prueba con datos móviles o con otra red Wi-Fi).
              </p>
              <div className="menu-buttons">
                <button className="btn block" onClick={() => location.reload()}>Reintentar</button>
                <button className="btn ghost block" onClick={forgetSessionAndReload}>Volver a iniciar sesión</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  if (!user) return <AuthScreen />;
  if (!profile) {
    return (
      <div className="screen">
        <div className="content">
          <Logo small />
          {profileError ? (
            <div className="card center">
              <h2>No pudimos preparar tu perfil</h2>
              <p className="muted">{profileError}</p>
              <div className="menu-buttons">
                <button
                  className="btn block"
                  disabled={retrying}
                  onClick={async () => {
                    setRetrying(true);
                    await retryProfile();
                    setRetrying(false);
                  }}
                >
                  {retrying ? 'Intentando...' : 'Reintentar'}
                </button>
                <button className="btn ghost block" onClick={() => void logout()}>Cerrar sesión</button>
              </div>
            </div>
          ) : (
            <Loading text="Preparando tu perfil..." />
          )}
        </div>
      </div>
    );
  }

  switch (screen) {
    case 'game':
      return (
        <GameScreen
          key={gameKey}
          onExit={() => nav('cococorre')}
          onGameOver={(r) => {
            setResult(r);
            setScreen('gameover');
          }}
        />
      );
    case 'gameover':
      return result ? <GameOverScreen result={result} nav={nav} onPlayAgain={() => nav('game')} /> : <MenuScreen nav={nav} />;
    case 'cococorre':
      return <MenuScreen nav={nav} />;
    case 'zombie':
      return (
        <Suspense fallback={<div className="screen zr-screen"><div className="content"><Loading text="Cargando la horda..." /></div></div>}>
          <ZombieRushScreen nav={nav} />
        </Suspense>
      );
    case 'rewards':
      return <RewardsScreen nav={nav} />;
    case 'ranking':
      return <LeaderboardScreen nav={nav} />;
    case 'profile':
      return <ProfileScreen nav={nav} />;
    case 'admin':
      return <AdminScreen nav={nav} />;
    default:
      return <HubScreen nav={nav} />;
  }
}
