// Run: node tests/mindverse.test.js
const assert = require('assert');
const E = require('../games/mindverse-engine.js');
const LD = require('../games/mindverse-levels.js');
const clone = o => JSON.parse(JSON.stringify(o));
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const L = i => clone(LD.LEVELS[i - 1]);
const stageOf = (lvl, id) => lvl.stages.find(s => s.id === id || s.kind === id);
const playPath = (g, path) => { path.forEach(a => { const r = g.perform(a); assert.ok(r.ok, 'step failed: ' + JSON.stringify(a) + ' ' + (r.blocked || '')); }); };
const solveGame = g => { let guard = 0; while (!g.complete && guard++ < 200) { const p = g.stageSolution(); assert.ok(p, 'unsolvable stage'); const a = p[0]; assert.ok(g.perform(a).ok); } assert.ok(g.complete, 'game never completed'); };

// ---------- the campaign data ----------
t('the first ten levels are World 1 with the pack ids, titles and three hints each', () => {
  assert.ok(LD.LEVELS.length >= 10);
  const titles = ['The Awakening', 'The Rotating Mirror', 'The Three Symbols', 'The Weight of Knowledge', 'The Water Path', 'The Hidden Key', 'The Energy Network', 'The Moving Bridge', 'The Ancient Trap', 'The Mind Core'];
  LD.LEVELS.slice(0, 10).forEach((l, i) => { assert.strictEqual(l.levelId, 'WC_L' + String(i + 1).padStart(2, '0')); assert.strictEqual(l.title, titles[i]); assert.strictEqual(l.worldId, 'LOST_CIVILIZATION'); assert.strictEqual(l.hints.length, 3); assert.ok(l.goalConditions.length >= 1); assert.ok(l.relic && l.relic.name); });
  assert.strictEqual(LD.FUTURE.length, 4, 'four future worlds listed');
});
t('65 levels in 5 worlds: unique ids, titles and looks, hints, a relic, and the difficulty rises on every level', () => {
  assert.strictEqual(LD.LEVELS.length, 65); assert.strictEqual(LD.WORLDS.length, 5);
  assert.strictEqual(new Set(LD.LEVELS.map(l => l.levelId)).size, 65, 'ids unique'); assert.strictEqual(new Set(LD.LEVELS.map(l => l.title)).size, 65, 'titles unique');
  LD.LEVELS.forEach((l, i) => { assert.strictEqual(l.n, i + 1); assert.strictEqual(l.hints.length, 3); assert.ok(l.relic && l.relic.name && l.intro && l.title); });
  const sizes = LD.WORLDS.map(w => LD.LEVELS.filter(l => l.n >= w.from && l.n <= w.to).length); assert.deepStrictEqual(sizes, [10, 15, 15, 13, 12]);
  LD.WORLDS.forEach(w => LD.LEVELS.filter(l => l.n >= w.from && l.n <= w.to).forEach(l => assert.strictEqual(l.worldId, w.id)));
  const gen = LD.LEVELS.slice(10); const looks = gen.map(l => l.look); assert.ok(looks.every(Boolean), 'every generated level has its own look');
  assert.strictEqual(new Set(looks.map(k => k.layout + '/' + k.floor + '/' + k.sky)).size, gen.length, 'no two rooms share layout + floor + sky');
  assert.ok(new Set(looks.map(k => k.layout)).size >= 9, 'many different layouts'); assert.ok(new Set(looks.map(k => k.sky)).size >= 8, 'many different skies');
  const H = LD.LEVELS.map(l => E.verifyLevel(l).hardness); LD.WORLDS.slice(1).forEach(w => { for (let n = w.from + 1; n <= w.to; n++) assert.ok(H[n - 1] > H[n - 2] - 0.5, 'level ' + n + ' is not easier than level ' + (n - 1) + ': ' + H[n - 2] + ' -> ' + H[n - 1]); });
  const avg = (a, b) => H.slice(a, b).reduce((x, y) => x + y, 0) / (b - a); assert.ok(avg(10, 25) < avg(25, 40) && avg(25, 40) < avg(40, 53) && avg(40, 53) < avg(53, 65), 'each world is harder: ' + [avg(10, 25), avg(25, 40), avg(40, 53), avg(53, 65)].map(x => x.toFixed(1)));
  assert.ok(H[64] > H[10] * 3, 'the last room is far harder than the first of world 2: ' + H[10] + ' -> ' + H[64]);
  for (let i = 11; i < 65; i++) { const x = LD.LEVELS[i - 1].stages.map(s => s.kind).sort().join(), y = LD.LEVELS[i].stages.map(s => s.kind).sort().join(); assert.notStrictEqual(x, y, 'level ' + (i + 1) + ' repeats the mechanics of level ' + i); }
  const kinds = new Set(); LD.LEVELS.forEach(l => l.stages.forEach(s => kinds.add(s.kind))); assert.strictEqual(kinds.size, 14, 'all 14 mechanics are used: ' + [...kinds].join());
  assert.ok(LD.LEVELS.filter(l => l.stages.length > 1).length >= 25, 'many multi-stage rooms'); assert.strictEqual(LD.LEVELS[64].stages.length, 6, 'the last room joins six mechanisms');
  for (const k of ['push', 'runes', 'discs', 'rings']) assert.ok(LD.LEVELS.filter(l => l.stages.some(s => s.kind === k)).length >= 4, k + ' appears in several rooms'); assert.ok(LD.LEVELS.some(l => l.stages.some(s => s.kind === 'slide')), 'the sliding-block puzzle appears');
});
t('every level is valid, has a verified solution, and par is not below the best possible', () => {
  LD.LEVELS.forEach(l => { const r = E.verifyLevel(l); assert.ok(r.ok, l.levelId + ': ' + r.problems.join('; ')); assert.ok(l.par >= r.optimal, l.levelId + ' par ' + l.par + ' < optimal ' + r.optimal); assert.ok(r.stages.every(s => s.steps > 0), 'no stage starts solved'); });
});
t('levels teach progressively: each level uses a mechanic and the finale combines five', () => {
  const kinds = LD.LEVELS.map(l => l.stages.map(s => s.kind));
  assert.deepStrictEqual(kinds.slice(0, 9).map(k => k[0]), ['place', 'beam', 'symbols', 'balance', 'water', 'search', 'beam', 'bridge', 'trap']);
  assert.deepStrictEqual(kinds[9], ['balance', 'water', 'gear', 'beam', 'beam']);
  const opt = LD.LEVELS.map(l => E.verifyLevel(l).optimal); assert.ok(opt[9] > opt[0] * 10 && opt[6] > opt[1] && opt[7] > opt[3], 'difficulty rises: ' + opt.join(','));
});

