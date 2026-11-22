/* MindVerse - world: renderer, camera, lighting, the temple environments for each level, picking and effects. */
(function () {
  'use strict';
  const T = THREE, MV = (window.MV = window.MV || {}), G = MV.gfx, E = window.MindverseEngine, PI = Math.PI, D2R = PI / 180;
  const M = G.mat;

  const QUALITY = {
    low: { aa: false, post: false, msaa: false, shadow: 0, dpr: 1, ferns: 70, trees: 14, dust: 40, fire: 10, spark: 80, fog: .0095 },
    medium: { aa: false, post: true, msaa: false, shadow: 1024, dpr: 1.25, ferns: 220, trees: 26, dust: 110, fire: 22, spark: 160, fog: .0085 },
    high: { aa: false, post: true, msaa: true, shadow: 2048, dpr: 2, ferns: 420, trees: 42, dust: 200, fire: 36, spark: 260, fog: .0075 }
  };
  MV.QUALITY = QUALITY;
  MV.autoQuality = function () {
    const mob = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent), cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
    if (mob && (cores <= 4 || mem <= 3)) return 'low'; if (mob) return 'medium'; return cores >= 8 && mem >= 8 ? 'high' : 'medium';
  };

  /* ---------- reusable temple parts ---------- */
  function pillar(x, z, h, broken, mat) {
    const g = new T.Group(), r = .75, hh = broken ? h * .62 : h;
    g.add(G.bevel(2, .5, 2, M.stoneDark, 0, .25, 0, .06)); g.add(G.cyl(r, r * 1.08, hh, mat || M.stone, 0, .5 + hh / 2, 0, 14));
    for (let i = 0; i < 3; i++) { const b = new T.Mesh(new T.TorusGeometry(r * 1.04, .06, 6, 18), M.gold); b.rotation.x = PI / 2; b.position.y = 1.2 + i * hh * .28; g.add(b); }
    if (!broken) g.add(G.bevel(2, .5, 2, M.stoneDark, 0, .75 + hh, 0, .06)); else { const j = new T.Mesh(new T.DodecahedronGeometry(.9, 0), M.stone); j.position.set(1.7, .6, .6); j.castShadow = true; g.add(j); }
    g.position.set(x, 0, z); return g;
  }
  function stairs(x, z, w, steps, mat) { const g = new T.Group(); for (let i = 0; i < steps; i++) g.add(G.bevel(w - i * .5, .36, 1.7, mat || M.stoneWarm, 0, .18 + i * .36, -i * 1.5, .05)); g.position.set(x, 0, z); return g; }
  function banner(x, y, z, ry) {
    const c = G.cv(128, 256), q = c.getContext('2d'); const g = q.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#9c2030'); g.addColorStop(1, '#6a1220'); q.fillStyle = g; q.fillRect(0, 0, 128, 256); q.strokeStyle = '#e0a93e'; q.lineWidth = 5; q.strokeRect(6, 6, 116, 244); G.drawGlyph(q, 'sun', 64, 100, 80, '#f2c25a', '#ffb040'); G.drawGlyph(q, 'triangle', 64, 190, 50, '#f2c25a');
    const m = new T.Mesh(new T.PlaneGeometry(1.8, 3.6, 4, 6), new T.MeshStandardMaterial({ map: G.tex(c), roughness: .9, side: T.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry || 0; m.userData.wave = 1; m.castShadow = true; return m;
  }
  function stoneWall(w, h, d, x, y, z, mat) { return G.bevel(w, h, d, mat || M.stone, x, y, z, .1); }
  function arch(x, z, w, h) {
    const g = new T.Group(); [-1, 1].forEach(s => g.add(G.bevel(1.2, h, 1.4, M.stoneWarm, s * (w / 2), h / 2, 0, .08))); const top = new T.Mesh(new T.TorusGeometry(w / 2, .6, 8, 24, PI), M.stoneWarm); top.position.y = h; top.castShadow = true; g.add(top); g.position.set(x, 0, z); return g;
  }
  function rocks(parent, n, area, seed, mat) { const r = G.rng(seed); for (let i = 0; i < n; i++) { const s = .5 + r() * 1.7, m = new T.Mesh(new T.DodecahedronGeometry(s, 0), mat || M.stoneMoss); m.position.set(area.x + (r() - .5) * area.w, s * .35, area.z + (r() - .5) * area.d); m.rotation.set(r() * 3, r() * 3, r() * 3); m.scale.y = .7; m.castShadow = m.receiveShadow = true; parent.add(m); } }
  function mandalaTexture() {
    const c = G.cv(512, 512), q = c.getContext('2d'); q.translate(256, 256); const g = q.createRadialGradient(0, 0, 10, 0, 0, 250); g.addColorStop(0, '#f6d27a'); g.addColorStop(.6, '#b98a35'); g.addColorStop(1, '#7a5a22'); q.fillStyle = g; q.beginPath(); q.arc(0, 0, 250, 0, 7); q.fill();
    q.strokeStyle = '#3a2a10'; q.lineWidth = 5; [235, 190, 140, 90].forEach(r => { q.beginPath(); q.arc(0, 0, r, 0, 7); q.stroke(); });
    for (let i = 0; i < 24; i++) { q.save(); q.rotate(i * PI / 12); q.fillStyle = i % 2 ? '#3a2a10' : '#fff0b0'; q.beginPath(); q.moveTo(0, -150); q.lineTo(14, -186); q.lineTo(-14, -186); q.closePath(); q.fill(); q.restore(); }
    for (let i = 0; i < 8; i++) { q.save(); q.rotate(i * PI / 4); G.drawGlyph(q, i % 2 ? 'triangle' : 'spiral', 0, -212, 40, '#3a2a10'); q.restore(); }
    q.shadowColor = '#fff3a0'; q.shadowBlur = 28; q.fillStyle = '#fff4c0'; q.beginPath(); q.arc(0, 0, 40, 0, 7); q.fill(); q.strokeStyle = '#6a4a10'; q.lineWidth = 4; for (let i = 0; i < 12; i++) { q.rotate(PI / 6); q.beginPath(); q.moveTo(0, 46); q.lineTo(0, 80); q.stroke(); }
    return G.tex(c, null, true);
  }
  /* a round, split door (L1) */
  function roundDoor(x, y, z, r) {
    const g = new T.Group(), mt = new T.MeshStandardMaterial({ map: mandalaTexture(), metalness: .55, roughness: .45, envMapIntensity: 1, side: T.DoubleSide }), halves = [];
    const back = new T.Mesh(new T.CircleGeometry(r * .98, 40), new T.MeshBasicMaterial({ color: 0xffc96a })); back.position.z = -.35; g.add(back); const gl = G.glow(0xffb85a, r * 3.4, .0); gl.position.z = -.2; g.add(gl);
    [0, 1].forEach(i => { const h = new T.Mesh(new T.CircleGeometry(r, 48, i ? PI / 2 : -PI / 2, PI), mt); h.castShadow = true; const th = new T.Mesh(new T.CylinderGeometry(r, r, .5, 40, 1, false, i ? 0 : PI, PI), M.stoneDark); th.rotation.x = PI / 2; th.position.z = -.26; h.add(th); h.position.z = 0; g.add(h); halves.push(h); });
    g.position.set(x, y, z); let f = 0; const set = k => { f = k; halves[0].position.x = -k * (r + .3); halves[1].position.x = k * (r + .3); gl.material.opacity = k * .9; back.visible = k > 0; }; set(0);
    return { g, set, get f() { return f; }, update(t, dt) { } };
  }
  /* slab doors */
  function slabDoor(x, y, z, w, h, mode) {                                                // mode 'gate' two leaves, 'drop' one slab sinks, 'side' slides
    const g = new T.Group(); const leaves = [];
    const mk = (ww, xx) => { const l = new T.Group(); l.add(G.bevel(ww, h, .8, M.stoneWarm, 0, 0, 0, .08)); const e = new T.Mesh(new T.PlaneGeometry(ww * .66, h * .4), new T.MeshBasicMaterial({ map: G.glyphTexture('sun', '#6d6350', '#f3c777', '#ffb040') })); e.position.set(0, h * .12, .43); l.add(e); l.position.x = xx; g.add(l); leaves.push({ l, x0: xx }); };
    if (mode === 'gate') { mk(w / 2 - .02, -w / 4); mk(w / 2 - .02, w / 4); } else mk(w, 0);
    const behind = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: 0xffd9a0 })); behind.position.z = -.5; g.add(behind); const gl = G.glow(0xffd290, w * 2.6, 0); gl.position.z = -.3; g.add(gl);
    g.position.set(x, y, z); let f = 0;
    const set = k => { f = k; leaves.forEach((o, i) => { if (mode === 'gate') o.l.position.x = o.x0 + (i ? 1 : -1) * k * w * .5; else if (mode === 'drop') o.l.position.y = -k * h * 1.02; else o.l.position.x = o.x0 + k * w * 1.02; }); gl.material.opacity = k * .85; behind.visible = k > 0; };
    set(0); return { g, set, get f() { return f; }, hit: 1 };
  }

  /* ---------- environment builders ---------- */
  const ENV = {};
  function sunLight(scene, q, pos, intensity, color, spread) {
    const s = new T.DirectionalLight(color || 0xffdba5, intensity); s.position.set(pos[0], pos[1], pos[2]); s.target.position.set(0, 0, 0); s.castShadow = q.shadow > 0;
    if (q.shadow) { s.shadow.mapSize.set(q.shadow, q.shadow); const c = s.shadow.camera, r = spread || 24; c.left = -r; c.right = r; c.top = r; c.bottom = -r; c.near = 1; c.far = 120; s.shadow.bias = -.0004; s.shadow.normalBias = .04; }
    scene.add(s, s.target); return s;
  }
  function jungleFloor(root, y) {                                                          // ground outside the playfield
    const c = G.cv(256, 256), x = c.getContext('2d'), r = G.rng(3); x.fillStyle = '#26421a'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { x.fillStyle = 'hsla(' + (78 + r() * 40) + ',' + (34 + r() * 18) + '%,' + (12 + r() * 20) + '%,.55)'; x.fillRect(r() * 256, r() * 256, 2 + r() * 5, 2 + r() * 5); }
    const t = G.tex(c, [26, 26]); const m = new T.Mesh(new T.CircleGeometry(140, 40), new T.MeshStandardMaterial({ map: t, roughness: 1 })); m.rotation.x = -PI / 2; m.position.y = y == null ? -.42 : y; m.receiveShadow = true; root.add(m);
  }
  function outdoorBase(env, q, o) {                                                       // sky, ferns, trees, haze, rays, dust, fireflies
    const { scene, root, anims } = env; o = o || {};
    scene.background = new T.Color(o.fogColor || 0x9fb98f); scene.fog = new T.FogExp2(o.fogColor || 0x9fb98f, q.fog * (o.fogMul || 1));
    root.add(G.sky(o.top || '#4f9be0', o.mid || '#bfe0f2', o.bot || '#f4e6bc')); jungleFloor(root);
    env.hemi = new T.HemisphereLight(0xaed4ff, 0x3a5220, o.hemi || .42); scene.add(env.hemi); env.sun = sunLight(scene, q, o.sun || [-16, 28, 14], o.sunI || 1.55, 0xffd7a0, o.spread);
    root.add(G.trees(q.trees, (o.treeR || 26) + 16, 22, o.seed || 4));
    const ferns = G.ferns(q.ferns, { x: 0, z: 0, w: 70, d: 60 }, 11, (x, z) => Math.abs(x) < (o.clearX || 10.5) && Math.abs(z) < (o.clearZ || 8)); ferns.position.y = -.4; root.add(ferns);
    const d = G.dust(q.dust, { w: 34, h: 12, d: 28 }); d.obj.position.y = .2; root.add(d.obj); anims.push(d.update);
    const ff = G.fireflies(q.fire, { w: 40, h: 4, d: 30 }); root.add(ff.obj); anims.push(ff.update);
    const rays = G.godRays([{ x: -9, y: 11, z: -2, w: 5, len: 24, rz: .52 }, { x: -2, y: 11, z: -5, w: 4, len: 26, rz: .5 }, { x: 5, y: 11, z: -3, w: 6, len: 26, rz: .52 }], 0xffe6b0); root.add(rays.obj); anims.push(rays.update);
  }
  function waterfallCliff(env, x, z, w, h, seed) {
    const g = new T.Group(); g.add(G.bevel(w + 5, h, 5, M.stoneMoss, 0, h / 2, 0, .3)); [-1, 1].forEach(s => g.add(G.bevel(3.5, h * .8, 5, M.stoneDark, s * (w / 2 + 3), h * .4, .3, .3)));
    const wf = G.waterfall(w, h * .96); wf.obj.position.set(0, .1, 2.6); g.add(wf.obj); env.anims.push(wf.update);
    const pool = G.water(w + 12, 9, new T.Vector3(.4, .8, .3)); pool.obj.position.set(0, .05, 7); g.add(pool.obj); env.anims.push(pool.update);
    for (let i = 0; i < 3; i++) g.add(G.vine(-w / 2 + i * w / 2.4, h, 2.4, 6 + i * 2, seed + i)); g.position.set(x, 0, z); env.root.add(g); return g;
  }
  function templeBack(env, z, o) {                                                        // stepped temple front
    const g = new T.Group(); o = o || {};
    for (let i = 0; i < 3; i++) g.add(G.bevel(34 - i * 6, 1.8, 16 - i * 2.4, i % 2 ? M.stoneWarm : M.stone, 0, .9 + i * 1.8, -i * 1.2, .1));
    g.add(G.bevel(22, 14, 3, M.stoneMoss, 0, 5.4 + 1.8 * 3 - 1, -2, .15));
    [-1, 1].forEach(s => { g.add(G.bevel(3.2, 14, 3.4, M.stoneWarm, s * 9, 12, -.6, .12)); g.add(G.bevel(4, 1, 4, M.stoneDark, s * 9, 19.4, -.6, .1)); });
    g.add(G.bevel(14, 1.4, 3.4, M.stoneWarm, 0, 16.4, -.6, .12)); g.position.set(0, 0, z); env.root.add(g);
    for (let i = 0; i < 6; i++) { const v = G.vine(-9 + i * 3.6, 17, z + 3.2, 6 + (i % 3) * 2.5, i * 5); env.root.add(v); }
    return g;
  }

  ENV.entrance = function (env, q) {
    outdoorBase(env, q, { clearX: 11, clearZ: 9 });
    const tb = templeBack(env, -17); tb.children.forEach(() => { });
    // facade door
    const door = roundDoor(0, 7.6, -9.1, 4.4); env.root.add(door.g); env.door = door;
    [-1, 1].forEach(s => { env.root.add(G.bevel(1.6, 11.6, 1.6, M.stoneWarm, s * 5.4, 5.9, -9.4, .1)); }); env.root.add(G.bevel(12.2, 1.4, 1.8, M.stoneWarm, 0, 12.3, -9.4, .1)); env.root.add(G.bevel(12.2, 1.4, 3.4, M.stoneDark, 0, .7, -8.6, .1));
    env.root.add(stairs(0, -6.2, 13, 4, M.stoneWarm)); env.root.children[env.root.children.length - 1].position.y = 0;
    [-6.2, 6.2].forEach((x, i) => { const t = G.torch(i === 0); t.obj.position.set(x, 0, -4.8); env.root.add(t.obj); env.anims.push(t.update); });
    waterfallCliff(env, -30, -22, 6, 20, 3); rocks(env.root, 12, { x: 0, z: 2, w: 36, d: 20 }, 4);
    env.root.add(G.bevel(14, .3, 12, M.floor, 0, -.04, 1, .02));
  };
  function hallShell(env, q, o) {
    o = o || {}; const { scene, root, anims } = env;
    scene.background = new T.Color(o.bg || 0x161412); scene.fog = new T.FogExp2(o.bg || 0x1a1612, o.fog || .021);
    env.hemi = new T.HemisphereLight(o.hs || 0x9fc0d8, 0x40301e, o.hi || .55); scene.add(env.hemi); env.sun = sunLight(scene, q, [-10, 32, 8], o.sunI || 1.35, 0xffe0b0, 26);
    const fl = new T.Mesh(new T.PlaneGeometry(60, 40), G.floorMat(60, 40)); fl.rotation.x = -PI / 2; fl.position.y = -.05; fl.receiveShadow = true; root.add(fl);
    root.add(stoneWall(46, 20, 3, 0, 10, -13)); root.add(stoneWall(3, 20, 40, -23, 10, 0)); root.add(stoneWall(3, 20, 40, 23, 10, 0));
    for (let i = -2; i <= 2; i++) { root.add(pillar(i * 8.5, -11, 14, false)); root.add(pillar(-15 + 0, i * 7, 14, i === 1)); root.add(pillar(15, i * 7, 14, i === -1)); }
    for (let i = -2; i <= 2; i++) root.add(G.bevel(46, 1, 1.4, M.stoneDark, 0, 14.4, -11, .1));
    const bn = []; [-12.7, -4.2, 4.2, 12.7].forEach(x => { const b = banner(x, 8.4, -11.4, 0); root.add(b); bn.push(b); });
    const mural = new T.Mesh(new T.PlaneGeometry(14, 6), new T.MeshStandardMaterial({ map: (() => { const c = G.cv(512, 256), x = c.getContext('2d'); x.drawImage(G.stoneCanvas(9, '#8a7a5a', .3), 0, 0, 512, 256); x.strokeStyle = '#2b2012'; x.lineWidth = 4; for (let i = 0; i < 7; i++) G.drawGlyph(x, ['spiral', 'triangle', 'sun'][i % 3], 40 + i * 72, 128, 64, '#2b2012'); return G.tex(c); })(), roughness: .9 })); mural.position.set(0, 4.5, -11.45); root.add(mural);
    [[-7, -9.4], [7, -9.4], [-17, 4], [17, 4]].forEach((p, i) => { const t = G.torch(i < 2 && q.shadow > 0); t.obj.position.set(p[0], 0, p[1]); root.add(t.obj); anims.push(t.update); });
    const rays = G.godRays([{ x: -5, y: 12, z: -1, w: 5, len: 22, rz: .4 }, { x: 6, y: 12, z: 3, w: 4, len: 22, rz: -.35 }], o.ray || 0xffe6b0); root.add(rays.obj); anims.push(rays.update);
    const d = G.dust(q.dust, { w: 34, h: 13, d: 26 }); root.add(d.obj); anims.push(d.update);
    anims.push((t) => { bn.forEach((b, i) => { b.rotation.x = Math.sin(t * .9 + i) * .03; b.rotation.z = Math.sin(t * .6 + i * 2) * .02; }); });
    const sk = G.glow(o.glow || 0x6fc8ff, 28, .12); sk.position.set(0, 16, 0); root.add(sk);
    rocks(root, 6, { x: 0, z: 0, w: 40, d: 26 }, 12, M.stoneDark);
    const ferns = G.ferns(Math.round(q.ferns * .35), { x: 0, z: 0, w: 42, d: 28 }, 8, (x, z) => Math.abs(x) < 12 && Math.abs(z) < 8); ferns.position.y = -.02; root.add(ferns);
  }
  ENV.hall = function (env, q) { hallShell(env, q); };
  ENV.network = function (env, q) { hallShell(env, q, { bg: 0x0d1118, glow: 0x3f9bff, hs: 0x6fa0e0, sunI: 1.2, hi: .6, ray: 0x9fd0ff }); };
  ENV.wall = function (env, q) {
    outdoorBase(env, q, { clearX: 11, clearZ: 7, treeR: 30, hemi: .65 });
    const wall = new T.Group(); wall.add(stoneWall(34, 15, 3, 0, 7.5, 0)); wall.add(G.bevel(24, 1, 3.6, M.stoneDark, 0, 14.7, 0, .1)); wall.position.z = -6; env.root.add(wall);
    const gate = slabDoor(0, 4.6, -4.3, 5.6, 8.4, 'gate'); env.root.add(gate.g); env.door = gate; env.root.add(G.bevel(7.4, 9.8, 1.6, M.stoneWarm, 0, 5.2, -4.9, .1));
    env.root.children[env.root.children.length - 1].position.z = -5; gate.g.position.z = -4.1;
    [-8.6, 8.6].forEach(x => { const t = G.torch(true); t.obj.position.set(x, 0, -3.4); env.root.add(t.obj); env.anims.push(t.update); });
    for (let i = 0; i < 6; i++) env.root.add(G.vine(-12 + i * 4.8, 14.8, -4.3, 5 + (i % 3) * 3, i * 9)); env.root.add(G.bevel(18, .3, 12, M.floor, 0, -.04, .4, .02)); rocks(env.root, 8, { x: 0, z: 3, w: 38, d: 18 }, 22);
    waterfallCliff(env, 30, -20, 5, 18, 14);
  };
  ENV.scale = function (env, q) {
    outdoorBase(env, q, { clearX: 10, clearZ: 8, sunI: 2.5, treeR: 24, sun: [-14, 30, 18] });
    for (let i = 0; i < 8; i++) { const a = i * PI / 4 + .4, rr = 21; env.root.add(pillar(Math.cos(a) * rr, Math.sin(a) * rr * .8 - 2, 11 + (i % 3), i % 3 === 1, M.stoneMoss)); }
    env.root.add(G.bevel(22, 1.2, 4, M.stoneWarm, 0, 12, -14.6, .1)); env.root.add(stairs(0, -9, 16, 3));
    env.root.children[env.root.children.length - 1].position.y = 0; env.root.add(G.bevel(16, .3, 12, M.floor, 0, -.04, .6, .02)); rocks(env.root, 14, { x: 0, z: 2, w: 38, d: 22 }, 31);
    const t = G.torch(true); t.obj.position.set(-8, 0, -5); env.root.add(t.obj); env.anims.push(t.update); waterfallCliff(env, 32, -22, 6, 20, 5);
  };
  ENV.waterworks = function (env, q) {
    outdoorBase(env, q, { clearX: 11, clearZ: 8, sunI: 2.1, fogColor: 0xa8d3c2, treeR: 26 });
    waterfallCliff(env, -2, -19, 12, 22, 7); waterfallCliff(env, -24, -10, 4, 14, 2); waterfallCliff(env, 26, -12, 4, 16, 9);
    env.root.add(G.bevel(20, .3, 14, M.floor, 0, -.05, .8, .02)); for (let i = 0; i < 4; i++) env.root.add(pillar(-13 + i * 8.7, -8.6, 9 + (i % 2) * 2, i === 2, M.stoneMoss));
    rocks(env.root, 12, { x: 0, z: 3, w: 40, d: 20 }, 41); const sp = G.glow(0xdff6ff, 18, .16); sp.position.set(-2, 6, -15); env.root.add(sp);
  };
  ENV.niche = function (env, q) {
    const { scene, root, anims } = env; scene.background = new T.Color(0x14100c); scene.fog = new T.FogExp2(0x1a140e, .03);
    env.hemi = new T.HemisphereLight(0xb5946a, 0x2a1d10, .6); scene.add(env.hemi); env.sun = sunLight(scene, q, [-8, 22, 12], 1.1, 0xffc890, 20);
    const fl = new T.Mesh(new T.PlaneGeometry(40, 26), G.floorMat(40, 26)); fl.rotation.x = -PI / 2; fl.position.y = -.04; fl.receiveShadow = true; root.add(fl);
    root.add(stoneWall(30, 14, 2, 0, 7, -7)); root.add(stoneWall(2, 14, 20, -15, 7, 0)); root.add(stoneWall(2, 14, 20, 15, 7, 0)); root.add(G.bevel(32, 1.6, 22, M.stoneDark, 0, 14.6, -1, .1));
    [-1, 1].forEach(s => { root.add(pillar(s * 9, -5.6, 12, false)); root.add(pillar(s * 9, 6, 12, false)); });
    [-12, -6, 6, 12].forEach((x, i) => { const t = G.torch(i === 1 || i === 2); t.obj.position.set(x, 0, -6); root.add(t.obj); anims.push(t.update); });
    const d = G.dust(q.dust, { w: 26, h: 10, d: 18 }); root.add(d.obj); anims.push(d.update); const rays = G.godRays([{ x: -4, y: 10, z: -1, w: 4, len: 18, rz: .3 }], 0xffd9a0); root.add(rays.obj); anims.push(rays.update);
    for (let i = 0; i < 4; i++) root.add(G.vine(-12 + i * 8, 13.6, -6, 5 + i, i * 3)); rocks(root, 5, { x: 0, z: 4, w: 26, d: 8 }, 19, M.stoneDark);
  };
  ENV.ravine = function (env, q) {
    const { scene, root, anims } = env; scene.background = new T.Color(0xa6cfd9); scene.fog = new T.FogExp2(0xa6cfd9, .0085);
    root.add(G.sky('#3a83d4', '#a8d4ea', '#f3e7c4'));
    env.hemi = new T.HemisphereLight(0xaed4ff, 0x4a5a3a, .55); scene.add(env.hemi); env.sun = sunLight(scene, q, [-14, 30, 16], 1.7, 0xffdca8, 30);
    root.add(G.bevel(90, 20, 8, M.stoneDark, 0, -10.5, -10.5, .3)); root.add(G.bevel(90, 20, 8, M.stoneDark, 0, -13.5, 10.5, .3));
    const river = G.water(90, 24, new T.Vector3(.4, .8, .3)); river.obj.position.y = -9; root.add(river.obj); anims.push(river.update);
    [-1, 1].forEach(s => { root.add(G.bevel(26, 14, 24, M.stoneMoss, s * 30, -7, 0, .3)); });
    const wf = G.waterfall(9, 20); wf.obj.position.set(-4, -9, -6.4); root.add(wf.obj); anims.push(wf.update);
    for (let i = 0; i < 5; i++) { const a = arch(-34 + i * 17, -34, 10, 11); a.scale.setScalar(1.35); root.add(a); } root.add(G.bevel(96, 2.2, 5, M.stoneWarm, 0, 15, -34, .2));
    root.add(G.trees(q.trees, 38, 22, 8)); [-1, 1].forEach(s => { const f = G.ferns(Math.round(q.ferns * .4), { x: s * 20, z: 0, w: 13, d: 22 }, 5 + (s > 0 ? 1 : 0)); root.add(f); });
    const d = G.dust(q.dust, { w: 50, h: 14, d: 28 }); d.obj.position.y = -1; root.add(d.obj); anims.push(d.update);
    const rays = G.godRays([{ x: -9, y: 12, z: -3, w: 6, len: 28, rz: .5 }, { x: 4, y: 12, z: -6, w: 6, len: 28, rz: .5 }], 0xffe6b0); root.add(rays.obj); anims.push(rays.update);
    const door = slabDoor(0, 0, 0, 4.4, 6.6, 'gate'); door.g.position.set(17.2, 3.3, 0); door.g.rotation.y = -PI / 2; root.add(door.g); env.door = door; root.add(G.bevel(2, 9, 7.4, M.stoneWarm, 18.4, 4.2, 0, .1)); root.add(G.bevel(6, 11, 12, M.stoneDark, 21, 5, 0, .2));
    [-1, 1].forEach(s => { const tt = G.torch(s > 0); tt.obj.position.set(15.8, 0, s * 4.6); root.add(tt.obj); anims.push(tt.update); });
    const tt2 = G.torch(false); tt2.obj.position.set(-15.8, 0, -4.6); root.add(tt2.obj); anims.push(tt2.update);
  };
  ENV.trap = function (env, q) {
    const { scene, root, anims } = env; scene.background = new T.Color(0x120d0c); scene.fog = new T.FogExp2(0x1d1210, .028);
    env.hemi = new T.HemisphereLight(0xc09070, 0x2a1810, .5); scene.add(env.hemi); env.sun = sunLight(scene, q, [-8, 24, 14], 1.2, 0xffb890, 20);
    const fl = new T.Mesh(new T.PlaneGeometry(40, 28), G.floorMat(40, 28)); fl.rotation.x = -PI / 2; fl.position.y = -.05; fl.receiveShadow = true; root.add(fl);
    root.add(stoneWall(30, 15, 2, 0, 7.5, -9)); root.add(stoneWall(2, 15, 24, -15, 7.5, 0)); root.add(stoneWall(2, 15, 24, 15, 7.5, 0)); root.add(G.bevel(32, 1.5, 24, M.stoneDark, 0, 15.2, 0, .1));
    const door = slabDoor(0, 3.2, -7.9, 4.6, 6.4, 'drop'); root.add(door.g); env.door = door; root.add(G.bevel(6.2, 7.6, 1, M.stoneWarm, 0, 3.8, -8.4, .08));
    // mural clue wall: travellers' footsteps and dust
    const c = G.cv(768, 256), x = c.getContext('2d'); x.drawImage(G.stoneCanvas(17, '#86764f', .2), 0, 0, 768, 256); x.strokeStyle = '#2b2012'; x.lineWidth = 6; x.strokeRect(8, 8, 752, 240);
    for (let i = 0; i < 3; i++) { x.fillStyle = '#2b2012'; for (let k = 0; k < 5 - i * 2 + 1; k++) { x.beginPath(); x.ellipse(70 + i * 245 + k * 30, 158 - (k % 2) * 14, 9, 15, .3, 0, 7); x.fill(); } G.drawGlyph(x, ['spiral', 'triangle', 'sun'][i], 120 + i * 245, 70, 76, '#2b2012'); }
    const mural = new T.Mesh(new T.PlaneGeometry(12, 4), new T.MeshStandardMaterial({ map: G.tex(c), roughness: .9 })); mural.position.set(0, 10.5, -7.8); root.add(mural);
    [-9, 9, -12, 12].forEach((px, i) => { const t = G.torch(i < 2); t.obj.position.set(px, 0, i < 2 ? -7 : 3); root.add(t.obj); anims.push(t.update); });
    const d = G.dust(q.dust, { w: 26, h: 10, d: 20 }); root.add(d.obj); anims.push(d.update); for (let i = 0; i < 3; i++) root.add(pillar(-8 + i * 8, -7.2, 13, false)); rocks(root, 5, { x: 0, z: 6, w: 26, d: 8 }, 23, M.stoneDark);
  };
  function coreCentre(env, q, accent) {
    const { scene, root, anims } = env; accent = accent === undefined ? 0x1fa8ff : accent;
    // the Mind Core
    const core = new T.Group(); core.position.set(0, 0, 0); const base = G.cyl(5.2, 6, 1.2, M.stoneDark, 0, .6, 0, 40); core.add(base); [3.8, 5].forEach((r, i) => { const rg = new T.Mesh(new T.TorusGeometry(r, .1, 8, 60), new T.MeshStandardMaterial({ color: 0xd9a441, emissive: 0x2ab7ff, emissiveIntensity: .1, metalness: .85, roughness: .3 })); rg.rotation.x = PI / 2; rg.position.y = 1.25; core.add(rg); core.userData['f' + i] = rg; });
    const crys = new T.Mesh(new T.OctahedronGeometry(2.1, 0), new T.MeshStandardMaterial({ color: 0x2c4a66, emissive: accent, emissiveIntensity: .15, metalness: .3, roughness: .12, transparent: true, opacity: .93, envMapIntensity: 1.6 })); crys.scale.set(.85, 1.6, .85); crys.position.y = 5.2; crys.castShadow = true; core.add(crys);
    const rings = [0, 1, 2].map(i => { const r = new T.Mesh(new T.TorusGeometry(3.6 + i * .5, .09, 8, 60), M.gold); r.position.y = 5.2; core.add(r); return r; });
    const halo = G.glow(accent, 22, .15); halo.position.y = 5.2; core.add(halo); const beam = new T.Mesh(new T.CylinderGeometry(1.2, 2.6, 40, 20, 1, true), new T.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); beam.position.y = 24; core.add(beam);
    const light = new T.PointLight(accent, 0, 60, 2); light.position.y = 5.2; core.add(light); root.add(core);
    // five conduits from the stations to the core
    env.coreLevel = 0; env.conduits = []; env.coreMats = [];
    env.def.stages.forEach((st, i) => { const o = st.view; if (!o) return; const L = Math.hypot(o.x, o.z) - 9, ang = Math.atan2(o.z, o.x); const line = new T.Mesh(new T.BoxGeometry(L, .05, .5), new T.MeshBasicMaterial({ color: 0x2a3340 })); line.position.set(Math.cos(ang) * (L / 2 + 7), .03, Math.sin(ang) * (L / 2 + 7)); line.rotation.y = -ang; root.add(line); env.coreMats.push(line.material); });
    env.setCore = lv => { env.coreLevel = lv; };
    env.stageAnchors = [];
    anims.push((t, dt) => {
      const lv = env.coreLevel, f = Math.min(1, lv / Math.max(1, env.def.stages.length)), act = env.coreFinal || 0;
      crys.rotation.y = t * (.4 + f * .8 + act * 2); rings.forEach((r, i) => { r.rotation.set(t * (.5 + i * .3) * (i % 2 ? -1 : 1) * (1 + act * 2), t * .4 * (i + 1), i * 1.05); });
      crys.material.emissiveIntensity = .15 + f * .9 + act * 1.6; halo.material.opacity = .15 + f * .35 + act * .5; halo.scale.setScalar(22 + act * 14 + Math.sin(t * 3) * 1.2); light.intensity = f * 1.6 + act * 5; beam.material.opacity = act * .45; crys.position.y = 5.2 + Math.sin(t * 1.3) * .25;
      [core.userData.f0, core.userData.f1].forEach(r => { r.material.emissiveIntensity = .1 + f * 1.2 + act * 2; });
      env.coreMats.forEach((m, i) => { m.color.setHex(i < lv || act ? accent : 0x2a3340); });
    });
    const rays = G.godRays([{ x: 0, y: 30, z: 0, w: 14, len: 62, rz: 0 }], 0x9fd8ff); root.add(rays.obj); anims.push(rays.update); const d = G.dust(q.dust * 2, { w: 80, h: 30, d: 80 }); root.add(d.obj); anims.push(d.update);
    const door = { g: new T.Group(), set(k) { env.coreFinal = k; }, f: 0 }; env.door = door;
  }
  ENV.core = function (env, q) {
    const { scene, root, anims } = env; scene.background = new T.Color(0x070d16); scene.fog = new T.FogExp2(0x0a1320, .0095);
    env.hemi = new T.HemisphereLight(0x6fa8ff, 0x1a1a22, .55); scene.add(env.hemi); env.sun = sunLight(scene, q, [-20, 60, 25], 1.15, 0xcfe0ff, 62);
    const fl = new T.Mesh(new T.CircleGeometry(66, 60), G.floorMat(132, 132)); fl.rotation.x = -PI / 2; fl.position.y = -.06; fl.receiveShadow = true; root.add(fl);
    for (let i = 0; i < 24; i++) { const a = i * PI / 12, r = 62; root.add(pillar(Math.cos(a) * r, Math.sin(a) * r, 24 + (i % 2) * 3, false, M.stoneDark)); }
    for (let i = 0; i < 3; i++) { const t = new T.Mesh(new T.TorusGeometry(48 - i * 6, .5, 8, 80), M.gold); t.rotation.x = PI / 2; t.position.y = 24 - i * .3 + 6; root.add(t); }
    const dome = new T.Mesh(new T.SphereGeometry(70, 32, 18, 0, PI * 2, 0, PI / 2), new T.MeshStandardMaterial({ map: G.tex(G.stoneCanvas(5, '#4a4535', .2), [12, 6]), side: T.BackSide, roughness: 1 })); dome.position.y = 12; root.add(dome);
    coreCentre(env, q);
    for (let i = 0; i < 16; i++) { const a = i * PI / 8, t = G.torch(false); t.obj.position.set(Math.cos(a) * 12, 0, Math.sin(a) * 12 * .9 + 0); t.obj.scale.setScalar(.8); if (i % 2) root.add(t.obj), anims.push(t.update); }
  };

  /* generated levels: a procedural look (layout + floor + sky + accent), plus the Mind Core in the middle for multi-stage rooms */
  ENV.look = function (env, q) {
    const lk = env.def.look; MV.looks.build(env, q, lk, env.def);
    if (env.def.stages.length > 1) { coreCentre(env, q, lk.accent); }
  };

  const THEMES = {
    ocean: { fog: 0x1d5a6a, sun: 0x9fe0ff, sunK: .9, hemiSky: 0x6fd0ff, hemiGround: 0x1a4a56, skyTop: '#0b3a66', skyMid: '#2a8ca8', skyBot: '#a8e8e0', tintFog: .0095 },
    dusk: { fog: 0x4a2f55, sun: 0xffb27a, sunK: .85, hemiSky: 0xd89cff, hemiGround: 0x4a2a30, skyTop: '#241044', skyMid: '#b2467a', skyBot: '#ffc27a', tintFog: .009 }
  };
  function applyTheme(env, name) {
    const th = THEMES[name]; if (!th) return; const { scene, root } = env, c = new T.Color(th.fog), hasSky = root.children.some(o => o.isMesh && o.renderOrder === -10);
    const k = hasSky ? 1 : .3;                                  // outdoor scenes take the full colour; indoor halls only a tint, so they stay dark and readable
    if (scene.background && scene.background.isColor) scene.background.lerp(c, k);
    if (scene.fog) scene.fog.color.lerp(c, k);
    if (env.sun) { env.sun.color.lerp(new T.Color(th.sun), .6); env.sun.intensity *= hasSky ? th.sunK : 1; }
    if (env.hemi) { env.hemi.color.lerp(new T.Color(th.hemiSky), .5); env.hemi.groundColor.lerp(new T.Color(th.hemiGround), .5); }
    if (hasSky) { root.children.filter(o => o.isMesh && o.renderOrder === -10).forEach(o => root.remove(o)); root.add(G.sky(th.skyTop, th.skyMid, th.skyBot)); }
  }

  /* ---------- the world manager ---------- */
  MV.createWorld = function (canvas, opts) {
    opts = opts || {}; let qName = opts.quality && QUALITY[opts.quality] ? opts.quality : 'medium', q = QUALITY[qName];
    const renderer = G.makeRenderer(canvas, { aa: q.post ? false : q.aa || (QUALITY.low === q && false), shadow: q.shadow, preserve: opts.preserve }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.dpr));
    let post = null, sizeW = 2, sizeH = 2; const mkPost = () => { if (post) { post.dispose(); post = null; } renderer.toneMapping = q.post ? T.NoToneMapping : T.ACESFilmicToneMapping; if (q.post) { try { post = G.Post(renderer, q); post.setSize(sizeW, sizeH); } catch (e) { console.warn('post-processing off', e); post = null; renderer.toneMapping = T.ACESFilmicToneMapping; } } }; mkPost();
    G.initMaterials(); const scene = new T.Scene(), envTex = G.envMap(renderer); scene.environment = envTex;
    const camera = new T.PerspectiveCamera(42, 1, .4, 320), W = { renderer, scene, camera, q, qName, views: [], env: null, anims: [], time: 0, relic: null };
    G.initMaterials.done = true;
    const base = { az: 0, el: 34, d: 17, t: new T.Vector3(0, 1, 0) }, cur = { az: 0, el: 34, d: 17, t: new T.Vector3(0, 1, 0) }, user = { az: 0, el: 0, zoom: 1, vaz: 0, vel: 0 };
    let shake = 0, root = null, fx = null, def = null, stageVs = [], curStage = 0, cameraLock = false;
    W.setSize = function (w, h) { sizeW = w; sizeH = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); W.aspect = w / h; if (post) post.setSize(w, h); if (W.refit) W.refit(); };
    W.setQuality = function (name) {
      if (!QUALITY[name]) return; qName = W.qName = name; q = W.q = QUALITY[name]; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.dpr)); renderer.shadowMap.enabled = q.shadow > 0; mkPost(); if (opts.onQuality) opts.onQuality(name);
      if (def) W.load(def, W.game, true);
    };
    function clearAll() {
      if (root) { scene.remove(root); root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
      scene.children.slice().forEach(c => { if (c.isLight || c.isHemisphereLight) scene.remove(c); }); scene.fog = null; root = new T.Group(); scene.add(root); W.anims = []; stageVs = []; W.views = stageVs;
    }
    W.load = function (levelDef, game, keepCam) {
      def = levelDef; W.game = game; clearAll();
      fx = G.spark(root, q.spark); W.fx = fx; const env = { scene, root, anims: W.anims, def }; W.env = env; env.q = q;
      const ctx = { baseMat: levelDef.look ? MV.looks.boxFloorMat(levelDef.look.floor) : null, fx, sfx: n => opts.onSfx && opts.onSfx(n), exitDoor: null, onWalkEnd: () => opts.onWalkEnd && opts.onWalkEnd() };
      (ENV[levelDef.env] || ENV.hall)(env, q);
      if (levelDef.env !== 'look') applyTheme(env, levelDef.theme);
      levelDef.stages.forEach((st, i) => {
        const v = MV.stages[st.kind](Object.assign({}, ctx, { doorPos: [0, -7.5] }), st); const o = st.view || { x: 0, z: 0 }; v.root.position.set(o.x, 0, o.z); v.root.rotation.y = o.rot || 0; v.stageDef = st; v.idx = i; root.add(v.root); stageVs.push(v); W.anims.push(v.update);
      });
      // relic
      const rl = levelDef.relic; if (rl) {
        const g = new T.Group(), s = new T.Mesh(new T.OctahedronGeometry(.36, 0), new T.MeshStandardMaterial({ color: 0xffd36a, emissive: 0xffa927, emissiveIntensity: 1.1, metalness: .8, roughness: .25, envMapIntensity: 1.5 })); s.scale.y = 1.6; s.castShadow = true; g.add(s); const gl = G.glow(0xffc766, 2.6, .55); g.add(gl); g.add(G.hit('relic', .9, 1.8, 0)); G.tagAll(g, 'relic'); g.position.set(rl.x, rl.y, rl.z); root.add(g);
        W.relic = { g, s, gl, base: rl.y, taken: false, t: 0 }; W.anims.push((t, dt) => { const r = W.relic; if (!r) return; if (r.taken) { r.t += dt; g.position.y += dt * 6; g.scale.multiplyScalar(1 - dt * 1.4); gl.material.opacity = Math.max(0, .6 - r.t); if (r.t > .9) g.visible = false; return; } s.rotation.y = t * 1.6; g.position.y = r.base + Math.sin(t * 2.1) * .18; gl.material.opacity = .4 + .2 * Math.sin(t * 3); });
      }
      root.traverse(o => { const m = o.material; if (m && m.isMeshStandardMaterial && m.metalness < .5 && m.envMapIntensity === 1) m.envMapIntensity = .3; });
      W.setStage(game ? game.stage : 0, true); W.sync(game, true);
      if (!keepCam) { Object.assign(user, { az: 0, el: 0, zoom: 1, vaz: 0, vel: 0 }); }
      const r = envCam(); base.az = cur.az = r.az; base.el = cur.el = r.el; base.d = cur.d = r.d; base.t.copy(r.t); cur.t.copy(r.t);
    };
    function fitCam(r, fitW) {
      const asp = W.aspect || 1, vfov = 42 * D2R, hfov = 2 * Math.atan(Math.tan(vfov / 2) * asp);
      if (fitW && asp < 1.5) { const need = (fitW / 2) / Math.tan(hfov / 2) * 1.06; if (need > r.d) r.d = Math.min(need, 46); if (asp < .85) r.el = Math.min(64, r.el + (.85 - asp) * 30); }
      return r;
    }
    function envCam() { const r0 = envCam0(), v = stageVs[curStage]; return fitCam(r0, v && v.fitW); }
    W.refit = function () { if (!def || !stageVs.length) return; const r = envCam(); base.az = r.az; base.el = r.el; base.d = r.d; base.t.copy(r.t); };
    function envCam0() { const vw = def.stages[curStage].view, c = (vw && vw.cam) || def.cam, o = vw || { x: 0, z: 0, rot: 0 }, rot = o.rot || 0, cs = Math.cos(rot), sn = Math.sin(rot), lx = c.t[0], lz = c.t[2]; return { az: c.az + rot / D2R, el: c.el, d: c.d, t: new T.Vector3(o.x + lx * cs + lz * sn, c.t[1], o.z - lx * sn + lz * cs) }; }
    W.setStage = function (i, instant) { curStage = i; stageVs.forEach((v, k) => { v.setLocked(k > i); v.setDone(k < i); }); if (def.env === 'core' && W.env) W.env.setCore(i); const r = envCam(); base.az = r.az; base.el = r.el; base.d = r.d; base.t.copy(r.t); if (instant) { cur.az = r.az; cur.el = r.el; cur.d = r.d; cur.t.copy(r.t); } };
    W.view = () => stageVs[curStage];
    W.sync = function (game, instant) { if (!game) return; stageVs.forEach((v, i) => { v.sync(game.states[i], instant); }); };
    W.update = function (dt) {
      W.time += dt; const t = W.time; for (let i = 0; i < W.anims.length; i++) W.anims[i](t, dt);
      const k = Math.min(1, dt * 8), kt = Math.min(1, dt * 3.2); cur.az += (base.az + user.az - cur.az) * k; cur.el += (Math.max(10, Math.min(82, base.el + user.el)) - cur.el) * k; cur.d += (Math.max(5, base.d * user.zoom) - cur.d) * k; cur.t.lerp(base.t, kt);
      if (Math.abs(user.vaz) > .01 || Math.abs(user.vel) > .01) { user.az += user.vaz * dt; user.el = Math.max(-26, Math.min(36, user.el + user.vel * dt)); const f = Math.pow(.04, dt); user.vaz *= f; user.vel *= f; }
      const sway = opts.reduceMotion && opts.reduceMotion() ? 0 : 1, az = (cur.az + Math.sin(t * .25) * .35 * sway) * D2R, el = (cur.el) * D2R;
      camera.position.set(cur.t.x + cur.d * Math.sin(az) * Math.cos(el), cur.t.y + cur.d * Math.sin(el), cur.t.z + cur.d * Math.cos(az) * Math.cos(el));
      if (shake > 0) { camera.position.x += (Math.random() - .5) * shake; camera.position.y += (Math.random() - .5) * shake; shake = Math.max(0, shake - dt * 1.6); }
      camera.lookAt(cur.t); camera.updateMatrixWorld();
    };
    W.render = () => { if (post) post.render(scene, camera, W.time); else renderer.render(scene, camera); };
    W.orbit = (dx, dy) => { const a = dx * .3, e = dy * .22; user.az -= a; user.el = Math.max(-26, Math.min(36, user.el + e)); user.vaz = -a * 16; user.vel = e * 16; };      // free turning, with a little momentum when you let go
    W.gesture = (dAz, dEl, zf) => { user.az += dAz; user.el = Math.max(-26, Math.min(36, user.el + dEl)); if (zf && zf > 0) user.zoom = Math.max(.4, Math.min(1.9, user.zoom * zf)); user.vaz = user.vel = 0; };
    W.getUser = () => ({ az: user.az, el: user.el, zoom: user.zoom });
    W.zoom = f => { user.zoom = Math.max(.4, Math.min(1.9, user.zoom * f)); };
    W.setUser = (az, el) => { user.az = az; if (el != null) user.el = el; };
    W.resetCam = () => { const turns = Math.round(user.az / 360) * 360; cur.az -= turns; user.az = 0; user.el = 0; user.zoom = 1; user.vaz = user.vel = 0; };           // shortest way back
    W.shake = a => { if (!(opts.reduceMotion && opts.reduceMotion())) shake = Math.max(shake, a); };
    W.pickRay = function (cx, cy) {
      const rc = new T.Raycaster(), r = canvas.getBoundingClientRect(); rc.setFromCamera(new T.Vector2((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera); return rc;
    };
    W.pick = function (cx, cy) {
      const rc = W.pickRay(cx, cy), roots = [];
      const v = stageVs[curStage]; if (v) roots.push(v.root); if (W.relic && !W.relic.taken) roots.push(W.relic.g);
      if (W.env && W.env.pickables) W.env.pickables.forEach(p => roots.push(p));
      const hits = rc.intersectObjects(roots, true).filter(h => h.object.userData.oid != null && h.object.userData.oid !== '' && h.object.visible !== false || (h.object.userData.hit && h.object.userData.oid));
      if (!hits.length) return null; const h = hits[0]; return { oid: h.object.userData.oid, point: h.point, stage: curStage };
    };
    W.groundPoint = function (cx, cy, y) {
      const rc = W.pickRay(cx, cy), pl = new T.Plane(new T.Vector3(0, 1, 0), -y), p = new T.Vector3(); return rc.ray.intersectPlane(pl, p) ? p : null;
    };
    W.worldToScreen = function (v3) { const p = v3.clone().project(camera), r = canvas.getBoundingClientRect(); return { x: (p.x + 1) / 2 * r.width + r.left, y: (1 - p.y) / 2 * r.height + r.top, behind: p.z > 1 }; };
    W.objectPos = function (oid) { const v = stageVs[curStage], o = v && v.objs[oid]; if (!o) return null; if (v.pickPoint) { const q = v.pickPoint(oid); if (q) return o.g.localToWorld(new T.Vector3(q.x, q.y, q.z)); } const p = new T.Vector3(); o.g.getWorldPosition(p); return p; };
    W.finale = function () {
      if (W.env && W.env.door) { const d = W.env.door; let k = 0; const f = (t, dt) => { k = Math.min(1, k + dt * .5); d.set(G.ease(k)); if (k >= 1) { const i = W.anims.indexOf(f); if (i >= 0) W.anims.splice(i, 1); } }; W.anims.push(f); }
      const v = stageVs[stageVs.length - 1]; if (v && v.finale) v.finale();
      stageVs.forEach(s => s.setDone(true)); shake = .35;
    };
    W.takeRelic = function () { if (!W.relic || W.relic.taken) return false; W.relic.taken = true; W.relic.t = 0; const p = W.relic.g.position; fx.burst(p.x, p.y, p.z, 40, 0xffd36a, 5); return true; };
    W.hideRelic = function () { if (W.relic) { W.relic.taken = true; W.relic.g.visible = false; } };
    W.glowObj = function (oid, on) { const v = stageVs[curStage]; if (!v) return; const o = v.objs[oid]; if (!o) return; o.g.traverse(m => { if (m.isMesh && m.material && m.material.emissive && !m.userData.keep) { m.userData._e = m.userData._e == null ? m.material.emissiveIntensity : m.userData._e; m.material.emissiveIntensity = on ? Math.max(1.4, m.userData._e + 1.2) : m.userData._e; } }); };
    W.dispose = () => { renderer.dispose(); };
    return W;
  };
})();
