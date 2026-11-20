// Run: node tests/beambots.test.js
const assert = require('assert');
const E = require('../games/beambots-engine.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const L0 = (o) => Object.assign({ w: 5, h: 5, walls: [], emitters: [], filters: [], targets: [], inventory: { m: 9, s: 9 } }, o);
const P = (...a) => { const p = {}; a.forEach(([x, y, type, o]) => p[E.key(x, y)] = { type, o }); return p; };

t('beam travels straight and is absorbed by a matching robot', () => {
  const L = L0({ emitters: [{ x: 0, y: 2, d: 1, c: 7 }], targets: [{ x: 4, y: 2, need: 7 }] });
  const r = E.trace(L, {}); assert.ok(r.solved); assert.strictEqual(r.targets[0].got, 7);
});
t('mirror "/" turns right->up, "\\" turns right->down', () => {
  let L = L0({ emitters: [{ x: 0, y: 2, d: 1, c: 7 }], targets: [{ x: 2, y: 0, need: 7 }] });
  assert.ok(E.trace(L, P([2, 2, 'm', 0])).solved);
  L = L0({ emitters: [{ x: 0, y: 2, d: 1, c: 7 }], targets: [{ x: 2, y: 4, need: 7 }] });
  assert.ok(E.trace(L, P([2, 2, 'm', 1])).solved);
  assert.ok(!E.trace(L, P([2, 2, 'm', 0])).solved);
});
t('all four reflections are consistent (reflecting twice returns to origin)', () => {
  [0, 1].forEach(o => [0, 1, 2, 3].forEach(d => {
    const R = [[1, 0, 3, 2], [3, 2, 1, 0]][o];
    assert.strictEqual(R[R[d]], d);
  }));
});
t('walls block beams', () => {
  const L = L0({ emitters: [{ x: 0, y: 2, d: 1, c: 7 }], targets: [{ x: 4, y: 2, need: 7 }], walls: [{ x: 2, y: 2 }] });
  assert.ok(!E.trace(L, {}).solved);
});
t('splitter sends the beam both straight and reflected', () => {
  const L = L0({ emitters: [{ x: 0, y: 2, d: 1, c: 7 }], targets: [{ x: 4, y: 2, need: 7 }, { x: 2, y: 0, need: 7 }] });
  assert.ok(E.trace(L, P([2, 2, 's', 0])).solved);
  assert.ok(!E.trace(L, P([2, 2, 'm', 0])).solved); // a plain mirror loses the straight beam
});
t('colour filter keeps only its colours; fully filtered beams stop', () => {
  let L = L0({ emitters: [{ x: 0, y: 2, d: 1, c: 7 }], filters: [{ x: 2, y: 2, c: 1 }], targets: [{ x: 4, y: 2, need: 1 }] });
  assert.ok(E.trace(L, {}).solved);
  L = L0({ emitters: [{ x: 0, y: 2, d: 1, c: 2 }], filters: [{ x: 2, y: 2, c: 1 }], targets: [{ x: 4, y: 2, need: 2 }] });
  assert.ok(!E.trace(L, {}).solved);
});
t('colour mixing: red + green beams reaching one robot make yellow', () => {
  const L = L0({ emitters: [{ x: 0, y: 2, d: 1, c: 1 }, { x: 4, y: 4, d: 0, c: 2 }], targets: [{ x: 4, y: 2, need: 3 }] });
  const r = E.trace(L, {});
  assert.strictEqual(r.targets[0].got, 3); assert.ok(r.solved);
});
t('wrong colour does not wake a robot', () => {
  const L = L0({ emitters: [{ x: 0, y: 2, d: 1, c: 1 }], targets: [{ x: 4, y: 2, need: 7 }] });
  const r = E.trace(L, {}); assert.strictEqual(r.targets[0].got, 1); assert.ok(!r.solved);
});
t('mirror loops terminate (no infinite loop)', () => {
  const L = L0({ w: 6, h: 6, emitters: [{ x: 0, y: 1, d: 1, c: 7 }], targets: [{ x: 5, y: 5, need: 7 }] });
  const p = P([3, 1, 's', 1], [3, 3, 's', 1], [1, 3, 's', 1], [1, 1, 's', 1]);
  const r = E.trace(L, p); assert.ok(Array.isArray(r.segs)); assert.ok(r.segs.length < 2000);
});
t('beam leaving the grid is reported as an end', () => {
  const L = L0({ emitters: [{ x: 0, y: 2, d: 1, c: 7 }] });
  const r = E.trace(L, {}); assert.strictEqual(r.ends.length, 1); assert.strictEqual(r.ends[0].x, 4);
});
t('no targets => never solved', () => assert.ok(!E.trace(L0({ emitters: [{ x: 0, y: 2, d: 1, c: 7 }] }), {}).solved));

for (let lv = 1; lv <= E.LEVELS; lv++) t('level ' + lv + ': solvable with its solution, needs pieces, inventory matches', () => {
  const L = E.getLevel(lv);
  assert.ok(E.trace(L, E.placedFromSolution(L.solution)).solved, 'solution solves');
  assert.ok(!E.trace(L, {}).solved, 'not solved at start');
  assert.strictEqual(L.par, L.solution.length);
  assert.deepStrictEqual(L.inventory, { m: L.solution.filter(s => s.type === 'm').length, s: L.solution.filter(s => s.type === 's').length });
  L.solution.forEach(s => assert.ok(!E.isOccupied(L, s.x, s.y), 'piece on a free cell'));
  L.targets.forEach(tg => assert.ok(tg.need >= 1 && tg.need <= 7));
});
t('levels get bigger and harder; features appear (splitter, filter, colour)', () => {
  const pars = Array.from({ length: E.LEVELS }, (_, i) => E.getLevel(i + 1).par);
  for (let i = 1; i < pars.length; i++) assert.ok(pars[i] >= pars[i - 1], 'par non-decreasing');
  assert.ok(pars[11] > pars[0] + 4);
  assert.ok(E.getLevel(3).inventory.s >= 1);
  assert.ok(E.getLevel(5).filters.length >= 1);
  assert.ok(E.getLevel(12).emitters.length >= 3);
});
t('levels are deterministic and all different', () => {
  const sig = n => JSON.stringify(E.generate(E.LEVEL_CONFIGS[n - 1], 7000 + n * 131).solution);
  assert.strictEqual(sig(4), JSON.stringify(E.getLevel(4).solution));
  assert.strictEqual(new Set(Array.from({ length: 12 }, (_, i) => JSON.stringify(E.getLevel(i + 1)))).size, 12);
});
t('daily puzzle: same date => same puzzle, different date => different, always solvable', () => {
  const a = E.getDaily('2026-11-21'), b = E.getDaily('2026-11-21'), c = E.getDaily('2026-11-22');
  assert.deepStrictEqual(a.solution, b.solution); assert.notDeepStrictEqual(a, c);
  ['2026-01-01', '2026-06-15', '2027-03-09', '2026-12-31'].forEach(d => {
    const L = E.getDaily(d); assert.ok(E.trace(L, E.placedFromSolution(L.solution)).solved);
  });
});
t('hint returns a correct piece, then null when solved, and corrects wrong rotation', () => {
  const L = E.getLevel(4), h = E.hint(L, {});
  assert.ok(L.solution.some(s => s.x === h.x && s.y === h.y && s.o === h.o && s.type === h.type));
  assert.strictEqual(E.hint(L, E.placedFromSolution(L.solution)), null);
  const p = E.placedFromSolution(L.solution), s0 = L.solution[0]; p[E.key(s0.x, s0.y)].o ^= 1;
  assert.deepStrictEqual(E.hint(L, p), s0);
});
t('inventoryLeft counts placed pieces', () => {
  const L = E.getLevel(3), left = E.inventoryLeft(L, E.placedFromSolution(L.solution));
  assert.deepStrictEqual(left, { m: 0, s: 0 });
});
t('stars: efficient = 3, hints cost a star, never below 1', () => {
  const L = E.getLevel(4);
  assert.strictEqual(E.starsFor(L, L.par, 0), 3); assert.strictEqual(E.starsFor(L, L.par, 2), 2);
  assert.strictEqual(E.starsFor(L, L.par * 2 + 3, 0), 1); assert.strictEqual(E.starsFor(L, 999, 3), 1);
});
t('random generation stress: 60 seeds across configs all valid', () => {
  for (let s = 1; s <= 60; s++) {
    const cfg = E.LEVEL_CONFIGS[s % E.LEVELS], L = E.generate(cfg, s * 977);
    assert.ok(E.trace(L, E.placedFromSolution(L.solution)).solved);
  }
});
console.log('\n' + n + ' tests passed');
