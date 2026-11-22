// Generates games/mindverse-levels-extra.js: MindVerse levels 11-30 (World 2 "Sunken Sanctum" and World 3 "Sky Observatory").
// Every level is built from a known-solvable arrangement, then checked by the rules engine's solver, so nothing unsolvable can ship.
// Run: node tests/tools/gen-mindverse-levels.js        (deterministic: same output every time)
'use strict';
const fs = require('fs');
const path = require('path');
const E = require('../../games/mindverse-engine.js');

const rngOf = seed => { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
const pick = (r, a) => a[Math.floor(r() * a.length)];
const shuffle = (r, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const bm = (x0, x1, z0, z1) => ({ x0, x1, z0, z1 });
const mod = (a, n) => ((a % n) + n) % n;
const D2R = Math.PI / 180;

/* ------------------------------ BEAM ------------------------------ */
function genBeam(o) {
  for (let attempt = 0; attempt < 20000; attempt++) {
    const r = rngOf(o.seed * 1000 + attempt), B = bm(-9.5, 9.5, -6.5, 6.5), pathMirrors = [], segs = [];
    let x = -8.5, z = pick(r, [-4, -2, 0, 2, 4]), dir = 0; const src = { x, z, dir: 0 }; let ok = true;
    for (let i = 0; i < o.n; i++) {
      const L = pick(r, [3, 4, 5, 6, 7]); let nx = x + Math.cos(dir * D2R) * L, nz = z + Math.sin(dir * D2R) * L;
      nx = Math.round(nx * 2) / 2; nz = Math.round(nz * 2) / 2;
      if (Math.abs(nx) > 8 || Math.abs(nz) > 5) { ok = false; break; }
      if (pathMirrors.some(m => Math.hypot(m.x - nx, m.z - nz) < 3)) { ok = false; break; }
      const turn = pick(r, [90, -90]), nd = mod(dir + turn, 360);
      const room = (px, pz, d) => { const dx = Math.cos(d * D2R), dz = Math.sin(d * D2R); let t = 0; for (; t < 20; t += .5) { const ex = px + dx * t, ez = pz + dz * t; if (Math.abs(ex) > 9 || Math.abs(ez) > 6) break; } return t; };
      if (room(nx, nz, nd) < 3.5) { ok = false; break; }
      const theta = mod((dir + nd) / 2 + (Math.abs(dir - nd) > 180 ? 90 : 0), 180), idx = Math.round(theta / 22.5) % 8;
      segs.push({ x1: x, z1: z, x2: nx, z2: nz, d: dir }); pathMirrors.push({ x: nx, z: nz, solved: idx }); x = nx; z = nz; dir = nd;
    }
    if (!ok) continue;
    segs.push({ x1: x, z1: z, x2: x + Math.cos(dir * D2R) * 30, z2: z + Math.sin(dir * D2R) * 30, d: dir });
    // relays on the straight parts of the route
    const relays = [], onSeg = (s, t) => ({ x: s.x1 + (s.x2 - s.x1) * t, z: s.z1 + (s.z2 - s.z1) * t });
    const lenOf = s => Math.hypot(s.x2 - s.x1, s.z2 - s.z1);
    let tries = 0; while (relays.length < o.relays && tries++ < 200) {
      const si = Math.floor(r() * segs.length), s = segs[si], L = Math.min(lenOf(s), si === segs.length - 1 ? 9 : 99); if (L < 4) continue;
      const d = 1.8 + r() * (L - 3.6), pt = onSeg(s, d / lenOf(s)); pt.x = Math.round(pt.x * 2) / 2; pt.z = Math.round(pt.z * 2) / 2;
      if (Math.abs(pt.x) > 8.8 || Math.abs(pt.z) > 5.8) continue;
      if (relays.some(q => Math.hypot(q.x - pt.x, q.z - pt.z) < 2.6) || pathMirrors.some(m => Math.hypot(m.x - pt.x, m.z - pt.z) < 2.9) || Math.hypot(src.x - pt.x, src.z - pt.z) < 2.5) continue;
      relays.push(pt);
    }
    if (relays.length < o.relays) continue;
    const mirrors = pathMirrors.map((m, i) => ({ id: 'mirror_' + (i + 1), x: m.x, z: m.z, start: 0, solved: m.solved }));
    // decoy mirrors, far from the route
    const distToRoute = (px, pz) => Math.min.apply(null, segs.map(s => { const L = Math.max(1e-6, lenOf(s)), t = Math.max(0, Math.min(1, ((px - s.x1) * (s.x2 - s.x1) + (pz - s.z1) * (s.z2 - s.z1)) / (L * L))); return Math.hypot(px - (s.x1 + (s.x2 - s.x1) * t), pz - (s.z1 + (s.z2 - s.z1) * t)); }));
    for (let d = 0; d < (o.decoys || 0); d++) { for (let k = 0; k < 60; k++) { const px = Math.round((r() * 16 - 8) * 2) / 2, pz = Math.round((r() * 10 - 5) * 2) / 2; if (distToRoute(px, pz) > 2.6 && mirrors.every(m => Math.hypot(m.x - px, m.z - pz) > 2.5) && relays.every(q => Math.hypot(q.x - px, q.z - pz) > 2)) { mirrors.push({ id: 'mirror_' + (mirrors.length + 1), x: px, z: pz, start: Math.floor(r() * 8), solved: null }); break; } } }
    // blocks: slots on the route (they block it) and slots well away from it
    const blockers = [];
    for (let b = 0; b < (o.blockers || 0); b++) {
      const slots = []; let n = 0;
      while (slots.length < 2 && n++ < 200) { const s = segs[Math.floor(r() * (segs.length))], L = Math.min(lenOf(s), 9); if (L < 4) continue; const d = 1.4 + r() * (L - 2.8), pt = onSeg(s, d / lenOf(s)); pt.x = Math.round(pt.x * 2) / 2; pt.z = Math.round(pt.z * 2) / 2;
        if (Math.abs(pt.x) > 8.5 || Math.abs(pt.z) > 5.5) continue; if (relays.some(q => Math.hypot(q.x - pt.x, q.z - pt.z) < 2.2) || mirrors.some(m => Math.hypot(m.x - pt.x, m.z - pt.z) < 2.7) || slots.some(q => Math.hypot(q.x - pt.x, q.z - pt.z) < 2) || Math.hypot(src.x - pt.x, src.z - pt.z) < 2) continue; slots.push(pt); }
      if (slots.length < 2) { ok = false; break; }
      let free = null; for (let k = 0; k < 80 && !free; k++) { const px = Math.round((r() * 16 - 8) * 2) / 2, pz = Math.round((r() * 10 - 5) * 2) / 2; if (distToRoute(px, pz) > 2.3 && mirrors.every(m => Math.hypot(m.x - px, m.z - pz) > 2.7) && relays.every(q => Math.hypot(q.x - px, q.z - pz) > 2.2) && blockers.every(bk => bk.slots.every(s2 => Math.hypot(s2.x - px, s2.z - pz) > 2))) free = { x: px, z: pz }; }
      if (!free) { ok = false; break; }
      slots.push(free); blockers.push({ id: 'block_' + (b + 1), start: 0, slots });
    }
    if (!ok) continue;
    // scramble the route mirrors so none starts solved
    mirrors.forEach(m => { if (m.solved !== null) { do { m.start = Math.floor(r() * 8); } while (m.start === m.solved); } });
    const solvedState = { m: Object.fromEntries(mirrors.map(m => [m.id, m.solved === null ? m.start : m.solved])), b: Object.fromEntries(blockers.map(b => [b.id, 1])) };
    const p = { steps: 8, bounds: B, source: src, mirrors: mirrors.map(m => ({ id: m.id, x: m.x, z: m.z, start: m.start })), receivers: relays.map((q, i) => ({ id: 'relay_' + (i + 1), x: q.x, z: q.z })), need: relays.map((q, i) => 'relay_' + (i + 1)), blockers };
    const tr = E.trace(p, solvedState); if (!p.need.every(id => tr.lit[id]) || tr.segs.length !== o.n + 1) continue;   // the route must work and have no stray reflections
    const s0 = E.KIND.beam.init(p); if (E.KIND.beam.goal(p, s0)) continue;
    const sol = E.solve('beam', p, s0, 120000); if (!sol || sol.length < (o.min || 4)) continue;
    return p;
  }
  throw new Error('could not generate a beam stage for ' + JSON.stringify(o));
}

/* ------------------------------ WATER ------------------------------ */
function genWater(o) {
  const NBIT = 1, EBIT = 2, SBIT = 4, WBIT = 8, DIRS = [[1, 0, EBIT, WBIT], [0, 1, SBIT, NBIT], [0, -1, NBIT, SBIT], [-1, 0, WBIT, EBIT]];
  for (let attempt = 0; attempt < 600; attempt++) {
    const r = rngOf(o.seed * 7919 + attempt), cols = o.cols, rows = o.rows, r0 = Math.floor(r() * rows), r1 = Math.floor(r() * rows);
    // self-avoiding walk from (1, r0) to (cols-2, r1)
    const seen = {}, route = [[1, r0]]; seen['1,' + r0] = 1; let guard = 0, okp = false;
    const dfs = () => { if (guard++ > 4000) return false; const [c, rr] = route[route.length - 1]; if (c === cols - 2 && rr === r1) return route.length >= o.minLen; const opts = shuffle(r, DIRS.slice()).sort((a, b) => (b[0] * (r() < .7 ? 1 : 0)) - (a[0] * (r() < .7 ? 1 : 0)));
      for (const d of opts) { const nc = c + d[0], nr = rr + d[1]; if (nc < 1 || nc > cols - 2 || nr < 0 || nr >= rows || seen[nc + ',' + nr]) continue; seen[nc + ',' + nr] = 1; route.push([nc, nr]); if (dfs()) return true; route.pop(); delete seen[nc + ',' + nr]; } return false; };
    if (!dfs() || route.length > o.maxLen) continue;
    const tiles = [{ id: 'water_source', t: 'source', c: 0, r: r0, fixed: true }, { id: 'water_receiver', t: 'receiver', c: cols - 1, r: r1, rot: 0, fixed: true }], path = [];
    route.forEach((cell, i) => {
      const prev = i ? route[i - 1] : [0, r0], next = i < route.length - 1 ? route[i + 1] : [cols - 1, r1], bit = (a, b) => { const dc = b[0] - a[0], dr = b[1] - a[1]; return dc === 1 ? EBIT : dc === -1 ? WBIT : dr === 1 ? SBIT : NBIT; };
      const m = bit(cell, prev) | bit(cell, next); path.push({ cell, mask: m });
    });
    const maskType = m => (m === 5 || m === 10) ? 'straight' : 'elbow';
    const correct = (type, m) => { for (let rr = 0; rr < 4; rr++) if (E.rotMask(E.BASE[type], rr) === m) return rr; };
    const straights = path.map((q, i) => ({ q, i })).filter(x => maskType(x.q.mask) === 'straight').map(x => x.i);
    const valveIdx = shuffle(r, straights).slice(0, o.valves);
    if (valveIdx.length < o.valves) continue;
    const rotCandidates = path.map((q, i) => i).filter(i => !valveIdx.includes(i)); const rotIdx = new Set(shuffle(r, rotCandidates).slice(0, Math.min(o.rot, rotCandidates.length)));
    // every elbow that is not rotatable stays fixed in place, so prefer rotating elbows
    path.forEach((q, i) => {
      const type = maskType(q.mask), id = (valveIdx.includes(i) ? 'valve_' : 'pipe_') + (i + 1);
      if (valveIdx.includes(i)) { tiles.push({ id, t: 'valve', c: q.cell[0], r: q.cell[1], rot: q.mask === 5 ? 1 : 0, fixed: true }); return; }
      const rc = correct(type, q.mask);
      if (rotIdx.has(i)) { let st; do { st = Math.floor(r() * 4); } while (E.rotMask(E.BASE[type], st) === q.mask); tiles.push({ id, t: type, c: q.cell[0], r: q.cell[1], rot: st }); } else tiles.push({ id, t: type, c: q.cell[0], r: q.cell[1], rot: rc, fixed: true });
    });
    // decoy old pipes that are fixed
    for (let c = 0; c < cols; c++) for (let rr = 0; rr < rows; rr++) { if (tiles.some(t => t.c === c && t.r === rr)) continue; if (r() < .62) tiles.push({ id: 'old_' + c + '_' + rr, t: pick(r, ['straight', 'elbow', 'elbow', 'tee']), c, r: rr, rot: Math.floor(r() * 4), fixed: true }); }
    const p = { cols, rows, tiles }; const M = E.KIND.water, s0 = M.init(p);
    if (M.goal(p, s0)) continue;
    const sol = E.solve('water', p, s0, 150000); if (!sol || sol.length < (o.min || 6)) continue;
    if (valveIdx.length && sol.filter(a => a.t === 'valve').length < valveIdx.length) continue;         // every valve must matter
    return p;
  }
  throw new Error('could not generate a water stage for ' + JSON.stringify(o));
}

/* ------------------------------ BALANCE ------------------------------ */
function genBalance(o) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const r = rngOf(o.seed * 31 + attempt), n = o.n, w = []; for (let i = 0; i < n; i++) w.push(1 + Math.floor(r() * 9));
    const stones = w.map((x, i) => ({ id: 'stone_' + (i + 1), w: x })), cap = 3;
    let count = 0; for (let m = 0; m < (1 << n); m++) { let L = 0, R = 0, cl = 0, cr = 0; for (let i = 0; i < n; i++) { if (m >> i & 1) { R += w[i]; cr++; } else { L += w[i]; cl++; } } if (cl <= cap && cr <= cap && R - L === o.target) count++; }
    if (count < 1 || count > (o.maxSol || 6)) continue;
    return { stones, cap, tol: 0, target: o.target, requireAll: true };
  }
  throw new Error('could not generate a balance stage');
}

