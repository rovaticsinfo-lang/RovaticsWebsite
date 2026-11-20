/* Chain Reactor engine: rules, wave resolution, solver, endless-mode helpers. No DOM.
   Browser: window.ChainReactorEngine   Node: module.exports

   Board cells (typ/val arrays, row-major):
     typ 0 empty | 1 core (N) | 2 diagonal core (D) | 3 laser core (L) | 4 steel wall (W) | 5 frozen core (I)
     val = charge 1..3. A core that reaches charge 4 EXPLODES.
   Rules
     - Tap a core: +1 charge (walls, empty cells and frozen cores can't be tapped).
     - An exploding core disappears and fires 4 shots.
         core:     up/down/left/right, each shot adds +1 to the FIRST thing it meets
         diagonal: the same, along the 4 diagonals
         laser:    up/down/left/right, piercing: adds +1 to EVERY core in the line (stops at walls)
     - Walls stop shots. A frozen core thaws (becomes a normal core) when hit once, then takes the hit.
     - Explosions happen in simultaneous waves, so shots may fly through cores that blew up in the same wave.
     - Goal: remove every core (walls stay) within the tap budget. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ChainReactorEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var N = 1, D = 2, L = 3, W = 4, I = 5;
  var ORTHO = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  var DIAG = [[1, -1], [1, 1], [-1, 1], [-1, -1]];
  var TOKEN = { n: N, d: D, l: L, i: I };
  var LETTER = { 1: 'n', 2: 'd', 3: 'l', 5: 'i' };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function make(w, h) { return { w: w, h: h, typ: new Int8Array(w * h), val: new Int8Array(w * h) }; }
  function clone(S) { return { w: S.w, h: S.h, typ: S.typ.slice(), val: S.val.slice() }; }

  // Level rows: array of strings, 2 chars per cell: ".." empty, "W." wall, "n2" core charge 2, "d1" diagonal, "l3" laser, "i2" frozen.
  function parse(rows) {
    var h = rows.length, w = rows[0].length / 2, S = make(w, h);
    for (var y = 0; y < h; y++) {
      if (rows[y].length !== w * 2) throw new Error('ragged row');
      for (var x = 0; x < w; x++) {
        var a = rows[y][x * 2], b = rows[y][x * 2 + 1], i = y * w + x;
        if (a === 'W') { S.typ[i] = W; }
        else if (a !== '.') { S.typ[i] = TOKEN[a]; S.val[i] = +b; if (!S.typ[i] || !(S.val[i] >= 1 && S.val[i] <= 3)) throw new Error('bad cell ' + a + b); }
      }
    }
    return S;
  }
  function serialize(S) {
    var rows = [];
    for (var y = 0; y < S.h; y++) {
      var r = '';
      for (var x = 0; x < S.w; x++) { var i = y * S.w + x, t = S.typ[i]; r += t === 0 ? '..' : t === W ? 'W.' : LETTER[t] + S.val[i]; }
      rows.push(r);
    }
    return rows;
  }
  function key(S) { var s = ''; for (var i = 0; i < S.typ.length; i++) s += String.fromCharCode(48 + S.typ[i] * 4 + S.val[i]); return s; }
  function coresLeft(S) { var n = 0; for (var i = 0; i < S.typ.length; i++) { var t = S.typ[i]; if (t !== 0 && t !== W) n++; } return n; }
  function isWon(S) { return coresLeft(S) === 0; }
  function canTap(S, i) { var t = S.typ[i]; return t === N || t === D || t === L; }

  // Resolve all explosions. Mutates S. Returns {waves:[{boom:[{i,t}], shots:[{from,dx,dy,kind,hits,end}]}], exploded}.
  function resolve(S, record) {
    var w = S.w, h = S.h, n = w * h, waves = [], exploded = 0, guard = 0;
    while (guard++ < 300) {
      var boom = [], i;
      for (i = 0; i < n; i++) { var t = S.typ[i]; if ((t === N || t === D || t === L) && S.val[i] >= 4) boom.push(i); }
      if (!boom.length) break;
      var kinds = boom.map(function (j) { return S.typ[j]; });
      boom.forEach(function (j) { S.typ[j] = 0; S.val[j] = 0; });
      var inc = new Int8Array(n), shots = [];
      boom.forEach(function (j, bi) {
        var x = j % w, y = (j / w) | 0, kind = kinds[bi], dirs = kind === D ? DIAG : ORTHO, pierce = kind === L;
        for (var d = 0; d < 4; d++) {
          var dx = dirs[d][0], dy = dirs[d][1], cx = x + dx, cy = y + dy, hits = [], end = -1;
          while (cx >= 0 && cy >= 0 && cx < w && cy < h) {
            var k = cy * w + cx;
            if (S.typ[k] !== 0) {
              if (S.typ[k] === W) { end = k; break; }
              hits.push(k); inc[k]++; end = k;
              if (!pierce) break;
            }
            cx += dx; cy += dy;
          }
          if (record) shots.push({ from: j, dx: dx, dy: dy, kind: kind, hits: hits, end: end });
        }
      });
      for (i = 0; i < n; i++) if (inc[i]) { if (S.typ[i] === I) S.typ[i] = N; S.val[i] += inc[i]; }
      exploded += boom.length;
      if (record) waves.push({ boom: boom.map(function (j, bi) { return { i: j, t: kinds[bi] }; }), shots: shots, after: { typ: S.typ.slice(), val: S.val.slice() } });
    }
    return { waves: waves, exploded: exploded };
  }

  // Tap cell i. Mutates S. Returns {ok, waves, exploded, won}.
  function tap(S, i, record) {
    if (!canTap(S, i)) return { ok: false, waves: [], exploded: 0, won: isWon(S) };
    S.val[i]++;
    var r = resolve(S, record);
    return { ok: true, waves: r.waves, exploded: r.exploded, won: isWon(S) };
  }

  // ---------- solver (iterative deepening with memo) ----------
  // Returns {taps:[cellIndex...], nodes} for the shortest solution found within maxDepth/budget, else null.
  function solve(S0, maxDepth, budget) {
    budget = budget || 400000;
    var nodes = 0, aborted = false;
    for (var depth = 1; depth <= maxDepth; depth++) {
      var memo = {}, path = [];
      var found = (function dfs(S, rem) {
        if (aborted) return false;
        var k = key(S), m = memo[k];
        if (m !== undefined && m >= rem) return false;
        memo[k] = rem;
        var cand = [], i;
        for (i = 0; i < S.typ.length; i++) if (canTap(S, i)) cand.push(i);
        cand.sort(function (a, b) { return S.val[b] - S.val[a]; });
        for (var c = 0; c < cand.length; c++) {
          if (++nodes > budget) { aborted = true; return false; }
          var T = clone(S); tap(T, cand[c], false); path.push(cand[c]);
          if (isWon(T)) return true;
          if (rem > 1 && dfs(T, rem - 1)) return true;
          path.pop();
        }
        return false;
      })(S0, depth);
      if (found) return { taps: path.slice(), nodes: nodes, minimal: true };
      if (aborted) return null;
    }
    return null;
  }

  // Next tap suggestion for the current board. Returns cell index or -1.
  function hintTap(S, remaining) {
    if (isWon(S)) return -1;
    var r = solve(S, Math.max(1, remaining), 350000);
    return r ? r.taps[0] : -1;
  }

  function starsFor(par, taps) { return taps <= par ? 3 : taps <= par + 1 ? 2 : 1; }

  // ---------- Overload (endless) mode ----------
  function endlessNew(seed) {
    var rng = mulberry32(seed), w = 7, h = 9, S = make(w, h);
    var E = { S: S, rng: rng, taps: 0, pushes: 0, score: 0, over: false, bestCombo: 0, cleared: 0 };
    for (var r = 0; r < 3; r++) pushRow(E, true);
    return E;
  }
  function randomCell(E, S, i) {
    var rng = E.rng, p = rng(), lvl = Math.min(1, E.pushes / 40);
    S.typ[i] = p < .04 + .06 * lvl ? D : p < .07 + .08 * lvl ? L : p < .1 + .1 * lvl ? I : N;
    S.val[i] = 1 + Math.floor(rng() * 3);
  }
  // Shift everything up and add a fresh bottom row. Returns false if a core was pushed off the top (game over).
  function pushRow(E, free) {
    var S = E.S, w = S.w, h = S.h, i;
    if (!free) for (i = 0; i < w; i++) if (S.typ[i] !== 0) { E.over = true; return false; }
    for (i = 0; i < w * (h - 1); i++) { S.typ[i] = S.typ[i + w]; S.val[i] = S.val[i + w]; }
    for (i = w * (h - 1); i < w * h; i++) { S.typ[i] = 0; S.val[i] = 0; if (E.rng() < .62) randomCell(E, S, i); }
    E.pushes++;
    return true;
  }
  // One player tap in Overload. Returns {ok, waves, exploded, gained, pushed, over}.
  function endlessTap(E, i, record) {
    if (E.over) return { ok: false, over: true, waves: [], exploded: 0, gained: 0 };
    var r = tap(E.S, i, record);
    if (!r.ok) return r;
    var depth = r.waves.length || (r.exploded ? 1 : 0), gained = r.exploded * 10 * Math.max(1, Math.ceil(depth / 2));
    if (!record) { /* depth unknown without waves: approximate by count */ gained = r.exploded * 10; }
    E.score += gained; E.cleared += r.exploded; E.taps++;
    if (r.exploded > E.bestCombo) E.bestCombo = r.exploded;
    var every = E.pushes > 24 ? 1 : 2, pushed = false;
    if (E.taps % every === 0) { pushed = true; pushRow(E, false); }
    // a totally cleared board earns a bonus and a fresh row
    if (!E.over && coresLeft(E.S) === 0) { E.score += 100; pushRow(E, true); pushRow(E, true); }
    r.gained = gained; r.pushed = pushed; r.over = E.over;
    return r;
  }

  return {
    N: N, D: D, L: L, W: W, I: I, mulberry32: mulberry32, make: make, clone: clone, parse: parse, serialize: serialize, key: key,
    coresLeft: coresLeft, isWon: isWon, canTap: canTap, resolve: resolve, tap: tap, solve: solve, hintTap: hintTap, starsFor: starsFor,
    endlessNew: endlessNew, endlessTap: endlessTap, pushRow: pushRow
  };
});
