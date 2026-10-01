import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './auth/AuthContext';
import { AuthScreen } from './auth/AuthScreen';
import { MenuScreen } from './screens/MenuScreen';
import { GameScreen } from './screens/GameScreen';
import { GameOverScreen } from './screens/GameOverScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { RewardsScreen } from './rewards/RewardsScreen';
import { AdminScreen } from './admin/AdminScreen';
import { HeartsBackground, Loading } from './components/Decorations';
import { Logo } from './components/Logo';
import type { GameResult } from './game/types';

export type Screen = 'menu' | 'game' | 'gameover' | 'rewards' | 'profile' | 'admin';
export type Nav = (s: Screen) => void;

const HASHABLE: Screen[] = ['menu', 'rewards', 'profile', 'admin'];

export function App() {
  const { user, profile, loading } = useAuth();
  const [screen, setScreen] = useState<Screen>('menu');
  const [result, setResult] = useState<GameResult | null>(null);
  const [gameKey, setGameKey] = useState(0);

  const nav: Nav = useCallback((s) => {
    setScreen(s);
    if (s === 'game') setGameKey((k) => k + 1);
    // El botón "atrás" del celular regresa al menú en vez de salir del juego.
    const hash = s === 'menu' ? '' : `#${s}`;
    if (HASHABLE.includes(s) && location.hash !== hash) history.pushState(null, '', hash || location.pathname);
  }, []);

  useEffect(() => {
    const onPop = () => {
      const h = location.hash.slice(1) as Screen;
      setScreen(HASHABLE.includes(h) ? h : 'menu');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Al cerrar sesión, volver al menú inicial.
  useEffect(() => {
    if (!user) setScreen('menu');
  }, [user]);

  if (loading) {
    return (
      <div className="screen">
        <HeartsBackground />
        <div className="content"><Logo /><Loading /></div>
      </div>
    );
  }
  if (!user) return <AuthScreen />;
  if (!profile) {
    return (
      <div className="screen">
        <div className="content"><Logo small /><Loading text="Preparando tu perfil..." /></div>
      </div>
    );
  }

  switch (screen) {
    case 'game':
      return (
        <GameScreen
          key={gameKey}
          onExit={() => nav('menu')}
          onGameOver={(r) => {
            setResult(r);
            setScreen('gameover');
          }}
        />
      );
    case 'gameover':
      return result ? <GameOverScreen result={result} nav={nav} onPlayAgain={() => nav('game')} /> : <MenuScreen nav={nav} />;
    case 'rewards':
      return <RewardsScreen nav={nav} />;
    case 'profile':
      return <ProfileScreen nav={nav} />;
    case 'admin':
      return <AdminScreen nav={nav} />;
    default:
      return <MenuScreen nav={nav} />;
  }
}
