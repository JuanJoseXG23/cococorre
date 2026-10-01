import { Logo } from '../components/Logo';

/** Se muestra si faltan las variables de entorno de Firebase. */
export function SetupScreen() {
  return (
    <div className="screen">
      <div className="content">
        <Logo small />
        <div className="card">
          <h2>⚙️ Falta configurar Firebase</h2>
          <p>
            No se encontraron las variables <code>VITE_FIREBASE_*</code>. Crea un archivo <code>.env</code>
            (copiando <code>.env.example</code>) o configura los <em>secrets</em> de GitHub Actions.
          </p>
          <p className="muted">Consulta el README, sección «Variables de entorno».</p>
        </div>
      </div>
    </div>
  );
}
