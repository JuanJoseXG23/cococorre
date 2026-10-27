import {
  BLAST_RADIUS_X, BOMB_RADIUS, CLONE_AMOUNT, COYOTE_TIME, EDGE_TOLERANCE, GRAVITY, HOLD_GRAVITY, HORDE_MAX,
  JUMP_BUFFER, JUMP_VELOCITY, LANE_Y, MAX_HOLD, PIT_DOOM_Y, POWERS, PX_PER_METER, VEHICLES, ZOMBIE_H,
  ZOMBIE_HALF_W, type PowerKind,
} from './constants';
import { Generator } from './generator';
import { LEADER_LOOK_INDEX, PED_LOOKS } from './looks';
import { speedAt } from './physics';
import { clamp, createRng, hash01, lerp } from './rng';
import type {
  ActivePower, Bomb, Corpse, Crate, FloatText, GameSound, Gem, JumpEvent, Particle, Pedestrian, Platform,
  RunStats, Segment, Vehicle, Zombie,
} from './types';

/** Fracción del ancho de pantalla donde corre el líder (deja ver lo que viene). */
export const LEADER_SCREEN = 0.42;
/** En vertical la pantalla es angosta: el líder va más atrás para ver lo que viene. */
export const LEADER_SCREEN_PORTRAIT = 0.3;
/** Cada cuántos metros cambia el ambiente (día, atardecer, noche...). */
export const BIOME_EVERY_M = 900;
export const BIOME_NAMES = ['Centro', 'Atardecer', 'Noche', 'Barrio tóxico'];

export interface Banner {
  title: string;
  sub?: string;
  color: string;
  t: number;
}

export interface WorldOptions {
  seed?: number;
  /** Récord personal (m) para anunciar cuando se supera. */
  bestDistance?: number;
}

type LossCause = 'fall' | 'blast' | 'crash';

/**
 * Simulación completa de una partida, sin DOM ni canvas: se puede ejecutar
 * en pruebas automáticas. El motor (Engine.ts) la avanza con paso fijo y
 * la dibuja con render.ts.
 */
export class World {
  readonly rng: () => number;
  time = 0;
  /** Posición x del "ancla" de la jauría: avanza siempre a `speed`. */
  anchorX = 0;
  speed = speedAt(0);
  viewW = 960;
  leaderScreen = LEADER_SCREEN;

  readonly horde: Zombie[] = [];
  readonly events: JumpEvent[] = [];
  readonly ground: Segment[] = [];
  readonly platforms: Platform[] = [];
  readonly vehicles: Vehicle[] = [];
  readonly peds: Pedestrian[] = [];
  readonly bombs: Bomb[] = [];
  readonly gems: Gem[] = [];
  readonly crates: Crate[] = [];
  readonly corpses: Corpse[] = [];
  readonly particles: Particle[] = [];
  readonly texts: FloatText[] = [];
  /** Sonidos pendientes de reproducir (los vacía el motor). */
  readonly sounds: GameSound[] = [];

  /** Potenciador activo (el escudo termina antes si absorbe un golpe). */
  power: ActivePower | null = null;
  /** Anuncio grande en pantalla (potenciador, récord, nuevo ambiente). */
  banner: Banner | null = null;
  state: 'running' | 'dying' | 'over' = 'running';
  shake = 0;
  /** Destello rojo al perder zombis (0..1). */
  hurt = 0;
  readonly stats: RunStats = { distance: 0, maxHorde: 1, converted: 0, gems: 0, vehiclesSmashed: 0, powerups: 0, durationMs: 0 };
  /** Aviso de vehículo que viene de frente (posición x) o null. */
  incoming: Vehicle | null = null;

  private idSeq = 1;
  private evSeq = 1;
  private held = false;
  private buffer = 0;
  private current: JumpEvent | null = null;
  private dyingT = 0;
  private warnedId = 0;
  private runTime = 0;
  private bestDistance: number;
  private recordAnnounced = false;
  private biome = 0;
  private lost = 0;
  private lostX = 0;
  private gen: Generator;

