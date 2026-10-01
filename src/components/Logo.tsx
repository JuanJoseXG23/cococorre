import { PLAYER_NAME } from '../config';

/** Logo del juego: Coco (perrito) + "CoCoCorre". */
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className="logo">
      {!small && <CocoFace />}
      <div className="title" style={small ? { fontSize: '2.2rem' } : undefined}>
        <span>CoCo</span>
        <span>Co</span>
        <span>rre</span>
      </div>
      {!small && <div className="subtitle">Hecho con ❤️ para {PLAYER_NAME}</div>}
    </div>
  );
}

export function CocoFace() {
  return (
    <svg viewBox="0 0 120 120" aria-label="Coco">
      <ellipse cx="28" cy="58" rx="16" ry="28" fill="#7a4a2a" transform="rotate(12 28 58)" />
      <ellipse cx="92" cy="58" rx="16" ry="28" fill="#7a4a2a" transform="rotate(-12 92 58)" />
      <circle cx="60" cy="64" r="38" fill="#c98a55" />
      <ellipse cx="60" cy="82" rx="20" ry="15" fill="#f3d9b8" />
      <circle cx="45" cy="58" r="6" fill="#2a1a10" />
      <circle cx="75" cy="58" r="6" fill="#2a1a10" />
      <circle cx="47" cy="56" r="2" fill="#fff" />
      <circle cx="77" cy="56" r="2" fill="#fff" />
      <ellipse cx="60" cy="74" rx="8" ry="6" fill="#2a1a10" />
      <path d="M60 80 v6 M52 88 q8 6 16 0" stroke="#2a1a10" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="38" cy="74" rx="6" ry="4" fill="#ff8fb1" opacity="0.6" />
      <ellipse cx="82" cy="74" rx="6" ry="4" fill="#ff8fb1" opacity="0.6" />
      <rect x="34" y="98" width="52" height="9" rx="4" fill="#ff4f81" />
      <path d="M60 104 l-6 -6 a4 4 0 0 1 6 -5 a4 4 0 0 1 6 5 z" fill="#ffd54f" />
    </svg>
  );
}
