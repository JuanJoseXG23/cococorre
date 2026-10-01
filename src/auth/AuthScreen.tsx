import { useState, type FormEvent } from 'react';
import { login, register, validatePassword, validateUsername } from '../firebase/auth';
import { friendlyError } from '../firebase/errors';
import { Logo } from '../components/Logo';
import { HeartsBackground } from '../components/Decorations';

type Mode = 'login' | 'register';

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setPassword('');
    setConfirm('');
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const uErr = validateUsername(username);
    if (uErr) return setError(uErr);
    if (mode === 'login') {
      if (!password) return setError('Escribe tu contraseña.');
    } else {
      const pErr = validatePassword(password);
      if (pErr) return setError(pErr);
      if (password !== confirm) return setError('Las contraseñas no coinciden.');
    }
    setBusy(true);
    try {
      if (mode === 'login') await login(username, password);
      else await register(username, password);
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <HeartsBackground />
      <div className="content">
        <Logo />
        <div className="card">
          <div className="tabs" style={{ marginBottom: 16 }}>
            <button className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')} type="button">
              Iniciar sesión
            </button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')} type="button">
              Crear cuenta
            </button>
          </div>
          <form className="form" onSubmit={onSubmit} noValidate>
            <div className="field">
              <label htmlFor="username">Usuario</label>
              <input
                id="username"
                className="input"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="tu_usuario"
              />
            </div>
            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
              />
            </div>
            {mode === 'register' && (
              <div className="field">
                <label htmlFor="confirm">Confirmar contraseña</label>
                <input
                  id="confirm"
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••"
                />
              </div>
            )}
            {error && <div className="error" role="alert">{error}</div>}
            <button className="btn big block" type="submit" disabled={busy}>
              {busy ? 'Un momento...' : mode === 'login' ? '🐾 Iniciar sesión' : '💖 Crear cuenta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
