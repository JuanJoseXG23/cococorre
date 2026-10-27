// Pruebas de la simulación de Zombie Rush (sin navegador).
// Ejecutar:  npm run test:zombie
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/games/zombie-rush/engine/world';
import { HORDE_MAX, STEP, POWERS, VEHICLES } from '../src/games/zombie-rush/engine/constants';
import { jumpRange, speedAt } from '../src/games/zombie-rush/engine/physics';

/** Piloto automático sencillo: salta ante bordes, bombas y vehículos que no puede aplastar. */
function makeBot() {
  let holdLeft = 0;
  return (w: World) => {
    if (holdLeft > 0) {
      holdLeft -= STEP;
      if (holdLeft <= 0) w.release();
      return;
    }
    const lead = w.leader;
    if (!lead || !lead.grounded) return;
    const look = w.speed * 0.11 + 22;
    let jump: 'tap' | 'hold' | null = null;
    if (Math.abs(lead.y) < 0.5) {
      const seg = w.ground.find((s) => lead.x >= s.x0 - 6 && lead.x <= s.x1 + 6);
      if (seg && seg.x1 - lead.x < look) jump = 'hold';
    }
    for (const p of w.platforms) {
      if (Math.abs(lead.y - p.y) < 0.5 && lead.x <= p.x1 + 6 && p.x1 - lead.x < look) jump = 'hold';
    }
    for (const b of w.bombs) {
      if (!b.exploded && b.x > lead.x && b.x - 16 - lead.x < look + 8) jump = jump ?? 'tap';
    }
    for (const v of w.vehicles) {
      const closing = v.vx < 0 ? -v.vx * 0.13 : 0;
      if (!v.smashed && w.horde.length < v.req && v.x > lead.x && v.x - lead.x < look + closing) jump = 'hold';
    }
    if (jump) {
      w.press();
      holdLeft = jump === 'hold' ? 0.3 : 0.04;
    }
  };
}

function run(seed: number, seconds: number, pilot?: (w: World) => void) {
  const w = new World({ seed });
  w.setViewWidth(960);
  const steps = Math.round(seconds / STEP);
  let maxSeen = 0;
  for (let i = 0; i < steps && w.state !== 'over'; i++) {
    pilot?.(w);
    w.step(STEP);
    maxSeen = Math.max(maxSeen, w.horde.length);
    for (const z of w.horde) {
      if (!Number.isFinite(z.x) || !Number.isFinite(z.y)) throw new Error(`posición inválida en el paso ${i}`);
    }
  }
  return { w, maxSeen };
}

test('con piloto automático la horda crece y recorre una buena distancia', () => {
  const results = [11, 22, 33, 44, 55].map((seed) => run(seed, 150, makeBot()));
  for (const { w, maxSeen } of results) {
    assert.ok(maxSeen <= HORDE_MAX, 'nunca supera el máximo de la horda');
    assert.equal(w.stats.maxHorde, maxSeen, 'maxHorde coincide con lo visto');
  }
  const avgDist = results.reduce((s, r) => s + r.w.stats.distance, 0) / results.length;
  const avgHorde = results.reduce((s, r) => s + r.w.stats.maxHorde, 0) / results.length;
  console.log('distancias:', results.map((r) => `${r.w.stats.distance}m/${r.w.stats.maxHorde}z/${r.w.state}`).join(' '));
  assert.ok(avgDist > 600, `distancia media ${avgDist}`);
  assert.ok(avgHorde >= 10, `horda máxima media ${avgHorde}`);
  for (const { w } of results) {
    assert.ok(w.stats.converted >= w.stats.maxHorde - 1 - w.stats.powerups * 5, 'los zombis vienen de conversiones o clones');
  }
});

test('sin tocar nada, la partida termina (y la distancia es real)', () => {
  const { w } = run(7, 240);
  assert.equal(w.state, 'over');
  assert.equal(w.horde.length, 0);
  assert.ok(w.stats.distance > 20 && w.stats.distance < 2000, `distancia ${w.stats.distance}`);
  const r = w.result();
  assert.ok(r.durationMs > 1000);
  // Coherente con las reglas de Firestore: >= 40 ms por metro.
  assert.ok(r.durationMs >= r.distance * 40);
});

test('la simulación es determinista con la misma semilla', () => {
  const a = run(99, 60, makeBot()).w.result();
  const b = run(99, 60, makeBot()).w.result();
  assert.deepEqual(a, b);
});

test('los seguidores repiten el salto del líder al pasar por el mismo punto', () => {
  const w = new World({ seed: 5 });
  w.activate('clone');
  for (let i = 0; i < 120; i++) w.step(STEP); // se acomodan en la formación
  assert.ok(w.horde.length >= 5);
  const lead = w.horde[0];
  const last = w.horde[w.horde.length - 1];
  const gap = lead.x - last.x;
  w.press();
  w.step(STEP);
  w.release();
  assert.ok(lead.y < 0 && !lead.grounded, 'el líder salta');
  assert.ok(last.grounded, 'el último aún no salta');
  // Tiempo que tarda el último en llegar al punto del salto.
  const t = gap / w.speed;
  for (let i = 0; i < Math.ceil((t + 0.05) / STEP); i++) w.step(STEP);
  assert.ok(!last.grounded && last.vy !== 0, 'el último saltó al pasar por el mismo punto');
});