  constructor(opts: WorldOptions = {}) {
    this.rng = createRng(opts.seed ?? (Math.random() * 2 ** 32) >>> 0);
    this.bestDistance = opts.bestDistance ?? 0;
    this.gen = new Generator(
      {
        ground: this.ground, platforms: this.platforms, vehicles: this.vehicles, peds: this.peds,
        bombs: this.bombs, gems: this.gems, crates: this.crates,
        nextId: () => this.idSeq++,
        hordeSize: () => this.horde.length,
      },
      this.rng,
    );
    this.addZombie(LEADER_LOOK_INDEX, 0, 0, 0);
    this.horde[0].age = 10;
    this.gen.fill(this.anchorX + this.viewW + 600);
  }

  // ------------------------------------------------------------------ API

  /** Ancho visible del mundo y posición del líder en pantalla (los fija el motor al cambiar el tamaño). */
  setViewWidth(w: number, leaderScreen = LEADER_SCREEN) {
    this.viewW = w;
    this.leaderScreen = leaderScreen;
  }

  get camX() {
    return this.anchorX - this.viewW * this.leaderScreen;
  }

  get leader(): Zombie | undefined {
    return this.horde[0];
  }

  get meters() {
    return this.anchorX / PX_PER_METER;
  }

  get biomeIndex() {
    return Math.floor(this.stats.distance / BIOME_EVERY_M);
  }

  /** Botón de salto pulsado. */
  press() {
    if (this.state !== 'running' || this.held) return;
    this.held = true;
    this.buffer = JUMP_BUFFER;
    this.tryLeaderJump();
  }

  /** Botón de salto soltado (corta el salto largo). */
  release() {
    this.held = false;
    if (this.current) {
      this.current.released = true;
      this.current = null;
    }
  }

  isGiant() {
    return this.power?.kind === 'giant';
  }

  result(): RunStats {
    return { ...this.stats, durationMs: Math.round(this.runTime * 1000) };
  }

  // ------------------------------------------------------------------ Bucle

  step(dt: number) {
    this.time += dt;
    if (this.state === 'running') {
      this.runTime += dt;
      this.speed = speedAt(this.meters);
      this.anchorX += this.speed * dt;
      this.stats.distance = Math.floor(this.meters);
      if (this.current && this.held) this.current.hold += dt;
      if (this.buffer > 0) {
        this.buffer -= dt;
        this.tryLeaderJump();
      }
      this.gen.fill(this.anchorX + this.viewW + 600);
      this.checkMilestones();
    } else {
      this.speed *= Math.max(0, 1 - dt * 3);
      this.anchorX += this.speed * dt;
      if (this.state === 'dying') {
        this.dyingT += dt;
        if (this.dyingT > 1.6) this.state = 'over';
      }
    }

    this.updateHorde(dt);
    this.updatePeds(dt);
    this.updateVehicles(dt);
    if (this.state === 'running') {
      this.collidePeds();
      this.collideVehicles();
      this.collideBombs();
      this.collectGems(dt);
      this.collectCrates();
    }
    this.flushLosses();
    this.updatePower(dt);
    this.updateEffects(dt);
    this.prune();
  }

  // ------------------------------------------------------------------ Jauría

  /** Puesto (desplazamiento detrás del ancla) del zombi número i de n. */
  private slotOffset(i: number, n: number): number {
    if (i === 0) return 0;
    const spacing = lerp(13, 8.4, Math.min(1, n / HORDE_MAX));
    return -6 - i * spacing + (hash01(i * 7 + 3) - 0.5) * 6;
  }

  private slotLane(i: number): number {
    if (i === 0) return 0;
    return i % 3 === 1 ? 1 : i % 3 === 2 ? 2 : 0;
  }

  private addZombie(look: number, x: number, y: number, at = 1): Zombie | null {
    if (this.horde.length >= HORDE_MAX) return null;
    // Saltos que ya quedaron detrás de esta posición no le corresponden.
    let lastEv = 0;
    for (const ev of this.events) if (ev.x <= x) lastEv = ev.id;
    const z: Zombie = {
      id: this.idSeq++, look, x, y, vy: 0, off: x - this.anchorX, lane: 1, laneY: LANE_Y[1],
      grounded: this.supported(x, y), coyote: 0, jump: null, holdT: 0, lastEv, pending: null, pendingT: 0,
      phase: this.rng(), squash: 0, age: 0,
    };
    this.horde.splice(Math.min(at, this.horde.length), 0, z);
    this.stats.maxHorde = Math.max(this.stats.maxHorde, this.horde.length);
    return z;
  }

