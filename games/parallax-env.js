/* PARALLAX - shared scenery kit + Level 1 (The Forgotten Gate).
 * Everything is built from code: floating islands with rock undersides, cloud seas, fluted columns, arches, towers, waterfalls,
 * god rays, hanging gardens, braziers and a monumental sealed gate. Level 2 and 3 live in parallax-env-b.js.
 */
(function () {
  'use strict';
  const T = THREE, MV = (window.MV = window.MV || {}), G = MV.gfx, E = window.ParallaxEngine, PI = Math.PI, X = (MV.penv = { levels: [] });
  const rng = G.rng, M = () => G.mat, Y = new T.Vector3(0, 1, 0);

  /* ---------- small helpers ---------- */
  X.glyphTex = function (sym, col, glow) { const c = G.cv(256, 256), x = c.getContext('2d'); G.drawGlyph(x, sym, 128, 128, 200, col, glow); return G.tex(c, null, true); };
  X.glyphMesh = function (sym, col, glow, w, additive) {
    const m = new T.Mesh(new T.PlaneGeometry(w, w), new T.MeshBasicMaterial({ map: X.glyphTex(sym, col, glow), transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending, side: T.DoubleSide })); return m;
  };
  X.symColor = { moon: '#9fd8ff', sun: '#ffd36a', star: '#e6a6ff' }; X.symHex = { moon: 0x62b8ff, sun: 0xffc84a, star: 0xd47cff };
  X.beams = function (parent, n, color, r) {                                         // a pool of straight glowing segments
    const g = new T.Group(), items = [];
    for (let i = 0; i < n; i++) {
      const core = new T.Mesh(new T.CylinderGeometry(r, r, 1, 8, 1, true), new T.MeshBasicMaterial({ color, transparent: true, opacity: .95, blending: T.AdditiveBlending, depthWrite: false }));
      const halo = new T.Mesh(new T.CylinderGeometry(r * 3.4, r * 3.4, 1, 10, 1, true), new T.MeshBasicMaterial({ color, transparent: true, opacity: .2, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      const s = new T.Group(); s.add(core, halo); s.visible = false; g.add(s); items.push({ s, core, halo });
    }
    const a = new T.Vector3(), b = new T.Vector3(), d = new T.Vector3(); parent.add(g);
    return {
      obj: g, color(c) { items.forEach(it => { it.core.material.color.setHex(c); it.halo.material.color.setHex(c); }); },
      set(list) { items.forEach((it, i) => { const q = list[i]; if (!q) { it.s.visible = false; return; } a.set(q.x0, q.y0, q.z0); b.set(q.x1, q.y1, q.z1); d.subVectors(b, a); const len = d.length(); if (len < .01) { it.s.visible = false; return; } it.s.visible = true; it.s.position.copy(a).addScaledVector(d, .5); it.s.quaternion.setFromUnitVectors(Y, d.normalize()); it.s.scale.set(1, len, 1); }); },
      pulse(t, k) { items.forEach((it, i) => { it.halo.material.opacity = (.16 + .08 * Math.sin(t * 6 + i)) * (k == null ? 1 : k); }); }
    };
  };
  X.cloudTex = function () {
    const c = G.cv(256, 128), x = c.getContext('2d'), r = rng(31);
    for (let i = 0; i < 26; i++) { const px = 40 + r() * 176, py = 50 + r() * 40, rad = 22 + r() * 30, g = x.createRadialGradient(px, py, 0, px, py, rad); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(.6, 'rgba(240,244,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 128); }
    return G.tex(c, null, true);
  };
  X.cloudSea = function (root, anims, o) {                                           // flat soft cloud layers far below (and a few above): a sea of clouds seen edge-on stays thin
    const tex = X.cloudTex(), r = rng(o.seed || 5), g = new T.Group(), geo = new T.PlaneGeometry(1, 1);
    for (let i = 0; i < o.count; i++) {
      const m = new T.MeshBasicMaterial({ map: tex, color: o.color || 0xffffff, transparent: true, opacity: (o.opacity || .8) * (.6 + r() * .4), depthWrite: false, fog: false, side: T.DoubleSide }), s = new T.Mesh(geo, m), a = r() * PI * 2, rad = 10 + Math.sqrt(r()) * o.spread;
      const sc = 50 + r() * 90; s.scale.set(sc * 2, sc, 1); s.rotation.set(-PI / 2, 0, r() * PI); s.position.set(Math.cos(a) * rad, o.y + (r() - .5) * (o.thick || 12), Math.sin(a) * rad); s.userData.base = s.position.x; s.userData.sp = .3 + r() * .6; s.userData.ph = r() * 6; s.renderOrder = -5; g.add(s);
    }
    root.add(g); anims.push((t) => { g.children.forEach(s => { s.position.x = s.userData.base + Math.sin(t * .03 * s.userData.sp + s.userData.ph) * 18; }); }); return g;
  };
  X.sky = function (scene, root, p) {
    scene.background = new T.Color(p.fog); scene.fog = new T.FogExp2(p.fog, p.fogD);
    root.add(G.sky(p.top, p.mid, p.bot));
    if (p.sunPos) { const s = G.glow(p.sunCol || 0xfff0c0, 90, .95); s.position.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]); s.material.fog = false; root.add(s); const s2 = G.glow(0xffffff, 26, 1); s2.position.copy(s.position); s2.material.fog = false; root.add(s2); }
  };
  const noise = (a, s) => Math.sin(a * 3 + s) * .06 + Math.sin(a * 7 + s * 2.3) * .035 + Math.sin(a * 13 + s * 1.7) * .018;
  X.island = function (radius, depth, seed, o) {                                      // floating island: paved top at y=0, rocky tapering underside
    o = o || {}; const g = new T.Group(), r = rng(seed), mats = M(); const seg = o.seg || 48;
    const top = new T.Mesh(new T.CylinderGeometry(radius, radius * .97, 1.4, seg, 1), [o.side || mats.stoneWarm, o.top || G.floorMat(radius * 2, radius * 2), mats.stoneDark]); top.position.y = -.7; top.receiveShadow = true; top.castShadow = true; g.add(top);
    if (!o.noRim) { const rim = new T.Mesh(new T.TorusGeometry(radius - .25, .32, 6, seg), mats.stone); rim.rotation.x = PI / 2; rim.position.y = .02; rim.castShadow = true; g.add(rim); }
    const ico = new T.IcosahedronGeometry(1, o.detail || 3), pos = ico.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); const a = Math.atan2(z, x); if (y > 0) y = 0; const t = -y;
      const k = 1 + noise(a, seed) + noise(y * 9, seed + 4) * .8; x *= radius * .97 * k * (1 - t * .18); z *= radius * .97 * k * (1 - t * .18); y = -t * depth * (1 + noise(a * 2 + y * 5, seed + 9) * 2.2) - 1.3 + (t === 0 ? 0 : 0);
      pos.setXYZ(i, x, y, z);
    }
    ico.computeVertexNormals(); const uv = ico.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 3);
    const rock = new T.Mesh(ico, mats.stoneDark); rock.castShadow = true; rock.receiveShadow = true; g.add(rock);
    for (let i = 0; i < (o.spikes == null ? 5 : o.spikes); i++) { const a = r() * PI * 2, rr = radius * (.2 + r() * .55), h = depth * (.25 + r() * .35), c = new T.Mesh(new T.ConeGeometry(radius * (.05 + r() * .06), h, 7), mats.stoneDark); c.rotation.x = PI; c.position.set(Math.cos(a) * rr, -depth * .55 - h * .35, Math.sin(a) * rr); g.add(c); }
    if (o.vines) for (let i = 0; i < o.vines; i++) { const a = r() * PI * 2; g.add(G.vine(Math.cos(a) * (radius - .5), -.1, Math.sin(a) * (radius - .5), 3 + r() * 6, 100 + i + seed)); }
    return g;
  };
  X.column = function (h, rad, broken, mat) {                                         // fluted column with base and capital
    const g = new T.Group(), m = mat || M().stone, bh = broken ? h * (.35 + Math.random() * .35) : h;
    g.add(G.box(rad * 2.9, .35, rad * 2.9, m, 0, .17, 0)); const sh = new T.Mesh(new T.CylinderGeometry(rad * .88, rad, bh, 18, 1), m); sh.position.y = .35 + bh / 2; sh.castShadow = sh.receiveShadow = true; g.add(sh);
    for (let i = 0; i < 12; i++) { const a = i * PI / 6, f = new T.Mesh(new T.BoxGeometry(.05, bh, .07), M().stoneDark); f.position.set(Math.cos(a) * rad * .93, .35 + bh / 2, Math.sin(a) * rad * .93); f.rotation.y = -a; g.add(f); }
    if (!broken) { g.add(G.box(rad * 2.6, .3, rad * 2.6, m, 0, .35 + bh + .15, 0)); g.add(G.box(rad * 3.2, .22, rad * 3.2, m, 0, .35 + bh + .41, 0)); }
    else { const cap = new T.Mesh(new T.DodecahedronGeometry(rad * .8, 0), m); cap.scale.set(1, .35, 1); cap.position.set(rad * 2, .35, rad * 1.4); g.add(cap); }
    return g;
  };
  X.archWall = function (w, h, holeR, depth, mat, holeY) {                            // wall with a round-topped opening
    const s = new T.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.closePath();
    const hole = new T.Path(), cy = holeY == null ? holeR : holeY; hole.absarc(0, cy, holeR, 0, PI * 2, true); s.holes.push(hole);
    const geo = new T.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 40 }); geo.translate(0, 0, -depth / 2); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * .16, uv.getY(i) * .16);
    const m = new T.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; return m;
  };
  X.tower = function (w, h, seed, roof) {
    const g = new T.Group(), r = rng(seed), mats = M(); g.add(G.box(w, h, w, mats.stoneWarm, 0, h / 2, 0)); g.add(G.box(w * 1.18, .8, w * 1.18, mats.stone, 0, h, 0)); g.add(G.box(w * 1.18, .8, w * 1.18, mats.stone, 0, h * .55, 0));
    for (let i = 0; i < 4; i++) { const a = i * PI / 2, win = new T.Mesh(new T.PlaneGeometry(w * .18, h * .1), new T.MeshBasicMaterial({ color: 0xffc070 })); win.position.set(Math.sin(a) * (w / 2 + .03), h * .78, Math.cos(a) * (w / 2 + .03)); win.rotation.y = a; g.add(win); }
    if (roof !== false) { const c = new T.Mesh(new T.ConeGeometry(w * .82, h * .32, 4), new T.MeshStandardMaterial({ color: 0x3a6a8a, roughness: .5, metalness: .3 })); c.rotation.y = PI / 4; c.position.y = h + .4 + h * .16; c.castShadow = true; g.add(c); }
    void r; return g;
  };
  X.fall = function (root, anims, x, y, z, w, h, rotY) {                              // waterfall from an island rim into the clouds
    const wf = G.waterfall(w, h); wf.obj.position.set(x, y - h, z); wf.obj.rotation.y = rotY || 0; root.add(wf.obj); anims.push(wf.update);
    const lip = G.glow(0xdff6ff, w * 1.6, .5); lip.position.set(x, y + .4, z); root.add(lip); return wf;
  };
  X.distant = function (root, anims, seed, count, rMin, rMax, yMin, yMax) {           // faraway floating islands with towers, arches and houses
    const r = rng(seed), mats = M();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * PI * 2 + r() * .5, rad = rMin + r() * (rMax - rMin), s = 5 + r() * 15, g = new T.Group();
      const isl = X.island(s, s * (1 + r()), seed + i * 7, { seg: 20, detail: 2, noRim: true, spikes: 2, top: new T.MeshStandardMaterial({ color: 0x6e8a4c, roughness: 1 }) }); g.add(isl);
      const nt = 1 + (r() * 3 | 0); for (let k = 0; k < nt; k++) { const tw = X.tower(1.6 + r() * 2.2, 5 + r() * 12, seed + k + i, r() > .3); tw.position.set((r() - .5) * s * 1.1, 0, (r() - .5) * s * 1.1); g.add(tw); }
      if (r() > .4) { const ar = X.archWall(7, 6, 2.3, 1, mats.stoneWarm); ar.position.set((r() - .5) * s * .6, 0, (r() - .5) * s * .6); ar.rotation.y = r() * 3; g.add(ar); }
      const tr = new T.Mesh(new T.IcosahedronGeometry(1.5 + r(), 1), new T.MeshStandardMaterial({ color: 0x4f8a3a, roughness: .9, flatShading: true })); tr.position.set((r() - .5) * s, 2, (r() - .5) * s); g.add(tr);
      g.position.set(Math.cos(a) * rad, yMin + r() * (yMax - yMin), Math.sin(a) * rad); g.rotation.y = r() * 6; const by = g.position.y, ph = r() * 6; root.add(g); anims.push(t => { g.position.y = by + Math.sin(t * .25 + ph) * 1.2; });
    }
  };
  X.godRays = function (list, color, k) {                                            // soft slanted light shafts (strength k)
    const g = new T.Group(); G._rt = G._rt || G.tex(G.rayCanvas(), null, true); const mats = [];
    list.forEach(r => { const mat = new T.MeshBasicMaterial({ map: G._rt, color: color || 0xffffff, transparent: true, opacity: .1 * k, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }); [0, PI / 2].forEach(a => { const m = new T.Mesh(new T.PlaneGeometry(r.w, r.len), mat); m.position.set(r.x, r.y, r.z); m.rotation.set(r.rx || 0, a, r.rz || 0, 'YXZ'); g.add(m); }); mats.push(mat); });
    return { obj: g, update(t) { mats.forEach((m, i) => { m.opacity = k * (.07 + .04 * Math.sin(t * .5 + i * 1.7)); }); } };
  };
  X.coinMesh = function () {
    const c = new T.Mesh(new T.CylinderGeometry(.34, .34, .07, 20), new T.MeshStandardMaterial({ color: 0xffc83a, metalness: .95, roughness: .22, emissive: 0x6a4300, emissiveIntensity: .6, envMapIntensity: 1.5 })); c.rotation.x = PI / 2;
    const inner = new T.Mesh(new T.TorusGeometry(.24, .03, 6, 18), new T.MeshStandardMaterial({ color: 0xfff0a0, metalness: .9, roughness: .3 })); inner.position.z = .04; c.add(inner);
    const g = new T.Group(); g.add(c); const gl = G.glow(0xffd24a, 1.6, .5); g.add(gl); return g;
  };
  X.brazier = function (root, anims, x, z, withLight, y) {
    const t = G.torch(withLight, undefined); t.obj.position.set(x, y || 0, z); t.obj.scale.setScalar(1.25); root.add(t.obj); anims.push(t.update); return t;
  };

  /* =========================================================================================
   * LEVEL 1  The Forgotten Gate
   * ======================================================================================= */
  X.levels[0] = function (ctx) {
    const { root, scene, anims, q } = ctx, L = E.LEVELS[0], mats = M(), r = rng(11);
    X.sky(scene, root, { fog: 0x9fc4ea, fogD: .0085, top: '#2d6fc4', mid: '#9cc9ef', bot: '#ffe6bd', sunPos: [0, 105, -150], sunCol: 0xfff0c8 });
    ctx.sun.position.set(0, 60, -55); ctx.sun.color.setHex(0xfff0d2); ctx.sun.intensity = 1.5; ctx.hemi.color.setHex(0xa8c8f0); ctx.hemi.groundColor.setHex(0x5a4a34); ctx.hemi.intensity = .5;
    X.cloudSea(root, anims, { y: -34, count: 70, spread: 230, color: 0xfff6ee, opacity: .9, seed: 3, thick: 10 }); X.cloudSea(root, anims, { y: -16, count: 14, spread: 260, opacity: .35, seed: 8, thick: 10 });
    X.distant(root, anims, 41, 11, 85, 190, -10, 40);
    const floorM = G.floorMat(72, 72); floorM.color.setScalar(.7); const R = 36, isl = X.island(R, 34, 7, { vines: 22, spikes: 7, top: floorM }); root.add(isl);

    // courtyard paving pattern: a great compass-rose inlay (carved rings and rays) so the floor reads as ancient architecture
    const inl = G.cv(512, 512), ix = inl.getContext('2d'); ix.clearRect(0, 0, 512, 512); ix.translate(256, 256); ix.strokeStyle = 'rgba(205,160,70,.9)'; ix.lineWidth = 5;
    [240, 200, 120, 70].forEach((rad, i) => { ix.beginPath(); ix.arc(0, 0, rad, 0, PI * 2); ix.lineWidth = i === 0 ? 8 : 4; ix.stroke(); });
    for (let i = 0; i < 16; i++) { ix.save(); ix.rotate(i * PI / 8); ix.fillStyle = 'rgba(205,160,70,.85)'; ix.beginPath(); ix.moveTo(0, -240); ix.lineTo(14, -200); ix.lineTo(0, -120); ix.lineTo(-14, -200); ix.closePath(); i % 2 ? ix.stroke() : ix.fill(); ix.restore(); }
    const inlay = new T.Mesh(new T.CircleGeometry(24, 64), new T.MeshStandardMaterial({ map: G.tex(inl, null, true), transparent: true, color: 0xa89060, roughness: .6, metalness: .25, envMapIntensity: .5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); inlay.rotation.x = -PI / 2; inlay.position.set(0, .03, -2); inlay.receiveShadow = true; root.add(inlay);

    // ---- the monumental gate ----
    const gate = new T.Group(); gate.position.set(0, 0, L.gate.z); root.add(gate);
    const wall = X.archWall(64, 26, 8.2, 5, mats.stoneWarm, 10.2); wall.position.y = 0; gate.add(wall);
    [-1, 1].forEach(s => { const bt = X.tower(7.5, 34, 20 + s, true); bt.position.set(s * 25, 0, 1.5); gate.add(bt); const bt2 = X.tower(5, 22, 30 + s, true); bt2.position.set(s * 33, 0, 2); gate.add(bt2); });
    const ring = new T.Mesh(new T.TorusGeometry(8.9, .95, 16, 72), mats.stone); ring.position.set(0, 10.2, 2.6); ring.castShadow = true; gate.add(ring);
    const goldRing = new T.Mesh(new T.TorusGeometry(8.1, .16, 10, 72), mats.gold); goldRing.position.set(0, 10.2, 3.05); gate.add(goldRing);
    for (let i = 0; i < 24; i++) { const a = i * PI / 12, b = G.box(.7, 1.9, .9, mats.stoneWarm, Math.cos(a) * 9.9, 10.2 + Math.sin(a) * 9.9, 2.65); b.rotation.z = a - PI / 2; gate.add(b); }
    const doorGroup = [], dm = new T.MeshStandardMaterial({ map: G.tex(G.stoneCanvas(77, '#6f6650', .2), [1.4, 1.4]), roughness: .75, metalness: .05, envMapIntensity: .4 });
    const runeC = G.cv(512, 512), rx = runeC.getContext('2d'); rx.translate(256, 256); rx.strokeStyle = '#ffd884'; rx.fillStyle = '#ffd884'; rx.shadowColor = '#ffb030'; rx.shadowBlur = 14;
    [236, 190, 140, 96].forEach((rad, i) => { rx.lineWidth = i ? 4 : 7; rx.beginPath(); rx.arc(0, 0, rad, 0, PI * 2); rx.stroke(); }); for (let i = 0; i < 36; i++) { rx.save(); rx.rotate(i * PI / 18); rx.fillRect(-3, -230, 6, i % 3 ? 14 : 30); rx.restore(); }
    rx.lineWidth = 6; rx.beginPath(); rx.moveTo(0, -96); rx.lineTo(0, 96); rx.stroke(); rx.beginPath(); rx.arc(0, -20, 40, 0, PI * 2); rx.fill(); rx.beginPath(); rx.moveTo(-22, 10); rx.lineTo(22, 10); rx.lineTo(34, 96); rx.lineTo(-34, 96); rx.closePath(); rx.fill();   // keyhole
    const runeMat = new T.MeshBasicMaterial({ map: G.tex(runeC, null, true), transparent: true, opacity: .25, blending: T.AdditiveBlending, depthWrite: false });
    [-1, 1].forEach(s => { const d = new T.Group(); const half = new T.Mesh(new T.CylinderGeometry(8.05, 8.05, 1.1, 56, 1, false, s < 0 ? PI : 0, PI), dm); half.rotation.x = PI / 2; half.position.set(0, 0, 0); half.castShadow = true; d.add(half); d.position.set(0, 10.2, .3); gate.add(d); doorGroup.push(d); half.scale.set(1, 1, 1); });
    const rune = new T.Mesh(new T.CircleGeometry(7.9, 48), runeMat); rune.position.set(0, 10.2, .9); gate.add(rune);
    const portal = new T.Mesh(new T.CircleGeometry(8, 48), new T.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); portal.position.set(0, 10.2, -1.2); gate.add(portal);
    const gateGlow = G.glow(0xffe0a0, 30, 0); gateGlow.position.set(0, 10.2, 3.6); gate.add(gateGlow);
    const gems = [0, 1, 2].map(i => { const gm = new T.Mesh(new T.OctahedronGeometry(.55, 0), new T.MeshStandardMaterial({ color: 0x2a3340, emissive: 0x000000, metalness: .3, roughness: .2 })); gm.position.set((i - 1) * 2.1, 20.5, 3.4); gm.scale.set(1, 1.5, 1); gate.add(gm); const hl = G.glow(X.symHex[L.plates[i].sym], 3.5, 0); hl.position.copy(gm.position); gate.add(hl); return { gm, hl }; });
    gate.add(G.box(8, .9, 1.4, mats.stone, 0, 20.5, 3.2));
    // great stairs up to the gate
    const steps = new T.Group(); for (let i = 0; i < 8; i++) { const s = G.box(17 + (7 - i) * .0, .19 * (i + 1), .9, mats.stone, 0, .095 * (i + 1), -17.45 - .9 * i); steps.add(s); } root.add(steps);
    [-1, 1].forEach(s => { const bal = G.box(1.2, 2.1, 8.2, mats.stoneWarm, s * 9.2, .9, -21); root.add(bal); const orb = new T.Mesh(new T.SphereGeometry(.65, 14, 10), mats.gold); orb.position.set(s * 9.2, 2.45, -17.4); root.add(orb); X.brazier(root, anims, s * 9.2, -17.4, q.fire > 15, 2.1); });

    // ---- observatory dome and armillary sphere ----
    const dome = new T.Group(); dome.position.set(-27, 0, -12); root.add(dome); dome.add(G.cyl(8.5, 9, .8, mats.stone, 0, .4, 0, 40)); for (let i = 0; i < 10; i++) { const a = i * PI / 5, c = X.column(7, .5, false); c.position.set(Math.cos(a) * 7.3, .6, Math.sin(a) * 7.3); dome.add(c); }
    const cop = new T.MeshStandardMaterial({ color: 0x4f9a8a, metalness: .85, roughness: .32, envMapIntensity: 1.3, side: T.DoubleSide });
    const dm2 = new T.Mesh(new T.SphereGeometry(7.6, 40, 20, 0, PI * 2, 0, PI * .5), cop); dm2.position.y = 8.6; dm2.castShadow = true; dome.add(dm2); dome.add(G.cyl(7.9, 7.9, .5, mats.gold, 0, 8.6, 0, 40));
    const tele = new T.Group(); tele.add(G.cyl(.35, .45, 6, mats.bronze, 0, 0, 0, 12)); tele.rotation.set(0, 0, -.9); tele.position.set(0, 3, 0); dome.add(tele); dome.add(G.cyl(.5, .8, 2, mats.stone, 0, 1.6, 0, 10));
    const arm = new T.Group(); arm.position.set(24, 0, 12); root.add(arm); arm.add(G.cyl(1.1, 1.5, 1.6, mats.stone, 0, .8, 0, 14)); const ringsA = [];
    [[2.6, 0], [2.2, PI / 3], [1.8, -PI / 3], [1.4, PI / 2]].forEach((a, i) => { const t = new T.Mesh(new T.TorusGeometry(a[0], .07, 8, 40), mats.gold); t.position.y = 3.3; t.rotation.set(a[1], i * .5, 0); arm.add(t); ringsA.push(t); }); const orbs = new T.Mesh(new T.SphereGeometry(.45, 16, 12), new T.MeshStandardMaterial({ color: 0x66b8ff, emissive: 0x2a7cff, emissiveIntensity: 1.1 })); orbs.position.y = 3.3; arm.add(orbs); const og = G.glow(0x66b8ff, 3.6, .6); og.position.y = 3.3; arm.add(og);
    anims.push((t) => { ringsA.forEach((m, i) => { m.rotation.x += .004 * (i + 1); m.rotation.y += .006 * (i % 2 ? -1 : 1); }); });

    // ---- ruins, arches, hanging gardens ----
    const colSpots = [[-22, 8], [-26, 18], [22, 22], [27, 6], [-12, 26], [14, 28], [-30, -2], [31, -6]], colliders = [];
    colSpots.forEach((p, i) => { const c = X.column(5 + r() * 3, .55, i % 3 === 1, i % 2 ? mats.stone : mats.stoneMoss); c.position.set(p[0], 0, p[1]); c.rotation.y = r() * 6; root.add(c); colliders.push({ x: p[0], z: p[1], r: 1.1 }); });
    [[-18, 4, .3], [18, 4, -.3]].forEach(p => { const a = X.archWall(11, 9, 3.4, 1.3, mats.stoneWarm); a.position.set(p[0], 0, p[1]); a.rotation.y = p[2]; root.add(a); colliders.push({ x: p[0] - 5, z: p[1], r: 1.2 }, { x: p[0] + 5, z: p[1], r: 1.2 }); });
    const fern = G.ferns(q.ferns, { x: 0, z: 0, w: 66, d: 66 }, 5, (x, z) => Math.hypot(x, z) > 33.5 || Math.hypot(x, z) < 25 || z < -22); root.add(fern);
    const fl = new T.InstancedMesh(new T.SphereGeometry(.13, 6, 4), new T.MeshStandardMaterial({ color: 0xffffff, roughness: .6 }), 160), fm = new T.Object3D(), fc = new T.Color();
    for (let i = 0; i < 160; i++) { const a = r() * PI * 2, rr = 22 + r() * 11.5; fm.position.set(Math.cos(a) * rr, .45 + r() * .35, Math.sin(a) * rr); if (fm.position.z < -22) fm.position.z = -22 + r() * 6; fm.scale.setScalar(.6 + r() * .9); fm.updateMatrix(); fl.setMatrixAt(i, fm.matrix); fc.setHSL([.95, .08, .13, .6, .78][i % 5], .75, .66); fl.setColorAt(i, fc); } root.add(fl);
    for (let i = 0; i < 10; i++) { const a = PI * .2 + i * .52, p = G.vine(Math.cos(a) * 33.8, 2.6, Math.sin(a) * 33.8, 6, 200 + i); root.add(p); }
    // planter terraces along the rim
    for (let i = 0; i < 9; i++) { const a = PI * .1 + i * .62, tb = G.bevel(5.2, 1.2, 2.4, mats.stoneWarm, Math.cos(a) * 32.2, .6, Math.sin(a) * 32.2, .14); tb.rotation.y = -a + PI / 2; root.add(tb); colliders.push({ x: Math.cos(a) * 32.2, z: Math.sin(a) * 32.2, r: 2 }); }
    [[0, 34.4, 0], [-30, 19, -.9], [29, 17, .9]].forEach((w, i) => { const a = Math.atan2(w[1] === 34.4 ? 34.4 : w[1], w[0]); void a; });
    [[-31, 16], [31, 14], [0, 35.5], [-18, -28]].forEach((p, i) => { const l = Math.hypot(p[0], p[1]), n = [p[0] / l, p[1] / l]; X.fall(root, anims, n[0] * (R - 1.2), -.2, n[1] * (R - 1.2), 4.5 + i, 48, -Math.atan2(n[1], n[0]) + PI / 2); });
    const rays = X.godRays([{ x: -14, y: 22, z: -4, w: 18, len: 60, rx: -.62, rz: 0 }, { x: 10, y: 24, z: -10, w: 14, len: 62, rx: -.62, rz: .04 }, { x: 28, y: 20, z: 6, w: 12, len: 52, rx: -.62, rz: 0 }, { x: -2, y: 26, z: -18, w: 22, len: 64, rx: -.62, rz: 0 }], 0xfff2cc, 1); root.add(rays.obj); anims.push(rays.update);
    const dust = G.dust(q.dust, { w: 60, h: 14, d: 60 }, 0xfff0c0); root.add(dust.obj); anims.push(dust.update);
    const bird = []; for (let i = 0; i < 6; i++) { const m = new T.Mesh(new T.PlaneGeometry(1.4, .5), new T.MeshBasicMaterial({ color: 0x20303f, side: T.DoubleSide })); m.userData.a = i; root.add(m); bird.push(m); }
    anims.push(t => { bird.forEach((m, i) => { const a = t * .12 + i * 1.1, rr = 55 + i * 7; m.position.set(Math.cos(a) * rr, 24 + Math.sin(t * .5 + i) * 3 + i * 2, Math.sin(a) * rr); m.rotation.y = -a; m.rotation.z = Math.sin(t * 6 + i * 2) * .5; }); });

    // ---- mirrors ----
    const mir = L.mirrors.map((m, i) => {
      const g = new T.Group(); g.position.set(m.x, 0, m.z); root.add(g);
      g.add(G.cyl(1.05, 1.3, .35, mats.stone, 0, .17, 0, 20)); g.add(G.cyl(.78, .95, .5, mats.stoneWarm, 0, .55, 0, 20)); g.add(G.cyl(.16, .24, 1.2, mats.bronze, 0, 1.2, 0, 10));
      const head = new T.Group(); head.position.y = 2.1; g.add(head);
      const frame = new T.Mesh(new T.TorusGeometry(1, .1, 10, 36), mats.bronze); frame.scale.set(1, 1.28, 1); frame.castShadow = true; head.add(frame);
      const gl = new T.Mesh(new T.CircleGeometry(.98, 34), new T.MeshStandardMaterial({ color: 0xf2f6ff, metalness: 1, roughness: .04, envMapIntensity: 2.2, side: T.DoubleSide })); gl.scale.set(1, 1.28, 1); head.add(gl);
      const back = new T.Mesh(new T.CircleGeometry(1, 30), mats.bronze); back.scale.set(1, 1.3, 1); back.position.z = -.04; back.rotation.y = PI; head.add(back);
      for (let k = 0; k < 8; k++) { const a = k * PI / 4, st = new T.Mesh(new T.OctahedronGeometry(.07, 0), mats.gold); st.position.set(Math.cos(a) * 1.0, Math.sin(a) * 1.28, 0); head.add(st); }
      const hl = G.glow(0xffe29a, 4, 0); hl.position.y = 2.1; g.add(hl);
      const o = { g, head, hl, k: m.start, ang: Math.PI / 2 - m.start * PI / 8, tgt: Math.PI / 2 - m.start * PI / 8 }; head.rotation.y = o.ang; return o;
    });
    // sun shafts: one thick shaft of light from the sky into each mirror
    const shafts = new T.Group(); root.add(shafts); const sa = new T.Vector3(), sb = new T.Vector3(), sd = new T.Vector3();
    L.mirrors.forEach(m => { const mesh = new T.Mesh(new T.CylinderGeometry(.18, .5, 1, 10, 1, true), new T.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: .42, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })); sa.set(m.x, 2.1 + 38, m.z - 38); sb.set(m.x, 2.1, m.z); sd.subVectors(sb, sa); mesh.position.copy(sa).addScaledVector(sd, .5); mesh.quaternion.setFromUnitVectors(Y, sd.clone().normalize()); mesh.scale.set(1, sd.length(), 1); shafts.add(mesh); const halo = new T.Mesh(new T.CylinderGeometry(1.1, 1.8, 1, 10, 1, true), new T.MeshBasicMaterial({ color: 0xffeebb, transparent: true, opacity: .1, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })); halo.position.copy(mesh.position); halo.quaternion.copy(mesh.quaternion); halo.scale.copy(mesh.scale); shafts.add(halo); });
    const bm = X.beams(root, 12, 0xfff0b0, .075); const bmv = { cur: [] };
    // ---- floor plates that reveal the symbols ----
    const plates = L.plates.map((p, i) => {
      const g = new T.Group(); g.position.set(p.x, 0, p.z); root.add(g); g.add(G.cyl(1.65, 1.8, .22, mats.stoneDark, 0, .11, 0, 28)); const ringP = new T.Mesh(new T.TorusGeometry(1.45, .06, 6, 28), mats.bronze); ringP.rotation.x = PI / 2; ringP.position.y = .23; g.add(ringP);
      const faint = X.glyphMesh(p.sym, '#6a6048', null, 2.2); faint.rotation.x = -PI / 2; faint.position.y = .235; faint.material.opacity = .35; g.add(faint);
      const gm = X.glyphMesh(p.sym, X.symColor[p.sym], X.symColor[p.sym], 2.6, true); gm.rotation.x = -PI / 2; gm.position.y = .26; gm.material.opacity = 0; g.add(gm);
      const gl = G.glow(X.symHex[p.sym], 6, 0); gl.position.y = .6; g.add(gl); const col = new T.Mesh(new T.CylinderGeometry(1.2, 1.5, 7, 16, 1, true), new T.MeshBasicMaterial({ color: X.symHex[p.sym], transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); col.position.y = 3.6; g.add(col);
      return { g, gm, gl, col, v: 0 };
    });
    // ---- pillars ----
    const pillars = L.pillars.map((p, i) => {
      const g = new T.Group(); g.position.set(p.x, 0, p.z); root.add(g); const hx = X.symHex[p.sym];
      g.add(G.cyl(1.2, 1.4, .5, mats.stone, 0, .25, 0, 8)); g.add(G.cyl(.78, .9, 3.4, mats.stoneWarm, 0, 2.2, 0, 8)); [.9, 3.5].forEach(y => g.add(G.cyl(.95, .95, .14, mats.gold, 0, y, 0, 8)));
      g.add(G.cyl(1.0, .85, .35, mats.stone, 0, 4.1, 0, 8)); const cr = new T.Mesh(new T.OctahedronGeometry(.55, 0), new T.MeshStandardMaterial({ color: 0x334055, emissive: hx, emissiveIntensity: .05, metalness: .3, roughness: .15 })); cr.scale.set(1, 1.5, 1); cr.position.y = 4.95; g.add(cr);
      const ringC = new T.Mesh(new T.TorusGeometry(.8, .04, 6, 30), new T.MeshBasicMaterial({ color: hx, transparent: true, opacity: .0, blending: T.AdditiveBlending })); ringC.rotation.x = PI / 2; ringC.position.y = 4.95; g.add(ringC);
      for (let k = 0; k < 4; k++) { const gm = X.glyphMesh(p.sym, X.symColor[p.sym], X.symColor[p.sym], 1.15, true); gm.material.opacity = .95; const a = k * PI / 2; gm.position.set(Math.sin(a) * .93, 2.3, Math.cos(a) * .93); gm.rotation.y = a; g.add(gm); }
      const gl = G.glow(hx, 6, 0); gl.position.y = 4.95; g.add(gl); const light = new T.PointLight(hx, 0, 14, 2); light.position.y = 4.6; g.add(light);
      return { g, cr, ringC, gl, light, v: 0, flash: 0, wrong: 0, hx };
    });

    // ---- coins ----
    const coins = L.coins.map(c => { const m = X.coinMesh(); m.position.set(c[0], 1.1, c[1]); root.add(m); return m; });

    // ---- state -> picture ----
    let gateK = 0, gateTarget = 0, lastEval = null;
    const sync = function (ev, events, instant) {
      lastEval = ev;
      ev.mirrors.forEach((m, i) => { const o = mir[i]; if (m.k !== o.k) { const d = ((m.k - o.k + 12) % 8) - 4; o.tgt += -d * PI / 8; o.k = m.k; } if (instant) { o.ang = o.tgt; o.head.rotation.y = o.ang; } });
      if (ev.gate) gateTarget = 1; else if (instant) { gateTarget = 0; gateK = 0; }
      if (instant) plates.forEach((p, i) => { p.v = ev.lit[i] ? 1 : 0; });
      pillars.forEach((p, i) => { const done = L.pillars[i] && ev.seq > L.plates.findIndex(pl => pl.sym === L.pillars[i].sym); if (instant) p.v = done ? 1 : 0; p.tv = done ? 1 : 0; });
      gems.forEach((gm, i) => { gm.tv = i < ev.seq ? 1 : 0; if (instant) gm.v = gm.tv; });
      (events || []).forEach(e => { if (e === 'pillarWrong') pillars.forEach(p => { p.wrong = 1; }); });
      const segs = []; ev.beams.forEach((b, i) => { const lastI = b.segs.length - 1; b.segs.forEach((s, j) => { const len = Math.min(44, Math.hypot(s.x1 - s.x0, s.z1 - s.z0)); const k = len / Math.max(.01, Math.hypot(s.x1 - s.x0, s.z1 - s.z0)); const hitEnd = b.hit && j === lastI; segs.push({ x0: s.x0, y0: j === 0 ? 2.1 : 2.1, z0: s.z0, x1: s.x0 + (s.x1 - s.x0) * k, y1: hitEnd ? .3 : 2.1, z1: s.z0 + (s.z1 - s.z0) * k }); }); }); bmv.cur = segs; bm.set(segs);
    };
    const update = function (t, dt) {
      mir.forEach((o, i) => { o.ang += (o.tgt - o.ang) * Math.min(1, dt * 7); o.head.rotation.y = o.ang; const lit = lastEval && lastEval.lit && lastEval.beams[i] && lastEval.beams[i].hit; o.hl.material.opacity = .28 + .12 * Math.sin(t * 3 + i) + (lit ? .3 : 0); });
      if (lastEval) plates.forEach((p, i) => { const tv = lastEval.lit[i] ? 1 : 0; p.v += (tv - p.v) * Math.min(1, dt * 3); p.gm.material.opacity = p.v * (.9 + .1 * Math.sin(t * 4 + i)); p.gl.material.opacity = p.v * .7; p.col.material.opacity = p.v * .1; });
      pillars.forEach((p, i) => { p.v += ((p.tv || 0) - p.v) * Math.min(1, dt * 3); p.wrong = Math.max(0, p.wrong - dt * 1.4); const w = p.wrong; p.cr.material.emissive.setHex(w > .05 ? 0xff3030 : p.hx); p.cr.material.emissiveIntensity = .05 + p.v * 2.4 + w * 2 + (lastEval && lastEval.allLit ? .35 + .2 * Math.sin(t * 3 + i) : 0); p.ringC.material.opacity = p.v * (.6 + .3 * Math.sin(t * 5)) + w * .6; p.ringC.material.color.setHex(w > .05 ? 0xff3030 : p.hx); p.gl.material.opacity = p.v * .8 + w * .6; p.light.intensity = p.v * 2.6 + w * 2; p.cr.rotation.y += dt * (.6 + p.v * 2); p.cr.position.y = 4.95 + Math.sin(t * 1.6 + i) * .08; });
      gems.forEach((gm, i) => { gm.v += ((gm.tv || 0) - gm.v) * Math.min(1, dt * 3); gm.gm.material.emissive.setHex(X.symHex[L.plates[i].sym]); gm.gm.material.emissiveIntensity = gm.v * 2.4; gm.hl.material.opacity = gm.v * .8; gm.gm.rotation.y += dt; });
      bm.pulse(t); gateK += (gateTarget - gateK) * Math.min(1, dt * .55); const k = G.ease(Math.min(1, gateK));
      doorGroup[0].position.x = -k * 8.4; doorGroup[1].position.x = k * 8.4; portal.material.opacity = Math.min(1, k * 1.4) * .9; runeMat.opacity = .25 + .55 * (gems[0].v + gems[1].v + gems[2].v) / 3 + k * .2; gateGlow.material.opacity = (gems[0].v + gems[1].v + gems[2].v) / 3 * .3 + k * .8;
      coins.forEach((c, i) => { if (!c.visible) return; c.rotation.y = t * 2.2 + i; c.position.y = 1.1 + Math.sin(t * 2 + i) * .12; });
    };
    // ---- interactables ----
    const act = [];
    L.mirrors.forEach((m, i) => act.push({ id: m.id, kind: 'mirror', label: 'Turn mirror', x: m.x, z: m.z, range: 3.4, anim: 'turn', dur: 1.0, hit: .45, a: { t: 'mirror', id: m.id }, look: [m.x, 2.1, m.z], root: mir[i].g, standDist: 2.5 }));
    L.pillars.forEach((p, i) => act.push({ id: p.id, kind: 'pillar', label: 'Wake pillar', x: p.x, z: p.z, range: 3.3, anim: 'reach', dur: 1.1, hit: .5, a: { t: 'pillar', id: p.id }, look: [p.x, 2.5, p.z], root: pillars[i].g, standDist: 2.3 }));
    colliders.push(...L.mirrors.map(m => ({ x: m.x, z: m.z, r: .95 })), ...L.pillars.map(p => ({ x: p.x, z: p.z, r: 1.0 })), { x: -27, z: -12, r: 9 }, { x: 24, z: 12, r: 1.7 });
    const groundAt = (x, z) => {
      const rr = Math.hypot(x, z); if (rr > R - 1.4 || z < -24.2) return null;
      if (z < -17 && Math.abs(x) < 8.7) { const i = Math.floor((-17 - z) / .9); return .19 * Math.min(8, i + 1); }
      return 0;
    };
    return {
      groundAt, colliders, interactables: act, sync, update, coinMeshes: coins, coinPos: L.coins, start: L.start,
      sunDir: [0, 60, -55], cam: { yaw: 0, pitch: .4, dist: 10 },
      finaleCam() { return [{ t: 0, p: [0, 3, -4], l: [0, 6, -27] }, { t: 2.4, p: [0, 4.5, -10], l: [0, 9, -27] }, { t: 5.2, p: [0, 7, -16], l: [0, 10, -27] }, { t: 8, p: [0, 9, -20], l: [0, 11, -27] }]; },
      finaleDur: 8.4, onFinale(ctx2) { ctx2.fx.burst(0, 10.2, L.gate.z + 3, 70, 0xffe9a0, 6); },
      hintTarget(tg, wrap) { for (const a of act) if (a.id === tg.id) return a; return null; }
    };
  };
})();
