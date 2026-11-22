/* PARALLAX puzzle engine: pure, deterministic rules for every puzzle family. No rendering in here, so the very same code
   runs in the game, in the hint system and in the automated tests that prove each of the 100 levels can be solved.
   A puzzle state is plain JSON. Each family supplies moves / apply / solved / key / solve. */

export const clone = o => JSON.parse(JSON.stringify(o));
export const DR = [-1, 0, 1, 0, 0], DC = [0, 1, 0, -1, 0];   // N E S W (4 = wait)
export function rng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* Breadth-first search over any state graph. Returns the shortest list of moves or null. */
export function bfs(start, movesFn, applyFn, keyFn, goalFn, cap = 300000) {
  if (goalFn(start)) return [];
  const seen = new Map([[keyFn(start), null]]); const q = [start]; const par = [];
  const info = new Map([[keyFn(start), { p: null, m: null }]]);
  for (let h = 0; h < q.length && q.length < cap; h++) {
    const s = q[h], ks = keyFn(s);
    for (const m of movesFn(s)) {
      const n = applyFn(s, m); const kn = keyFn(n);
      if (info.has(kn)) continue;
      info.set(kn, { p: ks, m });
      if (goalFn(n)) { const out = []; let k = kn; while (info.get(k).p !== null) { out.push(info.get(k).m); k = info.get(k).p; } return out.reverse(); }
      q.push(n);
    }
  }
  return null;
}

/* ───────────────────────── SEQ: pillars that must be woken in the right order ───────────────────────── */
export const RULES = { height_up: 'shortest to tallest', height_down: 'tallest to shortest', hue: 'in rainbow order (red to violet)', rings_up: 'fewest rings to most rings', memory: 'the sequence the bell plays' };
const SEQ = {
  moves: s => s.attrs.map((_, i) => ({ k: 'tap', i })).filter(m => !s.prog.includes(m.i)),
  apply(s, m) {
    if (s.prog.includes(m.i)) return s;
    const n = clone(s);
    if (s.target[s.prog.length] === m.i) n.prog.push(m.i); else { n.prog = []; n.fails = (n.fails || 0) + 1; }
    return n;
  },
  solved: s => s.prog.length === s.target.length,
  key: s => s.prog.join(','),
  solve: s => s.target.slice(s.prog.length).map(i => ({ k: 'tap', i }))
};
export function seqTarget(attrs, rule) {
  const idx = attrs.map((_, i) => i), by = f => idx.slice().sort((a, b) => f(a) - f(b));
  if (rule === 'height_up') return by(i => attrs[i].h);
  if (rule === 'height_down') return by(i => -attrs[i].h);
  if (rule === 'hue') return by(i => attrs[i].hue);
  return by(i => attrs[i].rings);
}