  private canJump(z: Zombie) {
    return z.grounded || z.coyote > 0;
  }

  private startJump(z: Zombie, ev: JumpEvent) {
    z.vy = -JUMP_VELOCITY;
    z.grounded = false;
    z.coyote = 0;
    z.jump = ev;
    z.holdT = 0;
    z.pending = null;
  }

  private tryLeaderJump() {
    const z = this.horde[0];
    if (!z || !this.canJump(z)) return;
    const ev: JumpEvent = { id: this.evSeq++, x: z.x, hold: 0, released: !this.held };
    this.events.push(ev);
    this.current = ev.released ? null : ev;
    z.lastEv = ev.id;
    this.startJump(z, ev);
    this.buffer = 0;
    this.sounds.push('jump');
  }

  private updateHorde(dt: number) {
    const n = this.horde.length;
    const maxRel = 300 * dt;
    for (let i = 0; i < n; i++) {
      const z = this.horde[i];
      // Seguimiento suave de su puesto en la formación.
      const target = this.slotOffset(i, n);
      z.off += clamp((target - z.off) * 5 * dt, -maxRel, maxRel);
      z.x = this.anchorX + z.off;
      z.lane = this.slotLane(i);
      z.laneY += (LANE_Y[z.lane] - z.laneY) * Math.min(1, dt * 6);
      z.age += dt;
      if (z.squash > 0) z.squash -= dt;
      z.phase = (z.phase + (dt * Math.max(this.speed, 120)) / 92) % 1;

      // Repite los saltos del líder al pasar por el mismo punto ("ola").
      for (const ev of this.events) {
        if (ev.x > z.x) break;
        if (ev.id <= z.lastEv) continue;
        z.lastEv = ev.id;
        if (this.canJump(z)) this.startJump(z, ev);
        else {
          z.pending = ev;
          z.pendingT = JUMP_BUFFER;
        }
      }
      if (z.pending) {
        z.pendingT -= dt;
        if (z.grounded) this.startJump(z, z.pending);
        else if (z.pendingT <= 0) z.pending = null;
      }

      // Física vertical.
      if (!z.grounded) {
        const prevY = z.y;
        const holding = z.jump !== null && z.vy < 0 && z.holdT < MAX_HOLD
          && (!z.jump.released || z.holdT < z.jump.hold);
        z.vy += GRAVITY * (holding ? HOLD_GRAVITY : 1) * dt;
        z.y += z.vy * dt;
        if (z.jump) z.holdT += dt;
        if (z.coyote > 0) z.coyote -= dt;
        if (z.vy >= 0) {
          const s = this.landingSurface(z.x, prevY, z.y);
          if (s !== null) {
            z.y = s;
            z.vy = 0;
            z.grounded = true;
            z.jump = null;
            z.squash = 0.12;
            if (i === 0 && this.state === 'running') this.dust(z.x, z.y, 4);
          }
        }
        if (z.y > PIT_DOOM_Y && this.state === 'running') this.lose(z, 'fall');
      } else if (!this.supported(z.x, z.y)) {
        z.grounded = false;
        z.coyote = COYOTE_TIME;
        z.vy = 0;
      }
    }
  }

  /** Superficie (la más alta) que el zombi cruza al caer de prevY a y. */
  private landingSurface(x: number, prevY: number, y: number): number | null {
    let best: number | null = null;
    const consider = (s: number) => {
      if (s >= prevY - 0.5 && s <= y && (best === null || s < best)) best = s;
    };
    if (this.onGround(x)) consider(0);
    for (const p of this.platforms) if (x >= p.x0 - EDGE_TOLERANCE && x <= p.x1 + EDGE_TOLERANCE) consider(p.y);
    for (const v of this.vehicles) if (!v.smashed && x >= v.x && x <= v.x + v.w) consider(-v.h);
    return best;
  }

  private supported(x: number, y: number): boolean {
    if (Math.abs(y) < 0.5 && this.onGround(x)) return true;
    for (const p of this.platforms) {
      if (Math.abs(y - p.y) < 0.5 && x >= p.x0 - EDGE_TOLERANCE && x <= p.x1 + EDGE_TOLERANCE) return true;
    }
    for (const v of this.vehicles) {
      if (!v.smashed && Math.abs(y + v.h) < 0.5 && x >= v.x - 2 && x <= v.x + v.w + 2) return true;
    }
    return false;
  }