/* ------------------------------ SYMBOLS ------------------------------ */
const SYM_WORD = { spiral: 'spiral', triangle: 'triangle', sun: 'sun', wave: 'wave', moon: 'moon', eye: 'eye', star: 'star' };
const ORD = ['first', 'second', 'third', 'fourth', 'fifth'];
function genSymbols(o) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const r = rngOf(o.seed * 17 + attempt), symbols = o.symbols.slice(), slots = o.slots, solution = shuffle(r, symbols).slice(0, slots);
    const facts = []; solution.forEach((s, i) => { facts.push({ k: 'at', s, pos: i }); symbols.forEach(t => { if (t !== s) facts.push({ k: 'notAt', s: t, pos: i }); }); for (let j = i + 1; j < slots; j++) facts.push({ k: 'left', a: s, b: solution[j] }); });
    const clue = [{ k: 'distinct' }], order = shuffle(r, facts); let used = 0;
    const count = c => { let n = 0; const rec = q => { if (q.length === slots) { const seq = q; const okc = c.every(k => k.k === 'at' ? seq[k.pos] === k.s : k.k === 'notAt' ? seq[k.pos] !== k.s : k.k === 'left' ? seq.indexOf(k.a) < seq.indexOf(k.b) : new Set(seq).size === seq.length); if (okc) n++; return; } symbols.forEach(s => rec(q.concat(s))); }; rec([]); return n; };
    for (const f of order) { if (count(clue) === 1) break; const t = clue.concat(f); if (count(t) < count(clue)) { clue.push(f); used++; } }
    if (count(clue) !== 1 || used < (o.minFacts || 2) || used > (o.maxFacts || 5)) continue;
    const lines = ['Each slot holds a different carving.'];
    clue.forEach(k => { if (k.k === 'at') lines.push('The ' + SYM_WORD[k.s] + ' stands in the ' + ORD[k.pos] + ' slot, counting from the left.'); if (k.k === 'notAt') lines.push('The ' + SYM_WORD[k.s] + ' is never in the ' + ORD[k.pos] + ' slot.'); if (k.k === 'left') lines.push('The ' + SYM_WORD[k.a] + ' sits somewhere to the left of the ' + SYM_WORD[k.b] + '.'); });
    let start; do { start = solution.map(() => Math.floor(r() * symbols.length)); } while (start.some((v, i) => symbols[v] === solution[i]));
    return { slots, symbols, start, solution, clue, clueLines: lines };
  }
  throw new Error('could not generate a symbols stage');
}