/* ───────────────────────── PIPES: rotate tiles so a route connects the source to the exit ───────────────────────── */
const OPEN = { S: [0, 2], C: [0, 1], T: [0, 1, 2], X: [0, 1, 2, 3] };
export const tileOpen = (ty, rot) => OPEN[ty].map(d => (d + rot) % 4);
function pipeNeighbour(s, r, c, d) {
  let nr = r + DR[d], nc = c + DC[d];
  if (s.wrap) nr = (nr + s.R) % s.R;
  if (nr < 0 || nr >= s.R || nc < 0 || nc >= s.C) return null;
  return [nr, nc];
}
export function pipeFlow(s) {                    // set of "r,c" cells that carry the flow, and whether the exit is reached
  const lit = new Set(), seen = new Set(); let reached = false; const st = [[s.src, 0, 3]];
  while (st.length) {
    const [r, c, side] = st.pop(), t = s.tiles[r][c], op = tileOpen(t.ty, t.rot), key = r * 100 + c + side * 10000;
    if (seen.has(key) || !op.includes(side)) continue; seen.add(key); lit.add(r + ',' + c);
    for (const d of op) {
      if (d === side) continue;
      if (r === s.dst && c === s.C - 1 && d === 1) { reached = true; continue; }
      const nb = pipeNeighbour(s, r, c, d); if (nb) st.push([nb[0], nb[1], (d + 2) % 4]);
    }
  }
  return { lit, reached };
}
const PIPES = {
  moves: s => { const out = []; s.tiles.forEach((row, r) => row.forEach((t, c) => { if (!t.lock) out.push({ k: 'rot', r, c }); })); return out; },
  apply(s, m) { const t = s.tiles[m.r][m.c]; if (t.lock) return s; const n = clone(s); n.tiles[m.r][m.c].rot = (t.rot + 1) % 4; return n; },
  solved: s => pipeFlow(s).reached,
  key: s => s.tiles.map(r => r.map(t => t.rot).join('')).join('|'),
  solve(s) {                                      // cheapest route (fewest rotations) through the tiles, by Dijkstra
    const cost = new Map(), prev = new Map(), pq = [[0, s.src, 0, 3]]; let best = null;
    const need = (t, a, b) => { let k = null; for (let q = 0; q < 4; q++) { if (t.lock && q) break; const op = tileOpen(t.ty, (t.rot + q) % 4); if (op.includes(a) && op.includes(b)) { k = q; break; } } return k; };
    cost.set(s.src * 10 + 3, 0);
    while (pq.length) {
      pq.sort((x, y) => x[0] - y[0]); const [d0, r, c, side] = pq.shift(); const k0 = r * 1000 + c * 10 + side;
      if (d0 > (cost.get(k0) ?? 1e9)) continue;
      const t = s.tiles[r][c];
      for (let x = 0; x < 4; x++) {
        if (x === side) continue; const k = need(t, side, x); if (k === null) continue; const nd = d0 + k;
        if (r === s.dst && c === s.C - 1 && x === 1) { if (!best || nd < best.d) best = { d: nd, from: k0, r, c, k }; continue; }
        const nb = pipeNeighbour(s, r, c, x); if (!nb) continue; const k1 = nb[0] * 1000 + nb[1] * 10 + (x + 2) % 4;
        if (nd < (cost.get(k1) ?? 1e9)) { cost.set(k1, nd); prev.set(k1, { from: k0, r, c, k }); pq.push([nd, nb[0], nb[1], (x + 2) % 4]); }
      }
    }
    if (!best) return null;
    const moves = []; const add = (r, c, k) => { for (let i = 0; i < k; i++) moves.push({ k: 'rot', r, c }); };
    add(best.r, best.c, best.k); let k = best.from; while (prev.has(k)) { const p = prev.get(k); add(p.r, p.c, p.k); k = p.from; }
    const out = moves.reverse(); let t = s; for (const m of out) t = PIPES.apply(t, m);
    return PIPES.solved(t) ? out : null;
  }
};

