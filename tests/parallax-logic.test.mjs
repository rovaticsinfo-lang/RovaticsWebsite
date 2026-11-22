// Run: node --test tests/parallax-logic.test.mjs   Proves the PARALLAX rules, all 100 levels, progression, rewards and saving.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, WORLDS } from '../games/parallax/px/levels.js';
import { solve, replay, apply, solved, moves, clone } from '../games/parallax/px/logic.js';
import { Session } from '../games/parallax/px/session.js';
import * as P from '../games/parallax/px/progress.js';

test('five worlds and one hundred levels exist', () => {
  assert.equal(WORLDS.length, 5); assert.equal(LEVELS.length, 100);
  for (let w = 1; w <= 5; w++) assert.equal(LEVELS.filter(l => l.world.id === w).length, 20);
  LEVELS.forEach((l, i) => { assert.equal(l.n, i + 1); assert.ok(l.title && l.state && l.rewards.coins > 0); });
  assert.equal(new Set(LEVELS.map(l => l.title)).size, 100, 'titles are unique');
});

test('every level starts unsolved and its shipped solution really solves it', () => {
  for (const l of LEVELS) {
    assert.equal(solved(l.state), false, 'L' + l.n + ' must not start solved');
    const r = replay(l.state, l.sol); assert.ok(r.ok, 'L' + l.n + ' stored solution fails (' + l.family + ')');
    assert.equal(l.sol.length, l.par);
  }
});

test('every level can be re-solved from scratch by the engine (all but the slow echo planners)', () => {
  let n = 0;
  for (const l of LEVELS) {
    if (l.family === 'echo' || (l.family === 'multi' && l.state.stages.some(s => s.t === 'echo'))) continue;
    const s = solve(clone(l.state)); assert.ok(s && replay(l.state, s).ok, 'L' + l.n); n++;
  }
  assert.ok(n >= 75, 'solved ' + n);
});

test('puzzle families are genuinely varied across the campaign', () => {
  const fams = new Set(LEVELS.map(l => l.family)); assert.ok(fams.size >= 9, 'families ' + fams.size);
  const sigs = new Set(LEVELS.map(l => JSON.stringify(l.state))); assert.equal(sigs.size, 100, 'no two puzzles are identical');
  for (let w = 1; w <= 4; w++) { const f = new Set(LEVELS.filter(l => l.world.id === w).map(l => l.family)); assert.ok(f.size >= 3, 'world ' + w + ' variety'); }
});

test('wrong moves are not wins: the first available moves never solve a non-trivial level', () => {
  for (const l of LEVELS.filter(x => x.family !== 'multi')) {
    let s = clone(l.state), done = false; for (let i = 0; i < 2; i++) { const ms = moves(s); if (!ms.length) break; s = apply(s, ms[0]); if (solved(s)) done = true; }
    if (l.par > 3) assert.equal(done, false, 'L' + l.n);
  }
});

test('session: undo, restart, checkpoint and win detection', () => {
  const l = LEVELS[0], s = new Session(l.state, l.sol, l.par);
  assert.ok(s.play(l.sol[0])); assert.equal(s.moves, 1); assert.ok(s.undo()); assert.equal(s.history.length, 0);
  s.play(l.sol[0]); s.play(l.sol[1]); s.saveCheckpoint(); const mv = s.moves; s.play(l.sol[2]); s.restoreCheckpoint(); assert.equal(s.moves, mv);
  s.restart(); assert.equal(s.moves, 0); assert.equal(s.restarts, 1);
  for (const m of l.sol) s.play(m); assert.ok(s.won); assert.equal(s.play(l.sol[0]), false, 'no moves after the win');
});

test('hint ladder goes 1, 2, 3 and the demonstrated move is the solver move', () => {
  const l = LEVELS[1], s = new Session(l.state, l.sol, l.par);
  assert.deepEqual([s.askHint(), s.askHint(), s.askHint(), s.askHint()], [1, 2, 3, 3]);
  const m = s.nextMove(); assert.deepEqual(m, l.sol[0]); s.play(m); assert.deepEqual(s.nextMove(), l.sol[1]);
});

