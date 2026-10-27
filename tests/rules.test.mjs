// Pruebas de las reglas de seguridad de Firestore (intentos de trampa + casos válidos,
// incluidas las estadísticas de Jockombi).
// Ejecutar (requiere Java 21+):
//   npm i -D firebase-tools @firebase/rules-unit-testing
//   npx firebase emulators:exec --only firestore --project demo-cococorre "node --test tests/rules.test.mjs"

import { test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, collection, getDocs, query, where,
} from 'firebase/firestore';

const RULES = process.env.RULES_PATH ?? 'firestore.rules';
let env;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function newUser(name) {
  return {
    username: name, usernameLower: name.toLowerCase(), points: 0, highScore: 0, gamesPlayed: 0,
    lastScore: 0, claimedCount: 0, lastClaim: null, maxOrder: 0, createdAt: serverTimestamp(), lastGameAt: serverTimestamp(),
  };
}
const ctx = (uid, name) => env.authenticatedContext(uid, { email: `${name.toLowerCase()}@cococorre.app` }).firestore();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cococorre',
    firestore: { rules: readFileSync(RULES, 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'admins/boss'), { note: 'admin' });
    await setDoc(doc(db, 'rewards/beso'), {
      name: 'Un beso', description: '', cost: 100, difficulty: 'facil', image: '💋', active: true, order: 2,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'rewards/abrazo'), {
      name: 'Un abrazo', description: '', cost: 10, difficulty: 'facil', image: '🤗', active: true, order: 1,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'rewards/dulce'), {
      name: 'Un dulce', description: '', cost: 20, difficulty: 'facil', image: '🍬', active: true, order: 3,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'rewards/off'), {
      name: 'Inactiva', description: '', cost: 1, difficulty: 'facil', image: 'x', active: false, order: 9,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  });
});
after(async () => { await env?.cleanup(); });

test('registro: perfil válido OK, perfil con puntos inventados FALLA', async () => {
  const db = ctx('mari', 'Mari');
  await assertFails(setDoc(doc(db, 'users/mari'), { ...newUser('Mari'), points: 999999 }));
  await assertFails(setDoc(doc(db, 'users/mari'), newUser('Otra'))); // usuario no coincide con el correo
  await assertFails(setDoc(doc(db, 'users/mari'), { ...newUser('Mari'), isAdmin: true }));
  await assertSucceeds(setDoc(doc(db, 'users/mari'), newUser('Mari')));
  await assertSucceeds(setDoc(doc(ctx('bob', 'bob'), 'users/bob'), newUser('bob')));
});

test('no se puede modificar el saldo directamente', async () => {
  const db = ctx('mari', 'Mari');
  await assertFails(updateDoc(doc(db, 'users/mari'), { points: 999999 }));
  await assertFails(updateDoc(doc(db, 'users/mari'), { highScore: 500 }));
  await assertFails(deleteDoc(doc(db, 'users/mari')));
});

test('no se pueden leer ni modificar otros usuarios', async () => {
  const db = ctx('mari', 'Mari');
  await assertFails(getDoc(doc(db, 'users/bob')));
  await assertFails(updateDoc(doc(db, 'users/bob'), { points: 0 }));
  await assertSucceeds(getDoc(doc(db, 'users/mari')));
  await assertFails(getDocs(collection(db, 'users')));
});

function gameBatch(db, uid, name, prev, score, overrides = {}) {
  const b = writeBatch(db);
  const n = prev.gamesPlayed + 1;
  b.update(doc(db, `users/${uid}`), {
    points: prev.points + score, highScore: Math.max(prev.highScore, score), gamesPlayed: n,
    lastScore: score, lastGameAt: serverTimestamp(), ...overrides,
  });
  b.set(doc(db, `games/${uid}_${n}`), { userId: uid, username: name, score, playedAt: serverTimestamp() });
  return b.commit();
}

test('fin de partida: puntuación imposible para el tiempo transcurrido FALLA', async () => {
  const db = ctx('mari', 'Mari');
  const prev = { points: 0, highScore: 0, gamesPlayed: 0 };
  await assertFails(gameBatch(db, 'mari', 'Mari', prev, 5000)); // 5000 puntos en < 300 s
  await assertFails(gameBatch(db, 'mari', 'Mari', prev, 6000)); // por encima del tope
});