  onGround(x: number): boolean {
    for (const s of this.ground) if (x >= s.x0 - EDGE_TOLERANCE && x <= s.x1 + EDGE_TOLERANCE) return true;
    return false;
  }

  // ------------------------------------------------------------------ Pérdidas

  private readonly dead = new Set<Zombie>();

  private lose(z: Zombie, cause: LossCause, fromX = z.x) {
    if (this.dead.has(z)) return;
    this.dead.add(z);
    const r = this.rng;
    const c: Corpse = {
      look: z.look, x: z.x, y: z.y, vx: 0, vy: 0, rot: 0, vr: 0, life: 0, lane: z.lane, inPit: cause === 'fall',
    };
    if (cause === 'fall') {
      c.vx = this.speed * 0.3;
      c.vy = Math.max(z.vy, 60);
      c.vr = (r() - 0.5) * 3;
    } else if (cause === 'blast') {
      c.vx = (z.x - fromX) * 5 + (r() - 0.5) * 120;
      c.vy = -520 - r() * 320;
      c.vr = (r() - 0.5) * 16;
    } else {
      c.vx = -160 - r() * 120;
      c.vy = -260 - r() * 160;
      c.vr = -6 - r() * 6;
    }
    this.corpses.push(c);
    this.goo(z.x, z.y - 20, cause === 'fall' ? 4 : 10);
    this.lost++;
    this.lostX = z.x;
  }

  private flushLosses() {
    if (!this.dead.size) return;
    for (let i = this.horde.length - 1; i >= 0; i--) if (this.dead.has(this.horde[i])) this.horde.splice(i, 1);
    this.dead.clear();
    if (this.lost > 0) {
      this.texts.push({ x: this.lostX, y: -70, text: `-${this.lost}`, color: '#ff4d5e', life: 0, size: 26 });
      this.sounds.push('hit');
      this.hurt = 1;
      this.shake = Math.max(this.shake, 0.22);
      this.lost = 0;
    }
    if (this.horde.length === 0 && this.state === 'running') {
      this.state = 'dying';
      this.power = null;
      this.dyingT = 0;
      this.sounds.push('over');
      this.release();
    }
  }

  // ------------------------------------------------------------------ Perritos de la calle

  private updatePeds(dt: number) {
    const lx = this.leader?.x ?? this.anchorX;
    const magnet = this.power?.kind === 'magnet';
    for (const p of this.peds) {
      const ahead = p.x - lx;
      if (!p.panic && ahead < 420) p.panic = true;
      let vx = p.panic ? p.run : Math.sin(this.time * 0.8 + p.id) * 22;
      if (magnet && ahead > -20 && ahead < 300) vx = -190;
      p.x = clamp(p.x + vx * dt, p.minX, p.maxX);
      p.vx = vx;
      p.phase = (p.phase + dt * (p.panic ? 2.6 : 1.2)) % 1;
    }
  }

  private collidePeds() {
    if (!this.horde.length) return;
    const lx = this.horde[0].x;
    const back = this.horde[this.horde.length - 1].x;
    const giant = this.isGiant();
    for (let k = this.peds.length - 1; k >= 0; k--) {
      const p = this.peds[k];
      if (p.x > lx + 60 || p.x < back - 40) continue;
      for (let i = 0; i < this.horde.length; i++) {
        const z = this.horde[i];
        // Hay que tocarlo casi a su altura: si la jauría lo salta, se escapa.
        const reach = 13 + (giant && i === 0 ? 30 : 0);
        const reachY = 24 + (giant && i === 0 ? 50 : 0);
        if (Math.abs(z.x - p.x) < reach && Math.abs(z.y - p.y) < reachY) {
          this.peds.splice(k, 1);
          this.convert(p);
          break;
        }
      }
    }
  }

