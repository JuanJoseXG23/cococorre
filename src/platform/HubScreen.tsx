import type { CSSProperties } from 'react';
import { useAuth } from '../auth/AuthContext';
import { logout } from '../firebase/auth';
import { CocoFace } from '../components/Logo';
import { CharacterPreview } from '../components/CharacterPreview';
import { getSavedSkin } from '../game/characters';
import { PLATFORM_NAME } from '../config';
import { GAMES, type GameEntry } from './registry';
import type { Nav } from './navigation';

/** Menú principal de la plataforma: saludo, juegos disponibles y accesos de la cuenta. */
export function HubScreen({ nav }: { nav: Nav }) {
  const { profile, isAdmin, config } = useAuth();
  const skin = getSavedSkin(profile?.heartsTotal ?? 0);
  const [brandA, ...brandB] = PLATFORM_NAME.split(' ');

  return (
    <div className="screen wide hub">
      <div className="content hub-content">
        <header className="hub-header">
          <div className="hub-brand">
            <span className="hub-brand-face"><CocoFace /></span>
            <span className="hub-brand-name">{brandA}<span>{brandB.join(' ')}</span></span>
          </div>
          <button className="hub-user" onClick={() => nav('profile')} aria-label="Mi perfil">
            <span className="hub-avatar"><CharacterPreview skin={skin} size={40} /></span>
            <span className="hub-user-name">{profile?.username}</span>
          </button>
        </header>

        <section className="hub-welcome">
          <h1>Hola, {profile?.username}</h1>
          <p>{config.welcomeMessage}</p>
        </section>

        <h2 className="hub-section">Elige un juego</h2>
        <div className="hub-games">
          {GAMES.map((g) => <GameCard key={g.id} game={g} onPlay={() => nav(g.screen)} />)}
          <div className="game-card soon" aria-hidden>
            <div className="soon-inner">
              <span className="soon-plus">+</span>
              <strong>Más juegos pronto</strong>
              <span>La plataforma está lista para recibir nuevos minijuegos.</span>
            </div>
          </div>
        </div>

        <h2 className="hub-section">Tu cuenta</h2>
        <div className="hub-account">
          <button className="hub-tile rewards" onClick={() => nav('rewards')}>
            <span className="hub-tile-title">Recompensas</span>
            <span className="hub-tile-value">{profile?.points ?? 0} puntos</span>
            <span className="hub-tile-hint">Se ganan jugando CoCoCorre</span>
          </button>
          <button className="hub-tile ranking" onClick={() => nav('ranking')}>
            <span className="hub-tile-title">Ranking</span>
            <span className="hub-tile-value">Récord {profile?.highScore ?? 0}</span>
            <span className="hub-tile-hint">Top de CoCoCorre</span>
          </button>
          <button className="hub-tile profile" onClick={() => nav('profile')}>
            <span className="hub-tile-title">Mi perfil</span>
            <span className="hub-tile-value">Estadísticas</span>
            <span className="hub-tile-hint">De todos los juegos</span>
          </button>
          {isAdmin && (
            <button className="hub-tile admin" onClick={() => nav('admin')}>
              <span className="hub-tile-title">Administración</span>
              <span className="hub-tile-value">Panel</span>
              <span className="hub-tile-hint">Usuarios y recompensas</span>
            </button>
          )}
        </div>

        <button className="link-btn" onClick={() => void logout()}>Cerrar sesión</button>
      </div>
    </div>
  );
}

function GameCard({ game, onPlay }: { game: GameEntry; onPlay: () => void }) {
  const { Cover, Progress, theme } = game;
  const style = {
    '--g-from': theme.from,
    '--g-to': theme.to,
    '--g-accent': theme.accent,
    '--g-accent-dark': theme.accentDark,
  } as CSSProperties;
  return (
    <article className={`game-card ${theme.dark ? 'dark' : ''}`} style={style}>
      <button className="game-cover" onClick={onPlay} aria-label={`Jugar ${game.name}`} tabIndex={-1}>
        <Cover />
        {game.badge && <span className="game-badge">{game.badge}</span>}
      </button>
      <div className="game-body">
        <div>
          <h3>{game.name}</h3>
          <p className="game-tagline">{game.tagline}</p>
        </div>
        <p className="game-desc">{game.description}</p>
        <div className="game-progress"><Progress /></div>
        <button className="btn big block game-play" onClick={onPlay}>Jugar</button>
      </div>
    </article>
  );
}
