import { LANE_SCALE, POWERS } from './constants';
import { PED_LOOKS, ZOMBIE_LOOKS } from './looks';
import { FRAME_FALL, FRAME_JUMP, SpriteCache, runFrame, shade } from './sprites';
import { clamp, hash01 } from './rng';
import { BIOME_EVERY_M, type World } from './world';
import type { Vehicle } from './types';

export interface View {
  /** Tamaño en px CSS. */
  W: number;
  H: number;
  dpr: number;
  /** px CSS por px virtual. */
  scale: number;
  /** Tamaño visible en px virtuales. */
  vw: number;
  vh: number;
  /** Altura (virtual, desde arriba) de la superficie de la calle. */
  groundY: number;
}

interface Palette {
  skyTop: string;
  skyBot: string;
  far: string;
  mid: string[];
  window: string;
  sidewalk: string;
  curb: string;
  road: string;
  under: string;
  sun: string;
  cloud: string;
  leaf: string;
  night: number;
}

type RawPalette = Omit<Palette, 'night'> & { night: number };

const BIOMES: RawPalette[] = [
  { // Centro (día)
    skyTop: '#62bdf6', skyBot: '#d6f1ff', far: '#a6c6e4', mid: ['#f4b183', '#e58f87', '#8cc7c4', '#c6a7dc', '#f2d48a'],
    window: '#fff6d1', sidewalk: '#cfd2dc', curb: '#9aa0b0', road: '#4a4e5e', under: '#30303e', sun: '#fff2a8',
    cloud: '#ffffff', leaf: '#5cb85c', night: 0,
  },
  { // Atardecer
    skyTop: '#ff7b6b', skyBot: '#ffd39a', far: '#d98a9a', mid: ['#e9967a', '#c97b8c', '#a07fb5', '#f0b26b', '#d4a07a'],
    window: '#ffe4a3', sidewalk: '#dcbdb3', curb: '#a98a8f', road: '#4e4258', under: '#2e2433', sun: '#ffe08a',
    cloud: '#ffe1cf', leaf: '#7aa24a', night: 0.35,
  },
  { // Noche
    skyTop: '#121838', skyBot: '#3b3570', far: '#262b57', mid: ['#2f3566', '#3c3170', '#28455e', '#43386b', '#1f3b4f'],
    window: '#ffd75e', sidewalk: '#6b6f88', curb: '#4f5370', road: '#262838', under: '#15151e', sun: '#f3f0d8',
    cloud: '#5b6296', leaf: '#2f5e4a', night: 1,
  },
  { // Barrio tóxico
    skyTop: '#29473a', skyBot: '#a4d873', far: '#3f6b4f', mid: ['#557a5a', '#6b8f4e', '#4a6b6b', '#7a8a4a', '#3f5f4f'],
    window: '#d4ff7a', sidewalk: '#8e9a80', curb: '#6b7560', road: '#33402f', under: '#1b2419', sun: '#e9ff9a',
    cloud: '#c8f5a8', leaf: '#8fcf3c', night: 0.55,
  },
];

const rgbCache = new Map<string, [number, number, number]>();
function rgb(hex: string): [number, number, number] {
  let v = rgbCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = [n >> 16, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, v);
  }
  return v;
}
function mix(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const x = rgb(a);
  const y = rgb(b);
  return `rgb(${Math.round(x[0] + (y[0] - x[0]) * t)},${Math.round(x[1] + (y[1] - x[1]) * t)},${Math.round(x[2] + (y[2] - x[2]) * t)})`;
}

/** Paleta del ambiente actual, con transición suave en los últimos ~100 m. */
export function paletteAt(meters: number): Palette {
  const t = meters / BIOME_EVERY_M;
  const i = Math.floor(t) % BIOMES.length;
  const a = BIOMES[i];
  const b = BIOMES[(i + 1) % BIOMES.length];
  const f = clamp((t - Math.floor(t) - 0.88) / 0.12, 0, 1);
  const k = f * f * (3 - 2 * f);
  return {
    skyTop: mix(a.skyTop, b.skyTop, k), skyBot: mix(a.skyBot, b.skyBot, k), far: mix(a.far, b.far, k),
    mid: a.mid.map((c, j) => mix(c, b.mid[j], k)), window: mix(a.window, b.window, k),
    sidewalk: mix(a.sidewalk, b.sidewalk, k), curb: mix(a.curb, b.curb, k), road: mix(a.road, b.road, k),
    under: mix(a.under, b.under, k), sun: mix(a.sun, b.sun, k), cloud: mix(a.cloud, b.cloud, k),
    leaf: mix(a.leaf, b.leaf, k), night: a.night + (b.night - a.night) * k,
  };
}

const FONT = "Fredoka, 'Segoe UI', system-ui, sans-serif";
const CAR_COLORS = ['#e84a5f', '#2a9df4', '#f9c74f', '#43aa8b'];
const PLATFORM_COLORS = ['#e05a5a', '#3f8fd8', '#f0a63a', '#4bb38a'];