  private convert(p: Pedestrian) {
    this.stats.converted++;
    const z = this.addZombie(p.look, p.x, p.y);
    if (z) {
      z.lane = p.lane;
      z.laneY = LANE_Y[p.lane];
      this.texts.push({ x: p.x, y: p.y - 60, text: '+1', color: '#9dff6a', life: 0, size: 22 });
    } else {
      // Jauría llena: el perrito se convierte en gemas.
      this.stats.gems += 2;
      this.texts.push({ x: p.x, y: p.y - 60, text: '+2 gemas', color: '#7ef0c4', life: 0, size: 18 });
    }
    this.goo(p.x, p.y - 22, 14, '#9dff6a');
    this.ring(p.x, p.y - 22, '#b8ff8a');
    this.sounds.push('convert');
  }

  // ------------------------------------------------------------------ Vehículos y bombas

  private updateVehicles(dt: number) {
    this.incoming = null;
    const right = this.camX + this.viewW;
    for (const v of this.vehicles) {
      if (v.smashed) {
        v.smashT += dt;
        continue;
      }
      if (v.vx < 0 && v.x - this.anchorX < this.viewW * 1.15) {
        v.x = Math.max(v.minX, v.x + v.vx * dt);
        if (v.x <= v.minX) v.vx = 0;
        if (v.x > right - 40 && v.vx < 0) {
          this.incoming = v;
          if (this.warnedId !== v.id) {
            this.warnedId = v.id;
            this.sounds.push('warn');
          }
        }
      }
    }
  }

  private collideVehicles() {
    const n = this.horde.length;
    if (!n) return;
    const front = this.horde[0].x;
    const back = this.horde[n - 1].x;
    for (const v of this.vehicles) {
      if (v.smashed || v.x > front + ZOMBIE_HALF_W + 4 || v.x + v.w < back - ZOMBIE_HALF_W) continue;
      for (const z of this.horde) {
        if (this.dead.has(z)) continue;
        const overlapX = z.x + ZOMBIE_HALF_W > v.x && z.x - ZOMBIE_HALF_W < v.x + v.w;
        const overlapY = z.y > -v.h + 6 && z.y - ZOMBIE_H < 0;
        if (!overlapX || !overlapY) continue;
        if (this.horde.length >= v.req || this.isGiant()) {
          this.smash(v);
          break;
        }
        if (this.power?.kind === 'shield') {
          this.useShield(v.x, -v.h / 2);
          this.smash(v);
          break;
        }
        // Sin zombis suficientes: los que chocan de frente se pierden.
        this.lose(z, 'crash');
      }
    }
  }

  private smash(v: Vehicle) {
    const spec = VEHICLES[v.kind];
    v.smashed = true;
    v.smashT = 0;
    this.stats.vehiclesSmashed++;
    this.stats.gems += spec.gems;
    this.texts.push({ x: v.x + v.w / 2, y: -v.h - 40, text: `¡Aplastado! +${spec.gems}`, color: '#ffd84d', life: 0, size: 22 });
    for (let i = 0; i < spec.riders; i++) {
      const look = Math.floor(this.rng() * PED_LOOKS.length);
      if (this.addZombie(look, v.x + 30 + i * 30, 0)) this.stats.converted++;
    }
    const r = this.rng;
    for (let i = 0; i < 18; i++) {
      this.particles.push({
        x: v.x + r() * v.w, y: -r() * v.h, vx: (r() - 0.3) * 420, vy: -200 - r() * 420,
        life: 0, max: 0.9 + r() * 0.5, size: 4 + r() * 6, color: ['#ffd84d', '#ff8a3d', '#5a5f6e', '#c9d1db'][i % 4], gravity: 1400, kind: 'spark',
      });
    }
    this.smoke(v.x + v.w / 2, -v.h / 2, 8);
    this.shake = Math.max(this.shake, 0.3);
    this.sounds.push('smash');
  }

  private collideBombs() {
    for (const b of this.bombs) {
      if (b.exploded) continue;
      for (const z of this.horde) {
        if (Math.abs(z.x - b.x) < BOMB_RADIUS + ZOMBIE_HALF_W && z.y > b.y - BOMB_RADIUS * 2) {
          this.explode(b);
          break;
        }
      }
    }
  }

