import { PLAYER_NAME } from '../config';

/** Logo del juego: Coco (perrito) + "CoCoCorre". */
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className="logo">
      {!small && <CocoFace />}
      <div className="title" style={small ? { fontSize: '2rem' } : undefined}>
        CoCo<span className="accent">Corre</span>
      </div>
      {!small && <div className="subtitle">Hecho con cariño para {PLAYER_NAME}</div>}
    </div>
  );
}

/** Mechones alrededor de un círculo (pelaje esponjoso de Pomerania). */
function tufts(cx: number, cy: number, r: number, n: number, tr: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return <circle key={i} cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r} r={tr} />;
  });
}

/** Cara de Coco: un Pomerania sable con marcas canela. */
export function CocoFace() {
  return (
    <svg viewBox="0 0 120 120" aria-label="Coco">
      {/* orejitas en punta */}
      <path d="M30 44 L38 10 L54 34 Z" fill="#2c2527" />
      <path d="M90 44 L82 10 L66 34 Z" fill="#2c2527" />
      <path d="M36 38 L39 20 L48 33 Z" fill="#c99a6b" />
      <path d="M84 38 L81 20 L72 33 Z" fill="#c99a6b" />
      {/* melena */}
      <g fill="#3a3335">
        <circle cx="60" cy="66" r="40" />
        {tufts(60, 66, 40, 18, 9)}
      </g>
      {/* cabeza */}
      <g fill="#4f4749">
        <circle cx="60" cy="58" r="28" />
        {tufts(60, 58, 27, 14, 6)}
      </g>
      {/* frente café y marcas canela */}
      <ellipse cx="60" cy="40" rx="14" ry="9" fill="#7a5a44" />
      <ellipse cx="47" cy="49" rx="5" ry="3.5" fill="#c99a6b" />
      <ellipse cx="73" cy="49" rx="5" ry="3.5" fill="#c99a6b" />
      <ellipse cx="60" cy="72" rx="15" ry="11" fill="#c99a6b" />
      <ellipse cx="42" cy="70" rx="7" ry="6" fill="#b88a5e" />
      <ellipse cx="78" cy="70" rx="7" ry="6" fill="#b88a5e" />
      {/* ojos */}
      <ellipse cx="48" cy="58" rx="5.5" ry="6" fill="#1e1416" />
      <ellipse cx="72" cy="58" rx="5.5" ry="6" fill="#1e1416" />
      <circle cx="50" cy="56" r="2" fill="#fff" />
      <circle cx="74" cy="56" r="2" fill="#fff" />
      {/* nariz y boquita */}
      <ellipse cx="60" cy="67" rx="5.5" ry="4" fill="#1e1416" />
      <path d="M60 71 v3 M54 76 q6 4 12 0" stroke="#1e1416" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <ellipse cx="60" cy="80" rx="3.5" ry="3" fill="#e88f9f" />
      {/* collar */}
      <rect x="36" y="96" width="48" height="8" rx="4" fill="#d4849a" />
      <path d="M60 111 l-6 -6 a4 4 0 0 1 6 -5 a4 4 0 0 1 6 5 z" fill="#ecd3a8" />
    </svg>
  );
}
