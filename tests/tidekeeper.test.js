// Run: node tests/tidekeeper.test.js
const assert = require('assert');
const E = require('../games/tidekeeper-engine.js');
const LD = require('../games/tidekeeper-levels.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const P = def => E.parse(def);
const lvl = i => E.parse(LD.LEVELS[i - 1]);
const run = (L, acts) => E.replay(L, acts);

// ---------- terrain & tide ----------
t('parse reads rock, sand and open cells; rejects ragged rows and bad characters', () => {
  const L = P({ rows: ['   ', '#==', '###'], tideMax: 2, tide0: 0, ents: [] });
  assert.strictEqual(E.at(L, 0, 0), E.OPEN); assert.strictEqual(E.at(L, 0, 1), E.ROCK); assert.strictEqual(E.at(L, 1, 1), E.SAND);
  assert.ok(E.solid(L, 1, 1) && !E.solid(L, 1, 0));
  assert.ok(E.solid(L, -1, 0) && E.solid(L, 99, 0), 'off-board counts as solid');
  assert.throws(() => P({ rows: ['   ', '##'], tideMax: 1, tide0: 0, ents: [] }), /ragged/);
  assert.throws(() => P({ rows: ['x'], tideMax: 1, tide0: 0, ents: [] }), /bad terrain/);
});
t('the sea is a flat line: tide N floods the bottom N rows, and never solid cells', () => {
  const L = P({ rows: ['    ', '    ', '    ', '#  #'], tideMax: 3, tide0: 0, ents: [] });
  assert.ok(!E.wet(L, 0, 1, 3), 'tide 0 floods nothing');
  assert.ok(E.wet(L, 1, 1, 3) && !E.wet(L, 1, 1, 2), 'tide 1 floods only the bottom row');
  assert.ok(E.wet(L, 2, 1, 2) && E.wet(L, 2, 1, 3));
  assert.ok(!E.wet(L, 3, 0, 3), 'rock never holds water');
  assert.strictEqual(E.surfaceRow(L, 2), 2, 'the surface sits at row h - tide');
});
t('tide is clamped at 0 and tideMax', () => {
  const L = P({ rows: ['  ', '  ', '##'], tideMax: 2, tide0: 0, ents: [{ t: 'c', x: 0, y: 1, hx: 1, hy: 0 }] });
  let S = E.initial(L);
  S = E.step(L, S, 'D'); assert.strictEqual(S.tide, 0, 'cannot go below 0');
  S = E.step(L, S, 'U'); S = E.step(L, S, 'U'); S = E.step(L, S, 'U');
  assert.strictEqual(S.tide, 2, 'cannot go above tideMax');
  assert.strictEqual(S.moves, 4, 'a wasted push still costs a turn');
});

// ---------- creatures ----------
t('fish swims through water only, and reaches its reef', () => {
  const L = P({ rows: ['     ', '     ', '#####'], tideMax: 2, tide0: 2, ents: [{ t: 'f', x: 0, y: 1, hx: 4, hy: 1 }] });
  const r = run(L, 'WWWW'); assert.ok(r.win); assert.strictEqual(r.state.ents[0].x, 4);
});
t('fish cannot cross a ridge until the sea rises above it', () => {
  const L = P({ rows: ['          ', '          ', '    ##    ', '    ##    ', '          ', '##########'], tideMax: 4, tide0: 1, ents: [{ t: 'f', x: 1, y: 4, hx: 8, hy: 4 }] });
  assert.ok(!run(L, 'WWWWWWWWWW').win, 'waiting at a low sea never works');
  const sol = E.solve(L, 20); assert.ok(sol && /^U+$/.test(sol.solution), 'the answer is to raise the sea: ' + sol.solution);
  assert.ok(run(L, sol.solution).win);
});
t('a beached fish suffocates after BREATH turns', () => {
  const L = P({ rows: ['    ', '    ', '####'], tideMax: 2, tide0: 2, ents: [{ t: 'f', x: 0, y: 1, hx: 3, hy: 0 }] });
  let S = E.initial(L); S = E.step(L, S, 'D');
  assert.strictEqual(S.ents[0].b, 1, 'gasping starts as soon as the water leaves');
  S = E.step(L, S, 'W'); S = E.step(L, S, 'W');
  assert.strictEqual(S.ents[0].b, 3); assert.ok(!S.dead, 'still alive on the last breath');
  S = E.step(L, S, 'W');
  assert.ok(S.dead, 'suffocated after BREATH turns'); assert.ok(!E.isWin(S));
  assert.strictEqual(E.BREATH, 4);
});
t('a fish sinks with a falling sea instead of hanging in mid-air', () => {
  const L = P({ rows: ['    ', '    ', '    ', '####'], tideMax: 3, tide0: 3, ents: [{ t: 'f', x: 0, y: 0, hx: 3, hy: 2 }] });
  let S = E.initial(L); S = E.step(L, S, 'D');
  assert.ok(S.ents[0].y >= 1, 'followed the surface down, y=' + S.ents[0].y);
});
t('deer walks dry ground, steps up and down one, and will not enter water', () => {
  const L = P({ rows: ['      ', '      ', '  ##  ', '######'], tideMax: 2, tide0: 0, ents: [{ t: 'd', x: 0, y: 2, hx: 5, hy: 2 }] });
  assert.ok(run(L, 'WWWWWWWW').win, 'climbs over the step');
  assert.ok(E.canOccupy(L, 0, 'd', 0, 2)); assert.ok(!E.canOccupy(L, 2, 'd', 0, 2), 'flooded ground is not walkable');
  assert.ok(!E.canOccupy(L, 0, 'd', 0, 0), 'cannot stand in mid-air');
});
t('deer drowns if left underwater, and is safe the moment the sea drops', () => {
  const L = P({ rows: ['    ', '    ', '    ', '####'], tideMax: 3, tide0: 0, ents: [{ t: 'd', x: 0, y: 2, hx: 3, hy: 0 }] });
  let S = E.initial(L);
  S = E.step(L, S, 'U');
  assert.strictEqual(S.ents[0].b, 0, 'tide 1 only covers the rock, the deer stays dry');
  S = E.step(L, S, 'U');
  assert.strictEqual(S.ents[0].b, 1, 'now it is underwater');
  S = E.step(L, S, 'D'); assert.strictEqual(S.ents[0].b, 0, 'breath resets the moment it surfaces');
  S = E.step(L, S, 'U'); S = E.step(L, S, 'W'); S = E.step(L, S, 'W');
  assert.ok(!S.dead); S = E.step(L, S, 'W');
  assert.ok(S.dead, 'drowned');
});

t('crab walks underwater and never drowns', () => {
  const L = P({ rows: ['      ', '      ', '######'], tideMax: 2, tide0: 2, ents: [{ t: 'c', x: 0, y: 1, hx: 5, hy: 1 }] });
  const r = run(L, 'WWWWWW'); assert.ok(r.win && !r.dead);
  assert.ok(E.canOccupy(L, 2, 'c', 3, 1), 'submerged ground is fine for a crab');
});
t('turtle swims and walks, but only nests on DRY sand', () => {
  const L = P({ rows: ['      ', '      ', '    ==', '######'], tideMax: 3, tide0: 3, ents: [{ t: 't', x: 0, y: 2, hx: 5, hy: 1 }] });
  let S = E.initial(L);
  for (let i = 0; i < 8; i++) S = E.step(L, S, 'W');
  assert.ok(S.ents[0].x === 5 && S.ents[0].y === 1, 'it swims to the nest and waits on it');
  assert.ok(!E.isWin(S), 'a flooded nest does not count');
  S = E.step(L, S, 'D');
  assert.ok(E.isWin(S), 'dropping the sea beaches it on the nest');
});

t('seed has no will: it floats to the surface, drifts on the current and roots where the sea leaves it', () => {
  const L = P({ rows: ['        ', '        ', '        ', '###  ###'], tideMax: 3, tide0: 3, cur: 1, ents: [{ t: 's', x: 1, y: 0, hx: 4, hy: 3 }] });
  const sol = E.solve(L, 20);
  assert.ok(sol, 'solvable'); assert.ok(/D/.test(sol.solution), 'the sea must fall for it to root');
  const r = run(L, sol.solution); assert.ok(r.win);
  let S = E.initial(L); S = E.step(L, S, 'W'); const x1 = S.ents[0].x; S = E.step(L, S, 'W');
  assert.strictEqual(S.ents[0].x, x1 + 1, 'drifts one cell per turn with the current');
});
t('a creature that is home is safe forever, whatever the tide does', () => {
  const L = P({ rows: ['    ', '    ', '####'], tideMax: 2, tide0: 2, ents: [{ t: 'f', x: 0, y: 1, hx: 1, hy: 1 }] });
  let S = E.step(L, E.initial(L), 'W');
  assert.ok(E.isWin(S));
  for (let i = 0; i < 6; i++) S = E.step(L, S, 'D');
  assert.ok(E.isWin(S) && !S.dead, 'a home fish does not suffocate when the pool drains');
});
t('a stranded creature with no route simply waits instead of crashing', () => {
  const L = P({ rows: ['  #  ', '  #  ', '#####'], tideMax: 2, tide0: 0, ents: [{ t: 'd', x: 0, y: 1, hx: 4, hy: 1 }] });
  const r = run(L, 'WWWWW'); assert.ok(!r.win && !r.dead); assert.strictEqual(r.state.ents[0].x, 0);
});

// ---------- solver ----------
t('solver returns the SHORTEST action string, and replay confirms it', () => {
  const L = P({ rows: ['          ', '          ', '    ##    ', '    ##    ', '          ', '##########'], tideMax: 4, tide0: 1, ents: [{ t: 'f', x: 1, y: 4, hx: 8, hy: 4 }] });
  const r = E.solve(L, 20);
  assert.strictEqual(r.moves, r.solution.length);
  assert.ok(run(L, r.solution).win);
  for (let shorter = 1; shorter < r.moves; shorter++) assert.ok(!run(L, r.solution.slice(0, shorter)).win, 'no prefix wins early');
  assert.strictEqual(E.solve(L, r.moves - 1, 400000), null, 'no solution exists below par');
});
t('solver reports null for an impossible level', () => {
  const L = P({ rows: ['  #  ', '  #  ', '#####'], tideMax: 2, tide0: 0, ents: [{ t: 'd', x: 0, y: 1, hx: 4, hy: 1 }] });
  assert.strictEqual(E.solve(L, 12), null);
});
t('the engine is deterministic: identical actions give identical states', () => {
  const L = lvl(55), a = run(L, 'UUDWUDWU'), b = run(L, 'UUDWUDWU');
  assert.strictEqual(E.key(a.state), E.key(b.state));
});
t('hint gives a legal next move that keeps the level winnable', () => {
  [1, 12, 25, 34, 47, 58].forEach(i => {
    const L = lvl(i); let S = E.initial(L);
    const h = E.hint(L, S, L.par + 4);
    assert.ok(h && 'UDW'.indexOf(h) >= 0, 'level ' + i + ' hint: ' + h);
    S = E.step(L, S, h);
    assert.ok(E.solve(L, L.par + 4, 300000, S), 'still winnable after taking the hint on level ' + i);
  });
  const dead = { tide: 0, ents: [{ x: 0, y: 0, b: 0, done: false }], dead: true, moves: 0 };
  assert.strictEqual(E.hint(lvl(1), dead), null);
});

// ---------- the 100 shipped levels ----------
t('campaign: 100 levels across 10 worlds', () => {
  assert.strictEqual(LD.LEVELS.length, 100); assert.strictEqual(E.WORLDS.length, 10);
  LD.LEVELS.forEach((d, i) => { assert.strictEqual(d.index, i + 1); assert.strictEqual(d.world, Math.floor(i / 10)); });
});
for (let i = 1; i <= 100; i++) t('level ' + i + ': stored solution wins, par is exact, nothing dies', () => {
  const d = LD.LEVELS[i - 1], L = lvl(i);
  const r = run(L, d.solution);
  assert.ok(r.win, 'solution wins'); assert.ok(!r.dead, 'nothing dies on the way');
  assert.strictEqual(d.par, d.solution.length);
  assert.strictEqual(r.moves, d.par, 'par matches the moves used');
  assert.ok(d.moves > d.par, 'the player gets more turns than par');
  assert.ok(!E.isWin(E.initial(L)), 'not already won');
  assert.ok(/[UD]/.test(d.solution), 'the tide has to move');
  d.ents.forEach(e => {
    assert.ok(E.NAMES[e.t], 'known creature');
    assert.ok(!(e.x === e.hx && e.y === e.hy), 'does not start at home');
    if (e.t !== 's') assert.ok(E.canOccupy(L, d.tide0, e.t, e.x, e.y), 'starts somewhere it can legally be');
  });
});
t('shortest-solution check: no shipped level can be beaten in fewer moves than its par', () => {
  [1, 7, 15, 23, 31, 44, 52, 66, 73, 88, 95].forEach(i => {
    const d = LD.LEVELS[i - 1], L = lvl(i);
    assert.strictEqual(E.solve(L, d.par - 1, 400000), null, 'level ' + i + ' par ' + d.par + ' is truly minimal');
  });
});
t('difficulty ramps: later worlds need longer tide sequences and more creatures', () => {
  const avgPar = w => { const a = LD.LEVELS.filter(l => l.world === w); return a.reduce((s, l) => s + l.par, 0) / a.length; };
  assert.ok(avgPar(9) > avgPar(0) + 5, 'world 10 par ' + avgPar(9) + ' vs world 1 ' + avgPar(0));
  assert.ok(avgPar(6) > avgPar(1));
  const maxEnts = w => Math.max(...LD.LEVELS.filter(l => l.world === w).map(l => l.ents.length));
  assert.strictEqual(maxEnts(0), 1); assert.ok(maxEnts(8) >= 3);
  assert.ok(Math.max(...LD.LEVELS.map(l => l.tideMax)) >= 7);
});
t('each world introduces its creature, and every creature type is used', () => {
  const types = w => new Set([].concat(...LD.LEVELS.filter(l => l.world === w).map(l => l.ents.map(e => e.t))));
  assert.deepStrictEqual([...types(0)], ['f']);
  assert.deepStrictEqual([...types(1)], ['d']);
  assert.ok(types(2).has('f') && types(2).has('d'), 'world 3 mixes the two');
  assert.ok(types(3).has('t')); assert.ok(types(4).has('c')); assert.ok(types(5).has('s'));
  const all = new Set([].concat(...LD.LEVELS.map(l => l.ents.map(e => e.t))));
  ['f', 'd', 't', 'c', 's'].forEach(k => assert.ok(all.has(k), 'uses ' + k));
});
t('seed levels carry a current so the seed can actually drift', () => {
  LD.LEVELS.filter(l => l.ents.some(e => e.t === 's')).forEach(l => assert.notStrictEqual(l.cur, 0, 'level ' + l.index));
});
t('levels are all different and survive a JSON round trip (they ship as data)', () => {
  assert.strictEqual(new Set(LD.LEVELS.map(l => JSON.stringify(l))).size, 100);
  [4, 29, 61, 90].forEach(i => {
    const d = JSON.parse(JSON.stringify(LD.LEVELS[i - 1]));
    assert.ok(run(E.parse(d), d.solution).win, 'level ' + i);
  });
});
t('levels can be lost: wasting every turn fails, and the move budget is finite', () => {
  const L = lvl(21), r = run(L, 'W'.repeat(LD.LEVELS[20].moves));
  assert.ok(!r.win, 'a level that needs the tide is not won by doing nothing');
});

// ---------- scoring ----------
t('stars: par = 3, par+3 = 2, beyond = 1', () => {
  const L = { par: 8 };
  assert.strictEqual(E.starsFor(L, 7), 3); assert.strictEqual(E.starsFor(L, 8), 3);
  assert.strictEqual(E.starsFor(L, 11), 2); assert.strictEqual(E.starsFor(L, 12), 1);
});
t('score rewards par and rescues', () => {
  const L = { par: 8, ents: [1, 2] };
  const best = E.scoreFor(L, 8, 2), ok = E.scoreFor(L, 20, 0);
  assert.strictEqual(best.total, 1000 + 400 + 500 + 300);
  assert.strictEqual(ok.total, 1400);
  assert.ok(best.total > ok.total);
});
t('ranks run from Tide Watcher to Ocean Spirit', () => {
  assert.strictEqual(E.rankFor(0).name, 'Tide Watcher'); assert.strictEqual(E.rankFor(12).name, 'Moonling');
  assert.strictEqual(E.rankFor(300).name, 'Ocean Spirit'); assert.strictEqual(E.rankFor(300).next, null);
  assert.strictEqual(E.rankFor(0).next[0], 'Moonling');
});
console.log('\n' + n + ' tests passed');
