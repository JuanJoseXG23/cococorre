import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { AdminUsers } from './AdminUsers';
import { AdminRewards } from './AdminRewards';
import { AdminHistory } from './AdminHistory';
import { AdminConfig } from './AdminConfig';
import { BackIcon } from '../components/Icons';
import type { Nav } from '../App';

type Tab = 'users' | 'rewards' | 'history' | 'config';

const TABS: [Tab, string][] = [
  ['users', 'Usuarios'],
  ['rewards', 'Recompensas'],
  ['history', 'Historial'],
  ['config', 'Configuración'],
];

/**
 * Panel de administración. Ocultarlo en la interfaz es sólo comodidad:
 * la protección real está en firestore.rules (isAdmin() comprueba /admins/{uid}).
 */
export function AdminScreen({ nav }: { nav: Nav }) {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>('rewards');

  if (!isAdmin) {
    return (
      <div className="screen">
        <div className="content card center">
          <h2>Acceso restringido</h2>
          <p className="muted">Esta sección es sólo para administradores.</p>
          <button className="btn" onClick={() => nav('menu')}>Volver al menú</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen wide">
      <div className="content">
        <div className="topbar">
          <button className="icon-btn" onClick={() => nav('menu')} aria-label="Volver"><BackIcon /></button>
          <h1>Administración</h1>
          <span style={{ width: 42 }} />
        </div>
        <div className="tabs">
          {TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        {tab === 'users' && <AdminUsers />}
        {tab === 'rewards' && <AdminRewards />}
        {tab === 'history' && <AdminHistory />}
        {tab === 'config' && <AdminConfig />}
      </div>
    </div>
  );
}
