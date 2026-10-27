import { PED_LOOKS, ZOMBIE_LOOKS, type DogLook } from './looks';
import { hash01 } from './rng';

/**
 * Perritos dibujados con Canvas 2D (vista lateral, mirando a la derecha,
 * patas en y = 0). Cada fotograma se dibuja una sola vez en un canvas
 * pequeño y luego se copia con drawImage: así una jauría de 75 perritos
 * sigue fluida en celulares.
 */

export const RUN_FRAMES = 8;
/** Fotogramas extra: 8 = subiendo (salto), 9 = cayendo. */
export const FRAME_JUMP = RUN_FRAMES;
export const FRAME_FALL = RUN_FRAMES + 1;
const TOTAL_FRAMES = RUN_FRAMES + 2;

/** Caja del sprite en px virtuales, relativa a las patas. */
const BOX = { left: -42, top: -60, w: 86, h: 66 };

type Ctx = CanvasRenderingContext2D;
type Mode = 'zombie' | 'calm' | 'panic';

const OUTLINE = 'rgba(30, 24, 40, 0.5)';

function circle(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

/** Pata de dos segmentos desde (x, y). Ángulos desde la vertical; positivo = hacia adelante. */
function leg(ctx: Ctx, x: number, y: number, a1: number, l1: number, a2: number, l2: number, w: number, color: string, paw: string) {
  const kx = x + Math.sin(a1) * l1;
  const ky = y + Math.cos(a1) * l1;
  const fx = kx + Math.sin(a2) * l2;
  const fy = ky + Math.cos(a2) * l2;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(kx, ky);
  ctx.lineTo(fx, fy);
  ctx.stroke();
  ellipse(ctx, fx + 1.2, fy - 0.3, w * 0.62, w * 0.42, 0, paw);
}

interface Pose {
  bob: number;
  pitch: number;
  /** [muslo, pierna] de cada pata: delantera cerca/lejos, trasera cerca/lejos. */
  fn: [number, number];
  ff: [number, number];
  hn: [number, number];
  hf: [number, number];
  wag: number;
  ears: number;
}

/** Galope: las patas delanteras y traseras se alternan; el cuerpo sube y baja. */
function pose(frame: number, mode: Mode): Pose {
  if (frame === FRAME_JUMP) {
    return { bob: -1, pitch: -0.18, fn: [1.25, 0.9], ff: [1.05, 0.7], hn: [-1.1, -0.7], hf: [-0.9, -0.5], wag: 0.6, ears: 1 };
  }
  if (frame === FRAME_FALL) {
    return { bob: 0, pitch: 0.12, fn: [0.55, 0.2], ff: [0.35, 0.1], hn: [-0.35, 0.1], hf: [-0.15, 0.2], wag: -0.2, ears: -1 };
  }
  const t = (frame / RUN_FRAMES) * Math.PI * 2;
  const amp = mode === 'calm' ? 0.4 : 0.72;
  const f = (ph: number): [number, number] => {
    const a = Math.sin(ph) * amp;
    return [a, a - Math.max(0, Math.cos(ph)) * 0.9];
  };
  const h = (ph: number): [number, number] => {
    const a = Math.sin(ph) * amp * 0.9;
    return [a, a + Math.max(0, -Math.cos(ph)) * 0.8];
  };
  return {
    bob: -Math.abs(Math.sin(t)) * (mode === 'calm' ? 1 : 2.4),
    pitch: Math.sin(t) * (mode === 'calm' ? 0.02 : 0.07),
    fn: f(t), ff: f(t + 0.5), hn: h(t + Math.PI), hf: h(t + Math.PI + 0.5),
    wag: Math.sin(t * 2) * (mode === 'calm' ? 0.35 : 0.2),
    ears: Math.sin(t) * 0.5,
  };
}

/** Mechones alrededor de una elipse (pelaje esponjoso). */
function fluff(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: string, n = 12) {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rx * 0.92, cy + Math.sin(a) * ry * 0.92, Math.min(rx, ry) * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTail(ctx: Ctx, l: DogLook, x: number, y: number, wag: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(wag);
  ctx.lineCap = 'round';
  switch (l.tail) {
    case 'curl': // enroscada sobre el lomo
      ctx.strokeStyle = l.fluffy ? l.coat : l.dark;
      ctx.lineWidth = l.fluffy ? 6 : 4;
      ctx.beginPath();
      ctx.arc(2, -6, 5, Math.PI * 0.6, Math.PI * 2.1);
      ctx.stroke();
      if (l.fluffy) fluff(ctx, 2, -7, 5, 5, l.coat, 7);
      break;
    case 'flag': // hacia arriba con punta blanca (beagle)
      ctx.strokeStyle = l.coat;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-6, -6, -5, -13);
      ctx.stroke();
      circle(ctx, -5, -13, 2.2, l.light);
      break;
    case 'long': // larga hacia atrás
      ctx.strokeStyle = l.coat;
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-9, -1, -13, 5);
      ctx.stroke();
      break;
    case 'plume': { // collie: cola de pluma con punta blanca
      ctx.fillStyle = l.coat;
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.quadraticCurveTo(-10, -4, -16, 3);
      ctx.quadraticCurveTo(-11, 5, 0, 3);
      ctx.closePath();
      ctx.fill();
      ellipse(ctx, -14, 3, 3.6, 2.6, 0.4, l.light);
      ellipse(ctx, -8, -1, 2.6, 1.8, 0.2, l.dark);
      break;
    }
    case 'pom': // caniche: pompón
      ctx.strokeStyle = l.dark;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-5, -8);
      ctx.stroke();
      fluff(ctx, -6, -10, 3.4, 3.4, l.coat, 7);
      circle(ctx, -6, -10, 3.4, l.coat);
      break;
    case 'stub':
      ellipse(ctx, -2, -1, 3, 2.4, 0, l.coat);
      break;
    case 'thin':
      ctx.strokeStyle = l.dark;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-7, -3, -9, -9);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

