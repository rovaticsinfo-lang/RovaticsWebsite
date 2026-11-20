/* Gravity Bot engine: orbital physics, level generator, hints. No DOM.
   Browser: window.GravityBotEngine   Node: module.exports

   World: 1000 x 600 units. A probe is launched from level.start with velocity v (units/step).
   Bodies pull (or push) the probe:  a = M * d / (|d|^2 + eps)^1.5
     'p' planet   - crash on contact          'm' moon (small planet)
     's' sun      - big & heavy, crash        'h' black hole - very heavy, tiny kill zone
     'r' repulsor - pushes the probe away (negative mass), harmless
   Bodies with .mv = {ax,ay,bx,by,period,phase} slide back and forth along a line.
   The simulation only uses + - * / and sqrt (no trig), so every JS engine produces identical trajectories. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GravityBotEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var W = 1000, H = 600, G = 2.2, EPS = 900, PR = 5, GOAL_R = 28, ORB_R = 15, SUB = 2, MAXSTEPS = 900, VMAX = 12;
  var MARGIN = 160;
  var MASS = { p: 1, m: 1, s: 1.15, h: 3.2, r: -1.1 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function bodyMass(b) { return G * b.r * b.r * MASS[b.t]; }
  function killRadius(b) { return b.t === 'h' ? b.r * .5 : b.t === 'r' ? -1 : b.r; }

  // position of body b at time t (in steps). Movers use a smoothed triangle wave (no trig).
  function bodyPos(b, t) {
    if (!b.mv) return { x: b.x, y: b.y };
    var m = b.mv, s = (t / m.period + m.phase) % 1; if (s < 0) s += 1;
    var tri = s < .5 ? s * 2 : 2 - s * 2, e = tri * tri * (3 - 2 * tri);
    return { x: m.ax + (m.bx - m.ax) * e, y: m.ay + (m.by - m.ay) * e };
  }

  // Simulate one launch. v = {vx,vy}. opts: {maxSteps, goal:true/false}.
  // Returns {points:[x0,y0,x1,y1,...], result:'goal'|'crash'|'lost'|'timeout', steps, orbs:[{i,step}], crashBody}.
  function simulate(L, v, opts) {
    opts = opts || {};
    var maxSteps = Math.min(opts.maxSteps || MAXSTEPS, MAXSTEPS), useGoal = opts.goal !== false && !!L.goal;
    var x = L.start.x, y = L.start.y, vx = v.vx, vy = v.vy, pts = [x, y], got = {}, orbs = [], result = 'timeout', step = 0, crashBody = -1;
    var n = L.bodies.length, dt = 1 / SUB;
    outer:
    for (step = 1; step <= maxSteps; step++) {
      for (var sub = 0; sub < SUB; sub++) {
        var t = step - 1 + sub * dt, ax = 0, ay = 0;
        for (var i = 0; i < n; i++) {
          var b = L.bodies[i], p = bodyPos(b, t), dx = p.x - x, dy = p.y - y, d2 = dx * dx + dy * dy + EPS, k = bodyMass(b) / (d2 * Math.sqrt(d2));
          ax += dx * k; ay += dy * k;
        }
        vx += ax * dt; vy += ay * dt; x += vx * dt; y += vy * dt;
        var tt = step - 1 + (sub + 1) * dt;
        for (i = 0; i < n; i++) {
          b = L.bodies[i]; var kr = killRadius(b); if (kr < 0) continue;
          p = bodyPos(b, tt); dx = p.x - x; dy = p.y - y;
          if (dx * dx + dy * dy < (kr + PR) * (kr + PR)) { result = 'crash'; crashBody = i; break outer; }
        }
        for (var o = 0; o < L.orbs.length; o++) {
          if (got[o]) continue; dx = L.orbs[o].x - x; dy = L.orbs[o].y - y;
          if (dx * dx + dy * dy < (ORB_R + PR) * (ORB_R + PR)) { got[o] = 1; orbs.push({ i: o, step: step }); }
        }
        if (useGoal) { dx = L.goal.x - x; dy = L.goal.y - y; if (dx * dx + dy * dy < GOAL_R * GOAL_R) { result = 'goal'; pts.push(x, y); break outer; } }
        if (x < -MARGIN || x > W + MARGIN || y < -MARGIN || y > H + MARGIN) { result = 'lost'; pts.push(x, y); break outer; }
      }
      pts.push(x, y);
    }
    return { points: pts, result: result, steps: Math.min(step, maxSteps), orbs: orbs, crashBody: crashBody };
  }

  // Turn a drag (pull-back vector from the probe) into a launch velocity.
  function dragToVelocity(dx, dy, maxDrag) {
    maxDrag = maxDrag || 150;
    var len = Math.sqrt(dx * dx + dy * dy); if (len < 1e-9) return { vx: 0, vy: 0, power: 0 };
    var cl = Math.min(len, maxDrag), power = cl / maxDrag, speed = power * VMAX;
    return { vx: dx / len * speed, vy: dy / len * speed, power: power };
  }

  // ---------------- generator ----------------
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function between(rng, a, b) { return a + rng() * (b - a); }

  var BODY_R = { p: [26, 48], m: [16, 26], s: [58, 78], h: [26, 34], r: [26, 38] };

  function placeBodies(cfg, rng) {
    var bodies = [], types = cfg.types.slice(), start = null;
    var tries = 0;
    while (bodies.length < cfg.bodies && tries++ < 400) {
      var t = bodies.length < types.length ? types[bodies.length] : types[Math.floor(rng() * types.length)];
      var r = between(rng, BODY_R[t][0], BODY_R[t][1]), x = between(rng, 250, 900), y = between(rng, 70, 530), ok = true;
      if (dist(x, y, 100, 300) < r + 150) continue;
      for (var i = 0; i < bodies.length; i++) if (dist(x, y, bodies[i].x, bodies[i].y) < r + bodies[i].r + 70) { ok = false; break; }
      if (ok) bodies.push({ t: t, x: Math.round(x), y: Math.round(y), r: Math.round(r), hue: Math.floor(rng() * 360) });
    }
    return bodies;
  }

  function makeMovers(L, cfg, rng) {
    var cand = L.bodies.filter(function (b) { return b.t === 'p' || b.t === 'm' || b.t === 'r'; }), made = 0;
    for (var i = 0; i < cand.length && made < (cfg.movers || 0); i++) {
      var b = cand[i], vert = rng() < .6, amp = between(rng, 50, 90);
      var ax = vert ? b.x : Math.max(250, b.x - amp), bx = vert ? b.x : Math.min(900, b.x + amp);
      var ay = vert ? Math.max(70, b.y - amp) : b.y, by = vert ? Math.min(530, b.y + amp) : b.y;
      b.mv = { ax: Math.round(ax), ay: Math.round(ay), bx: Math.round(bx), by: Math.round(by), period: Math.round(between(rng, 260, 420)), phase: Math.round(rng() * 100) / 100 };
      made++;
    }
  }

  function tryBuild(cfg, rng) {
    var L = { w: W, h: H, start: { x: Math.round(between(rng, 70, 130)), y: Math.round(between(rng, 140, 460)) }, bodies: [], goal: null, orbs: [], preview: cfg.preview, solution: null };
    L.bodies = placeBodies(cfg, rng);
    if (L.bodies.length < cfg.bodies) return null;
    // must contain every required type
    for (var q = 0; q < cfg.types.length; q++) if (!L.bodies.some(function (b) { return b.t === cfg.types[q]; })) return null;
    makeMovers(L, cfg, rng);
    for (var shot = 0; shot < 40; shot++) {
      var tx = between(rng, 300, 950), ty = between(rng, 40, 560), ang = dist(tx, ty, L.start.x, L.start.y), sp = between(rng, 4.2, 9.5);
      var v = { vx: (tx - L.start.x) / ang * sp, vy: (ty - L.start.y) / ang * sp };
      var sim = simulate(L, v, { goal: false, maxSteps: 620 });
      if (sim.result === 'crash' || sim.steps < 190) continue;
      var pts = sim.points, total = pts.length / 2 - 1, s = Math.floor(between(rng, 130, total - 20));
      var gx = pts[s * 2], gy = pts[s * 2 + 1];
      if (gx < 340 || gx > 960 || gy < 40 || gy > 560 || dist(gx, gy, L.start.x, L.start.y) < 320) continue;
      // goal must be clear of every body for the whole motion
      var clear = true;
      for (var i = 0; i < L.bodies.length && clear; i++) {
        var b = L.bodies[i], rr = b.r + GOAL_R + 16;
        if (b.mv) { for (var tt = 0; tt < 1500; tt += 25) { var pp = bodyPos(b, tt); if (dist(pp.x, pp.y, gx, gy) < rr) { clear = false; break; } } }
        else if (dist(b.x, b.y, gx, gy) < rr) clear = false;
      }
      if (!clear) continue;
      // the shot must need gravity: path bows away from the straight chord
      var dev = 0, cdx = gx - L.start.x, cdy = gy - L.start.y, cl = Math.sqrt(cdx * cdx + cdy * cdy);
      for (var k = 0; k <= s; k += 4) { var px = pts[k * 2] - L.start.x, py = pts[k * 2 + 1] - L.start.y, cross = Math.abs(px * cdy - py * cdx) / cl; if (cross > dev) dev = cross; }
      if (dev < cfg.dev) continue;
      L.goal = { x: Math.round(gx * 10) / 10, y: Math.round(gy * 10) / 10 };
      // orbs on the path before the goal
      var orbs = [], guard = 0;
      while (orbs.length < cfg.orbs && guard++ < 80) {
        var os = Math.floor(between(rng, 50, s - 25)), ox = pts[os * 2], oy = pts[os * 2 + 1], good = dist(ox, oy, L.start.x, L.start.y) > 90 && dist(ox, oy, gx, gy) > 80;
        for (var j = 0; j < orbs.length; j++) if (dist(ox, oy, orbs[j].x, orbs[j].y) < 70) good = false;
        for (i = 0; i < L.bodies.length && good; i++) { var bb = L.bodies[i]; if (!bb.mv && dist(ox, oy, bb.x, bb.y) < bb.r + ORB_R + 12) good = false; }
        if (good) orbs.push({ x: Math.round(ox * 10) / 10, y: Math.round(oy * 10) / 10 });
      }
      if (orbs.length < cfg.orbs) continue;
      L.orbs = orbs;
      // the real solution: re-run with the goal active, must arrive & collect every orb
      var check = simulate(L, v, {});
      if (check.result !== 'goal' || check.orbs.length !== orbs.length) continue;
      // reject trivially easy levels: aiming straight at the goal must not already win (unless the world is a tutorial)
      if (!cfg.allowDirect) {
        var easy = false;
        for (var spd = 5; spd <= 11 && !easy; spd += 3) { var dv = { vx: cdx / cl * spd, vy: cdy / cl * spd }; if (simulate(L, dv, { maxSteps: 450 }).result === 'goal') easy = true; }
        if (easy) continue;
      }
      // robustness: nearby aims (about +-1.5 degrees, +-4% power) must still reach the station, so the shot is learnable
      var hits = 0, a0 = Math.atan2(v.vy, v.vx), sp0 = Math.sqrt(v.vx * v.vx + v.vy * v.vy);
      for (var ia = -1; ia <= 1; ia++) for (var ip = -1; ip <= 1; ip++) {
        var aa = a0 + ia * .026, pp2 = sp0 * (1 + ip * .04);
        if (simulate(L, { vx: Math.cos(aa) * pp2, vy: Math.sin(aa) * pp2 }, {}).result === 'goal') hits++;
      }
      if (hits < (cfg.robust || 5)) continue;
      L.solution = { vx: Math.round(v.vx * 1e6) / 1e6, vy: Math.round(v.vy * 1e6) / 1e6 };
      L.solutionSteps = check.steps;
      return L;
    }
    return null;
  }

  function generate(cfg, seed) {
    var rng = mulberry32(seed >>> 0);
    for (var a = 0; a < 300; a++) { var L = tryBuild(cfg, rng); if (L) { L.seed = seed; return L; } }
    throw new Error('could not generate gravity level for seed ' + seed);
  }

  // Re-run the stored solution after loading (JSON rounding safe): returns the sim result.
  function verify(L) { return simulate(L, L.solution, {}); }

  var WORLDS = [
    { name: 'Training Orbit', blurb: 'One planet, one station. Pull back to aim and let gravity bend your shot!', cfg: { types: ['p'], bodies: [1, 2], movers: [0, 0], preview: [500, 420], dev: [40, 70], orbs: [1, 2], allowDirect: true, robust: 8 } },
    { name: 'Twin Worlds', blurb: 'Two planets, two pulls. Use one to swing around the other.', cfg: { types: ['p', 'p'], bodies: [2, 3], movers: [0, 0], preview: [360, 280], dev: [70, 100], orbs: [2, 2], robust: 7 } },
    { name: 'Solar Slingshot', blurb: 'A giant sun! Its gravity is huge — skim past it to gain a curve.', cfg: { types: ['s', 'p'], bodies: [2, 4], movers: [0, 0], preview: [280, 220], dev: [90, 130], orbs: [2, 3] } },
    { name: 'Moving Targets', blurb: 'The planets drift back and forth. Timing is everything.', cfg: { types: ['p', 'p', 'm'], bodies: [3, 4], movers: [1, 3], preview: [240, 180], dev: [80, 120], orbs: [2, 3] } },
    { name: 'Repulsor Reef', blurb: 'Repulsors push you away. Bounce off their force fields!', cfg: { types: ['r', 'p'], bodies: [3, 5], movers: [0, 2], preview: [200, 150], dev: [80, 120], orbs: [2, 3] } },
    { name: 'Black Hole Alley', blurb: 'Deadly black holes with a monstrous pull. Fly casual.', cfg: { types: ['h', 'p', 'r'], bodies: [3, 5], movers: [0, 2], preview: [160, 90], dev: [90, 140], orbs: [3, 3] } }
  ];

  function lerp(a, b, f) { return a + (b - a) * f; }
  function levelConfig(world, li) {
    var w = WORLDS[world].cfg, f = li / 9;
    return {
      types: w.types, bodies: Math.round(lerp(w.bodies[0], w.bodies[1], f)), movers: Math.round(lerp(w.movers[0], w.movers[1], f)),
      preview: Math.round(lerp(w.preview[0], w.preview[1], f)), dev: lerp(w.dev[0], w.dev[1], f), orbs: Math.round(lerp(w.orbs[0], w.orbs[1], f)), allowDirect: !!w.allowDirect, robust: w.robust
    };
  }
  var cache = {};
  function levelSeed(n) { return 31000 + n * 211; }
  function getLevel(n) {
    if (n < 1 || n > 60) throw new RangeError('level out of range');
    if (cache[n]) return cache[n];
    var world = Math.floor((n - 1) / 10), li = (n - 1) % 10, cfg = levelConfig(world, li), L = null;
    for (var tryN = 0; tryN < 5 && !L; tryN++) {
      try { L = generate(cfg, levelSeed(n) + tryN * 17); } catch (e) { cfg.dev *= .85; cfg.robust = Math.max(3, (cfg.robust || 5) - 1); }
    }
    if (!L) throw new Error('level ' + n + ' failed to generate');
    L.world = world; L.index = n; return (cache[n] = L);
  }

  // Endless "Deep Space" mode: level k (1-based) of a run with the given seed.
  function endlessLevel(seed, k) {
    var rng = mulberry32((seed * 7919 + k * 104729) >>> 0), all = ['p', 'p', 'm', 's', 'r', 'h'];
    var nb = Math.min(6, 2 + Math.floor(k / 2)), types = [];
    if (k >= 3) types.push('s'); if (k >= 5) types.push('r'); if (k >= 7) types.push('h'); while (types.length < 2) types.push('p');
    var cfg = { types: types.slice(0, Math.min(types.length, nb)), bodies: nb, movers: k >= 4 ? Math.min(3, Math.floor(k / 3)) : 0, preview: Math.max(60, 340 - k * 18), dev: Math.min(140, 60 + k * 6), orbs: k >= 6 ? 3 : 2, allowDirect: k < 2 };
    for (var attempt = 0; attempt < 6; attempt++) {
      try { var L = generate(cfg, (rng() * 4294967295) >>> 0); L.endlessK = k; return L; } catch (e) { cfg.dev *= .8; cfg.bodies = Math.max(2, cfg.bodies - 1); cfg.types = cfg.types.slice(0, cfg.bodies); }
    }
    throw new Error('endless generation failed');
  }

  function starsFor(L, shotsUsed, orbsGot) {
    var s = 1; if (orbsGot >= L.orbs.length) s++; if (shotsUsed <= 2) s++; return s;
  }

  return {
    W: W, H: H, PR: PR, GOAL_R: GOAL_R, ORB_R: ORB_R, MAXSTEPS: MAXSTEPS, VMAX: VMAX, WORLDS: WORLDS,
    mulberry32: mulberry32, bodyPos: bodyPos, bodyMass: bodyMass, killRadius: killRadius, simulate: simulate, dragToVelocity: dragToVelocity,
    generate: generate, verify: verify, getLevel: getLevel, endlessLevel: endlessLevel, levelConfig: levelConfig, starsFor: starsFor
  };
});