/* ───────────────────────── COUPLED: lights, tuning dials, magnets (tapping one thing moves its neighbours) ───────────────────────── */
function solveMod(eff, delta, m) {                // Gaussian elimination mod a prime m; picks the solution with the fewest taps
  const n = eff.length, inv = a => { let r = 1, e = m - 2, b = a % m; while (e > 0) { if (e & 1) r = (r * b) % m; b = (b * b) % m; e >>= 1; } return r; };
  const A = []; for (let j = 0; j < n; j++) { const row = []; for (let i = 0; i < n; i++) row.push(((eff[i][j] % m) + m) % m); row.push(((delta[j] % m) + m) % m); A.push(row); }
  const pivCol = []; let row = 0;
  for (let c = 0; c < n && row < n; c++) {
    let p = -1; for (let r = row; r < n; r++) if (A[r][c]) { p = r; break; } if (p < 0) continue;
    [A[row], A[p]] = [A[p], A[row]]; const iv = inv(A[row][c]); for (let k = 0; k <= n; k++) A[row][k] = (A[row][k] * iv) % m;
    for (let r = 0; r < n; r++) if (r !== row && A[r][c]) { const f = A[r][c]; for (let k = 0; k <= n; k++) A[r][k] = ((A[r][k] - f * A[row][k]) % m + m) % m; }
    pivCol.push(c); row++;
  }
  for (let r = row; r < n; r++) if (A[r][n]) return null;
  const free = []; for (let c = 0; c < n; c++) if (!pivCol.includes(c)) free.push(c);
  let best = null, tot = Math.pow(m, free.length); if (tot > 70000) return null;
  for (let code = 0; code < tot; code++) {
    const x = new Array(n).fill(0); let cc = code; free.forEach(f => { x[f] = cc % m; cc = Math.floor(cc / m); });
    pivCol.forEach((pc, r) => { let v = A[r][n]; free.forEach(f => { v -= A[r][f] * x[f]; }); x[pc] = ((v % m) + m) % m; });
    const w = x.reduce((a, b) => a + b, 0); if (!best || w < best.w) best = { w, x };
  }
  return best.x;
}
const COUPLED = {
  moves: s => s.vals.map((_, i) => ({ k: 'tap', i })),
  apply(s, m) { const n = clone(s); for (let j = 0; j < s.n; j++) n.vals[j] = (n.vals[j] + s.eff[m.i][j] + s.m * 8) % s.m; return n; },
  solved: s => s.vals.every((v, i) => v === s.target[i]),
  key: s => s.vals.join(''),
  solve(s) {
    let moves;
    if (Math.pow(s.m, s.n) <= 70000) return bfs(s, COUPLED.moves, COUPLED.apply, COUPLED.key, COUPLED.solved);
    const x = solveMod(s.eff, s.vals.map((v, i) => s.target[i] - v), s.m); if (!x) return null;
    moves = []; x.forEach((cnt, i) => { for (let q = 0; q < cnt; q++) moves.push({ k: 'tap', i }); }); return moves;
  }
};

/* ───────────────────────── TILT: change the direction of gravity so every orb slides into its socket ───────────────────────── */
const tiltCell = (s, r, c) => (r < 0 || c < 0 || r >= s.R || c >= s.C) ? '#' : s.g[r][c];
const TILT = {
  moves: () => [0, 1, 2, 3].map(d => ({ k: 'tilt', d })),
  apply(s, m) {
    const n = clone(s), d = m.d, order = n.balls.map((_, i) => i).filter(i => !n.dock[i]);
    order.sort((a, b) => ((n.balls[b][0] * DR[d] + n.balls[b][1] * DC[d]) - (n.balls[a][0] * DR[d] + n.balls[a][1] * DC[d])));
    for (const i of order) {
      let [r, c] = n.balls[i];
      for (;;) {
        const nr = r + DR[d], nc = c + DC[d];
        if (tiltCell(n, nr, nc) === '#' || n.balls.some((b, j) => j !== i && b[0] === nr && b[1] === nc)) break;
        r = nr; c = nc;
        if (n.goals[i][0] === r && n.goals[i][1] === c) { n.dock[i] = 1; break; }
        if (tiltCell(n, r, c) === 's') break;
      }
      n.balls[i] = [r, c];
    }
    return n;
  },
  solved: s => s.dock.every(Boolean),
  key: s => s.balls.map(b => b.join(',')).join(';') + '|' + s.dock.join(''),
  solve: s => bfs(s, TILT.moves, TILT.apply, TILT.key, TILT.solved)
};