function drawEar(ctx: Ctx, l: DogLook, hx: number, hy: number, hr: number, flap: number, mode: Mode) {
  const back = mode === 'panic' ? -0.5 : 0;
  const color = l.marking === 'mask' || l.ear === 'floppy' ? l.dark : l.head ? l.dark : l.coat;
  ctx.fillStyle = l.breed === 'Dálmata' || l.breed === 'Labrador' ? l.dark : color;
  switch (l.ear) {
    case 'pointy':
    case 'semi': {
      ctx.save();
      ctx.translate(hx - hr * 0.25, hy - hr * 0.7);
      ctx.rotate(-0.15 + back + flap * 0.08);
      const h = l.breed === 'Chihuahua' ? 10 : 8;
      ctx.beginPath();
      ctx.moveTo(-3.6, 1.5);
      ctx.lineTo(l.ear === 'semi' ? 0.5 : 0, -h);
      ctx.lineTo(3.6, 1.5);
      ctx.closePath();
      ctx.fill();
      if (l.ear === 'semi') {
        // punta doblada hacia adelante (Border Collie)
        ctx.beginPath();
        ctx.moveTo(-0.8, -h + 2.5);
        ctx.lineTo(4, -h + 4.5);
        ctx.lineTo(1.8, -h + 0.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,170,170,0.55)';
      ctx.beginPath();
      ctx.moveTo(-1.8, 1);
      ctx.lineTo(0, -h + 3.5);
      ctx.lineTo(1.8, 1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'floppy':
      // cuelga de la parte de atrás de la cabeza, sin tapar el ojo
      ellipse(ctx, hx - hr * 0.72, hy + 2.8 + flap * 0.6, 3, l.breed === 'Salchicha' || l.breed === 'Beagle' ? 6.2 : 5.4, 0.35 + back * 0.5 + flap * 0.12, ctx.fillStyle as string);
      break;
    case 'fluffy':
      fluff(ctx, hx - hr * 0.4, hy + 3, 3.5, 5, l.coat, 7);
      ellipse(ctx, hx - hr * 0.4, hy + 3, 3.5, 5, 0.2, l.coat);
      break;
    case 'fold':
      ctx.beginPath();
      ctx.moveTo(hx - hr * 0.6, hy - hr * 0.5);
      ctx.lineTo(hx - hr * 0.05, hy - hr * 0.95);
      ctx.lineTo(hx + hr * 0.1, hy - hr * 0.35);
      ctx.closePath();
      ctx.fill();
      break;
  }
}

/** Dibuja un perrito en (0,0) (patas). */
export function drawDog(ctx: Ctx, l: DogLook, frame: number, mode: Mode) {
  const p = pose(frame, mode);
  ctx.save();
  ctx.scale(l.scale, l.scale);
  const rx = l.bodyRX;
  const ry = l.bodyRY;
  const cy = -(l.legH + ry * 0.55) + p.bob;
  const legY = cy + ry * 0.35;
  const shX = rx * 0.58;
  const hipX = -rx * 0.6;
  const l1 = l.legH * 0.55;
  const l2 = l.legH * 0.55;
  const lw = Math.max(3.4, Math.min(5.2, l.legH * 0.36 + 1.2));
  const farColor = mixDark(l.coat);
  const pawNear = l.whiteChest || l.marking === 'merle' ? l.light : l.coat;

  // Patas del lado lejano
  leg(ctx, shX - 1.5, legY, p.ff[0], l1, p.ff[1], l2, lw, farColor, farColor);
  leg(ctx, hipX - 1.5, legY, p.hf[0], l1, p.hf[1], l2, lw, farColor, farColor);

  // Cola
  drawTail(ctx, l, -rx * 0.92, cy - ry * 0.35, p.wag + (mode === 'panic' ? 0.5 : 0));

  // Cuerpo (con leve cabeceo)
  ctx.save();
  ctx.translate(0, cy);
  ctx.rotate(p.pitch);
  if (l.fluffy) fluff(ctx, 0, 0, rx, ry, l.coat, 14);
  ctx.fillStyle = l.coat;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!l.fluffy) ctx.stroke();
  // panza clara
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ellipse(ctx, 1, ry * 0.85, rx * 0.8, ry * 0.5, 0, l.light);
  // marcas del pelaje
  if (l.marking === 'saddle') ellipse(ctx, -2, -ry * 0.65, rx * 0.75, ry * 0.6, 0, l.dark);
  if (l.marking === 'merle' || l.marking === 'spots') {
    const n = l.marking === 'merle' ? 6 : 9;
    for (let i = 0; i < n; i++) {
      const sx = (hash01(i * 13 + 5) - 0.5) * rx * 1.6;
      const sy = (hash01(i * 7 + 2) - 0.6) * ry * 1.4;
      const r = l.marking === 'merle' ? 2.4 + hash01(i * 3) * 3 : 1.2 + hash01(i * 3) * 1.1;
      ellipse(ctx, sx, sy, r * 1.2, r, hash01(i) * 2, l.dark);
    }
  }
  if (l.zombie) {
    // costura de zombi
    ctx.strokeStyle = 'rgba(60,30,50,0.75)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-rx * 0.3, -ry * 0.8);
    ctx.lineTo(rx * 0.05, ry * 0.2);
    for (let i = 0; i < 4; i++) {
      const sx = -rx * 0.3 + i * rx * 0.1;
      const sy = -ry * 0.8 + i * ry * 0.33;
      ctx.moveTo(sx - 1.6, sy + 0.8);
      ctx.lineTo(sx + 1.6, sy - 0.8);
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();

  // Patas del lado cercano
  leg(ctx, shX, legY, p.fn[0], l1, p.fn[1], l2, lw + 0.4, l.coat, pawNear);
  leg(ctx, hipX, legY, p.hn[0], l1, p.hn[1], l2, lw + 0.4, l.coat, pawNear);
  if (l.zombie && !l.leader) {
    // vendita en la pata trasera
    ctx.fillStyle = 'rgba(245,240,225,0.95)';
    ctx.save();
    ctx.translate(hipX + Math.sin(p.hn[0]) * l1 * 0.6, legY + Math.cos(p.hn[0]) * l1 * 0.6);
    ctx.rotate(-p.hn[0]);
    ctx.fillRect(-lw * 0.75, -1.4, lw * 1.5, 2.8);
    ctx.restore();
  }

  // Cuello / pecho
  const hx = rx * 0.98 + 2;
  const hy = cy - ry * 0.95 + p.pitch * 8;
  const hr = 6.6;
  ellipse(ctx, rx * 0.72, cy - ry * 0.45, 5.6, ry * 0.85, -0.5, l.coat);
  if (l.whiteChest) {
    ellipse(ctx, rx * 0.86, cy - ry * 0.05, 4, ry * 0.75, -0.3, l.light);
    if (l.fluffy) fluff(ctx, rx * 0.86, cy - ry * 0.1, 4, ry * 0.65, l.light, 8);
  }

  // Cabeza
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(mode === 'zombie' ? 0.12 : mode === 'panic' ? -0.08 : 0);
  const headColor = l.head ?? l.coat;
  if (l.fluffy && l.breed !== 'Border Collie') fluff(ctx, 0, 0, hr, hr, headColor, 10);
  ctx.fillStyle = headColor;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(0, 0, hr, 0, Math.PI * 2);
  ctx.fill();
  if (!l.fluffy) ctx.stroke();
  // hocico
  const sn = l.snout;
  const muzzle = l.marking === 'mask' && l.breed === 'Pug' ? l.dark : l.whiteChest || l.marking === 'merle' ? l.light : mixLight(headColor);
  ellipse(ctx, hr * 0.55 + sn * 0.5, 2.4, sn * 0.65 + 3, 3.4, 0.05, muzzle);
  if (l.marking === 'merle') {
    // franja blanca en la frente (blaze) y mancha oscura en un ojo
    ellipse(ctx, 1.5, -3.5, 1.8, 4.5, 0.5, l.light);
    ellipse(ctx, -2.5, -1.5, 3.4, 3, 0, l.dark);
  }
  if (l.marking === 'mask' && l.breed === 'Husky') {
    ellipse(ctx, 1.5, 1.5, 4.6, 3.4, 0, l.light);
  }
  // nariz
  ellipse(ctx, hr * 0.55 + sn + 2.6, 0.6, 1.9, 1.5, 0, '#211a1e');
  // boca
  if (mode === 'zombie') {
    ctx.fillStyle = '#5a2232';
    ctx.beginPath();
    ctx.moveTo(hr * 0.3, 3.6);
    ctx.lineTo(hr * 0.55 + sn + 2, 3.6);
    ctx.lineTo(hr * 0.5 + sn * 0.6, 6.8);
    ctx.closePath();
    ctx.fill();
    // lengua colgando (verdosa) y colmillo
    ellipse(ctx, hr * 0.55 + sn * 0.4, 7.2 + p.bob * 0.3, 1.6, 2.6, 0.2, '#e57f9a');
    ctx.fillStyle = '#fffbe6';
    ctx.fillRect(hr * 0.55 + sn * 0.7, 3.4, 1.2, 1.8);
  } else if (mode === 'panic') {
    ellipse(ctx, hr * 0.6 + sn * 0.6, 4.6, 1.8, 2.1, 0, '#5a2232');
  } else {
    ctx.strokeStyle = '#3a2a2e';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(hr * 0.35, 4);
    ctx.quadraticCurveTo(hr * 0.6 + sn * 0.5, 5.4, hr * 0.55 + sn + 1.5, 3.4);
    ctx.stroke();
  }
  // ojo
  if (mode === 'zombie') {
    circle(ctx, 2.2, -1.6, 2.9, l.leader ? '#fff3c4' : '#f4ffd8');
    circle(ctx, 2.9, -1.4, 1.15, l.leader ? '#ff3b3b' : '#4a7a20');
    ctx.strokeStyle = 'rgba(70,40,60,0.55)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(2.2, -1.2, 3.4, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  } else if (mode === 'panic') {
    circle(ctx, 2.4, -1.8, 2.4, '#ffffff');
    circle(ctx, 3, -1.6, 1, '#1d1619');
    ctx.fillStyle = '#9fd8ff';
    ctx.beginPath();
    ctx.ellipse(-4.5, -6.5, 1.2, 2.2, 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    circle(ctx, 2.4, -1.6, 1.7, '#1d1619');
    circle(ctx, 2.9, -2.2, 0.6, '#ffffff');
  }
  ctx.restore();
  // orejas por encima de la cabeza
  drawEar(ctx, l, hx, hy, hr, p.ears, mode);

  // collar (Jocko lleva su pañoleta naranja)
  if (l.leader) {
    ctx.fillStyle = l.collar;
    ctx.beginPath();
    ctx.moveTo(hx - hr * 0.9, hy + hr * 0.55);
    ctx.lineTo(hx + hr * 0.5, hy + hr * 0.85);
    ctx.lineTo(hx - hr * 0.35, hy + hr * 1.75);
    ctx.closePath();
    ctx.fill();
    circle(ctx, hx - hr * 0.2, hy + hr * 0.95, 0.9, '#ffffff');
  } else {
    ctx.strokeStyle = l.collar;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx - hr * 0.85, hy + hr * 0.5);
    ctx.lineTo(hx + hr * 0.25, hy + hr * 0.9);
    ctx.stroke();
  }
  ctx.restore();
}

function mixDark(hex: string): string {
  return shade(hex, -0.2);
}
function mixLight(hex: string): string {
  return shade(hex, 0.25);
}

export function shade(hex: string, amt: number): string {
  if (!hex.startsWith('#')) return hex;
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** Cabecita de Jocko para el HUD y las insignias (círculo de radio r en (x, y)). */
export function drawLeaderIcon(ctx: Ctx, x: number, y: number, r: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(r / 10, r / 10);
  ctx.fillStyle = '#3e434d';
  ctx.beginPath();
  ctx.moveTo(-9, -3);
  ctx.lineTo(-7, -13);
  ctx.lineTo(-2, -6);
  ctx.closePath();
  ctx.moveTo(9, -3);
  ctx.lineTo(7, -13);
  ctx.lineTo(2, -6);
  ctx.closePath();
  ctx.fill();
  circle(ctx, 0, 0, 10, '#9aa3b0');
  ellipse(ctx, -5, -3, 4.5, 4, 0, '#3e434d');
  ellipse(ctx, 0, -2, 1.8, 6, 0, '#f5f3ef');
  ellipse(ctx, 0, 5, 5.5, 4, 0, '#f5f3ef');
  circle(ctx, 0, 3.5, 1.8, '#211a1e');
  circle(ctx, -4, -2, 2.2, '#fff3c4');
  circle(ctx, 4, -2, 2.2, '#fff3c4');
  circle(ctx, -3.6, -1.8, 0.9, '#ff3b3b');
  circle(ctx, 4.4, -1.8, 0.9, '#ff3b3b');
  ctx.restore();
}

// ---------------------------------------------------------------- Caché

/**
 * Guarda cada fotograma ya dibujado, a la resolución real de la pantalla.
 * `pixelScale` = píxeles de pantalla por px virtual.
 */
export class SpriteCache {
  private cache = new Map<string, HTMLCanvasElement>();
  private pixelScale = 1;

  setScale(pixelScale: number) {
    const s = Math.round(pixelScale * 100) / 100;
    if (s !== this.pixelScale) {
      this.pixelScale = s;
      this.cache.clear();
    }
  }

  private make(key: string, mul: number, draw: (ctx: Ctx) => void): HTMLCanvasElement {
    let c = this.cache.get(key);
    if (c) return c;
    const s = this.pixelScale * mul;
    c = document.createElement('canvas');
    c.width = Math.ceil(BOX.w * s);
    c.height = Math.ceil(BOX.h * s);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(s, 0, 0, s, -BOX.left * s, -BOX.top * s);
    draw(ctx);
    this.cache.set(key, c);
    return c;
  }

  /** Perrito zombi de la jauría. */
  zombie(look: number, frame: number, mul = 1) {
    const l = ZOMBIE_LOOKS[look] ?? ZOMBIE_LOOKS[0];
    return this.make(`z${look}:${frame}:${mul}`, mul, (ctx) => drawDog(ctx, l, frame, 'zombie'));
  }

  /** Perrito de la calle (tranquilo o huyendo). */
  ped(look: number, frame: number, panic: boolean) {
    const l = PED_LOOKS[look] ?? PED_LOOKS[0];
    return this.make(`p${look}:${frame}:${panic ? 1 : 0}`, 1, (ctx) => drawDog(ctx, l, frame, panic ? 'panic' : 'calm'));
  }

  /** Dibuja un sprite con las patas en (x, y), en px virtuales. */
  static blit(ctx: Ctx, img: HTMLCanvasElement, x: number, y: number, scale: number) {
    ctx.drawImage(img, x + BOX.left * scale, y + BOX.top * scale, BOX.w * scale, BOX.h * scale);
  }

  /** Precalienta la caché (evita tirones al empezar). */
  warm() {
    for (let l = 0; l < ZOMBIE_LOOKS.length; l++) for (let f = 0; f < TOTAL_FRAMES; f++) this.zombie(l, f);
  }
}

/** Fotograma de carrera según la fase 0..1. */
export function runFrame(phase: number): number {
  return Math.floor(phase * RUN_FRAMES) % RUN_FRAMES;
}
