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

export const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="currentColor">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3z" />
  </svg>
);
