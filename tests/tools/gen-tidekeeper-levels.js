// Offline level generator for Tide Keeper. Run: node tests/tools/gen-tidekeeper-levels.js
// Writes games/tidekeeper-levels.js. Every level is solved by the engine's exhaustive solver,
// so each one is provably winnable and `par` is its true shortest solution.
const fs = require('fs'), path = require('path');
const E = require('../../games/tidekeeper-engine.js');

// types: creatures in the level. par: [min,max] accepted shortest-solution length.
// turns: how many direction changes the solution must contain (forces real tide juggling).
const WORLDS = [
  { types: ['f'],           w: 11, h: 8,  tide: [4, 5], par: [4, 9],   turns: 0, cur: 0, ridge: [1, 1], arch: [0, 0] },
  { types: ['d'],           w: 11, h: 8,  tide: [4, 5], par: [4, 10],  turns: 1, cur: 0, ridge: [1, 2], arch: [0, 0] },
  { types: ['f', 'd'],      w: 12, h: 9,  tide: [4, 6], par: [6, 14],  turns: 1, cur: 0, ridge: [1, 2], arch: [0, 1] },
  { types: ['t'],           w: 12, h: 9,  tide: [5, 6], par: [5, 13],  turns: 0, cur: 0, ridge: [1, 2], arch: [0, 1], sand: true },
  { types: ['c', 'f'],      w: 12, h: 9,  tide: [5, 6], par: [6, 14],  turns: 1, cur: 0, ridge: [1, 2], arch: [0, 1] },
  { types: ['s', 'f'],      w: 12, h: 9,  tide: [5, 6], par: [6, 15],  turns: 1, cur: 1, ridge: [1, 2], arch: [0, 1] },
  { types: ['f', 'd'],      w: 13, h: 9,  tide: [5, 7], par: [8, 17],  turns: 2, cur: 0, ridge: [2, 3], arch: [1, 2] },
  { types: ['t', 'd'],      w: 13, h: 10, tide: [6, 8], par: [8, 18],  turns: 2, cur: 0, ridge: [2, 3], arch: [1, 2], sand: true },
  { types: ['f', 'd', 'c'], w: 13, h: 10, tide: [6, 8], par: [9, 19],  turns: 2, cur: 0, ridge: [2, 3], arch: [1, 2] },
  { types: ['f', 'd', 's'], w: 14, h: 10, tide: [6, 8], par: [9, 20],  turns: 2, cur: 1, ridge: [2, 3], arch: [1, 2], sand: true }
];

const ri = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

function buildTerrain(cfg, rng, f) {
  const { w, h } = cfg;
  const top = [];
  let t = ri(rng, h - 4, h - 2);
  for (let x = 0; x < w; x++) {
    t += pick(rng, [-1, 0, 0, 0, 1]);
    t = Math.max(3, Math.min(h - 1, t));
    top.push(t);
  }
  // ridges: tall columns that block a low sea and a walking deer alike
  const nRidge = Math.round(cfg.ridge[0] + (cfg.ridge[1] - cfg.ridge[0]) * f);
  for (let i = 0; i < nRidge; i++) {
    const x = ri(rng, 2, w - 3);
    top[x] = Math.max(2, top[x] - ri(rng, 2, 3));
  }
  const grid = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) row += y >= top[x] ? (cfg.sand && y === top[x] && rng() < .45 ? '=' : '#') : ' ';
    grid.push(row.split(''));
  }
  // arches: a slab of ceiling that makes caves and narrow channels
  const nArch = Math.round(cfg.arch[0] + (cfg.arch[1] - cfg.arch[0]) * f);
  for (let i = 0; i < nArch; i++) {
    const x = ri(rng, 1, w - 4), len = ri(rng, 2, 3), y = ri(rng, 1, Math.max(1, Math.min(...top.slice(x, x + len)) - 2));
    for (let k = 0; k < len && x + k < w; k++) grid[y][x + k] = '#';
  }
  return { rows: grid.map(r => r.join('')), top };
}

