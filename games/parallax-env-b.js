/* PARALLAX - Level 2 (The Floating Path) and Level 3 (The Energy Core) scenes. Shares the kit in parallax-env.js. */
(function () {
  'use strict';
  const T = THREE, MV = window.MV, G = MV.gfx, E = window.ParallaxEngine, PI = Math.PI, X = MV.penv, rng = G.rng, M = () => G.mat;

  function letterSprite(ch, col, size) {
    const c = G.cv(128, 128), x = c.getContext('2d'); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '900 96px Georgia,serif'; x.shadowColor = col; x.shadowBlur = 24; x.fillStyle = '#ffffff'; x.fillText(ch, 64, 70); x.shadowBlur = 8; x.fillStyle = col; x.fillText(ch, 64, 70);
    const s = new T.Sprite(new T.SpriteMaterial({ map: G.tex(c, null, true), transparent: true, depthWrite: false, depthTest: false })); s.scale.set(size, size, 1); s.renderOrder = 20; return s;
  }
  function floatStairs(root, anims, x, y, z, n, rotY, seed) {                       // a great staircase hanging in the sky, with an arch at the top
    const g = new T.Group(), mats = M(); for (let i = 0; i < n; i++) g.add(G.box(7, .9, 2.2, mats.stoneWarm, 0, i * .9, -i * 2.0));
    g.add(G.box(7.6, .6, n * 2.2, mats.stone, 0, -.9, -n)); [-1, 1].forEach(s => { const w = G.box(.7, 1.8, n * 2.1, mats.stone, s * 3.8, .6, -n * .98); w.rotation.x = Math.atan2(.9, 2.0); g.add(w); });
    const ar = X.archWall(9, 8, 3, 1.1, mats.stoneWarm); ar.position.set(0, n * .9, -n * 2 - .5); g.add(ar);
    const ro = new T.Mesh(new T.ConeGeometry(4, 9, 7), mats.stoneDark); ro.rotation.x = PI; ro.position.set(0, -5.5, -n); ro.scale.set(1, 1, n * .3); g.add(ro);
    g.position.set(x, y, z); g.rotation.y = rotY; root.add(g); const by = y, ph = seed; anims.push(t => { g.position.y = by + Math.sin(t * .3 + ph) * .8; });
  }

  /* =========================================================================================
   * LEVEL 2  The Floating Path
   * ======================================================================================= */
  X.levels[1] = function (ctx) {
    const { root, scene, anims, q } = ctx, L = E.LEVELS[1], mats = M(), r = rng(21), CELL = L.cell, cpos = (c, rr) => [(c - 1) * CELL, (rr - 1) * CELL];
    X.sky(scene, root, { fog: 0xc7d9ee, fogD: .0075, top: '#2c64c8', mid: '#9cc6ee', bot: '#ffd2a8', sunPos: [-90, 70, 120], sunCol: 0xffe2b0 });
    ctx.sun.position.set(-50, 55, 60); ctx.sun.color.setHex(0xffe6c4); ctx.sun.intensity = 1.9; ctx.hemi.color.setHex(0xa8c8f0); ctx.hemi.groundColor.setHex(0x6a5a48); ctx.hemi.intensity = .55;
    X.cloudSea(root, anims, { y: -44, count: 90, spread: 260, color: 0xfff1e6, opacity: .95, seed: 4, thick: 14 }); X.cloudSea(root, anims, { y: -22, count: 26, spread: 280, opacity: .5, seed: 9, thick: 12 }); X.cloudSea(root, anims, { y: 30, count: 10, spread: 320, opacity: .3, seed: 10, thick: 10 });
    X.distant(root, anims, 52, 9, 110, 210, -16, 40);
    // big background islands with towers and waterfalls
    [[-70, -14, -55, 20], [78, -8, -48, 24], [-20, 2, -105, 22], [60, -20, 70, 18]].forEach((b, i) => {
      const g = new T.Group(), isl = X.island(b[3], b[3] * 1.5, 70 + i, { seg: 28, detail: 2, spikes: 4, top: new T.MeshStandardMaterial({ color: 0x6d8a4a, roughness: 1 }) }); g.add(isl);
      for (let k = 0; k < 3; k++) { const tw = X.tower(3 + r() * 2, 12 + r() * 14, 5 + k + i, true); tw.position.set((r() - .5) * b[3] * 1.1, 0, (r() - .5) * b[3] * 1.1); g.add(tw); }
      const ar = X.archWall(12, 10, 3.5, 1.4, mats.stoneWarm); ar.position.set(0, 0, b[3] * .3); g.add(ar); g.add(G.trees(6, b[3] * .4, b[3] * .3, 3 + i));
      g.position.set(b[0], b[1], b[2]); root.add(g); X.fall(g, anims, b[3] * .9, -.2, 0, 5, 40, PI / 2); const by = b[1]; anims.push(t => { g.position.y = by + Math.sin(t * .2 + i) * 1.4; });
    });
    floatStairs(root, anims, -52, -4, 20, 12, .6, 1); floatStairs(root, anims, 54, 6, 24, 14, -.4, 2); floatStairs(root, anims, -30, 10, -62, 10, 1.9, 3);
    const rays = X.godRays([{ x: -10, y: 24, z: 6, w: 20, len: 64, rx: .6, rz: -.5 }, { x: 14, y: 26, z: -10, w: 16, len: 66, rx: .6, rz: -.5 }, { x: 30, y: 20, z: 10, w: 14, len: 60, rx: .6, rz: -.5 }], 0xffe6bd, 1); root.add(rays.obj); anims.push(rays.update);
    const dust = G.dust(q.dust, { w: 70, h: 14, d: 70 }, 0xfff0d0); root.add(dust.obj); anims.push(dust.update);

    // ---- platforms ----
    const has = {}; L.platforms.forEach(p => { has[p.c + ',' + p.r] = 'p'; }); L.sections.forEach(s => { has[s.c + ',' + s.r] = 's'; });
    const DXc = [0, 1, 0, -1], DZc = [-1, 0, 1, 0], sockets = {};           // sockets['E:1'] = mesh materials for the side of platform E facing direction 1
    const mkSocket = (x, z, d) => {
      const g = new T.Group(); g.position.set(x, .06, z); const ringM = new T.MeshBasicMaterial({ color: 0x3aa8ff, transparent: true, opacity: .35, blending: T.AdditiveBlending, depthWrite: false });
      const ring = new T.Mesh(new T.RingGeometry(.85, 1.25, 28), ringM); ring.rotation.x = -PI / 2; g.add(ring); const core = new T.Mesh(new T.CircleGeometry(.6, 20), ringM); core.rotation.x = -PI / 2; g.add(core);
      const beamM = new T.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }); const col = new T.Mesh(new T.CylinderGeometry(.9, .9, 5, 14, 1, true), beamM); col.position.y = 2.5; g.add(col);
      const gl = G.glow(0x4cc8ff, 5, .35); gl.position.y = .7; g.add(gl); return { g, ringM, beamM, gl };
    };
    const platObjs = {};
    L.platforms.forEach((p, i) => {
      const [cx, cz] = cpos(p.c, p.r), g = new T.Group(); g.position.set(cx, 0, cz); root.add(g);
      g.add(G.bevel(14, 2.6, 14, mats.stoneWarm, 0, -1.3, 0, .18)); const top = new T.Mesh(new T.PlaneGeometry(13.2, 13.2), G.floorMat(13.2, 13.2)); top.rotation.x = -PI / 2; top.position.y = .012; top.receiveShadow = true; g.add(top);
      const bd = new T.Mesh(new T.RingGeometry(6.0, 6.5, 4, 1, PI / 4), new T.MeshStandardMaterial({ color: 0xc89a46, metalness: .85, roughness: .35 })); bd.rotation.set(-PI / 2, 0, 0); bd.position.y = .03; bd.scale.set(1.41, 1.41, 1); g.add(bd);
      g.add(X.island(7.6, 15, 90 + i * 5, { seg: 22, detail: 2, noRim: true, spikes: 4, vines: 6 })).position.y = -.55;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(s => { const c = X.column(4.2, .45, false); c.position.set(s[0] * 6.5, 0, s[1] * 6.5); g.add(c); const br = G.glow(0xffb060, 3, .55); br.position.set(s[0] * 6.5, 5.2, s[1] * 6.5); g.add(br); });
      for (let d = 0; d < 4; d++) { const nc = p.c + DXc[d], nr = p.r + DZc[d]; if (!has[nc + ',' + nr]) continue; const sk = mkSocket(DXc[d] * 6.1, DZc[d] * 6.1, d); g.add(sk.g); sockets[p.id + ':' + d] = sk; }
      platObjs[p.id] = g;
    });
    // exit tower on platform X
    const ex = cpos(2, 1), exitG = new T.Group(); exitG.position.set(ex[0] + 4.4, 0, ex[1]); root.add(exitG);
    const tw = X.tower(6.4, 26, 14, true); tw.position.x = 3.4; exitG.add(tw); const door = X.archWall(7, 8.5, 2.1, 1.2, mats.stoneWarm, 2.1); door.position.set(-.1, 0, 0); door.rotation.y = PI / 2; exitG.add(door); const dl = new T.Mesh(new T.PlaneGeometry(4.0, 4.2), new T.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: .7, blending: T.AdditiveBlending, depthWrite: false })); dl.position.set(.6, 2.1, 0); dl.rotation.y = PI / 2; exitG.add(dl);
    const beacon = new T.Mesh(new T.CylinderGeometry(.5, 1.6, 60, 12, 1, true), new T.MeshBasicMaterial({ color: 0xffe8a0, transparent: true, opacity: .12, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })); beacon.position.set(3.4, 40, 0); exitG.add(beacon);
    const flag = G.glow(0xffe0a0, 8, .8); flag.position.set(3.4, 32, 0); exitG.add(flag); X.brazier(exitG, anims, -1.6, 3.4, q.fire > 15, 0); X.brazier(exitG, anims, -1.6, -3.4, q.fire > 15, 0);

    // ---- the three rotating sections ----
    const baseDirs = s => s.type === 'straight' ? [0, 2] : [0, 1], secs = L.sections.map((s, i) => {
      const [cx, cz] = cpos(s.c, s.r), g = new T.Group(); g.position.set(cx, 0, cz); root.add(g); const rot = new T.Group(); g.add(rot);
      rot.add(G.cyl(3.4, 3.7, .9, mats.stoneWarm, 0, -.45, 0, 28)); const hubRing = new T.Mesh(new T.TorusGeometry(2.6, .1, 8, 40), mats.gold); hubRing.rotation.x = PI / 2; hubRing.position.y = .03; rot.add(hubRing);
      const strips = [], ends = [];
      baseDirs(s).forEach(d => {
        const a = new T.Group(); a.rotation.y = -d * PI / 2; rot.add(a);
        a.add(G.bevel(4.6, .9, 7.4, mats.stone, 0, -.45, -3.6, .1)); a.add(G.box(.5, .4, 7.2, mats.stoneWarm, 2.45, .1, -3.6)); a.add(G.box(.5, .4, 7.2, mats.stoneWarm, -2.45, .1, -3.6));
        for (let k = 0; k < 6; k++) { a.add(G.box(5.2, .18, .5, mats.stoneDark, 0, .0, -.9 - k * 1.2)); }
        const st = new T.Mesh(new T.PlaneGeometry(.35, 7), new T.MeshBasicMaterial({ color: 0x3aa8ff, transparent: true, opacity: .3, blending: T.AdditiveBlending, depthWrite: false })); st.rotation.x = -PI / 2; st.position.set(0, .03, -3.5); a.add(st); strips.push(st);
        const sk = mkSocket(0, -6.6, d); a.add(sk.g); ends.push({ sk, d });
      });
      const isl = X.island(5, 10, 120 + i, { seg: 18, detail: 2, noRim: true, spikes: 3 }); isl.position.y = -.55; g.add(isl);
      const lb = letterSprite(s.id, '#7ad8ff', 3.2); lb.position.y = 4.6; g.add(lb); const o = { g, rot, ends, strips, k: s.start, ang: -s.start * PI / 2, tgt: -s.start * PI / 2, sec: s, i }; rot.rotation.y = o.ang; return o;
    });
    // ---- consoles A B C and the lock ----
    const consoles = L.consoles.map((c, i) => {
      const g = new T.Group(); g.position.set(c.x, 0, c.z); root.add(g); g.add(G.cyl(.9, 1.1, .4, mats.stone, 0, .2, 0, 6)); g.add(G.cyl(.45, .65, 1.3, mats.stoneWarm, 0, .9, 0, 6));
      const top = new T.Mesh(new T.CylinderGeometry(.75, .6, .22, 6), mats.gold); top.position.y = 1.65; g.add(top); const cry = new T.Mesh(new T.OctahedronGeometry(.45, 0), new T.MeshStandardMaterial({ color: 0x3aa8ff, emissive: 0x2a8cff, emissiveIntensity: 1.2, metalness: .3, roughness: .1, transparent: true, opacity: .92 })); cry.scale.set(1, 1.4, 1); cry.position.y = 2.4; g.add(cry);
      const lt = letterSprite(c.id, '#7ad8ff', 1.5); lt.position.y = 3.6; g.add(lt); const gl = G.glow(0x4cc8ff, 4.2, .55); gl.position.y = 2.4; g.add(gl); return { g, cry, gl, c };
    });
    const lk = new T.Group(); lk.position.set(L.lock.x, 0, L.lock.z); root.add(lk); lk.add(G.cyl(1.5, 1.8, .5, mats.stone, 0, .25, 0, 10)); lk.add(G.cyl(.9, 1.1, 1.0, mats.stoneWarm, 0, 1.0, 0, 10)); const lring = new T.Mesh(new T.TorusGeometry(1.3, .12, 10, 36), mats.gold); lring.rotation.x = PI / 2; lring.position.y = 1.7; lk.add(lring);
    const lcore = new T.Mesh(new T.IcosahedronGeometry(.6, 1), new T.MeshStandardMaterial({ color: 0x555a66, emissive: 0x000000, metalness: .5, roughness: .25 })); lcore.position.y = 2.4; lk.add(lcore); const lgl = G.glow(0xffd070, 5, 0); lgl.position.y = 2.4; lk.add(lgl);
    const coins = L.coins.map(c => { const m = X.coinMesh(); m.position.set(c[0], 1.1, c[1]); root.add(m); return m; });

    let last = null, lockedV = 0;
    const sync = function (ev, events, instant) {
      last = ev;
      secs.forEach((o, i) => { const k = ev.rot[i]; if (k !== o.k) { const d = ((k - o.k + 6) % 4) - 2; o.tgt += -d * PI / 2; o.k = k; } if (instant) { o.ang = o.tgt; o.rot.rotation.y = o.ang; } });
      if (instant) lockedV = ev.locked ? 1 : 0;
    };
    const update = function (t, dt) {
      secs.forEach(o => { o.ang += (o.tgt - o.ang) * Math.min(1, dt * 5); o.rot.rotation.y = o.ang; });
      const lit = {}; if (last) last.joined.forEach(j => { lit[j[0] + ':' + j[2]] = 1; lit[j[1] + ':' + (j[2] + 2) % 4] = 1; });
      Object.keys(sockets).forEach(k => { const sk = sockets[k], on = lit[k]; sk.ringM.opacity += ((on ? .95 : .25) - sk.ringM.opacity) * Math.min(1, dt * 5); sk.beamM.opacity += ((on ? .22 + .06 * Math.sin(t * 4) : 0) - sk.beamM.opacity) * Math.min(1, dt * 5); sk.gl.material.opacity = sk.ringM.opacity * .8; });
      secs.forEach(o => { const s = o.sec, rotNow = last ? last.rot[o.i] : o.k, dirs = (s.type === 'straight' ? [0, 2] : [0, 1]); o.ends.forEach((e, n) => { const wd = (e.d + rotNow) % 4, on = lit[s.id + ':' + wd]; e.sk.ringM.opacity += ((on ? .95 : .3 + .12 * Math.sin(t * 3 + n)) - e.sk.ringM.opacity) * Math.min(1, dt * 5); e.sk.beamM.opacity += ((on ? .24 + .06 * Math.sin(t * 4) : 0) - e.sk.beamM.opacity) * Math.min(1, dt * 5); e.sk.gl.material.opacity = e.sk.ringM.opacity * .8; }); void dirs; o.strips.forEach(st => { st.material.opacity += ((lockedV > .5 ? .95 : .3) - st.material.opacity) * Math.min(1, dt * 3); st.material.color.setHex(lockedV > .5 ? 0xffe08a : 0x3aa8ff); }); });
      const lockedNow = last && last.locked ? 1 : 0; lockedV += (lockedNow - lockedV) * Math.min(1, dt * 1.2); const ready = last && last.connected;
      lcore.material.emissive.setHex(lockedNow ? 0xffd070 : 0x3aa8ff); lcore.material.emissiveIntensity = lockedNow ? 2.2 : ready ? 1.2 + .8 * Math.sin(t * 4) : .08; lgl.material.opacity = lockedNow ? .9 : ready ? .55 + .25 * Math.sin(t * 4) : 0; lcore.rotation.y += dt * (ready ? 2 : .4); lring.rotation.z += dt * (ready ? 1.5 : .2);
      consoles.forEach((c, i) => { c.cry.rotation.y += dt * 1.2; c.cry.position.y = 2.4 + Math.sin(t * 1.5 + i) * .08; c.gl.material.opacity = .45 + .12 * Math.sin(t * 2 + i); });
      coins.forEach((c, i) => { if (!c.visible) return; c.rotation.y = t * 2.2 + i; c.position.y = 1.1 + Math.sin(t * 2 + i) * .12; });
      beacon.material.opacity = .1 + .05 * Math.sin(t * 1.5) + lockedV * .12;
    };
    const act = [];
    consoles.forEach((c, i) => { const sec = secs[i], sp = sec.g.position; act.push({ id: c.c.id, kind: 'section', label: 'Turn section ' + c.c.id, x: c.c.x, z: c.c.z, range: 3.0, anim: 'press', dur: 1.0, hit: .5, a: { t: 'section', id: c.c.id }, look: [sp.x, 1, sp.z], root: c.g, standDist: 2.3, cine: { p: [sp.x - 9, 9, sp.z + 12], l: [sp.x, 0, sp.z], dur: 1.5 } }); });
    act.push({ id: 'lock', kind: 'lock', label: 'Activate lock', x: L.lock.x, z: L.lock.z, range: 3.1, anim: 'reach', dur: 1.1, hit: .5, a: { t: 'lock', id: 'lock' }, look: [L.lock.x, 2, L.lock.z], root: lk, standDist: 2.4 });
    const colliders = consoles.map(c => ({ x: c.c.x, z: c.c.z, r: .9 })).concat([{ x: L.lock.x, z: L.lock.z, r: 1.5 }], [[-1, -1], [1, -1], [-1, 1], [1, 1]].flatMap(s => L.platforms.map(p => { const [cx, cz] = cpos(p.c, p.r); return { x: cx + s[0] * 6.5, z: cz + s[1] * 6.5, r: .8 }; })));
    const exitPos = [ex[0] + 1.5, ex[1]];
    const groundAt = (x, z) => {
      for (const p of L.platforms) { const [cx, cz] = cpos(p.c, p.r); if (Math.abs(x - cx) <= 6.95 && Math.abs(z - cz) <= 6.95) return 0; }
      if (!last) return null;
      for (let i = 0; i < L.sections.length; i++) {
        const s = L.sections[i], [cx, cz] = cpos(s.c, s.r), dx = x - cx, dz = z - cz; if (Math.hypot(dx, dz) <= 3.3) return 0;
        const open = E.sectionOpen(s, last.rot[i]); for (const d of open) { const ax = d === 1 ? 1 : d === 3 ? -1 : 0, az = d === 2 ? 1 : d === 0 ? -1 : 0, along = dx * ax + dz * az, perp = Math.abs(dx * az - dz * ax); if (along >= 0 && along <= 7.05 && perp <= 2.15) return 0; }
      }
      return null;
    };
    const pathCam = () => [{ t: 0, p: [-14, 14, 36], l: [-6, 0, 8] }, { t: 1.6, p: [-4, 24, 26], l: [2, 0, 2] }, { t: 3.6, p: [6, 28, 2], l: [8, 0, -8] }];
    return {
      groundAt, colliders, interactables: act, sync, update, coinMeshes: coins, coinPos: L.coins, start: L.start, sunDir: [-50, 55, 60], cam: { yaw: 0, pitch: .42, dist: 12 },
      exitZone: { x: exitPos[0], z: exitPos[1], r: 3.2 }, lockCam: pathCam, lockDur: 4.2,
      finaleCam() { return [{ t: 0, p: [ex[0] - 12, 6, ex[1] + 10], l: [ex[0] + 2, 4, ex[1]] }, { t: 3, p: [ex[0] - 4, 3.5, ex[1] + 12], l: [ex[0] + 4, 8, ex[1]] }, { t: 6, p: [ex[0] + 6, 10, ex[1] + 22], l: [ex[0] + 4, 14, ex[1]] }]; }, finaleDur: 6.4, onFinale() { }
    };
  };

  /* =========================================================================================
   * LEVEL 3  The Energy Core
   * ======================================================================================= */
  X.levels[2] = function (ctx) {
    const { root, scene, anims, q } = ctx, L = E.LEVELS[2], mats = M(), r = rng(31), CY = 11;
    X.sky(scene, root, { fog: 0x06101f, fogD: .0105, top: '#020611', mid: '#06102a', bot: '#0a1a3a' });
    ctx.sun.position.set(20, 60, 25); ctx.sun.color.setHex(0x9ec8ff); ctx.sun.intensity = .55; ctx.hemi.color.setHex(0x3a6aa8); ctx.hemi.groundColor.setHex(0x0a1220); ctx.hemi.intensity = .55;
    // the universe beyond the roof (revealed at the end)
    const starC = G.cv(1024, 512), sx = starC.getContext('2d'), sg = sx.createLinearGradient(0, 0, 0, 512); sg.addColorStop(0, '#05030f'); sg.addColorStop(.5, '#120a30'); sg.addColorStop(1, '#030612'); sx.fillStyle = sg; sx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 18; i++) { const px = r() * 1024, py = 60 + r() * 380, rad = 80 + r() * 160, gr = sx.createRadialGradient(px, py, 0, px, py, rad), hue = [210, 280, 330, 190][i % 4]; gr.addColorStop(0, 'hsla(' + hue + ',90%,60%,.35)'); gr.addColorStop(1, 'hsla(' + hue + ',90%,40%,0)'); sx.fillStyle = gr; sx.fillRect(0, 0, 1024, 512); }
    for (let i = 0; i < 1600; i++) { sx.fillStyle = 'rgba(255,255,255,' + (.3 + r() * .7) + ')'; const s = r() < .05 ? 2.4 : 1.1; sx.fillRect(r() * 1024, r() * 512, s, s); }
    const cosmos = new T.Mesh(new T.SphereGeometry(330, 32, 16), new T.MeshBasicMaterial({ map: G.tex(starC, null, true), side: T.BackSide, fog: false, transparent: true, opacity: 0, depthWrite: false })); cosmos.renderOrder = -9; root.add(cosmos);
    const galaxy = G.glow(0x9a7aff, 160, 0); galaxy.position.set(40, 190, -60); galaxy.material.fog = false; root.add(galaxy);

    // ---- floor, walls, roof ----
    const fc = G.cv(1024, 1024), fx = fc.getContext('2d'), ec = G.cv(1024, 1024), ex2 = ec.getContext('2d');
    fx.fillStyle = '#10161f'; fx.fillRect(0, 0, 1024, 1024); const fg = fx.createRadialGradient(512, 512, 0, 512, 512, 512); fg.addColorStop(0, '#1d2a3c'); fg.addColorStop(1, '#0a0f17'); fx.fillStyle = fg; fx.fillRect(0, 0, 1024, 1024);
    ex2.fillStyle = '#000'; ex2.fillRect(0, 0, 1024, 1024); ex2.translate(512, 512); ex2.strokeStyle = '#2aa8ff'; ex2.shadowColor = '#2aa8ff'; ex2.shadowBlur = 10;
    [90, 150, 200, 255, 300, 345, 395, 445, 495].forEach((rad, i) => { ex2.lineWidth = i % 3 === 0 ? 7 : 3; ex2.beginPath(); ex2.arc(0, 0, rad, 0, PI * 2); ex2.stroke(); });
    for (let i = 0; i < 48; i++) { ex2.save(); ex2.rotate(i * PI / 24); ex2.lineWidth = i % 4 ? 2 : 5; ex2.beginPath(); ex2.moveTo(0, -150); ex2.lineTo(0, -345); ex2.stroke(); ex2.restore(); }
    for (let i = 0; i < 24; i++) { ex2.save(); ex2.rotate(i * PI / 12 + .13); ex2.fillStyle = '#2aa8ff'; ex2.fillRect(-6, -420, 12, 26); ex2.restore(); }
    fx.drawImage(ec, 0, 0, 1024, 1024); fx.globalAlpha = .12; fx.globalAlpha = 1;
    const floorMat = new T.MeshStandardMaterial({ map: G.tex(fc, null, true), emissiveMap: G.tex(ec, null, true), emissive: 0xffffff, emissiveIntensity: .35, metalness: .75, roughness: .32, envMapIntensity: .8 });
    const floor = new T.Mesh(new T.CylinderGeometry(40, 40.6, 1.4, 96), [mats.stoneDark, floorMat, mats.stoneDark]); floor.position.y = -.7; floor.receiveShadow = true; root.add(floor); floor.material[1].map.repeat.set(1, 1);
    const wc = G.cv(1024, 256), wx = wc.getContext('2d'), wec = G.cv(1024, 256), wex = wec.getContext('2d'); wx.fillStyle = '#121a26'; wx.fillRect(0, 0, 1024, 256); wex.fillStyle = '#000'; wex.fillRect(0, 0, 1024, 256);
    for (let i = 0; i < 32; i++) { const x0 = i * 32; wx.fillStyle = i % 2 ? '#1a2536' : '#0e1520'; wx.fillRect(x0 + 2, 6, 28, 244); wx.strokeStyle = '#3a4a62'; wx.strokeRect(x0 + 2, 6, 28, 244); wex.fillStyle = '#1f9bff'; wex.fillRect(x0 + 14, 20, 4, 90 + (i % 5) * 20); wex.fillRect(x0 + 8, 200, 16, 5); }
    const wallMat = new T.MeshStandardMaterial({ map: G.tex(wc, [3, 1], true), emissiveMap: G.tex(wec, [3, 1], true), emissive: 0xffffff, emissiveIntensity: .8, metalness: .7, roughness: .45, side: T.BackSide });
    const wall = new T.Mesh(new T.CylinderGeometry(47, 47, 48, 64, 1, true), wallMat); wall.position.y = 22; root.add(wall);
    const trim = [0, 14, 30, 45].map(y => { const t = new T.Mesh(new T.TorusGeometry(46.5, .45, 8, 96), new T.MeshStandardMaterial({ color: 0xc89a46, metalness: .9, roughness: .3, emissive: 0x2a1800, emissiveIntensity: .4 })); t.rotation.x = PI / 2; t.position.y = y; root.add(t); return t; });
    for (let i = 0; i < 24; i++) { const a = i * PI / 12, c = new T.Group(); c.position.set(Math.cos(a) * 43.5, 0, Math.sin(a) * 43.5); const sh = new T.Mesh(new T.CylinderGeometry(1.2, 1.5, 36, 10), new T.MeshStandardMaterial({ color: 0x1b2433, metalness: .8, roughness: .4 })); sh.position.y = 18; c.add(sh); for (let k = 0; k < 3; k++) { const rg = new T.Mesh(new T.TorusGeometry(1.35, .12, 6, 14), mats.gold); rg.rotation.x = PI / 2; rg.position.y = 6 + k * 11; c.add(rg); } const ln = new T.Mesh(new T.BoxGeometry(.2, 30, .2), new T.MeshBasicMaterial({ color: 0x2aa8ff })); ln.position.set(-Math.cos(a) * 1.3, 18, -Math.sin(a) * 1.3); c.add(ln); root.add(c); }
    // roof: eight wedges that slide apart at the end
    const wedges = []; for (let i = 0; i < 8; i++) {
      const w = new T.Mesh(new T.CylinderGeometry(47, 47, 2.2, 8, 1, false, i * PI / 4 + .012, PI / 4 - .024), new T.MeshStandardMaterial({ color: 0x141c2a, metalness: .85, roughness: .35, emissive: 0x0a2a55, emissiveIntensity: .5 })); w.position.y = 47; root.add(w);
      const a = i * PI / 4 + PI / 8; wedges.push({ w, dx: Math.cos(-a), dz: Math.sin(-a) }); // CylinderGeometry thetaStart goes around -z; keep the real direction from the angle
    }
    wedges.forEach((o, i) => { const a = i * PI / 4 + PI / 8; o.dx = Math.sin(a); o.dz = Math.cos(a); });
    // giant gyroscope rings overhead + around the core
    const gyros = []; [[34, .9, 0x2a88ff, 1], [27, .7, 0xc89a46, -1.4], [20, .6, 0x2a88ff, 1.9]].forEach((g, i) => { const t = new T.Mesh(new T.TorusGeometry(g[0], g[1], 12, 90), new T.MeshStandardMaterial({ color: g[2], metalness: .9, roughness: .25, emissive: g[2], emissiveIntensity: .35 })); t.position.y = 40 - i * 3; t.rotation.x = PI / 2; root.add(t); gyros.push({ t, sp: g[3], axis: i }); });
    const coreRings = []; [[5.4, .16, 0xc89a46], [7, .13, 0x4cc8ff], [8.6, .17, 0xc89a46]].forEach((g, i) => { const t = new T.Mesh(new T.TorusGeometry(g[0], g[1], 10, 80), new T.MeshStandardMaterial({ color: g[2], metalness: .9, roughness: .25, emissive: g[2], emissiveIntensity: .4 })); t.position.y = CY; root.add(t); coreRings.push(t); });
    // central dais, core, console
    const dais = new T.Group(); root.add(dais); dais.add(G.cyl(8.2, 8.8, .9, mats.stone, 0, .45, 0, 48)); const daisTop = new T.Mesh(new T.CylinderGeometry(7.6, 7.6, .06, 48), new T.MeshStandardMaterial({ color: 0x182235, metalness: .85, roughness: .3, emissive: 0x0a3a77, emissiveIntensity: .6 })); daisTop.position.y = .93; dais.add(daisTop); const dr = new T.Mesh(new T.TorusGeometry(6.6, .1, 6, 60), new T.MeshBasicMaterial({ color: 0x2aa8ff })); dr.rotation.x = PI / 2; dr.position.y = .98; dais.add(dr);
    dais.add(G.cyl(1.1, 1.8, 1.6, mats.bronze, 0, 1.7, 0, 16));
    const coreMat = new T.MeshStandardMaterial({ color: 0x1c4ea0, emissive: 0x2a88ff, emissiveIntensity: .25, metalness: .2, roughness: .1, transparent: true, opacity: .96 }), core = new T.Mesh(new T.SphereGeometry(2.7, 40, 24), coreMat); core.position.y = CY; root.add(core);
    const inner = new T.Mesh(new T.IcosahedronGeometry(1.7, 2), new T.MeshBasicMaterial({ color: 0xbfe6ff, wireframe: true, transparent: true, opacity: .35, blending: T.AdditiveBlending, depthWrite: false })); inner.position.y = CY; root.add(inner);
    const coreGlow = G.glow(0x4cc8ff, 22, .25); coreGlow.position.y = CY; root.add(coreGlow); const coreLight = new T.PointLight(0x4cc8ff, .8, 120, 1.6); coreLight.position.y = CY; root.add(coreLight);
    const shaftC = new T.Mesh(new T.CylinderGeometry(.45, .9, CY - 2.4, 14, 1, true), new T.MeshBasicMaterial({ color: 0x4cc8ff, transparent: true, opacity: .12, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); shaftC.position.y = (CY + 2.4) / 2; root.add(shaftC);
    const orbitN = 90, orbP = new Float32Array(orbitN * 3), orbG = new T.BufferGeometry(); orbG.setAttribute('position', new T.BufferAttribute(orbP, 3)); const orbits = new T.Points(orbG, new T.PointsMaterial({ map: G.tex(G.glowCanvas()), size: .5, transparent: true, opacity: .8, depthWrite: false, blending: T.AdditiveBlending, color: 0x9fe0ff })); orbits.frustumCulled = false; root.add(orbits);
    const consoleG = new T.Group(); consoleG.position.set(L.console.x, 0, L.console.z); root.add(consoleG); consoleG.add(G.cyl(1.3, 1.6, .6, mats.stone, 0, .3, 0, 8)); consoleG.add(G.bevel(2.0, 1.2, 1.5, new T.MeshStandardMaterial({ color: 0x1b2638, metalness: .8, roughness: .35 }), 0, 1.2, 0, .1));
    const scr = new T.Mesh(new T.PlaneGeometry(1.7, .8), new T.MeshBasicMaterial({ color: 0x1f9bff })); scr.position.set(0, 1.45, .78); scr.rotation.x = -.5; consoleG.add(scr); const btn = new T.Mesh(new T.CylinderGeometry(.34, .4, .18, 18), new T.MeshStandardMaterial({ color: 0x3a1010, emissive: 0xff3030, emissiveIntensity: .3, metalness: .4, roughness: .3 })); btn.position.set(0, 1.9, .2); consoleG.add(btn); const cgl = G.glow(0x4cc8ff, 5, .4); cgl.position.y = 2; consoleG.add(cgl);
    // exit portal (opens at the end)
    const portal = new T.Group(); portal.position.set(0, 9, -45); root.add(portal); const pr = new T.Mesh(new T.TorusGeometry(7, .7, 12, 60), new T.MeshStandardMaterial({ color: 0xc89a46, metalness: .9, roughness: .3, emissive: 0x1a1000, emissiveIntensity: .3 })); portal.add(pr); const pd = new T.Mesh(new T.CircleGeometry(6.8, 40), new T.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); portal.add(pd); portal.scale.setScalar(.01);

    // ---- emitters, mirrors, receivers ----
    const emitters = L.emitters.map((e, i) => {
      const g = new T.Group(); g.position.set(e.x, 0, e.z); root.add(g); g.add(G.bevel(3.4, 3.2, 3.4, new T.MeshStandardMaterial({ color: 0x1b2638, metalness: .8, roughness: .35 }), 0, 1.6, 0, .2)); const barrel = G.cyl(.55, .75, 2.4, mats.bronze, 1.8, 2.4, 0, 14); barrel.rotation.z = -PI / 2; g.add(barrel);
      const hx = X.symHex[e.sym], ring = new T.Mesh(new T.TorusGeometry(.72, .1, 8, 24), new T.MeshBasicMaterial({ color: hx })); ring.rotation.y = PI / 2; ring.position.set(3.0, 2.4, 0); g.add(ring);
      const gm = X.glyphMesh(e.sym, X.symColor[e.sym], X.symColor[e.sym], 1.5, true); gm.position.set(1.75, 3.4, 0); gm.rotation.y = PI / 2; g.add(gm); const gm2 = gm.clone(); gm2.position.set(1.75, 1.0, 0); g.add(gm2); const gl = G.glow(hx, 6, .7); gl.position.set(3.2, 2.4, 0); g.add(gl);
      const lt = new T.PointLight(hx, 1.2, 28, 2); lt.position.set(3, 3, 0); g.add(lt); return { g, e, hx, gl };
    });
    const mirrors = L.mirrors.map((m, i) => {
      const g = new T.Group(); g.position.set(m.x, 0, m.z); root.add(g); g.add(G.cyl(1.15, 1.4, .4, mats.stone, 0, .2, 0, 6)); g.add(G.cyl(.55, .8, .8, new T.MeshStandardMaterial({ color: 0x1b2638, metalness: .8, roughness: .35 }), 0, .8, 0, 6)); g.add(G.cyl(.18, .24, 1.2, mats.bronze, 0, 1.6, 0, 8));
      const head = new T.Group(); head.position.y = 2.4; g.add(head); const fr = new T.Mesh(new T.TorusGeometry(1.35, .12, 8, 6), new T.MeshStandardMaterial({ color: 0xc89a46, metalness: .9, roughness: .3 })); fr.rotation.z = PI / 6; head.add(fr);
      const pl = new T.Mesh(new T.CircleGeometry(1.3, 6), new T.MeshStandardMaterial({ color: 0x9fe0ff, emissive: 0x2a88ff, emissiveIntensity: .8, metalness: 1, roughness: .05, envMapIntensity: 2, transparent: true, opacity: .82, side: T.DoubleSide })); pl.rotation.z = PI / 6; head.add(pl);
      for (let k = 0; k < 6; k++) { const a = k * PI / 3, d = new T.Mesh(new T.OctahedronGeometry(.09, 0), new T.MeshBasicMaterial({ color: 0x4cc8ff })); d.position.set(Math.cos(a) * 1.35, Math.sin(a) * 1.35, 0); head.add(d); }
      const gl = G.glow(0x4cc8ff, 5, .5); gl.position.y = 2.4; g.add(gl); const o = { g, head, gl, k: m.start, ang: PI / 2 - m.start * PI / 8, tgt: PI / 2 - m.start * PI / 8 }; head.rotation.y = o.ang; return o;
    });
    const receivers = L.receivers.map((rc, i) => {
      const g = new T.Group(); g.position.set(rc.x, 0, rc.z); g.rotation.y = Math.atan2(-rc.x, -rc.z); root.add(g); g.add(G.bevel(3.2, 4.2, 2.2, new T.MeshStandardMaterial({ color: 0x1b2638, metalness: .8, roughness: .35 }), 0, 2.1, 0, .2));
      const hx = X.symHex[rc.sym], ring = new T.Mesh(new T.TorusGeometry(1.5, .16, 10, 36), new T.MeshStandardMaterial({ color: 0x222a38, emissive: hx, emissiveIntensity: .25, metalness: .8, roughness: .3 })); ring.position.set(0, 2.4, 1.15); g.add(ring);
      const disc = new T.Mesh(new T.CircleGeometry(1.35, 30), new T.MeshBasicMaterial({ color: hx, transparent: true, opacity: .1, blending: T.AdditiveBlending, depthWrite: false })); disc.position.set(0, 2.4, 1.12); g.add(disc);
      const gm = X.glyphMesh(rc.sym, X.symColor[rc.sym], X.symColor[rc.sym], 1.4, true); gm.position.set(0, 2.4, 1.2); g.add(gm); const gl = G.glow(hx, 7, 0); gl.position.set(0, 2.4, 2); g.add(gl); const lt = new T.PointLight(hx, 0, 22, 2); lt.position.set(0, 2.4, 3); g.add(lt);
      return { g, ring, disc, gm, gl, lt, hx, v: 0, bad: 0 };
    });
    const bms = emitters.map(e => X.beams(root, 10, e.hx, .09)), feed = receivers.map((rc, i) => X.beams(root, 1, rc.hx, .06));
    const cond = []; receivers.forEach((rc, i) => { const l = Math.hypot(rc.g.position.x, rc.g.position.z), m = new T.Mesh(new T.BoxGeometry(.5, .08, l - 9), new T.MeshBasicMaterial({ color: rc.hx, transparent: true, opacity: .25, blending: T.AdditiveBlending, depthWrite: false })); m.position.set(rc.g.position.x / 2, .09, rc.g.position.z / 2); m.rotation.y = Math.atan2(-rc.g.position.z, rc.g.position.x); root.add(m); cond.push(m); });
    const coins = L.coins.map(c => { const m = X.coinMesh(); m.position.set(c[0], 1.1, c[1]); root.add(m); return m; });
    const fireflies = G.dust(q.dust, { w: 80, h: 30, d: 80 }, 0x6ac8ff); root.add(fireflies.obj); anims.push(fireflies.update);
    const rays = X.godRays([{ x: 0, y: 24, z: 0, w: 16, len: 48, rx: 0, rz: 0 }], 0x4cc8ff, 1.6); root.add(rays.obj); anims.push(rays.update);

    // ---- state -> picture ----
    let last = null, pw = 0, finaleT = -1, lastOk = 0;
    const sync = function (ev, events, instant) {
      last = ev; ev.mirrors.forEach((m, i) => { const o = mirrors[i]; if (m.k !== o.k) { const d = ((m.k - o.k + 12) % 8) - 4; o.tgt += -d * PI / 8; o.k = m.k; } if (instant) { o.ang = o.tgt; o.head.rotation.y = o.ang; } });
      ev.beams.forEach((b, i) => { const segs = b.segs.map((s, j) => { const hitEnd = b.hit && j === b.segs.length - 1, len = Math.hypot(s.x1 - s.x0, s.z1 - s.z0), k = Math.min(1, 80 / Math.max(.01, len)); return { x0: s.x0, y0: 2.4, z0: s.z0, x1: s.x0 + (s.x1 - s.x0) * k, y1: 2.4, z1: s.z0 + (s.z1 - s.z0) * k }; }); bms[i].set(segs); });
      if (instant) { pw = ev.powered ? 1 : 0; receivers.forEach((rc, i) => { rc.v = ev.ok[i] ? 1 : 0; }); }
    };
    const update = function (t, dt) {
      mirrors.forEach((o, i) => { o.ang += (o.tgt - o.ang) * Math.min(1, dt * 7); o.head.rotation.y = o.ang; o.gl.material.opacity = .4 + .15 * Math.sin(t * 3 + i); });
      const okN = last ? last.ok.filter(Boolean).length : 0, target = last && last.powered ? 1 : (okN * .22);
      pw += (target - pw) * Math.min(1, dt * 1.6); const P = pw;
      receivers.forEach((rc, i) => {
        const ok = last && last.ok[i], bad = last && last.wrong[i]; rc.v += ((ok ? 1 : 0) - rc.v) * Math.min(1, dt * 4); rc.bad += ((bad ? 1 : 0) - rc.bad) * Math.min(1, dt * 6);
        rc.ring.material.emissiveIntensity = .25 + rc.v * 2.4; rc.ring.material.emissive.setHex(rc.bad > .4 ? 0xff3030 : rc.hx); rc.disc.material.opacity = .1 + rc.v * .55 + rc.bad * (.3 + .25 * Math.sin(t * 20)); rc.disc.material.color.setHex(rc.bad > .4 ? 0xff3030 : rc.hx); rc.gl.material.opacity = rc.v * .8 + rc.bad * .5; rc.lt.intensity = rc.v * 2.4 + rc.bad * 1.4; rc.gm.material.opacity = .45 + rc.v * .55; cond[i].material.opacity = .15 + rc.v * .7 * (.7 + .3 * Math.sin(t * 6 + i));
      });
      bms.forEach(b => b.pulse(t)); emitters.forEach((e, i) => { e.gl.material.opacity = .55 + .2 * Math.sin(t * 4 + i); });
      coreMat.emissiveIntensity = .25 + P * 2.6; coreGlow.material.opacity = .2 + P * .75; coreGlow.scale.setScalar(22 + P * 14 + Math.sin(t * 3) * 1.2); coreLight.intensity = .8 + P * 6.5; shaftC.material.opacity = .08 + P * .35; core.rotation.y += dt * (.3 + P); inner.rotation.y -= dt * (.6 + P * 2); inner.rotation.x += dt * .3; inner.material.opacity = .25 + P * .5;
      floorMat.emissiveIntensity = .35 + P * .9; wallMat.emissiveIntensity = .8 + P * 1.2; ctx.hemi.intensity = .55 + P * .75; trim.forEach(m => { m.material.emissiveIntensity = .4 + P * 1.3; }); daisTop.material.emissiveIntensity = .6 + P * 1.4;
      coreRings.forEach((m, i) => { m.rotation.x += dt * (.4 + i * .3 + P * 1.5) * (i % 2 ? -1 : 1); m.rotation.y += dt * (.5 - i * .2 + P); m.material.emissiveIntensity = .4 + P * 1.5; }); gyros.forEach((g, i) => { g.t.rotation.z += dt * .1 * g.sp * (1 + P * 2); g.t.rotation.x = PI / 2 + Math.sin(t * .2 * (i + 1)) * .15; g.t.material.emissiveIntensity = .35 + P * 1.1; });
      for (let i = 0; i < orbitN; i++) { const a = t * (.5 + P) + i * 2.399, rr = 4 + (i % 9) * .55, y = CY + Math.sin(a * 1.3 + i) * (2.2 + P); orbP[i * 3] = Math.cos(a) * rr; orbP[i * 3 + 1] = y; orbP[i * 3 + 2] = Math.sin(a) * rr; } orbG.attributes.position.needsUpdate = true; orbits.material.opacity = .25 + P * .65;
      btn.material.emissiveIntensity = last && last.allOk && !last.powered ? .8 + .8 * Math.sin(t * 6) : last && last.powered ? 2 : .3; scr.material.color.setHex(last && last.powered ? 0x9fe0ff : last && last.allOk ? 0x58d8ff : 0x1f5f99);
      cosmos.material.opacity = Math.min(1, Math.max(0, (finaleT - 2.5) / 3)); galaxy.material.opacity = cosmos.material.opacity * .8;
      if (finaleT >= 0) { finaleT += dt; const k = Math.min(1, Math.max(0, (finaleT - 1.8) / 4)), e = G.ease(k); wedges.forEach(o => { o.w.position.x = o.dx * e * 60; o.w.position.z = o.dz * e * 60; o.w.position.y = 47 + e * 8; }); const pk = Math.min(1, Math.max(0, (finaleT - 5) / 2)); portal.scale.setScalar(.01 + G.ease(pk) * .99); pd.material.opacity = pk * .85; pr.rotation.z += dt * .6; }
      coins.forEach((c, i) => { if (!c.visible) return; c.rotation.y = t * 2.2 + i; c.position.y = 1.1 + Math.sin(t * 2 + i) * .12; });
    };
    const act = [];
    L.mirrors.forEach((m, i) => act.push({ id: m.id, kind: 'mirror', label: 'Turn mirror', x: m.x, z: m.z, range: 3.6, anim: 'turn', dur: 1.0, hit: .45, a: { t: 'mirror', id: m.id }, look: [m.x, 2.4, m.z], root: mirrors[i].g, standDist: 2.6 }));
    act.push({ id: 'console', kind: 'console', label: 'Activate console', x: L.console.x, z: L.console.z, range: 3.2, anim: 'press', dur: 1.2, hit: .55, a: { t: 'console', id: 'console' }, look: [0, 6, 0], root: consoleG, standDist: 2.4 });
    const colliders = [...L.mirrors.map(m => ({ x: m.x, z: m.z, r: 1.15 })), ...L.emitters.map(e => ({ x: e.x, z: e.z, r: 2.1 })), ...L.receivers.map(rc => ({ x: rc.x, z: rc.z, r: 2.2 })), { x: L.console.x, z: L.console.z, r: 1.5 }, { x: 0, z: 0, r: 1.9 }];
    const groundAt = (x, z) => { const rr = Math.hypot(x, z); if (rr > 38.6) return null; if (rr < 8.2) return rr < 7.4 ? .93 : .93 * (8.2 - rr) / .8; return 0; };
    return {
      groundAt, colliders, interactables: act, sync, update, coinMeshes: coins, coinPos: L.coins, start: L.start, sunDir: [20, 60, 25], cam: { yaw: 0, pitch: .4, dist: 12 },
      finaleCam() { return [{ t: 0, p: [0, 4, 16], l: [0, 10, 0] }, { t: 2.5, p: [-10, 3, 10], l: [0, 12, 0] }, { t: 5, p: [0, 2.5, 8], l: [0, 30, 0] }, { t: 8, p: [0, 4, 14], l: [0, 46, -10] }, { t: 11, p: [0, 5, 22], l: [0, 30, -45] }]; },
      finaleDur: 11.5, onFinale(c2) { finaleT = 0; c2.fx.burst(0, CY, 0, 90, 0x9fe0ff, 8); }, resetFinale() { finaleT = -1; wedges.forEach((o, i) => { o.w.position.set(0, 47, 0); }); portal.scale.setScalar(.01); cosmos.material.opacity = 0; }
    };
  };
})();
