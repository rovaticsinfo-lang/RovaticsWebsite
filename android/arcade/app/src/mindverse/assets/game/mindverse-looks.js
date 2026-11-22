/* MindVerse - procedural "looks". Every generated level gets its own place: a layout (colonnade, cavern, reef, forge ...),
 * a floor, a sky and lighting mood, and an accent colour, all derived from the level's look data, so no two levels look alike.
 * look = { layout, floor, sky, accent, seed, clear: {x, z}, multi } */
(function () {
  'use strict';
  const T = THREE, MV = (window.MV = window.MV || {}), G = MV.gfx, PI = Math.PI, L = (MV.looks = {});

  /* ---------- palettes ---------- */
  L.SKIES = {
    day: { top: '#3a8fe0', mid: '#bfe0f2', bot: '#f4e6bc', fog: 0x9fb98f, fd: .0085, sun: 0xffd7a0, si: 1.55, hs: 0xaed4ff, hg: 0x3a5220, hi: .42, stars: 0, sunPos: [-16, 28, 14] },
    dawn: { top: '#4d3f8a', mid: '#f0a07a', bot: '#ffe0a0', fog: 0xc88a78, fd: .0095, sun: 0xffb27a, si: 1.35, hs: 0xffc9a8, hg: 0x4a3030, hi: .45, stars: 0, sunPos: [22, 12, 12] },
    dusk: { top: '#241044', mid: '#b2467a', bot: '#ffc27a', fog: 0x4a2f55, fd: .009, sun: 0xff9a66, si: 1.2, hs: 0xd89cff, hg: 0x3a2030, hi: .4, stars: 1, sunPos: [-24, 9, 10] },
    night: { top: '#02061a', mid: '#0b2048', bot: '#16386a', fog: 0x07142a, fd: .011, sun: 0x9fb8ff, si: .85, hs: 0x5070c0, hg: 0x10182a, hi: .42, stars: 2, moon: 1, sunPos: [14, 30, 10] },
    storm: { top: '#1e2630', mid: '#46505e', bot: '#7a8794', fog: 0x3a4450, fd: .014, sun: 0xcad8e8, si: .9, hs: 0x8a9cb0, hg: 0x1e2630, hi: .5, stars: 0, rain: 1, sunPos: [-8, 26, 16] },
    aurora: { top: '#02101a', mid: '#0a3a4a', bot: '#1a6a5a', fog: 0x06202a, fd: .011, sun: 0xa8ffe0, si: .8, hs: 0x60e0c0, hg: 0x0a2030, hi: .42, stars: 2, aurora: 1, sunPos: [10, 28, 12] },
    void: { top: '#050010', mid: '#1a0a3a', bot: '#3a1060', fog: 0x10062a, fd: .01, sun: 0xd0a0ff, si: .85, hs: 0x9060ff, hg: 0x180828, hi: .45, stars: 3, sunPos: [-12, 30, 8] },
    ember: { top: '#240808', mid: '#6a1a10', bot: '#ff8a30', fog: 0x3a1008, fd: .013, sun: 0xff7a30, si: 1.0, hs: 0xff9060, hg: 0x300c08, hi: .45, stars: 0, embers: 1, sunPos: [-14, 22, 18] },
    ocean: { top: '#06304a', mid: '#0f7a96', bot: '#7fe0e0', fog: 0x0e5a70, fd: .012, sun: 0x9fe8ff, si: 1.0, hs: 0x6fd8ff, hg: 0x104050, hi: .5, stars: 0, bubbles: 1, sunPos: [-6, 30, 10] },
    frost: { top: '#8fc8ff', mid: '#d8f0ff', bot: '#ffffff', fog: 0xcfe8f5, fd: .01, sun: 0xeaf6ff, si: 1.3, hs: 0xcfe8ff, hg: 0x8aa8c0, hi: .55, stars: 0, snow: 1, sunPos: [-18, 24, 12] }
  };
  L.FLOORS = {
    flag: { h: 32, s: 14, l: 30, moss: 1, rough: .74, metal: 0 }, moss: { h: 95, s: 26, l: 26, moss: 3, rough: .86, metal: 0 }, sand: { h: 38, s: 40, l: 50, moss: 0, rough: .9, metal: 0 },
    obsidian: { h: 270, s: 22, l: 11, moss: 0, rough: .22, metal: .45 }, marble: { h: 42, s: 6, l: 58, moss: 0, rough: .35, metal: .05 }, ice: { h: 200, s: 40, l: 52, moss: 0, rough: .18, metal: .1 },
    ember: { h: 12, s: 42, l: 18, moss: 0, rough: .7, metal: .1 }, slate: { h: 215, s: 12, l: 24, moss: 1, rough: .6, metal: .05 }, jade: { h: 150, s: 34, l: 30, moss: 1, rough: .5, metal: .08 }
  };
  L.ACCENTS = [0x37d8ff, 0xffb040, 0xff5a7a, 0x7be3a0, 0xc08aff, 0xffe066, 0x5aa0ff, 0xff8a50];

  const rngOf = G.rng;
  const floorCache = {};
  function floorMat(name, w, d) {
    const f = L.FLOORS[name] || L.FLOORS.flag, key = name;
    if (!floorCache[key]) { const c = G.tileCanvas(41 + name.length * 7, false, f), b = G.tileCanvas(41 + name.length * 7, true); floorCache[key] = { c, b }; }
    const fc = floorCache[key];
    return new T.MeshStandardMaterial({ map: G.tex(fc.c, [w / 8, d / 8]), bumpMap: G.tex(fc.b, [w / 8, d / 8], false), bumpScale: 2.2, roughness: f.rough, metalness: f.metal, envMapIntensity: name === 'obsidian' || name === 'ice' ? .9 : .35 });
  }

  L.boxFloorMat = function (name) {                          // the board under the puzzle: the same stone as the floor, a little darker, so the board still reads
    const f = L.FLOORS[name] || L.FLOORS.flag; if (!floorCache[name]) { const c = G.tileCanvas(41 + name.length * 7, false, f), b = G.tileCanvas(41 + name.length * 7, true); floorCache[name] = { c, b }; }
    const fc = floorCache[name], m = new T.MeshStandardMaterial({ map: G.tex(fc.c, [.25, .25]), bumpMap: G.tex(fc.b, [.25, .25], false), bumpScale: 2.2, roughness: f.rough, metalness: f.metal, envMapIntensity: .35 }); m.color.setScalar(.72); return m;
  };

  /* ---------- little builders ---------- */
  const M = () => G.mat;
  function column(h, r, mat, accent) { const g = new T.Group(); g.add(G.bevel(r * 2.6, .5, r * 2.6, M().stoneDark, 0, .25, 0, .06), G.cyl(r, r * 1.08, h, mat || M().stone, 0, .5 + h / 2, 0, 14), G.bevel(r * 2.6, .5, r * 2.6, M().stoneDark, 0, .75 + h, 0, .06)); if (accent !== undefined) { const b = new T.Mesh(new T.TorusGeometry(r * 1.04, .06, 6, 18), new T.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.2 })); b.rotation.x = PI / 2; b.position.y = h * .6; g.add(b); } return g; }
  function crystalCluster(color, n, r, seed) {
    const g = new T.Group(), rn = rngOf(seed), mat = new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, metalness: .2, roughness: .2, transparent: true, opacity: .9 });
    for (let i = 0; i < n; i++) { const h = r * (1.2 + rn() * 2.2), c = new T.Mesh(new T.ConeGeometry(r * (.25 + rn() * .3), h, 5), mat); c.position.set((rn() - .5) * r * 2.2, h / 2, (rn() - .5) * r * 2.2); c.rotation.set((rn() - .5) * .5, rn() * 6, (rn() - .5) * .5); g.add(c); }
    const gl = G.glow(color, r * 5, .5); gl.position.y = r * 1.4; g.add(gl); return g;
  }
  function stars(count, rad, seed, bright) {
    const rn = rngOf(seed), pos = new Float32Array(count * 3); for (let i = 0; i < count; i++) { const a = rn() * PI * 2, e = .08 + rn() * 1.3; pos[i * 3] = Math.cos(a) * Math.cos(e) * rad; pos[i * 3 + 1] = Math.sin(e) * rad; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * rad; }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); G._gt = G._gt || G.tex(G.glowCanvas()); return new T.Points(g, new T.PointsMaterial({ map: G._gt, size: bright || 3, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, sizeAttenuation: false, color: 0xffffff }));
  }
  function particles(count, box, color, fall, size) {                       // rain / snow / embers / bubbles
    const rn = rngOf(count + 7), pos = new Float32Array(count * 3), vel = []; for (let i = 0; i < count; i++) { pos[i * 3] = (rn() - .5) * box.w; pos[i * 3 + 1] = rn() * box.h; pos[i * 3 + 2] = (rn() - .5) * box.d; vel.push(.6 + rn() * .8); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); G._gt = G._gt || G.tex(G.glowCanvas()); const m = new T.PointsMaterial({ map: G._gt, size: size || .3, transparent: true, depthWrite: false, blending: T.AdditiveBlending, color, opacity: .8 });
    return { obj: new T.Points(g, m), update(t, dt) { const a = g.attributes.position; for (let i = 0; i < count; i++) { a.array[i * 3 + 1] += fall * vel[i] * dt; a.array[i * 3] += Math.sin(t * .7 + i) * .25 * dt; if (fall < 0 && a.array[i * 3 + 1] < 0) a.array[i * 3 + 1] = box.h; if (fall > 0 && a.array[i * 3 + 1] > box.h) a.array[i * 3 + 1] = 0; } a.needsUpdate = true; } };
  }
  function cloudBank(root, y, seed, color) { const rn = rngOf(seed); for (let i = 0; i < 14; i++) { const s = G.glow(color || 0xffffff, 26 + rn() * 26, .32); s.position.set((rn() - .5) * 150, y + rn() * 8, (rn() - .5) * 150); root.add(s); } }
  function statue(mat, accent) {
    const g = new T.Group(); g.add(G.bevel(2.4, 1.2, 2.4, M().stoneDark, 0, .6, 0, .08), G.bevel(1.7, 3.2, 1.2, mat || M().stone, 0, 2.8, 0, .12)); const head = new T.Mesh(new T.SphereGeometry(.8, 14, 12), mat || M().stone); head.position.y = 5; head.scale.set(1, 1.15, .95); head.castShadow = true; g.add(head);
    [-1, 1].forEach(s => { const e = new T.Mesh(new T.SphereGeometry(.14, 8, 8), new T.MeshBasicMaterial({ color: accent })); e.position.set(s * .28, 5.1, .72); g.add(e); const arm = G.bevel(.5, 2.4, .5, mat || M().stone, s * 1.2, 2.6, .1, .06); arm.rotation.z = s * .12; g.add(arm); });
    return g;
  }
  function addTorch(env, x, z, color, light) { const tr = G.torch(!!light, color); tr.obj.position.set(x, 0, z); env.root.add(tr.obj); env.anims.push(tr.update); }


  /* glowing floor inlay in the accent colour: a different pattern per level, visible even from straight above */
  function inlay(env, lk, rn, A) {
    const { root, anims } = env, R = lk.R0 + 1.5, mat = new T.MeshBasicMaterial({ color: A, transparent: true, opacity: .75, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }), kind = lk.seed % 6, g = new T.Group();
    const ring = (r, w) => { const m = new T.Mesh(new T.RingGeometry(r - w / 2, r + w / 2, 72), mat); m.rotation.x = -PI / 2; m.position.y = .03; g.add(m); };
    const bar = (len, w, ang, r0) => { const m = new T.Mesh(new T.PlaneGeometry(len, w), mat); m.rotation.x = -PI / 2; m.rotation.z = ang; m.position.set(Math.cos(ang) * r0, .03, -Math.sin(ang) * r0); g.add(m); };
    if (kind === 0) { ring(R, .35); ring(R + 3, .2); ring(R + 6, .5); }
    else if (kind === 1) { for (let i = 0; i < 12; i++) bar(R * .9, .28, i * PI / 6, R * .85 + 4); ring(R + 1, .3); }
    else if (kind === 2) { for (let k = 0; k < 3; k++) { const m = new T.Mesh(new T.RingGeometry(R + k * 3.2 - .15, R + k * 3.2 + .15, 4, 1), mat); m.rotation.x = -PI / 2; m.rotation.z = PI / 4 + k * .3; m.scale.set(1.3, 1.3, 1); m.position.y = .03; g.add(m); } }
    else if (kind === 3) { for (let i = 0; i < 40; i++) { const a = i / 40 * PI * 2, r = R + 2 + (i % 3) * 2.2, m = new T.Mesh(new T.CircleGeometry(.28, 10), mat); m.rotation.x = -PI / 2; m.position.set(Math.cos(a) * r * 1.15, .03, Math.sin(a) * r); g.add(m); } ring(R + 1, .22); }
    else if (kind === 4) { const pts = []; for (let i = 0; i < 160; i++) { const a = i * .16, r = R * .5 + a * 1.1; pts.push(new T.Vector3(Math.cos(a) * r, .03, Math.sin(a) * r)); } const tube = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 240, .16, 6, false), mat); g.add(tube); }
    else { for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2, m = new T.Mesh(new T.RingGeometry(1.4, 1.7, 6), mat); m.rotation.x = -PI / 2; m.position.set(Math.cos(a) * (R + 3.5) * 1.1, .03, Math.sin(a) * (R + 3.5)); g.add(m); } ring(R + 1, .3); }
    root.add(g); anims.push(t => { mat.opacity = .5 + .25 * Math.sin(t * 1.6); });
  }

  /* ---------- the layouts ---------- */
  const LAYOUTS = {
    colonnade(env, q, lk, rn, A) {                       // two rows of columns and a carved back wall with arches
      const { root } = env, cx = lk.clear.x + 5, cz = lk.clear.z;
      for (let i = -3; i <= 3; i++) { [-1, 1].forEach(s => { const c = column(11 + rn() * 3, .8, rn() < .3 ? M().stoneMoss : M().stone, rn() < .5 ? A : undefined); c.position.set(s * cx, 0, i * (cz * .55)); root.add(c); }); }
      root.add(G.bevel(cx * 2 + 14, 16, 2.4, M().stone, 0, 8, -cz - 9, .1)); for (let i = -2; i <= 2; i++) { const a = new T.Mesh(new T.TorusGeometry(2.4, .5, 8, 20, PI), M().stoneWarm); a.position.set(i * 7.5, 6.4, -cz - 7.7); root.add(a); const gl = G.glow(A, 7, .25); gl.position.set(i * 7.5, 4.2, -cz - 7); root.add(gl); }
      for (let i = 0; i < 4; i++) addTorch(env, (i % 2 ? 1 : -1) * (cx - 2.5), (i < 2 ? -1 : 1) * cz * .8, A, i === 0);
    },
    courtyard(env, q, lk, rn, A) {                       // a ring of pillars joined by low walls and gates
      const { root } = env, R = (lk.R0 + 3), n = 12;
      for (let i = 0; i < n; i++) { const a = i / n * PI * 2, c = column(8 + rn() * 5, .75, M().stone, A); c.position.set(Math.cos(a) * R * 1.25, 0, Math.sin(a) * R); root.add(c); if (i % 2) { const w = G.bevel(R * .74, 2.6, 1.1, M().stoneMoss, Math.cos(a + PI / n) * R * 1.25, 1.3, Math.sin(a + PI / n) * R, .08); w.rotation.y = -(a + PI / n) + PI / 2; root.add(w); } }
      for (let i = 0; i < 3; i++) root.add(statue(M().stoneDark, A)), root.children[root.children.length - 1].position.set((i - 1) * R * .9, 0, -R * 1.02);
      addTorch(env, -R * .5, -R * .7, A, true); addTorch(env, R * .5, -R * .7, A, false);
    },
    cavern(env, q, lk, rn, A) {                          // rock walls, stalactites and glowing crystals
      const { root } = env, R = (lk.R0 + 4), rock = new T.MeshStandardMaterial({ color: 0x3a3330, roughness: 1, flatShading: true });
      for (let i = 0; i < 26; i++) { const a = i / 26 * PI * 2, r = R + 3 + rn() * 7, s = 4 + rn() * 6, m = new T.Mesh(new T.DodecahedronGeometry(s, 0), rock); m.position.set(Math.cos(a) * r * 1.2, s * .5, Math.sin(a) * r); m.rotation.set(rn() * 3, rn() * 3, rn() * 3); m.scale.y = 1.2 + rn(); m.castShadow = m.receiveShadow = true; root.add(m); }
      for (let i = 0; i < 9; i++) { const a = rn() * PI * 2, r = R + 1 + rn() * 6, cc = crystalCluster(A, 5 + Math.floor(rn() * 4), 1.1 + rn() * .9, i * 31 + 5); cc.position.set(Math.cos(a) * r * 1.15, 0, Math.sin(a) * r); root.add(cc); }
      const pool = G.water(R * 1.2, R * .8, new T.Vector3(.2, .8, .2)); pool.obj.position.set(-R * .9, .05, -R * 1.1); root.add(pool.obj); env.anims.push(pool.update);
      for (let i = 0; i < 12; i++) { const m = new T.Mesh(new T.SphereGeometry(.3 + rn() * .3, 8, 6), new T.MeshStandardMaterial({ color: 0x20303a, emissive: A, emissiveIntensity: 1.4 })); const a = rn() * PI * 2, r = R * .7 + rn() * 8; m.position.set(Math.cos(a) * r, .3, Math.sin(a) * r); m.scale.y = .6; root.add(m); }
    },
    garden(env, q, lk, rn, A) {                          // trees, flower beds, a pond and a stone gate
      const { root } = env; root.add(G.trees(env.q.trees + 6, (lk.R0 + 11), 20, lk.seed + 3));
      const fl = new T.InstancedMesh(new T.SphereGeometry(.28, 8, 6), new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0x222222 }), 160), d = new T.Object3D(), col = new T.Color();
      for (let i = 0; i < 160; i++) { const a = rn() * PI * 2, r = (lk.R0 + 1) + rn() * 11; d.position.set(Math.cos(a) * r * 1.2, .3, Math.sin(a) * r); d.scale.setScalar(.7 + rn() * .8); d.updateMatrix(); fl.setMatrixAt(i, d.matrix); col.setHex(rn() < .5 ? A : [0xffffff, 0xffe066, 0xff7aa8][Math.floor(rn() * 3)]); fl.setColorAt(i, col); } root.add(fl);
      const gate = new T.Group(); [-1, 1].forEach(s => gate.add(G.bevel(1.8, 10, 1.8, M().stoneMoss, s * 5, 5, 0, .1))); const top = G.bevel(13, 1.6, 2, M().stoneWarm, 0, 10.4, 0, .1); gate.add(top); gate.position.z = -lk.clear.z - 10; root.add(gate); const pond = G.water(11, 7, new T.Vector3(.3, .8, .3)); pond.obj.position.set(lk.clear.x + 8, .04, lk.clear.z * .3); root.add(pond.obj); env.anims.push(pond.update);
      root.add(G.ferns(env.q.ferns, { x: 0, z: 0, w: 80, d: 70 }, lk.seed, (x, z) => Math.abs(x) < lk.clear.x + 2 && Math.abs(z) < lk.clear.z + 2));
    },
    tower(env, q, lk, rn, A) {                           // inside a round tower: curved wall, glowing windows, a stair ring
      const { root } = env, R = (lk.R0 + 7), wall = new T.Mesh(new T.CylinderGeometry(R, R, 30, 40, 1, true), new T.MeshStandardMaterial({ map: G.tex(G.stoneCanvas(9, '#6a6050', .4), [14, 3]), side: T.BackSide, roughness: 1 })); wall.position.y = 15; root.add(wall);
      for (let i = 0; i < 14; i++) { const a = i / 14 * PI * 2, w = new T.Mesh(new T.PlaneGeometry(1.4, 5), new T.MeshBasicMaterial({ color: A, transparent: true, opacity: .85, blending: T.AdditiveBlending })); w.position.set(Math.sin(a) * (R - .2), 9 + (i % 3) * 5, Math.cos(a) * (R - .2)); w.lookAt(0, w.position.y, 0); root.add(w); }
      for (let i = 0; i < 26; i++) { const a = i / 26 * PI * 2 * 1.5, s = G.bevel(R * .35, .45, 1.8, M().stoneWarm, 0, 0, 0, .05); s.position.set(Math.sin(a) * (R - 2.2), 1 + i * .55, Math.cos(a) * (R - 2.2)); s.rotation.y = a; root.add(s); }
      const lamp = new T.Mesh(new T.TorusGeometry(R * .5, .2, 8, 48), new T.MeshBasicMaterial({ color: A })); lamp.rotation.x = PI / 2; lamp.position.y = 24; root.add(lamp); const oc = G.glow(A, 40, .25); oc.position.y = 28; root.add(oc);
      for (let i = 0; i < 6; i++) addTorch(env, Math.sin(i * 1.05) * (R - 3), Math.cos(i * 1.05) * (R - 3), A, i === 0);
    },
    skydeck(env, q, lk, rn, A) {                         // a floating platform above the clouds
      const { root } = env, R = (lk.R0 + 1); root.add(G.bevel(R * 2.6, 3, R * 2.2, M().stoneDark, 0, -1.6, 0, .3));
      for (let i = 0; i < 14; i++) { const s = 2 + rn() * 5, m = new T.Mesh(new T.DodecahedronGeometry(s, 0), M().stoneMoss); const a = rn() * PI * 2, r = R * 1.5 + rn() * 40; m.position.set(Math.cos(a) * r, -6 - rn() * 16, Math.sin(a) * r); m.scale.y = 1.5; root.add(m); if (rn() < .6) { const t = new T.Mesh(new T.ConeGeometry(s * .5, s * 1.8, 6), new T.MeshStandardMaterial({ color: 0x2f7a44, roughness: 1 })); t.position.set(m.position.x, m.position.y + s * 1.6, m.position.z); root.add(t); } }
      cloudBank(root, -12, lk.seed, 0xffffff); [-1, 1].forEach(s => { for (let i = 0; i < 3; i++) { const c = column(7 + i * 2, .6, M().stone, A); c.position.set(s * (R + 1.5), 0, (i - 1) * R * .8); root.add(c); } });
      const ring = new T.Mesh(new T.TorusGeometry(R * 1.35, .35, 8, 80), new T.MeshStandardMaterial({ color: 0xd9a441, emissive: A, emissiveIntensity: .6, metalness: .8, roughness: .3 })); ring.rotation.x = PI / 2; ring.position.y = 8; root.add(ring); env.anims.push((t) => { ring.rotation.z = t * .1; });
    },
    forge(env, q, lk, rn, A) {                           // lava channels, anvils and chimneys
      const { root } = env, R = (lk.R0 + 1); const lavaMat = new T.MeshBasicMaterial({ color: 0xff6a20 }); const lav = [];
      for (let i = 0; i < 4; i++) { const m = new T.Mesh(new T.PlaneGeometry(R * 3, 2.4), lavaMat); m.rotation.x = -PI / 2; m.position.set(0, .03, (i % 2 ? 1 : -1) * (R + 3 + (i > 1 ? 7 : 0))); root.add(m); lav.push(m); }
      for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2, r = R + 12, c = G.bevel(3, 16, 3, M().stoneDark, Math.cos(a) * r * 1.3, 8, Math.sin(a) * r, .2); root.add(c); const f = G.glow(0xff7a30, 7, .6); f.position.set(c.position.x, 16.5, c.position.z); root.add(f); }
      for (let i = 0; i < 5; i++) { const an = new T.Group(); an.add(G.bevel(2, .8, 1.2, new T.MeshStandardMaterial({ color: 0x2a2a30, metalness: .8, roughness: .5 }), 0, 1.4, 0, .08), G.bevel(1.2, 1.2, 1, M().stoneDark, 0, .6, 0, .05)); const a = (i - 2) * .6; an.position.set(Math.sin(a) * (R + 5), 0, -Math.cos(a) * (R + 5) + 4); root.add(an); }
      for (let i = 0; i < 7; i++) { const ch = new T.Mesh(new T.CylinderGeometry(.06, .06, 12, 5), M().gold); ch.position.set((i - 3) * 6, 12, -R - 6); root.add(ch); }
      const em = particles(120, { w: 80, h: 14, d: 70 }, 0xff8a30, 1.1, .35); em.obj.position.y = 0; root.add(em.obj); env.anims.push(em.update); env.anims.push((t) => { lavaMat.color.setHSL(.05 + .01 * Math.sin(t * 2), 1, .5 + .08 * Math.sin(t * 3)); });
    },
    reef(env, q, lk, rn, A) {                            // underwater: coral, kelp, bubbles and fish
      const { root } = env, R = (lk.R0 + 1), cols = [0xff6a8a, 0xffb040, 0xc08aff, 0x5ae0ff, 0xff8a50];
      const coral = new T.InstancedMesh(new T.ConeGeometry(.6, 3, 6), new T.MeshStandardMaterial({ color: 0xffffff, roughness: .6, emissive: 0x111122 }), 90), d = new T.Object3D(), col = new T.Color();
      for (let i = 0; i < 90; i++) { const a = rn() * PI * 2, r = R + 2 + rn() * 22, s = .6 + rn() * 1.8; d.position.set(Math.cos(a) * r * 1.2, s * 1.2, Math.sin(a) * r); d.rotation.set((rn() - .5) * .5, rn() * 6, (rn() - .5) * .5); d.scale.set(s, s * (1 + rn()), s); d.updateMatrix(); coral.setMatrixAt(i, d.matrix); col.setHex(cols[i % 5]); coral.setColorAt(i, col); } root.add(coral);
      const kelp = []; for (let i = 0; i < 26; i++) { const k = new T.Mesh(new T.PlaneGeometry(.7, 9 + rn() * 6, 1, 6), new T.MeshStandardMaterial({ color: 0x2f9a5a, side: T.DoubleSide, roughness: .8, emissive: 0x0a2a14 })); const a = rn() * PI * 2, r = R + 3 + rn() * 14; k.position.set(Math.cos(a) * r * 1.2, 5, Math.sin(a) * r); k.rotation.y = rn() * 6; root.add(k); kelp.push(k); }
      const fish = []; for (let i = 0; i < 12; i++) { const f = new T.Group(), b = new T.Mesh(new T.SphereGeometry(.5, 8, 6), new T.MeshStandardMaterial({ color: cols[i % 5], emissive: cols[i % 5], emissiveIntensity: .25 })); b.scale.set(1.8, .8, .5); const tl = new T.Mesh(new T.ConeGeometry(.35, .6, 4), b.material); tl.rotation.z = PI / 2; tl.position.x = -1; f.add(b, tl); f.userData = { r: 14 + rn() * 14, y: 3 + rn() * 7, s: .25 + rn() * .35, o: rn() * 6 }; root.add(f); fish.push(f); }
      const bub = particles(160, { w: 70, h: 18, d: 60 }, 0xbfeaff, 1.2, .45); root.add(bub.obj); env.anims.push(bub.update);
      env.anims.push((t) => { kelp.forEach((k, i) => { k.rotation.z = Math.sin(t * .8 + i) * .12; }); fish.forEach(f => { const u = f.userData, a = t * u.s + u.o; f.position.set(Math.cos(a) * u.r, u.y + Math.sin(t + u.o), Math.sin(a) * u.r * .8); f.rotation.y = -a + PI; }); });
      const rays = G.godRays([{ x: -9, y: 14, z: -4, w: 6, len: 30, rz: .35 }, { x: 8, y: 14, z: -6, w: 7, len: 30, rz: -.3 }], 0x9fe8ff); root.add(rays.obj); env.anims.push(rays.update);
    },
    frostcave(env, q, lk, rn, A) {                       // ice spikes, frozen columns and falling snow
      const { root } = env, R = (lk.R0 + 2), ice = new T.MeshStandardMaterial({ color: 0xa8dcff, emissive: A, emissiveIntensity: .25, metalness: .2, roughness: .12, transparent: true, opacity: .8 });
      for (let i = 0; i < 36; i++) { const a = rn() * PI * 2, r = R + rn() * 16, h = 4 + rn() * 12, c = new T.Mesh(new T.ConeGeometry(.9 + rn() * 1.3, h, 6), ice); c.position.set(Math.cos(a) * r * 1.2, h / 2, Math.sin(a) * r); c.rotation.set((rn() - .5) * .3, rn() * 6, (rn() - .5) * .3); root.add(c); }
      for (let i = 0; i < 14; i++) { const a = rn() * PI * 2, r = 8 + rn() * (R + 8), h = 3 + rn() * 8, c = new T.Mesh(new T.ConeGeometry(.5 + rn() * .6, h, 6), ice); c.position.set(Math.cos(a) * r, 18 - h / 2, Math.sin(a) * r); c.rotation.z = PI; root.add(c); }
      for (let i = 0; i < 6; i++) { const c = column(9 + rn() * 4, .8, ice); c.position.set((i % 2 ? 1 : -1) * (R + 2), 0, (Math.floor(i / 2) - 1) * 9); root.add(c); }
      const sn = particles(260, { w: 80, h: 22, d: 70 }, 0xffffff, -1.4, .28); sn.obj.position.y = 0; root.add(sn.obj); env.anims.push(sn.update); const gl = G.glow(A, 30, .12); gl.position.y = 6; root.add(gl);
    },
    ruins(env, q, lk, rn, A) {                           // broken columns, fallen stones, a great guardian statue
      const { root } = env, R = (lk.R0 + 1); for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2 + rn() * .3, c = column(4 + rn() * 9, .75, M().stoneMoss, rn() < .3 ? A : undefined); c.position.set(Math.cos(a) * (R + 4 + rn() * 5) * 1.2, 0, Math.sin(a) * (R + 4 + rn() * 5)); c.rotation.z = (rn() - .5) * .12; root.add(c); }
      for (let i = 0; i < 16; i++) { const s = .8 + rn() * 2, m = new T.Mesh(new T.DodecahedronGeometry(s, 0), M().stoneMoss); const a = rn() * PI * 2, r = R + 2 + rn() * 14; m.position.set(Math.cos(a) * r * 1.2, s * .35, Math.sin(a) * r); m.rotation.set(rn() * 3, rn() * 3, 0); m.scale.y = .6; m.castShadow = true; root.add(m); }
      const st = statue(M().stoneMoss, A); st.scale.setScalar(2.2); st.position.set(0, 0, -R - 12); root.add(st); root.add(G.trees(env.q.trees, R + 24, 18, lk.seed)); root.add(G.ferns(env.q.ferns, { x: 0, z: 0, w: 80, d: 70 }, lk.seed + 1, (x, z) => Math.abs(x) < lk.clear.x + 2 && Math.abs(z) < lk.clear.z + 2));
      for (let i = 0; i < 6; i++) root.add(G.vine((i - 2.5) * 6, 12, -R - 3, 5 + rn() * 4, i + lk.seed));
    },
    observatory(env, q, lk, rn, A) {                     // brass rings and a telescope under an open dome
      const { root } = env, R = (lk.R0 + 5); const dome = new T.Mesh(new T.SphereGeometry(R * 1.6, 36, 18, 0, PI * 2, 0, PI / 2), new T.MeshStandardMaterial({ color: 0x2a2f45, roughness: .8, side: T.BackSide, metalness: .3 })); root.add(dome);
      for (let i = 0; i < 4; i++) { const r = new T.Mesh(new T.TorusGeometry(R * (.8 + i * .22), .22, 8, 90), M().gold); r.rotation.set(PI / 2 + i * .25, 0, i * .6); r.position.y = 9 + i * 3; root.add(r); env.anims.push((t) => { r.rotation.z += .0015 * (i + 1); }); }
      const scope = new T.Group(); scope.add(G.cyl(.7, .9, 6, M().bronze, 0, 3, 0, 16)); const tube = G.cyl(.8, .6, 9, M().bronze, 0, 8, 0, 18); tube.rotation.z = .9; scope.add(tube); const lens = G.glow(A, 4, .8); lens.position.set(3.4, 11.6, 0); scope.add(lens); scope.position.set(-R * .9, 0, -R * .5); root.add(scope);
      root.add(stars(260, 160, lk.seed + 9, 3)); for (let i = 0; i < 6; i++) addTorch(env, Math.cos(i * 1.05) * R, Math.sin(i * 1.05) * R * .8, A, i === 0);
      const ob = G.glow(A, 36, .14); ob.position.y = 22; root.add(ob);
    }
  };
  L.LAYOUT_NAMES = Object.keys(LAYOUTS);

  /* ---------- the entry point used by the world ---------- */
  L.build = function (env, q, lk, def) {
    const { scene, root, anims } = env, rn = rngOf(lk.seed * 77 + 5), sky = L.SKIES[lk.sky] || L.SKIES.day, A = lk.accent;
    lk.clear = lk.clear || { x: 12, z: 9 }; lk.R0 = Math.max(lk.clear.x, lk.clear.z);
    scene.background = new T.Color(sky.fog); scene.fog = new T.FogExp2(sky.fog, sky.fd * (lk.layout === 'cavern' || lk.layout === 'tower' ? 1.5 : 1));
    root.add(G.sky(sky.top, sky.mid, sky.bot));
    env.hemi = new T.HemisphereLight(sky.hs, sky.hg, sky.hi); scene.add(env.hemi);
    const sun = new T.DirectionalLight(sky.sun, sky.si); sun.position.set(sky.sunPos[0], sky.sunPos[1], sky.sunPos[2]); sun.target.position.set(0, 0, 0); sun.castShadow = q.shadow > 0;
    if (q.shadow) { sun.shadow.mapSize.set(q.shadow, q.shadow); const c = sun.shadow.camera, r = lk.multi ? 62 : 26; c.left = -r; c.right = r; c.top = r; c.bottom = -r; c.near = 1; c.far = 140; sun.shadow.bias = -.0004; sun.shadow.normalBias = .04; }
    scene.add(sun, sun.target); env.sun = sun;
    // floor
    const size = lk.multi ? 200 : 120, fl = new T.Mesh(new T.CircleGeometry(size / 2, 56), floorMat(lk.floor, size, size)); fl.rotation.x = -PI / 2; fl.position.y = -.06; fl.receiveShadow = true; if (lk.layout !== 'skydeck') root.add(fl);
    // sky extras
    if (sky.stars) root.add(stars(sky.stars === 1 ? 120 : sky.stars === 2 ? 320 : 520, 150, lk.seed + 2, sky.stars === 3 ? 3.5 : 2.5));
    if (sky.moon) { const m = new T.Mesh(new T.CircleGeometry(7, 32), new T.MeshBasicMaterial({ color: 0xf2f4ff, fog: false })); m.position.set(-60, 70, -110); m.lookAt(0, 0, 0); root.add(m); const mg = G.glow(0xbfd0ff, 40, .4); mg.position.copy(m.position); root.add(mg); }
    if (sky.aurora) { for (let i = 0; i < 3; i++) { const c = G.cv(8, 128), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 8, 128); const m = new T.Mesh(new T.PlaneGeometry(200, 50, 20, 1), new T.MeshBasicMaterial({ map: G.tex(c, null, true), color: [0x4aff9a, 0x37d8ff, 0xb080ff][i], transparent: true, opacity: .32, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })); m.position.set(0, 60 + i * 8, -90 - i * 20); m.rotation.x = -.2; root.add(m); anims.push(t => { m.position.x = Math.sin(t * .05 + i) * 24; m.material.opacity = .22 + .12 * Math.sin(t * .4 + i * 2); }); } }
    if (sky.rain) { const rn2 = particles(420, { w: 90, h: 30, d: 80 }, 0xbfd0e8, -22, .2); root.add(rn2.obj); anims.push(rn2.update); anims.push((t) => { env.hemi.intensity = sky.hi * (1 + (Math.sin(t * .31) > .985 ? 2.2 : 0)); }); }
    if (sky.snow) { const sn = particles(300, { w: 90, h: 26, d: 80 }, 0xffffff, -1.5, .3); root.add(sn.obj); anims.push(sn.update); }
    if (sky.bubbles) { /* the reef layout adds its own bubbles */ }
    // dust motes in every scene
    const d = G.dust(q.dust, { w: 40, h: 14, d: 36 }, lk.sky === 'ember' ? 0xffb070 : 0xffe6b0); root.add(d.obj); anims.push(d.update);
    // the place itself
    (LAYOUTS[lk.layout] || LAYOUTS.colonnade)(env, q, lk, rn, A);
    if (!lk.multi && lk.layout !== 'skydeck') inlay(env, lk, rn, A);
    // accent light so every room has its own colour
    const pl = new T.PointLight(A, 1.4, 46, 2); pl.position.set(0, 8, -lk.clear.z * .4); root.add(pl);
  };
})();