/* ------------------------------ SEARCH ------------------------------ */
const COLOR_WORD = { red: 'red', blue: 'blue', green: 'green' };
function genSearch(o) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const r = rngOf(o.seed * 13 + attempt), syms = ['spiral', 'triangle', 'sun'], cols = o.colors || ['red', 'blue'], sizes = ['small', 'large'], jars = [], seen = {};
    while (jars.length < o.jars) { const j = { sym: pick(r, syms), color: pick(r, cols), size: pick(r, sizes) }, k = j.sym + j.color + j.size; if (seen[k]) continue; seen[k] = 1; jars.push(j); }
    jars.forEach((j, i) => { j.id = 'jar_' + String.fromCharCode(97 + i); j.look = 'A ' + j.size + ' ' + j.color + ' jar carved with a ' + j.sym + '.'; });
    const key = pick(r, jars), facts = shuffle(r, [{ sym: key.sym }, { color: key.color }, { size: key.size }].concat(
      syms.filter(s => s !== key.sym).map(s => ({ notSym: s })), cols.filter(c => c !== key.color).map(c => ({ notColor: c })), sizes.filter(s => s !== key.size).map(s => ({ notSize: s }))));
    const clue = {}; let used = 0; const n = c => jars.filter(j => E.KIND.search && true && ((!c.sym || j.sym === c.sym) && (!c.color || j.color === c.color) && (!c.size || j.size === c.size) && (!c.notSym || j.sym !== c.notSym) && (!c.notColor || j.color !== c.notColor) && (!c.notSize || j.size !== c.notSize))).length;
    for (const f of facts) { if (n(clue) === 1) break; if (Object.keys(f)[0] in clue) continue; const t = Object.assign({}, clue, f); if (n(t) < n(clue)) { Object.assign(clue, f); used++; } }
    if (n(clue) !== 1 || used < (o.minFacts || 2)) continue;
    const bits = []; if (clue.size) bits.push('a ' + clue.size); else bits.push('a'); const adj = []; if (clue.color) adj.push(COLOR_WORD[clue.color]); const jarPhrase = (bits[0] + ' ' + adj.join(' ') + ' jar').replace(/\s+/g, ' ');
    let text = 'The key sleeps in ' + jarPhrase + (clue.sym ? ' carved with the ' + clue.sym : '') + '.'; const nots = [];
    if (clue.notColor) nots.push('not ' + COLOR_WORD[clue.notColor]); if (clue.notSym) nots.push('not carved with the ' + clue.notSym); if (clue.notSize) nots.push('not ' + clue.notSize);
    if (nots.length) text = 'The key sleeps in a jar that is ' + nots.join(' and ') + (clue.size || clue.color || clue.sym ? ', yet it is ' + [clue.size, clue.color].filter(Boolean).join(' ') + (clue.sym ? ' and carved with the ' + clue.sym : '') : '') + '.';
    return { clue, clueText: text, keyIn: key.id, jars };
  }
  throw new Error('could not generate a search stage');
}

