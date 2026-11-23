/* PARALLAX - rules engine (pure logic, no graphics). Used by the 3D game and by the node tests.
 * Three levels:
 *   1  The Forgotten Gate   sunbeams + mirrors reveal three floor symbols, pillars are woken in that order
 *   2  The Floating Path    three bridge sections are rotated until a continuous route joins entrance and exit
 *   3  The Energy Core      three energy beams are redirected by mirrors into their matching receivers
 * The 3D side only draws what this engine says is true: lit plates, beam segments, connected path, progress.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ParallaxEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const PI = Math.PI, STEPS = 8;                                    // a mirror turns in 22.5 degree steps; 8 steps = half a turn (a mirror looks the same from both sides)

  /* ---------- beams ---------- */
  const mirrorNormal = k => { const a = k * PI / STEPS; return { x: Math.cos(a), z: Math.sin(a) }; };
  /* Follow one beam from an emitter through mirrors (flat segments, half-length hl) until it reaches a receiver or leaves the room.
   * emitter {x,z,dx,dz}; mirrors [{id,x,z,k,hl}]; receivers [{id,x,z,r}] */
  function trace(emitter, mirrors, receivers, opt) {
    opt = opt || {}; const maxB = opt.maxBounces || 7, maxLen = opt.maxLen || 90, segs = [], bounced = [];
    let x = emitter.x, z = emitter.z, dx = emitter.dx, dz = emitter.dz, skip = -1, hit = null;
    for (let b = 0; b <= maxB; b++) {
      let bt = maxLen, bm = -1;
      mirrors.forEach((m, i) => {
        if (i === skip) return; const n = mirrorNormal(m.k), dn = dx * n.x + dz * n.z; if (Math.abs(dn) < 1e-6) return;
        const t = ((m.x - x) * n.x + (m.z - z) * n.z) / dn; if (t < 1e-4 || t >= bt) return;
        const px = x + t * dx - m.x, pz = z + t * dz - m.z; if (Math.abs(px * -n.z + pz * n.x) <= (m.hl || 1.5)) { bt = t; bm = i; }
      });
      let rt = null, rid = null;
      receivers.forEach(r => {                                       // nearest point along the ray to the receiver centre
        const t = (r.x - x) * dx + (r.z - z) * dz; if (t < 0 || t > bt) return; const px = x + t * dx - r.x, pz = z + t * dz - r.z;
        if (px * px + pz * pz <= r.r * r.r && (rt === null || t < rt)) { rt = t; rid = r.id; }
      });
      if (rt !== null) { segs.push({ x0: x, z0: z, x1: x + dx * rt, z1: z + dz * rt }); hit = rid; break; }
      segs.push({ x0: x, z0: z, x1: x + dx * bt, z1: z + dz * bt });
      if (bm < 0) break;
      const m = mirrors[bm], n = mirrorNormal(m.k), d = dx * n.x + dz * n.z; x += dx * bt; z += dz * bt; dx -= 2 * d * n.x; dz -= 2 * d * n.z; skip = bm; bounced.push(m.id);
    }
    return { segs, hit, bounced };
  }

  /* ---------- level data ---------- */
  const SYM = { moon: 'Moon', sun: 'Sun', star: 'Star' };

  const L1 = {
    n: 1, id: 'L1', title: 'The Forgotten Gate', world: 'The Forgotten Architects', kind: 'mirrors', tune: 'ocean',
    objective: 'Use sunlight to reveal three symbols, then wake the three pillars in the same order to open the gate.',
    intro: 'You arrive at a monumental observatory floating above the clouds. A giant sealed gate blocks the way. The sunlight is hiding something.',
    outro: 'The pillars sing together and the great gate swings open.',
    hints: ['The sunlight is hiding the symbols.', 'Turn the mirrors until all three floor symbols glow.', 'Read the glowing symbols from left to right, then activate the matching pillars in that order.'],
    par: 14, sun: { dx: 0, dz: 1, from: 36 },
    mirrors: [{ id: 'm0', x: -16, z: -6, start: 1, solve: 6 }, { id: 'm1', x: -5.66, z: -11.66, start: 4, solve: 7 }, { id: 'm2', x: 15, z: -6, start: 0, solve: 2 }],
    plates: [{ id: 'p0', x: -7, z: -6, sym: 'moon' }, { id: 'p1', x: 0, z: -6, sym: 'sun' }, { id: 'p2', x: 7, z: -6, sym: 'star' }],
    pillars: [{ id: 'sun', x: -10, z: -15, sym: 'sun' }, { id: 'moon', x: 10, z: -15, sym: 'moon' }, { id: 'star', x: 0, z: -10.5, sym: 'star' }],
    start: { x: 0, z: 22, yaw: Math.PI }, gate: { x: 0, z: -27 },
    coins: [[-12, 14], [12, 14], [-20, -2], [20, -2], [0, -2]]
  };
  const L2 = {
    n: 2, id: 'L2', title: 'The Floating Path', world: 'The Forgotten Architects', kind: 'bridge', tune: 'jungle',
    objective: 'Rotate the three bridge sections until one safe path joins the entrance, the middle platform and the exit.',
    intro: 'The bridge is broken into three great stone sections. The exit tower is far across a sea of clouds.',
    outro: 'The path is whole again. The way forward is open.',
    hints: ['The exit is across the gap. Look for the broken connections.', 'Rotate each platform until its blue connection ends meet.', 'Connect the entrance to A, A to B, B to C, and C to the exit.'],
    par: 9, cell: 14,
    // grid columns 0..2 (west to east), rows 0..2 (north to south). Directions: 0 north, 1 east, 2 south, 3 west
    platforms: [{ id: 'E', c: 0, r: 2, name: 'Entrance' }, { id: 'M', c: 1, r: 0, name: 'Middle platform' }, { id: 'X', c: 2, r: 1, name: 'Exit' }],
    sections: [{ id: 'A', c: 1, r: 2, type: 'elbow', start: 0, solve: 3 }, { id: 'B', c: 1, r: 1, type: 'straight', start: 1, solve: 0 }, { id: 'C', c: 2, r: 0, type: 'elbow', start: 0, solve: 2 }],
    entrance: 'E', exit: 'X',
    start: { x: -14, z: 14, yaw: 0 },
    consoles: [{ id: 'A', x: -19, z: 8 }, { id: 'B', x: -14, z: 8 }, { id: 'C', x: -9, z: 8 }], lock: { x: -14, z: 17 },
    coins: [[-18, 18], [-10, 18], [0, -14], [14, -14], [14, 0]]
  };
  /* the energy core layout is found by tests/tools/gen-parallax-core.js: exactly one arrangement of the three mirrors lights every receiver */
  const L3 = {
    n: 3, id: 'L3', title: 'The Energy Core', world: 'The Gravity Engine', kind: 'energy', tune: 'cosmic',
    objective: 'Guide all three energy beams into the receivers with the same symbol, then activate the central console.',
    intro: 'A colossal chamber hums in the dark. A great blue core floats above the platform, waiting for power.',
    outro: 'The core ignites. Light floods the chamber and the universe opens before you.',
    hints: ['The core needs energy from all three beams.', 'Turn the mirrors to guide each beam into a matching receiver.', "Match each emitter's symbol to the receiver with the same symbol, then activate the console."],
    par: 14, hl: 1.7,
    emitters: [], mirrors: [], receivers: [],
    start: { x: 0, z: 26, yaw: Math.PI }, console: { x: 0, z: 9 }, coreCentre: { x: 0, z: 0 },
    coins: [[-14, 20], [14, 20], [-26, 0], [26, 0], [0, -24]]
  };
  Object.assign(L3, {"emitters":[{"id":"e0","x":-34,"z":-18,"dx":1,"dz":0,"sym":"moon"},{"id":"e1","x":-34,"z":0,"dx":1,"dz":0,"sym":"sun"},{"id":"e2","x":-34,"z":18,"dx":1,"dz":0,"sym":"star"}],"mirrors":[{"id":"m0","x":0,"z":-18,"start":4,"solve":1},{"id":"m1","x":18,"z":18,"start":4,"solve":2},{"id":"m2","x":18,"z":0,"start":0,"solve":7}],"receivers":[{"id":"r0","x":-11,"z":-29,"r":1.6,"sym":"moon"},{"id":"r1","x":-11,"z":29,"r":1.6,"sym":"sun"},{"id":"r2","x":25.2,"z":-18,"r":1.6,"sym":"star"}]});   // generated: node tests/tools/gen-parallax-core.js 2
  const LEVELS = [L1, L2, L3];
  const SYMS3 = ['moon', 'sun', 'star'];

  /* ---------- level 2 connections ---------- */
  const DX = [0, 1, 0, -1], DZ = [-1, 0, 1, 0];                      // direction -> grid step (column, row)
  function sectionOpen(sec, rot) {                                   // which directions a section opens to
    if (sec.type === 'straight') return rot % 2 === 0 ? [0, 2] : [1, 3];
    return [rot % 4, (rot + 1) % 4];
  }
  function bridgeInfo(L, rots) {
    const cells = {}, key = (c, r) => c + ',' + r;
    L.platforms.forEach(p => { cells[key(p.c, p.r)] = { id: p.id, open: [0, 1, 2, 3], platform: true, c: p.c, r: p.r }; });
    L.sections.forEach((s, i) => { cells[key(s.c, s.r)] = { id: s.id, open: sectionOpen(s, rots[i]), c: s.c, r: s.r }; });
    const ent = L.platforms.find(p => p.id === L.entrance), seen = {}, path = [], q = [cells[key(ent.c, ent.r)]]; seen[key(ent.c, ent.r)] = 1;
    const joined = [];                                               // each connection that works, as [fromId, toId]
    while (q.length) {
      const a = q.shift(); path.push(a.id);
      a.open.forEach(d => {
        const nc = a.c + DX[d], nr = a.r + DZ[d], b = cells[key(nc, nr)]; if (!b || !b.open.includes((d + 2) % 4)) return;
        joined.push([a.id, b.id, d]); if (!seen[key(nc, nr)]) { seen[key(nc, nr)] = 1; q.push(b); }
      });
    }
    return { connected: path.includes(L.exit), reach: path, joined };
  }

  /* ---------- the game ---------- */
  function createGame(index) {
    const L = LEVELS[index]; if (!L) throw new Error('no such level');
    const fresh = () => {
      if (L.kind === 'mirrors') return { k: L.mirrors.map(m => m.start), seq: 0, gate: false };
      if (L.kind === 'bridge') return { rot: L.sections.map(s => s.start), locked: false, reached: false };
      return { k: L.mirrors.map(m => m.start), powered: false };
    };
    let s = fresh(); const hist = [];
    const G = { L, index, moves: 0, hints: 0, resets: 0, wrong: 0, complete: false, events: [] };
    const snap = () => JSON.stringify(s), load = t => { s = JSON.parse(t); };
    Object.defineProperty(G, 'state', { get: () => s });
    G.canUndo = () => hist.length > 0 && !G.complete;

    G.evaluate = function () {                                       // everything the picture needs, derived from state
      if (L.kind === 'mirrors') {
        const ms = L.mirrors.map((m, i) => ({ id: m.id, x: m.x, z: m.z, k: s.k[i], hl: 1.5 }));
        const rcv = L.plates.map(p => ({ id: p.id, x: p.x, z: p.z, r: 1.5 }));
        // each mirror catches one shaft of sunlight (travelling along the sun direction) and throws it back out; the beam starts at the mirror
        const traced = ms.map(m => { const nn = mirrorNormal(m.k), d = L.sun.dx * nn.x + L.sun.dz * nn.z; return trace({ x: m.x, z: m.z, dx: L.sun.dx - 2 * d * nn.x, dz: L.sun.dz - 2 * d * nn.z }, ms, rcv, { maxBounces: 3 }); });
        const lit = L.plates.map(p => traced.some(b => b.hit === p.id));
        return { mirrors: ms, beams: traced, lit, allLit: lit.every(Boolean), seq: s.seq, gate: s.gate, order: L.plates.map(p => p.sym) };
      }
      if (L.kind === 'bridge') { const info = bridgeInfo(L, s.rot); return Object.assign({ rot: s.rot.slice(), locked: s.locked, reached: s.reached }, info); }
      const ms = L.mirrors.map((m, i) => ({ id: m.id, x: m.x, z: m.z, k: s.k[i], hl: L.hl })), beams = L.emitters.map(e => trace(e, ms, L.receivers));
      const got = L.receivers.map(r => { const b = beams.findIndex(bm => bm.hit === r.id); return b < 0 ? null : b; });
      const ok = L.receivers.map((r, i) => got[i] !== null && L.emitters[got[i]].sym === r.sym), wrong = L.receivers.map((r, i) => got[i] !== null && !ok[i]);
      return { mirrors: ms, beams, got, ok, wrong, allOk: ok.every(Boolean), powered: s.powered };
    };

    const push = () => hist.push(snap());
    const done = (ok, msg, ev) => ({ ok, msg: msg || '', ev: ev || [] });
    G.act = function (a) {                                           // a: { t, id }
      if (G.complete) return done(false, 'This chamber is finished.');
      let r;
      if (L.kind === 'mirrors') r = actMirrors(a); else if (L.kind === 'bridge') r = actBridge(a); else r = actEnergy(a);
      if (r.ok) G.moves++; return r;
    };
    function actMirrors(a) {
      if (a.t === 'mirror') {
        const i = L.mirrors.findIndex(m => m.id === a.id); if (i < 0) return done(false, 'Nothing to turn there.');
        push(); s.k[i] = (s.k[i] + 1) % STEPS; const e = G.evaluate(); return done(true, '', ['mirror'].concat(e.allLit ? ['allLit'] : []));
      }
      if (a.t === 'pillar') {
        const e = G.evaluate(); const p = L.pillars.find(q => q.id === a.id); if (!p) return done(false, 'Nothing to wake there.');
        if (!e.allLit) return done(false, 'The pillar does not respond. The symbols are still hidden in the sunlight.', ['denied']);
        const need = L.plates[s.seq].sym; push();
        if (p.sym === need) { s.seq++; if (s.seq === 3) { s.gate = true; G.complete = true; return done(true, 'The pillars resonate together.', ['pillar', 'gate', 'complete']); } return done(true, 'The ' + SYM[p.sym] + ' pillar hums. ' + (3 - s.seq) + ' to go.', ['pillar']); }
        s.seq = 0; G.wrong++; return done(true, 'That is not the order of the symbols. The pillars fall silent. Read the floor again.', ['pillarWrong']);
      }
      return done(false, '');
    }
    function actBridge(a) {
      if (a.t === 'section') {
        if (s.locked) return done(false, 'The bridge is locked in place.'); const i = L.sections.findIndex(q => q.id === a.id); if (i < 0) return done(false, 'Nothing to turn.');
        push(); s.rot[i] = (s.rot[i] + 1) % 4; const e = G.evaluate(); return done(true, '', ['section'].concat(e.connected ? ['connected'] : []));
      }
      if (a.t === 'lock') {
        if (s.locked) return done(false, 'Already locked.'); const e = G.evaluate();
        if (!e.connected) return done(false, 'The lock stays dark. The blue lights must meet from the entrance to the exit.', ['denied']);
        push(); s.locked = true; return done(true, 'The bridge locks into place. Walk across to the exit tower.', ['lock']);
      }
      return done(false, '');
    }
    function actEnergy(a) {
      if (a.t === 'mirror') { const i = L.mirrors.findIndex(m => m.id === a.id); if (i < 0) return done(false, 'Nothing to turn.'); push(); s.k[i] = (s.k[i] + 1) % STEPS; const e = G.evaluate(); return done(true, '', ['mirror'].concat(e.allOk ? ['allOk'] : []).concat(e.wrong.some(Boolean) ? ['wrongSymbol'] : [])); }
      if (a.t === 'console') {
        const e = G.evaluate(); if (!e.allOk) return done(false, e.wrong.some(Boolean) ? 'A receiver is lit by the wrong beam. Match the symbols.' : 'The console stays dark. All three receivers must glow.', ['denied']);
        push(); s.powered = true; G.complete = true; return done(true, 'The core ignites.', ['console', 'complete']);
      }
      return done(false, '');
    }
    G.reachExit = function () {                                      // level 2: the avatar has crossed the bridge
      if (L.kind !== 'bridge' || !s.locked || G.complete) return false; s.reached = true; G.complete = true; return true;
    };
    G.undo = function () { if (!G.canUndo()) return false; load(hist.pop()); G.moves = Math.max(0, G.moves - 1); return true; };
    G.restart = function () { s = fresh(); hist.length = 0; G.moves = 0; G.resets++; G.complete = false; };
    G.useHint = function () { const h = Math.min(G.hints, 2); G.hints = Math.min(3, G.hints + 1); return { n: Math.min(G.hints, 3), text: L.hints[h], target: G.nextTarget() }; };
    G.nextTarget = function () {                                     // what the hint should point at
      if (L.kind === 'mirrors') { const i = L.mirrors.findIndex((m, j) => s.k[j] % STEPS !== m.solve); if (i >= 0 && !G.evaluate().allLit) return { t: 'mirror', id: L.mirrors[i].id }; const p = L.pillars.find(q => q.sym === L.plates[s.seq].sym); return { t: 'pillar', id: p.id }; }
      if (L.kind === 'bridge') { if (s.locked) return { t: 'exit', id: L.exit }; const i = L.sections.findIndex((q, j) => !sectionOk(q, s.rot[j])); return i >= 0 && !G.evaluate().connected ? { t: 'section', id: L.sections[i].id } : { t: 'lock', id: 'lock' }; }
      const i = L.mirrors.findIndex((m, j) => s.k[j] % STEPS !== m.solve); return i >= 0 && !G.evaluate().allOk ? { t: 'mirror', id: L.mirrors[i].id } : { t: 'console', id: 'console' };
    };
    function sectionOk(sec, rot) { const a = sectionOpen(sec, rot).slice().sort().join(), b = sectionOpen(sec, sec.solve).slice().sort().join(); return a === b; }
    G.progress = function () {                                       // [done, total, label] for the progress indicator
      const e = G.evaluate();
      if (L.kind === 'mirrors') return { done: e.lit.filter(Boolean).length + s.seq, total: 6, label: e.allLit ? 'Symbols revealed. Wake the pillars: ' + s.seq + ' / 3' : 'Symbols revealed: ' + e.lit.filter(Boolean).length + ' / 3' };
      if (L.kind === 'bridge') { const linked = e.reach.filter(x => x === 'A' || x === 'B' || x === 'C').length; return { done: linked + (e.connected ? 1 : 0) + (s.locked ? 1 : 0), total: 5, label: s.locked ? 'Cross the bridge to the exit tower' : e.connected ? 'Path complete: activate the lock' : 'Sections linked to the entrance: ' + linked + ' / 3' }; }
      return { done: e.ok.filter(Boolean).length + (s.powered ? 1 : 0), total: 4, label: 'Receivers powered: ' + e.ok.filter(Boolean).length + ' / 3' };
    };
    G.stars = function () { return 1 + (G.moves <= L.par ? 1 : 0) + (G.hints === 0 ? 1 : 0); };
    G.coinsFor = function (collected) { return 100 + (G.hints === 0 ? 50 : 0) + (G.moves <= L.par ? 25 : 0) + 10 * (collected || 0); };
    G.solution = function () {                                       // a full list of actions that solves the level from the current state (used by tests and the demo)
      const out = [], k = s.k ? s.k.slice() : null;
      if (L.kind === 'mirrors') { L.mirrors.forEach((m, i) => { for (let n = (m.solve - k[i] + STEPS) % STEPS; n > 0; n--) out.push({ t: 'mirror', id: m.id }); }); for (let i = s.seq; i < 3; i++) out.push({ t: 'pillar', id: L.pillars.find(q => q.sym === L.plates[i].sym).id }); return out; }
      if (L.kind === 'bridge') { L.sections.forEach((sec, i) => { let r = s.rot[i], n = 0; while (!sectionOk(sec, r) && n < 4) { r = (r + 1) % 4; n++; out.push({ t: 'section', id: sec.id }); } }); if (!s.locked) out.push({ t: 'lock', id: 'lock' }); return out; }
      L.mirrors.forEach((m, i) => { for (let n = (m.solve - k[i] + STEPS) % STEPS; n > 0; n--) out.push({ t: 'mirror', id: m.id }); }); out.push({ t: 'console', id: 'console' }); return out;
    };
    return G;
  }

  /* ---------- save data ---------- */
  function defaultSave() { return { v: 1, levels: {}, coins: 0, last: 1, settings: { music: .8, sfx: .9, quality: 'auto', sens: 1, captions: false, haptics: true } }; }
  function normalizeSave(o) {
    const d = defaultSave(); if (!o || typeof o !== 'object') return d;
    d.coins = Math.max(0, +o.coins || 0); d.last = Math.min(3, Math.max(1, +o.last || 1));
    if (o.levels) for (const k of ['1', '2', '3']) { const r = o.levels[k]; if (r && typeof r === 'object') d.levels[k] = { stars: Math.min(3, Math.max(0, +r.stars || 0)), best: Math.max(0, +r.best || 0), coins: Math.max(0, +r.coins || 0), took: (r.took | 0), picked: Array.isArray(r.picked) ? r.picked.filter(x => Number.isInteger(x)).slice(0, 8) : [] }; }
    Object.assign(d.settings, o.settings && typeof o.settings === 'object' ? o.settings : {}); return d;
  }
  function loadSave(storage, key) { try { const t = storage.getItem(key); return normalizeSave(t ? JSON.parse(t) : null); } catch (e) { return defaultSave(); } }
  function writeSave(storage, key, save) { try { storage.setItem(key, JSON.stringify(save)); return true; } catch (e) { return false; } }
  function recordResult(save, game, picked) {
    const k = String(game.L.n), old = save.levels[k] || { stars: 0, best: 0, coins: 0, took: 0, picked: [] }, stars = game.stars(), newPick = picked.filter(i => !(old.picked || []).includes(i));
    const first = !old.took;                                          // the full reward is paid once; a replay pays for new coins and for a better star count
    const pay = first ? game.coinsFor(newPick.length) : 10 * newPick.length + (stars > old.stars ? 20 : 0);
    save.levels[k] = { stars: Math.max(old.stars, stars), best: old.best ? Math.min(old.best, game.moves) : game.moves, coins: (old.coins || 0) + pay, took: 1, picked: (old.picked || []).concat(newPick) };
    save.coins += pay; save.last = Math.min(3, game.L.n + 1); return { stars, pay, first, bestStars: save.levels[k].stars };
  }

  return { STEPS, LEVELS, SYMS3, trace, mirrorNormal, bridgeInfo, sectionOpen, createGame, defaultSave, normalizeSave, loadSave, writeSave, recordResult };
});