type Ctx = CanvasRenderingContext2D;

/** Rectángulo redondeado (sin ctx.roundRect, que no existe en Safari < 16). */
function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

export class Renderer {
  readonly sprites = new SpriteCache();
  private v: View = { W: 1, H: 1, dpr: 1, scale: 1, vw: 960, vh: 540, groundY: 430 };

  constructor(private ctx: Ctx) {}

  setView(v: View) {
    this.v = v;
    this.sprites.setScale(v.dpr * v.scale);
  }

  draw(w: World, best: number) {
    const { ctx, v } = this;
    const pal = paletteAt(w.stats.distance);
    const k = v.dpr * v.scale;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = true;

    const camX = w.camX;
    this.drawSky(pal, camX);
    this.drawFar(pal, camX);
    this.drawMid(pal, camX);

    const sx = w.shake > 0 ? (Math.random() - 0.5) * w.shake * 26 : 0;
    const sy = w.shake > 0 ? (Math.random() - 0.5) * w.shake * 18 : 0;
    ctx.save();
    ctx.translate(-camX + sx, v.groundY + sy);

    this.drawPits(w, pal, camX);
    this.drawCorpses(w, true);
    this.drawGround(w, pal, camX);
    this.drawStreetDeco(w, pal, camX);
    this.drawPlatforms(w, camX);
    for (const v2 of w.vehicles) this.drawVehicle(v2, w.time);
    this.drawBombs(w);
    this.drawGems(w);
    this.drawCrates(w);
    this.drawPeds(w);
    this.drawPowerFx(w, true);
    this.drawHorde(w);
    this.drawCorpses(w, false);
    this.drawPowerFx(w, false);
    this.drawParticles(w);
    this.drawBadges(w);
    this.drawTexts(w);
    ctx.restore();

    if (pal.night > 0.2) {
      ctx.fillStyle = `rgba(20, 16, 50, ${(pal.night - 0.2) * 0.18})`;
      ctx.fillRect(0, 0, v.vw, v.vh);
    }

    // Interfaz en px CSS (nítida y legible en cualquier escala).
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    this.drawHud(w, best);
  }

  // ---------------------------------------------------------------- Fondo