/* ------------------------------ TRAP ------------------------------ */
function genTrap(o) {
  const r = rngOf(o.seed * 53), syms = ['spiral', 'triangle', 'sun', 'wave', 'moon', 'eye'], ranks = shuffle(r, Array.from({ length: o.n }, (_, i) => i + 1)), dir = o.dir || 'desc';
  const looks = { 1: 'is thick with dust. Nobody has pressed it in ages.', 2: 'shows a few old scuffs.', 3: 'is scuffed and a little worn.', 4: 'is worn smooth in the middle.', 5: 'is polished to a shine by countless hands.', 6: 'is worn so deep that it shines like glass.' };
  const switches = ranks.map((w, i) => ({ id: 'switch_' + String.fromCharCode(97 + i), sym: syms[i], wear: w, look: 'The ' + syms[i] + ' switch ' + looks[w] }));
  const order = switches.slice().sort((a, b) => dir === 'asc' ? a.wear - b.wear : b.wear - a.wear).map(s => s.id);
  const clueText = dir === 'asc' ? 'Wake the sleepers first. Begin where the dust lies thickest and finish where the stone shines.' : 'Tread first where the travellers trod most. Finish where the dust sleeps.';
  return { clueText, dir, switches, order };
}

/* ------------------------------ GEAR / BRIDGE ------------------------------ */
function genGear(o) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const r = rngOf(o.seed * 97 + attempt), a = Math.floor(r() * o.na), b = Math.floor(r() * o.nb); if (a === 0 && b === 0) continue;
    const p = { na: o.na, nb: o.nb, start: [a, b] }; const sol = E.solve('gear', p, E.KIND.gear.init(p), 20000); if (sol && sol.length >= (o.min || 4)) return p;
  }
  throw new Error('could not generate a gear stage');
}
function genBridge(o) {
  const starts = [{ b: 2, p: 1, q: 0 }, { b: 2, p: 0, q: 0 }, { b: 3, p: 0, q: 0 }];
  const s = starts[o.variant % starts.length], p = { start: s }; const sol = E.solve('bridge', p, E.KIND.bridge.init(p), 5000); if (!sol || sol.length < 7) throw new Error('bridge variant too easy'); return p;
}

