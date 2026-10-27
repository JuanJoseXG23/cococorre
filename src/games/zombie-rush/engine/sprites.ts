import { PED_LOOKS, ZOMBIE_LOOKS, type PedLook, type ZombieLook } from './looks';

/**
 * Personajes dibujados con Canvas 2D (vista lateral, mirando a la derecha,
 * pies en (0, 0), ~46 px virtuales de alto). Cada fotograma se dibuja una
 * sola vez en un canvas pequeño y luego se copia con drawImage: así una
 * horda de 75 zombis sigue fluida en celulares.
 */

export const RUN_FRAMES = 8;
/** Fotogramas extra: 8 = subiendo (salto), 9 = cayendo. */
export const FRAME_JUMP = RUN_FRAMES;
export const FRAME_FALL = RUN_FRAMES + 1;
const TOTAL_FRAMES = RUN_FRAMES + 2;

/** Caja del sprite en px virtuales, relativa a los pies. */
const BOX = { left: -30, top: -64, w: 66, h: 72 };

type Ctx = CanvasRenderingContext2D;

function limb(ctx: Ctx, x: number, y: number, a1: number, l1: number, a2: number, l2: number, w: number, color: string, end?: string) {
  // Ángulos desde la vertical hacia abajo; positivo = hacia adelante (derecha).
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
  if (end) {
    ctx.fillStyle = end;
    ctx.beginPath();
    ctx.ellipse(fx + 1.5, fy, w * 0.62, w * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function circle(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const OUTLINE = 'rgba(30, 24, 40, 0.55)';

interface Pose {
  bob: number;
  legF: [number, number];
  legB: [number, number];
  armF: [number, number];
  armB: [number, number];
  lean: number;
}

/** Pose de un zombi: carrera torpe con los brazos estirados hacia adelante. */
function zombiePose(frame: number): Pose {
  if (frame === FRAME_JUMP) return { bob: -2, legF: [1.1, -0.2], legB: [-0.5, -1.3], armF: [2.35, 2.6], armB: [2.2, 2.5], lean: 0.12 };
  if (frame === FRAME_FALL) return { bob: 0, legF: [0.45, 0.1], legB: [-0.25, -0.1], armF: [2.75, 3.0], armB: [2.55, 2.9], lean: 0.05 };
  const t = (frame / RUN_FRAMES) * Math.PI * 2;
  const s = Math.sin(t);
  const leg = (ph: number): [number, number] => {
    const a = Math.sin(ph) * 0.72;
    const bend = Math.max(0, -Math.cos(ph)) * 1.0;
    return [a, a - bend];
  };
  return {
    bob: -Math.abs(Math.cos(t)) * 2.4,
    legF: leg(t),
    legB: leg(t + Math.PI),
    armF: [1.5 + s * 0.12, 1.62 + s * 0.12],
    armB: [1.42 - s * 0.12, 1.55 - s * 0.12],
    lean: 0.22,
  };
}

function hairZombie(ctx: Ctx, look: ZombieLook, hx: number, hy: number) {
  ctx.fillStyle = look.hair;
  switch (look.hairStyle) {
    case 0: // pelo corto despeinado
      for (const [dx, dy, r] of [[-5, -7, 4], [0, -9, 4.4], [5, -7.5, 3.6], [-8, -3, 3]] as const) circle(ctx, hx + dx, hy + dy, r, look.hair);
      break;
    case 1: // pelo largo hacia atrás
      ctx.beginPath();
      ctx.ellipse(hx - 4, hy - 4, 9, 8, -0.3, Math.PI * 0.9, Math.PI * 2.1);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx - 9, hy - 4);
      ctx.quadraticCurveTo(hx - 15, hy + 6, hx - 11, hy + 13);
      ctx.lineTo(hx - 6, hy + 4);
      ctx.fill();
      break;
    case 2: // moño (abuela)
      circle(ctx, hx - 7, hy - 8, 4.6, look.hair);
      ctx.beginPath();
      ctx.ellipse(hx - 2, hy - 5, 8.5, 5.5, -0.15, Math.PI, Math.PI * 2);
      ctx.fill();
      break;
    case 3: // gorra
      ctx.fillStyle = look.extra;
      ctx.beginPath();
      ctx.ellipse(hx, hy - 4, 9, 6.5, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      roundRect(ctx, hx + 2, hy - 6, 11, 3, 1.5);
      ctx.fill();
      break;
    case 4: // cinta deportiva
      for (const [dx, dy, r] of [[-4, -7, 4], [2, -8, 4]] as const) circle(ctx, hx + dx, hy + dy, r, look.hair);
      ctx.fillStyle = look.extra;
      roundRect(ctx, hx - 9, hy - 6, 18, 3.4, 1.5);
      ctx.fill();
      break;
    case 5: // sombrero de turista
      ctx.fillStyle = look.extra;
      ctx.beginPath();
      ctx.ellipse(hx, hy - 6, 13, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(hx, hy - 7, 7.5, 6, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(hx - 7, hy - 9, 14, 2);
      break;
    case 6: // líder: gorro de lana naranja con pompón
      ctx.fillStyle = look.extra;
      ctx.beginPath();
      ctx.ellipse(hx - 1, hy - 4, 9.6, 8.5, -0.15, Math.PI * 1.02, Math.PI * 2.02);
      ctx.fill();
      ctx.fillStyle = '#e56d12';
      roundRect(ctx, hx - 10, hy - 5.5, 19, 4, 2);
      ctx.fill();
      circle(ctx, hx - 6, hy - 13, 3.4, '#ffd27a');
      break;
  }
}

/** Dibuja un zombi en (0,0) (pies). */
export function drawZombie(ctx: Ctx, look: ZombieLook, frame: number) {
  const p = zombiePose(frame);
  const hip = { x: -1, y: -21 + p.bob };
  const sh = { x: hip.x + Math.sin(p.lean) * 15, y: hip.y - 15 };
  const head = { x: sh.x + 4.5, y: sh.y - 8 };

  // Brazo y pierna de atrás (más oscuros)
  limb(ctx, sh.x - 1, sh.y + 2, p.armB[0], 9, p.armB[1], 9, 4.8, look.skinDark, look.skinDark);
  limb(ctx, hip.x - 1, hip.y, p.legB[0], 11, p.legB[1], 10, 5.6, shade(look.pants, -0.18), '#3a3330');

  // Torso con camisa rota
  ctx.save();
  ctx.translate(hip.x, hip.y);
  ctx.rotate(p.lean);
  ctx.fillStyle = look.shirt;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-6.5, 2);
  ctx.lineTo(-7, -13);
  ctx.quadraticCurveTo(-6, -17, 0, -17);
  ctx.quadraticCurveTo(7, -17, 7, -12);
  ctx.lineTo(6.5, 2);
  // borde roto en zigzag
  ctx.lineTo(4, -1);
  ctx.lineTo(1.5, 2.5);
  ctx.lineTo(-1.5, -0.5);
  ctx.lineTo(-4, 2.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // rasgón con piel
  ctx.fillStyle = look.skinDark;
  ctx.beginPath();
  ctx.moveTo(1, -9);
  ctx.lineTo(4, -6);
  ctx.lineTo(1.5, -4);
  ctx.closePath();
  ctx.fill();
  if (look.hairStyle === 0 && !look.leader) {
    // corbata (oficinista)
    ctx.fillStyle = look.extra;
    ctx.beginPath();
    ctx.moveTo(1, -16);
    ctx.lineTo(3, -16);
    ctx.lineTo(3.4, -7);
    ctx.lineTo(2, -5);
    ctx.lineTo(0.6, -7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Pierna y brazo de adelante
  limb(ctx, hip.x + 1, hip.y, p.legF[0], 11, p.legF[1], 10, 5.8, look.pants, '#2e2826');

  // Cabeza
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(0.12 + p.bob * 0.02);
  ctx.fillStyle = look.skin;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8.6, 9.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // mandíbula caída
  ctx.fillStyle = look.skinDark;
  ctx.beginPath();
  ctx.ellipse(3, 6.5, 5.5, 3.4, 0.1, 0, Math.PI);
  ctx.fill();
  // ojos desiguales
  const big = look.eyeSwap ? { x: 1.8, r: 3.2 } : { x: 5.6, r: 3.6 };
  const small = look.eyeSwap ? { x: 6, r: 2.4 } : { x: 1.4, r: 2.3 };
  circle(ctx, big.x, -1.5, big.r, '#fbfff2');
  circle(ctx, small.x, -1, small.r, '#fbfff2');
  const pupil = look.leader ? '#ff3b3b' : '#2a1f2b';
  circle(ctx, big.x + 1, -1.2, big.r * 0.42, pupil);
  circle(ctx, small.x + 0.8, -0.8, small.r * 0.45, pupil);
  // boca con diente
  ctx.strokeStyle = '#3a2232';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(1.5, 4.2);
  ctx.quadraticCurveTo(5, 5.6, 8.3, 3.6);
  ctx.stroke();
  ctx.fillStyle = '#fffbe6';
  ctx.fillRect(4.6, 4.3, 1.8, 2);
  // cicatriz con puntadas
  if (look.eyeSwap) {
    ctx.strokeStyle = 'rgba(70,40,60,0.7)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-5, -4);
    ctx.lineTo(-2, 2);
    for (let i = 0; i < 3; i++) {
      const sx = -4.5 + i * 1.1;
      const sy = -3 + i * 2;
      ctx.moveTo(sx - 1.4, sy + 0.6);
      ctx.lineTo(sx + 1.4, sy - 0.6);
    }
    ctx.stroke();
  }
  hairZombie(ctx, look, 0, 0);
  ctx.restore();

  limb(ctx, sh.x + 1, sh.y + 2, p.armF[0], 9.5, p.armF[1], 9.5, 5, look.skin, look.skin);
}

/** Pose de un civil: camina tranquilo o huye con los brazos en alto. */
function pedPose(frame: number, panic: boolean): Pose {
  const t = (frame / RUN_FRAMES) * Math.PI * 2;
  const s = Math.sin(t);
  const amp = panic ? 0.8 : 0.42;
  const leg = (ph: number): [number, number] => {
    const a = Math.sin(ph) * amp;
    const bend = Math.max(0, -Math.cos(ph)) * (panic ? 1.1 : 0.5);
    return [a, a - bend];
  };
  if (panic) {
    return {
      bob: -Math.abs(Math.cos(t)) * 2.6, legF: leg(t), legB: leg(t + Math.PI),
      armF: [2.75 + s * 0.35, 2.95 + s * 0.4], armB: [2.55 - s * 0.35, 2.85 - s * 0.4], lean: 0.12,
    };
  }
  return {
    bob: -Math.abs(Math.cos(t)) * 1.2, legF: leg(t), legB: leg(t + Math.PI),
    armF: [-s * 0.45, -s * 0.45 + 0.3], armB: [s * 0.45, s * 0.45 + 0.3], lean: 0.02,
  };
}

function hairPed(ctx: Ctx, look: PedLook) {
  ctx.fillStyle = look.hair;
  switch (look.hairStyle) {
    case 0:
      ctx.beginPath();
      ctx.ellipse(-1, -4, 8.4, 6.5, -0.1, Math.PI * 0.95, Math.PI * 2.05);
      ctx.fill();
      break;
    case 1:
      ctx.beginPath();
      ctx.ellipse(-2, -4, 9, 7.5, -0.2, Math.PI * 0.85, Math.PI * 2.05);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-8, -3);
      ctx.quadraticCurveTo(-14, 6, -10, 14);
      ctx.lineTo(-5, 3);
      ctx.fill();
      break;
    case 2:
      circle(ctx, -7, -8, 4.4, look.hair);
      ctx.beginPath();
      ctx.ellipse(-1, -4, 8.5, 6, -0.1, Math.PI, Math.PI * 2);
      ctx.fill();
      break;
    case 3:
      ctx.fillStyle = look.extra;
      ctx.beginPath();
      ctx.ellipse(0, -4, 9, 6.6, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      roundRect(ctx, 2, -6, 11, 3, 1.5);
      ctx.fill();
      break;
    case 4:
      circle(ctx, -3, -7, 4.4, look.hair);
      circle(ctx, 2, -8, 4, look.hair);
      ctx.fillStyle = look.extra;
      roundRect(ctx, -9, -6, 18, 3.4, 1.5);
      ctx.fill();
      break;
    case 5:
      ctx.fillStyle = look.extra;
      ctx.beginPath();
      ctx.ellipse(0, -6, 13, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, -7, 7.5, 6, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      break;
  }
}

/** Dibuja un civil en (0,0) (pies). */
export function drawPed(ctx: Ctx, look: PedLook, frame: number, panic: boolean) {
  const p = pedPose(frame, panic);
  const hip = { x: 0, y: -21 + p.bob };
  const sh = { x: hip.x + Math.sin(p.lean) * 15, y: hip.y - 15 };
  const head = { x: sh.x + 2, y: sh.y - 8.5 };
  const skinDark = shade(look.skin, -0.12);

  limb(ctx, sh.x - 1, sh.y + 2, p.armB[0], 8.5, p.armB[1], 8.5, 4.4, shade(look.top, -0.15), skinDark);
  limb(ctx, hip.x - 1, hip.y, p.legB[0], 11, p.legB[1], 10, 5.2, shade(look.bottom, -0.15), '#2d2a30');

  ctx.save();
  ctx.translate(hip.x, hip.y);
  ctx.rotate(p.lean);
  ctx.fillStyle = look.top;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.1;
  if (look.kind === 'lady') {
    // vestido
    ctx.beginPath();
    ctx.moveTo(-6, -16);
    ctx.quadraticCurveTo(0, -18, 6, -16);
    ctx.lineTo(9, 6);
    ctx.lineTo(-9, 6);
    ctx.closePath();
  } else {
    roundRect(ctx, -6.5, -17, 13, 19, 4);
  }
  ctx.fill();
  ctx.stroke();
  if (look.kind === 'office') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-1, -17);
    ctx.lineTo(5, -17);
    ctx.lineTo(2, -9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = look.extra;
    ctx.fillRect(1.3, -15, 1.6, 9);
  } else if (look.kind === 'tourist') {
    ctx.fillStyle = look.extra;
    for (const [x, y] of [[-3, -12], [2, -6], [-2, -3], [3, -14]]) circle(ctx, x, y, 1.6, look.extra);
  } else if (look.kind === 'granny') {
    ctx.fillStyle = look.extra;
    for (let y = -14; y < 0; y += 4) circle(ctx, 4, y, 1, look.extra);
  }
  ctx.restore();

  if (look.kind !== 'lady') {
    limb(ctx, hip.x + 1, hip.y, p.legF[0], 11, p.legF[1], 10, 5.4, look.bottom, '#2d2a30');
  } else {
    limb(ctx, hip.x + 1, hip.y + 4, p.legF[0], 8, p.legF[1], 9, 3.6, look.skin, '#b8335a');
  }

  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.fillStyle = look.skin;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 8.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // cara: ojos y boca (asustada si huye)
  circle(ctx, 5.2, -1.5, panic ? 2.4 : 1.8, '#ffffff');
  circle(ctx, 5.8, -1.4, panic ? 1.1 : 1.2, '#2a2230');
  if (panic) {
    circle(ctx, 6, 4, 2.2, '#5a2030');
    // gotas de sudor
    ctx.fillStyle = '#9fd8ff';
    ctx.beginPath();
    ctx.ellipse(-6, -7, 1.4, 2.4, 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#5a2030';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(4, 4);
    ctx.quadraticCurveTo(6, 5.2, 7.6, 3.8);
    ctx.stroke();
  }
  circle(ctx, 2.5, 2, 1.6, 'rgba(255,120,120,0.35)');
  hairPed(ctx, look);
  ctx.restore();

  limb(ctx, sh.x + 1, sh.y + 2, p.armF[0], 8.5, p.armF[1], 8.5, 4.6, look.top, look.skin);
}

export function shade(hex: string, amt: number): string {
  if (!hex.startsWith('#')) return hex;
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
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

  zombie(look: number, frame: number, mul = 1) {
    const l = ZOMBIE_LOOKS[look] ?? ZOMBIE_LOOKS[0];
    return this.make(`z${look}:${frame}:${mul}`, mul, (ctx) => drawZombie(ctx, l, frame));
  }

  ped(look: number, frame: number, panic: boolean) {
    const l = PED_LOOKS[look] ?? PED_LOOKS[0];
    return this.make(`p${look}:${frame}:${panic ? 1 : 0}`, 1, (ctx) => drawPed(ctx, l, frame, panic));
  }

  /** Dibuja un sprite con los pies en (x, y), en px virtuales. */
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
