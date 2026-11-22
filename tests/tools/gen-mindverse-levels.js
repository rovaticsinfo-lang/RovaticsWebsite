// Generates games/mindverse-levels-extra.js: MindVerse levels 11-65 (worlds 2 to 5).
// Every level is built from a known-solvable arrangement, then checked by the rules engine's solver, so nothing unsolvable can ship.
// Run: node tests/tools/gen-mindverse-levels.js        (deterministic: same output every time)
'use strict';
const fs = require('fs');
const path = require('path');
const E = require('../../games/mindverse-engine.js');

let DEADLINE = Infinity;
const rngOf = seed => { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
const pick = (r, a) => a[Math.floor(r() * a.length)];
const shuffle = (r, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const bm = (x0, x1, z0, z1) => ({ x0, x1, z0, z1 });
const mod = (a, n) => ((a % n) + n) % n;
const D2R = Math.PI / 180;

/* ------------------------------ BEAM ------------------------------ */
function genBeam(o) {
  for (let attempt = 0; attempt < 20000; attempt++) { if (Date.now() > DEADLINE) throw new Error('time');
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
    const fixed = [];
    for (let f = 0; f < (o.fixed || 0); f++) { for (let k = 0; k < 120; k++) { const px = Math.round((r() * 16 - 8) * 2) / 2, pz = Math.round((r() * 10 - 5) * 2) / 2; if (distToRoute(px, pz) > 2.6 && mirrors.every(m => Math.hypot(m.x - px, m.z - pz) > 2.7) && relays.every(q => Math.hypot(q.x - px, q.z - pz) > 2.4) && blockers.every(bk => bk.slots.every(s2 => Math.hypot(s2.x - px, s2.z - pz) > 2.2)) && fixed.every(q => Math.hypot(q.x - px, q.z - pz) > 2.6) && Math.hypot(src.x - px, src.z - pz) > 2.6) { fixed.push({ x: px, z: pz }); break; } } }
    // scramble the route mirrors so none starts solved
    mirrors.forEach(m => { if (m.solved !== null) { do { m.start = Math.floor(r() * 8); } while (m.start === m.solved); } });
    const solvedState = { m: Object.fromEntries(mirrors.map(m => [m.id, m.solved === null ? m.start : m.solved])), b: Object.fromEntries(blockers.map(b => [b.id, 1])) };
    const p = { steps: 8, bounds: B, source: src, mirrors: mirrors.map(m => ({ id: m.id, x: m.x, z: m.z, start: m.start })), receivers: relays.map((q, i) => ({ id: 'relay_' + (i + 1), x: q.x, z: q.z })), need: relays.map((q, i) => 'relay_' + (i + 1)), blockers, fixed };
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
  for (let attempt = 0; attempt < 600; attempt++) { if (Date.now() > DEADLINE) throw new Error('time');
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
  for (let attempt = 0; attempt < 800; attempt++) { if (Date.now() > DEADLINE) throw new Error('time');
    const r = rngOf(o.seed * 31 + attempt), n = o.n, cap = o.cap || 3, w = []; for (let i = 0; i < n; i++) w.push(1 + Math.floor(r() * (o.maxW || 9)));
    const stones = w.map((x, i) => ({ id: 'stone_' + (i + 1), w: x }));
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
  for (let attempt = 0; attempt < 500; attempt++) { if (Date.now() > DEADLINE) throw new Error('time');
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
  for (let attempt = 0; attempt < 500; attempt++) { if (Date.now() > DEADLINE) throw new Error('time');
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
    if (nots.length) text = 'The key sleeps in a jar that is ' + nots.join(' and ') + (clue.size || clue.color || clue.sym ? ', yet it is ' + ([clue.size, clue.color].filter(Boolean).join(' ') + (clue.sym ? (clue.size || clue.color ? ' and ' : '') + 'carved with the ' + clue.sym : '')) : '') + '.';
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
  for (let attempt = 0; attempt < 300; attempt++) { if (Date.now() > DEADLINE) throw new Error('time');
    const r = rngOf(o.seed * 97 + attempt), a = Math.floor(r() * o.na), b = Math.floor(r() * o.nb); if (a === 0 && b === 0) continue;
    const p = { na: o.na, nb: o.nb, start: [a, b] }; const sol = E.solve('gear', p, E.KIND.gear.init(p), 20000); if (sol && sol.length >= (o.min || 4)) return p;
  }
  throw new Error('could not generate a gear stage');
}
function genBridge(o) {
  const starts = [{ b: 2, p: 1, q: 0 }, { b: 2, p: 0, q: 0 }, { b: 3, p: 0, q: 0 }];
  const s = starts[o.variant % starts.length], p = { start: s }; const sol = E.solve('bridge', p, E.KIND.bridge.init(p), 5000); if (!sol || sol.length < 7) throw new Error('bridge variant too easy'); return p;
}

/* ------------------------------ PUSH (crates) ------------------------------ */
function genPush(o) {
  const DD = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  for (let attempt = 0; attempt < 250; attempt++) { if (Date.now() > DEADLINE) throw new Error('time');
    const r = rngOf(o.seed * 4421 + attempt), w = o.w, h = o.h, walls = [], cells = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push([x, y]);
    const wallCount = Math.floor(w * h * (o.wallDensity || .12)); shuffle(r, cells).slice(0, wallCount).forEach(c => walls.push(c));
    const isWall = (x, y) => walls.some(q => q[0] === x && q[1] === y), free = cells.filter(c => !isWall(c[0], c[1]));
    if (free.length < o.crates * 2 + 4) continue;
    const targets = shuffle(r, free).slice(0, o.crates); let crates = targets.map(t => t.slice()), pl = shuffle(r, free.filter(c => !targets.some(t => t[0] === c[0] && t[1] === c[1])))[0].slice();
    const occ = (x, y) => x < 0 || y < 0 || x >= w || y >= h || isWall(x, y) || crates.some(c => c[0] === x && c[1] === y);
    for (let k = 0; k < (o.scramble || 70); k++) {                                  // play the puzzle backwards: walk, and sometimes pull a crate along
      const d = pick(r, DD), bx = pl[0] - d[0], by = pl[1] - d[1]; if (occ(bx, by)) continue;
      const ci = crates.findIndex(c => c[0] === pl[0] + d[0] && c[1] === pl[1] + d[1]); if (ci >= 0 && r() < .65) crates[ci] = [pl[0], pl[1]]; pl = [bx, by];
    }
    if (crates.filter(c => targets.some(t => t[0] === c[0] && t[1] === c[1])).length > Math.max(0, o.crates - 2)) continue;
    const p = { w, h, walls, targets, crates, player: pl }, s0 = E.KIND.push.init(p); if (E.KIND.push.goal(p, s0)) continue;
    const sol = E.solve('push', p, s0, o.limit || 120000); if (!sol || sol.length < (o.min || 8)) continue; return p;
  }
  throw new Error('could not generate a push stage ' + JSON.stringify(o));
}
/* ------------------------------ RUNES (lights out) ------------------------------ */
function genRunes(o) {
  for (let attempt = 0; attempt < 400; attempt++) { if (Date.now() > DEADLINE) throw new Error('time');
    const r = rngOf(o.seed * 6007 + attempt), p0 = { w: o.w, h: o.h, pat: o.pat, start: Array(o.w * o.h).fill(1) };
    let s = E.KIND.runes.init(p0); const presses = shuffle(r, Array.from({ length: o.w * o.h }, (_, i) => i)).slice(0, o.presses || 6);
    presses.forEach(i => { s = E.KIND.runes.apply(p0, s, { t: 'press', obj: 'rune_' + i, i }).s; });
    const p = { w: o.w, h: o.h, pat: o.pat, start: s.b.slice() }; if (E.KIND.runes.goal(p, E.KIND.runes.init(p))) continue;
    const sol = E.solve('runes', p, E.KIND.runes.init(p), 200000); if (!sol || sol.length < (o.min || 4)) continue; return p;
  }
  throw new Error('could not generate a runes stage ' + JSON.stringify(o));
}
/* ------------------------------ DISCS (towers) ------------------------------ */
function genDiscs(o) {
  for (let attempt = 0; attempt < 300; attempt++) { if (Date.now() > DEADLINE) throw new Error('time');
    const r = rngOf(o.seed * 7001 + attempt), NP = o.pegs, goal = NP - 1; let pegs = Array.from({ length: NP }, () => []); for (let n = o.n; n >= 1; n--) pegs[0].push(n);
    const p0 = { pegs: NP, n: o.n, start: pegs, goal, adjacent: !!o.adjacent };
    let s = E.KIND.discs.init(p0); for (let k = 0; k < (o.scramble || 0); k++) { const acts = E.KIND.discs.actions(p0, s); s = E.KIND.discs.apply(p0, s, pick(r, acts)).s; }
    const p = { pegs: NP, n: o.n, start: s.p, goal, adjacent: !!o.adjacent }; if (E.KIND.discs.goal(p, E.KIND.discs.init(p))) continue;
    const sol = E.solve('discs', p, E.KIND.discs.init(p), 200000); if (!sol || sol.length < (o.min || 5)) continue; return p;
  }
  throw new Error('could not generate a discs stage ' + JSON.stringify(o));
}
/* ------------------------------ SLIDE (blocks) ------------------------------ */
function genSlide(o) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (Date.now() > DEADLINE) throw new Error('time');
    const r = rngOf(o.seed * 8209 + attempt), W = 6, H = 6, blocks = [], grid = Array.from({ length: H }, () => Array(W).fill(0));
    const put = (b) => { for (let k = 0; k < b.len; k++) { const x = b.ori === 'h' ? b.x + k : b.x, y = b.ori === 'h' ? b.y : b.y + k; if (x >= W || y >= H || grid[y][x]) return false; } for (let k = 0; k < b.len; k++) grid[b.ori === 'h' ? b.y : b.y + k][b.ori === 'h' ? b.x + k : b.x] = 1; blocks.push(b); return true; };
    const ky = 1 + Math.floor(r() * 4); put({ id: 'key', x: W - 2, y: ky, len: 2, ori: 'h', key: true });                 // start from the SOLVED picture ...
    let tries = 0; while (blocks.length < o.blocks && tries++ < 300) { const ori = r() < .5 ? 'h' : 'v', len = r() < .35 ? 3 : 2; put({ id: 'b' + blocks.length, x: Math.floor(r() * W), y: Math.floor(r() * H), len, ori }); }
    if (blocks.length < o.blocks) continue;
    const p0 = { w: W, h: H, blocks }, M = E.KIND.slide; let s = M.init(p0);
    for (let k = 0; k < (o.scramble || 60); k++) { const acts = M.actions(p0, s); if (!acts.length) break; s = M.apply(p0, s, acts[Math.floor(r() * acts.length)]).s; }   // ... and shuffle it with legal moves, so it is always solvable
    const p = { w: W, h: H, blocks: blocks.map(b => Object.assign({}, b, b.ori === 'h' ? { x: s.pos[b.id] } : { y: s.pos[b.id] })) };
    if (E.KIND.slide.goal(p, E.KIND.slide.init(p))) continue;
    const sol = E.solve('slide', p, E.KIND.slide.init(p), 15000); if (!sol || sol.length < (o.min || 5)) continue; return p;
  }
  throw new Error('could not generate a slide stage ' + JSON.stringify(o));
}
/* ------------------------------ RINGS ------------------------------ */
function genRings(o) {
  for (let attempt = 0; attempt < 300; attempt++) { if (Date.now() > DEADLINE) throw new Error('time');
    const r = rngOf(o.seed * 9109 + attempt), K = o.k, n = o.n, link = Array.from({ length: K }, () => Array(K).fill(0));
    for (let i = 0; i < K; i++) { link[i][i] = 1; if (i > 0 && r() < .9) link[i][i - 1] = r() < .7 ? 1 : -1; if (i < K - 1 && r() < .9) link[i][i + 1] = r() < .7 ? 1 : -1; if (r() < .25) { const j = Math.floor(r() * K); if (j !== i) link[i][j] = 1; } }
    const p0 = { n, start: Array(K).fill(0), link }; let s = E.KIND.rings.init(p0);
    for (let k = 0; k < (o.scramble || 10); k++) s = E.KIND.rings.apply(p0, s, { t: 'ring', obj: 'ring_' + Math.floor(r() * K), d: r() < .5 ? 1 : -1 }).s;
    const p = { n, start: s.r.slice(), link }; if (E.KIND.rings.goal(p, E.KIND.rings.init(p))) continue;
    const sol = E.solve('rings', p, E.KIND.rings.init(p), 150000); if (!sol || sol.length < (o.min || 5)) continue; return p;
  }
  throw new Error('could not generate a rings stage ' + JSON.stringify(o));
}

/* ------------------------------ level assembly ------------------------------ */
const KINDS = ['beam', 'symbols', 'balance', 'water', 'search', 'bridge', 'trap', 'gear', 'push', 'runes', 'discs', 'slide', 'rings'];
const KIND_NAME = { beam: 'mirrors', symbols: 'a symbol code', balance: 'scales', water: 'water pipes', search: 'sealed jars', bridge: 'a moving bridge', trap: 'a trapped corridor', gear: 'gears', push: 'crates', runes: 'runes', discs: 'a tower of discs', slide: 'sliding blocks', rings: 'linked rings' };
const KIND_GOAL = {
  beam: 'Send the beam through every relay at the same time.', symbols: 'Set the panels to match the tablet.', balance: 'Rest every stone on a pan so the plaque shows a match.', water: 'Turn the channels and valves until water reaches the basin.',
  search: 'Read the clue, find the right jar, take the key to the door.', bridge: 'Plan the order of the lever, the plate and the rail.', trap: 'Press the switches in the safe order. A wrong one resets the room.', gear: 'Align both gears to their marks.',
  push: 'Push every crate onto a glowing plate.', runes: 'Light every rune.', discs: 'Move the whole tower to the marked peg.', slide: 'Slide the blocks to free the golden block.', rings: 'Line up every blue mark with the pointer.'
};
const HINTS = {
  beam: ['A mirror turns the beam by twice its own angle.', 'Follow the beam from the source: the first mirror that is wrong is the one to turn. Move any block that sits on the route.', 'Turn the highlighted mirror, or slide the block to a free socket.'],
  symbols: ['Every rule on the tablet is true at the same time.', 'Start with the rule that names a slot, then use the others to rule symbols out.', 'Tap the highlighted panel until it shows the symbol the rules point to.'],
  balance: ['Add up the weights. The plaque shows what must match.', 'Try pairing the heaviest stone against the lightest ones.', 'Place the highlighted stone on the pan that gets you closer.'],
  water: ['Water needs a continuous route from the spring to the basin.', 'Find the pieces that do not line up and turn them. Do not forget the valves.', 'Turn the highlighted piece, then open the valves.'],
  search: ['The wall carving tells you which jar. Every word counts.', 'Cross out the jars that break any rule in the clue. One is left.', 'Open the highlighted jar, then take the key to the door.'],
  bridge: ['Each mechanism only works in some situations. Read the messages.', 'Work backwards from the end: the bridge must lie flat, with both platforms raised.', 'Use the highlighted control next.'],
  trap: ['The stone remembers how often each switch was used.', 'Study each switch. Then follow the order the carving describes.', 'Press the highlighted switch.'],
  gear: ['The two gears turn each other in opposite directions.', 'Turn the big gear first, then see where the small one lands.', 'Turn the highlighted gear one tooth.'],
  push: ['You can only push, never pull. Plan which side of the crate you need to stand on.', 'Look for a crate that can reach its plate without getting stuck against a wall. Do that one last.', 'Walk the way the highlighted explorer should go next.'],
  runes: ['Every rune you touch also flips some of its neighbours.', 'Work from one corner: fix a rune by touching a rune that only reaches it.', 'Touch the highlighted rune.'],
  discs: ['A bigger disc can never sit on a smaller one.', 'To move the biggest disc, everything above it must already be out of the way.', 'Move the top disc of the highlighted peg.'],
  slide: ['Only the golden block has to get out. The others just need to get out of its way.', 'Find which block is sitting in the golden block row, and which block stops it from moving.', 'Slide the highlighted block.'],
  rings: ['Turning a ring also turns its linked neighbours.', 'Fix the ring you can fix without disturbing the others first. Then work on the rest.', 'Turn the highlighted ring.']
};
const CAMS = {
  beam: (p, v) => ({ az: 0, el: 48 + v * 8, d: 23, t: [0, 0, 0] }), symbols: p => ({ az: 0, el: 20, d: 15 + (p.slots - 3) * 2, t: [0, 2.4, 0] }), balance: p => ({ az: 0, el: 24, d: 18 + (p.stones.length > 5 ? 3 : 0), t: [0, 2.4, 0] }),
  water: (p, v) => ({ az: 0, el: 50 + v * 8, d: 8 + p.cols * 2.1, t: [0, 0, .6] }), search: p => ({ az: 0, el: 38, d: 17, t: [0, 1.5, -.8] }), bridge: () => ({ az: -8, el: 30, d: 24, t: [0, .5, 0] }),
  trap: p => ({ az: 0, el: 30, d: 14 + p.switches.length * 1.1, t: [0, 1.2, 0] }), gear: p => ({ az: 0, el: 50, d: 9 + Math.max(p.na, p.nb) * .85, t: [0, 0, 0] }),
  push: (p, v) => ({ az: 0, el: 54 + v * 6, d: 10 + Math.max(p.w, p.h) * 2.4, t: [0, 0, 0] }), runes: (p, v) => ({ az: 0, el: 56 + v * 6, d: 9 + p.w * 2.6, t: [0, 0, 0] }), discs: p => ({ az: 0, el: 26, d: 13 + p.pegs * 2.2, t: [0, 2.2, 0] }),
  slide: (p, v) => ({ az: 0, el: 56 + v * 5, d: 24, t: [0, 0, 0] }), rings: p => ({ az: 0, el: 62, d: 11 + p.start.length * 2.4, t: [0, 0, 0] })
};
const CLEAR = {
  beam: () => ({ x: 12, z: 9 }), symbols: p => ({ x: p.slots * 1.6 + 6, z: 7 }), balance: p => ({ x: p.stones.length + 8, z: 8 }), water: p => ({ x: p.cols * 1.25 + 3, z: p.rows * 1.25 + 3 }), search: p => ({ x: 8, z: 9 }), bridge: () => ({ x: 19, z: 9 }),
  trap: p => ({ x: p.switches.length * 1.7 + 5, z: 8 }), gear: p => ({ x: (p.na + p.nb) * .2 + 6, z: p.na * .2 + 5 }), push: p => ({ x: p.w * 1.05 + 3, z: p.h * 1.05 + 3 }), runes: p => ({ x: p.w * 1.2 + 4, z: p.h * 1.2 + 4 }), discs: p => ({ x: p.start.length * 2.3 + 4, z: 6 }),
  slide: () => ({ x: 11, z: 9 }), rings: p => ({ x: 2.3 + p.start.length * 1.15 + 3, z: 2.3 + p.start.length * 1.15 + 3 })
};
const TITLE_POOL = {
  beam: ['Tide Mirrors', 'Starlight Mirrors', 'Ember Mirrors', 'Nebula Mirrors', 'Crossing Currents', 'Grand Network', 'Photon Paths', 'Glass Corridor', 'Lantern Lines', 'Prism Hall', 'Aurora Relay', 'Lightwell'],
  symbols: ['Coral Code', 'Constellations', "Smelter's Code", 'Starfield Glyphs', 'Sun Cipher', 'Tablet of Tides', 'Cinder Glyphs', 'Moon Script'],
  balance: ['Pearl Scales', 'Counterweights', 'Molten Scales', 'Gravity Scales', 'Weighing Hall', 'Ballast Court'],
  water: ['Flooded Gallery', 'The Great Aqueduct', 'Forge Aqueduct', 'Kelp Channels', 'Spring Maze', 'Cascade Run'],
  search: ['The Sealed Urns', 'Archive of Jars', 'Cosmic Archive', 'Drowned Archive', 'Vessel Vault', 'Hidden Cellar'],
  bridge: ['The Drawbridge', 'Skybridge', 'Obsidian Bridge', 'Event Horizon', 'Chasm Crossing'],
  trap: ['Whispering Switches', 'Eclipse Trap', 'Furnace Switches', 'Silent Floor', 'Thorn Hall'],
  gear: ['Clockwork Tide', 'Orrery Gears', 'Quasar Gears', 'Cog Cellar', 'Gearworks'],
  push: ['Crate Harbour', 'Cloud Crates', 'Anvil Yard', 'Void Crates', 'Stone Yard', 'Porter Court', 'Crate Canyon'],
  runes: ['Rune Reef', 'Moonlit Runes', 'Cinder Runes', 'Starfield Runes', 'Glow Floor', 'Rune Garden'],
  discs: ['Tower of Shells', 'Comet Tower', 'Tower of Anvils', 'Black Hole Tower', 'Disc Spire', 'Stack of Ages'],
  slide: ['Sliding Reliquary', 'Sliding Stars', 'Slag Puzzle', 'Singularity Slide', 'Locked Stones', 'Groove Gate'],
  rings: ['Wheel of Tides', 'Zenith Rings', 'Crucible Rings', 'Orbit Rings', 'Dial of Ages', 'Halo Lock']
};
const ADJ = { SUNKEN_SANCTUM: ['Tide', 'Coral', 'Drowned', 'Pearl', 'Kelp', 'Salt', 'Shell', 'Abyss'], SKY_OBSERVATORY: ['Star', 'Cloud', 'Comet', 'Zenith', 'Lunar', 'Orbit', 'Solar', 'Skyward'], CRYSTAL_FORGE: ['Ember', 'Cinder', 'Molten', 'Slag', 'Anvil', 'Furnace', 'Obsidian', 'Crystal'], COSMIC_CORE: ['Void', 'Nebula', 'Quasar', 'Photon', 'Gravity', 'Cosmic', 'Pulsar', 'Eclipse'] };
const NOUN = ['Engine', 'Works', 'Gate', 'Vault', 'Machine', 'Stair', 'Hall', 'Gallery', 'Lattice', 'Clockwork', 'Mechanism', 'Sanctum', 'Labyrinth', 'Foundry', 'Passage', 'Chamber'];
const usedTitles = new Set(); let multiI = 0;
function titleFor(kinds, n, last) {
  if (n === 25) return 'Heart of the Sanctum'; if (n === 40) return 'Crown of Stars'; if (n === 53) return 'Heart of the Forge'; if (n === 65) return 'The Core of Everything';
  if (kinds.length > 1) { const adj = ADJ[worldOf(n).id]; for (let k = 0; k < adj.length * NOUN.length; k++) { const i = (n * 5 + k * 7) % (adj.length * NOUN.length), t = adj[i % adj.length] + ' ' + NOUN[Math.floor(i / adj.length) % NOUN.length]; if (!usedTitles.has(t)) { usedTitles.add(t); return t; } } return 'Engine ' + n; }
  const pool = TITLE_POOL[kinds[0]]; for (const t of pool) if (!usedTitles.has(t)) { usedTitles.add(t); return t; } return 'Room ' + n;
}
const WORLDS = [
  { id: 'SUNKEN_SANCTUM', tune: 'ocean', from: 11, to: 25, story: 'Under the old temple lies a drowned sanctuary. Its machines are bigger and its clues are trickier.' },
  { id: 'SKY_OBSERVATORY', tune: 'dusk', from: 26, to: 40, story: 'High above the clouds an observatory keeps the second Core. Only sharp minds reach it.' },
  { id: 'CRYSTAL_FORGE', tune: 'forge', from: 41, to: 53, story: 'Deep in the mountain a forge of living crystal still burns. Heat makes every mistake louder.' },
  { id: 'COSMIC_CORE', tune: 'cosmic', from: 54, to: 65, story: 'Beyond the sky the last Core hangs in the void. Everything you have learned is needed.' }
];
const worldOf = n => WORLDS.find(w => n >= w.from && n <= w.to);
const stageCount = n => n <= 15 ? 1 : n <= 19 ? (n % 2 ? 1 : 2) : n === 20 ? 2 : n <= 24 ? 2 : n === 25 ? 3 : n <= 32 ? 2 : n <= 36 ? 3 : n <= 39 ? 3 : n === 40 ? 4 : n <= 46 ? 3 : n <= 50 ? 4 : n <= 52 ? 4 : n === 53 ? 5 : n <= 58 ? 4 : n <= 62 ? 5 : n <= 64 ? 5 : 6;
const DEBUT = { 12: 'push', 14: 'runes', 16: 'discs', 18: 'slide', 19: 'rings' };       // each new mechanic is met first in an easier room
const targetH = n => 13 + 1.25 * (n - 11);                                                // the difficulty the room must reach (bits of search), rising every level

function makeStage(kind, d, seed) {
  const R = Math.round, C = (a, lo, hi) => Math.max(lo, Math.min(hi, a));
  const tries = [d, d * .7];
  for (const dd of tries) {
    try {
      switch (kind) {
        case 'beam': return genBeam({ seed, n: 2 + R(2 * dd), relays: 2 + R(1.2 * dd), blockers: R(1.6 * dd), fixed: R(3 * dd), min: 5 + R(5 * dd) });
        case 'symbols': { const slots = 3 + R(2 * dd); return genSymbols({ seed, symbols: ['spiral', 'triangle', 'wave', 'moon', 'star', 'eye', 'sun'].slice(0, C(slots + 1 + R(dd), 4, 7)), slots, minFacts: 2 + slots - 1, maxFacts: 9 }); }
        case 'balance': { const nn = 5 + R(2 * dd); return genBalance({ seed, n: nn, cap: nn > 6 ? 4 : 3, target: R(dd * 4), maxSol: nn > 6 ? 5 : 3, maxW: 9 + R(3 * dd) }); }
        case 'water': return genWater({ seed, cols: 5 + R(2 * dd), rows: 3 + R(2 * dd), valves: 1 + R(2 * dd), rot: 4 + R(2 * dd), minLen: 6 + R(5 * dd), maxLen: 11 + R(6 * dd), min: 7 + R(8 * dd) });
        case 'search': return genSearch({ seed, jars: 4 + R(4 * dd), colors: dd > .35 ? ['red', 'blue', 'green'] : ['red', 'blue'], minFacts: 2 + R(2 * dd) });
        case 'bridge': return genBridge({ variant: seed % 3 });
        case 'trap': return genTrap({ seed, n: 3 + R(3 * dd), dir: seed % 2 ? 'asc' : 'desc' });
        case 'gear': { const big = 12 + R(4 * dd); return genGear({ seed, na: big, nb: big - 2 - R(3 * dd), min: 4 + R(4 * dd) }); }
        case 'push': return genPush({ seed, w: 5 + R(2 * dd), h: 5 + R(1.5 * dd), crates: 1 + R(3 * dd), scramble: 60 + R(60 * dd), min: 6 + R(14 * dd), wallDensity: .1 + dd * .08, limit: 30000 });
        case 'runes': return genRunes({ seed, w: dd < .25 ? 3 : dd < .6 ? 4 : 4, h: dd < .25 ? 3 : 4, pat: pick(rngOf(seed), ['plus', 'plus', 'diag', 'line', 'ring', 'col', 'knight']), presses: 4 + R(6 * dd), min: 3 + R(5 * dd) });
        case 'discs': return genDiscs({ seed, n: 3 + R(3 * dd), pegs: dd > .55 ? 4 : 3, adjacent: dd > .8, scramble: R(30 * dd), min: 5 + R(10 * dd) });
        case 'slide': return genSlide({ seed, blocks: 6 + R(4 * dd), scramble: 20 + R(40 * dd), min: 4 + R(8 * dd) });
        case 'rings': return genRings({ seed, k: 3 + R(2 * dd), n: dd > .6 ? 10 : 8, scramble: 8 + R(10 * dd), min: 5 + R(6 * dd) });
      }
    } catch (e) { /* try an easier setting */ }
  }
  throw new Error('no ' + kind + ' stage at any difficulty');
}
function ringStations(stages) {
  const n = stages.length, R = 36;
  stages.forEach((st, i) => { const a = (180 + i * 360 / n) * D2R; st.view = { x: +(R * Math.sin(a)).toFixed(2), z: +(R * Math.cos(a)).toFixed(2), rot: +((a % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)).toFixed(4), cam: CAMS[st.kind](st.p, .3) }; if (st.kind === 'beam') st.view.cam.d = 25; if (st.kind === 'water') st.view.cam.d += 2; if (st.kind === 'push' || st.kind === 'slide') st.view.cam.d += 4; });
}
/* a look for every level: layout + floor + sky + accent, never repeated */
const LAYOUTS = ['colonnade', 'courtyard', 'cavern', 'garden', 'tower', 'skydeck', 'forge', 'reef', 'frostcave', 'ruins', 'observatory'];
const LOOKOK = {
  colonnade: { sky: ['day', 'dawn', 'dusk', 'storm', 'night'], floor: ['flag', 'marble', 'slate', 'sand', 'jade'] }, courtyard: { sky: ['day', 'dawn', 'dusk', 'night', 'storm'], floor: ['marble', 'flag', 'sand', 'slate', 'jade'] },
  cavern: { sky: ['night', 'aurora', 'void', 'ember', 'ocean'], floor: ['obsidian', 'slate', 'ice', 'ember', 'jade'] }, garden: { sky: ['day', 'dawn', 'dusk', 'storm'], floor: ['moss', 'sand', 'flag', 'jade'] },
  tower: { sky: ['night', 'dusk', 'storm', 'void', 'dawn'], floor: ['slate', 'marble', 'obsidian', 'flag', 'jade'] }, skydeck: { sky: ['day', 'dawn', 'dusk', 'aurora', 'night', 'void'], floor: ['marble', 'slate', 'jade', 'ice', 'flag'] },
  forge: { sky: ['ember'], floor: ['ember', 'obsidian', 'slate'] }, reef: { sky: ['ocean'], floor: ['sand', 'jade', 'slate', 'moss'] }, frostcave: { sky: ['frost', 'aurora', 'night'], floor: ['ice', 'marble', 'slate'] },
  ruins: { sky: ['day', 'storm', 'dawn', 'dusk', 'night'], floor: ['moss', 'flag', 'sand', 'jade'] }, observatory: { sky: ['night', 'aurora', 'void', 'dusk'], floor: ['slate', 'marble', 'obsidian', 'flag'] }
};
const WORLD_LAYOUTS = { SUNKEN_SANCTUM: ['reef', 'cavern', 'courtyard', 'colonnade', 'garden', 'ruins', 'tower'], SKY_OBSERVATORY: ['skydeck', 'observatory', 'tower', 'courtyard', 'colonnade', 'garden', 'ruins'], CRYSTAL_FORGE: ['forge', 'cavern', 'frostcave', 'tower', 'ruins', 'colonnade', 'observatory'], COSMIC_CORE: ['observatory', 'skydeck', 'cavern', 'frostcave', 'tower', 'courtyard', 'forge'] };
const usedLooks = new Set();
function lookFor(n, clear, multi) {
  const w = worldOf(n), lays = WORLD_LAYOUTS[w.id], rn = rngOf(n * 911 + 7);
  for (let tries = 0; tries < 200; tries++) {
    const layout = lays[(n * 3 + tries) % lays.length], ok = LOOKOK[layout], sky = ok.sky[(n + tries * 2) % ok.sky.length], floor = ok.floor[(n * 2 + tries) % ok.floor.length], key = layout + '/' + floor + '/' + sky;
    if (usedLooks.has(key) && tries < 150) continue; usedLooks.add(key);
    return { layout, floor, sky, accent: [0x37d8ff, 0xffb040, 0xff5a7a, 0x7be3a0, 0xc08aff, 0xffe066, 0x5aa0ff, 0xff8a50][(n * 5 + Math.floor(n / 8)) % 8], seed: n * 13 + 5, clear: multi ? { x: 46, z: 46 } : clear, multi: !!multi, floorKey: key };
  }
}

const WORLD_H = { SUNKEN_SANCTUM: [10, 32], SKY_OBSERVATORY: [20, 48], CRYSTAL_FORGE: [30, 62], COSMIC_CORE: [44, 76] };   // hardness (bits of search) at the first and last room of each world
let prevH = 0, deck = [], lastFirst = '';
const LOWH = ['trap', 'bridge', 'search', 'gear'];
const DEBUT_AT = Object.fromEntries(Object.entries(DEBUT).map(([n, k]) => [k, +n]));
function drawKinds(n, count, rn) {
  const out = [], avail = KINDS.filter(k => !DEBUT_AT[k] || n >= DEBUT_AT[k]), lowMax = n >= 41 ? 1 : n >= 26 ? 2 : 3;
  if (DEBUT[n]) out.push(DEBUT[n]); deck = deck.filter(k => avail.includes(k));
  const okKind = k => !out.includes(k) && !(out.length === 0 && k === lastFirst) && !(LOWH.includes(k) && out.filter(x => LOWH.includes(x)).length >= lowMax);
  for (let guard = 0; out.length < count && guard < 500; guard++) {
    if (!deck.length) deck = shuffle(rn, avail.slice());
    const k = deck.shift(); if (okKind(k)) out.push(k); else if (!deck.some(okKind)) deck = shuffle(rn, avail.slice());
  }
  while (out.length < count) { const k = avail.find(x => !out.includes(x)); if (!k) break; out.push(k); }
  lastFirst = out[0]; return out;
}
function makeLevel(n, extra, variant) {
  variant = variant || 0;
  const w = worldOf(n), rn = rngOf(n * 137 + 3), [h0, h1] = WORLD_H[w.id], i = n - w.from, len = w.to - w.from, Htar = h0 + (h1 - h0) * (i / len);
  if (n === w.from) prevH = 0;
  const lo = Math.max(Htar - 1.5, prevH + .3), hi = Htar + 7, count = Math.max(1, Math.min(6, Math.round(Htar / 11.5) + (extra || 0)) - (n > 53 && n < 65 ? 1 : 0));
  let best = null; const t0 = Date.now();
  for (let attempt = 0; attempt < 36; attempt++) {
    const cnt = Math.max(1, Math.min(6, count + (attempt >= 18 ? 1 : 0) - (attempt % 9 === 8 ? 1 : 0))), kinds = drawKinds(n, cnt, rn);
    DEADLINE = Date.now() + 5000;
    if (process.env.GEN_DEBUG) console.error('  level', n, 'attempt', attempt, kinds.join('+'), (Date.now() - t0) + 'ms');
    const base = Math.min(1, Math.max(.08, .1 + .9 * ((n - 11) / 54) + (attempt % 6) * .06 - (cnt > 1 ? .06 : 0) + (rn() - .5) * .06)), stages = [];
    try { kinds.forEach((k, j) => stages.push({ kind: k, p: makeStage(k, DEBUT[n] === k && j === 0 ? Math.min(base, .25) : base, n * 1000 + j * 77 + attempt * 13 + 5 + variant * 10007) })); } catch (e) { continue; }
    const st = stages.map((s, j) => ({ id: cnt > 1 ? 'stage_' + (j + 1) : s.kind, kind: s.kind, goal: KIND_GOAL[s.kind], p: s.p }));
    const multi = st.length > 1, clear = multi ? null : CLEAR[st[0].kind](st[0].p), look = lookFor(n, clear, multi); usedLooks.delete(look.floorKey);
    const def = { n, levelId: w.id.split('_').map(x => x[0]).join('') + '_L' + n, worldId: w.id, theme: w.tune, title: 'Room ' + n, difficulty: 'LEVEL_' + n, mechanic: multi ? 'MULTI_STAGE_COMBINATION' : st[0].kind.toUpperCase(), objective: multi ? 'Wake every mechanism in turn and restore the core.' : KIND_GOAL[st[0].kind],
      intro: (w.story.split('. ')[0] + '. ') + (multi ? 'This room joins ' + kinds.map(k => KIND_NAME[k]).join(', ').replace(/, ([^,]*)$/, ' and $1') + '.' : 'Here you face ' + KIND_NAME[kinds[0]] + '.'), goalConditions: multi ? ['allStagesComplete', 'mechanismsAwake'] : ['goalReached'],
      hints: multi ? ['Each mechanism wakes the next one. Work through them in order.', 'The current station is glowing. Solve it before looking at the others.', HINTS[kinds[0]][2]] : HINTS[kinds[0]].slice(), par: 9999, validation: { solutionRequired: true, generated: true },
      env: 'look', look, cam: multi ? { az: 0, el: 30, d: 30, t: [0, 3, -12] } : CAMS[st[0].kind](st[0].p, (n % 5) / 5), relic: multi ? { x: 5.5, y: 1.2, z: 6.5, name: 'Core Shard' } : { x: -(clear.x - 2.2), y: 1.1, z: clear.z - 2.2, name: 'Shard' }, stages: st };
    if (multi) ringStations(st);
    const v = E.verifyLevel(def); if (!v.ok) continue;
    const dist = v.hardness < lo ? lo - v.hardness : v.hardness > hi ? v.hardness - hi : 0;
    if (!best || dist < best.dist || (dist === best.dist && Math.abs(v.hardness - Htar) < Math.abs(best.v.hardness - Htar))) best = { def, v, dist, look };
    if (dist === 0) break; if (Date.now() - t0 > 14000 && best) break;
  }
  if (!best) throw new Error('level ' + n + ' could not be generated');
  const { def, v } = best; def.par = Math.ceil(v.optimal * 1.35) + 1; def.optimal = v.optimal; def.hardness = v.hardness; usedLooks.add(def.look.floorKey); prevH = Math.max(prevH + .3, v.hardness); def.title = titleFor(def.stages.map(s => s.kind), n); return def;
}

const levels = []; const t0 = Date.now();
for (let n = 11; n <= 65; n++) {
  const s0 = Date.now(); let L = makeLevel(n); for (let variant = 1; variant <= 5 && n > worldOf(n).from && L.hardness < levels[levels.length - 1].hardness + .3; variant++) { usedTitles.delete(L.title); usedLooks.delete(L.look.floorKey); L = makeLevel(n, 0, variant); } levels.push(L);
  console.log(String(n).padStart(2), L.title.padEnd(24), L.stages.map(s => s.kind).join('+').padEnd(46), 'moves', String(L.optimal).padStart(3), 'par', String(L.par).padStart(3), 'hardness', String(L.hardness).padStart(5), (L.look.layout + '/' + L.look.floor + '/' + L.look.sky).padEnd(30), (Date.now() - s0) + 'ms');
}
levels.forEach(l => { delete l.look.floorKey; });
const out = '/* MindVerse levels 11-65 (worlds 2 to 5). GENERATED by tests/tools/gen-mindverse-levels.js, do not edit by hand.\n * Each level was built from a known-solvable arrangement and proven solvable by the rules engine. Difficulty (hardness) rises on every level. */\n' +
  "(function (root, factory) {\n  if (typeof module === 'object' && module.exports) module.exports = factory();\n  else root.MindverseLevelsExtra = factory();\n})(typeof self !== 'undefined' ? self : this, function () {\n  'use strict';\n  return " + JSON.stringify(levels) + ';\n});\n';
fs.writeFileSync(path.join(__dirname, '..', '..', 'games', 'mindverse-levels-extra.js'), out);
console.log('\nwrote games/mindverse-levels-extra.js (' + levels.length + ' levels, ' + Math.round(out.length / 1024) + ' KB) in ' + Math.round((Date.now() - t0) / 1000) + 's');