/* ───────────────────────── BEAM: turn mirrors so the light reaches every crystal ───────────────────────── */
const MIR = [{ 0: 1, 1: 0, 2: 3, 3: 2 }, { 0: 3, 3: 0, 1: 2, 2: 1 }];   // '/' and '\' : incoming direction -> outgoing direction
export function beamTrace(s) {
  const lit = new Set(), segs = [], seen = new Set(), mirAt = new Map(s.mirrors.map((m, i) => [m.r * 100 + m.c, i]));
  const st = [[s.emit, -1, 1]];
  while (st.length) {
    let [r, c, d] = st.pop();
    for (;;) {
      const nr = r + DR[d], nc = c + DC[d]; segs.push([r, c, nr, nc]);
      if (nc < 0 || nr < 0 || nr >= s.R || nc >= s.C) break;
      if (s.g[nr][nc] === '#') break;
      const key = nr * 1000 + nc * 10 + d; if (seen.has(key)) break; seen.add(key);
      r = nr; c = nc; lit.add(r + ',' + c);
      const mi = mirAt.get(r * 100 + c);
      if (mi !== undefined) {
        const m = s.mirrors[mi];
        if (m.splitter) { st.push([r, c, MIR[m.o][d]]); }
        else d = MIR[m.o][d];
      }
    }
  }
  return { lit, segs };
}
const BEAM = {
  moves: s => s.mirrors.map((m, i) => ({ k: 'flip', i })).filter(m => !s.mirrors[m.i].fixed),
  apply(s, m) { if (s.mirrors[m.i].fixed) return s; const n = clone(s); n.mirrors[m.i].o ^= 1; return n; },
  solved: s => { const { lit } = beamTrace(s); return s.targets.every(t => lit.has(t[0] + ',' + t[1])); },
  key: s => s.mirrors.map(m => m.o).join(''),
  solve: s => bfs(s, BEAM.moves, BEAM.apply, BEAM.key, BEAM.solved)
};

/* ───────────────────────── TANKS: fill, pour and drain glass tanks to exact pressures ───────────────────────── */
const TANKS = {
  moves(s) { const out = []; s.caps.forEach((_, i) => { out.push({ k: 'fill', i }, { k: 'drain', i }); s.caps.forEach((_, j) => { if (i !== j) out.push({ k: 'pour', i, j }); }); }); return out; },
  apply(s, m) {
    const n = clone(s), v = n.vol, cp = n.caps;
    if (m.k === 'fill') v[m.i] = cp[m.i]; else if (m.k === 'drain') v[m.i] = 0;
    else { const q = Math.min(v[m.i], cp[m.j] - v[m.j]); v[m.i] -= q; v[m.j] += q; }
    return n;
  },
  solved: s => s.goal.every((g, i) => g === null || s.vol[i] === g),
  key: s => s.vol.join(','),
  solve: s => bfs(s, TANKS.moves, TANKS.apply, TANKS.key, TANKS.solved)
};