test('hints still work after the player leaves the stored solution', () => {
  for (const l of LEVELS.filter(x => ['pipes', 'coupled', 'tilt', 'beam', 'tanks', 'logic', 'seq'].includes(x.family)).slice(0, 40)) {
    const s = new Session(l.state, l.sol, l.par), ms = moves(s.state); s.play(ms[ms.length - 1]);
    if (s.won) continue; const nm = s.nextMove(); assert.ok(nm, 'L' + l.n + ' no hint after a deviation');
    const t = new Session(s.state, null, 0); let x = s.state; for (let i = 0; i < 40 && !solved(x); i++) { const q = new Session(x, null, 0).nextMove(); if (!q) break; x = apply(x, q); } assert.ok(solved(x), 'L' + l.n + ' following hints from a deviated state fails');
  }
});

test('rewards: completion, tier, mastery and discovery pay once; stars follow hints and par', () => {
  const b = LEVELS[0], save = P.defaultSave();
  const r1 = P.completeLevel(save, b, { moves: b.par, par: b.par, hints: 0, discovered: true, seconds: 40 });
  assert.equal(r1.stars, 3); assert.equal(r1.total, b.rewards.coins + b.rewards.tier + b.rewards.mastery + b.rewards.discovery); assert.equal(save.coins, r1.total);
  const r2 = P.completeLevel(save, b, { moves: b.par, par: b.par, hints: 0, discovered: true, seconds: 30 }); assert.equal(r2.total, 10, 'a repeat only pays a token');
  const b2 = LEVELS[1], r3 = P.completeLevel(save, b2, { moves: b2.par + 30, par: b2.par, hints: 2, discovered: false }); assert.equal(r3.stars, 1); assert.equal(r3.mastery, 0); assert.equal(r3.discovery, 0);
  assert.equal(P.starsFor({ moves: 5, par: 5, hints: 1 }), 1); assert.equal(P.starsFor({ moves: 50, par: 5, hints: 0 }), 2);
});

test('progression: levels unlock in order, worlds complete, achievements and coins', () => {
  const save = P.defaultSave(); assert.ok(P.isUnlocked(save, 1)); assert.ok(!P.isUnlocked(save, 2));
  for (let n = 1; n <= 20; n++) { P.completeLevel(save, LEVELS[n - 1], { moves: LEVELS[n - 1].par, par: LEVELS[n - 1].par, hints: 0, discovered: n % 2 === 0 }); assert.ok(P.isUnlocked(save, n + 1)); }
  assert.ok(P.worldDone(save, 1)); assert.ok(!P.worldDone(save, 2)); assert.equal(P.nextLevel(save), 21);
  const got = P.checkAchievements(save).map(a => a.id); for (const id of ['first', 'ten', 'world1', 'clear', 'lore10', 'stars30']) assert.ok(got.includes(id), id);
  assert.equal(P.checkAchievements(save).length, 0, 'achievements only pay once');
});

test('cosmetics: bought with earned coins only, equipped only when owned', () => {
  const save = P.defaultSave(); assert.equal(P.buy(save, 'shell_tide').ok, false); save.coins = 1000;
  assert.ok(P.buy(save, 'shell_tide').ok); assert.equal(save.coins, 750); assert.equal(P.buy(save, 'shell_tide').ok, false);
  assert.ok(P.equip(save, 'shell_tide')); assert.equal(save.equipped.shell, 'shell_tide'); assert.equal(P.equip(save, 'shell_void'), false);
});

test('save/load: round trip and repair of damaged or old saves', () => {
  const save = P.defaultSave(); P.completeLevel(save, LEVELS[0], { moves: 4, par: 4, hints: 0 }); const back = P.migrate(JSON.parse(JSON.stringify(save)));
  assert.deepEqual(back.levels, save.levels); assert.equal(back.coins, save.coins);
  assert.equal(P.migrate(null).v, P.SAVE_VERSION); assert.equal(P.migrate({ coins: 'x', levels: 5, owned: 3 }).coins, 0); assert.ok(Array.isArray(P.migrate({ owned: 3 }).owned));
  assert.ok(P.migrate({ v: 1, coins: 120 }).settings.music > 0);
});