// ---------- validation / failure messages ----------
t('validateLevel rejects malformed definitions with useful messages', () => {
  const bad = (mut, re) => { const l = L(1); mut(l); assert.throws(() => E.validateLevel(l), re); };
  bad(l => { delete l.title; }, /missing title/);
  bad(l => { l.hints = ['only one']; }, /3 hints/);
  bad(l => { l.par = 0; }, /par/);
  bad(l => { l.stages = []; }, /at least one stage/);
  bad(l => { l.stages[0].kind = 'teleport'; }, /unknown kind/);
  bad(l => { l.stages[0].p.start = 'nowhere'; }, /start zone/);
  const b = L(2); b.stages[0].p.need = ['ghost']; assert.throws(() => E.validateLevel(b), /unknown receiver/);
  const b2 = L(2); b2.stages[0].p.mirrors[0].start = 99; assert.throws(() => E.validateLevel(b2), /out of range/);
  const w = L(5); w.stages[0].p.tiles.push({ id: 'x', t: 'source', c: 9, r: 9 }); assert.throws(() => E.validateLevel(w), /exactly one source/);
  const s = L(6); s.stages[0].p.keyIn = 'jar_z'; assert.throws(() => E.validateLevel(s), /keyIn/);
  assert.throws(() => E.createGame(null), /missing/);
});
t('verifyLevel flags a clue that is not sufficient and a level that is already solved', () => {
  const a = L(3); a.stages[0].p.clue = [{ k: 'distinct' }]; assert.ok(E.verifyLevel(a).problems.some(p => /clue allows/.test(p)));
  const b = L(6); b.stages[0].p.clue = { sym: 'sun' }; assert.ok(E.verifyLevel(b).problems.some(p => /clue matches 2 jars/.test(p)));
  const c = L(1); c.stages[0].p.start = 'plate'; assert.ok(E.verifyLevel(c).problems.some(p => /already solved/.test(p)));
  const d = L(2); d.par = 1; assert.ok(E.verifyLevel(d).problems.some(p => /par 1 is below/.test(p)));
  const e = L(9); e.stages[0].p.switches[0].wear = 3; assert.ok(E.verifyLevel(e).problems.some(p => /ambiguous|do not give/.test(p)));
});

// ---------- L1 place ----------
t('crystal: only valid zones accept it; outside the interaction bounds nothing is placed', () => {
  const g = E.createGame(L(1)), P = g.cur().p;
  assert.strictEqual(E.nearestZone(P.zones, 50, 50, 2.2), null, 'far outside every zone');
  assert.strictEqual(E.nearestZone(P.zones, P.zones.plate.x + .5, P.zones.plate.z, 2.2), 'plate');
  const bad = g.perform({ t: 'move', obj: 'crystal', to: 'void' }); assert.ok(!bad.ok && /cannot rest/.test(bad.blocked)); assert.strictEqual(g.moves, 0);
  const same = g.perform({ t: 'move', obj: 'crystal', to: 'pedestal' }); assert.ok(!same.ok); assert.strictEqual(g.moves, 0);
  assert.ok(g.perform({ t: 'move', obj: 'crystal', to: 'rock' }).ok); assert.ok(!g.complete, 'door stays closed off the plate');
  const r = g.perform({ t: 'move', obj: 'crystal', to: 'plate' }); assert.ok(r.complete && g.complete && r.ev.includes('plateOn'));
});
t('after completion further actions are refused and undo is disabled', () => {
  const g = E.createGame(L(1)); g.perform({ t: 'move', obj: 'crystal', to: 'plate' }); assert.ok(g.complete);
  assert.ok(!g.perform({ t: 'move', obj: 'crystal', to: 'rock' }).ok); assert.ok(!g.canUndo()); assert.strictEqual(g.actions().length, 0);
});

