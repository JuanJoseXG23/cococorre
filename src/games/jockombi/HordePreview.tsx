import { useEffect, useRef } from 'react';
import { SpriteCache, runFrame, FRAME_JUMP, FRAME_FALL } from './engine/sprites';
import { LEADER_LOOK_INDEX, PED_LOOKS } from './engine/looks';
import { LANE_SCALE, LANE_Y } from './engine/constants';
import { hash01 } from './engine/rng';

/**
 * Ilustración animada de la jauría (portada del menú y pantalla de inicio),
 * dibujada con los mismos sprites del juego. Cada 2,6 s la jauría salta en ola.
 */
export function HordePreview({ count = 8, className, night = false }: { count?: number; className?: string; night?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const cache = new SpriteCache();
    let W = 0;
    let H = 0;
    let dpr = 1;
    let scale = 1;
    const resize = () => {
      W = canvas.clientWidth || 300;
      H = canvas.clientHeight || 150;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      scale = H / 96;
      cache.setScale(dpr * scale);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const members = Array.from({ length: count }, (_, i) => ({
      look: i === 0 ? LEADER_LOOK_INDEX : (i * 5) % PED_LOOKS.length,
      off: i === 0 ? 0 : -12 - i * 17 + (hash01(i) - 0.5) * 6,
      lane: i === 0 ? 0 : i % 3 === 1 ? 1 : i % 3 === 2 ? 2 : 0,
      phase: hash01(i * 3),
    }));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    let raf = 0;

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const vw = W / scale;
      const ground = 84;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      ctx.clearRect(0, 0, vw, 96);
      // calle
      ctx.fillStyle = night ? 'rgba(255,255,255,0.18)' : 'rgba(40,30,60,0.18)';
      ctx.fillRect(0, ground, vw, 2);
      ctx.fillStyle = night ? 'rgba(255,255,255,0.25)' : 'rgba(40,30,60,0.22)';
      const shift = (t * 120) % 40;
      for (let x = -shift; x < vw; x += 40) ctx.fillRect(x, ground + 6, 20, 2);
      // perrito que huye
      const leadX = vw * 0.66;
      const pedX = leadX + 52 + Math.sin(t * 1.3) * 8;
      const pedImg = cache.ped(2, Math.floor((t * 2.6 * 8) % 8), true);
      SpriteCache.blit(ctx, pedImg, pedX, ground, 0.95);
      // la jauría (de atrás hacia adelante)
      const cycle = t % 2.6;
      for (let lane = 2; lane >= 0; lane--) {
        for (let i = members.length - 1; i >= 0; i--) {
          const m = members[i];
          if (m.lane !== lane) continue;
          const delay = i * 0.055;
          const p = (cycle - delay) / 0.55;
          const jumping = p > 0 && p < 1;
          const y = ground + LANE_Y[lane] - (jumping ? Math.sin(Math.PI * p) * 30 : 0);
          const frame = jumping ? (p < 0.5 ? FRAME_JUMP : FRAME_FALL) : runFrame((m.phase + t * 3.4) % 1);
          SpriteCache.blit(ctx, cache.zombie(m.look, frame), leadX + m.off, y, LANE_SCALE[lane] * 1.05);
        }
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [count, night]);

  return <canvas ref={ref} className={className} aria-hidden />;
}
