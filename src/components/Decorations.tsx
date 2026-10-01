import { useMemo } from 'react';

const COLORS = ['#d4849a', '#ecd3a8', '#8fb8a4', '#96b8d2', '#ab9fcb'];

/** Confeti suave de puntos de colores para celebrar. */
export function Confetti({ count = 30 }: { count?: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        color: COLORS[i % COLORS.length],
        left: Math.random() * 100,
        duration: 3 + Math.random() * 2.5,
        delay: Math.random() * 0.8,
        size: 6 + Math.random() * 6,
      })),
    [count],
  );
  return (
    <div className="confetti" aria-hidden>
      {items.map((c, i) => (
        <span
          key={i}
          style={{
            left: `${c.left}%`,
            background: c.color,
            width: c.size,
            height: c.size,
            animationDuration: `${c.duration}s`,
            animationDelay: `${c.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export function Loading({ text = 'Cargando...' }: { text?: string }) {
  return (
    <div className="center" style={{ padding: 24 }}>
      <div className="spinner" />
      <p className="muted">{text}</p>
    </div>
  );
}