test('fin de partida: suma inflada FALLA, partida legítima OK', async () => {
  await sleep(1300);
  const db = ctx('mari', 'Mari');
  const prev = { points: 0, highScore: 0, gamesPlayed: 0 };
  await assertFails(gameBatch(db, 'mari', 'Mari', prev, 10, { points: 500 }));
  await assertFails(gameBatch(db, 'mari', 'Mari', prev, 10, { gamesPlayed: 5 }));
  // sin registro en /games
  await assertFails(updateDoc(doc(db, 'users/mari'), {
    points: 10, highScore: 10, gamesPlayed: 1, lastScore: 10, lastGameAt: serverTimestamp(),
  }));
  await assertSucceeds(gameBatch(db, 'mari', 'Mari', prev, 10));
  const snap = await getDoc(doc(db, 'users/mari'));
  if (snap.data().points !== 10) throw new Error('saldo esperado 10');
});

const ORDERS = { abrazo: 1, beso: 2, dulce: 3, off: 9 };
function claimBatch(db, uid, name, prevPoints, prevCount, rewardId, cost, opts = {}) {
  const b = writeBatch(db);
  b.update(doc(db, `users/${uid}`), {
    points: prevPoints - (opts.subtract ?? cost), claimedCount: prevCount + 1, lastClaim: rewardId,
    maxOrder: opts.maxOrder ?? ORDERS[rewardId],
  });
  if (!opts.skipClaim) {
    b.set(doc(db, `claims/${uid}_${rewardId}`), {
      userId: uid, username: name, rewardId, rewardName: opts.rewardName ?? 'Un beso',
      cost: opts.claimCost ?? cost, claimedAt: serverTimestamp(),
    });
  }
  return b.commit();
}

test('reclamar sin saldo suficiente FALLA', async () => {
  const db = ctx('mari', 'Mari');
  await assertFails(claimBatch(db, 'mari', 'Mari', 10, 0, 'beso', 100));
});

test('administrador regala puntos; usuario normal no puede', async () => {
  await assertFails(updateDoc(doc(ctx('bob', 'bob'), 'users/mari'), { points: 350 }));
  await assertSucceeds(updateDoc(doc(ctx('boss', 'boss'), 'users/mari'), { points: 350 }));
});

test('reclamar con costo manipulado FALLA', async () => {
  const db = ctx('mari', 'Mari');
  await assertFails(claimBatch(db, 'mari', 'Mari', 350, 0, 'beso', 100, { subtract: 1, claimCost: 1 }));
  await assertFails(claimBatch(db, 'mari', 'Mari', 350, 0, 'beso', 100, { subtract: 1 }));
  await assertFails(claimBatch(db, 'mari', 'Mari', 350, 0, 'beso', 100, { skipClaim: true }));
  await assertFails(claimBatch(db, 'mari', 'Mari', 350, 0, 'off', 1, { rewardName: 'Inactiva' }));
});

test('reclamar legítimo OK y una segunda vez FALLA', async () => {
  const db = ctx('mari', 'Mari');
  await assertSucceeds(claimBatch(db, 'mari', 'Mari', 350, 0, 'beso', 100));
  const snap = await getDoc(doc(db, 'users/mari'));
  if (snap.data().points !== 250) throw new Error('saldo esperado 250');
  await assertFails(claimBatch(db, 'mari', 'Mari', 250, 1, 'beso', 100));
  // ni siquiera reescribiendo la reclamación directamente
  await assertFails(setDoc(doc(db, 'claims/mari_beso'), {
    userId: 'mari', username: 'Mari', rewardId: 'beso', rewardName: 'Un beso', cost: 100, claimedAt: serverTimestamp(),
  }));
});

test('reclamaciones: inmutables y privadas', async () => {
  const db = ctx('mari', 'Mari');
  await assertFails(updateDoc(doc(db, 'claims/mari_beso'), { cost: 0 }));
  await assertFails(deleteDoc(doc(db, 'claims/mari_beso')));
  await assertSucceeds(getDocs(query(collection(db, 'claims'), where('userId', '==', 'mari'))));
  await assertFails(getDocs(collection(ctx('bob', 'bob'), 'claims')));
  await assertFails(getDoc(doc(ctx('bob', 'bob'), 'claims/mari_beso')));
  await assertSucceeds(getDocs(collection(ctx('boss', 'boss'), 'claims')));
});