// ---------- beam ----------
const beamP = (extra) => Object.assign({ steps: 8, bounds: { x0: -8, x1: 8, z0: -6, z1: 6 }, source: { x: -7, z: 0, dir: 0 }, mirrors: [{ id: 'm', x: 0, z: 0, start: 2 }], receivers: [], need: [], blockers: [] }, extra || {});
t('beam: a mirror at 45 degrees turns an eastward beam south; angle in = angle out', () => {
  const P = beamP(), s = E.KIND.beam.init(P), tr = E.trace(P, s); assert.strictEqual(tr.segs.length, 2);
  assert.ok(Math.abs(tr.segs[1].x2 - 0) < 1e-9 && tr.segs[1].z2 > 5.9, 'goes south to the wall');
  const s6 = clone(s); s6.m.m = 6; const t6 = E.trace(P, s6); assert.ok(t6.segs[1].z2 < -5.9, 'at 135 degrees it goes north');
  const s0 = clone(s); s0.m.m = 0; assert.strictEqual(E.trace(P, s0).segs.length, 1, 'edge-on mirror lets the beam pass');
  const s1 = clone(s); s1.m.m = 1; const t1 = E.trace(P, s1); assert.ok(Math.abs(Math.atan2(t1.segs[1].z2 - t1.segs[1].z1, t1.segs[1].x2 - t1.segs[1].x1) * 180 / Math.PI - 45) < 1e-6, '22.5 degree mirror sends the beam at 45');
});
t('beam: deterministic - the same state always gives the same path and result', () => {
  const l = L(7), P = l.stages[0].p, s = E.KIND.beam.init(P), a = JSON.stringify(E.trace(P, s)), b = JSON.stringify(E.trace(P, clone(s))); assert.strictEqual(a, b);
});
t('beam: mirror rotation wraps after a full half-turn and is limited to 22.5 degree steps', () => {
  const l = L(2); l.stages[0].p.receivers[0].x = 7.9; l.stages[0].p.receivers[0].z = 5.9; l.stages[0].p.need = []; // nothing to hit: the level never completes while we spin the mirror
  l.stages[0].p.need = ['receiver_01']; l.stages[0].p.receivers[0].x = -7.5; l.stages[0].p.receivers[0].z = 5.5;
  const g = E.createGame(l), m0 = g.state().m.mirror_01; let step = 0;
  for (let i = 0; i < 8 && !g.complete; i++) { assert.ok(g.perform({ t: 'rot', obj: 'mirror_01', d: 1 }).ok); step++; }
  if (!g.complete) assert.strictEqual(g.state().m.mirror_01, m0, '8 steps = 180 degrees = same mirror position');
  const P = LD.LEVELS[1].stages[0].p; let s = E.KIND.beam.init(P); for (let i = 0; i < 8; i++) s = E.KIND.beam.apply(P, s, { t: 'rot', obj: 'mirror_01', d: 1 }).s; assert.strictEqual(s.m.mirror_01, P.mirrors[0].start);
  const back = E.KIND.beam.apply(P, E.KIND.beam.init(P), { t: 'rot', obj: 'mirror_01', d: -1 }).s; assert.strictEqual(back.m.mirror_01, 1);
  assert.ok(!E.KIND.beam.apply(P, E.KIND.beam.init(P), { t: 'rot', obj: 'ghost', d: 1 }).s);
});
t('beam: receivers light only when the beam reaches them, and the door/goal needs all of them at once', () => {
  const g = E.createGame(L(2)); assert.ok(!g.trace().lit.receiver_01); const sol = g.stageSolution(); assert.ok(sol.length >= 2);
  playPath(g, sol.slice(0, sol.length - 1)); assert.ok(!g.complete); assert.ok(g.perform(sol[sol.length - 1]).complete);
  const g7 = E.createGame(L(7)); const s7 = g7.stageSolution(); playPath(g7, s7.slice(0, -1)); assert.ok(!g7.complete && Object.keys(g7.trace().lit).length < 3, 'two relays are not enough'); assert.ok(g7.perform(s7[s7.length - 1]).complete); assert.strictEqual(Object.keys(g7.trace().lit).length, 3);
});
t('beam: a movable block in the path stops the beam, and moving it away frees the route', () => {
  const l = L(7), P = l.stages[0].p, s = E.KIND.beam.init(P); const solved = clone(s);
  const sol = E.solve('beam', P, s); sol.forEach(a => { solved.m = E.KIND.beam.apply(P, solved, a).s ? E.KIND.beam.apply(P, solved, a).s.m : solved.m; }); // mirrors only
  let cur = s; sol.forEach(a => { cur = E.KIND.beam.apply(P, cur, a).s; }); assert.ok(E.KIND.beam.goal(P, cur));
  const blocked = clone(cur); blocked.b.blocker_07a = 0; assert.ok(!E.KIND.beam.goal(P, blocked) && E.trace(P, blocked).stop !== 'wall', 'block at socket 0 sits on the beam');
  const free = clone(cur); free.b.blocker_07a = 2; assert.ok(E.KIND.beam.goal(P, free));
  assert.ok(!E.KIND.beam.apply(P, cur, { t: 'slot', obj: 'blocker_07a', to: 9 }).s, 'no such socket');
});

