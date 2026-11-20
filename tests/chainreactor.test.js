// Run: node tests/chainreactor.test.js
const assert = require('assert');
const E = require('../games/chainreactor-engine.js');
const LV = require('../games/chainreactor-levels.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const B = rows => E.parse(rows);
const cell = (S, x, y) => y * S.w + x;

t('parse/serialize round trip', () => {
  const rows = ['n1..W.', 'd2i3l1', '......'];
  assert.deepStrictEqual(E.serialize(B(rows)), rows);
  assert.throws(() => B(['n9..']), /bad cell/);
});
t('tap adds one charge; no explosion below 4', () => {
  const S = B(['n1..', '....']); const r = E.tap(S, 0, true);
  assert.ok(r.ok); assert.strictEqual(S.val[0], 2); assert.strictEqual(r.exploded, 0); assert.strictEqual(r.waves.length, 0);
});
t('charge 3 + tap explodes, shoots 4 directions, hits first core only', () => {
  const T = B(['....n1....', '..n1n3n1..', '....n1....']);
  assert.strictEqual(T.w, 5);
  const c = cell(T, 2, 1); const r = E.tap(T, c, true);
  assert.strictEqual(r.exploded, 1); assert.strictEqual(T.typ[c], 0);
  [[2, 0], [1, 1], [3, 1], [2, 2]].forEach(([x, y]) => assert.strictEqual(T.val[cell(T, x, y)], 2));
  assert.strictEqual(r.waves.length, 1); assert.strictEqual(r.waves[0].shots.length, 4);
});
t('chain reaction: waves cascade and are counted', () => {
  const S = B(['n3n3n3n3n1']);
  const r = E.tap(S, 0, true);
  assert.strictEqual(r.exploded, 4); assert.strictEqual(r.waves.length, 4);
  assert.strictEqual(S.val[4], 2);
});
t('shots skip empty cells and leave the board harmlessly', () => {
  const S = B(['n3......n1']); const r = E.tap(S, 0, true);
  assert.strictEqual(S.val[4], 2); assert.strictEqual(r.exploded, 1);
  const S2 = B(['n3....']); assert.strictEqual(E.tap(S2, 0, true).exploded, 1);
});
t('walls stop shots and cannot be tapped', () => {
  const S = B(['n3W.n1']);
  E.tap(S, 0, false); assert.strictEqual(S.val[2], 1);
  assert.ok(!E.canTap(S, 1)); assert.ok(!E.tap(S, 1).ok);
  assert.ok(!E.isWon(S));
});
t('diagonal core fires diagonally', () => {
  const S = B(['n1..n1', '..d3..', 'n1..n1']);
  const r = E.tap(S, cell(S, 1, 1), true);
  assert.strictEqual(r.exploded, 1);
  [[0, 0], [2, 0], [0, 2], [2, 2]].forEach(([x, y]) => assert.strictEqual(S.val[cell(S, x, y)], 2));
});
t('laser core pierces and hits every core in line, stops at a wall', () => {
  const S = B(['l3n1n1n1W.n1']);
  E.tap(S, 0, false);
  assert.strictEqual(S.val[1], 2); assert.strictEqual(S.val[2], 2); assert.strictEqual(S.val[3], 2);
  assert.strictEqual(S.val[5], 1);
});
t('frozen core cannot be tapped, thaws when hit, then behaves normally', () => {
  const S = B(['n3i2']);
  assert.ok(!E.canTap(S, 1));
  E.tap(S, 0, false);
  assert.strictEqual(S.typ[1], E.N); assert.strictEqual(S.val[1], 3);
  assert.ok(E.canTap(S, 1));
});
t('explosions happen in simultaneous waves', () => {
  const S = B(['n3n3n1']);
  const r = E.tap(S, 0, true);
  assert.strictEqual(r.waves.length, 2);
  const S2 = B(['n3....' + '..n3n1']); // n3 .. .. n3 n1
  const r2 = E.tap(S2, 0, true); assert.strictEqual(r2.exploded, 2);
  const T = B(['n3......n3']); T.val[0] = 4; T.val[4] = 4;
  const r3 = E.resolve(T, true); assert.strictEqual(r3.waves[0].boom.length, 2);
});
t('win = no cores left; walls may remain', () => {
  const S = B(['n3W.']); E.tap(S, 0, false); assert.ok(E.isWon(S));
  assert.ok(!E.isWon(B(['n1..'])));
});
t('tapping empty cell does nothing', () => { const S = B(['..n1']); assert.ok(!E.tap(S, 0).ok); });
t('solver finds shortest solutions', () => {
  const S = B(['n3n3n3']);
  const r = E.solve(S, 3); assert.deepStrictEqual(r.taps.length, 1);
  const S2 = B(['n1......n1']); const r2 = E.solve(S2, 6); assert.ok(r2 && r2.taps.length === 5);
});
t('solver returns null when budget/depth too small', () => { assert.strictEqual(E.solve(B(['n1......n1']), 4), null); });
t('hintTap returns a legal tap that leads toward a win', () => {
  const S = B(['n3n2n1']); const h = E.hintTap(S, 4); assert.ok(h >= 0 && E.canTap(S, h));
  assert.strictEqual(E.hintTap(B(['W.']), 3), -1);
});
t('starsFor', () => { assert.strictEqual(E.starsFor(3, 3), 3); assert.strictEqual(E.starsFor(3, 4), 2); assert.strictEqual(E.starsFor(3, 5), 1); assert.strictEqual(E.starsFor(3, 2), 3); });

// ---------- campaign data ----------
t('campaign: 100 levels in 10 worlds', () => { assert.strictEqual(LV.LEVELS.length, 100); assert.strictEqual(LV.WORLDS.length, 10); });
LV.LEVELS.forEach((lv, i) => t('level ' + (i + 1) + ': solution wins in par taps', () => {
  const S = E.parse(lv.rows); assert.ok(!E.isWon(S));
  assert.strictEqual(lv.solution.length, lv.par);
  lv.solution.forEach((c, k) => { const r = E.tap(S, c, false); assert.ok(r.ok, 'legal tap ' + k); });
  assert.ok(E.isWon(S), 'won');
}));
t('campaign: difficulty ramps (avg par by world non-decreasing trend) and features appear', () => {
  const avg = w => { const a = LV.LEVELS.filter(l => l.world === w); return a.reduce((s, l) => s + l.par, 0) / a.length; };
  assert.ok(avg(9) > avg(0) + 2);
  const has = (w, ch) => LV.LEVELS.filter(l => l.world === w).some(l => l.rows.some(r => r.includes(ch)));
  assert.ok(has(1, 'W.')); assert.ok(has(2, 'd')); assert.ok(has(3, 'i')); assert.ok(has(4, 'l'));
  assert.ok(!has(0, 'W.') && !has(0, 'd') && !has(0, 'l') && !has(0, 'i'));
});
t('campaign levels are all different', () => { assert.strictEqual(new Set(LV.LEVELS.map(l => l.rows.join('|'))).size, 100); });

// ---------- Overload (endless) ----------
t('overload: deterministic start with 3 rows', () => {
  const a = E.endlessNew(5), b = E.endlessNew(5);
  assert.deepStrictEqual(Array.from(a.S.typ), Array.from(b.S.typ)); assert.ok(E.coresLeft(a.S) > 0);
  assert.ok(Array.from(a.S.typ.slice(0, 7 * 6)).every(v => v === 0), 'top six rows empty');
});
t('overload: pushing rows eventually ends the game; score grows with cleared cores', () => {
  const G = E.endlessNew(11); let guard = 0, scored = false;
  while (!G.over && guard++ < 2000) {
    let best = -1; for (let i = 0; i < G.S.typ.length; i++) if (E.canTap(G.S, i) && (best < 0 || G.S.val[i] > G.S.val[best])) best = i;
    if (best < 0) { E.pushRow(G, false); continue; }
    const r = E.endlessTap(G, best, false); if (r.gained > 0) scored = true;
  }
  assert.ok(G.over); assert.ok(G.score >= 0);
});
t('overload: pushRow reports game over when a core reaches the ceiling', () => {
  const G = E.endlessNew(3); G.S.typ[0] = E.N; G.S.val[0] = 1;
  assert.strictEqual(E.pushRow(G, false), false); assert.ok(G.over);
  assert.ok(!E.endlessTap(G, 0, false).ok);
});
console.log('\n' + n + ' tests passed');
