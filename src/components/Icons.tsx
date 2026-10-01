/** Íconos de línea sencillos (en lugar de emojis). */
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const BackIcon = () => (
  <svg {...base}><path d="M15 18l-6-6 6-6" /></svg>
);

export const PauseIcon = () => (
  <svg {...base}><path d="M9 5v14M15 5v14" /></svg>
);

export const SoundIcon = ({ muted }: { muted: boolean }) => (
  <svg {...base}>
    <path d="M4 9v6h4l5 4V5L8 9H4z" />
    {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" />}
  </svg>
);

export const HeartIcon = ({ size = 16 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden style={{ verticalAlign: '-2px' }}>
    <path
      d="M12 21s-7.5-4.6-9.5-9.2C1 8.4 3 5 6.5 5c2 0 3.6 1.1 4.5 2.6C11.9 6.1 13.5 5 15.5 5 19 5 21 8.4 20.5 11.8 19.5 16.4 12 21 12 21z"
      fill="var(--rose)"
    />
  </svg>
);