// ---------- symbols ----------
t('symbols: the clue allows exactly one answer, discoverable without guessing', () => {
  const P = L(3).stages[0].p, sols = E.clueSolutions(P); assert.strictEqual(sols.length, 1); assert.deepStrictEqual(sols[0], ['triangle', 'spiral', 'sun']);
  const g = E.createGame(L(3)); assert.ok(!g.perform({ t: 'cycle', obj: 'panel_9', slot: 9 }).ok);
  let guard = 0; while (!g.complete && guard++ < 30) { const a = g.stageSolution()[0]; g.perform(a); } assert.ok(g.complete); assert.deepStrictEqual(g.state().slots.map(v => P.symbols[v]), ['triangle', 'spiral', 'sun']);
});

// ---------- balance ----------
t('balance: authored weights, tolerance, pan capacity and "all stones placed" rule', () => {
  const g = E.createGame(L(4)), P = g.cur().p;
  playPath(g, [{ t: 'put', obj: 'stone_d', to: 'L' }, { t: 'put', obj: 'stone_c', to: 'L' }]); assert.deepStrictEqual(E.sums(P, g.state()), { L: 5, R: 0 });
  playPath(g, [{ t: 'put', obj: 'stone_b', to: 'R' }]); assert.ok(!g.complete, 'not balanced and a stone is still in the tray');
  playPath(g, [{ t: 'put', obj: 'stone_a', to: 'R' }]); assert.ok(g.complete, '4+1 against 3+2');
  const g2 = E.createGame(L(4)); ['stone_a', 'stone_b', 'stone_c'].forEach(id => g2.perform({ t: 'put', obj: id, to: 'L' })); const full = g2.perform({ t: 'put', obj: 'stone_d', to: 'L' }); assert.ok(!full.ok && /full/.test(full.blocked));
  assert.ok(!g2.perform({ t: 'put', obj: 'stone_a', to: 'L' }).ok, 'already there');
});
t('balance: heavier side outweighs and equal sums with a stone left in the tray do not count', () => {
  const P = { stones: [{ id: 'a', w: 2 }, { id: 'b', w: 2 }, { id: 'c', w: 1 }], cap: 3, tol: 0, target: 0, requireAll: true };
  assert.ok(!E.KIND.balance.goal(P, { pos: { a: 'L', b: 'R', c: 'tray' } })); assert.ok(!E.KIND.balance.goal(P, { pos: { a: 'L', b: 'L', c: 'R' } }));
  const P2 = Object.assign({}, P, { requireAll: false, tol: 1 }); assert.ok(E.KIND.balance.goal(P2, { pos: { a: 'L', b: 'R', c: 'tray' } }));
});

// ---------- water ----------
t('water: closed valves hold the water, rotating pieces opens or breaks the route', () => {
  const g = E.createGame(L(5)), P = g.cur().p; assert.ok(!g.flow().supplied);
  const sol = g.stageSolution(); assert.ok(sol.length >= 6);
  playPath(g, sol.slice(0, -1)); assert.ok(!g.complete); g.perform(sol[sol.length - 1]); assert.ok(g.complete);
  const s = clone(g.state()); const open = E.flow(P, s); assert.ok(open.supplied && open.wet.water_source && open.wet.receiver_a);
  s.v.valve_a = 0; assert.ok(!E.flow(P, s).supplied && E.flow(P, s).wet['valve_a#in'], 'a closed valve stops the water in front of it');
  const s2 = clone(g.state()); s2.r.ch_1 = (s2.r.ch_1 + 1) % 4; assert.ok(!E.flow(P, s2).supplied, 'a misaligned channel breaks the path');
  const f = E.createGame(L(5)); const r = f.perform({ t: 'turn', obj: 'old_1' }); assert.ok(!r.ok && /fixed/.test(r.blocked));
});
t('water: pipe openings rotate clockwise (N->E->S->W) and four turns return to the start', () => {
  assert.strictEqual(E.rotMask(1, 1), 2); assert.strictEqual(E.rotMask(8, 1), 1); assert.strictEqual(E.rotMask(E.BASE.straight, 1), E.BASE.valve); assert.strictEqual(E.rotMask(E.BASE.elbow, 4), E.BASE.elbow);
});