test('recompensas: sólo el admin las edita', async () => {
  const user = ctx('mari', 'Mari');
  await assertSucceeds(getDoc(doc(user, 'rewards/beso')));
  await assertFails(updateDoc(doc(user, 'rewards/beso'), { cost: 0 }));
  await assertFails(setDoc(doc(user, 'rewards/nuevo'), {
    name: 'x', description: '', cost: 1, difficulty: 'facil', image: 'x', active: true, order: 9,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
  const admin = ctx('boss', 'boss');
  await assertSucceeds(updateDoc(doc(admin, 'rewards/beso'), { cost: 120, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(admin, 'rewards/beso'), { cost: -5 }));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'rewards/beso')));
});

test('nadie puede hacerse administrador desde el navegador', async () => {
  await assertFails(setDoc(doc(ctx('mari', 'Mari'), 'admins/mari'), { x: 1 }));
  await assertSucceeds(getDoc(doc(ctx('mari', 'Mari'), 'admins/mari')));
  await assertFails(getDoc(doc(ctx('mari', 'Mari'), 'admins/boss')));
  await assertFails(setDoc(doc(ctx('mari', 'Mari'), 'config/game'), { speedMultiplier: 0.1 }));
  await assertSucceeds(setDoc(doc(ctx('boss', 'boss'), 'config/game'), { speedMultiplier: 1 }));
});

test('ranking: sólo se puede publicar el récord real', async () => {
  const db = ctx('mari', 'Mari');
  const lb = (data) => setDoc(doc(db, 'leaderboard/mari'), { updatedAt: serverTimestamp(), ...data });
  const real = (await getDoc(doc(db, 'users/mari'))).data();
  await assertFails(lb({ username: 'Mari', highScore: 99999, gamesPlayed: real.gamesPlayed }));
  await assertFails(lb({ username: 'Otra', highScore: real.highScore, gamesPlayed: real.gamesPlayed }));
  await assertFails(lb({ username: 'Mari', highScore: real.highScore, gamesPlayed: real.gamesPlayed, extra: 1 }));
  await assertSucceeds(lb({ username: 'Mari', highScore: real.highScore, gamesPlayed: real.gamesPlayed }));
  // nadie escribe la entrada de otra persona
  await assertFails(setDoc(doc(ctx('bob', 'bob'), 'leaderboard/mari'), {
    username: 'Mari', highScore: real.highScore, gamesPlayed: real.gamesPlayed, updatedAt: serverTimestamp(),
  }));
  // todas las jugadoras pueden ver el ranking; sin sesión, no
  await assertSucceeds(getDocs(collection(ctx('bob', 'bob'), 'leaderboard')));
  await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'leaderboard')));
});

test('ranking: se actualiza junto con la partida', async () => {
  await sleep(800);
  const db = ctx('bob', 'bob');
  const b = writeBatch(db);
  b.update(doc(db, 'users/bob'), { points: 7, highScore: 7, gamesPlayed: 1, lastScore: 7, lastGameAt: serverTimestamp() });
  b.set(doc(db, 'games/bob_1'), { userId: 'bob', username: 'bob', score: 7, playedAt: serverTimestamp() });
  b.set(doc(db, 'leaderboard/bob'), { username: 'bob', highScore: 7, gamesPlayed: 1, updatedAt: serverTimestamp() });
  await assertSucceeds(b.commit());
});

test('escalera: reclamar una bloquea las anteriores (y sólo se sube)', async () => {
  const db = ctx('mari', 'Mari');
  const u = (await getDoc(doc(db, 'users/mari'))).data(); // ya reclamó "beso" (escalón 2)
  if (u.maxOrder !== 2) throw new Error('maxOrder esperado 2');
  // "abrazo" (escalón 1) quedó bloqueado aunque alcancen los puntos
  await assertFails(claimBatch(db, 'mari', 'Mari', u.points, u.claimedCount, 'abrazo', 10, { rewardName: 'Un abrazo' }));
  // tampoco sirve mentir sobre maxOrder
  await assertFails(claimBatch(db, 'mari', 'Mari', u.points, u.claimedCount, 'abrazo', 10, { rewardName: 'Un abrazo', maxOrder: 5 }));
  // subir en la escalera sí se puede, pero maxOrder debe ser el real
  await assertFails(claimBatch(db, 'mari', 'Mari', u.points, u.claimedCount, 'dulce', 20, { rewardName: 'Un dulce', maxOrder: 1 }));
  await assertSucceeds(claimBatch(db, 'mari', 'Mari', u.points, u.claimedCount, 'dulce', 20, { rewardName: 'Un dulce' }));
  // y no se puede bajar maxOrder a mano para desbloquear
  await assertFails(updateDoc(doc(db, 'users/mari'), { maxOrder: 0 }));
});

