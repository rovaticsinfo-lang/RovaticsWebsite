// Run: node tests/gravitybot.test.js
const assert = require('assert');
const E = require('../games/gravitybot-engine.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const base = (o) => Object.assign({ w: 1000, h: 600, start: { x: 100, y: 300 }, bodies: [], goal: null, orbs: [] }, o);

t('no bodies: probe flies in a straight line at constant speed and leaves the board', () => {
  const r = E.simulate(base({}), { vx: 5, vy: 0 });
  assert.strictEqual(r.result, 'lost'); assert.ok(Math.abs(r.points[3] - 300) < 1e-9);
  assert.ok(Math.abs(r.points[2] - 105) < 1e-9);
});
t('a planet pulls the probe towards it', () => {
  const L = base({ bodies: [{ t: 'p', x: 500, y: 450, r: 30, hue: 0 }] });
  const r = E.simulate(L, { vx: 5, vy: 0 }, { maxSteps: 120 });
  assert.ok(r.points[r.points.length - 1] > 300, 'drifted down toward the planet (y grew)');
});
t('a repulsor pushes the probe away', () => {
  const L = base({ bodies: [{ t: 'r', x: 500, y: 450, r: 30, hue: 0 }] });
  const r = E.simulate(L, { vx: 5, vy: 0 }, { maxSteps: 120 });
  assert.ok(r.points[r.points.length - 1] < 300, 'pushed up, away from the repulsor');
  assert.notStrictEqual(r.result, 'crash');
});
t('flying into a planet crashes', () => {
  const L = base({ bodies: [{ t: 'p', x: 400, y: 300, r: 30, hue: 0 }] });
  const r = E.simulate(L, { vx: 6, vy: 0 }); assert.strictEqual(r.result, 'crash'); assert.strictEqual(r.crashBody, 0);
});
t('black hole kills only inside its small core but pulls strongly', () => {
  const near = base({ bodies: [{ t: 'h', x: 500, y: 345, r: 30, hue: 0 }] });
  const r = E.simulate(near, { vx: 6, vy: 0 }, { maxSteps: 150 });
  assert.ok(r.points[r.points.length - 1] > 305, 'bent strongly');
  assert.strictEqual(E.killRadius({ t: 'h', r: 30 }), 15);
});
t('reaching the goal ends the flight with result goal; orbs are collected in order', () => {
  const L = base({ goal: { x: 600, y: 300 }, orbs: [{ x: 300, y: 300 }, { x: 450, y: 302 }, { x: 300, y: 500 }] });
  const r = E.simulate(L, { vx: 5, vy: 0 });
  assert.strictEqual(r.result, 'goal'); assert.deepStrictEqual(r.orbs.map(o => o.i), [0, 1]);
  assert.ok(r.orbs[0].step < r.orbs[1].step);
});
t('missing the goal flies off (lost) or times out', () => {
  const L = base({ goal: { x: 600, y: 100 } });
  assert.strictEqual(E.simulate(L, { vx: 5, vy: 0 }).result, 'lost');
});
t('deterministic: same launch gives identical trajectory', () => {
  const L = E.getLevel(25), v = { vx: 6.1, vy: -1.3 };
  assert.deepStrictEqual(E.simulate(L, v).points, E.simulate(L, v).points);
});
t('movers: position is periodic and stays on its line', () => {
  const b = { t: 'p', x: 0, y: 0, r: 30, mv: { ax: 300, ay: 100, bx: 300, by: 300, period: 200, phase: 0 } };
  const p0 = E.bodyPos(b, 0), p1 = E.bodyPos(b, 100), p2 = E.bodyPos(b, 200);
  assert.deepStrictEqual(p0, { x: 300, y: 100 }); assert.deepStrictEqual(p1, { x: 300, y: 300 });
  assert.ok(Math.abs(p2.y - 100) < 1e-9 && p0.x === 300);
  assert.strictEqual(E.bodyPos({ x: 5, y: 6 }, 99).x, 5);
});
t('drag to velocity: direction, clamping and power', () => {
  const v = E.dragToVelocity(75, 0, 150); assert.ok(Math.abs(v.vx - E.VMAX / 2) < 1e-9 && v.vy === 0 && v.power === .5);
  const big = E.dragToVelocity(0, -999, 150); assert.ok(Math.abs(big.vy + E.VMAX) < 1e-9 && big.power === 1);
  assert.strictEqual(E.dragToVelocity(0, 0).power, 0);
});
t('stars: goal=1, +orbs, +<=2 shots', () => {
  const L = { orbs: [1, 2, 3] };
  assert.strictEqual(E.starsFor(L, 3, 1), 1); assert.strictEqual(E.starsFor(L, 3, 3), 2); assert.strictEqual(E.starsFor(L, 2, 3), 3); assert.strictEqual(E.starsFor(L, 1, 0), 2);
});

for (let lv = 1; lv <= 60; lv++) t('level ' + lv + ': stored solution reaches the station and collects every orb', () => {
  const L = E.getLevel(lv), r = E.verify(L);
  assert.strictEqual(r.result, 'goal'); assert.strictEqual(r.orbs.length, L.orbs.length);
  L.bodies.forEach(b => { if (!b.mv) assert.ok(Math.hypot(b.x - L.goal.x, b.y - L.goal.y) > b.r + E.GOAL_R, 'goal clear of body'); assert.ok(Math.hypot(b.x - L.start.x, b.y - L.start.y) > b.r + 60, 'start clear of body'); });
  const sp = Math.hypot(L.solution.vx, L.solution.vy); assert.ok(sp > 3 && sp < E.VMAX, 'launch speed is reachable by dragging');
});
t('levels: JSON round-trip keeps them solvable (shipping as data is safe)', () => {
  [3, 22, 40, 58].forEach(i => { const L = JSON.parse(JSON.stringify(E.getLevel(i))); assert.strictEqual(E.verify(L).result, 'goal'); });
});
t('worlds introduce their hazards and ramp up', () => {
  const types = w => new Set([].concat(...Array.from({ length: 10 }, (_, i) => E.getLevel(w * 10 + i + 1).bodies.map(b => b.t))));
  assert.ok(types(0).size === 1 && types(0).has('p'));
  assert.ok(types(2).has('s')); assert.ok(types(3).has('m')); assert.ok(types(4).has('r')); assert.ok(types(5).has('h'));
  assert.ok(Array.from({ length: 10 }, (_, i) => E.getLevel(30 + i + 1)).some(L => L.bodies.some(b => b.mv)), 'moving bodies in world 4');
  assert.ok(E.getLevel(60).preview < E.getLevel(1).preview, 'less aim preview later');
});
t('solutions are forgiving: nearby aims still reach the goal (learnable)', () => {
  let robust = 0;
  for (let lv = 1; lv <= 60; lv += 3) {
    const L = E.getLevel(lv), s = L.solution, sp = Math.hypot(s.vx, s.vy), a0 = Math.atan2(s.vy, s.vx); let hits = 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = a0 + i * .026, p = sp * (1 + j * .04); if (E.simulate(L, { vx: Math.cos(a) * p, vy: Math.sin(a) * p }).result === 'goal') hits++; }
    if (hits >= 3) robust++;
  }
  assert.strictEqual(robust, 20);
});
t('endless mode: 40 consecutive levels are always solvable and get harder', () => {
  let bodies = [];
  for (let k = 1; k <= 40; k++) { const L = E.endlessLevel(77, k); assert.strictEqual(E.verify(L).result, 'goal', 'k=' + k); bodies.push(L.bodies.length); }
  assert.ok(bodies[39] >= bodies[0] + 2);
  assert.deepStrictEqual(E.endlessLevel(77, 5).solution, E.endlessLevel(77, 5).solution);
});
t('invalid level index throws', () => assert.throws(() => E.getLevel(61), RangeError));
console.log('\n' + n + ' tests passed');