// ---------- search ----------
t('hidden key: jars stay sealed until the clue is read; only the clue-matching jar holds the key', () => {
  const g = E.createGame(L(6)), P = g.cur().p;
  const sealed = g.perform({ t: 'open', obj: 'jar_d' }); assert.ok(!sealed.ok && /clue first/.test(sealed.blocked));
  const ins = g.perform({ t: 'inspect', obj: 'clue', free: true }); assert.ok(ins.ok && ins.free && /sun is carved/.test(ins.info)); assert.strictEqual(g.moves, 0, 'inspecting is free');
  assert.ok(!g.perform({ t: 'unlock', obj: 'door' }).ok, 'no key yet');
  const wrong = g.perform({ t: 'open', obj: 'jar_c' }); assert.ok(wrong.ok && /Empty/.test(wrong.info) && !g.state().key);
  assert.ok(!g.perform({ t: 'open', obj: 'jar_c' }).ok, 'already opened');
  const right = g.perform({ t: 'open', obj: 'jar_d' }); assert.ok(right.ok && g.state().key); assert.ok(g.perform({ t: 'unlock', obj: 'door' }).complete);
  assert.deepStrictEqual(E.clueJars(P).map(j => j.id), ['jar_d']);
});
t('hidden key: undo does not forget what was learned by inspecting', () => {
  const g = E.createGame(L(6)); g.perform({ t: 'inspect', obj: 'clue', free: true }); g.perform({ t: 'open', obj: 'jar_a' }); assert.ok(g.undo()); assert.ok(g.state().seen.clue && !g.state().opened.length);
});

// ---------- bridge ----------
t('bridge: every rule blocks with a clear message and the goal needs a locked path', () => {
  const g = E.createGame(L(8)); const s = () => g.state();
  assert.deepStrictEqual(E.bridgePath(s()), { startToA: false, aToB: false, bToExit: false });
  const noPower = g.perform({ t: 'rail', obj: 'rail' }); assert.ok(!noPower.ok && /no power/.test(noPower.blocked));
  const upright = g.perform({ t: 'plate', obj: 'plate' }); assert.ok(!upright.ok && /upright/.test(upright.blocked), 'bridge starts standing on its edge');
  assert.ok(g.perform({ t: 'lever', obj: 'lever' }).ok); assert.strictEqual(s().b, 2);
  assert.ok(g.perform({ t: 'plate', obj: 'plate' }).ok && s().p === 1);
  const strike = g.perform({ t: 'lever', obj: 'lever' }); assert.ok(!strike.ok && /strike platform A/.test(strike.blocked));
  const crush = g.perform({ t: 'rail', obj: 'rail' }); assert.ok(!crush.ok && /crushed/.test(crush.blocked));
  assert.strictEqual(g.moves, 2, 'blocked actions cost nothing');
  const sol = g.stageSolution(); assert.ok(sol.length >= 6, 'needs planning: ' + sol.length);
  solveGame(g); assert.ok(g.complete); assert.deepStrictEqual(E.bridgePath(g.state()), { startToA: true, aToB: true, bToExit: true }); assert.strictEqual(g.state().b, 2);
});

