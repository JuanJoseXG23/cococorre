import type { Game } from './Game';
import { COLS, type Lane, type Mover } from './types';
import type { CharacterSkin } from './characters';

export interface View {
  W: number;
  H: number;
  /** Tamaño de una casilla en píxeles CSS. */
  T: number;
  /** Posición vertical de la fila de la cámara. */
  baseY: number;
  offsetX: number;
  dpr: number;
}


function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + amt * 255)));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}

/**
 * Dibuja un bloque en vista 3/4: cara superior + cara frontal.
 * x, w en px; top = borde superior de la huella en el suelo; d = profundidad; h = altura (px).
 */
function block(ctx: CanvasRenderingContext2D, x: number, top: number, w: number, d: number, h: number, color: string, r = 3) {
  ctx.fillStyle = shade(color, -0.18);
  roundRect(ctx, x, top - h + d * 0.5, w, h + d * 0.5, r);
  ctx.fillStyle = color;
  roundRect(ctx, x, top - h, w, d, r);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  else ctx.rect(x, y, w, h);
  ctx.fill();
}

function shadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function heartPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.35);
  ctx.bezierCurveTo(cx - s * 0.9, cy - s * 0.25, cx - s * 0.45, cy - s * 0.95, cx, cy - s * 0.45);
  ctx.bezierCurveTo(cx + s * 0.45, cy - s * 0.95, cx + s * 0.9, cy - s * 0.25, cx, cy + s * 0.35);
  ctx.closePath();
}

