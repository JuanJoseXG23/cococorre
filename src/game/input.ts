import type { Direction } from './types';

const KEYS: Record<string, Direction> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'up',
};

const SWIPE_MIN = 24;

/**
 * Teclado (flechas / WASD / espacio) y gestos táctiles
 * (deslizar en 4 direcciones, tocar = avanzar).
 * Devuelve una función para quitar los listeners.
 */
export function attachInput(target: HTMLElement, onMove: (d: Direction) => void): () => void {
  const onKey = (e: KeyboardEvent) => {
    const dir = KEYS[e.code];
    if (!dir) return;
    e.preventDefault();
    if (!e.repeat) onMove(dir);
  };

  let startX = 0;
  let startY = 0;
  let tracking = false;

  const onPointerDown = (e: PointerEvent) => {
    tracking = true;
    startX = e.clientX;
    startY = e.clientY;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) {
      onMove('up');
    } else if (Math.abs(dx) > Math.abs(dy)) {
      onMove(dx > 0 ? 'right' : 'left');
    } else {
      onMove(dy > 0 ? 'down' : 'up');
    }
  };
  const onPointerCancel = () => {
    tracking = false;
  };
  const prevent = (e: TouchEvent) => e.preventDefault();

  window.addEventListener('keydown', onKey);
  target.addEventListener('pointerdown', onPointerDown);
  target.addEventListener('pointerup', onPointerUp);
  target.addEventListener('pointercancel', onPointerCancel);
  target.addEventListener('touchmove', prevent, { passive: false });

  return () => {
    window.removeEventListener('keydown', onKey);
    target.removeEventListener('pointerdown', onPointerDown);
    target.removeEventListener('pointerup', onPointerUp);
    target.removeEventListener('pointercancel', onPointerCancel);
    target.removeEventListener('touchmove', prevent);
  };
}