  private explode(b: Bomb) {
    b.exploded = true;
    this.sounds.push('explode');
    this.shake = Math.max(this.shake, 0.4);
    const r = this.rng;
    for (let i = 0; i < 22; i++) {
      const a = r() * Math.PI * 2;
      const s = 120 + r() * 380;
      this.particles.push({
        x: b.x, y: b.y - 14, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 200, life: 0, max: 0.5 + r() * 0.4,
        size: 5 + r() * 7, color: ['#ffd84d', '#ff8a3d', '#ff4d5e'][i % 3], gravity: 600, kind: 'spark',
      });
    }
    this.smoke(b.x, b.y - 20, 6);
    this.ring(b.x, b.y - 14, '#ffb347', 2.2);
    if (this.isGiant()) {
      this.texts.push({ x: b.x, y: -80, text: '¡Pisotón!', color: '#ffb347', life: 0, size: 20 });
      return;
    }
    if (this.power?.kind === 'shield') {
      this.useShield(b.x, -20);
      return;
    }
    for (const z of this.horde) {
      if (Math.abs(z.x - b.x) < BLAST_RADIUS_X && z.y > -90) this.lose(z, 'blast', b.x);
    }
  }

  private useShield(x: number, y: number) {
    this.power = null;
    this.texts.push({ x, y: y - 40, text: '¡Escudo!', color: '#d6b8ff', life: 0, size: 22 });
    this.ring(x, y, '#b48cff', 2.5);
    this.sounds.push('shield');
  }

  // ------------------------------------------------------------------ Gemas y potenciadores

  private collectGems(dt: number) {
    const n = this.horde.length;
    if (!n) return;
    const lead = this.horde[0];
    const front = lead.x + 20;
    const back = this.horde[n - 1].x - 20;
    const magnet = this.power?.kind === 'magnet';
    for (const g of this.gems) {
      if (g.taken) continue;
      if (magnet && g.x - lead.x < 340 && g.x > back - 60) g.pulled = true;
      if (g.pulled) {
        const dx = lead.x - g.x;
        const dy = lead.y - 24 - g.y;
        const dist = Math.hypot(dx, dy) || 1;
        const step = Math.min(dist, 950 * dt);
        g.x += (dx / dist) * step + this.speed * dt;
        g.y += (dy / dist) * step;
      }
      if (g.x > front + 10 || g.x < back) continue;
      for (const z of this.horde) {
        if (Math.abs(z.x - g.x) < 18 && Math.abs(z.y - 22 - g.y) < 30) {
          g.taken = true;
          this.stats.gems++;
          this.sounds.push('gem');
          this.particles.push({ x: g.x, y: g.y, vx: 0, vy: -60, life: 0, max: 0.4, size: 10, color: '#7ef0c4', gravity: 0, kind: 'gem' });
          break;
        }
      }
    }
  }

  private collectCrates() {
    for (const c of this.crates) {
      if (c.taken) continue;
      for (const z of this.horde) {
        if (Math.abs(z.x - c.x) < 28 && z.y - ZOMBIE_H < c.y + 18 && z.y > c.y - 18) {
          c.taken = true;
          this.activate(this.randomPower());
          this.ring(c.x, c.y, '#ffffff', 2);
          break;
        }
      }
    }
  }

  private randomPower(): PowerKind {
    const small = this.horde.length < 10;
    const table: [PowerKind, number][] = [['clone', small ? 2 : 1], ['giant', 2], ['magnet', 2], ['shield', 2]];
    const total = table.reduce((s, [, w]) => s + w, 0);
    let r = this.rng() * total;
    for (const [k, w] of table) {
      r -= w;
      if (r <= 0) return k;
    }
    return 'clone';
  }

  /** Activa un potenciador (público para pruebas). */
  activate(kind: PowerKind) {
    const spec = POWERS[kind];
    this.stats.powerups++;
    this.sounds.push('power');
    this.banner = { title: spec.label, sub: spec.hint, color: spec.color, t: 0 };
    if (kind === 'clone') {
      const lead = this.horde[0];
      for (let i = 0; i < CLONE_AMOUNT; i++) {
        const look = Math.floor(this.rng() * PED_LOOKS.length);
        const z = this.addZombie(look, (lead?.x ?? this.anchorX) - 10 - i * 8, lead?.y ?? 0, 1 + i);
        if (!z) continue;
        if (lead) {
          // Los clones copian el estado del líder (si está saltando, saltan con él).
          Object.assign(z, { y: lead.y, vy: lead.vy, grounded: lead.grounded, jump: lead.jump, holdT: lead.holdT, lastEv: lead.lastEv });
        }
        this.goo(z.x, z.y - 20, 6, '#7be36a');
      }
      return;
    }
    this.power = { kind, t: spec.duration, max: spec.duration };
  }

