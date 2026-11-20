/* Beam Bots engine: beam tracing, level generator, hints. No DOM. Browser: window.BeamBotsEngine, Node: module.exports.
   Colours are RGB bitmasks: R=1, G=2, B=4 (3=yellow, 5=magenta, 6=cyan, 7=white).
   Directions: 0=up 1=right 2=down 3=left. Orientation o: 0 = "/"  1 = "\".
   Pieces you place: 'm' mirror, 's' splitter (beam goes straight AND reflects).
   Fixed things: walls, emitters, colour filters (beam colour &= filter mask), robot targets (need an exact colour). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BeamBotsEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  var REFLECT = [[1, 0, 3, 2], [3, 2, 1, 0]]; // [orientation][incoming dir] -> outgoing dir
  var COLORS = { 1: '#ff4d6d', 2: '#4dff88', 3: '#ffe34d', 4: '#4da6ff', 5: '#ff4dff', 6: '#4dffff', 7: '#ffffff' };
  var COLOR_NAMES = { 1: 'red', 2: 'green', 3: 'yellow', 4: 'blue', 5: 'magenta', 6: 'cyan', 7: 'white' };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function key(x, y) { return x + ',' + y; }

  function indexLevel(L) {
    var ix = { wall: {}, emit: {}, filter: {}, target: {} };
    L.walls.forEach(function (w) { ix.wall[key(w.x, w.y)] = true; });
    L.emitters.forEach(function (e) { ix.emit[key(e.x, e.y)] = e; });
    L.filters.forEach(function (f) { ix.filter[key(f.x, f.y)] = f; });
    L.targets.forEach(function (t) { ix.target[key(t.x, t.y)] = t; });
    return ix;
  }

  // placed: { "x,y": {type:'m'|'s', o:0|1} }
  // Returns {segs, got, ends, lit, targets, solved}. seg.dist = distance travelled before the segment starts (for animation).
  function trace(L, placed) {
    var ix = L._ix || (L._ix = indexLevel(L));
    var segs = [], got = {}, ends = [], litSet = {}, seen = {};
    var queue = L.emitters.map(function (e) { return { x: e.x, y: e.y, d: e.d, c: e.c, dist: 0 }; });
    var guard = 0;
    while (queue.length && guard++ < 5000) {
      var b = queue.shift(), x = b.x, y = b.y, d = b.d, c = b.c, dist = b.dist;
      for (var step = 0; step < 200; step++) {
        var nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) {
          segs.push({ x1: x + .5, y1: y + .5, x2: x + .5 + DX[d] * .5, y2: y + .5 + DY[d] * .5, c: c, dist: dist });
          ends.push({ x: x, y: y, c: c, d: d }); break;
        }
        var k = key(nx, ny);
        if (ix.wall[k] || ix.emit[k]) {
          segs.push({ x1: x + .5, y1: y + .5, x2: x + .5 + DX[d] * .5, y2: y + .5 + DY[d] * .5, c: c, dist: dist });
          break;
        }
        segs.push({ x1: x + .5, y1: y + .5, x2: nx + .5, y2: ny + .5, c: c, dist: dist });
        dist += 1;
        if (ix.target[k]) { got[k] = (got[k] || 0) | c; litSet[k] = true; break; }
        if (ix.filter[k]) { c = c & ix.filter[k].c; if (!c) break; }
        litSet[k] = true;
        var p = placed[k];
        var sk = k + ':' + d + ':' + c;
        if (p) {
          var nd = REFLECT[p.o][d];
          if (p.type === 's') {
            var sk2 = k + ':s:' + nd + ':' + c;
            if (!seen[sk2]) { seen[sk2] = true; queue.push({ x: nx, y: ny, d: nd, c: c, dist: dist }); }
          } else d = nd;
        }
        if (seen[sk]) break; seen[sk] = true;
        x = nx; y = ny;
      }
    }
    var targets = L.targets.map(function (t) {
      var g = got[key(t.x, t.y)] || 0;
      return { x: t.x, y: t.y, need: t.need, got: g, ok: g === t.need };
    });
    var lit = Object.keys(litSet).map(function (s) { var p = s.split(','); return { x: +p[0], y: +p[1] }; });
    return { segs: segs, got: got, ends: ends, lit: lit, targets: targets,
             solved: targets.length > 0 && targets.every(function (t) { return t.ok; }) };
  }

  function isOccupied(L, x, y) {
    var ix = L._ix || (L._ix = indexLevel(L)), k = key(x, y);
    return !!(ix.wall[k] || ix.emit[k] || ix.filter[k] || ix.target[k]);
  }
  function inventoryLeft(L, placed) {
    var left = { m: L.inventory.m, s: L.inventory.s };
    Object.keys(placed).forEach(function (k) { left[placed[k].type]--; });
    return left;
  }
  function placedFromSolution(sol) { var p = {}; sol.forEach(function (s) { p[key(s.x, s.y)] = { type: s.type, o: s.o }; }); return p; }

  // Next solution piece the player hasn't placed correctly yet (used by the Hint button).
  function hint(L, placed) {
    for (var i = 0; i < L.solution.length; i++) {
      var s = L.solution[i], p = placed[key(s.x, s.y)];
      if (!p || p.type !== s.type || p.o !== s.o) return s;
    }
    return null;
  }

  // ---------------- generator ----------------
  function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

  function build(cfg, rng) {
    var w = cfg.w, h = cfg.h;
    var L = { w: w, h: h, walls: [], emitters: [], filters: [], targets: [], inventory: { m: 0, s: 0 }, solution: [] };
    var used = {};
    for (var e = 0; e < cfg.emitters; e++) {
      var tries = 0, x, y, d;
      do {
        var side = Math.floor(rng() * 4);
        if (side === 0) { x = 1 + Math.floor(rng() * (w - 2)); y = h - 1; d = 0; }
        else if (side === 1) { x = 0; y = 1 + Math.floor(rng() * (h - 2)); d = 1; }
        else if (side === 2) { x = 1 + Math.floor(rng() * (w - 2)); y = 0; d = 2; }
        else { x = w - 1; y = 1 + Math.floor(rng() * (h - 2)); d = 3; }
      } while (used[key(x, y)] && tries++ < 30);
      if (used[key(x, y)]) return null;
      used[key(x, y)] = true;
      var col = 7;
      if (cfg.colored) col = pick(cfg.filters ? [3, 5, 6, 7] : [1, 2, 4, 3, 5, 6], rng);
      L.emitters.push({ x: x, y: y, d: d, c: col });
    }
    var placed = {}, sol = [], mLeft = cfg.pieces - (cfg.splitters || 0), sLeft = cfg.splitters || 0, fLeft = cfg.filters || 0;
    var guard = 0;
    while ((mLeft > 0 || sLeft > 0) && guard++ < 60) {
      L._ix = null;
      var tr = trace(L, placed);
      var cand = tr.lit.filter(function (p) { return !placed[key(p.x, p.y)] && !isOccupied(L, p.x, p.y); });
      if (!cand.length) return null;
      var cell = pick(cand, rng), k = key(cell.x, cell.y);
      if (fLeft > 0 && rng() < .35) {
        // colour filter on a multi-colour beam
        var beamC = 0; tr.segs.forEach(function (s) { if (Math.abs(s.x2 - .5 - cell.x) < .01 && Math.abs(s.y2 - .5 - cell.y) < .01) beamC |= s.c; });
        var masks = [1, 2, 3, 4, 5, 6].filter(function (m) { return (m & beamC) === m && m !== beamC; });
        if (masks.length) { L.filters.push({ x: cell.x, y: cell.y, c: pick(masks, rng) }); fLeft--; continue; }
      }
      var type = sLeft > 0 && (mLeft === 0 || rng() < .4) ? 's' : 'm';
      var o = rng() < .5 ? 0 : 1;
      placed[k] = { type: type, o: o }; sol.push({ x: cell.x, y: cell.y, type: type, o: o });
      if (type === 's') sLeft--; else mLeft--;
    }
    if (mLeft > 0 || sLeft > 0 || fLeft > 0) return null;
    L._ix = null;
    var fin = trace(L, placed), byCell = {};
    var okEnds = true;
    fin.ends.forEach(function (en) {
      var k = key(en.x, en.y);
      if (placed[k] || isOccupied(L, en.x, en.y) || used[k]) { okEnds = false; return; }
      byCell[k] = (byCell[k] || 0) | en.c;
    });
    if (!okEnds) return null;
    var cells = Object.keys(byCell);
    if (cells.length < 1 || cells.length > cfg.maxTargets) return null;
    cells.forEach(function (k) { var p = k.split(','); L.targets.push({ x: +p[0], y: +p[1], need: byCell[k] }); });
    L._ix = null;
    var chk = trace(L, placed);
    if (!chk.solved || chk.lit.length < cfg.minLit) return null;
    // decoy walls on unlit, free cells
    var litSet = {}; chk.lit.forEach(function (p) { litSet[key(p.x, p.y)] = true; });
    chk.segs.forEach(function () {});
    var free = [];
    for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
      var kk = key(xx, yy);
      if (!litSet[kk] && !placed[kk] && !isOccupied(L, xx, yy)) free.push({ x: xx, y: yy });
    }
    for (var i = 0; i < (cfg.walls || 0) && free.length; i++) {
      var idx = Math.floor(rng() * free.length); L.walls.push(free.splice(idx, 1)[0]);
    }
    L._ix = null;
    var fin2 = trace(L, placed);
    if (!fin2.solved) return null;
    if (trace(L, {}).solved) return null; // must need at least one piece
    L.solution = sol; L.par = sol.length;
    L.inventory = { m: sol.filter(function (s) { return s.type === 'm'; }).length, s: sol.filter(function (s) { return s.type === 's'; }).length };
    L._ix = null;
    return L;
  }

  function generate(cfg, seed) {
    var rng = mulberry32(seed >>> 0);
    for (var attempt = 0; attempt < 3000; attempt++) {
      var L = build(cfg, rng);
      if (L) { L.seed = seed; delete L._ix; return L; }
    }
    throw new Error('could not generate level for seed ' + seed);
  }

  var LEVEL_CONFIGS = [
    { w: 5, h: 5, pieces: 2, emitters: 1, maxTargets: 1, minLit: 6, walls: 2 },
    { w: 5, h: 5, pieces: 3, emitters: 1, maxTargets: 1, minLit: 8, walls: 3 },
    { w: 6, h: 6, pieces: 3, splitters: 1, emitters: 1, maxTargets: 2, minLit: 10, walls: 4 },
    { w: 6, h: 6, pieces: 4, splitters: 1, emitters: 1, maxTargets: 2, minLit: 12, walls: 5 },
    { w: 7, h: 6, pieces: 4, splitters: 1, filters: 1, emitters: 1, maxTargets: 3, minLit: 14, walls: 5 },
    { w: 7, h: 7, pieces: 5, emitters: 2, colored: true, maxTargets: 3, minLit: 16, walls: 6 },
    { w: 7, h: 7, pieces: 5, splitters: 2, filters: 1, emitters: 1, maxTargets: 3, minLit: 18, walls: 6 },
    { w: 8, h: 7, pieces: 6, splitters: 2, filters: 1, emitters: 2, colored: true, maxTargets: 4, minLit: 22, walls: 7 },
    { w: 8, h: 8, pieces: 7, splitters: 2, filters: 2, emitters: 1, maxTargets: 4, minLit: 26, walls: 8 },
    { w: 8, h: 8, pieces: 7, splitters: 3, filters: 1, emitters: 2, colored: true, maxTargets: 5, minLit: 28, walls: 8 },
    { w: 9, h: 8, pieces: 8, splitters: 3, filters: 2, emitters: 2, colored: true, maxTargets: 5, minLit: 32, walls: 9 },
    { w: 9, h: 9, pieces: 9, splitters: 3, filters: 2, emitters: 3, colored: true, maxTargets: 6, minLit: 36, walls: 10 }
  ];
  var LEVEL_NAMES = ['First Spark', 'Bounce', 'Fork in the Road', 'Detour', 'Tinted Glass', 'Colour Clash', 'Double Split', 'Rainbow Lab',
                     'Maze Runner', 'Prism Palace', 'Grand Circuit', 'Rovatics Core'];
  var DAILY_CONFIG = { w: 8, h: 8, pieces: 6, splitters: 2, filters: 1, emitters: 2, colored: true, maxTargets: 4, minLit: 24, walls: 7 };

  var cache = {};
  function levelSeed(n) { return 7000 + n * 131; }
  function getLevel(n) {
    if (n < 1 || n > LEVEL_CONFIGS.length) throw new RangeError('level out of range');
    return cache[n] || (cache[n] = generate(LEVEL_CONFIGS[n - 1], levelSeed(n)));
  }
  // dateStr like "2026-11-21"
  function dailySeed(dateStr) { var s = 0; for (var i = 0; i < dateStr.length; i++) s = (s * 31 + dateStr.charCodeAt(i)) >>> 0; return s; }
  function getDaily(dateStr) { return generate(DAILY_CONFIG, dailySeed(dateStr)); }

  function starsFor(L, moves, hints) {
    var par = L.par, s = moves <= par + Math.ceil(par / 2) ? 3 : moves <= par * 2 + 2 ? 2 : 1;
    if (hints > 0) s = Math.max(1, s - 1);
    return s;
  }

  return {
    DX: DX, DY: DY, COLORS: COLORS, COLOR_NAMES: COLOR_NAMES, LEVELS: LEVEL_CONFIGS.length, LEVEL_NAMES: LEVEL_NAMES,
    mulberry32: mulberry32, trace: trace, key: key, isOccupied: isOccupied, inventoryLeft: inventoryLeft,
    placedFromSolution: placedFromSolution, hint: hint, generate: generate, getLevel: getLevel, getDaily: getDaily,
    starsFor: starsFor, LEVEL_CONFIGS: LEVEL_CONFIGS
  };
});
