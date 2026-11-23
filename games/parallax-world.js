/* PARALLAX - world controller: renderer + post-processing, third-person character controller (joystick / keyboard / tap-to-walk),
 * follow camera with close-ups and cinematics, context-sensitive interaction, hint beacon, coins.
 * The level scenes come from parallax-env.js / parallax-env-b.js; the rules come from parallax-engine.js.
 */
(function () {
  'use strict';
  const T = THREE, MV = (window.MV = window.MV || {}), G = MV.gfx, X = MV.penv, PI = Math.PI;
  const QUALITY = {
    low: { aa: false, post: false, msaa: false, shadow: 0, dpr: 1, ferns: 50, trees: 12, dust: 40, fire: 10, spark: 80 },
    medium: { aa: false, post: true, msaa: false, shadow: 1024, dpr: 1.25, ferns: 180, trees: 24, dust: 100, fire: 22, spark: 160 },
    high: { aa: false, post: true, msaa: true, shadow: 2048, dpr: 2, ferns: 340, trees: 40, dust: 180, fire: 36, spark: 260 }
  };
  MV.PQUALITY = QUALITY;
  MV.pAutoQuality = function () {
    const mob = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent), cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
    if (mob && (cores <= 4 || mem <= 3)) return 'low'; if (mob) return 'medium'; return cores >= 8 && mem >= 8 ? 'high' : 'medium';
  };
  const lerpAng = (a, b, k) => { let d = ((b - a + PI) % (PI * 2) + PI * 2) % (PI * 2) - PI; return a + d * k; };
  const sstep = x => x * x * (3 - 2 * x);

  MV.createParallax = function (canvas, opts) {
    opts = opts || {}; let qName = QUALITY[opts.quality] ? opts.quality : 'medium', q = QUALITY[qName];
    const renderer = G.makeRenderer(canvas, { aa: q.post ? false : q.aa, shadow: q.shadow, preserve: opts.preserve }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.dpr)); renderer.toneMappingExposure = .8;
    let post = null, sizeW = 2, sizeH = 2;
    const mkPost = () => { if (post) { post.dispose(); post = null; } renderer.toneMapping = q.post ? T.NoToneMapping : T.ACESFilmicToneMapping; if (q.post) { try { post = G.Post(renderer, q); post.setSize(sizeW, sizeH); post.setBloom(.3); post.setExposure(.82); } catch (e) { console.warn('post-processing off', e); post = null; renderer.toneMapping = T.ACESFilmicToneMapping; } } }; mkPost();
    G.initMaterials(); const scene = new T.Scene(); scene.environment = G.envMap(renderer);
    const camera = new T.PerspectiveCamera(50, 1, .3, 700), W = { renderer, scene, camera, q, qName, time: 0, LV: null, focus: null, moving: false };
    const hemi = new T.HemisphereLight(0xbfd9ff, 0x6a5a40, .8), sun = new T.DirectionalLight(0xfff0d2, 2.4); scene.add(hemi, sun, sun.target);
    const applyShadow = () => { sun.castShadow = q.shadow > 0; if (q.shadow) { sun.shadow.mapSize.set(q.shadow, q.shadow); const c = sun.shadow.camera; c.left = c.bottom = -26; c.right = c.top = 26; c.near = 1; c.far = 160; sun.shadow.bias = -.0004; sun.shadow.normalBias = .04; } renderer.shadowMap.enabled = q.shadow > 0; };
    applyShadow();
    const av = MV.avatar.create(); scene.add(av.root); W.avatar = av; const ap = av.root.position;
    let root = null, ctx = null, game = null, picked = [];
    const P = { yaw: 0, vx: 0, vz: 0, vy: 0, grounded: true, speed01: 0, stick: { x: 0, y: 0 }, key: { x: 0, y: 0 } };
    const C = { yaw: PI, pitch: .3, dist: 9, tx: 0, ty: 0, tz: 0, zoom: 1, hold: 0 };
    const cine = { on: false, keys: null, t: 0, dur: 0, done: null }, ia = { act: null, t: 0, dur: 0, hit: 0, fired: false, closeup: 0 }, walk = { on: false, x: 0, z: 0, cb: null, stuck: 0, lx: 0, lz: 0 };
    let hintAct = null, hintT = 0, stepAcc = 0, exitOn = false, exitFired = false;
    const focusRing = new T.Mesh(new T.RingGeometry(.9, 1.15, 40), new T.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: .0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); focusRing.rotation.x = -PI / 2; scene.add(focusRing);
    const beacon = new T.Group(), bcol = new T.Mesh(new T.CylinderGeometry(.5, .9, 14, 14, 1, true), new T.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: .25, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })); bcol.position.y = 7; beacon.add(bcol); const bglow = G.glow(0xffe08a, 4.5, .9); bglow.position.y = 2.6; beacon.add(bglow); beacon.visible = false; scene.add(beacon);

    W.setSize = function (w, h) { sizeW = w; sizeH = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); W.aspect = w / h; if (post) post.setSize(w, h); };
    W.setQuality = function (name) { if (!QUALITY[name]) return; qName = W.qName = name; q = W.q = QUALITY[name]; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.dpr)); applyShadow(); mkPost(); if (game) W.load(game, { picked, keepPos: true }); };

    /* ---------- loading a level ---------- */
    W.load = function (g, o) {
      o = o || {}; game = g; picked = (o.picked || []).slice(); const keep = o.keepPos ? { x: ap.x, y: ap.y, z: ap.z, yaw: P.yaw } : null;
      if (root) { scene.remove(root); root.traverse(m => { if (m.geometry) m.geometry.dispose(); }); }
      root = new T.Group(); scene.add(root); const anims = []; W.anims = anims; W.fx = G.spark(root, q.spark);
      ctx = { root, scene, anims, q, sun, hemi, fx: W.fx }; const LV = W.LV = X.levels[g.index](ctx);
      sun.position.set(LV.sunDir[0], LV.sunDir[1], LV.sunDir[2]); sun.target.position.set(0, 0, 0);
      LV.coinMeshes.forEach((m, i) => { m.visible = !picked.includes(i); });
      const s = LV.start; ap.set(keep ? keep.x : s.x, 0, keep ? keep.z : s.z); P.yaw = keep ? keep.yaw : s.yaw; av.root.rotation.y = P.yaw; P.vx = P.vz = P.vy = 0; P.grounded = true;
      const gy = LV.groundAt(ap.x, ap.z); ap.y = gy == null ? 0 : gy; C.yaw = P.yaw; C.pitch = LV.cam.pitch; C.dist = LV.cam.dist; C.zoom = 1; C.tx = ap.x; C.ty = ap.y + 1.5; C.tz = ap.z;
      cine.on = false; ia.act = null; ia.closeup = 0; walk.on = false; hintAct = null; beacon.visible = false; W.focus = null; exitFired = false; exitOn = false;
      LV.sync(g.evaluate(), [], true); W.snapCamera(); if (!keep) av.play('marvel', 2.4);
    };
    W.sync = function (events, instant) { if (W.LV && game) W.LV.sync(game.evaluate(), events || [], !!instant); };
    W.setExitEnabled = v => { exitOn = !!v; };

    /* ---------- input ---------- */
    W.setStick = (x, y) => { P.stick.x = x; P.stick.y = y; };
    W.setKeys = (x, y) => { P.key.x = x; P.key.y = y; };
    W.look = (dx, dy) => { C.yaw -= dx * .0062; C.pitch = Math.max(.1, Math.min(1.1, C.pitch + dy * .004)); C.hold = 3; };
    W.zoom = f => { C.zoom = Math.max(.55, Math.min(1.7, C.zoom * f)); };
    W.resetCam = () => { C.yaw = P.yaw + 0; C.pitch = W.LV.cam.pitch; C.zoom = 1; };
    W.tilt = d => { C.pitch = Math.max(.1, Math.min(1.1, C.pitch + d)); };
    W.turn = d => { C.yaw += d; C.hold = 3; };
    W.jump = () => { if (P.grounded && !cine.on && !ia.act && !(av.busy && av.action !== 'marvel')) { P.vy = 6.6; P.grounded = false; opts.onSfx && opts.onSfx('jump'); } };
    W.walkTo = (x, z, cb) => { walk.on = true; walk.x = x; walk.z = z; walk.cb = cb || null; walk.stuck = 0; walk.lx = ap.x; walk.lz = ap.z; };
    W.cancelWalk = () => { walk.on = false; walk.cb = null; };
    W.ray = (cx, cy) => { const r = canvas.getBoundingClientRect(), rc = new T.Raycaster(); rc.setFromCamera(new T.Vector2((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera); return rc; };
    W.pickAct = function (cx, cy) {                                                      // which interactive object is under this screen point (generous: also nearest on screen)
      if (!W.LV) return null; const rc = W.ray(cx, cy); let best = null, bd = 1e9;
      W.LV.interactables.forEach(a => { const hits = rc.intersectObject(a.root, true); if (hits.length && hits[0].distance < bd) { bd = hits[0].distance; best = a; } });
      if (best) return best; const r = canvas.getBoundingClientRect();
      W.LV.interactables.forEach(a => { const p = new T.Vector3(a.look[0], a.look[1], a.look[2]).project(camera); if (p.z > 1) return; const sx = (p.x + 1) / 2 * r.width + r.left, sy = (1 - p.y) / 2 * r.height + r.top, d = Math.hypot(sx - cx, sy - cy); if (d < 46 && d < bd) { bd = d; best = a; } }); return best;
    };
    W.groundPoint = function (cx, cy) { const rc = W.ray(cx, cy), pl = new T.Plane(new T.Vector3(0, 1, 0), -ap.y), p = new T.Vector3(); return rc.ray.intersectPlane(pl, p) ? p : null; };
    W.walkToAct = function (a, then) {                                                   // go to a comfortable spot beside the object, then use it
      let dx = ap.x - a.x, dz = ap.z - a.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d; const sd = a.standDist || 2.3;
      if (d < sd + .6 && d <= a.range) { if (then) then(); return; }
      const cand = [[a.x + dx * sd, a.z + dz * sd], [a.x - dz * sd, a.z + dx * sd], [a.x + dz * sd, a.z - dx * sd], [a.x - dx * sd, a.z - dz * sd]];
      const pt = cand.find(c => W.LV.groundAt(c[0], c[1]) != null && !W.LV.colliders.some(k => Math.hypot(k.x - c[0], k.z - c[1]) < k.r + .45)) || cand[0]; W.walkTo(pt[0], pt[1], then);
    };
    W.interact = function (a) {
      a = a || W.focus; if (!a || cine.on || ia.act || av.busy && av.action !== 'marvel') return false;
      ia.act = a; ia.t = 0; ia.dur = a.dur; ia.hit = a.dur * a.hit; ia.fired = false; walk.on = false; av.play(a.anim, a.dur); opts.onSfx && opts.onSfx('reach'); return true;
    };
    W.setHint = function (a) { hintAct = a; hintT = 14; if (a) { beacon.visible = true; beacon.position.set(a.x, W.LV.groundAt(a.x, a.z) || 0, a.z); if (a.kind === 'exit') beacon.position.set(a.x, 0, a.z); } else beacon.visible = false; };
    W.busy = () => cine.on || !!ia.act;
    W.walking = () => walk.on;
    W.debugState = () => ({ cine: cine.on, cineT: cine.t, cineDur: cine.dur, ia: ia.act && ia.act.id, iaT: ia.t, iaDur: ia.dur, fired: ia.fired });
    W.lookToward = (x, z) => { C.yaw = Math.atan2(x - ap.x, z - ap.z); C.hold = 3; };
    W.teleport = (x, z) => { const g = W.LV.groundAt(x, z); if (g == null) return false; ap.set(x, g, z); P.vx = P.vz = 0; walk.on = false; return true; };       // used by tests and by restarts

    /* ---------- cinematics ---------- */
    W.cine = function (keys, dur, done) { cine.on = true; cine.keys = keys; cine.t = 0; cine.dur = dur; cine.done = done || null; walk.on = false; P.stick.x = P.stick.y = 0; };
    W.skipCine = function () { if (!cine.on) return; cine.t = cine.dur; };
    const cp = new T.Vector3(), cl = new T.Vector3();
    function cineAt(t) {
      const k = cine.keys; if (t <= k[0].t) { cp.fromArray(k[0].p); cl.fromArray(k[0].l); return; }
      for (let i = 0; i < k.length - 1; i++) if (t <= k[i + 1].t) { const u = sstep((t - k[i].t) / (k[i + 1].t - k[i].t)); cp.set(k[i].p[0] + (k[i + 1].p[0] - k[i].p[0]) * u, k[i].p[1] + (k[i + 1].p[1] - k[i].p[1]) * u, k[i].p[2] + (k[i + 1].p[2] - k[i].p[2]) * u); cl.set(k[i].l[0] + (k[i + 1].l[0] - k[i].l[0]) * u, k[i].l[1] + (k[i + 1].l[1] - k[i].l[1]) * u, k[i].l[2] + (k[i + 1].l[2] - k[i].l[2]) * u); return; }
      const l = k[k.length - 1]; cp.fromArray(l.p); cl.fromArray(l.l);
    }
    W.snapCamera = function () { placeCamera(1 / 60, true); };
    W.celebrate = dur => av.play('celebrate', dur || 2.6);
    W.runFinale = function (done) {
      const LV = W.LV; W.celebrate(2.8); LV.onFinale && LV.onFinale(ctx); W.cine(LV.finaleCam(), LV.finaleDur, done); opts.onSfx && opts.onSfx('finale');
    };
    W.runLockCine = function (done) { const LV = W.LV; if (!LV.lockCam) { done && done(); return; } W.cine(LV.lockCam(), LV.lockDur, done); };

    /* ---------- per-frame ---------- */
    function move(dt) {
      const LV = W.LV; let sx = P.stick.x + P.key.x, sy = P.stick.y + P.key.y; const m0 = Math.hypot(sx, sy); if (m0 > 1) { sx /= m0; sy /= m0; }
      const locked = cine.on || (ia.act && true) || (av.busy && av.action === 'celebrate');
      if (locked) { sx = sy = 0; }
      if (walk.on) {
        if (m0 > .25 && !locked) walk.on = false; else { const dx = walk.x - ap.x, dz = walk.z - ap.z, d = Math.hypot(dx, dz); if (d < .28) { walk.on = false; const cb = walk.cb; walk.cb = null; cb && cb(); } else { const f = Math.min(1, d / 1.2) * .85 + .15; const mx = dx / d * f, mz = dz / d * f; sx = (mx * Math.cos(C.yaw) * -1 + mz * -Math.sin(C.yaw)) * -1; sy = 0; P.autoX = mx; P.autoZ = mz; } }
      }
      let mx = 0, mz = 0, mag = 0;
      if (walk.on && !locked) { mx = P.autoX; mz = P.autoZ; mag = Math.min(1, Math.hypot(mx, mz)); }
      else { const fx = Math.sin(C.yaw), fz = Math.cos(C.yaw), rx = -Math.cos(C.yaw), rz = Math.sin(C.yaw); mx = fx * sy + rx * sx; mz = fz * sy + rz * sx; mag = Math.min(1, Math.hypot(sx, sy)); }
      const speed = mag < .08 ? 0 : (mag < .72 ? 2.5 * mag / .72 : 2.5 + (mag - .72) / .28 * 2.9), k = 1 - Math.exp(-dt * 10);
      const tvx = mag > .001 ? mx / Math.max(.001, Math.hypot(mx, mz)) * speed : 0, tvz = mag > .001 ? mz / Math.max(.001, Math.hypot(mx, mz)) * speed : 0;
      P.vx += (tvx - P.vx) * k; P.vz += (tvz - P.vz) * k; const sp = Math.hypot(P.vx, P.vz);
      if (sp > .15) P.yaw = lerpAng(P.yaw, Math.atan2(P.vx, P.vz), 1 - Math.exp(-dt * 12));
      let nx = ap.x + P.vx * dt, nz = ap.z + P.vz * dt;
      const ok = (x, z) => { const g = LV.groundAt(x, z); if (g == null) return null; if (P.grounded === false && ap.y > g + .6 && false) return g; return g; };
      const resolve = (x, z) => { for (let it = 0; it < 2; it++) for (const c of LV.colliders) { const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), mn = c.r + .42; if (d < mn) { const u = d < .001 ? 1 : mn / d; x = c.x + (d < .001 ? mn : dx * u); z = c.z + (d < .001 ? 0 : dz * u); } } return [x, z]; };
      let r = resolve(nx, nz), g = ok(r[0], r[1]);
      if (g == null) { const rx = resolve(nx, ap.z), gx = ok(rx[0], rx[1]); if (gx != null) { r = rx; g = gx; } else { const rz = resolve(ap.x, nz), gz = ok(rz[0], rz[1]); if (gz != null) { r = rz; g = gz; } else { r = [ap.x, ap.z]; g = ok(ap.x, ap.z); P.vx = P.vz = 0; } } }
      if (g != null && g - ap.y > .7 && P.grounded) { r = [ap.x, ap.z]; g = ok(ap.x, ap.z); P.vx *= .3; P.vz *= .3; }          // a wall too high to step onto
      ap.x = r[0]; ap.z = r[1]; const gh = g == null ? ap.y : g;
      if (!P.grounded) { P.vy -= 19 * dt; ap.y += P.vy * dt; if (ap.y <= gh && P.vy <= 0) { ap.y = gh; P.grounded = true; P.vy = 0; opts.onSfx && opts.onSfx('land'); } } else { ap.y += (gh - ap.y) * Math.min(1, dt * 16); }
      if (walk.on) { walk.stuck += (Math.hypot(ap.x - walk.lx, ap.z - walk.lz) < .02 * dt * 60 ? dt : -walk.stuck); walk.lx = ap.x; walk.lz = ap.z; if (walk.stuck > .7) { walk.on = false; walk.cb = null; } }
      av.root.rotation.y = P.yaw; W.moving = sp > .3; P.speed01 = Math.min(1, sp / 5.4); av.setMotion(sp > .25 ? Math.min(1, sp / 5.0) : 0, P.grounded, P.vy);
      if (W.moving && P.grounded) { stepAcc += sp * dt; if (stepAcc > 1.7) { stepAcc = 0; opts.onSfx && opts.onSfx('step'); } }
    }
    function interactions(dt) {
      const LV = W.LV; let best = null, bd = 1e9;
      if (!cine.on && !ia.act) LV.interactables.forEach(a => { const d = Math.hypot(a.x - ap.x, a.z - ap.z); if (d <= a.range && d < bd) { bd = d; best = a; } });
      if (best !== W.focus) { W.focus = best; opts.onFocus && opts.onFocus(best); }
      if (ia.act) {
        const a = ia.act; ia.t += dt; const dx = a.x - ap.x, dz = a.z - ap.z; P.yaw = lerpAng(P.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 14)); av.root.rotation.y = P.yaw;
        if (!ia.fired && ia.t >= ia.hit) { ia.fired = true; opts.onAct && opts.onAct(a); }
        const u = Math.min(1, ia.t / ia.dur); ia.closeup = Math.sin(Math.min(1, u * 1.1) * PI) * .85; if (ia.t >= ia.dur) { ia.act = null; ia.closeup = 0; }
      } else ia.closeup *= Math.exp(-dt * 6);
      const ringOn = best && !ia.act; focusRing.material.opacity += ((ringOn ? .85 + .15 * Math.sin(W.time * 6) : 0) - focusRing.material.opacity) * Math.min(1, dt * 10);
      if (best) { focusRing.position.set(best.x, (LV.groundAt(best.x, best.z) || 0) + .08, best.z); focusRing.scale.setScalar(1.25 + .12 * Math.sin(W.time * 4) + (best.kind === 'pillar' ? .3 : 0)); }
      if (hintAct) { hintT -= dt; bcol.material.opacity = .22 + .1 * Math.sin(W.time * 4); bglow.material.opacity = .7 + .25 * Math.sin(W.time * 5); bglow.position.y = 2.6 + Math.sin(W.time * 3) * .25; if (hintT <= 0) W.setHint(null); }
      LV.coinMeshes.forEach((m, i) => { if (!m.visible) return; if (Math.hypot(m.position.x - ap.x, m.position.z - ap.z) < 1.15 && Math.abs(m.position.y - 1.1 - ap.y) < 1.8) { m.visible = false; picked.push(i); W.fx.burst(m.position.x, m.position.y, m.position.z, 24, 0xffd24a, 3.5); opts.onCoin && opts.onCoin(i); } });
      if (LV.exitZone && exitOn && !exitFired && Math.hypot(ap.x - LV.exitZone.x, ap.z - LV.exitZone.z) < LV.exitZone.r) { exitFired = true; opts.onExit && opts.onExit(); }
    }
    const tgt = new T.Vector3(), des = new T.Vector3(), look = new T.Vector3(); let camInit = false;
    function placeCamera(dt, snap) {
      if (cine.on && cine.keys) { cineAt(cine.t); const k = snap ? 1 : 1 - Math.exp(-dt * 6); camera.position.lerp(cp, camInit ? k : 1); look.lerp(cl, camInit ? k : 1); camera.lookAt(look); camInit = true; return; }
      const a = ia.act, cu = ia.closeup; const hx = ap.x, hy = ap.y + 1.55, hz = ap.z; let tx = hx, ty = hy, tz = hz, dist = C.dist * C.zoom * (1 - cu * .38), pitch = C.pitch - cu * .08;
      if (a) { tx += (a.look[0] - hx) * .42 * cu; ty += (a.look[1] - hy) * .4 * cu; tz += (a.look[2] - hz) * .42 * cu; }
      const k = snap ? 1 : 1 - Math.exp(-dt * 9); C.tx += (tx - C.tx) * k; C.ty += (ty - C.ty) * k; C.tz += (tz - C.tz) * k;
      if (C.hold > 0) C.hold -= dt; const cy = C.yaw, cpch = pitch;
      des.set(C.tx - Math.sin(cy) * Math.cos(cpch) * dist, C.ty + Math.sin(cpch) * dist + .4, C.tz - Math.cos(cy) * Math.cos(cpch) * dist);
      if (!camInit || snap) camera.position.copy(des); else camera.position.lerp(des, 1 - Math.exp(-dt * 12));
      look.set(C.tx, C.ty + .15, C.tz); look.y += Math.sin(cpch) * .0; camera.lookAt(look); camInit = true;
    }
    W.update = function (dt) {
      dt = Math.min(dt, .05 * (W.timeScale || 1)); W.time += dt; const t = W.time; if (!W.LV) return;
      if (cine.on) { cine.t += dt; if (cine.t >= cine.dur) { cine.on = false; const d = cine.done; cine.done = null; d && d(); } }
      move(dt); interactions(dt); av.update(dt); for (let i = 0; i < W.anims.length; i++) W.anims[i](t, dt); W.LV.update(t, dt); W.fx.update(t, dt);
      sun.position.set(ap.x + W.LV.sunDir[0], W.LV.sunDir[1], ap.z + W.LV.sunDir[2]); sun.target.position.set(ap.x, ap.y, ap.z); sun.target.updateMatrixWorld();
      placeCamera(dt, false);
    };
    W.render = function () { if (post) post.render(scene, camera, W.time); else renderer.render(scene, camera); };
    W.dispose = function () { renderer.dispose(); };
    return W;
  };
})();
