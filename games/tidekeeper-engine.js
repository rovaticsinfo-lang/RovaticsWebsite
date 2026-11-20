/* Tide Keeper engine: tide rules, creature movement, exhaustive solver. No DOM.
   Browser: window.TideKeeperEngine   Node: module.exports

   You are the Moon. The ONLY action each turn is: raise the tide (U), lower it (D) or wait (W).
   Everything else follows deterministic rules, so a breadth-first search over action strings finds
   the shortest solution for any level -- which is how every shipped level is verified and par is set.

   Terrain (one char per cell):  ' ' open   '#' rock (solid)   '=' sand (solid)
   The sea is a flat line: an open cell (x,y) holds water when y >= h - tide.

   Creatures (each has a home cell; once home they are safe and stop moving):
     f fish    - swims through water only; sinks with a falling sea; suffocates out of water
     d deer    - walks dry ground only (needs solid below, steps up/down 1); drowns if flooded
     t turtle  - amphibious: swims in water AND walks on land
     c crab    - walks on solid ground, happily submerged (never drowns)
     s seed    - no will of its own: floats to the surface, drifts with the current, and ROOTS
                 where it comes to rest on solid ground once the sea leaves it

   A level is won when every creature is home, and lost when one suffocates or drowns. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TideKeeperEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var OPEN = 0, ROCK = 1, SAND = 2;
  var BREATH = 4;                       // ticks a fish survives beached / a deer survives underwater
  var ACTIONS = ['U', 'D', 'W'];
  var NAMES = { f: 'fish', d: 'deer', t: 'turtle', c: 'crab', s: 'seed' };
  var HOMES = { f: 'reef', d: 'den', t: 'nest', c: 'burrow', s: 'soil' };
  var SWIM4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  var WALK = [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]];
  var AMPH = SWIM4.concat([[-1, -1], [-1, 1], [1, -1], [1, 1]]);

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- level ----------
  function parse(def) {
    var rows = def.rows, h = rows.length, w = rows[0].length, cells = new Int8Array(w * h);
    for (var y = 0; y < h; y++) {
      if (rows[y].length !== w) throw new Error('ragged terrain row ' + y);
      for (var x = 0; x < w; x++) {
        var c = rows[y][x];
        if (' #='.indexOf(c) < 0) throw new Error('bad terrain char ' + c);
        cells[y * w + x] = c === '#' ? ROCK : c === '=' ? SAND : OPEN;
      }
    }
    var L = { w: w, h: h, cells: cells, rows: rows.slice(), tideMax: def.tideMax, tide0: def.tide0,
      ents: def.ents.map(function (e) { return { t: e.t, x: e.x, y: e.y, hx: e.hx, hy: e.hy }; }),
      cur: def.cur || 0, moves: def.moves, par: def.par, solution: def.solution, world: def.world, index: def.index, _pf: {} };
    L.ents.forEach(function (e) { if (!NAMES[e.t]) throw new Error('unknown creature ' + e.t); });
    if (!(L.tideMax >= 1 && L.tideMax < h)) throw new Error('bad tideMax');
    if (!(L.tide0 >= 0 && L.tide0 <= L.tideMax)) throw new Error('bad tide0');
    return L;
  }
  function at(L, x, y) { return x < 0 || y < 0 || x >= L.w || y >= L.h ? ROCK : L.cells[y * L.w + x]; }
  function solid(L, x, y) { return at(L, x, y) !== OPEN; }
  function surfaceRow(L, tide) { return L.h - tide; }      // first flooded row (h when the tide is 0)
  function wet(L, tide, x, y) { return x >= 0 && y >= 0 && x < L.w && y < L.h && !solid(L, x, y) && y >= L.h - tide; }
  function grounded(L, x, y) { return !solid(L, x, y) && (solid(L, x, y + 1) || y + 1 >= L.h); }

  // Where a creature may BE. Symmetric by design, so one backwards search gives every distance.
  function canOccupy(L, tide, type, x, y) {
    if (x < 0 || y < 0 || x >= L.w || y >= L.h || solid(L, x, y)) return false;
    var w8 = wet(L, tide, x, y);
    if (type === 'f') return w8;
    if (type === 'd') return !w8 && grounded(L, x, y);
    if (type === 'c') return grounded(L, x, y);
    if (type === 't') return w8 || grounded(L, x, y);
    return false;
  }
  function offsets(type) { return type === 'f' ? SWIM4 : type === 't' ? AMPH : WALK; }

  // Memoised distance field: distance from (hx,hy) to every cell, for this tide and creature type.
  function pathField(L, tide, type, hx, hy) {
    var k = tide + type + hx + ',' + hy, pf = L._pf[k];
    if (pf) return pf;
    var w = L.w, n = w * L.h, dist = new Int32Array(n).fill(-1), offs = offsets(type);
    if (canOccupy(L, tide, type, hx, hy)) {
      var q = [hy * w + hx]; dist[q[0]] = 0;
      for (var qi = 0; qi < q.length; qi++) {
        var ci = q[qi], cx = ci % w, cy = (ci / w) | 0, d = dist[ci];
        for (var i = 0; i < offs.length; i++) {
          var nx = cx + offs[i][0], ny = cy + offs[i][1];
          if (nx < 0 || ny < 0 || nx >= w || ny >= L.h) continue;
          var ni = ny * w + nx;
          if (dist[ni] >= 0 || !canOccupy(L, tide, type, nx, ny)) continue;
          dist[ni] = d + 1; q.push(ni);
        }
      }
    }
    L._pf[k] = dist; return dist;
  }
  // One step from (x,y) toward (hx,hy), or null when there is no route.
  function stepToward(L, tide, type, x, y, hx, hy) {
    if (x === hx && y === hy) return null;
    var dist = pathField(L, tide, type, hx, hy), w = L.w, here = dist[y * w + x];
    if (here < 0) return null;                       // the creature is stranded off the network
    var offs = offsets(type);
    for (var i = 0; i < offs.length; i++) {
      var nx = x + offs[i][0], ny = y + offs[i][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= L.h) continue;
      var d = dist[ny * w + nx];
      if (d >= 0 && d === here - 1) return [nx, ny];
    }
    return null;
  }

  // ---------- state ----------
  function initial(L) { return { tide: L.tide0, ents: L.ents.map(function (e) { return { x: e.x, y: e.y, b: 0, done: false }; }), dead: false, moves: 0 }; }
  function cloneState(S) { return { tide: S.tide, ents: S.ents.map(function (e) { return { x: e.x, y: e.y, b: e.b, done: e.done }; }), dead: S.dead, moves: S.moves }; }
  function key(S) {
    var s = S.tide + '|';
    for (var i = 0; i < S.ents.length; i++) { var e = S.ents[i]; s += e.x + ',' + e.y + ',' + e.b + (e.done ? 'H' : '') + ';'; }
    return s;
  }
  function isWin(S) { return !S.dead && S.ents.every(function (e) { return e.done; }); }

  // ---------- one turn ----------
  // action: 'U' | 'D' | 'W'. Returns a NEW state; `events` (optional) collects what happened, for the UI.
  function step(L, S, action, events) {
    var T = cloneState(S), i, e, def, ev = events || [];
    if (T.dead || isWin(T)) return T;
    T.moves++;
    if (action === 'U') { if (T.tide < L.tideMax) { T.tide++; ev.push({ k: 'tide', dir: 1 }); } }
    else if (action === 'D') { if (T.tide > 0) { T.tide--; ev.push({ k: 'tide', dir: -1 }); } }

    for (i = 0; i < T.ents.length; i++) {
      e = T.ents[i]; def = L.ents[i];
      if (e.done) continue;

      if (def.t === 's') {                                        // a seed has no will: float, drift, root
        if (wet(L, T.tide, e.x, e.y)) {
          var sr = surfaceRow(L, T.tide);
          while (e.y > sr && !solid(L, e.x, e.y - 1)) e.y--;        // rise with the sea
          while (e.y < sr && !solid(L, e.x, e.y + 1) && e.y + 1 < L.h) e.y++;
          if (L.cur !== 0 && !solid(L, e.x + L.cur, e.y)) { e.x += L.cur; ev.push({ k: 'drift', i: i }); }
        } else {
          while (!solid(L, e.x, e.y + 1) && e.y + 1 < L.h) e.y++;   // sink to the ground
          if (e.x === def.hx && e.y === def.hy) { e.done = true; ev.push({ k: 'root', i: i }); }
        }
        continue;
      }

      if (def.t === 'f') {                                        // a fish settles with a falling sea
        while (!wet(L, T.tide, e.x, e.y) && !solid(L, e.x, e.y + 1) && e.y + 1 < L.h) e.y++;
      }
      var nxt = stepToward(L, T.tide, def.t, e.x, e.y, def.hx, def.hy);
      if (nxt) { e.x = nxt[0]; e.y = nxt[1]; ev.push({ k: 'move', i: i }); }
      // A turtle only nests on DRY sand: float in on a high sea, then let it fall to settle.
      if (e.x === def.hx && e.y === def.hy && !(def.t === 't' && wet(L, T.tide, e.x, e.y))) {
        e.done = true; e.b = 0; ev.push({ k: 'home', i: i }); continue;
      }

      var safe = true;                                            // breathing
      if (def.t === 'f') safe = wet(L, T.tide, e.x, e.y);
      else if (def.t === 'd') safe = !wet(L, T.tide, e.x, e.y);
      if (safe) { if (e.b) ev.push({ k: 'relief', i: i }); e.b = 0; }
      else {
        e.b++; ev.push({ k: 'gasp', i: i, b: e.b });
        if (e.b >= BREATH) { T.dead = true; ev.push({ k: 'dead', i: i, why: def.t === 'f' ? 'beached' : 'drowned' }); }
      }
    }
    return T;
  }

  // ---------- exhaustive solver ----------
  // searchFrom: optional live state (used by the hint button). Returns {solution, moves, nodes} or null.
  function solve(L, maxMoves, budget, searchFrom) {
    maxMoves = maxMoves || 40; budget = budget || 400000;
    var start = searchFrom ? cloneState(searchFrom) : initial(L);
    start.moves = 0;
    if (start.dead) return null;
    if (isWin(start)) return { solution: '', moves: 0, nodes: 0 };
    var seen = {}, q = [{ s: start, a: '' }], nodes = 0;
    seen[key(start)] = 1;
    for (var qi = 0; qi < q.length; qi++) {
      var cur = q[qi];
      if (cur.a.length >= maxMoves) continue;
      for (var ai = 0; ai < 3; ai++) {
        if (++nodes > budget) return null;
        var ns = step(L, cur.s, ACTIONS[ai]);
        if (ns.dead) continue;
        var k = key(ns);
        if (seen[k]) continue;
        seen[k] = 1;
        var act = cur.a + ACTIONS[ai];
        if (isWin(ns)) return { solution: act, moves: act.length, nodes: nodes };
        q.push({ s: ns, a: act });
      }
    }
    return null;
  }
  function replay(L, actions) {
    var S = initial(L), states = [S];
    for (var i = 0; i < actions.length && !S.dead && !isWin(S); i++) { S = step(L, S, actions[i]); states.push(S); }
    return { win: isWin(S), dead: S.dead, moves: S.moves, state: S, states: states };
  }
  // Best next move from a live state, or null when the position is already lost.
  function hint(L, S, maxMoves) {
    var r = solve(L, maxMoves || 26, 150000, S);
    return r && r.solution ? r.solution[0] : null;
  }

  function starsFor(L, movesUsed) { return movesUsed <= L.par ? 3 : movesUsed <= L.par + 3 ? 2 : 1; }
  function scoreFor(L, movesUsed, rescued) {
    var parts = [{ t: 'Every creature home', pts: 1000 }];
    parts.push({ t: 'Creatures guided (' + L.ents.length + ')', pts: L.ents.length * 200 });
    if (movesUsed <= L.par) parts.push({ t: 'Perfect tide (par ' + L.par + ')', pts: 500 });
    else if (movesUsed <= L.par + 3) parts.push({ t: 'Tides to spare', pts: 200 });
    if (rescued) parts.push({ t: 'Last-breath rescue x' + rescued, pts: rescued * 150 });
    var total = 0; parts.forEach(function (p) { total += p.pts; });
    return { total: total, parts: parts };
  }
  var RANKS = [['Tide Watcher', 0], ['Moonling', 12], ['Shore Keeper', 35], ['Wave Caller', 70], ['Deep Warden', 120], ['Moon Guardian', 190], ['Ocean Spirit', 265]];
  function rankFor(stars) { var r = 0; for (var i = 0; i < RANKS.length; i++) if (stars >= RANKS[i][1]) r = i; return { index: r, name: RANKS[r][0], from: RANKS[r][1], next: r + 1 < RANKS.length ? RANKS[r + 1] : null }; }

  var WORLDS = [
    { name: 'Mangrove Shallows', blurb: 'Drag the moon to pull the sea. A fish can only swim where there is water.' },
    { name: 'Fern Hollow', blurb: 'Deer walk dry ground only — lower the sea to open a path, but never flood them.' },
    { name: 'Where Two Worlds Meet', blurb: 'The fish needs a high sea, the deer needs a low one. You cannot please both at once.' },
    { name: 'Turtle Beach', blurb: 'Turtles swim and walk. Ride the sea in, then cross the sand home.' },
    { name: 'Crab Cove', blurb: 'Crabs scuttle happily underwater — let them carry on while you mind the others.' },
    { name: 'Drifting Seeds', blurb: 'A seed has no will. It floats, drifts on the current, and roots where the sea leaves it.' },
    { name: 'Tangled Roots', blurb: 'Narrow channels and high ridges. Every single tide counts.' },
    { name: 'Storm Surge', blurb: 'A wild sea with a long reach. Big tides, bigger consequences.' },
    { name: 'The Deep Hollows', blurb: 'Pools, overhangs and three lives in your hands at once.' },
    { name: "The Moon's Garden", blurb: 'Everything you have learned, under one full moon.' }
  ];

  return {
    OPEN: OPEN, ROCK: ROCK, SAND: SAND, BREATH: BREATH, ACTIONS: ACTIONS, NAMES: NAMES, HOMES: HOMES, WORLDS: WORLDS, RANKS: RANKS,
    mulberry32: mulberry32, parse: parse, at: at, solid: solid, wet: wet, grounded: grounded, surfaceRow: surfaceRow,
    canOccupy: canOccupy, pathField: pathField, stepToward: stepToward,
    initial: initial, cloneState: cloneState, key: key, isWin: isWin,
    step: step, solve: solve, replay: replay, hint: hint, starsFor: starsFor, scoreFor: scoreFor, rankFor: rankFor
  };
});
