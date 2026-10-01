import { useMemo } from 'react';

const ICONS = ['❤️', '💕', '⭐', '💖', '🐾', '✨'];

/** Corazones y estrellas que flotan en el fondo de los menús. */
export function HeartsBackground() {
  const items = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        icon: ICONS[i % ICONS.length],
        left: Math.random() * 100,
        duration: 12 + Math.random() * 14,
        delay: -Math.random() * 20,
        size: 16 + Math.random() * 18,
      })),
    [],
  );
  return (
    <div className="hearts-bg" aria-hidden>
      {items.map((h, i) => (
        <span
          key={i}
          style={{
            left: `${h.left}%`,
            animationDuration: `${h.duration}s`,
            animationDelay: `${h.delay}s`,
            fontSize: h.size,
          }}
        >
          {h.icon}
        </span>
      ))}
    </div>
  );
}

/** Lluvia de confeti y corazones para celebrar. */
export function Confetti({ count = 40 }: { count?: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        icon: ['❤️', '🎉', '⭐', '💖', '🎊', '💕'][i % 6],
        left: Math.random() * 100,
        duration: 2.2 + Math.random() * 2.2,
        delay: Math.random() * 0.8,
      })),
    [count],
  );
  return (
    <div className="confetti" aria-hidden>
      {items.map((c, i) => (
        <span
          key={i}
          style={{ left: `${c.left}%`, animationDuration: `${c.duration}s`, animationDelay: `${c.delay}s` }}
        >
          {c.icon}
        </span>
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