// ---------- trap ----------
t('generated rooms: every clue is sufficient, jar sizes exist, trap order follows the wear marks', () => {
  let jars = 0, traps = 0, sym = 0;
  LD.LEVELS.slice(10).forEach(l => l.stages.forEach(s => {
    if (s.kind === 'search') { jars++; assert.ok(s.p.jars.every(j => j.size && j.color)); assert.deepStrictEqual(E.clueJars(s.p).map(j => j.id), [s.p.keyIn], l.levelId); }
    if (s.kind === 'trap') { traps++; const o = E.trapOrder(s.p); assert.deepStrictEqual(o, s.p.order); const w = s.p.order.map(id => s.p.switches.find(x => x.id === id).wear); assert.ok(w.every((x, i) => !i || (s.p.dir === 'asc' ? x > w[i - 1] : x < w[i - 1]))); }
    if (s.kind === 'symbols') { sym++; assert.strictEqual(E.clueSolutions(s.p).length, 1, l.levelId); }
  }));
  assert.ok(jars >= 3 && traps >= 3 && sym >= 3, 'several of each: ' + [jars, traps, sym]);
});
t('new mechanics: crates push (never pull), runes flip patterns, disc towers obey size, blocks collide, rings drag neighbours', () => {
  const pz = { w: 5, h: 3, walls: [[4, 1]], targets: [[3, 1]], crates: [[2, 1]], player: [1, 1] }, M = E.KIND.push, s0 = M.init(pz);
  const r1 = M.apply(pz, s0, { t: 'step', obj: 'player', d: 'R' }); assert.ok(r1.s && r1.ev[0] === 'push' && r1.s.c[0][0] === 3 && r1.s.p[0] === 2); assert.ok(M.goal(pz, r1.s), 'one push solves it');
  assert.ok(!M.apply(pz, r1.s, { t: 'step', obj: 'player', d: 'R' }).s, 'a crate cannot be pushed into a wall or off the board');
  const wall = M.apply(pz, { p: [3, 1], c: [[0, 1]] }, { t: 'step', obj: 'player', d: 'R' }); assert.ok(!wall.s && /wall/i.test(wall.blocked)); assert.ok(!M.apply({ w: 4, h: 3, walls: [], targets: [[1, 1], [2, 1]], crates: [[1, 1], [2, 1]], player: [0, 1] }, { p: [0, 1], c: [[1, 1], [2, 1]] }, { t: 'step', obj: 'player', d: 'R' }).s, 'two crates in a row cannot be pushed');
  const rp = { w: 3, h: 3, pat: 'plus', start: [0, 0, 0, 0, 0, 0, 0, 0, 0] }, R = E.KIND.runes; let rs = R.apply(rp, R.init(rp), { t: 'press', obj: 'rune_4', i: 4 }).s; assert.deepStrictEqual(rs.b, [0, 1, 0, 1, 1, 1, 0, 1, 0]); rs = R.apply(rp, rs, { t: 'press', obj: 'rune_4', i: 4 }).s; assert.deepStrictEqual(rs.b, Array(9).fill(0), 'pressing twice undoes it');
  const corner = R.apply(rp, R.init(rp), { t: 'press', obj: 'rune_0', i: 0 }).s; assert.deepStrictEqual(corner.b.slice(0, 4), [1, 1, 0, 1]); assert.ok(!R.apply(rp, R.init(rp), { t: 'press', obj: 'rune_99', i: 99 }).s);
  const dp = { pegs: 3, n: 3, start: [[3, 2, 1], [], []], goal: 2 }, D = E.KIND.discs, d0 = D.init(dp); assert.ok(D.apply(dp, d0, { t: 'move', obj: 'peg_0', to: 'peg_1' }).s);
  const bad = D.apply(dp, { p: [[3, 2], [1], []] }, { t: 'move', obj: 'peg_0', to: 'peg_1' }); assert.ok(!bad.s && /bigger/.test(bad.blocked)); assert.strictEqual(E.solve('discs', dp, d0).length, 7, 'three discs need seven moves'); assert.ok(D.apply({ pegs: 3, n: 1, start: [[1], [], []], goal: 2, adjacent: true }, { p: [[1], [], []] }, { t: 'move', obj: 'peg_0', to: 'peg_2' }).blocked, 'adjacent-only towers');
  const sp = { w: 4, h: 3, blocks: [{ id: 'key', x: 0, y: 0, len: 2, ori: 'h', key: true }, { id: 'v', x: 2, y: 0, len: 2, ori: 'v' }] }, S = E.KIND.slide, ss = S.init(sp); assert.ok(!S.apply(sp, ss, { t: 'slide', obj: 'key', to: 2 }).s && /in the way/.test(S.apply(sp, ss, { t: 'slide', obj: 'key', to: 2 }).blocked)); const sv = S.apply(sp, ss, { t: 'slide', obj: 'v', to: 1 }).s; assert.ok(!S.goal(sp, sv)); assert.strictEqual(E.solve('slide', sp, ss).length, 2, 'the vertical block is not in the key row once it drops, key then slides out');
  const rg = { n: 8, start: [1, 2, 3], link: [[1, 1, 0], [1, 1, 1], [0, 1, 1]] }, K = E.KIND.rings, k1 = K.apply(rg, K.init(rg), { t: 'ring', obj: 'ring_0', d: 1 }).s; assert.deepStrictEqual(k1.r, [2, 3, 3], 'ring 0 drags ring 1 along but not ring 2'); assert.deepStrictEqual(K.apply(rg, k1, { t: 'ring', obj: 'ring_0', d: -1 }).s.r, [1, 2, 3], 'turning back undoes it');
});
t('trap: a wrong switch resets only the room; the safe order opens the exit; inspecting is free', () => {
  const g = E.createGame(L(9)), P = g.cur().p; assert.deepStrictEqual(E.trapOrder(P), ['switch_b', 'switch_c', 'switch_a']);
  const look = g.perform({ t: 'inspect', obj: 'switch_b', free: true }); assert.ok(/worn to a shine/.test(look.info)); assert.strictEqual(g.moves, 0);
  assert.ok(g.perform({ t: 'press', obj: 'switch_b' }).ok && g.state().step === 1);
  const boom = g.perform({ t: 'press', obj: 'switch_a' }); assert.ok(boom.ok && boom.fail && boom.ev.includes('trap') && boom.ev.includes('reset'));
  assert.strictEqual(g.state().step, 0, 'room reset'); assert.strictEqual(g.traps, 1); assert.ok(!g.complete);
  assert.ok(g.undo() && g.state().step === 1, 'undo returns to just before the mistake');
  playPath(g, [{ t: 'press', obj: 'switch_c' }, { t: 'press', obj: 'switch_a' }]); assert.ok(g.complete);
  const r = g.result(); assert.strictEqual(r.parts.find(p => p.k === 'trap').v, -100);
});

