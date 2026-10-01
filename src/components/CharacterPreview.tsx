import { useEffect, useRef } from 'react';
import { drawPet, type PetPose } from '../game/render';
import type { CharacterSkin } from '../game/characters';

const TURN: PetPose['facing'][] = ['down', 'right', 'up', 'left'];

/**
 * Retrato del personaje dibujado con el mismo código del juego.
 * Con `animate`, gira para mostrarse por todos lados, mueve la cola y salta.
 */
export function CharacterPreview({ skin, size = 64, animate = false }: { skin: CharacterSkin; size?: number; animate?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const T = size * 1.25;

    const draw = (time: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      // Cada 1,6 s cambia de lado y da un saltito.
      const phase = time / 1.6;
      const facing = animate ? TURN[Math.floor(phase) % TURN.length] : 'down';
      const t = phase % 1;
      const hop = animate && t < 0.25 ? t / 0.25 : -1;
      const lift = hop >= 0 ? Math.sin(Math.PI * hop) * size * 0.12 : 0;
      // sombra
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath();
      ctx.ellipse(size / 2, size * 0.94, size * 0.26 * (1 - lift / size), size * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      drawPet(ctx, skin, size / 2, size * 0.95 - lift, T, { facing, time, hop });
    };

    if (!animate) {
      draw(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      draw((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [skin, size, animate]);

  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />;
}