/* ------------------------------ level assembly ------------------------------ */
const CAM = {
  beam: p => ({ az: 0, el: 54, d: 23, t: [0, 0, 0] }),
  symbols: p => ({ az: 0, el: 20, d: 15 + (p.slots - 3) * 2, t: [0, 2.4, 0] }),
  balance: p => ({ az: 0, el: 24, d: 18 + (p.stones.length > 5 ? 2 : 0), t: [0, 2.4, 0] }),
  water: p => ({ az: 0, el: 56, d: 8 + p.cols * 2.1, t: [0, 0, .6] }),
  search: p => ({ az: 0, el: 38, d: 17, t: [0, 1.5, -.8] }),
  bridge: p => ({ az: -8, el: 30, d: 24, t: [0, .5, 0] }),
  trap: p => ({ az: 0, el: 30, d: 14 + p.switches.length * 1.1, t: [0, 1.2, 0] }),
  gear: p => ({ az: 0, el: 50, d: 9 + Math.max(p.na, p.nb) * .85, t: [0, 0, 0] })
};
const KIND_GOAL = {
  beam: 'Send the beam through every relay at the same time.', symbols: 'Set the panels to match the tablet.', balance: 'Rest every stone on a pan so the plaque shows a match.', water: 'Turn the channels and valves until water reaches the basin.',
  search: 'Read the clue, find the right jar, take the key to the door.', bridge: 'Plan the order of the lever, the plate and the rail.', trap: 'Press the switches in the safe order. A wrong one resets the room.', gear: 'Align both gears to their marks.'
};
const HINTS = {
  beam: ['A mirror turns the beam by twice its own angle.', 'Follow the beam from the source: the first mirror that is wrong is the one to turn. Move any block that sits on the route.', 'Turn the highlighted mirror, or slide the block to a free socket.'],
  symbols: ['Every rule on the tablet is true at the same time.', 'Start with the rule that names a slot, then use the others to rule symbols out.', 'Tap the highlighted panel until it shows the symbol the rules point to.'],
  balance: ['Add up the weights. The plaque shows what must match.', 'Try pairing the heaviest stone against the lightest ones.', 'Place the highlighted stone on the pan that gets you closer.'],
  water: ['Water needs a continuous route from the spring to the basin.', 'Find the pieces that do not line up and turn them. Do not forget the valves.', 'Turn the highlighted piece, then open the valves.'],
  search: ['The wall carving tells you which jar. Every word counts.', 'Cross out the jars that break any rule in the clue. One is left.', 'Open the highlighted jar, then take the key to the door.'],
  bridge: ['Each mechanism only works in some situations. Read the messages.', 'Work backwards from the end: the bridge must lie flat, with both platforms raised.', 'Use the highlighted control next.'],
  trap: ['The stone remembers how often each switch was used.', 'Study each switch. Then follow the order the carving describes.', 'Press the highlighted switch.'],
  gear: ['The two gears turn each other in opposite directions.', 'Turn the big gear first, then see where the small one lands.', 'Turn the highlighted gear one tooth.']
};
function stageOf(kind, id, p) { return { id, kind, goal: KIND_GOAL[kind], p }; }
function ring(stages) {                      // multi-stage rooms: stations in a circle around the core, camera looks toward the centre
  const n = stages.length, R = 36;
  stages.forEach((st, i) => { const a = (180 + i * 360 / n) * D2R; st.view = { x: +(R * Math.sin(a)).toFixed(2), z: +(R * Math.cos(a)).toFixed(2), rot: +((a % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)).toFixed(4), cam: CAM[st.kind](st.p) }; if (st.kind === 'beam') st.view.cam.d = 25; if (st.kind === 'water') st.view.cam.d += 2; });
}
function finish(meta, stages, env, theme) {
  const def = { n: meta.n, levelId: meta.id, worldId: meta.world, theme, title: meta.title, difficulty: meta.diff, mechanic: meta.mech, objective: meta.objective, intro: meta.intro,
    goalConditions: meta.goals, hints: meta.hints, par: 9999, validation: { solutionRequired: true, generated: true }, env, cam: CAM[stages[0].kind](stages[0].p), relic: meta.relic, stages };
  if (stages.length > 1) { ring(stages); def.cam = { az: 0, el: 30, d: 30, t: [0, 3, -12] }; }
  const v = E.verifyLevel(def); if (!v.ok) throw new Error(meta.id + ': ' + v.problems.join('; '));
  def.par = Math.ceil(v.optimal * 1.35) + 1; def.optimal = v.optimal; return def;
}
const hintsFor = kinds => { const k = kinds[0], h = HINTS[k]; return kinds.length > 1 ? ['Each mechanism wakes the next one. Work through them in order.', 'The current station is glowing. Solve it before looking at the others.', h[2]] : h.slice(); };
const relicOf = (env, kind, p) => kind === 'beam' ? { x: -7.4, y: 1.2, z: 5.2 } : kind === 'water' ? { x: p.cols * 1.25 + .3, y: .9, z: p.rows * 1.25 + .1 } : kind === 'symbols' ? { x: 6.8, y: .9, z: 2.6 } : kind === 'balance' ? { x: 6.6, y: .9, z: 2.2 } : kind === 'search' ? { x: -6.2, y: 1, z: 3.4 } : kind === 'bridge' ? { x: 1.4, y: 1, z: 5.4 } : kind === 'trap' ? { x: 6.6, y: .9, z: 4.4 } : { x: 5.4, y: .9, z: 4.4 };