test('registro: el perfil se puede crear con o sin maxOrder (pero siempre en 0)', async () => {
  const { maxOrder, ...withoutMaxOrder } = newUser('Nueva');
  await assertFails(setDoc(doc(ctx('nueva', 'Nueva'), 'users/nueva'), { ...withoutMaxOrder, maxOrder: 3 }));
  await assertSucceeds(setDoc(doc(ctx('nueva', 'Nueva'), 'users/nueva'), withoutMaxOrder));
  await assertSucceeds(setDoc(doc(ctx('otra', 'Otra'), 'users/otra'), newUser('Otra')));
});

test('corazones: sólo los posibles en la partida y una sola vez', async () => {
  const db = ctx('mari', 'Mari');
  const u = (await getDoc(doc(db, 'users/mari'))).data(); // última partida: 10 puntos
  if (u.lastScore !== 10) throw new Error('lastScore esperado 10');
  // 4 corazones = 12 puntos > 10: imposible
  await assertFails(updateDoc(doc(db, 'users/mari'), { heartsTotal: 4, heartsGame: u.gamesPlayed }));
  // marcar otra partida: no
  await assertFails(updateDoc(doc(db, 'users/mari'), { heartsTotal: 1, heartsGame: u.gamesPlayed + 1 }));
  // colar puntos junto con los corazones: no
  await assertFails(updateDoc(doc(db, 'users/mari'), { heartsTotal: 1, heartsGame: u.gamesPlayed, points: 99999 }));
  await assertSucceeds(updateDoc(doc(db, 'users/mari'), { heartsTotal: 3, heartsGame: u.gamesPlayed }));
  // la misma partida otra vez: no
  await assertFails(updateDoc(doc(db, 'users/mari'), { heartsTotal: 4, heartsGame: u.gamesPlayed }));
  // nunca se puede bajar ni tocar los de otra persona
  await assertFails(updateDoc(doc(ctx('bob', 'bob'), 'users/mari'), { heartsTotal: 100, heartsGame: 1 }));
});

// ---------------------------------------------------------------- Jockombi
const ZR = (uid) => `users/${uid}/gameStats/zombie-rush`;
const zrNew = () => ({
  bestDistance: 0, maxHorde: 0, totalConverted: 0, totalGems: 0, gamesPlayed: 0, lastDistance: 0, lastRunId: '',
  lastPlayedAt: serverTimestamp(), bestDistanceAt: null, maxHordeAt: null, createdAt: serverTimestamp(),
});
function zrBatch(db, uid, prev, run, runId, overrides = {}, runOverrides = {}) {
  const b = writeBatch(db);
  const newBest = run.distance > prev.bestDistance;
  const newHorde = run.maxHorde > prev.maxHorde;
  b.update(doc(db, ZR(uid)), {
    bestDistance: Math.max(prev.bestDistance, run.distance), maxHorde: Math.max(prev.maxHorde, run.maxHorde),
    totalConverted: prev.totalConverted + run.converted, totalGems: prev.totalGems + run.gems,
    gamesPlayed: prev.gamesPlayed + 1, lastDistance: run.distance, lastRunId: runId, lastPlayedAt: serverTimestamp(),
    bestDistanceAt: newBest ? serverTimestamp() : prev.bestDistanceAt, maxHordeAt: newHorde ? serverTimestamp() : prev.maxHordeAt,
    ...overrides,
  });
  b.set(doc(db, `${ZR(uid)}/runs/${runId}`), {
    distance: run.distance, maxHorde: run.maxHorde, converted: run.converted, gems: run.gems,
    durationMs: run.distance * 60, playedAt: serverTimestamp(), ...runOverrides,
  });
  return b.commit();
}

