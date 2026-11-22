/* MindVerse - graphics kit: procedural textures, materials, lighting, sky, foliage, water, waterfalls,
 * god rays, dust, torches. Everything is generated in code (no downloaded art), so the game is original and offline.
 * Requires three.js r128 (games/vendor/three.min.js).
 */
(function () {
  'use strict';
  const T = THREE, MV = (window.MV = window.MV || {}), G = (MV.gfx = {});

  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const rng = seed => { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
  G.rng = rng; G.cv = cv;
  const tex = (c, rep, srgb) => { const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]); if (srgb !== false) t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t; };
  G.tex = tex;

  /* ---------- procedural textures ---------- */
  G.stoneCanvas = function (seed, base, moss) {
    const c = cv(256, 256), x = c.getContext('2d'), r = rng(seed);
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 40; i++) { const px = r() * 256, py = r() * 256, rad = 14 + r() * 40, gr = x.createRadialGradient(px, py, 0, px, py, rad); gr.addColorStop(0, r() < .55 ? 'rgba(15,10,2,.16)' : 'rgba(255,238,200,.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(px - rad, py - rad, rad * 2, rad * 2); }
    for (let i = 0; i < 1800; i++) { x.fillStyle = r() < .5 ? 'rgba(20,15,5,' + (.03 + .05 * r()) + ')' : 'rgba(255,240,200,' + (.02 + .04 * r()) + ')'; x.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); }
    x.strokeStyle = 'rgba(30,22,10,.55)'; x.lineWidth = 2;                         // block seams
    x.strokeRect(1, 1, 254, 254); x.beginPath(); x.moveTo(0, 128); x.lineTo(256, 128); x.moveTo(128, 0); x.lineTo(128, 128); x.moveTo(64, 128); x.lineTo(64, 256); x.moveTo(192, 128); x.lineTo(192, 256); x.stroke();
    x.strokeStyle = 'rgba(25,18,8,.4)'; x.lineWidth = 1;                           // cracks
    for (let i = 0; i < 5; i++) { x.beginPath(); let px = r() * 256, py = r() * 256; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (r() - .5) * 40; py += (r() - .3) * 36; x.lineTo(px, py); } x.stroke(); }
    if (moss) for (let i = 0; i < 26 * moss; i++) { const px = r() * 256, py = r() < .6 ? 256 - r() * 90 : r() * 256, rad = 8 + r() * 26, g = x.createRadialGradient(px, py, 0, px, py, rad); g.addColorStop(0, 'rgba(52,84,28,.7)'); g.addColorStop(1, 'rgba(48,80,26,0)'); x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2); }
    return c;
  };
  G.tileCanvas = function (seed, bump) {                                              // flagstones: big soft blotches, bevelled joints, cracks, moss in the corners
    const c = cv(512, 512), x = c.getContext('2d'), r = rng(seed);
    x.fillStyle = bump ? '#808080' : '#2d281f'; x.fillRect(0, 0, 512, 512);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const X = i * 128, Y = j * 128;
      if (bump) { const l = 120 + r() * 30; x.fillStyle = 'rgb(' + l + ',' + l + ',' + l + ')'; x.fillRect(X + 4, Y + 4, 120, 120); }
      else { const h = 28 + r() * 14, s = 12 + r() * 12, l = 24 + r() * 13; const g = x.createLinearGradient(X, Y, X + 128, Y + 128); g.addColorStop(0, 'hsl(' + h + ',' + s + '%,' + (l + 4) + '%)'); g.addColorStop(1, 'hsl(' + h + ',' + s + '%,' + (l - 4) + '%)'); x.fillStyle = g; x.fillRect(X + 3, Y + 3, 122, 122); }
      for (let k = 0; k < 4; k++) { const px = X + r() * 128, py = Y + r() * 128, rad = 20 + r() * 40, gr = x.createRadialGradient(px, py, 0, px, py, rad); const dark = r() < .55; gr.addColorStop(0, bump ? (dark ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.1)') : (dark ? 'rgba(10,6,0,.16)' : 'rgba(255,235,190,.07)')); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.save(); x.beginPath(); x.rect(X + 3, Y + 3, 122, 122); x.clip(); x.fillStyle = gr; x.fillRect(px - rad, py - rad, rad * 2, rad * 2); x.restore(); }
      if (!bump) { x.fillStyle = 'rgba(255,240,205,.16)'; x.fillRect(X + 3, Y + 3, 122, 3); x.fillRect(X + 3, Y + 3, 3, 122); x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(X + 3, Y + 122, 122, 3); x.fillRect(X + 122, Y + 3, 3, 122);
        if (r() < .5) { const px = X + (r() < .5 ? 8 : 118), py = Y + (r() < .5 ? 8 : 118), rad = 20 + r() * 28, gm = x.createRadialGradient(px, py, 0, px, py, rad); gm.addColorStop(0, 'rgba(48,78,26,.75)'); gm.addColorStop(1, 'rgba(48,78,26,0)'); x.save(); x.beginPath(); x.rect(X + 3, Y + 3, 122, 122); x.clip(); x.fillStyle = gm; x.fillRect(px - rad, py - rad, rad * 2, rad * 2); x.restore(); } }
      if (r() < .4) { x.strokeStyle = bump ? 'rgba(0,0,0,.5)' : 'rgba(10,6,0,.55)'; x.lineWidth = 1.5; x.beginPath(); let px = X + 10 + r() * 100, py = Y + 10 + r() * 100; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (r() - .5) * 36; py += (r() - .5) * 36; x.lineTo(Math.max(X + 4, Math.min(X + 124, px)), Math.max(Y + 4, Math.min(Y + 124, py))); } x.stroke(); }
    }
    x.strokeStyle = bump ? '#202020' : 'rgba(10,7,2,.85)'; x.lineWidth = 5; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 128, 0); x.lineTo(i * 128, 512); x.moveTo(0, i * 128); x.lineTo(512, i * 128); x.stroke(); }
    return c;
  };
  G.leafCanvas = function () {                                                        // a clump of long arching leaves (side view)
    const c = cv(256, 256), x = c.getContext('2d'), r = rng(21); x.translate(128, 254);
    for (let i = 0; i < 11; i++) {
      const a = (-74 + i * 14.8 + (r() - .5) * 8) * Math.PI / 180, len = 150 + r() * 80, w = 15 + r() * 8, bend = (a < 0 ? -1 : 1) * (.15 + r() * .3);
      x.save(); x.rotate(a); const g = x.createLinearGradient(0, 0, 0, -len); g.addColorStop(0, '#1d4a14'); g.addColorStop(.5, '#3f8a24'); g.addColorStop(1, i % 2 ? '#8ccf45' : '#6fb534');
      x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(-w, -len * .3, -w * .9 + len * bend * .3, -len * .75, len * bend, -len); x.bezierCurveTo(w * .9 + len * bend * .3, -len * .7, w, -len * .3, 0, 0); x.fill();
      x.strokeStyle = 'rgba(15,45,10,.7)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(len * bend * .2, -len * .5, len * bend, -len); x.stroke(); x.restore();
    }
    return c;
  };
  G.glowCanvas = function (stops) {
    const c = cv(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    (stops || [[0, 'rgba(255,255,255,1)'], [.25, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]).forEach(s => g.addColorStop(s[0], s[1])); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return c;
  };
  G.rayCanvas = function () {                                                         // god-ray shaft, bright at the source end
    const c = cv(64, 256), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255,236,190,.9)'); g.addColorStop(.5, 'rgba(255,220,160,.28)'); g.addColorStop(1, 'rgba(255,220,160,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 256);
    const m = x.createLinearGradient(0, 0, 64, 0); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(.5, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = m; x.fillRect(0, 0, 64, 256); return c;
  };
  G.streakCanvas = function () {                                                      // waterfall streaks
    const c = cv(128, 256), x = c.getContext('2d'), r = rng(7);
    x.fillStyle = 'rgba(190,230,245,.35)'; x.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 90; i++) { const px = r() * 128, w = 1 + r() * 3, l = 40 + r() * 140, y0 = r() * 256; const g = x.createLinearGradient(0, y0, 0, y0 + l); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,' + (.35 + r() * .5) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(px, y0, w, l); x.fillRect(px, y0 - 256, w, l); }
    return c;
  };
  G.flameCanvas = function () {
    const c = cv(64, 128), x = c.getContext('2d'), g = x.createRadialGradient(32, 90, 2, 32, 80, 52);
    g.addColorStop(0, 'rgba(255,250,200,1)'); g.addColorStop(.3, 'rgba(255,190,70,.95)'); g.addColorStop(.7, 'rgba(255,90,10,.5)'); g.addColorStop(1, 'rgba(255,60,0,0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(32, 2); x.bezierCurveTo(60, 50, 62, 90, 32, 124); x.bezierCurveTo(2, 90, 4, 50, 32, 2); x.fill(); return c;
  };

  /* glyphs used for symbols (spiral, triangle, sun, plus clue helper arrows) */
  G.drawGlyph = function (x, sym, cx, cy, s, col, glow) {
    x.save(); x.translate(cx, cy); x.lineWidth = s * .1; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = col; x.fillStyle = col;
    if (glow) { x.shadowColor = glow; x.shadowBlur = s * .35; }
    if (sym === 'spiral') { x.beginPath(); for (let a = 0; a < Math.PI * 5.2; a += .12) { const rr = s * .06 + a * s * .062; const px = Math.cos(a) * rr, py = Math.sin(a) * rr; a ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); }
    else if (sym === 'triangle') { x.beginPath(); x.moveTo(0, -s * .42); x.lineTo(s * .4, s * .3); x.lineTo(-s * .4, s * .3); x.closePath(); x.stroke(); x.beginPath(); x.arc(0, s * .02, s * .06, 0, 7); x.fill(); }
    else if (sym === 'sun') { x.beginPath(); x.arc(0, 0, s * .2, 0, 7); x.stroke(); for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; x.beginPath(); x.moveTo(Math.cos(a) * s * .3, Math.sin(a) * s * .3); x.lineTo(Math.cos(a) * s * (i % 2 ? .38 : .47), Math.sin(a) * s * (i % 2 ? .38 : .47)); x.stroke(); } }
    else if (sym === 'wave') { for (let k = -1; k <= 1; k++) { x.beginPath(); for (let i = -10; i <= 10; i++) { const px = i * s * .04, py = k * s * .22 + Math.sin(i * .62) * s * .09; i === -10 ? x.moveTo(px, py) : x.lineTo(px, py); } x.stroke(); } }
    else if (sym === 'moon') { x.beginPath(); x.arc(0, 0, s * .36, Math.PI * .28, Math.PI * 1.72, false); x.arc(s * .16, 0, s * .29, Math.PI * 1.6, Math.PI * .4, true); x.closePath(); x.stroke(); }
    else if (sym === 'eye') { x.beginPath(); x.moveTo(-s * .42, 0); x.quadraticCurveTo(0, -s * .46, s * .42, 0); x.quadraticCurveTo(0, s * .46, -s * .42, 0); x.stroke(); x.beginPath(); x.arc(0, 0, s * .15, 0, 7); x.stroke(); x.beginPath(); x.arc(0, 0, s * .05, 0, 7); x.fill(); }
    else if (sym === 'star') { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? s * .17 : s * .42; i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.closePath(); x.stroke(); }
    x.restore();
  };
  G.glyphTexture = function (sym, bg, col, glow) {
    const c = cv(256, 256), x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 256, 256);
    const st = G.stoneCanvas(sym.length * 31, bg, 0); x.drawImage(st, 0, 0);
    G.drawGlyph(x, sym, 128, 128, 190, col, glow); return tex(c, null, true);
  };

  /* ---------- materials ---------- */
  const M = (G.mat = {});
  G.initMaterials = function () {
    const st = (seed, base, moss) => { const c = G.stoneCanvas(seed, base, moss); const t = tex(c, [1, 1]); const b = tex(c, [1, 1], false); return new T.MeshStandardMaterial({ map: t, bumpMap: b, bumpScale: .7, roughness: .9, metalness: 0, envMapIntensity: .22 }); };
    M.stone = st(11, '#7a705a', 0.6); M.stoneDark = st(23, '#4d473b', 0.9); M.stoneWarm = st(37, '#8c7650', 0.35); M.stoneMoss = st(41, '#625f47', 1.1);
    const tc = G.tileCanvas(5), tb = G.tileCanvas(5, true); G._tc = tc; G._tb = tb; M.floor = new T.MeshStandardMaterial({ map: tex(tc, [.25, .25]), bumpMap: tex(tb, [.25, .25], false), bumpScale: 2.4, roughness: .74, envMapIntensity: .35 });
    M.gold = new T.MeshStandardMaterial({ color: 0xe0a93e, metalness: .92, roughness: .28, envMapIntensity: 1.25 });
    M.bronze = new T.MeshStandardMaterial({ color: 0xa8743a, metalness: .85, roughness: .4, envMapIntensity: 1.1 });
    M.glass = new T.MeshStandardMaterial({ color: 0x8cc8f0, metalness: 1, roughness: .06, envMapIntensity: 1.5 });
    M.dark = new T.MeshStandardMaterial({ color: 0x030201, roughness: 1 });
    M.cloth = new T.MeshStandardMaterial({ color: 0x8a1d28, roughness: .85, side: T.DoubleSide });
    M.wood = new T.MeshStandardMaterial({ color: 0x6b4426, roughness: .8 });
    M.clay = new T.MeshStandardMaterial({ color: 0xb9683a, roughness: .7 });
    M.leaf = new T.MeshStandardMaterial({ color: 0x3f8a2a, roughness: .8, side: T.DoubleSide });
    M.crystal = new T.MeshStandardMaterial({ color: 0x2c9fe0, emissive: 0x138fff, emissiveIntensity: 1.5, metalness: .25, roughness: .1, transparent: true, opacity: .9, envMapIntensity: 1.8 });
    M.energy = new T.MeshBasicMaterial({ color: 0x35c4ff, transparent: true, opacity: .95, blending: T.AdditiveBlending, depthWrite: false });
    M.energyGlow = new T.MeshBasicMaterial({ color: 0x1a8fff, transparent: true, opacity: .2, blending: T.AdditiveBlending, depthWrite: false });
    M.groove = new T.MeshStandardMaterial({ color: 0x0a0806, roughness: 1 });
    M.rope = new T.MeshStandardMaterial({ color: 0x8c7448, roughness: .95 });
  };

  G.floorMat = function (w, d) {                                                       // a plane-mapped floor: one stone flag is about 2 units
    const m = new T.MeshStandardMaterial({ map: tex(G._tc, [w / 8, d / 8]), bumpMap: tex(G._tb, [w / 8, d / 8], false), bumpScale: 2.4, roughness: .74, envMapIntensity: .35 }); return m;
  };
  /* ---------- helpers ---------- */
  G.box = function (w, h, d, mat, x, y, z, shadow) {                                  // box with world-scaled UVs so stone tiles evenly
    const g = new T.BoxGeometry(w, h, d), uv = g.attributes.uv, s = .5, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] * s, uv.getY(i) * dims[f][1] * s); }
    const m = new T.Mesh(g, mat); m.position.set(x || 0, y || 0, z || 0); if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; } return m;
  };
  G.bevel = function (w, h, d, mat, x, y, z, bv) {                                    // beveled block: catches highlights on its edges
    bv = bv || Math.min(w, h, d) * .08;
    const sh = new T.Shape(); sh.moveTo(-w / 2 + bv, -h / 2 + bv); sh.lineTo(w / 2 - bv, -h / 2 + bv); sh.lineTo(w / 2 - bv, h / 2 - bv); sh.lineTo(-w / 2 + bv, h / 2 - bv); sh.closePath();
    const g = new T.ExtrudeGeometry(sh, { depth: Math.max(.01, d - 2 * bv), bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 2, curveSegments: 1 });
    g.translate(0, 0, -(d - 2 * bv) / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * .5, uv.getY(i) * .5);
    const m = new T.Mesh(g, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = m.receiveShadow = true; return m;
  };
  G.cyl = (rt, rb, h, mat, x, y, z, seg) => { const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 24), mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = m.receiveShadow = true; return m; };
  G.glow = function (color, size, opacity) {
    G._gt = G._gt || tex(G.glowCanvas()); const m = new T.SpriteMaterial({ map: G._gt, color, blending: T.AdditiveBlending, transparent: true, opacity: opacity == null ? .8 : opacity, depthWrite: false });
    const s = new T.Sprite(m); s.scale.set(size, size, 1); return s;
  };
  G.hit = function (oid, r, h, y) {                                                   // invisible forgiving touch target
    const m = new T.Mesh(new T.CylinderGeometry(r, r, h, 10), new T.MeshBasicMaterial({ visible: false })); m.position.y = y == null ? h / 2 : y; m.userData.oid = oid; m.userData.hit = true; return m;
  };
  G.tagAll = function (obj, oid) { obj.traverse(o => { if (o.isMesh) o.userData.oid = oid; }); };

  /* ---------- renderer, sky, lighting ---------- */
  G.makeRenderer = function (canvas, q) {
    const r = new T.WebGLRenderer({ canvas, antialias: q.aa, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!q.preserve });
    r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = .95;
    r.shadowMap.enabled = q.shadow > 0; r.shadowMap.type = T.PCFSoftShadowMap; return r;
  };
  G.envMap = function (renderer) {
    const c = cv(512, 256), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#5fa6e6'); g.addColorStop(.42, '#bfe0f6'); g.addColorStop(.5, '#ffe6b0'); g.addColorStop(.52, '#7a6a48'); g.addColorStop(1, '#27391e'); x.fillStyle = g; x.fillRect(0, 0, 512, 256);
    const s = x.createRadialGradient(150, 70, 0, 150, 70, 46); s.addColorStop(0, 'rgba(255,248,220,1)'); s.addColorStop(1, 'rgba(255,230,160,0)'); x.fillStyle = s; x.fillRect(0, 0, 512, 256);
    const b = x.createRadialGradient(390, 120, 0, 390, 120, 70); b.addColorStop(0, 'rgba(90,190,255,.9)'); b.addColorStop(1, 'rgba(90,190,255,0)'); x.fillStyle = b; x.fillRect(0, 0, 512, 256);
    const t = new T.CanvasTexture(c); t.mapping = T.EquirectangularReflectionMapping; t.encoding = T.sRGBEncoding;
    const pm = new T.PMREMGenerator(renderer), rt = pm.fromEquirectangular(t); pm.dispose(); t.dispose(); return rt.texture;
  };
  G.sky = function (top, mid, bottom) {                                               // gradient dome with a sun disc
    const c = cv(16, 256), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, top); g.addColorStop(.55, mid); g.addColorStop(1, bottom); x.fillStyle = g; x.fillRect(0, 0, 16, 256);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding;
    const m = new T.Mesh(new T.SphereGeometry(170, 24, 16), new T.MeshBasicMaterial({ map: t, side: T.BackSide, fog: false, depthWrite: false })); m.renderOrder = -10; return m;
  };

  /* ---------- foliage ---------- */
  function crossQuad() {                                                              // two crossed quads, pivot at the ground
    const p = [], u = [], n = [], idx = [];
    [0, Math.PI / 2].forEach((a, k) => { const c = Math.cos(a), s = Math.sin(a); const q = [[-.5, 0, 0, 0], [.5, 0, 1, 0], [.5, 1, 1, 1], [-.5, 1, 0, 1]]; q.forEach(v => { p.push(v[0] * c, v[1], v[0] * s); u.push(v[2], v[3]); n.push(0, 1, 0); }); const o = k * 4; idx.push(o, o + 1, o + 2, o, o + 2, o + 3); });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(u, 2)); g.setAttribute('normal', new T.Float32BufferAttribute(n, 3)); g.setIndex(idx); return g;
  }
  G.ferns = function (count, area, seed, avoid) {
    G._lt = G._lt || tex(G.leafCanvas());
    const m = new T.InstancedMesh(crossQuad(), new T.MeshStandardMaterial({ map: G._lt, alphaTest: .45, side: T.DoubleSide, roughness: .85, envMapIntensity: .3 }), count), r = rng(seed), d = new T.Object3D(), col = new T.Color();
    for (let i = 0; i < count; i++) {
      let x, z, k = 0; do { x = area.x + (r() - .5) * area.w; z = area.z + (r() - .5) * area.d; k++; } while (avoid && avoid(x, z) && k < 12);
      const s = .9 + r() * 1.5; d.position.set(x, 0, z); d.rotation.set(0, r() * 6.28, 0); d.scale.set(s * 1.4, s * (.8 + r() * .6), s * 1.4); d.updateMatrix(); m.setMatrixAt(i, d.matrix);
      col.setHSL(.25 + r() * .07, .5 + r() * .2, .2 + r() * .14); m.setColorAt(i, col);
    }
    m.castShadow = false; m.receiveShadow = true; return m;
  };
  G.trees = function (count, ringR, spread, seed) {                                   // instanced trunks and layered canopy blobs
    const r = rng(seed), trunkG = new T.CylinderGeometry(.5, .9, 1, 7), blobG = new T.IcosahedronGeometry(1, 1);
    const bark = new T.MeshStandardMaterial({ color: 0x4a3622, roughness: 1 }), leaf = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .85, flatShading: true });
    const trunks = new T.InstancedMesh(trunkG, bark, count), blobs = new T.InstancedMesh(blobG, leaf, count * 4), d = new T.Object3D(), col = new T.Color();
    let b = 0;
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2, rad = ringR + r() * spread, x = Math.cos(a) * rad, z = Math.sin(a) * rad * .8, h = 14 + r() * 18;
      d.position.set(x, h / 2 - 1, z); d.rotation.set(0, 0, (r() - .5) * .08); d.scale.set(1 + r() * .8, h, 1 + r() * .8); d.updateMatrix(); trunks.setMatrixAt(i, d.matrix);
      for (let k = 0; k < 4; k++) {
        const s = 4 + r() * 4.5; d.position.set(x + (r() - .5) * 5, h - 2 + k * 2.2 + r() * 3, z + (r() - .5) * 5); d.rotation.set(r(), r(), r()); d.scale.set(s, s * .75, s); d.updateMatrix(); blobs.setMatrixAt(b, d.matrix);
        col.setHSL(.26 + r() * .07, .5 + r() * .2, .2 + r() * .13); blobs.setColorAt(b++, col);
      }
    }
    trunks.castShadow = blobs.castShadow = true; const g = new T.Group(); g.add(trunks, blobs); return g;
  };
  G.vine = function (x, y, z, len, seed) {                                            // hanging vine with leaves
    const r = rng(seed), pts = [], g = new T.Group();
    for (let i = 0; i <= 6; i++) pts.push(new T.Vector3(x + Math.sin(i * .9 + seed) * .12 * i, y - len * i / 6, z + Math.cos(i * .7 + seed) * .08 * i));
    const tube = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 14, .035, 5, false), new T.MeshStandardMaterial({ color: 0x2f5a22, roughness: 1 })); tube.castShadow = true; g.add(tube);
    G._lt = G._lt || tex(G.leafCanvas());
    for (let i = 1; i < 7; i++) { const l = new T.Mesh(new T.PlaneGeometry(.5, .5), new T.MeshStandardMaterial({ map: G._lt, alphaTest: .45, side: T.DoubleSide, color: 0x9fe070 })); l.position.copy(pts[i]); l.rotation.set((r() - .5) * 1.2, r() * 6, (r() - .5) * 1.2); l.scale.setScalar(.7 + r() * .7); g.add(l); }
    return g;
  };

  /* ---------- animated effects (each returns { obj, update(t, dt) }) ---------- */
  G.dust = function (count, box, color) {
    const r = rng(99), pos = new Float32Array(count * 3), vel = [];
    for (let i = 0; i < count; i++) { pos[i * 3] = (r() - .5) * box.w; pos[i * 3 + 1] = r() * box.h; pos[i * 3 + 2] = (r() - .5) * box.d; vel.push([(r() - .5) * .12, .03 + r() * .1, (r() - .5) * .12, r() * 6]); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
    G._gt = G._gt || tex(G.glowCanvas()); const p = new T.Points(g, new T.PointsMaterial({ map: G._gt, size: .26, transparent: true, opacity: .55, depthWrite: false, blending: T.AdditiveBlending, color: color || 0xffe6b0, sizeAttenuation: true }));
    return { obj: p, update(t, dt) { const a = g.attributes.position; for (let i = 0; i < count; i++) { const v = vel[i]; a.array[i * 3] += (v[0] + Math.sin(t * .6 + v[3]) * .05) * dt; a.array[i * 3 + 1] += v[1] * dt; a.array[i * 3 + 2] += (v[2] + Math.cos(t * .5 + v[3]) * .05) * dt; if (a.array[i * 3 + 1] > box.h) a.array[i * 3 + 1] = 0; } a.needsUpdate = true; } };
  };
  G.fireflies = function (count, box) {
    const r = rng(5), pos = new Float32Array(count * 3), ph = [];
    for (let i = 0; i < count; i++) { pos[i * 3] = (r() - .5) * box.w; pos[i * 3 + 1] = .6 + r() * box.h; pos[i * 3 + 2] = (r() - .5) * box.d; ph.push(r() * 6.28); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); G._gt = G._gt || tex(G.glowCanvas());
    const m = new T.PointsMaterial({ map: G._gt, size: .5, transparent: true, opacity: .9, depthWrite: false, blending: T.AdditiveBlending, color: 0xd8ff7a });
    return { obj: new T.Points(g, m), update(t) { const a = g.attributes.position; for (let i = 0; i < count; i++) { a.array[i * 3 + 1] += Math.sin(t * .8 + ph[i]) * .004; a.array[i * 3] += Math.cos(t * .5 + ph[i]) * .004; } a.needsUpdate = true; m.opacity = .55 + .35 * Math.sin(t * 2.2); } };
  };
  G.godRays = function (list, color) {                                                // list of {x,y,z,w,len,rotX,rotZ}
    const g = new T.Group(); G._rt = G._rt || tex(G.rayCanvas(), null, true); const mats = [];
    list.forEach((r, i) => {
      const mat = new T.MeshBasicMaterial({ map: G._rt, color: color || 0xffffff, transparent: true, opacity: .34, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false });
      [0, Math.PI / 2].forEach(a => { const m = new T.Mesh(new T.PlaneGeometry(r.w, r.len), mat); m.position.set(r.x, r.y, r.z); m.rotation.set(r.rx || 0, a, r.rz || 0, 'YXZ'); m.rotateY(0); g.add(m); }); mats.push(mat);
    });
    return { obj: g, update(t) { mats.forEach((m, i) => { m.opacity = .24 + .12 * Math.sin(t * .5 + i * 1.7); }); } };
  };
  G.waterfall = function (w, h) {
    const st = tex(G.streakCanvas(), [1, 2], true), grp = new T.Group();
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: st, transparent: true, opacity: .8, blending: T.NormalBlending, depthWrite: false, side: T.DoubleSide }));
    m.position.y = h / 2; grp.add(m); const mist = [];
    for (let i = 0; i < 5; i++) { const s = G.glow(0xdff6ff, w * 1.3, .35); s.position.set((i - 2) * w * .22, .6 + i % 2 * .3, .8); grp.add(s); mist.push(s); }
    return { obj: grp, update(t, dt) { st.offset.y -= dt * .9; mist.forEach((s, i) => { s.material.opacity = .28 + .12 * Math.sin(t * 1.6 + i * 1.3); s.scale.setScalar(w * (1.15 + .12 * Math.sin(t + i))); }); } };
  };
  G.water = function (w, d, sunDir) {
    const mat = new T.ShaderMaterial({
      transparent: true, uniforms: { t: { value: 0 }, sun: { value: sunDir || new T.Vector3(.4, .8, .3) } },
      vertexShader: 'varying vec3 vW; varying vec2 vUv; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: 'uniform float t; uniform vec3 sun; varying vec3 vW; varying vec2 vUv;' +
        'void main(){ vec2 p=vW.xz; float r=sin(p.x*1.7+t*1.3)+sin(p.y*1.4-t*1.1)+sin((p.x+p.y)*.9+t*.8)+sin(p.x*3.1-p.y*2.3+t*1.9)*.5;' +
        'vec3 n=normalize(vec3(cos(p.x*1.7+t*1.3)*.09+cos(p.x*3.1-p.y*2.3+t*1.9)*.05, 1., cos(p.y*1.4-t*1.1)*.09-cos(p.x*3.1-p.y*2.3+t*1.9)*.04));' +
        'vec3 V=normalize(cameraPosition-vW); float f=pow(1.-max(dot(n,V),0.),3.); vec3 deep=vec3(.02,.2,.26), shallow=vec3(.12,.55,.6), sky=vec3(.55,.85,.98);' +
        'vec3 col=mix(mix(deep,shallow,.5+.25*r),sky,f*.75); vec3 H=normalize(normalize(sun)+V); col+=pow(max(dot(n,H),0.),140.)*vec3(1.,.92,.75)*1.4;' +
        'col+=smoothstep(.8,1.,r*.5+.5)*.12; gl_FragColor=vec4(col,.86);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}'
    });
    const m = new T.Mesh(new T.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.receiveShadow = false;
    return { obj: m, update(t) { mat.uniforms.t.value = t; } };
  };
  G.torch = function (withLight) {
    const g = new T.Group(); G._ft = G._ft || tex(G.flameCanvas());
    g.add(G.cyl(.16, .1, 1.5, M.bronze, 0, .75, 0, 10)); const bowl = G.cyl(.4, .2, .3, M.bronze, 0, 1.6, 0, 14); g.add(bowl);
    const f1 = new T.Mesh(new T.PlaneGeometry(.7, 1.3), new T.MeshBasicMaterial({ map: G._ft, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })), f2 = f1.clone(); f1.position.y = f2.position.y = 2.2; f2.rotation.y = Math.PI / 2; g.add(f1, f2);
    const gl = G.glow(0xffa040, 3.4, .55); gl.position.y = 2.2; g.add(gl); let L = null;
    if (withLight) { L = new T.PointLight(0xff9a3c, 1.3, 18, 2); L.position.y = 2.4; g.add(L); }
    const ph = Math.random() * 7;
    return { obj: g, update(t) { const f = 1 + .12 * Math.sin(t * 13 + ph) + .08 * Math.sin(t * 7.3 + ph * 2); f1.scale.set(f, .9 + .22 * Math.sin(t * 9 + ph), 1); f2.scale.copy(f1.scale); gl.material.opacity = .45 + .15 * f; if (L) L.intensity = 1.1 + .35 * Math.sin(t * 11 + ph); } };
  };
  G.spark = function (parent, count) {                                                // pooled particle burst
    const pos = new Float32Array(count * 3), vel = new Float32Array(count * 3), life = new Float32Array(count);
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); G._gt = G._gt || tex(G.glowCanvas());
    const mat = new T.PointsMaterial({ map: G._gt, size: .5, transparent: true, opacity: 1, depthWrite: false, blending: T.AdditiveBlending, color: 0xffffff, vertexColors: false });
    const p = new T.Points(g, mat); p.frustumCulled = false; parent.add(p); let head = 0;
    for (let i = 0; i < count; i++) pos[i * 3 + 1] = -999;
    return {
      obj: p, burst(x, y, z, n, color, speed) { mat.color.set(color || 0x9fe8ff); for (let k = 0; k < n; k++) { const i = head++ % count, a = Math.random() * 6.28, e = Math.random() * 1.2, s = (speed || 4) * (.4 + Math.random()); pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = Math.cos(a) * s * Math.cos(e); vel[i * 3 + 1] = Math.sin(e) * s + 2; vel[i * 3 + 2] = Math.sin(a) * s * Math.cos(e); life[i] = 1; } },
      update(t, dt) { for (let i = 0; i < count; i++) { if (life[i] <= 0) continue; life[i] -= dt * .8; vel[i * 3 + 1] -= 6 * dt; pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt; if (life[i] <= 0) pos[i * 3 + 1] = -999; } g.attributes.position.needsUpdate = true; }
    };
  };

  /* ---------- post-processing: bloom, filmic tone mapping, grade and vignette (medium/high quality) ---------- */
  G.Post = function (renderer, q) {
    const gl2 = renderer.capabilities.isWebGL2, ok = gl2 && renderer.extensions.has('EXT_color_buffer_float');
    const type = ok ? T.HalfFloatType : T.UnsignedByteType, o = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, type, depthBuffer: true };
    const main = (gl2 && q.msaa) ? new T.WebGLMultisampleRenderTarget(4, 4, o) : new T.WebGLRenderTarget(4, 4, o); if (main.samples !== undefined && q.msaa && gl2) main.samples = 4;
    const so = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, type, depthBuffer: false }, A = new T.WebGLRenderTarget(4, 4, so), B = new T.WebGLRenderTarget(4, 4, so);
    const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), scn = new T.Scene(), quad = new T.Mesh(new T.PlaneGeometry(2, 2), null); scn.add(quad);
    const V = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }';
    const bright = new T.ShaderMaterial({ uniforms: { t: { value: null }, th: { value: 1.0 } }, vertexShader: V, depthTest: false, depthWrite: false, fragmentShader: 'uniform sampler2D t; uniform float th; varying vec2 vUv; void main(){ vec3 c=texture2D(t,vUv).rgb; float l=max(c.r,max(c.g,c.b)); float k=smoothstep(th,th+.6,l); gl_FragColor=vec4(c*k,1.); }' });
    const blur = new T.ShaderMaterial({ uniforms: { t: { value: null }, d: { value: new T.Vector2() } }, vertexShader: V, depthTest: false, depthWrite: false, fragmentShader: 'uniform sampler2D t; uniform vec2 d; varying vec2 vUv; void main(){ vec3 s=texture2D(t,vUv).rgb*.227; s+=(texture2D(t,vUv+d*1.38).rgb+texture2D(t,vUv-d*1.38).rgb)*.316; s+=(texture2D(t,vUv+d*3.23).rgb+texture2D(t,vUv-d*3.23).rgb)*.070; gl_FragColor=vec4(s,1.); }' });
    const comp = new T.ShaderMaterial({ uniforms: { t: { value: null }, b: { value: null }, amt: { value: .6 }, ex: { value: 1 }, time: { value: 0 } }, vertexShader: V, depthTest: false, depthWrite: false,
      fragmentShader: 'uniform sampler2D t,b; uniform float amt,ex,time; varying vec2 vUv;' +
        'vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }' +
        'float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }' +
        'void main(){ vec3 c=texture2D(t,vUv).rgb+texture2D(b,vUv).rgb*amt; c*=ex; float l=dot(c,vec3(.2126,.7152,.0722));' +
        'c=mix(c*vec3(.93,1.0,1.06),c*vec3(1.07,1.0,.9),smoothstep(.25,1.2,l)); c=aces(c); c=mix(vec3(dot(c,vec3(.299,.587,.114))),c,1.1);' +
        'vec2 q=vUv-.5; c*=1.-smoothstep(.32,.95,length(q*vec2(1.1,1.)))*.42; c=pow(c,vec3(1./2.2)); c+=(h(vUv*1000.+time)-.5)/255.; gl_FragColor=vec4(c,1.); }' });
    const P = { enabled: true, rt: main };
    P.setSize = function (w, h) { const pr = renderer.getPixelRatio(), W = Math.max(2, Math.floor(w * pr)), H = Math.max(2, Math.floor(h * pr)); main.setSize(W, H); const sw = Math.max(2, W >> 2), sh = Math.max(2, H >> 2); A.setSize(sw, sh); B.setSize(sw, sh); blur.uniforms.d.value.set(1 / sw, 1 / sh); };
    P.render = function (scene, camera, time) {
      renderer.setRenderTarget(main); renderer.render(scene, camera);
      quad.material = bright; bright.uniforms.t.value = main.texture; renderer.setRenderTarget(A); renderer.render(scn, cam);
      for (let i = 0; i < 2; i++) { quad.material = blur; blur.uniforms.t.value = A.texture; blur.uniforms.d.value.set(1 / A.width * (1 + i), 0); renderer.setRenderTarget(B); renderer.render(scn, cam); blur.uniforms.t.value = B.texture; blur.uniforms.d.value.set(0, 1 / A.height * (1 + i)); renderer.setRenderTarget(A); renderer.render(scn, cam); }
      quad.material = comp; comp.uniforms.t.value = main.texture; comp.uniforms.b.value = A.texture; comp.uniforms.time.value = time || 0; renderer.setRenderTarget(null); renderer.render(scn, cam);
    };
    P.dispose = function () { main.dispose(); A.dispose(); B.dispose(); };
    return P;
  };
  G.ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  G.lerpAngle = (a, b, k) => a + (b - a) * k;
})();