/* ───────────────────────── ECHO: record a run, then cooperate with your own past self ───────────────────────── */
const echoWall = (s, r, c) => r < 0 || c < 0 || r >= s.R || c >= s.C || s.g[r][c] === '#';
const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
function plateHeld(s, id, agent, echo) { return s.plates.some(p => p.id === id && (same([p.r, p.c], agent) || same([p.r, p.c], echo))); }
function echoStepOk(s, pos, echo, d) {            // can the agent move in direction d (4 = wait) to a new cell, given echo's cell at the new tick?
  const nr = pos[0] + DR[d], nc = pos[1] + DC[d];
  if (echoWall(s, nr, nc)) return null;
  const door = s.doors.find(x => x.r === nr && x.c === nc);
  if (door && !plateHeld(s, door.id, [nr, nc], echo)) return null;
  return [nr, nc];
}
const echoAt = (s, tick) => s.echo ? s.echo[Math.min(tick, s.echo.length - 1)] : null;
const ECHO = {
  moves(s) {
    if (s.phase === 'play' && same(s.pos, s.exit)) return [];
    const out = [];
    if (s.phase === 'rec' && s.rec.length >= s.T) { out.push({ k: 'release' }); return out; }
    if (s.phase === 'play' && s.play.length >= s.maxPlay) return [];
    for (let d = 0; d < 5; d++) { const e = s.phase === 'play' ? echoAt(s, s.tick + 1) : null; if (echoStepOk(s, s.pos, e, d)) out.push({ k: 'step', d }); }
    if (s.phase === 'rec' && s.rec.length > 0) out.push({ k: 'release' });
    return out;
  },
  apply(s, m) {
    const n = clone(s);
    if (m.k === 'release') {
      if (s.phase !== 'rec' || !s.rec.length) return s;
      const path = [s.start.slice()]; let p = s.start.slice(); for (const d of s.rec) { p = [p[0] + DR[d], p[1] + DC[d]]; path.push(p); }
      n.echo = path; n.phase = 'play'; n.pos = s.start.slice(); n.tick = 0; n.play = []; return n;
    }
    const e = s.phase === 'play' ? echoAt(s, s.tick + 1) : null, np = echoStepOk(s, s.pos, e, m.d);
    if (!np) return s;
    n.pos = np; n.tick = s.tick + 1; (s.phase === 'rec' ? n.rec : n.play).push(m.d); return n;
  },
  solved: s => s.phase === 'play' && same(s.pos, s.exit),
  key: s => s.phase + ':' + s.pos + ':' + s.tick + ':' + (s.phase === 'rec' ? s.rec.join('') : ''),
  solve(s) {
    const playSolve = (st) => bfs(st, ECHO.moves, ECHO.apply, x => x.pos + ':' + Math.min(x.tick, x.echo.length), ECHO.solved, 80000);
    if (s.phase === 'play') return playSolve(s);
    if (s.rec.length === 0 || true) {
      // candidate echo routes: visit plates in some order (shortest paths between them), with optional pauses
      const base = clone(s); base.phase = 'rec'; base.pos = s.start.slice(); base.tick = 0; base.rec = []; base.echo = null; base.play = [];
      const plates = s.plates.map(p => [p.r, p.c]), orders = [];
      const perm = (arr, cur) => { if (cur.length) orders.push(cur.slice()); arr.forEach((x, i) => { perm(arr.filter((_, j) => j !== i), cur.concat([x])); }); }; perm(plates, []);
      const sp = (a, b) => {                       // shortest path in the record phase (door cells are walls)
        const q = [a], par = new Map([[a.join(), null]]);
        for (let h = 0; h < q.length; h++) { const [r, c] = q[h]; if (r === b[0] && c === b[1]) break;
          for (let d = 0; d < 4; d++) { const nr = r + DR[d], nc = c + DC[d]; if (echoWall(s, nr, nc) || s.doors.some(x => x.r === nr && x.c === nc) || par.has([nr, nc].join())) continue; par.set([nr, nc].join(), { p: [r, c], d }); q.push([nr, nc]); } }
        if (!par.has(b.join())) return null; const out = []; let k = b.join(); while (par.get(k)) { out.push(par.get(k).d); k = par.get(k).p.join(); } return out.reverse();
      };
      let best = null; const WAITS = [0, 1, 2, 3, 4, 6];
      for (const order of orders) {
        let cur = s.start, legs = [], ok = true;
        for (const w of order) { const p = sp(cur, w); if (!p) { ok = false; break; } legs.push(p); cur = w; } if (!ok) continue;
        const slots = order.length + 1, combos = Math.pow(WAITS.length, Math.min(slots, 3));
        for (let code = 0; code < combos; code++) {
          let cc = code; const rec = [];
          for (let i = 0; i < slots; i++) { const wi = i < 3 ? WAITS[cc % WAITS.length] : 0; if (i < 3) cc = Math.floor(cc / WAITS.length); for (let q = 0; q < wi; q++) rec.push(4); if (i < legs.length) rec.push(...legs[i]); }
          if (rec.length > s.T || rec.length === 0) continue;
          let st = clone(base), good = true; for (const d of rec) { const nx = ECHO.apply(st, { k: 'step', d }); if (nx === st) { good = false; break; } st = nx; } if (!good) continue;
          st = ECHO.apply(st, { k: 'release' }); const rest = playSolve(st); if (!rest) continue;
          const total = rec.length + 1 + rest.length; if (!best || total < best.total) best = { total, moves: [...rec.map(d => ({ k: 'step', d })), { k: 'release' }, ...rest] };
        }
      }
      return best ? best.moves : null;
    }
  }
};

