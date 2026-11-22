/* MindVerse: Beyond the Puzzle - puzzle rules engine.
 * Pure, deterministic logic (no DOM, no WebGL): puzzle stages, undo/restart, hints, solver,
 * scoring and the versioned save format. The 3D view only reads state from here.
 * Works in the browser (window.MindverseEngine) and in Node (tests).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MindverseEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const D2R = Math.PI / 180;
  const clone = o => JSON.parse(JSON.stringify(o));
  const NB = 1, EB = 2, SB = 4, WB = 8;                       // water openings: north, east, south, west
  const rotMask = (m, r) => { r = ((r % 4) + 4) % 4; for (let i = 0; i < r; i++) m = ((m << 1) | (m >> 3)) & 15; return m; };
  const mod = (a, n) => ((a % n) + n) % n;

  /* ======================= stage mechanics =======================
   * Every mechanic is a module with the same contract:
   *   init(p) -> state            (plain JSON, never mutated afterwards)
   *   actions(p, s) -> [action]   (every legal action right now)
   *   apply(p, s, a) -> { s }                  state changed
   *                   | { blocked: 'why' }     nothing happened (illegal / blocked)
   *                   | { s, fail: 'why' }     the room is reset by the game (traps)
   *                   (any result may carry .info text, .ev events and .free = costs no move)
   *   goal(p, s) -> bool
   *   say(p, a) -> text           (used by hints)
   * Actions always carry `obj`: the id of the object the player touches in the scene.
   */
  const KIND = {};

  /* ---- place: drag the crystal onto the plate (L1) ---- */
  KIND.place = {
    init: p => ({ at: p.start }),
    actions: (p, s) => Object.keys(p.zones).filter(z => z !== s.at).map(z => ({ t: 'move', obj: 'crystal', to: z })),
    apply(p, s, a) {
      if (a.t !== 'move') return { blocked: 'Nothing to do there.' };
      if (!p.zones[a.to]) return { blocked: 'The crystal cannot rest there.' };
      if (a.to === s.at) return { blocked: 'It is already there.' };
      return { s: { at: a.to }, ev: [a.to === p.plate ? 'plateOn' : 'place'] };
    },
    goal: (p, s) => s.at === p.plate,
    say: (p, a) => a.to === p.plate ? 'Drag the crystal onto the glowing plate.' : 'Move the crystal to another stone.'
  };
  /* nearest valid drop zone within `r` of a point; null = outside the valid interaction bounds */
  function nearestZone(zones, x, z, r) {
    let best = null, bd = r * r;
    Object.keys(zones).forEach(id => { const d = (zones[id].x - x) ** 2 + (zones[id].z - z) ** 2; if (d <= bd) { bd = d; best = id; } });
    return best;
  }

  /* ---- beam: rotate mirrors, slide blockers, light every receiver (L2, L7, L10) ---- */
  const MIRROR_HALF = 0.95, BLOCK_R = 0.55, RECV_R = 0.5, MAX_SEG = 14;
  KIND.beam = {
    init: p => ({ m: Object.fromEntries(p.mirrors.map(m => [m.id, m.start])), b: Object.fromEntries((p.blockers || []).map(b => [b.id, b.start])) }),
    actions(p, s) {
      const out = [];
      p.mirrors.forEach(m => { out.push({ t: 'rot', obj: m.id, d: 1 }); out.push({ t: 'rot', obj: m.id, d: -1 }); });
      (p.blockers || []).forEach(b => b.slots.forEach((_, k) => { if (k !== s.b[b.id]) out.push({ t: 'slot', obj: b.id, to: k }); }));
      return out;
    },
    apply(p, s, a) {
      const n = clone(s);
      if (a.t === 'rot') {
        if (!(a.obj in s.m)) return { blocked: 'That is not a mirror.' };
        n.m[a.obj] = mod(s.m[a.obj] + a.d, p.steps); return { s: n, ev: ['rot'] };
      }
      if (a.t === 'slot') {
        const b = (p.blockers || []).find(x => x.id === a.obj);
        if (!b || !b.slots[a.to]) return { blocked: 'The block cannot rest there.' };
        if (s.b[a.obj] === a.to) return { blocked: 'It is already there.' };
        n.b[a.obj] = a.to; return { s: n, ev: ['place'] };
      }
      return { blocked: 'Nothing to do there.' };
    },
    goal(p, s) { const t = trace(p, s); return p.need.every(id => t.lit[id]); },
    say: (p, a) => a.t === 'rot' ? 'Turn this mirror ' + (a.d > 0 ? 'clockwise.' : 'counter-clockwise.') : 'Slide this block to another socket.'
  };
  /* Follow the beam. Mirror angle = index * (180/steps) degrees; reflection: out = 2*mirror - in. Deterministic. */
  function trace(p, s) {
    const stepDeg = 180 / p.steps, segs = [], lit = {};
    const mir = p.mirrors.map(m => ({ id: m.id, x: m.x, z: m.z, th: s.m[m.id] * stepDeg }));
    const blk = (p.blockers || []).map(b => ({ id: b.id, x: b.slots[s.b[b.id]].x, z: b.slots[s.b[b.id]].z }));
    const B = p.bounds;
    let x = p.source.x, z = p.source.z, a = p.source.dir, last = null, stop = 'wall';
    for (let k = 0; k < MAX_SEG; k++) {
      const dx = Math.cos(a * D2R), dz = Math.sin(a * D2R);
      let best = Infinity, kind = 'wall', ref = null;
      // bounds
      const tw = [];
      if (dx > 1e-9) tw.push((B.x1 - x) / dx); else if (dx < -1e-9) tw.push((B.x0 - x) / dx);
      if (dz > 1e-9) tw.push((B.z1 - z) / dz); else if (dz < -1e-9) tw.push((B.z0 - z) / dz);
      best = Math.min.apply(null, tw.length ? tw : [0]);
      mir.forEach(m => {
        if (m.id === last) return;
        const cx = Math.cos(m.th * D2R), cz = Math.sin(m.th * D2R), den = dx * cz - dz * cx;
        if (Math.abs(den) < 1e-9) return;
        const t = ((m.x - x) * cz - (m.z - z) * cx) / den, u = ((m.x - x) * dz - (m.z - z) * dx) / den;
        if (t > 1e-6 && Math.abs(u) <= MIRROR_HALF && t < best) { best = t; kind = 'mirror'; ref = m; }
      });
      blk.forEach(b => {
        const tc = (b.x - x) * dx + (b.z - z) * dz, px = x + dx * tc - b.x, pz = z + dz * tc - b.z, d2 = px * px + pz * pz;
        if (tc > 0 && d2 <= BLOCK_R * BLOCK_R) { const t = tc - Math.sqrt(BLOCK_R * BLOCK_R - d2); if (t > 1e-6 && t < best) { best = t; kind = 'block'; ref = b; } }
      });
      const ex = x + dx * best, ez = z + dz * best;
      segs.push({ x1: x, z1: z, x2: ex, z2: ez });
      p.receivers.forEach(r => {                       // energy relays: lit when the beam passes through them
        const t = Math.max(0, Math.min(best, (r.x - x) * dx + (r.z - z) * dz)), qx = x + dx * t - r.x, qz = z + dz * t - r.z;
        if (qx * qx + qz * qz <= RECV_R * RECV_R) lit[r.id] = true;
      });
      if (kind !== 'mirror') { stop = kind; break; }
      a = 2 * ref.th - a; x = ex; z = ez; last = ref.id;
    }
    return { segs, lit, stop };
  }

  /* ---- symbols: cycle three panels until they match what the carving says (L3) ---- */
  function clueOk(c, seq) {
    return c.every(k => {
      if (k.k === 'at') return seq[k.pos] === k.s;
      if (k.k === 'notAt') return seq[k.pos] !== k.s;
      if (k.k === 'left') return seq.indexOf(k.a) < seq.indexOf(k.b);
      if (k.k === 'distinct') return new Set(seq).size === seq.length;
      return false;
    });
  }
  function clueSolutions(p) {                        // every sequence the clue allows
    const out = [], n = p.symbols.length, len = p.slots;
    const rec = seq => { if (seq.length === len) { if (clueOk(p.clue, seq)) out.push(seq.slice()); return; } p.symbols.forEach(sym => rec(seq.concat(sym))); };
    rec([]); return out;
  }
  KIND.symbols = {
    init: p => ({ slots: p.start.slice() }),
    actions: (p, s) => s.slots.map((_, i) => ({ t: 'cycle', obj: 'panel_' + i, slot: i })),
    apply(p, s, a) {
      if (a.t !== 'cycle' || !(a.slot >= 0 && a.slot < p.slots)) return { blocked: 'Nothing to do there.' };
      const n = clone(s); n.slots[a.slot] = mod(s.slots[a.slot] + 1, p.symbols.length); return { s: n, ev: ['glyph'] };
    },
    goal: (p, s) => s.slots.every((v, i) => p.symbols[v] === p.solution[i]),
    say: (p, a) => 'Touch this panel to change its symbol.'
  };

  /* ---- balance: stones with authored weights on two pans (L4, L10) ---- */
  const sums = (p, s) => { let L = 0, R = 0; p.stones.forEach(st => { if (s.pos[st.id] === 'L') L += st.w; else if (s.pos[st.id] === 'R') R += st.w; }); return { L, R }; };
  KIND.balance = {
    init: p => ({ pos: Object.fromEntries(p.stones.map(st => [st.id, 'tray'])) }),
    actions(p, s) {
      const out = [];
      p.stones.forEach(st => ['L', 'R', 'tray'].forEach(to => { if (to !== s.pos[st.id]) out.push({ t: 'put', obj: st.id, to }); }));
      return out;
    },
    apply(p, s, a) {
      const st = p.stones.find(x => x.id === a.obj);
      if (a.t !== 'put' || !st || !['L', 'R', 'tray'].includes(a.to)) return { blocked: 'Nothing to do there.' };
      if (s.pos[a.obj] === a.to) return { blocked: 'It is already there.' };
      if (a.to !== 'tray' && p.stones.filter(x => s.pos[x.id] === a.to).length >= p.cap) return { blocked: 'That pan is full (' + p.cap + ' stones at most).' };
      const n = clone(s); n.pos[a.obj] = a.to; return { s: n, ev: ['stone'] };
    },
    goal(p, s) {
      if (p.requireAll && p.stones.some(x => s.pos[x.id] === 'tray')) return false;
      const t = sums(p, s); return Math.abs((t.R - t.L) - (p.target || 0)) <= p.tol;
    },
    say: (p, a) => a.to === 'tray' ? 'Take this stone off the pan.' : 'Put this stone on the ' + (a.to === 'L' ? 'left' : 'right') + ' pan.'
  };

  /* ---- water: rotate channels, open valves, deliver water (L5, L10) ---- */
  const BASE = { straight: NB | SB, elbow: NB | EB, tee: EB | SB | WB, cross: 15, valve: EB | WB, source: EB, receiver: WB };
  function tileMask(t, rot) { return rotMask(BASE[t.t], t.fixed ? (t.rot || 0) : rot); }
  function flow(p, s) {
    const at = {}; p.tiles.forEach(t => { at[t.c + ',' + t.r] = t; });
    const wet = {}, src = p.tiles.find(t => t.t === 'source'); const q = [src]; wet[src.id] = true;
    const DIR = [[NB, 0, -1, SB], [EB, 1, 0, WB], [SB, 0, 1, NB], [WB, -1, 0, EB]];
    while (q.length) {
      const t = q.shift(), m = tileMask(t, s.r[t.id] || 0);
      DIR.forEach(d => {
        if (!(m & d[0])) return;
        const nb = at[(t.c + d[1]) + ',' + (t.r + d[2])]; if (!nb || wet[nb.id]) return;
        if (nb.t === 'valve' && !s.v[nb.id]) { if (tileMask(nb, 0) & d[3]) wet[nb.id + '#in'] = true; return; }     // closed valve: water waits in front of it
        if (t.t === 'valve' && !s.v[t.id]) return;
        if (tileMask(nb, s.r[nb.id] || 0) & d[3]) { wet[nb.id] = true; q.push(nb); }
      });
    }
    return { wet, supplied: p.tiles.filter(t => t.t === 'receiver').every(t => wet[t.id]) };
  }
  KIND.water = {
    init: p => ({ r: Object.fromEntries(p.tiles.filter(t => !t.fixed && t.t !== 'valve' && t.t !== 'source' && t.t !== 'receiver').map(t => [t.id, t.rot || 0])), v: Object.fromEntries(p.tiles.filter(t => t.t === 'valve').map(t => [t.id, t.open ? 1 : 0])) }),
    actions(p, s) { return Object.keys(s.r).map(id => ({ t: 'turn', obj: id })).concat(Object.keys(s.v).map(id => ({ t: 'valve', obj: id }))); },
    apply(p, s, a) {
      const n = clone(s);
      if (a.t === 'turn' && a.obj in s.r) { n.r[a.obj] = (s.r[a.obj] + 1) % 4; return { s: n, ev: ['turn'] }; }
      if (a.t === 'valve' && a.obj in s.v) { n.v[a.obj] = s.v[a.obj] ? 0 : 1; return { s: n, ev: ['valve'] }; }
      return { blocked: 'That piece is fixed in the stone.' };
    },
    goal: (p, s) => flow(p, s).supplied,
    say: (p, a) => a.t === 'valve' ? 'Turn this valve wheel.' : 'Turn this channel piece a quarter.'
  };

  /* ---- search: inspect clues, deduce the jar, find the key (L6) ---- */
  const jarMatches = (c, j) => (!c.sym || j.sym === c.sym) && (!c.color || j.color === c.color) && (!c.notSym || j.sym !== c.notSym) && (!c.notColor || j.color !== c.notColor);
  function clueJars(p) { return p.jars.filter(j => jarMatches(p.clue, j)); }
  KIND.search = {
    init: p => ({ seen: {}, opened: [], key: false, door: false }),
    actions(p, s) {
      const out = [{ t: 'inspect', obj: 'clue', free: true }];
      p.jars.forEach(j => { out.push({ t: 'inspect', obj: j.id, free: true }); out.push({ t: 'open', obj: j.id }); });
      out.push({ t: 'unlock', obj: 'door' });
      return out;
    },
    apply(p, s, a) {
      const n = clone(s);
      if (a.t === 'inspect') {
        if (a.obj === 'clue') n.seen.clue = true; else if (p.jars.some(j => j.id === a.obj)) n.seen[a.obj] = true; else return { blocked: 'Nothing to inspect.' };
        return { s: n, free: true, info: a.obj === 'clue' ? p.clueText : (p.jars.find(j => j.id === a.obj).look) };
      }
      if (a.t === 'open') {
        const j = p.jars.find(x => x.id === a.obj); if (!j) return { blocked: 'Nothing to open.' };
        if (!s.seen.clue) return { blocked: 'The lids are sealed with clay. Read the wall clue first.' };
        if (s.opened.includes(a.obj)) return { blocked: 'Already opened.' };
        n.opened.push(a.obj); if (a.obj === p.keyIn) n.key = true;
        return { s: n, ev: [a.obj === p.keyIn ? 'key' : 'empty'], info: a.obj === p.keyIn ? 'The key! It glows in your hands.' : 'Empty. Only dust inside.' };
      }
      if (a.t === 'unlock') {
        if (!s.key) return { blocked: 'The secret door needs a key.' };
        n.door = true; return { s: n, ev: ['door'] };
      }
      return { blocked: 'Nothing to do there.' };
    },
    goal: (p, s) => s.door,
    say: (p, a) => a.t === 'inspect' ? 'Look closely at this.' : a.t === 'open' ? 'Open this jar.' : 'Use the key on the secret door.'
  };

  /* ---- bridge: sequence the lever, plate and rail so a path exists (L8) ----
   * b = bridge angle (0..3 quarter turns, lever), p = plate pressed (platform A extended), q = platform B slid across.
   * Rules: the bridge can only turn while platform A is retracted; the plate only works while the bridge is flat (0 or 2);
   * the rail of B is powered only while A is extended and B must not slide while the bridge is flat across it (b=2). */
  KIND.bridge = {
    init: p => ({ b: p.start.b, p: p.start.p, q: p.start.q }),
    actions: (p, s) => [{ t: 'lever', obj: 'lever' }, { t: 'plate', obj: 'plate' }, { t: 'rail', obj: 'rail' }],
    apply(p, s, a) {
      const n = clone(s);
      if (a.t === 'lever') {
        if (s.p) return { blocked: 'The bridge would strike platform A. Retract the platform first (step off the plate).' };
        n.b = (s.b + 1) % 4; return { s: n, ev: ['bridge'] };
      }
      if (a.t === 'plate') {
        if (s.b % 2 === 1) return { blocked: 'The bridge is standing upright and blocks the platform. Turn it flat first.' };
        n.p = s.p ? 0 : 1; return { s: n, ev: ['plate'] };
      }
      if (a.t === 'rail') {
        if (!s.p) return { blocked: 'The rail has no power. Press the plate to extend platform A first.' };
        if (s.b === 2) return { blocked: 'Platform B would be crushed by the bridge. Turn the bridge away first.' };
        n.q = s.q ? 0 : 1; return { s: n, ev: ['rail'] };
      }
      return { blocked: 'Nothing to do there.' };
    },
    goal: (p, s) => !!s.p && !!s.q && s.b === 2,
    say: (p, a) => a.t === 'lever' ? 'Pull the lever to turn the bridge a quarter.' : a.t === 'plate' ? 'Step on the pressure plate.' : 'Turn the wheel that slides platform B.'
  };
  function bridgePath(s) { return { startToA: !!s.p, aToB: s.b === 2 && !!s.p && !!s.q, bToExit: !!s.q }; }

  /* ---- trap: press the switches in the safe order, a wrong one resets the room (L9) ---- */
  KIND.trap = {
    init: p => ({ step: 0, seen: {} }),
    actions(p, s) { const out = []; p.switches.forEach(w => { out.push({ t: 'inspect', obj: w.id, free: true }); out.push({ t: 'press', obj: w.id }); }); return out; },
    apply(p, s, a) {
      const w = p.switches.find(x => x.id === a.obj); if (!w) return { blocked: 'Nothing there.' };
      const n = clone(s);
      if (a.t === 'inspect') { n.seen[a.obj] = true; return { s: n, free: true, info: w.look }; }
      if (a.t !== 'press') return { blocked: 'Nothing to do there.' };
      if (p.order[s.step] === a.obj) { n.step = s.step + 1; return { s: n, ev: ['switchOk'] }; }
      return { s: n, fail: 'The wrong switch! Spikes thunder up from the floor and the room resets.', ev: ['trap'] };
    },
    goal: (p, s) => s.step >= p.order.length,
    say: (p, a) => a.t === 'inspect' ? 'Study this switch closely.' : 'Press this switch.'
  };
  function trapOrder(p) { return p.switches.slice().sort((a, b) => b.wear - a.wear).map(w => w.id); }

  /* ---- gear: two meshed gears of different size (L10) ---- */
  KIND.gear = {
    init: p => ({ a: p.start[0], b: p.start[1] }),
    actions: p => [{ t: 'gear', obj: 'gear_a', d: 1 }, { t: 'gear', obj: 'gear_a', d: -1 }, { t: 'gear', obj: 'gear_b', d: 1 }, { t: 'gear', obj: 'gear_b', d: -1 }],
    apply(p, s, a) {
      if (a.t !== 'gear') return { blocked: 'Nothing to do there.' };
      const k = a.obj === 'gear_a' ? a.d : -a.d;       // meshed gears turn in opposite directions
      return { s: { a: mod(s.a + k, p.na), b: mod(s.b - k, p.nb) }, ev: ['gear'] };
    },
    goal: (p, s) => s.a === 0 && s.b === 0,
    say: (p, a) => 'Turn this gear one tooth ' + (a.d > 0 ? 'clockwise.' : 'counter-clockwise.')
  };

  /* ======================= solver (BFS) ======================= */
  function solve(kind, p, s0, limit) {
    const M = KIND[kind]; limit = limit || 250000;
    if (M.goal(p, s0)) return [];
    const nodes = [{ s: s0, parent: -1, a: null }], seen = new Set([JSON.stringify(s0)]);
    for (let i = 0; i < nodes.length && nodes.length < limit; i++) {
      const acts = M.actions(p, nodes[i].s);
      for (let j = 0; j < acts.length; j++) {
        const r = M.apply(p, nodes[i].s, acts[j]);
        if (!r.s || r.fail) continue;
        const key = JSON.stringify(r.s); if (seen.has(key)) continue; seen.add(key);
        nodes.push({ s: r.s, parent: i, a: acts[j] });
        if (M.goal(p, r.s)) { const path = []; for (let k = nodes.length - 1; nodes[k].parent >= 0; k = nodes[k].parent) path.unshift(nodes[k].a); return path; }
      }
    }
    return null;
  }

  /* ======================= level validation ======================= */
  function validateLevel(def) {
    const bad = m => { throw new Error('Level ' + (def && def.levelId) + ': ' + m); };
    if (!def || typeof def !== 'object') throw new Error('Level definition missing');
    ['levelId', 'worldId', 'title', 'objective', 'difficulty'].forEach(k => { if (typeof def[k] !== 'string' || !def[k]) bad('missing ' + k); });
    if (!Array.isArray(def.hints) || def.hints.length !== 3) bad('needs exactly 3 hints');
    if (!Number.isInteger(def.par) || def.par < 1) bad('par must be a positive integer');
    if (!Array.isArray(def.stages) || !def.stages.length) bad('needs at least one stage');
    const ids = new Set();
    def.stages.forEach((st, i) => {
      if (!KIND[st.kind]) bad('stage ' + i + ' has unknown kind "' + st.kind + '"');
      if (!st.id || ids.has(st.id)) bad('stage ' + i + ' needs a unique id');
      ids.add(st.id); const p = st.p; if (!p) bad('stage ' + st.id + ' has no parameters');
      const need = (c, m) => { if (!c) bad('stage ' + st.id + ': ' + m); };
      if (st.kind === 'place') { need(p.zones && p.zones[p.start], 'start zone does not exist'); need(p.zones[p.plate], 'plate zone does not exist'); }
      if (st.kind === 'beam') {
        need(Number.isInteger(p.steps) && p.steps > 0, 'steps'); need(p.source && p.bounds, 'source/bounds');
        const rid = new Set(p.receivers.map(r => r.id)); p.need.forEach(i2 => need(rid.has(i2), 'needs unknown receiver ' + i2));
        p.mirrors.forEach(m => need(m.start >= 0 && m.start < p.steps, 'mirror ' + m.id + ' start angle out of range'));
        (p.blockers || []).forEach(b => need(b.slots[b.start], 'block ' + b.id + ' start socket missing'));
      }
      if (st.kind === 'symbols') { need(p.solution.every(s => p.symbols.includes(s)), 'solution uses unknown symbols'); need(p.start.length === p.slots, 'start length'); }
      if (st.kind === 'balance') { need(p.stones.length >= 2 && p.stones.every(s => s.w > 0), 'stones need positive weights'); need(p.cap >= 1, 'cap'); }
      if (st.kind === 'water') { need(p.tiles.filter(t => t.t === 'source').length === 1, 'exactly one source'); need(p.tiles.some(t => t.t === 'receiver'), 'a receiver'); need(new Set(p.tiles.map(t => t.id)).size === p.tiles.length, 'tile ids unique'); p.tiles.forEach(t => need(BASE[t.t], 'unknown tile type ' + t.t)); }
      if (st.kind === 'search') { need(p.jars.some(j => j.id === p.keyIn), 'keyIn is not a jar'); }
      if (st.kind === 'trap') { need(p.order.every(id => p.switches.some(w => w.id === id)), 'order refers to unknown switch'); }
    });
    return true;
  }

  /* Prove a level: every stage solvable, clues sufficient, par not below the best possible, start not already solved. */
  function verifyLevel(def) {
    validateLevel(def);
    const problems = [], stages = []; let moves = 0;
    def.stages.forEach(st => {
      const M = KIND[st.kind], s0 = M.init(st.p), p = st.p;
      if (M.goal(p, s0)) problems.push(st.id + ': already solved at the start');
      const path = solve(st.kind, p, s0);
      if (!path) { problems.push(st.id + ': no solution'); stages.push({ id: st.id, steps: null }); return; }
      const paid = path.filter(a => !a.free).length; moves += paid; stages.push({ id: st.id, steps: path.length, moves: paid, path });
      if (st.kind === 'symbols') { const c = clueSolutions(p); if (c.length !== 1 || c[0].join() !== p.solution.join()) problems.push(st.id + ': clue allows ' + c.length + ' answers'); }
      if (st.kind === 'search') { const c = clueJars(p); if (c.length !== 1 || c[0].id !== p.keyIn) problems.push(st.id + ': clue matches ' + c.length + ' jars'); }
      if (st.kind === 'trap') { const o = trapOrder(p); if (o.join() !== p.order.join()) problems.push(st.id + ': wear marks do not give the stated order'); if (new Set(p.switches.map(w => w.wear)).size !== p.switches.length) problems.push(st.id + ': wear marks are ambiguous'); }
    });
    if (def.par < moves) problems.push('par ' + def.par + ' is below the best possible ' + moves);
    return { ok: !problems.length, problems, optimal: moves, stages };
  }

  /* ======================= game session ======================= */
  function createGame(def) {
    validateLevel(def);
    const G = {
      def, stage: 0, moves: 0, hints: 0, hintLvl: 0, traps: 0, complete: false, relic: false, restarts: 0,
      states: def.stages.map(st => KIND[st.kind].init(st.p)), hist: [], lastInfo: ''
    };
    const snap = () => ({ stage: G.stage, states: clone(G.states), moves: G.moves, complete: G.complete });
    G.initial = snap();
    G.cur = () => def.stages[G.stage];
    G.state = () => G.states[G.stage];
    G.actions = () => G.complete ? [] : KIND[G.cur().kind].actions(G.cur().p, G.state());
    G.canUndo = () => G.hist.length > 0 && !G.complete;
    G.perform = function (a) {
      if (G.complete) return { ok: false, blocked: 'This puzzle is already solved.' };
      const st = G.cur(), M = KIND[st.kind], r = M.apply(st.p, G.state(), a);
      if (r.blocked) return { ok: false, blocked: r.blocked };
      const before = snap(), out = { ok: true, ev: (r.ev || []).slice(), info: r.info || '' };
      if (r.free) { G.states[G.stage] = r.s; out.free = true; return out; }       // inspecting costs nothing and is not undone
      G.hist.push(before); G.moves++; G.hintLvl = 0;
      if (r.fail) {
        G.traps++; G.states[G.stage] = M.init(st.p); out.fail = r.fail; out.ev.push('reset'); return out;
      }
      G.states[G.stage] = r.s;
      if (M.goal(st.p, r.s)) {
        out.ev.push('stageDone'); out.stageDone = st.id;
        if (G.stage === def.stages.length - 1) { G.complete = true; out.complete = true; out.ev.push('complete'); } else G.stage++;
      }
      return out;
    };
    G.undo = function () {
      if (!G.canUndo()) return false;
      const s = G.hist.pop(); G.stage = s.stage; G.states = s.states; G.moves = s.moves; G.hintLvl = 0; return true;
    };
    G.restart = function () {
      const s = clone(G.initial); G.stage = s.stage; G.states = s.states; G.moves = 0; G.hist = []; G.complete = false; G.hintLvl = 0; G.restarts++;
    };
    G.hint = function () {
      if (G.complete) return null;
      G.hints++; G.hintLvl = Math.min(3, G.hintLvl + 1);
      const st = G.cur(), path = solve(st.kind, st.p, G.state()), next = (path && path[0]) || null;      // the very next step, even a free look at a clue
      const h = { level: G.hintLvl, text: G.def.hints[G.hintLvl - 1], obj: null, action: null };
      if (G.hintLvl >= 2 && next) h.obj = next.obj;
      if (G.hintLvl >= 3 && next) { h.action = next; h.demo = KIND[st.kind].say(st.p, next); }
      return h;
    };
    G.stageSolution = () => { const st = G.cur(); return solve(st.kind, st.p, G.state()); };
    G.flow = () => { const st = G.cur(); return st.kind === 'water' ? flow(st.p, G.state()) : null; };
    G.trace = () => { const st = G.cur(); return st.kind === 'beam' ? trace(st.p, G.state()) : null; };
    G.collectRelic = () => { if (G.relic) return false; G.relic = true; return true; };
    G.result = () => scoreFor(def, { moves: G.moves, hints: G.hints, traps: G.traps, relic: G.relic });
    return G;
  }

  /* ======================= stars & score ======================= */
  function scoreFor(def, r) {
    const s2 = r.moves <= def.par, s3 = !!r.relic && r.hints === 0;
    const parts = [{ k: 'base', label: 'Puzzle solved', v: 600 }];
    parts.push({ k: 'eff', label: s2 ? 'Within the par of ' + def.par + ' moves' : 'Efficiency (' + r.moves + ' vs par ' + def.par + ')', v: s2 ? 400 : Math.max(0, Math.round(400 * def.par / Math.max(1, r.moves) * 0.5)) });
    if (r.relic) parts.push({ k: 'relic', label: 'Hidden relic found', v: 300 });
    if (r.hints) parts.push({ k: 'hint', label: 'Hints used (' + r.hints + ')', v: -75 * r.hints });
    if (r.traps) parts.push({ k: 'trap', label: 'Trap triggered (' + r.traps + ')', v: -100 * r.traps });
    const total = Math.max(100, parts.reduce((a, p) => a + p.v, 0));
    return { stars: 1 + (s2 ? 1 : 0) + (s3 ? 1 : 0), s2, s3, parts, total };
  }

  /* ======================= progression & save ======================= */
  const SAVE_VERSION = 1;
  function defaultSave() {
    return { v: SAVE_VERSION, done: {}, relics: {}, last: 1, settings: { quality: 'auto', sfx: 1, music: 1, haptics: 1, reduceMotion: 0, sens: 1, captions: 1 }, seenHow: 0 };
  }
  function normalizeSave(raw) {
    const d = defaultSave();
    if (!raw || typeof raw !== 'object') return d;
    const out = Object.assign(d, { last: Number.isInteger(raw.last) ? raw.last : 1, seenHow: raw.seenHow ? 1 : 0 });
    if (raw.settings && typeof raw.settings === 'object') Object.keys(d.settings).forEach(k => { if (k in raw.settings && typeof raw.settings[k] === typeof d.settings[k]) out.settings[k] = raw.settings[k]; });
    if (raw.done && typeof raw.done === 'object') Object.keys(raw.done).forEach(id => {
      const r = raw.done[id]; if (!r || typeof r !== 'object') return;
      out.done[id] = { stars: Math.max(1, Math.min(3, r.stars | 0)), best: r.best | 0, moves: r.moves | 0, hints: r.hints | 0, attempts: Math.max(1, r.attempts | 0) };
    });
    if (raw.relics && typeof raw.relics === 'object') Object.keys(raw.relics).forEach(id => { if (raw.relics[id]) out.relics[id] = 1; });
    return out;
  }
  function recordResult(save, def, res, attempts) {
    const prev = save.done[def.levelId], stars = Math.max(prev ? prev.stars : 0, res.stars);
    save.done[def.levelId] = { stars, best: Math.max(prev ? prev.best : 0, res.total), moves: prev ? Math.min(prev.moves, res.moves) : res.moves, hints: prev ? Math.min(prev.hints, res.hints) : res.hints, attempts: (prev ? prev.attempts : 0) + Math.max(1, attempts || 1) };
    return save;
  }
  const isUnlocked = (save, levels, i) => i === 0 || !!save.done[levels[i - 1].levelId];
  const totalStars = save => Object.keys(save.done).reduce((a, k) => a + save.done[k].stars, 0);
  function loadSave(storage, key) {
    try { const t = storage.getItem(key); return normalizeSave(t ? JSON.parse(t) : null); } catch (e) { return defaultSave(); }
  }
  function writeSave(storage, key, save) {       // write a temp copy first, then replace the real one
    try { const txt = JSON.stringify(save); storage.setItem(key + '.tmp', txt); storage.setItem(key, txt); storage.removeItem(key + '.tmp'); return true; } catch (e) { return false; }
  }

  return {
    KIND, solve, trace, flow, bridgePath, nearestZone, clueSolutions, clueJars, trapOrder, tileMask, sums, rotMask,
    validateLevel, verifyLevel, createGame, scoreFor,
    SAVE_VERSION, defaultSave, normalizeSave, recordResult, isUnlocked, totalStars, loadSave, writeSave,
    MIRROR_HALF, BLOCK_R, RECV_R, BASE
  };
});
