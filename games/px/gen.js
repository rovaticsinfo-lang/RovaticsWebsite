/* PARALLAX puzzle generators. Run at BUILD time by tools/gen-parallax.mjs: every puzzle is generated from a seed, then SOLVED by the
   engine and the solution is replayed, so a puzzle only ships if it is provably winnable. The game itself loads the finished data. */
import { rng, clone, DR, DC, FAM, seqTarget, tileOpen, beamTrace, logicEval, solve, replay, solved } from './logic.js';

const shuffle = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a, r) => a[Math.floor(r() * a.length)];
const range = n => Array.from({ length: n }, (_, i) => i);

/* Which puzzle family and difficulty each level uses (world theme drives the family; the brief's four templates drive the variety). */
export function planFor(n) {
  const w = Math.ceil(n / 20), i = (n - 1) % 20, t = i % 4;
  const d = [0.05, 0.25, 0.4, 0.55, 0.3][w - 1] + [0.35, 0.3, 0.25, 0.3, 0.4][w - 1] * i / 19;
  if (w === 1) return { f: ['seq', 'pipes', 'coupled', 'coupled'][t], variant: ['rule', 'topo', 'tune', 'lights'][t], d };
  if (w === 2) return { f: ['tilt', 'coupled', 'beam', 'tilt'][t], variant: ['', 'magnet', '', ''][t], d };
  if (w === 3) return { f: ['tanks', 'coupled', 'seq', 'logic'][t], variant: ['', 'pressure', 'memory', ''][t], d };
  if (w === 4) return { f: ['echo', 'logic', 'echo', 'pipes'][t], variant: ['', '', '', 'wrap'][t], d };
  const combos = [['tilt', 'beam'], ['tanks', 'coupled'], ['logic', 'pipes'], ['echo', 'seq'], ['beam', 'logic', 'tilt'], ['tanks', 'echo'], ['pipes', 'coupled', 'logic'], ['seq', 'tilt', 'beam'], ['coupled', 'tanks', 'echo'], ['pipes', 'beam', 'tilt', 'logic']];
  if (n === 100) return { f: 'multi', stages: ['seq', 'pipes', 'tilt', 'beam', 'echo', 'logic'], d };
  return { f: 'multi', stages: combos[i % 10], d };
}

