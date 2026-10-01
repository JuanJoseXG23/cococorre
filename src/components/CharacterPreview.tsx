import { useEffect, useRef } from 'react';
import { drawPet } from '../game/render';
import type { CharacterSkin } from '../game/characters';

/** Retrato del personaje dibujado con el mismo código del juego. */
export function CharacterPreview({ skin, size = 64, locked = false }: { skin: CharacterSkin; size?: number; locked?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const T = size * 1.25;
    ctx.save();
    if (locked) ctx.filter = 'grayscale(1) brightness(0.55) opacity(0.6)';
    drawPet(ctx, skin, size / 2, size * 0.95, T, { facing: 'down', time: 0, hop: -1 });
    ctx.restore();
  }, [skin, size, locked]);

  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />;
}