function placeEnts(cfg, rng, L0, top) {
  const { w, h } = cfg, ents = [], used = new Set();
  const free = (x, y) => x >= 0 && y >= 0 && x < w && y < h && L0.rows[y][x] === ' ' && !used.has(x + ',' + y);
  const surf = x => { const y = top[x] - 1; return free(x, y) ? y : -1; };
  const deep = x => {
    const lo = Math.max(0, h - cfg.tideMax); let best = -1;
    for (let y = lo; y <= top[x] - 1; y++) if (free(x, y)) best = y;
    return best;
  };
  const spot = (t, x) => t === 'f' ? deep(x) : (t === 'd' || t === 'c') ? surf(x) : t === 't' ? deep(x) : -1;
  for (const t of cfg.types) {
    if (t === 's') {                                   // a seed starts high and must root on a chosen patch
      const homes = [], starts = [];
      for (let x = 0; x < w; x++) { const y = surf(x); if (y >= 0) homes.push([x, y]); if (free(x, 0)) starts.push(x); }
      if (!homes.length || !starts.length) return null;
      const [hx, hy] = homes[Math.floor(rng() * homes.length)];
      const cand = starts.filter(x => cfg.cur > 0 ? x < hx : cfg.cur < 0 ? x > hx : true);
      if (!cand.length) return null;
      const sx = cand[Math.floor(rng() * cand.length)];
      used.add(sx + ',0'); used.add(hx + ',' + hy);
      ents.push({ t, x: sx, y: 0, hx, hy });
      continue;
    }
    const cols = [];
    for (let x = 0; x < w; x++) { const y = spot(t, x); if (y >= 0) cols.push([x, y]); }
    const homeCols = t === 't' ? (() => { const r = []; for (let x = 0; x < w; x++) { const y = surf(x); if (y >= 0) r.push([x, y]); } return r; })() : cols;
    if (cols.length < 2 || !homeCols.length) return null;
    let placed = null;
    for (let tries = 0; tries < 80 && !placed; tries++) {
      const A = cols[Math.floor(rng() * cols.length)], B = homeCols[Math.floor(rng() * homeCols.length)];
      if (Math.abs(A[0] - B[0]) < 4) continue;
      if (used.has(A[0] + ',' + A[1]) || used.has(B[0] + ',' + B[1])) continue;
      placed = { t, x: A[0], y: A[1], hx: B[0], hy: B[1] };
    }
    if (!placed) return null;
    used.add(placed.x + ',' + placed.y); used.add(placed.hx + ',' + placed.hy);
    ents.push(placed);
  }
  return ents;
}

function directionChanges(sol) {
  const moves = sol.split('').filter(c => c !== 'W');
  let turns = 0;
  for (let i = 1; i < moves.length; i++) if (moves[i] !== moves[i - 1]) turns++;
  return turns;
}

function tryLevel(cfg, rng, f) {
  const terr = buildTerrain(cfg, rng, f);
  const L0 = { rows: terr.rows };
  const ents = placeEnts(cfg, rng, L0, terr.top);
  if (!ents) return null;
  const tide0 = ri(rng, 0, cfg.tideMax);
  let L;
  try { L = E.parse({ rows: terr.rows, tideMax: cfg.tideMax, tide0, ents, cur: cfg.cur }); } catch (e) { return null; }
  // every creature must start somewhere legal (a seed may start in mid-air; it falls)
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.t !== 's' && !E.canOccupy(L, tide0, e.t, e.x, e.y)) return null;
  }
  // cheap pre-check: every creature must be able to reach home at SOME tide, else the solve is hopeless
  for (const e of ents) {
    if (e.t === 's') continue;
    let ok = false;
    for (let td = 0; td <= cfg.tideMax && !ok; td++) {
      const pf = E.pathField(L, td, e.t, e.hx, e.hy);
      if (pf[e.y * cfg.w + e.x] > 0) ok = true;
    }
    if (!ok) return null;
  }
  const res = E.solve(L, cfg.par[1] + 2, 260000);
  if (!res || !res.solution) return null;
  const sol = res.solution;
  if (sol.length < cfg.par[0] || sol.length > cfg.par[1]) return null;
  if (directionChanges(sol) < cfg.turns) return null;
  if (!/[UD]/.test(sol)) return null;
  const chk = E.replay(L, sol);
  if (!chk.win || chk.dead) return null;
  return { rows: terr.rows, tideMax: cfg.tideMax, tide0, cur: cfg.cur, ents, par: sol.length, solution: sol };
}

const levels = [], t0 = Date.now();
for (let wi = 0; wi < WORLDS.length; wi++) {
  const base = WORLDS[wi];
  for (let li = 0; li < 10; li++) {
    const f = li / 9;
    const cfg = Object.assign({}, base, { tideMax: Math.round(base.tide[0] + (base.tide[1] - base.tide[0]) * f) });
    const rng = E.mulberry32(50000 + wi * 977 + li * 131);
    let out = null, tries = 0;
    while (!out && tries++ < 30000) out = tryLevel(cfg, rng, f);
    if (!out) throw new Error('world ' + (wi + 1) + ' level ' + (li + 1) + ' failed to generate');
    out.world = wi; out.index = wi * 10 + li + 1;
    out.moves = out.par + 8;
    levels.push(out);
    process.stdout.write(`${out.index}:${out.par}(${tries}) `);
  }
  process.stdout.write('\n');
}
console.log('Generated ' + levels.length + ' levels in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
const out = `/* AUTO-GENERATED by tests/tools/gen-tidekeeper-levels.js - do not edit by hand.
   Every level was solved by the engine's exhaustive tide search, so each is winnable and par is exact. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TideKeeperLevels = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  return { LEVELS: ${JSON.stringify(levels)} };
});
`;
fs.writeFileSync(path.join(__dirname, '../../games/tidekeeper-levels.js'), out);
console.log('size ' + (out.length / 1024).toFixed(0) + ' KB');
