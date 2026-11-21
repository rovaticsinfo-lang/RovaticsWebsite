/* Gravity Bot engine: orbital physics, flight stepping, level generator, hints. No DOM.
   Browser: window.GravityBotEngine   Node: module.exports

   World: 1000 x 600 units. A probe is launched from level.start with velocity v (units/step).
   Bodies pull (or push) the probe:  a = M * d / (|d|^2 + eps)^1.5
     'p' planet   - crash on contact          'm' moon (small planet)
     's' sun      - big & heavy, crash        'h' black hole - very heavy, small kill zone
     'r' repulsor - pushes the probe away (negative mass), harmless
     'a' asteroid - no gravity, but crashes you
   Bodies move: mv = {k:'line', ax,ay,bx,by,period,phase}  or  mv = {k:'orbit', cx,cy,R,period,phase,dir}
   Warp portals: level.portals = [{ax,ay,bx,by}] - entering one end exits the other with the same velocity.
   The four walls are MIRRORS: the probe bounces off them (angle in = angle out) up to MAX_BOUNCES times, so a goal can be hit
   directly or with a bank shot. Thrust steering still exists in the engine but the game no longer uses it: flights are fully
   deterministic. The simulation uses only + - * / and sqrt (own sin/cos), so every JS engine gives identical results. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GravityBotEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var W = 1000, H = 600, G = 2.2, EPS = 900, PR = 9, GOAL_R = 30, ORB_R = 16, SUB = 2, MAXSTEPS = 900, VMAX = 12;
  var MARGIN = 160, FUEL = 90, THRUST = .06, PORTAL_R = 24, PORTAL_COOLDOWN = 24, MAX_BOUNCES = 6;
  var MASS = { p: 1, m: 1, s: 1.15, h: 3.2, r: -1.1, a: 0 };
  var TWO_PI = 6.283185307179586, HALF_PI = 1.5707963267948966, PI = 3.141592653589793;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Deterministic sine (polynomial, accurate to ~1e-8): same value in every JS engine.
  function sinD(x) {
    x = x - TWO_PI * Math.floor(x / TWO_PI + .5);
    if (x > HALF_PI) x = PI - x; else if (x < -HALF_PI) x = -PI - x;
    var x2 = x * x;
    return x * (1 - x2 / 6 * (1 - x2 / 20 * (1 - x2 / 42 * (1 - x2 / 72 * (1 - x2 / 110 * (1 - x2 / 156))))));
  }
  function cosD(x) { return sinD(x + HALF_PI); }

  function bodyMass(b) { return G * b.r * b.r * MASS[b.t]; }
  function killRadius(b) { return b.t === 'h' ? b.r * .5 : b.t === 'r' ? -1 : b.r; }

  // position of body b at time t (in steps).
  function bodyPos(b, t) {
    var m = b.mv; if (!m) return { x: b.x, y: b.y };
    if (m.k === 'orbit') { var a = TWO_PI * ((m.dir || 1) * t / m.period + m.phase); return { x: m.cx + m.R * cosD(a), y: m.cy + m.R * sinD(a) }; }
    var s = (t / m.period + m.phase) % 1; if (s < 0) s += 1;
    var tri = s < .5 ? s * 2 : 2 - s * 2, e = tri * tri * (3 - 2 * tri);
    return { x: m.ax + (m.bx - m.ax) * e, y: m.ay + (m.by - m.ay) * e };
  }

  // ---------- flight (one launch, stepped one time-step at a time) ----------
  function createFlight(L, v) {
    return { L: L, x: L.start.x, y: L.start.y, vx: v.vx, vy: v.vy, step: 0, cd: 0, got: {}, orbs: [], pts: [L.start.x, L.start.y], jumps: [], warps: [],
      result: null, crashBody: -1, fuel: FUEL, thrustUsed: 0, minClear: 1e9, goalDist: -1, bounces: 0, bumps: [] };
  }
  // thrust: null or {x,y} world point to steer towards. Returns F (F.result set when the flight ended).
  function stepFlight(F, thrust) {
    if (F.result) return F;
    var L = F.L, n = L.bodies.length, dt = 1 / SUB, i, dx, dy, b, p;
    F.step++;
    var useThrust = thrust && F.fuel > 0;
    if (useThrust) { F.fuel -= 1; F.thrustUsed++; }
    for (var sub = 0; sub < SUB; sub++) {
      var t = F.step - 1 + sub * dt, ax = 0, ay = 0;
      for (i = 0; i < n; i++) {
        b = L.bodies[i]; var m = bodyMass(b); if (!m) continue;
        p = bodyPos(b, t); dx = p.x - F.x; dy = p.y - F.y; var d2 = dx * dx + dy * dy + EPS, k = m / (d2 * Math.sqrt(d2));
        ax += dx * k; ay += dy * k;
      }
      if (useThrust) { dx = thrust.x - F.x; dy = thrust.y - F.y; var dl = Math.sqrt(dx * dx + dy * dy); if (dl > 1e-6) { ax += dx / dl * THRUST; ay += dy / dl * THRUST; } }
      F.vx += ax * dt; F.vy += ay * dt; F.x += F.vx * dt; F.y += F.vy * dt;
      var tt = F.step - 1 + (sub + 1) * dt;
      for (i = 0; i < n; i++) {
        b = L.bodies[i]; var kr = killRadius(b); p = bodyPos(b, tt); dx = p.x - F.x; dy = p.y - F.y;
        var dd = Math.sqrt(dx * dx + dy * dy);
        if (kr >= 0) {
          var clear = dd - kr - PR; if (clear < F.minClear) F.minClear = clear;
          if (clear < 0) { F.result = 'crash'; F.crashBody = i; F.pts.push(F.x, F.y); return F; }
        }
      }
      for (var o = 0; o < L.orbs.length; o++) {
        if (F.got[o]) continue; dx = L.orbs[o].x - F.x; dy = L.orbs[o].y - F.y;
        if (dx * dx + dy * dy < (ORB_R + PR) * (ORB_R + PR)) { F.got[o] = 1; F.orbs.push({ i: o, step: F.step }); }
      }
      if (L.portals && F.cd <= 0) {
        for (i = 0; i < L.portals.length; i++) {
          var po = L.portals[i], da = (po.ax - F.x) * (po.ax - F.x) + (po.ay - F.y) * (po.ay - F.y), db = (po.bx - F.x) * (po.bx - F.x) + (po.by - F.y) * (po.by - F.y), r2 = PORTAL_R * PORTAL_R;
          if (da < r2) { F.warps.push({ step: F.step, from: { x: po.ax, y: po.ay }, to: { x: po.bx, y: po.by } }); F.x = po.bx; F.y = po.by; F.cd = PORTAL_COOLDOWN; F.jumps.push(F.pts.length / 2); break; }
          if (db < r2) { F.warps.push({ step: F.step, from: { x: po.bx, y: po.by }, to: { x: po.ax, y: po.ay } }); F.x = po.ax; F.y = po.ay; F.cd = PORTAL_COOLDOWN; F.jumps.push(F.pts.length / 2); break; }
        }
      }
      if (L.goal) { dx = L.goal.x - F.x; dy = L.goal.y - F.y; if (dx * dx + dy * dy < GOAL_R * GOAL_R) { F.result = 'goal'; F.goalDist = Math.sqrt(dx * dx + dy * dy); F.pts.push(F.x, F.y); return F; } }
      if (L.walls === false) {
        if (F.x < -MARGIN || F.x > W + MARGIN || F.y < -MARGIN || F.y > H + MARGIN) { F.result = 'lost'; F.pts.push(F.x, F.y); return F; }
      } else {
        var wall = 0;   // mirror walls: reflect the position and flip the speed component (angle in = angle out)
        if (F.x < PR) { F.x = 2 * PR - F.x; F.vx = Math.abs(F.vx); wall = 1; } else if (F.x > W - PR) { F.x = 2 * (W - PR) - F.x; F.vx = -Math.abs(F.vx); wall = 1; }
        if (F.y < PR) { F.y = 2 * PR - F.y; F.vy = Math.abs(F.vy); wall = 1; } else if (F.y > H - PR) { F.y = 2 * (H - PR) - F.y; F.vy = -Math.abs(F.vy); wall = 1; }
        if (wall) { F.bounces++; F.bumps.push({ step: F.step, x: F.x, y: F.y }); if (F.bounces > MAX_BOUNCES) { F.result = 'lost'; F.pts.push(F.x, F.y); return F; } }
      }
    }
    if (F.cd > 0) F.cd--;
    F.pts.push(F.x, F.y);
    if (F.step >= MAXSTEPS) F.result = 'timeout';
    return F;
  }

  // Simulate a whole launch with no thrust. opts: {maxSteps, goal:true/false}.
  function simulate(L, v, opts) {
    opts = opts || {};
    var maxSteps = Math.min(opts.maxSteps || MAXSTEPS, MAXSTEPS), useGoal = opts.goal !== false && !!L.goal, F = createFlight(L, v);
    if (!useGoal) F.L = { start: L.start, bodies: L.bodies, goal: null, orbs: L.orbs, portals: L.portals, walls: L.walls };
    while (!F.result && F.step < maxSteps) stepFlight(F, null);
    return { points: F.pts, result: F.result || 'timeout', steps: F.step, orbs: F.orbs, crashBody: F.crashBody, warps: F.warps, jumps: F.jumps, minClear: F.minClear, goalDist: F.goalDist, bounces: F.bounces, bumps: F.bumps };
  }

  // Turn a drag (pull-back vector from the probe) into a launch velocity.
  function dragToVelocity(dx, dy, maxDrag) {
    maxDrag = maxDrag || 150;
    var len = Math.sqrt(dx * dx + dy * dy); if (len < 1e-9) return { vx: 0, vy: 0, power: 0 };
    var cl = Math.min(len, maxDrag), power = cl / maxDrag, speed = power * VMAX;
    return { vx: dx / len * speed, vy: dy / len * speed, power: power };
  }

  // Angle (degrees, 0 = right, 90 = up, counter-clockwise) and power (0..1) <-> launch velocity. These are the numbers the player sees.
  function velocityFor(angleDeg, power) {
    var a = angleDeg * PI / 180, sp = Math.max(0, Math.min(1, power)) * VMAX;
    return { vx: Math.cos(a) * sp, vy: -Math.sin(a) * sp, power: Math.max(0, Math.min(1, power)) };
  }
  function aimReadout(v) {
    var sp = Math.sqrt(v.vx * v.vx + v.vy * v.vy), deg = Math.atan2(-v.vy, v.vx) * 180 / PI; if (deg < 0) deg += 360;
    return { angle: Math.round(deg * 10) / 10, power: Math.round(sp / VMAX * 100), speed: Math.round(sp * 100) / 100 };
  }
  // Light pulls score more: 0% pull = +1500, 100% pull = +0.
  function pullBonus(power) { return Math.round(1500 * (1 - Math.max(0, Math.min(1, power)))); }

  // ---------------- generator ----------------
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function between(rng, a, b) { return a + rng() * (b - a); }
  var BODY_R = { p: [28, 50], m: [18, 28], s: [58, 78], h: [26, 34], r: [26, 38], a: [11, 16] };

  function placeBodies(cfg, rng) {
    var bodies = [], types = cfg.types.slice(), tries = 0;
    while (bodies.length < cfg.bodies && tries++ < 500) {
      var t = bodies.length < types.length ? types[bodies.length] : types[Math.floor(rng() * types.length)];
      var r = between(rng, BODY_R[t][0], BODY_R[t][1]), x = between(rng, 250, 900), y = between(rng, 70, 530), ok = true;
      if (dist(x, y, 100, 300) < r + 160) continue;
      for (var i = 0; i < bodies.length; i++) if (dist(x, y, bodies[i].x, bodies[i].y) < r + bodies[i].r + (t === 'a' || bodies[i].t === 'a' ? 40 : 70)) { ok = false; break; }
      if (ok) bodies.push({ t: t, x: Math.round(x), y: Math.round(y), r: Math.round(r), hue: Math.floor(rng() * 360) });
    }
    return bodies;
  }

  // Give a share of the bodies a motion. Orbits circle a sun/black hole when one exists, otherwise a free point.
  function makeMovers(L, cfg, rng) {
    var cand = L.bodies.filter(function (b) { return b.t === 'p' || b.t === 'm' || b.t === 'r' || b.t === 'a'; }), made = 0;
    var anchors = L.bodies.filter(function (b) { return b.t === 's' || b.t === 'h'; });
    for (var i = 0; i < cand.length && made < (cfg.movers || 0); i++) {
      var b = cand[i], useOrbit = cfg.orbit && rng() < cfg.orbit, mv = null;
      if (b.t === 'a') {
        var a2 = cfg.amp ? between(rng, cfg.amp * .8, cfg.amp * 1.5) : between(rng, 80, 150), vert = rng() < .5;
        mv = { k: 'line', ax: vert ? b.x : b.x - a2, ay: vert ? b.y - a2 : b.y, bx: vert ? b.x : b.x + a2, by: vert ? b.y + a2 : b.y, period: Math.round(between(rng, 220, 380)), phase: Math.round(rng() * 100) / 100 };
      } else if (useOrbit) {
        var dir = rng() < .5 ? -1 : 1, an = anchors.length && rng() < .8 ? anchors[Math.floor(rng() * anchors.length)] : null, c, R;
        if (an) { c = { x: an.x, y: an.y }; R = dist(b.x, b.y, an.x, an.y); }
        else { R = cfg.amp ? between(rng, Math.max(20, cfg.amp * .6), Math.max(30, cfg.amp)) : between(rng, 55, 120); var ang0 = rng() * 6.283; c = { x: b.x - R * Math.cos(ang0), y: b.y - R * Math.sin(ang0) }; }
        var phase = Math.atan2(b.y - c.y, b.x - c.x) / 6.283185307179586; if (phase < 0) phase += 1;
        if (R <= 250 && R >= (cfg.amp ? 16 : 40) && c.x - R >= 170 && c.x + R <= 930 && c.y - R >= 50 && c.y + R <= 550) {
          var period = R > 140 ? between(rng, 900, 1500) : between(rng, 520, 900);
          mv = { k: 'orbit', cx: Math.round(c.x * 10) / 10, cy: Math.round(c.y * 10) / 10, R: Math.round(R * 10) / 10, period: Math.round(period), phase: Math.round(phase * 1e5) / 1e5, dir: dir };
        }
      }
      if (!mv) {
        var vert2 = rng() < .6, amp = cfg.amp ? between(rng, cfg.amp * .6, cfg.amp) : between(rng, 50, 95);
        mv = { k: 'line', ax: vert2 ? b.x : Math.max(250, b.x - amp), ay: vert2 ? Math.max(70, b.y - amp) : b.y, bx: vert2 ? b.x : Math.min(900, b.x + amp), by: vert2 ? Math.min(530, b.y + amp) : b.y, period: Math.round(between(rng, 260, 420)), phase: Math.round(rng() * 100) / 100 };
      }
      ['ax', 'ay', 'bx', 'by'].forEach(function (k) { if (mv[k] != null) mv[k] = Math.round(mv[k]); });
      b.mv = mv; made++;
    }
    // stars (suns) and black holes sway a little too, unless planets orbit them
    if (cfg.drift) L.bodies.forEach(function (b) {
      if (b.mv || (b.t !== 's' && b.t !== 'h')) return;
      if (L.bodies.some(function (o) { return o.mv && o.mv.k === 'orbit' && Math.abs(o.mv.cx - b.x) < 1 && Math.abs(o.mv.cy - b.y) < 1; })) return;
      var am = between(rng, (cfg.amp || 30) * .5, (cfg.amp || 30) * .8), vv = rng() < .5;
      b.mv = { k: 'line', ax: vv ? b.x : Math.round(Math.max(250, b.x - am)), ay: vv ? Math.round(Math.max(70, b.y - am)) : b.y, bx: vv ? b.x : Math.round(Math.min(900, b.x + am)), by: vv ? Math.round(Math.min(530, b.y + am)) : b.y, period: Math.round(between(rng, 420, 700)), phase: Math.round(rng() * 100) / 100 };
    });
  }

  function bodiesClearOfStart(L) {
    for (var i = 0; i < L.bodies.length; i++) {
      var b = L.bodies[i];
      for (var tt = 0; tt < 1500; tt += 20) { var p = bodyPos(b, tt); if (dist(p.x, p.y, L.start.x, L.start.y) < b.r + 90) return false; }
    }
    return true;
  }
  function pointClearOfBodies(L, x, y, pad) {
    for (var i = 0; i < L.bodies.length; i++) {
      var b = L.bodies[i], rr = b.r + pad;
      if (b.mv) { for (var tt = 0; tt < 1500; tt += 25) { var p = bodyPos(b, tt); if (dist(p.x, p.y, x, y) < rr) return false; } }
      else if (dist(b.x, b.y, x, y) < rr) return false;
    }
    return true;
  }

  // Portal entrance on the path of launch v, exit somewhere free: the flight then continues from the exit.
  function addPortals(L, rng, v0) {
    var sim = simulate(L, v0, { goal: false, maxSteps: 260 }); if (sim.result === 'crash' || sim.steps < 130) return null;
    var s = Math.floor(between(rng, 50, Math.min(150, sim.steps - 40))), ax = sim.points[s * 2], ay = sim.points[s * 2 + 1];
    if (ax < 190 || ax > 910 || ay < 70 || ay > 530 || dist(ax, ay, L.start.x, L.start.y) < 140) return null;
    for (var tries = 0; tries < 40; tries++) {
      var bx = between(rng, 330, 900), by = between(rng, 70, 530);
      if (dist(bx, by, ax, ay) > 220 && dist(bx, by, L.start.x, L.start.y) > 200 && pointClearOfBodies(L, bx, by, 90)) return [{ ax: Math.round(ax), ay: Math.round(ay), bx: Math.round(bx), by: Math.round(by) }];
    }
    return null;
  }

  function tryBuild(cfg, rng) {
    var L = { w: W, h: H, start: { x: Math.round(between(rng, 70, 130)), y: Math.round(between(rng, 140, 460)) }, bodies: [], goal: null, orbs: [], portals: [], preview: cfg.preview, solution: null };
    L.bodies = placeBodies(cfg, rng);
    if (L.bodies.length < cfg.bodies) return null;
    for (var q = 0; q < cfg.types.length; q++) if (!L.bodies.some(function (b) { return b.t === cfg.types[q]; })) return null;
    makeMovers(L, cfg, rng);
    if (!bodiesClearOfStart(L)) return null;
    var wantPortal = (cfg.portals || 0) > 0;
    for (var shot = 0; shot < 50; shot++) {
      var tx = between(rng, 300, 950), ty = between(rng, 40, 560), ang = dist(tx, ty, L.start.x, L.start.y), sp = between(rng, 4.2, 9.5);
      var v = { vx: (tx - L.start.x) / ang * sp, vy: (ty - L.start.y) / ang * sp };
      L.portals = [];
      if (wantPortal) { var pt = addPortals(L, rng, v); if (!pt) continue; L.portals = pt; }
      var sim = simulate(L, v, { goal: false, maxSteps: 620 });
      if (sim.steps < 190 || (sim.result === 'crash' && sim.steps < 240)) continue;   // a bouncing probe may hit something LATER; the goal is picked before that
      if (wantPortal && !sim.warps.length) continue;
      var pts = sim.points, total = pts.length / 2 - 1, lo = wantPortal ? Math.max(130, sim.warps[0].step + 50) : 130;
      if (total - 20 <= lo) continue;
      var s = Math.floor(between(rng, lo, total - 20)), gx = pts[s * 2], gy = pts[s * 2 + 1];
      if (gx < 340 || gx > 960 || gy < 40 || gy > 560) continue;
      if (!wantPortal && dist(gx, gy, L.start.x, L.start.y) < 320) continue;
      if (!pointClearOfBodies(L, gx, gy, GOAL_R + (cfg.gap || 16))) continue;
      var near = false; for (var pi = 0; pi < L.portals.length; pi++) { var po = L.portals[pi]; if (dist(po.ax, po.ay, gx, gy) < 70 || dist(po.bx, po.by, gx, gy) < 70) near = true; }
      if (near) continue;
      // the shot must need gravity: the path bows away from the straight chord (portal levels are curious enough already)
      var dev = 0, cdx = gx - L.start.x, cdy = gy - L.start.y, cl = Math.sqrt(cdx * cdx + cdy * cdy) || 1;
      for (var k = 0; k <= s; k += 4) { var px = pts[k * 2] - L.start.x, py = pts[k * 2 + 1] - L.start.y, cross = Math.abs(px * cdy - py * cdx) / cl; if (cross > dev) dev = cross; }
      var bankN = 0; for (var bi = 0; bi < sim.bumps.length; bi++) if (sim.bumps[bi].step <= s) bankN++;
      var bankLo = cfg.bank ? cfg.bank[0] : 0, bankHi = cfg.bank ? cfg.bank[1] : 6;
      if (bankN < bankLo || bankN > bankHi) continue;
      if (dev < cfg.dev && !wantPortal && bankN === 0) continue;
      L.goal = { x: Math.round(gx * 10) / 10, y: Math.round(gy * 10) / 10 };
      var orbs = [], guard = 0;
      while (orbs.length < cfg.orbs && guard++ < 80) {
        if (s - 20 <= 40) break;
        var os = Math.floor(between(rng, 40, s - 20)), ox = pts[os * 2], oy = pts[os * 2 + 1], good = dist(ox, oy, L.start.x, L.start.y) > 90 && dist(ox, oy, gx, gy) > 80;
        for (var j = 0; j < orbs.length; j++) if (dist(ox, oy, orbs[j].x, orbs[j].y) < 70) good = false;
        for (var i = 0; i < L.bodies.length && good; i++) { var bb = L.bodies[i]; if (!bb.mv && dist(ox, oy, bb.x, bb.y) < bb.r + ORB_R + 14) good = false; }
        for (pi = 0; pi < L.portals.length && good; pi++) { var p2 = L.portals[pi]; if (dist(ox, oy, p2.ax, p2.ay) < 60 || dist(ox, oy, p2.bx, p2.by) < 60) good = false; }
        if (good) orbs.push({ x: Math.round(ox * 10) / 10, y: Math.round(oy * 10) / 10 });
      }
      if (orbs.length < cfg.orbs) continue;
      L.orbs = orbs;
      var check = simulate(L, v, {});
      if (check.result !== 'goal' || check.orbs.length !== orbs.length) continue;
      if (!cfg.allowDirect && !wantPortal) {
        var easy = false;
        for (var spd = 5; spd <= 11 && !easy; spd += 3) { var dv = { vx: cdx / cl * spd, vy: cdy / cl * spd }; if (simulate(L, dv, { maxSteps: 450 }).result === 'goal') easy = true; }
        if (easy) continue;
      }
      var hits = 0, a0 = Math.atan2(v.vy, v.vx), sp0 = Math.sqrt(v.vx * v.vx + v.vy * v.vy);
      for (var ia = -1; ia <= 1; ia++) for (var ip = -1; ip <= 1; ip++) {
        var aa = a0 + ia * .026, pp2 = sp0 * (1 + ip * .04);
        if (simulate(L, { vx: Math.cos(aa) * pp2, vy: Math.sin(aa) * pp2 }, {}).result === 'goal') hits++;
      }
      if (hits < (cfg.robust || 5)) continue;
      L.solution = { vx: Math.round(v.vx * 1e6) / 1e6, vy: Math.round(v.vy * 1e6) / 1e6 };
      L.solutionSteps = check.steps; L.bank = check.bounces;
      return L;
    }
    return null;
  }

  function generate(cfg, seed, attempts) {
    var rng = mulberry32(seed >>> 0);
    for (var a = 0; a < (attempts || 400); a++) { var L = tryBuild(cfg, rng); if (L) { L.seed = seed; return L; } }
    throw new Error('could not generate gravity level for seed ' + seed);
  }
  function verify(L) { return simulate(L, L.solution, {}); }

  var WORLDS = [
    { name: 'Training Orbit', blurb: 'One planet, one station. Pull the bot back like a slingshot — the lighter your pull, the higher your score. The walls are mirrors!', cfg: { types: ['p'], bodies: [1, 2], movers: [0, 1], orbit: .3, preview: [500, 420], dev: [40, 70], orbs: [1, 2], allowDirect: true, robust: 8 } },
    { name: 'Twin Worlds', blurb: 'Two planets, two pulls — and they sway. Judge the angle and the strength.', cfg: { types: ['p', 'p'], bodies: [2, 3], movers: [1, 2], orbit: .5, preview: [380, 300], dev: [70, 100], orbs: [2, 2], robust: 7 } },
    { name: 'Solar Slingshot', blurb: 'A giant sun that drifts, planets orbiting it. Bank a shot off the wall to curve in.', cfg: { types: ['s', 'p'], bodies: [3, 4], movers: [1, 3], orbit: .9, preview: [300, 230], dev: [90, 130], orbs: [2, 3] } },
    { name: 'Moving Targets', blurb: 'Everything drifts. Timing is everything.', cfg: { types: ['p', 'p', 'm'], bodies: [3, 4], movers: [2, 4], orbit: .6, preview: [260, 190], dev: [80, 120], orbs: [2, 3] } },
    { name: 'Repulsor Reef', blurb: 'Repulsors push you away. Bounce off their force fields!', cfg: { types: ['r', 'p'], bodies: [3, 5], movers: [2, 4], orbit: .6, preview: [220, 160], dev: [80, 120], orbs: [2, 3] } },
    { name: 'Black Hole Alley', blurb: 'Deadly black holes with a monstrous pull. Planets circle them.', cfg: { types: ['h', 'p', 'r'], bodies: [3, 5], movers: [1, 3], orbit: .9, preview: [180, 110], dev: [90, 140], orbs: [3, 3] } },
    { name: 'Asteroid Belt', blurb: 'Drifting asteroids have no gravity — but they bite. Weave through!', cfg: { types: ['a', 'a', 'p'], bodies: [4, 6], movers: [3, 5], orbit: .5, preview: [220, 150], dev: [70, 110], orbs: [2, 3], robust: 4 } },
    { name: 'Warp Zone', blurb: 'Fly into one purple portal and pop out of the other — with the same speed!', cfg: { types: ['p', 's'], bodies: [2, 4], movers: [1, 3], orbit: .6, portals: 1, preview: [260, 160], dev: [60, 90], orbs: [2, 3], robust: 4 } },
    { name: 'Chaos Nebula', blurb: 'Portals, black holes and a stampede of moving worlds.', cfg: { types: ['h', 'a', 'p', 'r'], bodies: [4, 6], movers: [3, 5], orbit: .6, portals: 1, preview: [150, 90], dev: [70, 110], orbs: [3, 3], robust: 3 } },
    { name: 'Mission Control', blurb: 'The final exam. Everything you have learned, all at once.', cfg: { types: ['s', 'h', 'a', 'r'], bodies: [5, 7], movers: [4, 6], orbit: .7, portals: 1, preview: [120, 60], dev: [70, 110], orbs: [3, 3], robust: 3 } }
  ];
  var LEVELS = WORLDS.length * 10;

  function lerp(a, b, f) { return a + (b - a) * f; }
  var AMP = [14, 20, 26, 32, 38, 44, 50, 56, 62, 68];        // how far (units) worlds sway: tiny at first, bigger every galaxy
  var BANK_MAX = [0, 0, 1, 1, 2, 2, 2, 3, 3, 3];             // most wall bounces a solution may need in each galaxy
  function levelConfig(world, li) {
    var w = WORLDS[world].cfg, f = li / 9, gl = (world * 10 + li) / 99, bodies = Math.round(lerp(w.bodies[0], w.bodies[1], f));
    var bankMin = world >= 6 ? (li % 3 !== 0 ? 1 : 0) : world >= 2 ? (li % 2 === 1 ? 1 : 0) : 0;
    return {
      amp: lerp(AMP[world], AMP[world] + 8, f), drift: world >= 2, gap: Math.round(lerp(46, 18, gl)), bank: [bankMin, BANK_MAX[world]],
      types: w.types.slice(0, bodies), bodies: bodies, movers: Math.round(lerp(w.movers[0], w.movers[1], f)), orbit: w.orbit, portals: w.portals || 0,
      preview: Math.round(lerp(w.preview[0], w.preview[1], f)), dev: lerp(w.dev[0], w.dev[1], f), orbs: Math.round(lerp(w.orbs[0], w.orbs[1], f)), allowDirect: !!w.allowDirect && li < 4, robust: Math.max(3, (w.robust || 5) - (bankMin ? 1 : 0))
    };
  }
  var cache = {};
  function levelSeed(n) { return 31000 + n * 211; }
  function getLevel(n) {
    if (n < 1 || n > LEVELS) throw new RangeError('level out of range');
    if (cache[n]) return cache[n];
    var world = Math.floor((n - 1) / 10), li = (n - 1) % 10, cfg = levelConfig(world, li), L = null;
    for (var tryN = 0; tryN < 12 && !L; tryN++) {
      try { L = generate(cfg, levelSeed(n) + tryN * 17, 120); } catch (e) {
        cfg.dev *= .85; cfg.robust = Math.max(3, (cfg.robust || 5) - 1); cfg.gap = Math.max(16, (cfg.gap || 16) - 6);
        if (tryN > 0 && cfg.bank) cfg.bank = [cfg.bank[0], Math.min(3, cfg.bank[1] + 1)];
        if (tryN > 2) cfg.movers = Math.max(0, cfg.movers - 1);
        if (tryN > 4) { cfg.drift = false; cfg.orbit = (cfg.orbit || 0) * .5; cfg.amp = (cfg.amp || 30) * .8; }
        if (tryN > 7 && cfg.bank) cfg.bank = [0, 3];
      }
    }
    if (!L) throw new Error('level ' + n + ' failed to generate');
    L.world = world; L.index = n; return (cache[n] = L);
  }

  // Endless "Deep Space" mode: level k (1-based) of a run with the given seed.
  function endlessLevel(seed, k) {
    var rng = mulberry32((seed * 7919 + k * 104729) >>> 0);
    var nb = Math.min(7, 2 + Math.floor(k / 2)), types = [];
    if (k >= 3) types.push('s'); if (k >= 5) types.push('r'); if (k >= 6) types.push('a'); if (k >= 8) types.push('h'); while (types.length < 2) types.push('p');
    var cfg = { types: types.slice(0, Math.min(types.length, nb)), bodies: nb, movers: Math.min(5, Math.floor(k / 2) + 1), orbit: .6, portals: k >= 7 && k % 2 ? 1 : 0, preview: Math.max(60, 340 - k * 18), dev: Math.min(130, 60 + k * 6), orbs: k >= 6 ? 3 : 2, allowDirect: k < 2, robust: k > 6 ? 4 : 5,
      amp: Math.min(70, 14 + k * 5), drift: k >= 5, gap: Math.max(18, 46 - k * 3), bank: [k >= 4 && k % 2 === 0 ? 1 : 0, k < 3 ? 0 : k < 6 ? 1 : k < 9 ? 2 : 3] };
    for (var attempt = 0; attempt < 8; attempt++) {
      try { var L = generate(cfg, (rng() * 4294967295) >>> 0); L.endlessK = k; return L; } catch (e) { cfg.dev *= .8; cfg.robust = Math.max(3, cfg.robust - 1); cfg.gap = Math.max(16, cfg.gap - 6); if (attempt > 0) cfg.bank = [cfg.bank[0], Math.min(3, cfg.bank[1] + 1)]; if (attempt > 2) { cfg.portals = 0; cfg.bodies = Math.max(2, cfg.bodies - 1); cfg.types = cfg.types.slice(0, cfg.bodies); } }
    }
    throw new Error('endless generation failed');
  }

  function starsFor(L, shotsUsed, orbsGot) { var s = 1; if (orbsGot >= L.orbs.length) s++; if (shotsUsed <= 2) s++; return s; }

  // Score for a cleared level. info: {power (0..1 pull of the winning shot), shotsUsed, orbsGot, orbsTotal, bounces, steps, goalDist, minClear}
  // The lighter the pull, the bigger the bonus: this is the main way to score high.
  function scoreFor(info) {
    var pw = info.power == null ? 1 : info.power, parts = [{ k: 'base', t: 'Mission complete', pts: 500 }];
    parts.push({ k: 'pull', t: 'Light touch (' + Math.round(pw * 100) + '% pull)', pts: pullBonus(pw) });
    parts.push({ k: 'orbs', t: 'Energy cells (' + info.orbsGot + '/' + info.orbsTotal + ')', pts: info.orbsGot * 250 });
    if (info.shotsUsed <= 3) parts.push({ k: 'shots', t: info.shotsUsed === 1 ? 'First-shot hit' : 'Shots saved', pts: (4 - info.shotsUsed) * 200 });
    if (info.bounces > 0) parts.push({ k: 'bank', t: 'Bank shot (' + info.bounces + ' bounce' + (info.bounces > 1 ? 's' : '') + ')', pts: Math.min(3, info.bounces) * 250 });
    if (info.goalDist >= 0 && info.goalDist < 9) parts.push({ k: 'bull', t: 'Bullseye docking', pts: 300 });
    if (info.minClear >= 0 && info.minClear < 14) parts.push({ k: 'close', t: 'Close call', pts: 200 });
    if (info.steps <= 150) parts.push({ k: 'fast', t: 'Speed run', pts: 200 });
    var total = 0; parts.forEach(function (p) { total += p.pts; });
    return { total: total, parts: parts };
  }
  var RANKS = [['Cadet', 0], ['Pilot', 10], ['Navigator', 30], ['Captain', 65], ['Commander', 110], ['Admiral', 170], ['Legend', 240]];
  function rankFor(stars) { var r = 0; for (var i = 0; i < RANKS.length; i++) if (stars >= RANKS[i][1]) r = i; return { index: r, name: RANKS[r][0], next: r + 1 < RANKS.length ? RANKS[r + 1] : null, from: RANKS[r][1] }; }

  return {
    W: W, H: H, PR: PR, GOAL_R: GOAL_R, ORB_R: ORB_R, MAXSTEPS: MAXSTEPS, VMAX: VMAX, FUEL: FUEL, THRUST: THRUST, PORTAL_R: PORTAL_R, WORLDS: WORLDS, LEVELS: LEVELS, RANKS: RANKS,
    mulberry32: mulberry32, sinD: sinD, cosD: cosD, bodyPos: bodyPos, bodyMass: bodyMass, killRadius: killRadius, createFlight: createFlight, stepFlight: stepFlight,
    simulate: simulate, dragToVelocity: dragToVelocity, velocityFor: velocityFor, aimReadout: aimReadout, pullBonus: pullBonus, MAX_BOUNCES: MAX_BOUNCES, generate: generate, verify: verify, getLevel: getLevel, endlessLevel: endlessLevel, levelConfig: levelConfig,
    starsFor: starsFor, scoreFor: scoreFor, rankFor: rankFor
  };
});
