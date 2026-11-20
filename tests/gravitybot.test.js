// Run: node tests/gravitybot.test.js
const assert = require('assert');
const E = require('../games/gravitybot-engine.js');
const LV = require('../games/gravitybot-levels.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const base = (o) => Object.assign({ w: 1000, h: 600, start: { x: 100, y: 300 }, bodies: [], goal: null, orbs: [], portals: [] }, o);
const lvl = i => LV.LEVELS[i - 1];

t('own sin/cos are accurate and deterministic (no Math.sin in the simulation)', () => {
  for (let x = -20; x <= 20; x += .137) { assert.ok(Math.abs(E.sinD(x) - Math.sin(x)) < 2e-7, 'sin ' + x); assert.ok(Math.abs(E.cosD(x) - Math.cos(x)) < 2e-7, 'cos ' + x); }
});
t('no bodies: probe flies straight at constant speed and leaves the board', () => {
  const r = E.simulate(base({}), { vx: 5, vy: 0 });
  assert.strictEqual(r.result, 'lost'); assert.ok(Math.abs(r.points[3] - 300) < 1e-9); assert.ok(Math.abs(r.points[2] - 105) < 1e-9);
});
t('a planet pulls the probe towards it', () => {
  const r = E.simulate(base({ bodies: [{ t: 'p', x: 500, y: 450, r: 30, hue: 0 }] }), { vx: 5, vy: 0 }, { maxSteps: 120 });
  assert.ok(r.points[r.points.length - 1] > 300);
});
t('a repulsor pushes the probe away and is harmless', () => {
  const r = E.simulate(base({ bodies: [{ t: 'r', x: 500, y: 450, r: 30, hue: 0 }] }), { vx: 5, vy: 0 }, { maxSteps: 120 });
  assert.ok(r.points[r.points.length - 1] < 300); assert.notStrictEqual(r.result, 'crash');
});
t('flying into a planet crashes (probe radius counts)', () => {
  const r = E.simulate(base({ bodies: [{ t: 'p', x: 400, y: 300, r: 30, hue: 0 }] }), { vx: 6, vy: 0 });
  assert.strictEqual(r.result, 'crash'); assert.strictEqual(r.crashBody, 0);
  // grazing: passes 30 + PR - 1 away from centre => crash; 30 + PR + 20 => survives the contact test
  const L = base({ bodies: [{ t: 'p', x: 400, y: 300 - 30 - E.PR + 3, r: 30, hue: 0 }] });
  assert.strictEqual(E.simulate(L, { vx: 8, vy: 0 }, { maxSteps: 80 }).result, 'crash');
});
t('asteroids have no gravity but crash you', () => {
  const L = base({ bodies: [{ t: 'a', x: 300, y: 330, r: 14, hue: 0 }] });
  const r = E.simulate(L, { vx: 5, vy: 0 }, { maxSteps: 60 }); assert.ok(Math.abs(r.points[r.points.length - 1] - 300) < 1e-9 || r.result === 'crash');
  assert.strictEqual(E.simulate(base({ bodies: [{ t: 'a', x: 300, y: 300, r: 14, hue: 0 }] }), { vx: 5, vy: 0 }).result, 'crash');
  assert.strictEqual(E.bodyMass({ t: 'a', r: 14 }), 0);
});
t('black hole: small kill zone, strong pull', () => {
  const r = E.simulate(base({ bodies: [{ t: 'h', x: 500, y: 345, r: 30, hue: 0 }] }), { vx: 6, vy: 0 }, { maxSteps: 150 });
  assert.ok(r.points[r.points.length - 1] > 305); assert.strictEqual(E.killRadius({ t: 'h', r: 30 }), 15);
});
t('goal ends the flight; orbs are collected in order', () => {
  const L = base({ goal: { x: 600, y: 300 }, orbs: [{ x: 300, y: 300 }, { x: 450, y: 302 }, { x: 300, y: 500 }] });
  const r = E.simulate(L, { vx: 5, vy: 0 });
  assert.strictEqual(r.result, 'goal'); assert.deepStrictEqual(r.orbs.map(o => o.i), [0, 1]); assert.ok(r.goalDist >= 0 && r.goalDist < E.GOAL_R);
});
t('missing the goal: lost', () => assert.strictEqual(E.simulate(base({ goal: { x: 600, y: 100 } }), { vx: 5, vy: 0 }).result, 'lost'));
t('deterministic: same launch gives identical trajectory (with moving bodies)', () => {
  const L = lvl(55), v = { vx: 6.1, vy: -1.3 }; assert.deepStrictEqual(E.simulate(L, v).points, E.simulate(L, v).points);
});
t('line movers: periodic, stay on their line', () => {
  const b = { t: 'p', x: 0, y: 0, r: 30, mv: { k: 'line', ax: 300, ay: 100, bx: 300, by: 300, period: 200, phase: 0 } };
  assert.deepStrictEqual(E.bodyPos(b, 0), { x: 300, y: 100 }); assert.deepStrictEqual(E.bodyPos(b, 100), { x: 300, y: 300 });
  assert.ok(Math.abs(E.bodyPos(b, 200).y - 100) < 1e-9); assert.strictEqual(E.bodyPos({ x: 5, y: 6 }, 99).x, 5);
});
t('orbit movers: constant radius, full circle per period, direction flips with dir', () => {
  const b = { t: 'p', r: 30, mv: { k: 'orbit', cx: 500, cy: 300, R: 100, period: 400, phase: 0, dir: 1 } };
  for (let s = 0; s < 800; s += 37) { const p = E.bodyPos(b, s); assert.ok(Math.abs(Math.hypot(p.x - 500, p.y - 300) - 100) < 1e-5); }
  const p0 = E.bodyPos(b, 0), p1 = E.bodyPos(b, 100), p4 = E.bodyPos(b, 400);
  assert.ok(Math.abs(p0.x - 600) < 1e-5 && Math.abs(p0.y - 300) < 1e-5); assert.ok(Math.abs(p1.x - 500) < 1e-5 && Math.abs(p1.y - 400) < 1e-5); assert.ok(Math.abs(p4.x - p0.x) < 1e-5);
  const q = E.bodyPos({ r: 1, mv: Object.assign({}, b.mv, { dir: -1 }) }, 100); assert.ok(Math.abs(q.y - 200) < 1e-5);
});
t('portals teleport the probe keeping its velocity, with a cooldown', () => {
  const L = base({ portals: [{ ax: 300, ay: 300, bx: 700, by: 450 }], goal: { x: 900, y: 450 } });
  const r = E.simulate(L, { vx: 5, vy: 0 });
  assert.strictEqual(r.result, 'goal'); assert.strictEqual(r.warps.length, 1); assert.strictEqual(r.jumps.length, 1);
  assert.deepStrictEqual(r.warps[0].to, { x: 700, y: 450 });
});
t('thrust steers the probe towards the target and burns fuel; fuel runs out', () => {
  const L = base({}); const F = E.createFlight(L, { vx: 5, vy: 0 });
  for (let i = 0; i < 40; i++) E.stepFlight(F, { x: 500, y: 600 });
  assert.ok(F.vy > 1.5, 'curved down'); assert.strictEqual(F.fuel, E.FUEL - 40); assert.strictEqual(F.thrustUsed, 40);
  for (let i = 0; i < 80 && !F.result; i++) E.stepFlight(F, { x: 500, y: 600 });
  assert.strictEqual(F.fuel, 0); assert.ok(F.thrustUsed <= E.FUEL);
  const vy = F.vy; if (!F.result) { E.stepFlight(F, { x: 500, y: 600 }); assert.ok(Math.abs(F.vy - vy) < 1e-9, 'no thrust without fuel'); }
});
t('thrust can rescue a near miss (steer into the goal)', () => {
  const L = base({ goal: { x: 700, y: 330 } }); const F = E.createFlight(L, { vx: 5, vy: 0 });
  while (!F.result) E.stepFlight(F, { x: 700, y: 330 });
  assert.strictEqual(F.result, 'goal');
});
t('no thrust: stepping equals simulate()', () => {
  const L = lvl(30), v = L.solution, F = E.createFlight(L, v); while (!F.result) E.stepFlight(F, null);
  assert.deepStrictEqual(F.pts, E.simulate(L, v).points);
});
t('drag to velocity: direction, clamping and power', () => {
  const v = E.dragToVelocity(75, 0, 150); assert.ok(Math.abs(v.vx - E.VMAX / 2) < 1e-9 && v.vy === 0 && v.power === .5);
  const big = E.dragToVelocity(0, -999, 150); assert.ok(Math.abs(big.vy + E.VMAX) < 1e-9 && big.power === 1); assert.strictEqual(E.dragToVelocity(0, 0).power, 0);
});
t('stars: goal=1, +orbs, +<=2 shots', () => {
  const L = { orbs: [1, 2, 3] };
  assert.strictEqual(E.starsFor(L, 3, 1), 1); assert.strictEqual(E.starsFor(L, 3, 3), 2); assert.strictEqual(E.starsFor(L, 2, 3), 3); assert.strictEqual(E.starsFor(L, 1, 0), 2);
});
t('score: base + orbs + shots, plus bonuses (pure flight, bullseye, close call, speed run)', () => {
  const best = E.scoreFor({ shotsUsed: 1, orbsGot: 3, orbsTotal: 3, thrustUsed: 0, steps: 120, goalDist: 4, minClear: 6 });
  assert.deepStrictEqual(best.parts.map(p => p.k), ['base', 'orbs', 'shots', 'pure', 'bull', 'close', 'fast']); assert.strictEqual(best.total, 1000 + 750 + 600 + 300 + 300 + 200 + 200);
  const meh = E.scoreFor({ shotsUsed: 3, orbsGot: 0, orbsTotal: 2, thrustUsed: 20, steps: 400, goalDist: 25, minClear: 100 });
  assert.strictEqual(meh.total, 1000 + 0 + 200); assert.ok(best.total > meh.total);
});
t('ranks: thresholds and progress', () => {
  assert.strictEqual(E.rankFor(0).name, 'Cadet'); assert.strictEqual(E.rankFor(10).name, 'Pilot'); assert.strictEqual(E.rankFor(64).name, 'Navigator');
  assert.strictEqual(E.rankFor(300).name, 'Legend'); assert.strictEqual(E.rankFor(300).next, null); assert.strictEqual(E.rankFor(5).next[0], 'Pilot');
});

// ---------- campaign data ----------
t('campaign: 100 levels in 10 galaxies', () => { assert.strictEqual(LV.LEVELS.length, 100); assert.strictEqual(E.LEVELS, 100); assert.strictEqual(E.WORLDS.length, 10); });
for (let i = 1; i <= 100; i++) t('level ' + i + ': stored solution reaches the station and collects every orb', () => {
  const L = lvl(i), r = E.verify(L);
  assert.strictEqual(r.result, 'goal'); assert.strictEqual(r.orbs.length, L.orbs.length);
  const clear = (x, y, pad) => L.bodies.every(b => { for (let tt = 0; tt < 1500; tt += 25) { const p = E.bodyPos(b, tt); if (Math.hypot(p.x - x, p.y - y) < b.r + pad) return false; } return true; });
  assert.ok(clear(L.goal.x, L.goal.y, E.GOAL_R), 'goal clear of bodies at all times');
  assert.ok(clear(L.start.x, L.start.y, 60), 'start clear of bodies at all times');
  const sp = Math.hypot(L.solution.vx, L.solution.vy); assert.ok(sp > 3 && sp < E.VMAX, 'reachable launch speed');
});
t('campaign data matches the generator (spot checks regenerate identically)', () => {
  [1, 34, 77].forEach(i => { const G = E.getLevel(i); assert.deepStrictEqual(G.solution, lvl(i).solution); assert.deepStrictEqual(G.goal, lvl(i).goal); });
});
t('planets really move: most levels from galaxy 2 have moving bodies; orbits and lines both appear', () => {
  const movers = LV.LEVELS.filter(l => l.index > 10).filter(l => l.bodies.some(b => b.mv)).length; assert.ok(movers >= 80, 'moving levels: ' + movers);
  const kinds = new Set(); LV.LEVELS.forEach(l => l.bodies.forEach(b => b.mv && kinds.add(b.mv.k))); assert.ok(kinds.has('orbit') && kinds.has('line'));
  assert.ok(LV.LEVELS.slice(20, 30).some(l => l.bodies.some(b => b.mv && b.mv.k === 'orbit')), 'galaxy 3: planets orbit the sun');
});
t('galaxies introduce their hazards', () => {
  const types = w => new Set([].concat(...LV.LEVELS.slice(w * 10, w * 10 + 10).map(l => l.bodies.map(b => b.t))));
  assert.ok(types(0).size === 1 && types(0).has('p')); assert.ok(types(2).has('s')); assert.ok(types(3).has('m')); assert.ok(types(4).has('r')); assert.ok(types(5).has('h')); assert.ok(types(6).has('a'));
  assert.ok(LV.LEVELS.slice(70, 80).filter(l => l.portals.length).length >= 8, 'galaxy 8 has portals'); assert.ok(LV.LEVELS.slice(80, 100).filter(l => l.portals.length).length >= 10, 'galaxies 9-10 have portals');
  assert.ok(lvl(100).bodies.length >= 5 && lvl(100).preview < lvl(1).preview);
});
t('campaign levels survive a JSON round trip (they ship as data)', () => {
  [3, 22, 40, 58, 75, 99].forEach(i => assert.strictEqual(E.verify(JSON.parse(JSON.stringify(lvl(i)))).result, 'goal'));
});
t('solutions are forgiving: nearby aims still reach the goal (learnable)', () => {
  let robust = 0, tested = 0;
  for (let i = 1; i <= 100; i += 4) {
    tested++; const L = lvl(i), s = L.solution, sp = Math.hypot(s.vx, s.vy), a0 = Math.atan2(s.vy, s.vx); let hits = 0;
    for (let a = -1; a <= 1; a++) for (let j = -1; j <= 1; j++) { const aa = a0 + a * .026, p = sp * (1 + j * .04); if (E.simulate(L, { vx: Math.cos(aa) * p, vy: Math.sin(aa) * p }).result === 'goal') hits++; }
    if (hits >= 3) robust++;
  }
  assert.strictEqual(robust, tested);
});
t('endless mode: 14 consecutive sectors are solvable, get harder, and are deterministic', () => {
  const bodies = [];
  for (let k = 1; k <= 14; k++) { const L = E.endlessLevel(77, k); assert.strictEqual(E.verify(L).result, 'goal', 'k=' + k); bodies.push(L.bodies.length); }
  assert.ok(bodies[13] >= bodies[0] + 2); assert.deepStrictEqual(E.endlessLevel(77, 5).solution, E.endlessLevel(77, 5).solution);
});
t('invalid level index throws', () => assert.throws(() => E.getLevel(101), RangeError));
console.log('\n' + n + ' tests passed');