test('jockombi: el progreso se crea en cero y sólo para uno mismo', async () => {
  const db = ctx('mari', 'Mari');
  await assertFails(setDoc(doc(db, ZR('mari')), { ...zrNew(), bestDistance: 9999 }));
  await assertFails(setDoc(doc(db, ZR('bob')), zrNew()));
  await assertFails(setDoc(doc(db, ZR('mari')), { ...zrNew(), extra: 1 }));
  await assertSucceeds(setDoc(doc(db, ZR('mari')), zrNew()));
  await assertSucceeds(getDoc(doc(db, ZR('mari'))));
  await assertFails(getDoc(doc(ctx('bob', 'bob'), ZR('mari'))));
  await assertSucceeds(getDoc(doc(ctx('boss', 'boss'), ZR('mari'))));
  // CoCoCorre no se ve afectado: el saldo sigue protegido igual
  await assertFails(updateDoc(doc(db, 'users/mari'), { points: 999999 }));
});

test('jockombi: partida legítima OK; duplicada, inflada o sin registro FALLA', async () => {
  await sleep(1300); // 40 m * 25 ms = 1 s mínimo desde la creación
  const db = ctx('mari', 'Mari');
  const prev = (await getDoc(doc(db, ZR('mari')))).data();
  const run = { distance: 40, maxHorde: 6, converted: 5, gems: 12 };
  // sin el registro de la partida
  await assertFails(updateDoc(doc(db, ZR('mari')), {
    bestDistance: 40, maxHorde: 6, totalConverted: 5, totalGems: 12, gamesPlayed: 1, lastDistance: 40,
    lastRunId: 'run00000001', lastPlayedAt: serverTimestamp(), bestDistanceAt: serverTimestamp(), maxHordeAt: serverTimestamp(),
  }));
  // récord que no coincide con la partida
  await assertFails(zrBatch(db, 'mari', prev, run, 'run00000001', { bestDistance: 5000 }));
  // contador de partidas inflado
  await assertFails(zrBatch(db, 'mari', prev, run, 'run00000001', { gamesPlayed: 9 }));
  // horda por encima del máximo del juego
  await assertFails(zrBatch(db, 'mari', prev, { ...run, maxHorde: 500 }, 'run00000001'));
  // más convertidos de los posibles para la distancia
  await assertFails(zrBatch(db, 'mari', prev, { ...run, converted: 400 }, 'run00000001'));
  // duración imposible
  await assertFails(zrBatch(db, 'mari', prev, run, 'run00000001', {}, { durationMs: 10 }));
  // ID inválido
  await assertFails(zrBatch(db, 'mari', prev, run, 'x'));
  await assertSucceeds(zrBatch(db, 'mari', prev, run, 'run00000001'));
  const after = (await getDoc(doc(db, ZR('mari')))).data();
  if (after.bestDistance !== 40 || after.gamesPlayed !== 1 || after.totalConverted !== 5) throw new Error('estadísticas inesperadas');
  // reenviar la misma partida (p. ej. tras perder la conexión): FALLA, no se duplica
  await sleep(1300);
  await assertFails(zrBatch(db, 'mari', after, run, 'run00000001'));
  // las partidas son inmutables
  await assertFails(updateDoc(doc(db, `${ZR('mari')}/runs/run00000001`), { distance: 9999 }));
  await assertFails(deleteDoc(doc(db, `${ZR('mari')}/runs/run00000001`)));
});

test('jockombi: distancia imposible para el tiempo transcurrido FALLA', async () => {
  const db = ctx('mari', 'Mari');
  const prev = (await getDoc(doc(db, ZR('mari')))).data();
  // 20.000 m necesitan al menos 500 s desde la partida anterior
  await assertFails(zrBatch(db, 'mari', prev, { distance: 20000, maxHorde: 10, converted: 50, gems: 100 }, 'run00000002'));
});

test('jockombi: nadie escribe el progreso de otra persona', async () => {
  const bob = ctx('bob', 'bob');
  const prev = (await getDoc(doc(ctx('mari', 'Mari'), ZR('mari')))).data();
  await assertFails(zrBatch(bob, 'mari', prev, { distance: 10, maxHorde: 2, converted: 1, gems: 0 }, 'run00000003'));
  await assertFails(setDoc(doc(bob, `${ZR('mari')}/runs/run00000004`), {
    distance: 1, maxHorde: 1, converted: 0, gems: 0, durationMs: 100, playedAt: serverTimestamp(),
  }));
  await assertFails(deleteDoc(doc(bob, ZR('mari'))));
});
