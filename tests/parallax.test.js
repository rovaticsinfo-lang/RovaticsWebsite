/* PARALLAX engine tests:  node tests/parallax.test.js */
const assert = require('assert'), E = require('../games/parallax-engine.js');
let n = 0; const t = (name, fn) => { try { fn(); n++; console.log('ok - ' + name); } catch (e) { console.error('FAIL - ' + name + '\n' + (e.stack || e)); process.exit(1); } };
const play = (g, list) => list.map(a => g.act(a));

t('three levels with unique titles, three friendly hints each, and objectives', () => {
  assert.strictEqual(E.LEVELS.length, 3); assert.deepStrictEqual(E.LEVELS.map(l => l.title), ['The Forgotten Gate', 'The Floating Path', 'The Energy Core']);
  E.LEVELS.forEach(l => { assert.strictEqual(l.hints.length, 3); assert.ok(l.objective && l.intro && l.outro); l.hints.forEach(h => assert.ok(h.length < 120, 'hints stay short')); });
  assert.strictEqual(E.LEVELS[0].hints[0], 'The sunlight is hiding the symbols.'); assert.strictEqual(E.LEVELS[1].hints[2], 'Connect the entrance to A, A to B, B to C, and C to the exit.');
});
t('beam tracer: a mirror at 45 degrees turns an eastward beam south; a receiver absorbs it; a miss escapes', () => {
  const m = [{ id: 'm', x: 5, z: 0, k: 6, hl: 1.5 }], rc = [{ id: 'r', x: 5, z: 6, r: 1 }];
  const r = E.trace({ x: 0, z: 0, dx: 1, dz: 0 }, m, rc); assert.strictEqual(r.hit, 'r'); assert.deepStrictEqual(r.bounced, ['m']); assert.strictEqual(r.segs.length, 2);
  m[0].k = 0; assert.strictEqual(E.trace({ x: 0, z: 0, dx: 1, dz: 0 }, m, rc).hit, null);
  assert.ok(E.trace({ x: 0, z: 0, dx: 1, dz: 0 }, [], []).segs[0].x1 > 80, 'an unobstructed beam travels on');
});
t('level 1: exactly one mirror arrangement lights all three symbols', () => {
  const sols = [];
  for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) for (let c = 0; c < 8; c++) { const g = E.createGame(0); g.state.k = [a, b, c]; if (g.evaluate().allLit) sols.push([a, b, c]); }
  assert.deepStrictEqual(sols, [E.LEVELS[0].mirrors.map(m => m.solve)]);
  assert.ok(!E.createGame(0).evaluate().allLit, 'the room starts unsolved'); E.createGame(0).evaluate().lit.forEach(x => assert.strictEqual(x, false));
});
t('level 1: pillars stay silent until the symbols are lit, wrong order resets, right order opens the gate', () => {
  const g = E.createGame(0); const r0 = g.act({ t: 'pillar', id: 'sun' }); assert.ok(!r0.ok && /hidden/.test(r0.msg) && r0.ev.includes('denied'));
  E.LEVELS[0].mirrors.forEach((m, i) => { while (g.state.k[i] !== m.solve) assert.ok(g.act({ t: 'mirror', id: m.id }).ok); }); assert.ok(g.evaluate().allLit);
  const order = E.LEVELS[0].plates.map(p => p.sym); assert.deepStrictEqual(order, ['moon', 'sun', 'star']);
  const wrong = g.act({ t: 'pillar', id: 'star' }); assert.ok(wrong.ev.includes('pillarWrong') && g.state.seq === 0 && !g.complete);
  assert.ok(g.act({ t: 'pillar', id: 'moon' }).ev.includes('pillar')); assert.strictEqual(g.state.seq, 1); assert.ok(g.act({ t: 'pillar', id: 'sun' }).ok);
  const fin = g.act({ t: 'pillar', id: 'star' }); assert.ok(fin.ev.includes('gate') && g.complete && g.state.gate);
  assert.ok(!g.act({ t: 'mirror', id: 'm0' }).ok, 'nothing moves after the gate opens');
});
t('level 1: the full solution from the start completes with three stars when played cleanly', () => {
  const g = E.createGame(0), s = g.solution(); assert.ok(s.length <= E.LEVELS[0].par, 'solution within par: ' + s.length); play(g, s).forEach(r => assert.ok(r.ok)); assert.ok(g.complete); assert.strictEqual(g.stars(), 3);
});
t('level 2: sections rotate in quarter turns, the lock refuses until a continuous route joins entrance to exit', () => {
  const g = E.createGame(1); assert.ok(!g.evaluate().connected); const lk = g.act({ t: 'lock', id: 'lock' }); assert.ok(!lk.ok && /blue lights/.test(lk.msg));
  const before = g.state.rot.slice(); g.act({ t: 'section', id: 'A' }); assert.strictEqual(g.state.rot[0], (before[0] + 1) % 4);
  for (let i = 0; i < 3; i++) g.act({ t: 'section', id: 'A' }); assert.strictEqual(g.state.rot[0], before[0], 'four turns return to the start');
  assert.ok(!g.act({ t: 'section', id: 'Z' }).ok);
});
t('level 2: solving connects E to X; only then the lock works; then the avatar may cross; sections freeze', () => {
  const g = E.createGame(1); play(g, g.solution().filter(a => a.t === 'section')); assert.ok(g.evaluate().connected && g.evaluate().reach.includes('X'));
  assert.ok(!g.reachExit(), 'cannot finish before locking'); assert.ok(g.act({ t: 'lock', id: 'lock' }).ok); assert.ok(!g.act({ t: 'section', id: 'B' }).ok); assert.ok(g.reachExit() && g.complete);
});
t('level 2: of all 64 section settings only the intended route connects (B works with either of its two straight turns)', () => {
  const L = E.LEVELS[1]; let ok = 0; for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) if (E.bridgeInfo(L, [a, b, c]).connected) { ok++; assert.strictEqual(a, 3); assert.strictEqual(c, 2); assert.ok(b === 0 || b === 2); }
  assert.strictEqual(ok, 2);
});
t('level 3: exactly one mirror arrangement sends each beam to its own symbol receiver', () => {
  const sols = []; for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) for (let c = 0; c < 8; c++) { const g = E.createGame(2); g.state.k = [a, b, c]; if (g.evaluate().allOk) sols.push([a, b, c]); }
  assert.deepStrictEqual(sols, [E.LEVELS[2].mirrors.map(m => m.solve)]); const g0 = E.createGame(2).evaluate(); assert.ok(!g0.allOk);
  const L = E.LEVELS[2]; assert.ok(L.mirrors.every(m => m.start !== m.solve), 'every mirror starts wrong');
});
t('level 3: a receiver lit by the wrong beam is reported, the console needs all three, then the core ignites', () => {
  const g = E.createGame(2); let sawWrong = false;
  for (let a = 0; a < 8 && !sawWrong; a++) for (let b = 0; b < 8 && !sawWrong; b++) for (let c = 0; c < 8; c++) { const q = E.createGame(2); q.state.k = [a, b, c]; if (q.evaluate().wrong.some(Boolean)) { sawWrong = true; const r = q.act({ t: 'console', id: 'console' }); assert.ok(!r.ok && /wrong beam|match/.test(r.msg)); break; } }
  assert.ok(sawWrong, 'some settings light a receiver with the wrong symbol');
  assert.ok(!g.act({ t: 'console', id: 'console' }).ok); play(g, g.solution()); assert.ok(g.complete && g.state.powered && g.progress().done === 4);
});
t('hint ladder: three steps; the target points at a real object; the text stays on the last hint; hints cost the third star', () => {
  E.LEVELS.forEach((L, i) => {
    const g = E.createGame(i), h1 = g.useHint(), h2 = g.useHint(), h3 = g.useHint(); assert.deepStrictEqual([h1.text, h2.text, h3.text], L.hints); assert.deepStrictEqual([h1.n, h2.n, h3.n], [1, 2, 3]); assert.ok(h2.target && h2.target.id);
    assert.strictEqual(g.useHint().text, L.hints[2]); play(g, g.solution()); if (!g.complete) g.reachExit(); assert.ok(g.complete); assert.ok(g.stars() <= 2, 'no third star after using hints');
  });
});
t('hint target follows the puzzle: next wrong mirror, then the next pillar in order', () => {
  const g = E.createGame(0); assert.strictEqual(g.nextTarget().t, 'mirror'); play(g, g.solution().filter(a => a.t === 'mirror')); assert.deepStrictEqual(g.nextTarget(), { t: 'pillar', id: 'moon' }); g.act({ t: 'pillar', id: 'moon' }); assert.deepStrictEqual(g.nextTarget(), { t: 'pillar', id: 'sun' });
});
t('undo and restart: undo rewinds one move; restart returns to the start', () => {
  const g = E.createGame(0); const k0 = g.state.k.slice(); g.act({ t: 'mirror', id: 'm0' }); assert.ok(g.canUndo()); assert.ok(g.undo()); assert.deepStrictEqual(g.state.k, k0); assert.strictEqual(g.moves, 0); assert.ok(!g.undo());
  g.act({ t: 'mirror', id: 'm1' }); g.restart(); assert.deepStrictEqual(g.state.k, k0); assert.strictEqual(g.resets, 1); assert.ok(!g.canUndo());
  const g2 = E.createGame(1); g2.act({ t: 'section', id: 'C' }); g2.act({ t: 'section', id: 'C' }); g2.undo(); assert.strictEqual(g2.state.rot[2], 1);
});
t('rewards: coins grow with no hints and par; a replay pays only for new coins; progress is saved and loaded', () => {
  const store = {}, st = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } }; const save = E.loadSave(st, 'k'); assert.strictEqual(save.coins, 0);
  const g = E.createGame(0); play(g, g.solution()); const r = E.recordResult(save, g, [0, 1]); assert.strictEqual(r.pay, 100 + 50 + 25 + 20); assert.strictEqual(save.levels[1].stars, 3); assert.strictEqual(save.last, 2);
  E.writeSave(st, 'k', save); const back = E.loadSave(st, 'k'); assert.strictEqual(back.coins, save.coins); assert.deepStrictEqual(back.levels[1].picked, [0, 1]);
  const g2 = E.createGame(0); play(g2, g2.solution()); const r2 = E.recordResult(back, g2, [1, 2]); assert.strictEqual(r2.pay, 10, 'only coin 2 is new'); assert.strictEqual(back.coins, save.coins + 10);
  assert.deepStrictEqual(E.loadSave({ getItem: () => '{broken', setItem() { } }, 'k').levels, {}, 'corrupt saves fall back to a fresh one');
});
t('save normalisation clamps stars, ignores unknown levels and keeps defaults', () => {
  const s = E.normalizeSave({ coins: -5, last: 9, levels: { 1: { stars: 9, best: 3, picked: [1, 'x'] }, 7: { stars: 3 } }, settings: { music: .2 } }); assert.strictEqual(s.coins, 0); assert.strictEqual(s.last, 3); assert.strictEqual(s.levels[1].stars, 3); assert.ok(!s.levels[7]); assert.deepStrictEqual(s.levels[1].picked, [1]); assert.strictEqual(s.settings.music, .2); assert.strictEqual(s.settings.sfx, .9);
});
t('progress indicator rises as the puzzle is solved', () => {
  E.LEVELS.forEach((L, i) => { const g = E.createGame(i), p0 = g.progress().done; g.solution().forEach(a => g.act(a)); const p1 = g.progress(); assert.ok(p1.done > p0 && p1.done <= p1.total, L.title); });
});
console.log(n + ' tests passed');
