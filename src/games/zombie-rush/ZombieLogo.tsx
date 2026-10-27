import { ZOMBIE_RUSH_NAME } from './meta';

/** Logotipo tipográfico: primera palabra en verde "tóxico" con gotas, el resto en naranja. */
export function ZombieLogo({ size = 'big' }: { size?: 'big' | 'small' }) {
  const [first, ...rest] = ZOMBIE_RUSH_NAME.split(' ');
  return (
    <div className={`zr-logo ${size}`} aria-label={ZOMBIE_RUSH_NAME}>
      <span className="zr-logo-a">
        {first}
        <svg className="zr-drips" viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden>
          <path d="M6 0h10v5a3 3 0 0 1-6 0zM34 0h8v9a3 3 0 0 1-6 0V4zM60 0h9v4a3 3 0 0 1-6 0zM84 0h8v8a3 3 0 0 1-6 0V3z" fill="currentColor" />
        </svg>
      </span>
      {rest.length > 0 && <span className="zr-logo-b">{rest.join(' ')}</span>}
    </div>
  );
}