test('mantener pulsado salta más alto que un toque', () => {
  const peak = (holdSteps: number) => {
    const w = new World({ seed: 3 });
    w.press();
    let min = 0;
    for (let i = 0; i < 120; i++) {
      if (i === holdSteps) w.release();
      w.step(STEP);
      min = Math.min(min, w.horde[0]?.y ?? 0);
    }
    return -min;
  };
  const tap = peak(1);
  const hold = peak(60);
  assert.ok(hold > tap + 60, `toque ${tap.toFixed(0)} vs largo ${hold.toFixed(0)}`);
});

test('no hay doble salto: pulsar en el aire no vuelve a impulsar', () => {
  const w = new World({ seed: 3 });
  w.press();
  w.release();
  for (let i = 0; i < 20; i++) w.step(STEP);
  const vy = w.horde[0].vy;
  w.press();
  w.step(STEP);
  assert.ok(w.horde[0].vy >= vy, 'no se reinicia la velocidad en el aire');
});

test('vehículo: se aplasta con zombis suficientes; si no, los que chocan se pierden', () => {
  const w = new World({ seed: 8 });
  const lead = w.horde[0];
  w.vehicles.push({ id: 9001, kind: 'car', x: lead.x + 60, w: 120, h: 60, req: 99, vx: 0, minX: 0, smashed: false, smashT: 0, color: 0 });
  for (let i = 0; i < 60 && w.state === 'running'; i++) w.step(STEP);
  assert.equal(w.horde.length, 0, 'sin zombis suficientes, la horda de 1 se pierde');
  assert.notEqual(w.state, 'running');

  const w2 = new World({ seed: 8 });
  w2.activate('clone');
  for (let i = 0; i < 30; i++) w2.step(STEP);
  const before = w2.horde.length;
  const l2 = w2.horde[0];
  w2.vehicles.push({ id: 9002, kind: 'car', x: l2.x + 60, w: 120, h: 60, req: VEHICLES.car.req, vx: 0, minX: 0, smashed: false, smashT: 0, color: 0 });
  for (let i = 0; i < 60; i++) w2.step(STEP);
  assert.ok(w2.vehicles.find((v) => v.id === 9002)?.smashed, 'se aplasta');
  assert.ok(w2.horde.length >= before, 'no se pierde nadie');
  assert.equal(w2.stats.vehiclesSmashed, 1);
});

test('bomba: elimina a los zombis de su radio; el escudo la absorbe una vez', () => {
  const w = new World({ seed: 4 });
  w.bombs.push({ id: 9100, x: w.horde[0].x + 50, y: 0, exploded: false });
  for (let i = 0; i < 60 && w.state === 'running'; i++) w.step(STEP);
  assert.equal(w.horde.length, 0);

  const w2 = new World({ seed: 4 });
  w2.activate('shield');
  w2.bombs.push({ id: 9101, x: w2.horde[0].x + 50, y: 0, exploded: false });
  for (let i = 0; i < 60; i++) w2.step(STEP);
  assert.equal(w2.horde.length, 1, 'sobrevive gracias al escudo');
  assert.equal(w2.power, null, 'el escudo se gastó');
});

test('potenciadores: duran lo indicado y expiran; clonación suma 5', () => {
  const w = new World({ seed: 2 });
  const n = w.horde.length;
  w.activate('clone');
  assert.equal(w.horde.length, n + 5);
  w.activate('magnet');
  assert.equal(w.power?.kind, 'magnet');
  for (let i = 0; i < Math.round((POWERS.magnet.duration - 0.5) / STEP); i++) w.step(STEP);
  assert.equal(w.power?.kind, 'magnet', 'sigue activo antes de tiempo');
  for (let i = 0; i < Math.round(1 / STEP); i++) w.step(STEP);
  assert.equal(w.power, null, 'expiró');
});

test('el generador nunca crea huecos imposibles ni peligros pegados', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const w = new World({ seed });
    w.setViewWidth(4000 * 30); // genera ~4 km de ciudad de una vez
    w.step(STEP);
    const g = w.ground;
    for (let i = 1; i < g.length; i++) {
      const x0 = g[i - 1].x1;
      const gapW = g[i].x0 - x0;
      const covered = w.platforms.some((p) => p.x0 < g[i].x0 && p.x1 > x0);
      if (covered) continue; // hueco con plataformas encima: se cruza por arriba
      const maxW = jumpRange(speedAt(x0 / 30), true) - 40;
      assert.ok(gapW <= maxW, `semilla ${seed}: hueco de ${gapW.toFixed(0)} > ${maxW.toFixed(0)} en x=${x0.toFixed(0)}`);
    }
    // Ninguna bomba ni vehículo cerca del borde de un hueco.
    const nearEdge = (x: number, margin: number) => g.some((s, i) => i > 0 && (Math.abs(x - s.x0) < margin || Math.abs(x - g[i - 1].x1) < margin));
    for (const b of w.bombs) assert.ok(!nearEdge(b.x, 150), `semilla ${seed}: bomba pegada a un hueco en ${b.x}`);
    for (const v of w.vehicles) {
      if (v.vx === 0) assert.ok(!nearEdge(v.x, 150) && !nearEdge(v.x + v.w, 150), `semilla ${seed}: vehículo pegado a un hueco`);
    }
  }
});