/* ───────────────────────── LOGIC: causal circuits, throw the switches so every lamp shows what the plaque demands ───────────────────────── */
export function logicEval(s) {
  const v = s.vals.slice(); const val = i => v[i];
  s.gates.forEach(g => { const a = val(g.a), b = g.b === undefined ? 0 : val(g.b); let r;
    switch (g.op) { case 'AND': r = a && b; break; case 'OR': r = a || b; break; case 'XOR': r = a ^ b; break; case 'NAND': r = !(a && b); break; case 'NOT': r = !a; break; default: r = a; }
    v.push(r ? 1 : 0); });
  return v;
}
const LOGIC = {
  moves: s => s.vals.map((_, i) => ({ k: 'flip', i })),
  apply(s, m) { const n = clone(s); n.vals[m.i] ^= 1; (s.links || []).forEach(([a, b]) => { if (a === m.i) n.vals[b] ^= 1; }); return n; },
  solved: s => { const v = logicEval(s); return s.outs.every((g, i) => v[g] === s.want[i]); },
  key: s => s.vals.join(''),
  solve: s => bfs(s, LOGIC.moves, LOGIC.apply, LOGIC.key, LOGIC.solved)
};

/* ───────────────────────── MULTI: world-scale puzzles made of several stages, each unlocking the next ───────────────────────── */
const MULTI = {
  moves: s => FAM[s.stages[s.cur].t].moves(s.stages[s.cur]).map(m => ({ k: 'sub', m })),
  apply(s, mv) {
    const st = s.stages[s.cur], ns = FAM[st.t].apply(st, mv.m); if (ns === st) return s;
    const n = clone(s); n.stages[n.cur] = ns;
    if (FAM[ns.t].solved(ns) && n.cur < n.stages.length - 1) n.cur++;
    return n;
  },
  solved: s => s.stages.every(st => FAM[st.t].solved(st)),
  key: s => s.cur + '#' + s.stages.map(st => FAM[st.t].key(st)).join('#'),
  solve(s) {
    let cur = s, out = [];
    for (let i = s.cur; i < s.stages.length; i++) {
      const st = cur.stages[i]; if (FAM[st.t].solved(st)) continue;
      const sol = FAM[st.t].solve(st); if (!sol) return null;
      for (const m of sol) { const mv = { k: 'sub', m }; out.push(mv); cur = MULTI.apply(cur, mv); }
    }
    return out;
  }
};

export const FAM = { seq: SEQ, pipes: PIPES, coupled: COUPLED, tilt: TILT, beam: BEAM, tanks: TANKS, echo: ECHO, logic: LOGIC, multi: MULTI };
export const moves = s => FAM[s.t].moves(s);
export const apply = (s, m) => FAM[s.t].apply(s, m);
export const solved = s => FAM[s.t].solved(s);
export const solve = s => FAM[s.t].solve(s);
/* Replays a move list on a state and reports whether it ends solved. The tests use this to prove every level is winnable. */
export function replay(s, list) { let t = s; for (const m of list) { const n = apply(t, m); if (n === t) return { ok: false, state: t }; t = n; } return { ok: solved(t), state: t }; }
/* Helpers the 3D views use to show the state of an echo puzzle. */
export const echoDoorOpen = (s, id) => { const e = s.echo ? echoAt(s, s.tick) : null; return plateHeld(s, id, s.pos, e); };
export const echoPos = s => (s.echo ? echoAt(s, s.tick) : null);