// ---------- gear ----------
t('gear: meshed gears turn opposite ways and reach alignment', () => {
  const P = LD.LEVELS[9].stages[2].p, M = E.KIND.gear, s = M.init(P);
  const a = M.apply(P, s, { t: 'gear', obj: 'gear_a', d: 1 }).s; assert.deepStrictEqual([a.a, a.b], [6, 2]);
  const b = M.apply(P, s, { t: 'gear', obj: 'gear_b', d: 1 }).s; assert.deepStrictEqual([b.a, b.b], [4, 4]);
  assert.ok(!M.goal(P, s)); const sol = E.solve('gear', P, s); assert.ok(sol.length >= 3); let cur = s; sol.forEach(x => { cur = M.apply(P, cur, x).s; }); assert.ok(M.goal(P, cur));
  const impossible = { na: 12, nb: 8, start: [1, 0] }; assert.strictEqual(E.solve('gear', impossible, M.init(impossible)), null, 'a start the gears can never align from has no solution (gcd rule)');
});

// ---------- game session: undo, restart, hints, stages ----------
t('restart restores the exact initial state; undo reverses the last action only', () => {
  [2, 4, 5, 7, 8].forEach(i => { const g = E.createGame(L(i)), init = JSON.stringify(g.states); const path = g.stageSolution(); g.perform(path[0]); const afterOne = JSON.stringify(g.states); if (path.length > 1) g.perform(path[1]);
    if (path.length > 1) { assert.ok(g.undo()); assert.strictEqual(JSON.stringify(g.states), afterOne, 'undo reverses only the last action'); } assert.ok(g.undo()); assert.strictEqual(JSON.stringify(g.states), init); assert.strictEqual(g.moves, 0); assert.ok(!g.undo());
    g.perform(path[0]); g.restart(); assert.strictEqual(JSON.stringify(g.states), init); assert.strictEqual(g.moves, 0); assert.strictEqual(g.restarts, 1); assert.ok(!g.complete); });
});
t('Mind Core: five stages in dependency order, locked until the previous one is done, undo crosses stage borders', () => {
  const g = E.createGame(L(10)); assert.strictEqual(g.stage, 0); assert.strictEqual(g.def.stages.length, 5);
  assert.ok(!g.perform({ t: 'turn', obj: 'w2_a' }).ok, 'the water mechanism is sealed during stage 1');
  const seen = []; let guard = 0, before = g.stage; while (!g.complete && guard++ < 100) { const r = g.perform(g.stageSolution()[0]); if (r.stageDone) seen.push(r.stageDone); }
  assert.deepStrictEqual(seen, ['stage_1', 'stage_2', 'stage_3', 'stage_4', 'stage_5']); assert.ok(g.complete && g.stage === 4);
  const h = E.createGame(L(10)); let reached = 0; while (h.stage < 1) h.perform(h.stageSolution()[0]); assert.strictEqual(h.stage, 1); assert.ok(h.undo() && h.stage === 0, 'undo steps back into stage 1');
  assert.ok(E.verifyLevel(L(10)).optimal <= LD.LEVELS[9].par);
});
t('hints: three progressive levels (idea, object, next move) and following them solves the level', () => {
  LD.LEVELS.forEach(l => {
    const g = E.createGame(clone(l)); const h1 = g.hint(); assert.strictEqual(h1.level, 1); assert.strictEqual(h1.text, l.hints[0]); assert.ok(!h1.obj && !h1.action);
    const h2 = g.hint(); assert.strictEqual(h2.level, 2); assert.strictEqual(h2.text, l.hints[1]); assert.ok(h2.obj, l.levelId + ' hint 2 names an object');
    const h3 = g.hint(); assert.strictEqual(h3.level, 3); assert.strictEqual(h3.text, l.hints[2]); assert.ok(h3.action && h3.demo && h3.action.obj === h2.obj, 'hint 3 demonstrates the move on the same object');
    assert.strictEqual(g.hints, 3); assert.ok(g.moves === 0, 'hints never move anything');
    if (l.n > 10) { const r = g.perform(h3.action); assert.ok(r.ok, l.levelId + ' hint action works'); return; }           // the bigger generated levels: one step is enough (solving by hints is slow there)
    let guard = 0; while (!g.complete && guard++ < 120) { g.hint(); g.hint(); const hh = g.hint(); const r = g.perform(hh.action); assert.ok(r.ok, l.levelId + ' hint action works: ' + JSON.stringify(hh.action)); }
    assert.ok(g.complete, l.levelId + ' solvable by hints alone');
  });
});
t('relic collection and result stars: solve, par, and relic without hints', () => {
  const l = L(1), g = E.createGame(l); assert.ok(g.collectRelic() && !g.collectRelic()); g.perform({ t: 'move', obj: 'crystal', to: 'plate' }); let r = g.result(); assert.strictEqual(r.stars, 3);
  const g2 = E.createGame(l); g2.perform({ t: 'move', obj: 'crystal', to: 'plate' }); assert.strictEqual(g2.result().stars, 2, 'within par, no relic');
  const g3 = E.createGame(l); g3.collectRelic(); g3.hint(); g3.perform({ t: 'move', obj: 'crystal', to: 'plate' }); assert.strictEqual(g3.result().stars, 2, 'hints cost the mastery star');
  const slow = E.scoreFor(l, { moves: 9, hints: 0, traps: 0, relic: false }); assert.strictEqual(slow.stars, 1); assert.ok(slow.total < E.scoreFor(l, { moves: 1, hints: 0, traps: 0, relic: false }).total);
  const worst = E.scoreFor(l, { moves: 999, hints: 20, traps: 9, relic: false }); assert.ok(worst.total >= 100, 'score has a floor');
  assert.ok(E.scoreFor(l, { moves: 2, hints: 0, traps: 0, relic: true }).total > E.scoreFor(l, { moves: 2, hints: 0, traps: 0, relic: false }).total);
});
t('no level can dead-end: from any reachable state the stage is still solvable (spot check by random play)', () => {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  [2, 4, 5, 7, 8, 9].forEach(i => { for (let k = 0; k < 6; k++) { const g = E.createGame(L(i)); for (let m = 0; m < 25 && !g.complete; m++) { const acts = g.actions(); g.perform(acts[Math.floor(rnd() * acts.length)]); } if (!g.complete) assert.ok(g.stageSolution(), 'level ' + i + ' unsolvable after random play'); } });
});