export function drawScene(ctx: CanvasRenderingContext2D, game: Game, v: View) {
  const { W, H, T, dpr } = v;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#a3d68a';
  ctx.fillRect(0, 0, W, H);

  const rowTop = (r: number) => v.baseY - (r - game.camRow + 0.5) * T;
  const sx = (x: number) => v.offsetX + x * T;

  const firstRow = Math.floor(game.camRow - (H - v.baseY) / T) - 1;
  const lastRow = Math.ceil(game.camRow + v.baseY / T) + 2;

  // 1) Suelo de cada carril
  for (let r = firstRow; r <= lastRow; r++) {
    const lane = game.lanes.get(r);
    if (lane) drawGround(ctx, lane, rowTop(r), v, game.time, game.lanes.get(r - 1));
  }

  // Zonas fuera del área jugable, un poco más oscuras.
  ctx.fillStyle = 'rgba(30, 20, 60, 0.18)';
  ctx.fillRect(0, 0, Math.max(0, sx(0)), H);
  ctx.fillRect(sx(COLS), 0, Math.max(0, W - sx(COLS)), H);

  // 2) Objetos, de atrás hacia adelante (los más cercanos tapan a los lejanos)
  const p = game.player;
  const hopT = p.hop >= 0 ? Math.min(1, p.hop) : 0;
  const visualRow = p.hop >= 0 ? p.fromRow + (p.toRow - p.fromRow) * hopT : p.row;
  const playerDrawRow = Math.round(visualRow);

  for (let r = lastRow; r >= firstRow; r--) {
    const lane = game.lanes.get(r);
    if (!lane) continue;
    const top = rowTop(r);
    drawLaneObjects(ctx, lane, top, v, game.time);
    if (r === playerDrawRow) {
      const lift = p.hop >= 0 ? Math.sin(Math.PI * hopT) * T * 0.35 : 0;
      drawCoco(ctx, game, sx(p.x + game.bumpOffset), v.baseY - (visualRow - game.camRow) * T, T, lift);
    }
  }

  // 3) Partículas
  for (const q of game.particles) {
    const a = 1 - q.life / q.max;
    const x = sx(q.x);
    const y = v.baseY - (q.row - game.camRow) * T - q.z * T * 0.5;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = q.color;
    if (q.kind === 'heart') {
      heartPath(ctx, x, y, T * 0.18);
      ctx.fill();
    } else {
      const s = (q.kind === 'dust' ? 0.08 : 0.07) * T;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // 4) Ola de corazones que persigue a Coco
  drawChase(ctx, game, v);

  // 5) Cuando la ola alcanza a Coco, un corazón gigante se lo lleva
  if (!game.alive && p.cause === 'eagle') {
    const t = p.deadFor;
    ctx.fillStyle = 'rgba(214, 110, 140, 0.92)';
    heartPath(ctx, sx(p.x + 0.5), v.baseY - (p.row - game.camRow) * T - t * H, T * 1.6);
    ctx.fill();
  }
}

/**
 * La ola: una franja rosada con borde ondulado y corazones que suben.
 * Cuanto más cerca de Coco, más intensa y aparece el aviso "¡Corre, Coco!".
 */
function drawChase(ctx: CanvasRenderingContext2D, game: Game, v: View) {
  const { W, H, T } = v;
  const crest = v.baseY - (game.chaseRow - game.camRow + 0.5) * T;
  const t = game.time;
  const danger = game.alive ? game.danger : 0;

  if (crest < H + T) {
    // Cuerpo de la ola
    const grad = ctx.createLinearGradient(0, crest, 0, H);
    grad.addColorStop(0, `rgba(226, 140, 166, ${0.55 + danger * 0.2})`);
    grad.addColorStop(1, 'rgba(196, 104, 136, 0.85)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W + 10; x += 10) {
      const y = crest + Math.sin(x / (T * 0.9) + t * 3) * T * 0.12 + Math.sin(x / (T * 0.37) - t * 2) * T * 0.05;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    // Espuma clara en el borde
    ctx.strokeStyle = 'rgba(255, 240, 245, 0.8)';
    ctx.lineWidth = Math.max(2, T * 0.06);
    ctx.beginPath();
    for (let x = 0; x <= W + 10; x += 10) {
      const y = crest + Math.sin(x / (T * 0.9) + t * 3) * T * 0.12 + Math.sin(x / (T * 0.37) - t * 2) * T * 0.05;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Corazoncitos flotando dentro de la ola
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    const n = Math.ceil(W / (T * 1.4));
    for (let i = 0; i < n; i++) {
      const hx = ((i + 0.5) / n) * W + Math.sin(t * 1.3 + i) * T * 0.2;
      const rise = ((t * 0.45 + i * 0.37) % 1) * T * 0.9;
      const hy = crest + T * 0.75 - rise;
      if (hy > H) continue;
      heartPath(ctx, hx, hy, T * (0.14 + (i % 3) * 0.04));
      ctx.fill();
    }
  }

  // Aviso cuando la ola está a punto de alcanzar a Coco
  if (danger > 0.05) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 9);
    const edge = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    edge.addColorStop(0, 'rgba(214, 90, 120, 0)');
    edge.addColorStop(1, `rgba(214, 90, 120, ${danger * (0.25 + 0.2 * pulse)})`);
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, W, H);
  }
  if (danger > 0.55) {
    const size = Math.max(18, T * 0.42) * (1 + 0.06 * Math.sin(t * 9));
    ctx.font = `700 ${size}px Fredoka, 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(120, 40, 70, 0.6)';
    ctx.strokeText('¡Corre, Coco!', W / 2, H * 0.88);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('¡Corre, Coco!', W / 2, H * 0.88);
    ctx.textAlign = 'start';
  }
}

function drawGround(ctx: CanvasRenderingContext2D, lane: Lane, top: number, v: View, time: number, below?: Lane) {
  const { W, T, offsetX } = v;
  switch (lane.type) {
    case 'grass': {
      ctx.fillStyle = lane.row % 2 === 0 ? '#acdc94' : '#a3d68a';
      ctx.fillRect(0, top, W, T + 1);
      break;
    }
    case 'road': {
      ctx.fillStyle = '#686c79';
      ctx.fillRect(0, top, W, T + 1);
      if (below?.type === 'road') {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        const y = top + T - T * 0.03;
        for (let x = (offsetX % T) - T; x < W; x += T) ctx.fillRect(x + T * 0.2, y, T * 0.6, T * 0.06);
      } else {
        ctx.fillStyle = '#7b7f8e';
        ctx.fillRect(0, top + T - T * 0.08, W, T * 0.08);
      }
      break;
    }
    case 'river': {
      ctx.fillStyle = '#82c8e6';
      ctx.fillRect(0, top, W, T + 1);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      const shift = ((time * 0.6 * (lane.dir || 1) * T) % (T * 2) + T * 2) % (T * 2);
      for (let x = -T * 2 + shift; x < W; x += T * 2) {
        ctx.fillRect(x, top + T * 0.3, T * 0.5, T * 0.05);
        ctx.fillRect(x + T, top + T * 0.7, T * 0.4, T * 0.05);
      }
      break;
    }
    case 'rail': {
      ctx.fillStyle = '#b9aa95';
      ctx.fillRect(0, top, W, T + 1);
      ctx.fillStyle = '#7d5a3c';
      for (let x = (offsetX % (T / 2)) - T; x < W; x += T / 2) ctx.fillRect(x, top + T * 0.15, T * 0.16, T * 0.7);
      ctx.fillStyle = '#8d939e';
      ctx.fillRect(0, top + T * 0.27, W, T * 0.07);
      ctx.fillRect(0, top + T * 0.63, W, T * 0.07);
      break;
    }
  }
}

function drawLaneObjects(ctx: CanvasRenderingContext2D, lane: Lane, top: number, v: View, time: number) {
  const { T, offsetX } = v;
  const sx = (x: number) => offsetX + x * T;

  if (lane.type === 'grass') {
    for (const c of lane.flowers) {
      const x = sx(c + 0.5);
      ctx.fillStyle = c % 2 ? '#ff8fb1' : '#fff59d';
      for (const [dx, dy] of [[-0.18, 0.2], [0.15, 0.35], [0.05, 0.62]]) {
        ctx.beginPath();
        ctx.arc(x + dx * T, top + dy * T + T * 0.1, T * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const c of lane.hearts) {
      const bob = Math.sin(time * 4 + c) * T * 0.06;
      const cx = sx(c + 0.5);
      shadow(ctx, cx, top + T * 0.7, T * 0.2, T * 0.07);
      ctx.fillStyle = '#ff4f81';
      heartPath(ctx, cx, top + T * 0.35 + bob, T * 0.32);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(cx - T * 0.1, top + T * 0.2 + bob, T * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }
    // Árboles ordenados por columna
    for (const c of [...lane.trees].sort((a, b) => a - b)) drawTree(ctx, sx(c), top, T, c + lane.row);
    return;
  }

  if (lane.type === 'rail') {
    // Semáforo del tren
    const warn = !lane.trainActive && lane.trainTimer < 1.3;
    const px = sx(COLS) + T * 0.15;
    ctx.fillStyle = '#555';
    ctx.fillRect(px, top - T * 0.5, T * 0.08, T * 1.1);
    const on = warn && Math.floor(time * 8) % 2 === 0;
    ctx.fillStyle = on ? '#ff1744' : '#5a1a1a';
    ctx.beginPath();
    ctx.arc(px + T * 0.04, top - T * 0.55, T * 0.13, 0, Math.PI * 2);
    ctx.fill();
    if (on) {
      ctx.fillStyle = 'rgba(255, 23, 68, 0.12)';
      ctx.fillRect(0, top, v.W, T);
    }
  }

  for (const m of lane.movers) drawMover(ctx, m, lane, top, v);
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, top: number, T: number, seed: number) {
  const tall = seed % 3 === 0;
  shadow(ctx, x + T * 0.5, top + T * 0.72, T * 0.4, T * 0.14);
  block(ctx, x + T * 0.38, top + T * 0.45, T * 0.24, T * 0.25, T * 0.3, '#a07a5c', 2);
  const leaf = tall ? '#6fae74' : '#86c287';
  block(ctx, x + T * 0.1, top + T * 0.18, T * 0.8, T * 0.6, T * (tall ? 0.95 : 0.7), leaf, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(ctx, x + T * 0.18, top + T * 0.18 - T * (tall ? 0.95 : 0.7) + T * 0.06, T * 0.3, T * 0.18, 3);
}

function drawMover(ctx: CanvasRenderingContext2D, m: Mover, lane: Lane, top: number, v: View) {
  const { T, offsetX } = v;
  const x = offsetX + m.x * T;
  const w = m.len * T;
  if (x > v.W + T || x + w < -T) return;
  switch (m.kind) {
    case 'log': {
      block(ctx, x + T * 0.04, top + T * 0.18, w - T * 0.08, T * 0.6, T * 0.12, m.color, T * 0.25);
      ctx.fillStyle = '#d7a26f';
      ctx.beginPath();
      ctx.ellipse(x + T * 0.14, top + T * 0.36, T * 0.09, T * 0.2, 0, 0, Math.PI * 2);
      ctx.ellipse(x + w - T * 0.14, top + T * 0.36, T * 0.09, T * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'lily': {
      ctx.fillStyle = '#4caf50';
      ctx.beginPath();
      ctx.arc(x + T / 2, top + T / 2, T * 0.38, 0.3, Math.PI * 2 - 0.1);
      ctx.lineTo(x + T / 2, top + T / 2);
      ctx.fill();
      ctx.fillStyle = '#ff8fb1';
      ctx.beginPath();
      ctx.arc(x + T * 0.62, top + T * 0.4, T * 0.07, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'car':
    case 'truck': {
      const front = lane.dir > 0 ? x + w : x;
      shadow(ctx, x + w / 2, top + T * 0.75, w * 0.5, T * 0.15);
      if (m.kind === 'truck') {
        const cabW = T * 0.6;
        const cabX = lane.dir > 0 ? x + w - cabW - T * 0.05 : x + T * 0.05;
        const boxX = lane.dir > 0 ? x + T * 0.05 : x + cabW + T * 0.1;
        block(ctx, boxX, top + T * 0.18, w - cabW - T * 0.15, T * 0.62, T * 0.6, '#f5f5f5', 4);
        block(ctx, cabX, top + T * 0.18, cabW, T * 0.62, T * 0.42, m.color, 4);
      } else {
        block(ctx, x + T * 0.06, top + T * 0.2, w - T * 0.12, T * 0.6, T * 0.28, m.color, 6);
        // cabina
        ctx.fillStyle = '#d6f1ff';
        roundRect(ctx, x + w * 0.28, top + T * 0.2 - T * 0.28 - T * 0.18, w * 0.44, T * 0.4, 4);
        ctx.fillStyle = shade(m.color, 0.1);
        roundRect(ctx, x + w * 0.32, top + T * 0.2 - T * 0.28 - T * 0.14, w * 0.36, T * 0.24, 3);
      }
      // ruedas y luces
      ctx.fillStyle = '#222';
      ctx.fillRect(x + w * 0.15, top + T * 0.72, T * 0.18, T * 0.1);
      ctx.fillRect(x + w * 0.85 - T * 0.18, top + T * 0.72, T * 0.18, T * 0.1);
      ctx.fillStyle = '#fff59d';
      ctx.fillRect(front - (lane.dir > 0 ? T * 0.1 : 0), top + T * 0.42, T * 0.1, T * 0.12);
      break;
    }
    case 'train': {
      shadow(ctx, x + w / 2, top + T * 0.8, w * 0.5, T * 0.15);
      const cars = 4;
      const cw = w / cars;
      for (let i = 0; i < cars; i++) {
        const isLoco = lane.dir > 0 ? i === cars - 1 : i === 0;
        const color = isLoco ? '#ef476f' : i % 2 ? '#ffd166' : '#06d6a0';
        block(ctx, x + i * cw + T * 0.04, top + T * 0.12, cw - T * 0.08, T * 0.7, T * 0.75, color, 5);
        ctx.fillStyle = 'rgba(214, 241, 255, 0.9)';
        for (let k = 0.15; k < 0.85; k += 0.25) {
          ctx.fillRect(x + i * cw + cw * k, top + T * 0.12 - T * 0.6, cw * 0.15, T * 0.2);
        }
      }
      break;
    }
  }
}

// =====================================================================
//  Personajes (mascotas)
// =====================================================================

/** Círculo "peludo": un círculo con borde de mechones. */
function fluff(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, tufts = 10) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < tufts; i++) {
    const a = (i / tufts) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }
}

function ellipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string, rot = 0) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

/** Oreja en punta (Pomerania, Yorkshire). `fold` dobla la punta (Border Collie). */
function pointyEar(ctx: CanvasRenderingContext2D, cx: number, baseY: number, w: number, h: number, outer: string, inner: string, fold = 0) {
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, baseY);
  ctx.lineTo(cx + fold * w * 0.6, baseY - h);
  ctx.lineTo(cx + w / 2, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.2, baseY - h * 0.1);
  ctx.lineTo(cx + fold * w * 0.35, baseY - h * 0.65);
  ctx.lineTo(cx + w * 0.2, baseY - h * 0.1);
  ctx.closePath();
  ctx.fill();
}

export interface PetPose {
  facing: 'up' | 'down' | 'left' | 'right';
  time: number;
  /** Progreso del salto 0..1 o -1. */
  hop: number;
}

/**
 * Dibuja una mascota parada sobre `groundY`, centrada en `cx`, con casilla de tamaño T.
 * Todas comparten estructura (cola, patitas, cuerpo, cabeza, orejas, cara, collar)
 * y cada raza cambia formas y marcas.
 */
export function drawPet(ctx: CanvasRenderingContext2D, s: CharacterSkin, cx: number, groundY: number, T: number, pose: PetPose) {
  const f = pose.facing;
  const side = f === 'left' ? -1 : f === 'right' ? 1 : 0;
  const wag = Math.sin(pose.time * 12) * T * 0.025;
  const b = s.breed;
  const hamster = b === 'hamster';
  const smooth = b === 'beagle' || b === 'collie';

  // ---------- Hámster: una bolita con cachetes ----------
  if (hamster) {
    const by = groundY - T * 0.25;
    // patitas rosadas
    ellipse(ctx, cx - T * 0.1, groundY - T * 0.03, T * 0.05, T * 0.03, '#e8a6ae');
    ellipse(ctx, cx + T * 0.1, groundY - T * 0.03, T * 0.05, T * 0.03, '#e8a6ae');
    fluff(ctx, cx, by, T * 0.25, s.body, 14);
    if (f === 'up') {
      // raya oscura en el lomo
      ellipse(ctx, cx, by - T * 0.02, T * 0.035, T * 0.2, s.bodyDark);
      for (const o of [-0.13, 0.13]) {
        ellipse(ctx, cx + o * T, by - T * 0.2, T * 0.055, T * 0.055, s.ears);
      }
      return;
    }
    const fx = cx + side * T * 0.08;
    // barriguita café (abajo) y cachetes inflados a los lados de la cara
    ellipse(ctx, fx, by + T * 0.15, T * 0.11, T * 0.07, s.belly);
    const cheekXs = f === 'down' ? [fx - T * 0.17, fx + T * 0.17] : [fx + side * T * 0.13];
    for (const chx of cheekXs) {
      fluff(ctx, chx, by + T * 0.03, T * 0.075, s.accent, 7);
      ellipse(ctx, chx, by + T * 0.04, T * 0.03, T * 0.02, 'rgba(240, 140, 160, 0.55)'); // rubor
    }
    // orejitas redondas
    const earXs = f === 'down' ? [cx - T * 0.13, cx + T * 0.13] : [cx - side * T * 0.02, cx + side * T * 0.1];
    for (const ex of earXs) {
      ellipse(ctx, ex, by - T * 0.21, T * 0.055, T * 0.055, s.ears);
      ellipse(ctx, ex, by - T * 0.21, T * 0.03, T * 0.03, '#e8a6ae');
    }
    // ojos grandes y brillantes
    const eyeXs = f === 'down' ? [fx - T * 0.075, fx + T * 0.075] : [fx + side * T * 0.03];
    for (const ex of eyeXs) {
      ellipse(ctx, ex, by - T * 0.06, T * 0.038, T * 0.042, '#120c0c');
      ellipse(ctx, ex + T * 0.012, by - T * 0.075, T * 0.013, T * 0.013, '#ffffff');
    }
    // naricita rosada y bigotes
    const nx = fx + side * T * 0.12;
    ellipse(ctx, nx, by + T * 0.0, T * 0.022, T * 0.017, '#e48b98');
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1, T * 0.012);
    ctx.beginPath();
    for (const d of f === 'down' ? [-1, 1] : [side]) {
      ctx.moveTo(nx + d * T * 0.04, by + T * 0.01);
      ctx.lineTo(nx + d * T * 0.15, by - T * 0.01);
      ctx.moveTo(nx + d * T * 0.04, by + T * 0.025);
      ctx.lineTo(nx + d * T * 0.15, by + T * 0.04);
    }
    ctx.stroke();
    return;
  }

  // ---------- Perritos ----------
  const bodyY = groundY - T * 0.24;
  const headX = cx + side * T * 0.12;
  const headY = f === 'up' ? groundY - T * 0.56 : f === 'down' ? groundY - T * 0.46 : groundY - T * 0.52;
  const headColor = b === 'yorkie' ? s.belly : s.body; // el Yorkshire tiene la cabeza canela
  const tailX = cx - side * T * 0.2 + wag;
  const tailY = f === 'up' ? groundY - T * 0.3 : groundY - T * 0.44;

  const drawTail = () => {
    if (b === 'pomerania') {
      fluff(ctx, tailX, tailY, T * 0.15, s.bodyDark, 8);
      fluff(ctx, tailX, tailY - T * 0.02, T * 0.1, s.body, 7);
    } else if (b === 'beagle') {
      // cola levantada con la punta blanca
      ellipse(ctx, tailX, tailY - T * 0.04, T * 0.035, T * 0.12, s.body, side * 0.4);
      ellipse(ctx, tailX + side * -T * 0.02, tailY - T * 0.15, T * 0.035, T * 0.04, s.belly);
    } else if (b === 'collie') {
      // cola tupida y baja
      ellipse(ctx, tailX, tailY + T * 0.12, T * 0.07, T * 0.13, s.bodyDark, -side * 0.6);
      ellipse(ctx, tailX - side * T * 0.02, tailY + T * 0.22, T * 0.05, T * 0.05, s.belly);
    } else {
      // yorkie: colita corta
      ellipse(ctx, tailX, tailY + T * 0.04, T * 0.04, T * 0.07, s.bodyDark);
    }
  };
  if (f !== 'up') drawTail();

  // Patitas
  ellipse(ctx, cx - T * 0.12, groundY - T * 0.04, T * 0.07, T * 0.05, s.belly);
  ellipse(ctx, cx + T * 0.12, groundY - T * 0.04, T * 0.07, T * 0.05, s.belly);

  // Cuerpo
  if (smooth) {
    ellipse(ctx, cx, bodyY, T * 0.25, T * 0.21, s.body);
  } else if (b === 'yorkie') {
    // pelo largo y lacio que llega al suelo
    ellipse(ctx, cx, bodyY - T * 0.02, T * 0.22, T * 0.18, s.body);
    ctx.fillStyle = s.body;
    roundRect(ctx, cx - T * 0.24, bodyY - T * 0.04, T * 0.48, T * 0.25, 6);
    ctx.strokeStyle = s.bodyDark;
    ctx.lineWidth = Math.max(1, T * 0.012);
    ctx.beginPath();
    for (let i = -3; i <= 3; i++) {
      ctx.moveTo(cx + i * T * 0.06, bodyY);
      ctx.lineTo(cx + i * T * 0.065, bodyY + T * 0.2);
    }
    ctx.stroke();
  } else {
    fluff(ctx, cx, bodyY, T * 0.24, s.body, 11);
  }

  // Marcas del cuerpo
  if (b === 'beagle') ellipse(ctx, cx - side * T * 0.03, bodyY - T * 0.07, T * 0.2, T * 0.11, s.bodyDark); // manto negro
  if (b === 'collie') {
    for (const [dx, dy, r] of [[-0.12, -0.08, 0.07], [0.1, -0.02, 0.05], [0.02, 0.08, 0.045]] as const) {
      ellipse(ctx, cx + dx * T, bodyY + dy * T, r * T, r * T * 0.8, s.bodyDark);
    }
  }
  if (f !== 'up') {
    ellipse(ctx, cx + side * T * 0.06, bodyY + T * 0.04, T * 0.12, T * 0.14, s.belly); // pecho
  }
  if (f === 'up') drawTail();

  // Melena (Pomerania) o gola blanca (Collie)
  if (b === 'pomerania') fluff(ctx, headX, headY + T * 0.04, T * 0.22, s.bodyDark, 12);
  if (b === 'collie' && f !== 'up') fluff(ctx, headX, headY + T * 0.12, T * 0.15, s.belly, 9);

  // Orejas paradas (antes de la cabeza)
  const earOffsets = f === 'down' || f === 'up' ? [-0.11, 0.11] : side > 0 ? [-0.02, 0.13] : [-0.13, 0.02];
  if (b === 'pomerania' || b === 'yorkie') {
    for (const o of earOffsets) pointyEar(ctx, headX + o * T, headY - T * 0.1, T * 0.12, T * 0.15, s.ears, s.belly);
  } else if (b === 'collie') {
    for (const o of earOffsets) pointyEar(ctx, headX + o * T, headY - T * 0.09, T * 0.13, T * 0.13, s.ears, s.body, Math.sign(o) || 1);
  }

  // Cabeza
  if (b === 'pomerania') fluff(ctx, headX, headY, T * 0.16, s.body, 9);
  else if (b === 'yorkie') {
    fluff(ctx, headX, headY, T * 0.15, headColor, 10);
    // barbita de pelo largo
    if (f !== 'up') ellipse(ctx, headX + side * T * 0.05, headY + T * 0.1, T * 0.1, T * 0.07, headColor);
  } else ellipse(ctx, headX, headY, T * 0.165, T * 0.155, s.body);

  // Marcas de la cabeza
  if (b === 'collie') {
    ellipse(ctx, headX - T * 0.07, headY - T * 0.05, T * 0.07, T * 0.06, s.bodyDark); // mancha merle
    if (f !== 'up') ellipse(ctx, headX + side * T * 0.06, headY - T * 0.02, T * 0.025, T * 0.1, s.belly); // franja blanca
  }
  if (b === 'beagle' && f !== 'up') ellipse(ctx, headX + side * T * 0.06, headY - T * 0.03, T * 0.025, T * 0.09, s.belly);

  // Orejas caídas (Beagle), encima de la cabeza
  if (b === 'beagle') {
    const flop = f === 'down' || f === 'up' ? [-0.15, 0.15] : [-side * 0.06];
    for (const o of flop) ellipse(ctx, headX + o * T, headY + T * 0.04, T * 0.065, T * 0.13, s.ears, o * 1.5);
  }

  // Moñito del Yorkshire
  if (b === 'yorkie') {
    const bx = headX;
    const byy = headY - T * 0.17;
    ellipse(ctx, bx - T * 0.05, byy, T * 0.05, T * 0.035, s.accent, -0.4);
    ellipse(ctx, bx + T * 0.05, byy, T * 0.05, T * 0.035, s.accent, 0.4);
    ellipse(ctx, bx, byy, T * 0.025, T * 0.025, '#ffffff');
  }

  // Collar con corazoncito
  ctx.fillStyle = s.collar;
  roundRect(ctx, headX - T * 0.15, headY + T * 0.15, T * 0.3, T * 0.055, 3);
  heartPath(ctx, headX, headY + T * 0.24, T * 0.08);
  ctx.fill();

  if (f === 'up') return;

  // Cara
  const fx = headX + side * T * 0.07;
  if (b === 'pomerania') {
    // cejitas canela
    const browXs = f === 'down' ? [fx - T * 0.075, fx + T * 0.075] : [fx + side * T * 0.02];
    for (const bx of browXs) ellipse(ctx, bx, headY - T * 0.07, T * 0.03, T * 0.02, s.belly);
  }
  // hocico
  const muzzle = b === 'yorkie' ? '#e6bf8e' : s.belly;
  ellipse(ctx, fx + side * T * 0.04, headY + T * 0.06, T * (smooth ? 0.1 : 0.09), T * 0.065, muzzle);
  // ojos
  const eyeXs = f === 'down' ? [fx - T * 0.07, fx + T * 0.07] : [fx + side * T * 0.01];
  for (const ex of eyeXs) {
    ellipse(ctx, ex, headY - T * 0.015, T * 0.032, T * 0.036, '#1e1416');
    ellipse(ctx, ex + T * 0.01, headY - T * 0.03, T * 0.011, T * 0.011, '#ffffff');
  }
  // nariz y lengüita
  ellipse(ctx, fx + side * T * 0.1, headY + T * 0.035, T * 0.032, T * 0.023, '#1e1416');
  if (f === 'down') ellipse(ctx, fx, headY + T * 0.1, T * 0.025, T * 0.02, '#e88f9f');
}

/**
 * La mascota dentro del juego: sombra, salto, aplastado y animaciones de muerte.
 */
function drawCoco(ctx: CanvasRenderingContext2D, game: Game, x: number, centerY: number, T: number, lift: number) {
  const p = game.player;
  const top = centerY - T * 0.5;
  let squash = 1;
  let alpha = 1;
  let extraLift = lift;

  if (!game.alive) {
    if (p.cause === 'car') squash = 0.3;
    if (p.cause === 'water') {
      alpha = Math.max(0, 1 - p.deadFor * 1.5);
      extraLift = -p.deadFor * T * 0.6;
    }
    if (p.cause === 'eagle') extraLift = p.deadFor * T * 8;
    if (p.cause === 'train') alpha = Math.max(0, 1 - p.deadFor);
  }
  // Pequeño "estirón" al saltar y respiración en reposo
  const stretch = p.hop >= 0 ? 1 + Math.sin(Math.PI * Math.min(1, p.hop)) * 0.12 : 1 - Math.sin(game.time * 5) * 0.02;

  const cx = x + T * 0.5;
  const groundY = top + T * 0.75;

  ctx.save();
  ctx.globalAlpha = alpha;
  if (p.cause !== 'water' && p.cause !== 'eagle') shadow(ctx, cx, top + T * 0.72, T * 0.3, T * 0.1);

  // Transformación: aplastar desde el suelo
  ctx.translate(cx, groundY - extraLift);
  ctx.scale(1.15, 1.15 * squash * stretch);
  ctx.translate(-cx, -groundY);
  drawPet(ctx, game.skin, cx, groundY, T, { facing: p.facing, time: game.time, hop: p.hop });
  ctx.restore();

  // estrellitas al ser atropellado
  if (!game.alive && (p.cause === 'car' || p.cause === 'train') && p.deadFor < 1.4) {
    ctx.fillStyle = '#f2d17a';
    for (let i = 0; i < 3; i++) {
      const a = game.time * 4 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * T * 0.35, top + T * 0.2 + Math.sin(a) * T * 0.12, T * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
