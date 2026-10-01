// Pruebas de las reglas de seguridad de Firestore (12 intentos de trampa + casos válidos).
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
    lastScore: 0, claimedCount: 0, lastClaim: null, createdAt: serverTimestamp(), lastGameAt: serverTimestamp(),
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
      name: 'Un beso', description: '', cost: 100, difficulty: 'facil', image: '💋', active: true, order: 1,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'rewards/off'), {
      name: 'Inactiva', description: '', cost: 1, difficulty: 'facil', image: 'x', active: false, order: 2,
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

function claimBatch(db, uid, name, prevPoints, prevCount, rewardId, cost, opts = {}) {
  const b = writeBatch(db);
  b.update(doc(db, `users/${uid}`), {
    points: prevPoints - (opts.subtract ?? cost), claimedCount: prevCount + 1, lastClaim: rewardId,
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