  private drawSky(pal: Palette, camX: number) {
    const { ctx, v } = this;
    const g = ctx.createLinearGradient(0, 0, 0, v.groundY);
    g.addColorStop(0, pal.skyTop);
    g.addColorStop(1, pal.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, v.vw, v.vh);
    // Sol o luna
    const cx = v.vw * 0.8;
    const cy = Math.max(60, v.groundY * 0.26);
    ctx.fillStyle = pal.sun;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(cx, cy, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 36, 0, Math.PI * 2);
    ctx.fill();
    if (pal.night > 0.6) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 40; i++) {
        const x = (hash01(i * 13) * v.vw * 1.3 - camX * 0.02) % v.vw;
        const y = hash01(i * 29) * v.groundY * 0.6;
        const s = hash01(i * 7) < 0.2 ? 2 : 1.2;
        ctx.fillRect((x + v.vw) % v.vw, y, s, s);
      }
    }
    // Nubes
    ctx.fillStyle = pal.cloud;
    ctx.globalAlpha = 0.75;
    const par = camX * 0.06;
    const tile = 420;
    for (let t = Math.floor(par / tile) - 1; t <= Math.floor((par + v.vw) / tile) + 1; t++) {
      const x = t * tile - par + hash01(t * 3) * 200;
      const y = 50 + hash01(t * 5 + 1) * Math.max(40, v.groundY * 0.3);
      const s = 0.7 + hash01(t * 11) * 0.6;
      for (const [dx, dy, r] of [[0, 0, 26], [28, -10, 30], [58, 0, 24], [30, 8, 26]]) {
        ctx.beginPath();
        ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawFar(pal: Palette, camX: number) {
    const { ctx, v } = this;
    const par = camX * 0.18;
    const tile = 64;
    ctx.fillStyle = pal.far;
    const base = v.groundY - 6;
    for (let t = Math.floor(par / tile) - 1; t <= Math.floor((par + v.vw) / tile) + 1; t++) {
      const h = 70 + hash01(t) * 150;
      const x = t * tile - par;
      ctx.fillRect(x, base - h, tile - 4, h + 6);
      if (hash01(t * 17) > 0.7) ctx.fillRect(x + tile * 0.4, base - h - 22, 3, 22);
      if (hash01(t * 23) > 0.75) {
        ctx.beginPath();
        ctx.moveTo(x, base - h);
        ctx.lineTo(x + (tile - 4) / 2, base - h - 18);
        ctx.lineTo(x + tile - 4, base - h);
        ctx.fill();
      }
    }
  }

  private drawMid(pal: Palette, camX: number) {
    const { ctx, v } = this;
    const par = camX * 0.45;
    const tile = 150;
    const base = v.groundY;
    const lit = 0.12 + pal.night * 0.55;
    for (let t = Math.floor(par / tile) - 1; t <= Math.floor((par + v.vw) / tile) + 1; t++) {
      const bw = 112 + hash01(t * 3 + 7) * 32;
      const bh = 120 + hash01(t * 5 + 2) * 170;
      const x = t * tile - par + (tile - bw) / 2;
      const top = base - bh;
      const color = pal.mid[Math.floor(hash01(t * 9) * pal.mid.length)];
      ctx.fillStyle = color;
      ctx.fillRect(x, top, bw, bh);
      // cornisa y sombra lateral
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(x + bw - 10, top, 10, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x - 3, top - 6, bw + 6, 8);
      // ventanas
      const cols = 3 + Math.floor(hash01(t * 13) * 2);
      const ww = (bw - 24 - (cols - 1) * 10) / cols;
      for (let row = 0; top + 18 + row * 30 < base - 40; row++) {
        for (let c = 0; c < cols; c++) {
          const on = hash01(t * 101 + row * 7 + c) < lit;
          ctx.fillStyle = on ? pal.window : 'rgba(30,30,60,0.28)';
          ctx.fillRect(x + 12 + c * (ww + 10), top + 18 + row * 30, ww, 16);
        }
      }
      // tanque o antena en la azotea
      const roof = hash01(t * 31);
      ctx.fillStyle = shade(color.startsWith('#') ? color : '#888888', -0.25);
      if (roof > 0.7) {
        ctx.fillRect(x + bw * 0.25, top - 22, 22, 16);
        ctx.fillRect(x + bw * 0.25 + 4, top - 8, 3, 8);
        ctx.fillRect(x + bw * 0.25 + 15, top - 8, 3, 8);
      } else if (roof > 0.45) {
        ctx.fillRect(x + bw * 0.7, top - 30, 3, 30);
        ctx.fillRect(x + bw * 0.7 - 8, top - 26, 19, 2);
      }
      // puerta de tienda con toldo
      if (hash01(t * 41) > 0.5) {
        ctx.fillStyle = PLATFORM_COLORS[Math.floor(hash01(t * 43) * 4)];
        ctx.fillRect(x + 10, base - 46, bw - 20, 10);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x + bw / 2 - 12, base - 34, 24, 34);
      }
    }
  }

  // ---------------------------------------------------------------- Calle

  private drawPits(w: World, pal: Palette, camX: number) {
    const { ctx, v } = this;
    const depth = v.vh - v.groundY + 20;
    const g = ctx.createLinearGradient(0, 0, 0, Math.min(depth, 260));
    g.addColorStop(0, shade(pal.under.startsWith('#') ? pal.under : '#222222', -0.45));
    g.addColorStop(1, '#07060b');
    ctx.fillStyle = g;
    ctx.fillRect(camX - 20, 0, v.vw + 40, depth);
    void w;
  }

  private drawGround(w: World, pal: Palette, camX: number) {
    const { ctx, v } = this;
    const right = camX + v.vw + 20;
    const depth = v.vh - v.groundY + 20;
    for (const s of w.ground) {
      if (s.x1 < camX - 20 || s.x0 > right) continue;
      const x0 = Math.max(s.x0, camX - 20);
      const x1 = Math.min(s.x1, right);
      const wdt = x1 - x0;
      ctx.fillStyle = pal.under;
      ctx.fillRect(x0, 88, wdt, depth);
      ctx.fillStyle = pal.road;
      ctx.fillRect(x0, 19, wdt, 70);
      ctx.fillStyle = pal.curb;
      ctx.fillRect(x0, 13, wdt, 7);
      ctx.fillStyle = pal.sidewalk;
      ctx.fillRect(x0, 0, wdt, 14);
      // juntas de la acera y líneas de la vía (fijas al mundo)
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      for (let x = Math.ceil(x0 / 44) * 44; x < x1; x += 44) ctx.fillRect(x, 0, 2, 13);
      ctx.fillStyle = 'rgba(255,240,180,0.8)';
      for (let x = Math.ceil(x0 / 90) * 90; x < x1 - 40; x += 90) ctx.fillRect(x, 52, 44, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let x = Math.ceil(x0 / 120) * 120; x < x1; x += 120) {
        for (let y = 100; y < depth; y += 26) ctx.fillRect(x + ((y / 26) % 2) * 60, y, 50, 2);
      }
      // bordes rotos con cinta de peligro
      for (const [ex, dir] of [[s.x0, 1], [s.x1, -1]] as const) {
        if (ex < camX - 40 || ex > right + 20 || ex < -3000) continue;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(dir > 0 ? ex : ex - 6, 0, 6, depth);
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = i % 2 ? '#1f1f24' : '#ffcc33';
          ctx.fillRect(dir > 0 ? ex + i * 8 : ex - (i + 1) * 8, 2, 8, 9);
        }
        this.cone(ex + dir * 22, 0);
      }
    }
  }

  private cone(x: number, y: number) {
    const ctx = this.ctx;
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.moveTo(x - 7, y);
    ctx.lineTo(x, y - 22);
    ctx.lineTo(x + 7, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 4, y - 13, 8, 3);
    ctx.fillStyle = '#c45a12';
    ctx.fillRect(x - 9, y - 2, 18, 3);
  }

  private drawStreetDeco(w: World, pal: Palette, camX: number) {
    const { ctx, v } = this;
    const tile = 420;
    for (let t = Math.floor((camX - 100) / tile); t <= Math.floor((camX + v.vw + 100) / tile); t++) {
      const kind = hash01(t * 19);
      const x = t * tile + 60 + hash01(t * 7) * 200;
      if (!w.onGround(x - 26) || !w.onGround(x + 26)) continue;
      if (kind < 0.4) {
        // farola
        ctx.fillStyle = '#3d4152';
        ctx.fillRect(x - 3, -150, 6, 150);
        ctx.fillRect(x - 3, -150, 30, 5);
        ctx.fillStyle = pal.night > 0.3 ? '#fff3b0' : '#e8e8e8';
        rr(ctx, x + 18, -146, 16, 8, 3);
        ctx.fill();
        if (pal.night > 0.3) {
          const g = ctx.createRadialGradient(x + 26, -140, 2, x + 26, -140, 90);
          g.addColorStop(0, `rgba(255,240,170,${0.35 * pal.night})`);
          g.addColorStop(1, 'rgba(255,240,170,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - 70, -230, 190, 230);
        }
      } else if (kind < 0.75) {
        // árbol en matera
        ctx.fillStyle = '#7a5235';
        ctx.fillRect(x - 4, -60, 8, 60);
        ctx.fillStyle = pal.leaf;
        for (const [dx, dy, r] of [[0, -78, 26], [-18, -62, 18], [18, -64, 19]]) {
          ctx.beginPath();
          ctx.arc(x + dx, dy, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(x - 8, -86, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8c8f9e';
        ctx.fillRect(x - 12, -10, 24, 10);
      } else {
        // hidrante y banca
        ctx.fillStyle = '#e04646';
        rr(ctx, x - 6, -22, 12, 22, 4);
        ctx.fill();
        ctx.fillRect(x - 9, -16, 18, 5);
        ctx.fillStyle = '#7b5a3c';
        ctx.fillRect(x + 30, -20, 46, 5);
        ctx.fillRect(x + 30, -30, 46, 4);
        ctx.fillStyle = '#3d4152';
        ctx.fillRect(x + 34, -20, 4, 20);
        ctx.fillRect(x + 68, -20, 4, 20);
      }
    }
  }

  private drawPlatforms(w: World, camX: number) {
    const { ctx, v } = this;
    const right = camX + v.vw;
    const depth = v.vh - v.groundY;
    for (const p of w.platforms) {
      if (p.x1 < camX || p.x0 > right) continue;
      const wdt = p.x1 - p.x0;
      // patas (llegan hasta la calle o al fondo del hueco)
      ctx.fillStyle = '#5b6070';
      for (let x = p.x0 + 14; x < p.x1 - 6; x += Math.max(60, wdt / 3)) {
        const bottom = w.onGround(x) ? 0 : depth;
        ctx.fillRect(x - 3, p.y, 6, bottom - p.y);
      }
      if (p.kind === 'scaffold') {
        ctx.strokeStyle = 'rgba(70,74,90,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = p.x0 + 14; x < p.x1 - 66; x += Math.max(60, wdt / 3)) {
          ctx.moveTo(x, p.y + 10);
          ctx.lineTo(x + Math.max(60, wdt / 3), Math.min(0, p.y + 70));
        }
        ctx.stroke();
        ctx.fillStyle = '#b07a46';
        rr(ctx, p.x0, p.y, wdt, 11, 3);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        for (let x = p.x0 + 30; x < p.x1; x += 30) ctx.fillRect(x, p.y + 1, 2, 9);
      } else {
        const c = PLATFORM_COLORS[p.color % PLATFORM_COLORS.length];
        for (let i = 0; i * 24 < wdt; i++) {
          ctx.fillStyle = i % 2 ? '#ffffff' : c;
          ctx.fillRect(p.x0 + i * 24, p.y, Math.min(24, wdt - i * 24), 12);
          ctx.beginPath();
          ctx.arc(p.x0 + i * 24 + 12, p.y + 12, 12, 0, Math.PI);
          ctx.fill();
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(p.x0, p.y, wdt, 2);
    }
  }

  private drawVehicle(veh: Vehicle, time: number) {
    const ctx = this.ctx;
    const { x, w, h } = veh;
    if (veh.smashed && veh.smashT > 6) return;
    ctx.save();
    if (veh.smashed) {
      // chatarra aplastada
      const t = Math.min(1, veh.smashT / 0.18);
      ctx.translate(x + w / 2, 0);
      ctx.scale(1 + 0.08 * t, 1 - 0.62 * t);
      ctx.rotate(-0.04 * t);
      ctx.translate(-(x + w / 2), 0);
      ctx.filter = 'none';
    }
    const color = veh.kind === 'bus' ? '#ffb627' : veh.kind === 'armored' ? '#5b6b4a' : CAR_COLORS[veh.color % CAR_COLORS.length];
    const dark = shade(color, -0.25);
    const wheelR = veh.kind === 'armored' ? 16 : veh.kind === 'bus' ? 14 : 12;
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, 2, w * 0.52, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(25,20,35,0.6)';
    if (veh.kind === 'car') {
      ctx.fillStyle = color;
      rr(ctx, x, -h * 0.58, w, h * 0.58 - 8, 12);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 22, -h * 0.56);
      ctx.lineTo(x + 40, -h);
      ctx.lineTo(x + w - 46, -h);
      ctx.lineTo(x + w - 22, -h * 0.56);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#bfe6ff';
      ctx.beginPath();
      ctx.moveTo(x + 32, -h * 0.6);
      ctx.lineTo(x + 44, -h + 6);
      ctx.lineTo(x + w / 2 - 4, -h + 6);
      ctx.lineTo(x + w / 2 - 4, -h * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x + w / 2 + 4, -h + 6, w / 2 - 52, h * 0.4 - 6);
    } else if (veh.kind === 'van') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x + 4, -12);
      ctx.lineTo(x + 4, -h * 0.55);
      ctx.lineTo(x + 30, -h);
      ctx.lineTo(x + w - 6, -h);
      ctx.lineTo(x + w - 6, -12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#bfe6ff';
      ctx.beginPath();
      ctx.moveTo(x + 12, -h * 0.56);
      ctx.lineTo(x + 32, -h + 8);
      ctx.lineTo(x + 52, -h + 8);
      ctx.lineTo(x + 52, -h * 0.56);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(x + 66, -h * 0.62, w - 86, 14);
      ctx.fillStyle = dark;
      ctx.font = `700 11px ${FONT}`;
      ctx.fillText('MUDANZAS', x + 72, -h * 0.62 + 11);
    } else if (veh.kind === 'bus') {
      ctx.fillStyle = color;
      rr(ctx, x, -h, w, h - 10, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#bfe6ff';
      for (let wx = x + 14; wx < x + w - 40; wx += 42) ctx.fillRect(wx, -h + 14, 32, 30);
      ctx.fillStyle = '#2b2b38';
      ctx.fillRect(x + w - 34, -h + 14, 22, h - 30);
      ctx.fillStyle = dark;
      ctx.fillRect(x, -h * 0.42, w, 8);
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 13px ${FONT}`;
      ctx.fillText('RUTA 7', x + 14, -h * 0.42 + 26);
    } else {
      ctx.fillStyle = color;
      rr(ctx, x, -h * 0.78, w, h * 0.78 - 10, 8);
      ctx.fill();
      ctx.stroke();
      rr(ctx, x + 20, -h, w - 70, h * 0.26, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = dark;
      for (let px = x + 16; px < x + w - 16; px += 36) {
        for (let py = -h * 0.7; py < -22; py += 26) {
          ctx.beginPath();
          ctx.arc(px, py, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = '#1d2330';
      ctx.fillRect(x + 30, -h * 0.68, 40, 8);
      ctx.fillStyle = Math.sin(time * 10) > 0 ? '#ff4d5e' : '#4cc3ff';
      ctx.fillRect(x + w / 2 - 12, -h - 8, 24, 8);
    }
    // faros (miran hacia la horda) y ruedas
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.arc(x + 5, -h * 0.32, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff5c5c';
    ctx.fillRect(x + w - 6, -h * 0.4, 5, 10);
    const wheels = veh.kind === 'bus' ? [x + 40, x + w * 0.55, x + w - 50] : [x + 28, x + w - 30];
    const spin = veh.vx !== 0 ? time * 14 : 0;
    for (const wx of wheels) {
      ctx.fillStyle = '#1e1e26';
      ctx.beginPath();
      ctx.arc(wx, -wheelR + 2, wheelR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b8bcc8';
      ctx.beginPath();
      ctx.arc(wx, -wheelR + 2, wheelR * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6d7180';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wx + Math.cos(spin) * wheelR * 0.4, -wheelR + 2 + Math.sin(spin) * wheelR * 0.4);
      ctx.lineTo(wx - Math.cos(spin) * wheelR * 0.4, -wheelR + 2 - Math.sin(spin) * wheelR * 0.4);
      ctx.stroke();
    }
    // líneas de velocidad si viene en marcha
    if (veh.vx < 0 && !veh.smashed) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        ctx.moveTo(x + w + 12 + i * 4, -h * (0.3 + i * 0.2));
        ctx.lineTo(x + w + 40 + i * 10, -h * (0.3 + i * 0.2));
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBombs(w: World) {
    const ctx = this.ctx;
    for (const b of w.bombs) {
      if (b.exploded) {
        ctx.fillStyle = 'rgba(20,16,24,0.55)';
        ctx.beginPath();
        ctx.ellipse(b.x, 1, 30, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      const cy = b.y - 16;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(b.x, 1, 18, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#23212b';
      ctx.beginPath();
      ctx.arc(b.x, cy, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8434f';
      ctx.fillRect(b.x - 16, cy - 3, 32, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(b.x - 6, cy - 7, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a4752';
      ctx.fillRect(b.x - 4, cy - 21, 8, 6);
      ctx.strokeStyle = '#a07a4a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x, cy - 21);
      ctx.quadraticCurveTo(b.x + 6, cy - 30, b.x + 10, cy - 28);
      ctx.stroke();
      const f = Math.sin(w.time * 30 + b.id) > 0;
      ctx.fillStyle = f ? '#ffd84d' : '#ff8a3d';
      ctx.beginPath();
      ctx.arc(b.x + 10, cy - 28, f ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawGems(w: World) {
    const ctx = this.ctx;
    const pulse = 0.75 + Math.sin(w.time * 6) * 0.25;
    for (const g of w.gems) {
      if (g.taken) continue;
      const y = g.y + Math.sin(w.time * 4 + g.x * 0.05) * 3;
      ctx.fillStyle = `rgba(110,255,190,${0.22 * pulse})`;
      ctx.beginPath();
      ctx.arc(g.x, y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2fd38a';
      ctx.beginPath();
      ctx.moveTo(g.x, y - 10);
      ctx.lineTo(g.x + 7, y - 2);
      ctx.lineTo(g.x, y + 9);
      ctx.lineTo(g.x - 7, y - 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#b9ffe0';
      ctx.beginPath();
      ctx.moveTo(g.x, y - 10);
      ctx.lineTo(g.x + 7, y - 2);
      ctx.lineTo(g.x, y - 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawCrates(w: World) {
    const ctx = this.ctx;
    for (const c of w.crates) {
      if (c.taken) continue;
      const y = c.y + Math.sin(w.time * 3) * 4;
      const hue = POWERS[(['giant', 'magnet', 'shield', 'clone'] as const)[Math.floor(w.time * 2) % 4]].color;
      ctx.fillStyle = hue;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(c.x, y, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#c98a4b';
      rr(ctx, c.x - 17, y - 17, 34, 34, 5);
      ctx.fill();
      ctx.strokeStyle = '#7a4f2a';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(c.x - 17, y - 17);
      ctx.lineTo(c.x + 17, y + 17);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = hue;
      ctx.lineWidth = 4;
      ctx.font = `700 26px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText('?', c.x, y + 1);
      ctx.fillText('?', c.x, y + 1);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }
  }

  // ---------------------------------------------------------------- Personajes

  private drawPeds(w: World) {
    const ctx = this.ctx;
    for (const p of w.peds) {
      const look = PED_LOOKS[p.look];
      const s = look.scale * LANE_SCALE[p.lane];
      const y = p.y + [4, -3, -10][p.lane];
      const img = this.sprites.ped(p.look, Math.floor(p.phase * 8) % 8, p.panic);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(p.x, y, 10 * s, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      if (p.vx < -1) {
        ctx.save();
        ctx.translate(p.x, 0);
        ctx.scale(-1, 1);
        SpriteCache.blit(ctx, img, 0, y, s);
        ctx.restore();
      } else {
        SpriteCache.blit(ctx, img, p.x, y, s);
      }
      if (p.panic && Math.sin(w.time * 8 + p.id) > 0.3) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#2a2230';
        ctx.lineWidth = 3;
        ctx.font = `700 16px ${FONT}`;
        ctx.strokeText('!', p.x + 4, y - 52 * s);
        ctx.fillText('!', p.x + 4, y - 52 * s);
      }
    }
  }

  private drawHorde(w: World) {
    const ctx = this.ctx;
    const giant = w.isGiant();
    for (let lane = 2; lane >= 0; lane--) {
      for (let i = w.horde.length - 1; i >= 0; i--) {
        const z = w.horde[i];
        if (z.lane !== lane) continue;
        const look = ZOMBIE_LOOKS[z.look];
        const big = giant && i === 0;
        let s = LANE_SCALE[lane] * look.scale;
        if (z.age < 0.25) s *= 0.4 + (z.age / 0.25) * 0.6;
        const frame = z.grounded ? runFrame(z.phase) : z.vy < 0 ? FRAME_JUMP : FRAME_FALL;
        const y = z.y + z.laneY;
        if (z.grounded) {
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.beginPath();
          ctx.ellipse(z.x, y, (big ? 22 : 10) * s, 3, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        const mul = big ? 2.1 : 1;
        const img = this.sprites.zombie(z.look, frame, mul);
        if (z.squash > 0) {
          const q = z.squash / 0.12;
          ctx.save();
          ctx.translate(z.x, y);
          ctx.scale(1 + 0.1 * q, 1 - 0.12 * q);
          SpriteCache.blit(ctx, img, 0, 0, s * mul);
          ctx.restore();
        } else {
          SpriteCache.blit(ctx, img, z.x, y, s * mul);
        }
      }
    }
  }

  private drawCorpses(w: World, inPit: boolean) {
    const ctx = this.ctx;
    for (const c of w.corpses) {
      if (c.inPit !== inPit) continue;
      ctx.save();
      ctx.globalAlpha = clamp(1.6 - c.life, 0, 1);
      ctx.translate(c.x, c.y - 20);
      ctx.rotate(c.rot);
      SpriteCache.blit(ctx, this.sprites.zombie(c.look, FRAME_FALL), 0, 20, LANE_SCALE[c.lane]);
      ctx.restore();
    }
  }

  private drawPowerFx(w: World, behind: boolean) {
    const ctx = this.ctx;
    const p = w.power;
    if (!p || !w.horde.length) return;
    const front = w.horde[0];
    const back = w.horde[w.horde.length - 1];
    const fade = p.t < 2 ? (Math.sin(w.time * 20) > 0 ? 1 : 0.35) : 1;
    if (p.kind === 'shield' && !behind) {
      const cx = (front.x + back.x) / 2;
      const rx = (front.x - back.x) / 2 + 34;
      const cy = Math.min(front.y, 0) - 26;
      ctx.globalAlpha = 0.9 * fade;
      ctx.strokeStyle = '#c9a8ff';
      ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(180,140,255,0.16)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, 42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx - 8, 34, 0, Math.PI * 1.1, Math.PI * 1.4);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (p.kind === 'magnet' && behind) {
      ctx.strokeStyle = `rgba(76,195,255,${0.5 * fade})`;
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const r = ((w.time * 160 + i * 60) % 180) + 20;
        ctx.globalAlpha = (1 - r / 200) * fade;
        ctx.beginPath();
        ctx.arc(front.x, front.y - 24, r, -0.9, 0.9);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (p.kind === 'giant' && behind) {
      ctx.fillStyle = `rgba(255,122,69,${0.18 * fade})`;
      ctx.beginPath();
      ctx.arc(front.x, front.y - 46, 70, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawParticles(w: World) {
    const ctx = this.ctx;
    for (const p of w.particles) {
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = Math.max(0, a);
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4 * a + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - a * 0.8), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'gem') {
        ctx.fillStyle = p.color;
        ctx.font = `700 14px ${FONT}`;
        ctx.fillText('+1', p.x - 8, p.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.kind === 'smoke' ? p.size * (1.4 - a * 0.4) : p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawBadges(w: World) {
    const ctx = this.ctx;
    const n = w.horde.length;
    const giant = w.isGiant();
    for (const v of w.vehicles) {
      if (v.smashed) continue;
      const ok = n >= v.req || giant;
      const cx = v.x + v.w / 2;
      const cy = -v.h - 28;
      const label = `${v.req}`;
      ctx.font = `700 16px ${FONT}`;
      const tw = ctx.measureText(label).width;
      const bw = tw + 40;
      ctx.fillStyle = ok ? '#3fbf6a' : '#e8434f';
      rr(ctx, cx - bw / 2, cy - 13, bw, 26, 13);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // cabecita de zombi
      ctx.fillStyle = '#9ed06b';
      ctx.beginPath();
      ctx.arc(cx - bw / 2 + 14, cy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx - bw / 2 + 16, cy - 2, 2.6, 0, Math.PI * 2);
      ctx.arc(cx - bw / 2 + 11, cy - 1.5, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, cx - bw / 2 + 27, cy + 6);
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy + 13);
      ctx.lineTo(cx + 6, cy + 13);
      ctx.lineTo(cx, cy + 20);
      ctx.fillStyle = ok ? '#3fbf6a' : '#e8434f';
      ctx.fill();
    }
  }

  private drawTexts(w: World) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const t of w.texts) {
      ctx.globalAlpha = clamp(1.6 - t.life * 1.4, 0, 1);
      ctx.font = `700 ${t.size}px ${FONT}`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(25,18,35,0.85)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';
  }

  // ---------------------------------------------------------------- Interfaz

  private drawHud(w: World, best: number) {
    const { ctx, v } = this;
    const W = v.W;
    const H = v.H;
    const compact = W < 520;
    ctx.lineJoin = 'round';

    // Destello rojo al perder zombis
    if (w.hurt > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, 'rgba(255,40,60,0)');
      g.addColorStop(1, `rgba(255,40,60,${0.4 * w.hurt})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // Panel: horda + distancia
    const x = 12;
    const y = 12;
    const pw = compact ? 150 : 190;
    const ph = compact ? 62 : 74;
    ctx.fillStyle = 'rgba(22, 18, 38, 0.62)';
    rr(ctx, x, y, pw, ph, 16);
    ctx.fill();
    // icono de zombi
    const ix = x + (compact ? 26 : 32);
    const iy = y + ph / 2;
    const ir = compact ? 15 : 19;
    ctx.fillStyle = '#9ed06b';
    ctx.beginPath();
    ctx.arc(ix, iy, ir, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff8a2a';
    ctx.beginPath();
    ctx.arc(ix, iy - ir * 0.15, ir, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ix + ir * 0.35, iy + ir * 0.1, ir * 0.3, 0, Math.PI * 2);
    ctx.arc(ix - ir * 0.25, iy + ir * 0.15, ir * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a1f2b';
    ctx.beginPath();
    ctx.arc(ix + ir * 0.42, iy + ir * 0.12, ir * 0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${compact ? 26 : 32}px ${FONT}`;
    const count = `${w.horde.length}`;
    ctx.fillText(count, ix + ir + 10, iy + (compact ? 4 : 5));
    const cw = ctx.measureText(count).width;
    ctx.font = `600 ${compact ? 10 : 11}px ${FONT}`;
    ctx.fillStyle = '#b9f59a';
    ctx.fillText('ZOMBIS', ix + ir + 12 + cw, iy - (compact ? 4 : 6));
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${compact ? 13 : 15}px ${FONT}`;
    ctx.fillText(`${w.stats.distance} m`, ix + ir + 12 + cw, iy + (compact ? 10 : 12));

    // récord y gemas
    ctx.font = `600 ${compact ? 12 : 13}px ${FONT}`;
    const recordTxt = best > 0 ? `Récord ${Math.max(best, w.stats.distance)} m` : 'Primer récord';
    const gemTxt = `${w.stats.gems}`;
    const rowY = y + ph + 18;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(22,18,38,0.6)';
    ctx.strokeText(recordTxt, x + 6, rowY);
    ctx.fillStyle = w.stats.distance > best && best > 0 ? '#ffd84d' : '#ffffff';
    ctx.fillText(recordTxt, x + 6, rowY);
    const rw = ctx.measureText(recordTxt).width;
    const gx = x + 6 + rw + 18;
    ctx.fillStyle = '#2fd38a';
    ctx.beginPath();
    ctx.moveTo(gx, rowY - 12);
    ctx.lineTo(gx + 6, rowY - 5);
    ctx.lineTo(gx, rowY + 3);
    ctx.lineTo(gx - 6, rowY - 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeText(gemTxt, gx + 10, rowY);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(gemTxt, gx + 10, rowY);

    // Potenciador activo con barra de tiempo
    if (w.power) {
      const spec = POWERS[w.power.kind];
      const bw = compact ? 130 : 170;
      const bx = compact ? x : W / 2 - bw / 2;
      const by = compact ? rowY + 12 : 14;
      ctx.fillStyle = 'rgba(22, 18, 38, 0.62)';
      rr(ctx, bx, by, bw, 38, 12);
      ctx.fill();
      ctx.fillStyle = spec.color;
      ctx.font = `700 14px ${FONT}`;
      ctx.fillText(spec.label.toUpperCase(), bx + 12, by + 17);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      rr(ctx, bx + 12, by + 24, bw - 24, 6, 3);
      ctx.fill();
      ctx.fillStyle = spec.color;
      rr(ctx, bx + 12, by + 24, (bw - 24) * clamp(w.power.t / w.power.max, 0, 1), 6, 3);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 12px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.ceil(w.power.t)} s`, bx + bw - 12, by + 17);
      ctx.textAlign = 'start';
    }

    // Aviso de vehículo en sentido contrario
    if (w.incoming && Math.sin(w.time * 14) > -0.3) {
      const vy = (v.groundY - w.incoming.h / 2) * v.scale;
      const ax = W - 18;
      ctx.fillStyle = '#e8434f';
      ctx.beginPath();
      ctx.moveTo(ax, vy - 22);
      ctx.lineTo(ax - 24, vy + 18);
      ctx.lineTo(ax + 4, vy + 18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('!', ax - 9, vy + 13);
      ctx.textAlign = 'start';
    }

    // Anuncio grande
    const b = w.banner;
    if (b) {
      const a = clamp(Math.min(b.t / 0.2, (2.4 - b.t) / 0.4), 0, 1);
      const pop = 1 + Math.max(0, 0.25 - b.t) * 1.2;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(W / 2, H * 0.3);
      ctx.scale(pop, pop);
      ctx.textAlign = 'center';
      ctx.font = `700 ${compact ? 30 : 40}px ${FONT}`;
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(22,18,38,0.85)';
      ctx.strokeText(b.title, 0, 0);
      ctx.fillStyle = b.color;
      ctx.fillText(b.title, 0, 0);
      if (b.sub) {
        ctx.font = `600 ${compact ? 13 : 16}px ${FONT}`;
        ctx.lineWidth = 4;
        ctx.strokeText(b.sub, 0, compact ? 24 : 30);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(b.sub, 0, compact ? 24 : 30);
      }
      ctx.restore();
    }
  }
}