const W2 = 'SUNKEN_SANCTUM', W3 = 'SKY_OBSERVATORY';
const SPECS = [
  // ---- World 2: Sunken Sanctum ----
  { n: 11, id: 'SS_L11', world: W2, title: 'Tide Mirrors', diff: 'MEDIUM', env: 'hall', intro: 'Water drips from the vault above. Three mirrors, two relays and a stone block that keeps drifting into the light.', stages: () => [['beam', genBeam({ seed: 11, n: 3, relays: 2, blockers: 1, min: 6 })]] },
  { n: 12, id: 'SS_L12', world: W2, title: 'Coral Code', diff: 'MEDIUM', env: 'wall', intro: 'Four carvings, three panels. The tablet gives rules, not the answer.', stages: () => [['symbols', genSymbols({ seed: 12, symbols: ['spiral', 'triangle', 'wave', 'moon'], slots: 3, minFacts: 3 })]] },
  { n: 13, id: 'SS_L13', world: W2, title: 'Pearl Scales', diff: 'MEDIUM', env: 'scale', intro: 'This scale is meant to be uneven: the plaque tells you by how much.', stages: () => [['balance', genBalance({ seed: 13, n: 6, target: 2, maxSol: 3 })]] },
  { n: 14, id: 'SS_L14', world: W2, title: 'Flooded Gallery', diff: 'MEDIUM_HARD', env: 'waterworks', intro: 'The gallery flooded long ago. Two valves still guard the way to the basin.', stages: () => [['water', genWater({ seed: 14, cols: 6, rows: 4, valves: 2, rot: 5, minLen: 7, maxLen: 11, min: 9 })]] },
  { n: 15, id: 'SS_L15', world: W2, title: 'The Sealed Urns', diff: 'MEDIUM_HARD', env: 'niche', intro: 'Six urns in three colours and two sizes. One clue, worded with care: read every rule.', stages: () => [['search', genSearch({ seed: 15, jars: 6, colors: ['red', 'blue', 'green'], minFacts: 3 })]] },
  { n: 16, id: 'SS_L16', world: W2, title: 'Clockwork Tide', diff: 'HARD', env: 'core', intro: 'A gear vault feeds a light beam. Wake the gears first.', stages: () => [['gear', genGear({ seed: 16, na: 14, nb: 10, min: 5 })], ['beam', genBeam({ seed: 116, n: 3, relays: 2, blockers: 1, min: 6 })]] },
  { n: 17, id: 'SS_L17', world: W2, title: 'The Drawbridge', diff: 'HARD', env: 'ravine', intro: 'The same bridge, a different position. The mechanisms remember where they stopped.', stages: () => [['bridge', genBridge({ variant: 0 })]] },
  { n: 18, id: 'SS_L18', world: W2, title: 'Whispering Switches', diff: 'HARD', env: 'trap', intro: 'Five switches whisper their history. Listen to the stone.', stages: () => [['trap', genTrap({ seed: 18, n: 5, dir: 'asc' })]] },
  { n: 19, id: 'SS_L19', world: W2, title: 'Crossing Currents', diff: 'HARD', env: 'network', intro: 'Three mirrors, three relays, and a longer road for the beam.', stages: () => [['beam', genBeam({ seed: 19, n: 3, relays: 3, blockers: 1, min: 6 })]] },
  { n: 20, id: 'SS_L20', world: W2, title: 'Heart of the Sanctum', diff: 'WORLD_FINAL', env: 'core', intro: 'Five mechanisms circle the Sanctum heart. Wake them one by one.', stages: () => [['symbols', genSymbols({ seed: 20, symbols: ['spiral', 'triangle', 'wave', 'moon'], slots: 3, minFacts: 3 })], ['balance', genBalance({ seed: 120, n: 5, target: 0, maxSol: 3 })], ['water', genWater({ seed: 220, cols: 5, rows: 3, valves: 1, rot: 4, minLen: 5, maxLen: 8, min: 6 })], ['gear', genGear({ seed: 320, na: 12, nb: 8, min: 5 })], ['beam', genBeam({ seed: 420, n: 3, relays: 3, blockers: 1, min: 6 })]] },
  // ---- World 3: Sky Observatory ----
  { n: 21, id: 'SO_L21', world: W3, title: 'Starlight Mirrors', diff: 'HARD', env: 'network', intro: 'Starlight enters the dome. Two blocks wander through its path.', stages: () => [['beam', genBeam({ seed: 21, n: 3, relays: 3, blockers: 2, min: 7 })]] },
  { n: 22, id: 'SO_L22', world: W3, title: 'Constellations', diff: 'HARD', env: 'wall', intro: 'Five stars, four slots. Rules cross each other: be patient.', stages: () => [['symbols', genSymbols({ seed: 22, symbols: ['spiral', 'triangle', 'wave', 'moon', 'star'], slots: 4, minFacts: 4, maxFacts: 7 })]] },
  { n: 23, id: 'SO_L23', world: W3, title: 'Counterweights', diff: 'HARD', env: 'scale', intro: 'Six stones, three to a pan, and a difference to hit exactly.', stages: () => [['balance', genBalance({ seed: 23, n: 6, target: 3, maxSol: 3 })]] },
  { n: 24, id: 'SO_L24', world: W3, title: 'The Great Aqueduct', diff: 'HARD', env: 'waterworks', intro: 'A long aqueduct with three valves and a lot of twisted pipe.', stages: () => [['water', genWater({ seed: 24, cols: 7, rows: 4, valves: 3, rot: 6, minLen: 9, maxLen: 14, min: 11 })]] },
  { n: 25, id: 'SO_L25', world: W3, title: 'The Orrery', diff: 'VERY_HARD', env: 'core', intro: 'Two sets of gears and a beam of starlight. The orrery wakes in order.', stages: () => [['gear', genGear({ seed: 25, na: 15, nb: 9, min: 5 })], ['gear', genGear({ seed: 125, na: 16, nb: 12, min: 5 })], ['beam', genBeam({ seed: 225, n: 3, relays: 3, blockers: 1, min: 6 })]] },
  { n: 26, id: 'SO_L26', world: W3, title: 'Archive of Jars', diff: 'VERY_HARD', env: 'core', intro: 'The archive keeps its key in one of seven jars, behind a trap.', stages: () => [['search', genSearch({ seed: 26, jars: 7, colors: ['red', 'blue', 'green'], minFacts: 3 })], ['trap', genTrap({ seed: 126, n: 4, dir: 'desc' })]] },
  { n: 27, id: 'SO_L27', world: W3, title: 'Skybridge', diff: 'VERY_HARD', env: 'core', intro: 'A bridge between towers, and a beam that must cross it.', stages: () => [['bridge', genBridge({ variant: 1 })], ['beam', genBeam({ seed: 27, n: 3, relays: 3, blockers: 2, min: 7 })]] },
  { n: 28, id: 'SO_L28', world: W3, title: 'Eclipse Trap', diff: 'VERY_HARD', env: 'core', intro: 'Five switches, and a code to read before you may touch them.', stages: () => [['symbols', genSymbols({ seed: 28, symbols: ['spiral', 'triangle', 'wave', 'moon', 'eye'], slots: 4, minFacts: 4, maxFacts: 7 })], ['trap', genTrap({ seed: 128, n: 5, dir: 'asc' })]] },
  { n: 29, id: 'SO_L29', world: W3, title: 'Grand Network', diff: 'EXPERT', env: 'network', intro: 'Four mirrors, two relays and a block that will not stay put. The grand beam.', stages: () => [['beam', genBeam({ seed: 29, n: 4, relays: 2, blockers: 1, min: 8 })]] },
  { n: 30, id: 'SO_L30', world: W3, title: 'The Final Core', diff: 'WORLD_FINAL', env: 'core', intro: 'Six mechanisms, all you have learned. Restore the Core and wake the sky.', stages: () => [['symbols', genSymbols({ seed: 30, symbols: ['spiral', 'triangle', 'wave', 'moon', 'star'], slots: 4, minFacts: 4, maxFacts: 7 })], ['balance', genBalance({ seed: 130, n: 6, target: 1, maxSol: 3 })], ['water', genWater({ seed: 230, cols: 6, rows: 4, valves: 2, rot: 5, minLen: 7, maxLen: 11, min: 9 })], ['gear', genGear({ seed: 330, na: 16, nb: 10, min: 6 })], ['beam', genBeam({ seed: 430, n: 4, relays: 2, blockers: 1, min: 7 })], ['trap', genTrap({ seed: 530, n: 5, dir: 'desc' })]] }
];