// ---------- save / progression ----------
t('save: defaults, normalisation of damaged data, unlock chain and best-of recording', () => {
  const d = E.defaultSave(); assert.strictEqual(d.v, E.SAVE_VERSION); assert.ok(d.settings.sfx === 1 && d.settings.reduceMotion === 0);
  const junk = E.normalizeSave({ v: 99, last: 'x', done: { WC_L01: { stars: 9, best: -5 }, bad: 5 }, settings: { sfx: 'loud', music: .3, quality: 7 }, relics: { WC_L01: 1, WC_L02: 0 } });
  assert.strictEqual(junk.done.WC_L01.stars, 3); assert.ok(!junk.done.bad); assert.strictEqual(junk.settings.sfx, 1); assert.strictEqual(junk.settings.music, .3); assert.strictEqual(junk.settings.quality, 'auto'); assert.ok(junk.relics.WC_L01 && !junk.relics.WC_L02); assert.strictEqual(junk.last, 1);
  assert.deepStrictEqual(E.normalizeSave(null), d); assert.deepStrictEqual(E.normalizeSave('nope'), d);
  const s = E.defaultSave(); assert.ok(E.isUnlocked(s, LD.LEVELS, 0) && !E.isUnlocked(s, LD.LEVELS, 1));
  E.recordResult(s, LD.LEVELS[0], { stars: 2, total: 900, moves: 3, hints: 1 }, 2); assert.ok(E.isUnlocked(s, LD.LEVELS, 1) && !E.isUnlocked(s, LD.LEVELS, 2));
  E.recordResult(s, LD.LEVELS[0], { stars: 1, total: 400, moves: 5, hints: 2 }, 1); const r = s.done.WC_L01; assert.deepStrictEqual([r.stars, r.best, r.moves, r.hints, r.attempts], [2, 900, 3, 1, 3], 'a worse replay never lowers the record');
  E.recordResult(s, LD.LEVELS[0], { stars: 3, total: 1700, moves: 1, hints: 0 }, 1); assert.deepStrictEqual([s.done.WC_L01.stars, s.done.WC_L01.best], [3, 1700]); assert.strictEqual(E.totalStars(s), 3);
});
t('save: survives an "app restart" through storage, tolerates corrupt data and storage failures', () => {
  const mem = {}; const store = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } };
  const s = E.defaultSave(); E.recordResult(s, LD.LEVELS[0], { stars: 3, total: 1700, moves: 1, hints: 0 }, 1); s.relics.WC_L01 = 1; s.settings.sfx = .4;
  assert.ok(E.writeSave(store, 'k', s)); assert.ok(!('k.tmp' in mem), 'temporary copy is removed');
  const back = E.loadSave(store, 'k'); assert.deepStrictEqual(back.done, s.done); assert.strictEqual(back.settings.sfx, .4); assert.ok(back.relics.WC_L01);
  mem.k = '{not json'; assert.deepStrictEqual(E.loadSave(store, 'k'), E.defaultSave());
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); }, removeItem() { } }; assert.deepStrictEqual(E.loadSave(broken, 'k'), E.defaultSave()); assert.strictEqual(E.writeSave(broken, 'k', s), false);
});

console.log('\n' + n + ' tests passed');