/* ── generators ── */
function genSeq(r, d, variant) {
  const memory = variant === 'memory', L = 3 + Math.floor(d * 6), n = memory ? Math.max(5, Math.min(8, L + 1)) : 4 + Math.floor(d * 5);
  const attrs = shuffle(range(n), r).map((v, i) => ({ h: v + 1, hue: 0, rings: 0 }));
  const hues = shuffle(range(n), r), rings = shuffle(range(n), r); attrs.forEach((a, i) => { a.hue = hues[i]; a.rings = rings[i] + 1; });
  const rule = memory ? 'memory' : pick(['height_up', 'height_down', 'hue', 'rings_up'], r);
  const target = memory ? shuffle(range(n), r).slice(0, Math.min(L, n)) : seqTarget(attrs, rule);
  return { t: 'seq', n, rule, attrs, target, prog: [], fails: 0 };
}
function genPipes(r, d, variant) {
  const R = 3 + Math.floor(d * 3.4), C = 4 + Math.floor(d * 3.4), wrap = variant === 'wrap' || (variant === 'topo' && d > 0.15);
  for (let attempt = 0; attempt < 300; attempt++) {
    const src = Math.floor(r() * R), dst = Math.floor(r() * R), s0 = { R, C, wrap };
    const nbr = (rr, cc, dd) => { let nr = rr + DR[dd], nc = cc + DC[dd]; if (wrap) nr = (nr + R) % R; return (nr < 0 || nr >= R || nc < 0 || nc >= C) ? null : [nr, nc]; };
    const path = [[src, 0]], used = new Set([src * 100]), dirs = []; let steps = 0;
    const dfs = () => {
      if (++steps > 4000) return false;
      const [cr, cc] = path[path.length - 1]; if (cr === dst && cc === C - 1) return path.length >= C;
      const order = shuffle([0, 1, 2, 3], r).sort((a, b) => (b === 1 ? 0.8 : 0) - (a === 1 ? 0.8 : 0) + (r() - 0.5) * 0.6);
      for (const dd of order) { const nb = nbr(cr, cc, dd); if (!nb || used.has(nb[0] * 100 + nb[1])) continue; path.push(nb); used.add(nb[0] * 100 + nb[1]); dirs.push(dd); if (dfs()) return true; path.pop(); used.delete(nb[0] * 100 + nb[1]); dirs.pop(); }
      return false;
    };
    if (!dfs()) continue;
    const tiles = range(R).map(() => range(C).map(() => ({ ty: pick(['S', 'S', 'C', 'C', 'T', 'X'], r), rot: Math.floor(r() * 4), lock: 0 })));
    path.forEach(([pr, pc], i) => {
      const e = i === 0 ? 3 : (dirs[i - 1] + 2) % 4, x = i === path.length - 1 ? 1 : dirs[i];
      let ty = x === (e + 2) % 4 ? 'S' : 'C'; if (r() < 0.18 + d * 0.2) ty = pick(['T', 'T', 'X'], r);
      let good = []; for (let q = 0; q < 4; q++) { const op = tileOpen(ty, q); if (op.includes(e) && op.includes(x)) good.push(q); }
      const correct = pick(good, r); let rot = Math.floor(r() * 4); if (good.includes(rot)) rot = (rot + 1) % 4;
      const given = r() < (0.55 - d * 0.5); tiles[pr][pc] = { ty, rot: given ? correct : rot, lock: given ? 1 : 0 };
    });
    for (let q = 0; q < R * C * 0.12 * d; q++) { const rr = Math.floor(r() * R), cc = Math.floor(r() * C); if (!used.has(rr * 100 + cc)) tiles[rr][cc].lock = 1; }
    const st = { t: 'pipes', R, C, wrap, src, dst, tiles };
    if (solved(st)) continue; const sol = solve(st); if (sol && sol.length >= 2 && replay(st, sol).ok) return st;
  }
  throw new Error('pipes gen failed');
}
function genCoupled(r, d, variant) {
  for (let attempt = 0; attempt < 200; attempt++) {
    let st;
    if (variant === 'lights') {
      const R = 3 + Math.floor(d * 3.2), C = R, n = R * C, eff = range(n).map(i => { const row = new Array(n).fill(0), rr = Math.floor(i / C), cc = i % C; row[i] = 1; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { const nr = rr + a, nc = cc + b; if (nr >= 0 && nc >= 0 && nr < R && nc < C) row[nr * C + nc] = 1; }); return row; });
      st = { t: 'coupled', kind: 'lights', R, C, n, m: 2, eff, vals: new Array(n).fill(1), target: new Array(n).fill(1) };
    } else {
      const n = 4 + Math.floor(d * 3.5), m = d > 0.55 ? 4 : 3, eff = range(n).map(i => { const row = new Array(n).fill(0); row[i] = 1;
        if (i > 0) row[i - 1] = variant === 'magnet' ? m - 1 : 1; if (i < n - 1) row[i + 1] = variant === 'pressure' ? m - 1 : (variant === 'magnet' ? m - 1 : 1); return row; });
      for (let q = 0; q < Math.floor(d * 2.5); q++) { const a = Math.floor(r() * n), b = Math.floor(r() * n); if (a !== b && eff[a][b] === 0) eff[a][b] = 1; }
      st = { t: 'coupled', kind: variant || 'tune', n, m, eff, vals: range(n).map(() => Math.floor(r() * m)), target: range(n).map(() => Math.floor(r() * m)) };
      st.vals = st.target.slice();
    }
    const kicks = 3 + Math.floor(d * 5) + Math.floor(r() * 3);
    for (let k = 0; k < kicks; k++) { const i = Math.floor(r() * st.n); for (let q = 0; q < st.m - 1; q++) st = FAM.coupled.apply(st, { k: 'tap', i }); }
    if (solved(st)) continue; const sol = solve(st); if (sol && sol.length >= 2 && replay(st, sol).ok) return st;
  }
  throw new Error('coupled gen failed');
}
function genTilt(r, d) {
  const R = 5 + Math.floor(d * 3), C = 5 + Math.floor(d * 3), nb = d < 0.38 ? 1 : d < 0.62 ? 2 : 3, lo = 3 + Math.floor(d * 5), hi = lo + 6;
  for (let attempt = 0; attempt < 3000; attempt++) {
    const g = range(R).map(() => range(C).map(() => { const x = r(); return x < 0.2 ? '#' : x < 0.27 ? 's' : '.'; }).join(''));
    const open = []; for (let a = 0; a < R; a++) for (let b = 0; b < C; b++) if (g[a][b] !== '#') open.push([a, b]);
    if (open.length < nb * 2 + 4) continue; const cells = shuffle(open, r), balls = cells.slice(0, nb), goals = cells.slice(nb, nb * 2);
    const st = { t: 'tilt', R, C, g, balls, goals, dock: new Array(nb).fill(0) };
    if (solved(st)) continue; const sol = solve(st); if (sol && sol.length >= lo && sol.length <= hi && replay(st, sol).ok) return st;
  }
  throw new Error('tilt gen failed');
}
function genBeam(r, d) {
  const N = 5 + Math.floor(d * 3);
  for (let attempt = 0; attempt < 2000; attempt++) {
    const g = range(N).map(() => range(N).map(() => (r() < 0.07 + d * 0.06 ? '#' : '.')).join('')), emit = Math.floor(r() * N);
    const cells = []; for (let a = 0; a < N; a++) for (let b = 1; b < N; b++) if (g[a][b] === '.') cells.push([a, b]);
    const km = 3 + Math.floor(d * 6), spots = shuffle(cells, r).slice(0, km), nSplit = d > 0.35 ? 1 + (d > 0.6 ? 1 : 0) : 0, nFixed = d > 0.3 ? Math.floor(d * 2.2) : 0;
    const mirrors = spots.map((p, i) => ({ r: p[0], c: p[1], o: Math.floor(r() * 2), splitter: i < nSplit ? 1 : 0, fixed: i >= nSplit && i < nSplit + nFixed ? 1 : 0 }));
    let st = { t: 'beam', R: N, C: N, g, emit, mirrors, targets: [] };
    const { lit } = beamTrace(st), free = [...lit].map(s => s.split(',').map(Number)).filter(([a, b]) => !mirrors.some(m => m.r === a && m.c === b));
    const nt = 2 + Math.floor(d * 3); if (free.length < nt + 2) continue;
    st.targets = shuffle(free, r).sort((p, q) => q[1] - p[1] + (r() - 0.5) * 3).slice(0, nt);
    const flippable = mirrors.map((m, i) => i).filter(i => !mirrors[i].fixed);
    for (const i of flippable) if (r() < 0.6) st.mirrors[i].o ^= 1;
    if (solved(st)) continue; const sol = solve(st); if (sol && sol.length >= 3 && sol.length <= 9 && replay(st, sol).ok) return st;
  }
  throw new Error('beam gen failed');
}
function genTanks(r, d) {
  const lo = 4 + Math.floor(d * 6), hi = lo + 8;
  for (let attempt = 0; attempt < 3000; attempt++) {
    const caps = shuffle(range(11).map(x => x + 3), r).slice(0, 3).sort((a, b) => a - b), vol = [0, 0, 0], goal = [null, null, null];
    const gi = Math.floor(r() * 3); goal[gi] = 1 + Math.floor(r() * (caps[gi] - 1));
    if (d > 0.5) { const gj = (gi + 1 + Math.floor(r() * 2)) % 3; goal[gj] = 1 + Math.floor(r() * (caps[gj] - 1)); }
    const st = { t: 'tanks', caps, vol, goal }; if (solved(st)) continue;
    const sol = solve(st); if (sol && sol.length >= lo && sol.length <= hi && replay(st, sol).ok) return st;
  }
  throw new Error('tanks gen failed');
}
function genLogic(r, d) {
  for (let attempt = 0; attempt < 3000; attempt++) {
    const n = 4 + Math.floor(d * 5), ng = n + Math.floor(d * 4), gates = [];
    for (let i = 0; i < ng; i++) { const op = pick(['AND', 'OR', 'XOR', 'NAND', 'NOT'], r), avail = n + i, a = Math.floor(r() * avail); let b = Math.floor(r() * avail); if (b === a) b = (a + 1) % avail; gates.push(op === 'NOT' ? { op, a } : { op, a, b }); }
    const no = 2 + Math.floor(d * 3), outs = range(no).map(i => n + ng - 1 - i);
    const hidden = range(n).map(() => (r() < 0.5 ? 1 : 0)), probe = { vals: hidden, gates, outs };
    const want = outs.map(g => logicEval(probe)[g]);
    const links = []; for (let q = 0; q < Math.floor(d * 3.5); q++) { const a = Math.floor(r() * n), b = Math.floor(r() * n); if (a !== b) links.push([a, b]); }
    const st = { t: 'logic', n, vals: range(n).map(() => (r() < 0.5 ? 1 : 0)), gates, outs, want, links };
    if (solved(st)) continue; const sol = solve(st); if (sol && sol.length >= 3 && sol.length <= 10 && replay(st, sol).ok) return st;
  }
  throw new Error('logic gen failed');
}
function genEcho(r, d) {
  const doors = d < 0.5 ? 1 : 2;
  for (let attempt = 0; attempt < 600; attempt++) {
    const R = 5 + Math.floor(r() * 2 + d * 1.5), w1 = 3 + Math.floor(r() * 2), w2 = 2 + Math.floor(r() * 2), wl = 2 + Math.floor(r() * 2);
    const walls = doors === 1 ? [w1] : [w1, w1 + 1 + w2], C = (doors === 1 ? w1 + 1 + wl : w1 + 1 + w2 + 1 + wl);
    const grid = range(R).map(() => range(C).map(() => '.'));
    walls.forEach(c => range(R).forEach(rr => { grid[rr][c] = '#'; }));
    const doorList = walls.map((c, id) => { const rr = Math.floor(r() * R); grid[rr][c] = '.'; return { id, r: rr, c }; });
    const free = (c0, c1) => { const o = []; for (let rr = 0; rr < R; rr++) for (let cc = c0; cc < c1; cc++) o.push([rr, cc]); return shuffle(o, r); };
    const reg1 = free(0, w1), start = reg1[0], plates = doorList.map((dd, i) => ({ r: reg1[1 + i][0], c: reg1[1 + i][1], id: dd.id }));
    const last = free(walls[walls.length - 1] + 1, C), exit = last[0];
    const used = new Set([start, ...plates.map(p => [p.r, p.c]), exit].map(x => x.join()));
    for (let q = 0; q < R * C * (0.06 + d * 0.06); q++) { const rr = Math.floor(r() * R), cc = Math.floor(r() * C); if (grid[rr][cc] === '.' && !used.has(rr + ',' + cc) && !doorList.some(x => x.r === rr && x.c === cc)) grid[rr][cc] = '#'; }
    let st = { t: 'echo', R, C, g: grid.map(x => x.join('')), start, exit, plates, doors: doorList, T: 22, maxPlay: 34, phase: 'rec', pos: start.slice(), tick: 0, rec: [], play: [], echo: null };
    const sol = solve(st); if (!sol) continue;
    const recLen = sol.findIndex(m => m.k === 'release'); st.T = Math.max(6, recLen + 2);
    const sol2 = solve(st); if (!sol2 || sol2.length < 8 || sol2.length > 44 || !replay(st, sol2).ok) continue;
    return st;
  }
  throw new Error('echo gen failed');
}
const GEN = { seq: genSeq, pipes: genPipes, coupled: genCoupled, tilt: genTilt, beam: genBeam, tanks: genTanks, logic: genLogic, echo: genEcho };

export function makeLevel(n) {
  const plan = planFor(n), r = rng(n * 7919 + 17);
  if (plan.f === 'multi') {
    const stages = plan.stages.map((f, i) => { const sd = Math.min(0.7, 0.28 + 0.4 * (n - 81) / 19 - i * 0.02); const v = f === 'coupled' ? (i % 2 ? 'lights' : 'tune') : f === 'seq' ? (i % 2 ? 'memory' : 'rule') : f === 'pipes' ? 'wrap' : ''; return GEN[f](rng(n * 131 + i * 977 + 5), sd, v); });
    return { t: 'multi', cur: 0, stages };
  }
  return GEN[plan.f](r, plan.d, plan.variant);
}