const levels = SPECS.map(sp => {
  const t0 = Date.now(), made = sp.stages(), stages = made.map((m, i) => stageOf(m[0], made.length > 1 ? 'stage_' + (i + 1) : m[0], m[1])), kinds = made.map(m => m[0]);
  const goals = kinds.length > 1 ? ['allStagesComplete', 'mechanismsAwake'] : ['goalReached'];
  const lvl = finish({ n: sp.n, id: sp.id, world: sp.world, title: sp.title, diff: sp.diff, mech: kinds.length > 1 ? 'MULTI_STAGE_COMBINATION' : kinds[0].toUpperCase(), objective: kinds.length > 1 ? 'Wake every mechanism in turn and restore the core.' : KIND_GOAL[kinds[0]],
    intro: sp.intro, goals, hints: hintsFor(kinds), relic: sp.env === 'core' ? { x: 5.5, y: 1.2, z: 6.5, name: 'Core Shard' } : relicOf(sp.env, kinds[0], made[0][1]) }, stages, sp.env, sp.world === W2 ? 'ocean' : 'dusk');
  lvl.relic.name = lvl.relic.name || (sp.world === W2 ? 'Pearl Shard' : 'Star Shard');
  console.log(sp.n, sp.title.padEnd(24), kinds.join('+').padEnd(34), 'optimal', String(lvl.optimal).padStart(3), 'par', String(lvl.par).padStart(3), (Date.now() - t0) + 'ms');
  return lvl;
});

const out = '/* MindVerse levels 11-30 (World 2 "Sunken Sanctum" and World 3 "Sky Observatory").\n * GENERATED by tests/tools/gen-mindverse-levels.js. Do not edit by hand: change the generator and run it again.\n * Every level was built from a known-solvable arrangement and verified by the rules engine solver. */\n' +
  "(function (root, factory) {\n  if (typeof module === 'object' && module.exports) module.exports = factory();\n  else root.MindverseLevelsExtra = factory();\n})(typeof self !== 'undefined' ? self : this, function () {\n  'use strict';\n  return " + JSON.stringify(levels) + ';\n});\n';
fs.writeFileSync(path.join(__dirname, '..', '..', 'games', 'mindverse-levels-extra.js'), out);
console.log('\nwrote games/mindverse-levels-extra.js (' + levels.length + ' levels, ' + Math.round(out.length / 1024) + ' KB)');