  private updatePower(dt: number) {
    if (!this.power) return;
    this.power.t -= dt;
    if (this.power.t <= 0) this.power = null;
  }

  // ------------------------------------------------------------------ Hitos

  private checkMilestones() {
    const d = this.stats.distance;
    if (!this.recordAnnounced && this.bestDistance > 0 && d > this.bestDistance) {
      this.recordAnnounced = true;
      this.banner = { title: '¡Nuevo récord!', sub: `Superaste ${this.bestDistance} m`, color: '#ffd84d', t: 0 };
      this.sounds.push('record');
    }
    const b = this.biomeIndex;
    if (b !== this.biome) {
      this.biome = b;
      this.banner = { title: BIOME_NAMES[b % BIOME_NAMES.length], sub: `${b * BIOME_EVERY_M} m`, color: '#ffffff', t: 0 };
    }
  }

  // ------------------------------------------------------------------ Efectos

  private dust(x: number, y: number, n: number) {
    const r = this.rng;
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + (r() - 0.5) * 16, y, vx: -60 - r() * 80, vy: -40 - r() * 60, life: 0, max: 0.35,
        size: 3 + r() * 3, color: 'rgba(255,255,255,0.8)', gravity: 0, kind: 'dot',
      });
    }
  }

  private goo(x: number, y: number, n: number, color = '#7ed957') {
    const r = this.rng;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const s = 80 + r() * 220;
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 150, life: 0, max: 0.5 + r() * 0.4,
        size: 3 + r() * 4, color, gravity: 900, kind: 'dot',
      });
    }
  }

  private ring(x: number, y: number, color: string, size = 1.4) {
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.45, size: 28 * size, color, gravity: 0, kind: 'ring' });
  }

  private smoke(x: number, y: number, n: number) {
    const r = this.rng;
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + (r() - 0.5) * 40, y: y + (r() - 0.5) * 20, vx: (r() - 0.5) * 60, vy: -40 - r() * 60,
        life: 0, max: 1 + r() * 0.6, size: 14 + r() * 14, color: 'rgba(90,90,100,0.45)', gravity: -20, kind: 'smoke',
      });
    }
  }

  private updateEffects(dt: number) {
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    if (this.hurt > 0) this.hurt = Math.max(0, this.hurt - dt * 2.5);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > 2.4) this.banner = null;
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt + (p.kind === 'gem' ? this.speed * dt : 0);
      p.y += p.vy * dt;
      if (p.life >= p.max) this.particles.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life += dt;
      t.y -= 50 * dt;
      t.x += this.speed * dt * 0.85;
      if (t.life > 1.1) this.texts.splice(i, 1);
    }
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const c = this.corpses[i];
      c.life += dt;
      c.vy += GRAVITY * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
      if (!c.inPit && c.y >= 0 && c.vy > 0 && this.onGround(c.x)) {
        c.y = 0;
        c.vy = -c.vy * 0.25;
        c.vx *= 0.4;
        c.vr *= 0.4;
      }
      if (c.life > 1.6 || c.y > 700) this.corpses.splice(i, 1);
    }
  }

  // ------------------------------------------------------------------ Limpieza

  private prune() {
    const minX = this.camX - 400;
    const keep = <T>(arr: T[], right: (t: T) => number) => {
      let w = 0;
      for (let i = 0; i < arr.length; i++) if (right(arr[i]) >= minX) arr[w++] = arr[i];
      arr.length = w;
    };
    keep(this.peds, (p) => p.x);
    keep(this.vehicles, (v) => v.x + v.w);
    keep(this.bombs, (b) => b.x);
    keep(this.gems, (g) => (g.taken ? -Infinity : g.x));
    keep(this.crates, (c) => (c.taken ? -Infinity : c.x));
    keep(this.platforms, (p) => p.x1);
    if (this.ground.length > 1) keep(this.ground, (s) => s.x1 + 200);
    const backX = this.horde.length ? this.horde[this.horde.length - 1].x - 60 : this.anchorX;
    let drop = 0;
    while (drop < this.events.length && this.events[drop].x < backX - 400) drop++;
    if (drop) this.events.splice(0, drop);
  }
}
