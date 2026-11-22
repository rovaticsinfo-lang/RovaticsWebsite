/* MindVerse - puzzle stage views. Each stage kind of the rules engine has a 3D view here.
 * A view owns a THREE.Group, reads state from the engine (sync) and answers touch questions:
 *   tap(oid) -> { action } | { inspect: action } | { note } | null
 *   drag(oid) -> { group, zones:{id:{x,z}}, r, y, action(zoneId) } | null
 *   rotate(oid, dir) -> action | null          (HUD rotate buttons)
 * Positions are stage-local; the world places the group at the stage origin.
 */
(function () {
  'use strict';
  const T = THREE, MV = (window.MV = window.MV || {}), G = MV.gfx, E = window.MindverseEngine, S = (MV.stages = {});
  const M = G.mat, PI = Math.PI, D2R = PI / 180;

  const gameBase = () => ({ objs: {}, names: {}, selectable: {}, fns: [], locked: false });
  function newView(ctx) {
    const v = gameBase(); v.root = new T.Group(); v.ctx = ctx;
    v.add = (oid, g, name) => { v.objs[oid] = { g }; v.names[oid] = name || oid; G.tagAll(g, oid); v.root.add(g); return g; };
    v.update = (t, dt) => { for (let i = 0; i < v.fns.length; i++) v.fns[i](t, dt); };
    v.setLocked = f => { v.locked = f; v.root.traverse(o => { if (o.isMesh && o.material && o.material.emissive && !o.userData.keepEmissive) { /* subtle dim handled by the shade plate */ } }); if (v.shade) v.shade.visible = f; };
    v.setDone = f => { if (v.aura) v.aura.visible = f; };
    v.rotate = () => null; v.drag = () => null; v.tap = () => null; v.sync = () => { };
    v.focusY = 1;
    // a slab under the whole stage: dark shade when locked (future stage), gold aura when finished
    v.base = (w, d) => {
      const b = G.box(w, .4, d, M.floor, 0, -.14, 0); b.receiveShadow = true; v.root.add(b);
      const sh = new T.Mesh(new T.BoxGeometry(w + .4, 7, d + .4), new T.MeshBasicMaterial({ color: 0x06141a, transparent: true, opacity: .45, depthWrite: false })); sh.position.y = 3.4; sh.visible = false; sh.userData.shade = true; v.root.add(sh); v.shade = sh;
      const au = new T.Mesh(new T.RingGeometry(Math.min(w, d) * .5 - .5, Math.min(w, d) * .5 - .2, 48), new T.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: .8, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); au.rotation.x = -PI / 2; au.position.y = .06; au.visible = false; v.root.add(au); v.aura = au;
    };
    return v;
  }
  const marker = (r, color) => {                                                       // flat ring on the floor
    const m = new T.Mesh(new T.RingGeometry(r * .86, r, 40), new T.MeshBasicMaterial({ color: color || 0x7ae8ff, transparent: true, opacity: .55, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); m.rotation.x = -PI / 2; m.position.y = .05; return m;
  };
  const tween = (cur, target, dt, rate) => cur + (target - cur) * Math.min(1, dt * (rate || 10));

  /* ---------- crystal, pedestal, plate ---------- */
  function makeCrystal(scale) {
    const g = new T.Group(), c = new T.Mesh(new T.OctahedronGeometry(.62, 0), M.crystal); c.scale.set(.8, 1.5, .8); c.castShadow = true; g.add(c);
    const inner = new T.Mesh(new T.OctahedronGeometry(.3, 0), new T.MeshBasicMaterial({ color: 0xe6fbff, transparent: true, opacity: .9, blending: T.AdditiveBlending })); inner.scale.set(.8, 1.5, .8); g.add(inner);
    const h = G.glow(0x56c8ff, 3.6, .75); g.add(h); g.userData.halo = h; g.userData.core = c; g.userData.inner = inner;
    g.scale.setScalar(scale || 1); return g;
  }
  function makePedestal(h) {
    const g = new T.Group(); g.add(G.bevel(1.8, .22, 1.8, M.stoneDark, 0, .11, 0, .05), G.bevel(1.3, h - .25, 1.3, M.stoneWarm, 0, .12 + (h - .25) / 2, 0, .06), G.bevel(1.6, .18, 1.6, M.stone, 0, h - .03, 0, .05));
    for (let i = 0; i < 4; i++) { const r = new T.Mesh(new T.BoxGeometry(.5, .04, .06), new T.MeshBasicMaterial({ color: 0xffc766 })); r.position.set(0, h * .5, .66); r.rotation.y = i * PI / 2; r.position.set(Math.sin(i * PI / 2) * .66, h * .5, Math.cos(i * PI / 2) * .66); g.add(r); }
    return g;
  }
  function makePlate(r) {
    const g = new T.Group(); g.add(G.cyl(r, r + .12, .16, M.stoneDark, 0, .08, 0, 40));
    const ring = new T.Mesh(new T.TorusGeometry(r * .78, .06, 8, 48), new T.MeshStandardMaterial({ color: 0xd9a441, emissive: 0xffa927, emissiveIntensity: .3, metalness: .8, roughness: .3 })); ring.rotation.x = PI / 2; ring.position.y = .17; g.add(ring);
    const ring2 = ring.clone(); ring2.material = ring.material.clone(); ring2.scale.setScalar(.55); g.add(ring2);
    for (let i = 0; i < 8; i++) { const a = i * PI / 4, t = new T.Mesh(new T.BoxGeometry(.5, .05, .1), ring.material); t.position.set(Math.cos(a) * r * .62, .17, Math.sin(a) * r * .62); t.rotation.y = -a; g.add(t); }
    const gl = G.glow(0xffb040, r * 2.8, .0); gl.position.y = .3; g.add(gl);
    g.userData.set = f => { [ring, ring2].forEach(m => { m.material.emissiveIntensity = .3 + f * 1.7; }); gl.material.opacity = f * .7; };
    return g;
  }
  function energyPath(pts, y) {                                                        // glowing floor conduit with a travelling pulse
    const g = new T.Group(), mats = [], len = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const m = new T.Mesh(new T.BoxGeometry(l, .06, .22), new T.MeshBasicMaterial({ color: 0x3a3226 })); m.position.set((a[0] + b[0]) / 2, y || .05, (a[1] + b[1]) / 2); m.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]); g.add(m); mats.push(m); len.push(l);
    }
    const pulse = G.glow(0x7ae8ff, 1.2, 0); g.add(pulse); const total = len.reduce((a, b) => a + b, 0); let on = 0;
    g.userData.set = f => { on = f; mats.forEach(m => m.material.color.setHex(f ? 0x58d8ff : 0x3a3226)); };
    g.userData.update = t => { pulse.material.opacity = on * .9; if (!on) return; let d = (t * 3) % total, i = 0; while (i < len.length - 1 && d > len[i]) { d -= len[i]; i++; } const a = pts[i], b = pts[i + 1], k = d / len[i]; pulse.position.set(a[0] + (b[0] - a[0]) * k, (y || .05) + .2, a[1] + (b[1] - a[1]) * k); };
    return g;
  }

  /* ======================= PLACE ======================= */
  S.place = function (ctx, st) {
    const v = newView(ctx), p = st.p; v.base(16, 13); const Z = p.zones; v.focusY = 1.2;
    Object.keys(Z).forEach(id => {
      const z = Z[id];
      if (id === p.plate) return;
      if (id === 'pedestal') { const ped = makePedestal(1.0); ped.position.set(z.x, 0, z.z); v.root.add(ped); z.top = 1.05; return; }
      const r = G.cyl(.85, .95, .2, id === 'urn' ? M.stoneWarm : M.stoneMoss, z.x, .1, z.z, 9); r.rotation.y = id.length; v.root.add(r); z.top = .22;
      const mk = marker(1.15, 0x7ae8ff); mk.position.set(z.x, .02, z.z); mk.material.opacity = .22; v.root.add(mk); z.mk = mk; G.tagAll(r, id); G.tagAll(mk, id); r.add(G.hit(id, 1.3, .6, .2)); r.children[r.children.length - 1].position.y = 0;
    });
    const pl = makePlate(1.5); pl.position.set(Z[p.plate].x, 0, Z[p.plate].z); G.tagAll(pl, p.plate); v.root.add(pl); Z[p.plate].top = .18; v.plate = pl;
    const door = ctx.doorPos || [0, -7.5];
    v.conduit = energyPath([[Z[p.plate].x, Z[p.plate].z], [Z[p.plate].x, door[1] + 3.4], [door[0], door[1] + 3.4]]); v.root.add(v.conduit);
    const cr = makeCrystal(1); v.add('crystal', cr, 'Energy crystal'); G.tagAll(cr, 'crystal'); cr.add(G.hit('crystal', 1.1, 2.6, 0)); v.crystal = cr;
    const pos = { x: Z[p.start].x, y: Z[p.start].top + 1, z: Z[p.start].z }; let at = p.start, glow = 0, goalOn = 0; const lift = { v: 0 };
    cr.position.set(pos.x, pos.y, pos.z);
    v.sync = (s, instant) => { at = s.at; goalOn = at === p.plate ? 1 : 0; if (instant) { const z = Z[at]; pos.x = z.x; pos.z = z.z; pos.y = z.top + 1; glow = goalOn; } };
    v.fns.push((t, dt) => {
      if (!v.dragging) { const z = Z[at]; pos.x = tween(pos.x, z.x, dt, 9); pos.z = tween(pos.z, z.z, dt, 9); pos.y = tween(pos.y, z.top + 1 + .12 * Math.sin(t * 2.2) + lift.v, dt, 9); cr.position.set(pos.x, pos.y, pos.z); }
      cr.userData.core.rotation.y = t * .9; cr.userData.inner.rotation.y = -t * 1.4; cr.userData.halo.material.opacity = .55 + .2 * Math.sin(t * 2.6);
      glow = tween(glow, goalOn, dt, 4); pl.userData.set(glow); v.conduit.userData.set(glow > .6 ? 1 : 0); v.conduit.userData.update(t);
      Object.keys(Z).forEach(id => { const z = Z[id]; if (z.mk) z.mk.material.opacity = v.dragging ? .5 + .25 * Math.sin(t * 6) : .22; });
    });
    v.drag = oid => oid !== 'crystal' ? null : ({ group: cr, zones: Object.fromEntries(Object.keys(Z).map(k => [k, { x: Z[k].x, z: Z[k].z, y: Z[k].top + 1 }])), r: 2.0, y: 2.4, action: z => ({ t: 'move', obj: 'crystal', to: z }) });
    v.tap = oid => oid === 'crystal' ? { select: 'crystal', note: 'Drag the crystal, or tap a stone to move it there.' } : (Z[oid] ? { action: { t: 'move', obj: 'crystal', to: oid } } : null);
    v.zoneAt = (x, z) => E.nearestZone(Z, x, z, 1.7);
    v.setDragging = f => { v.dragging = f; if (!f) { pos.x = cr.position.x; pos.y = cr.position.y; pos.z = cr.position.z; } };
    v.destPos = a => a.t === 'move' && Z[a.to] ? { x: Z[a.to].x, y: Z[a.to].top + .6, z: Z[a.to].z } : null;
    return v;
  };

  /* ======================= BEAM ======================= */
  function makeMirror(stepsN) {
    const g = new T.Group(); g.add(G.cyl(.55, .7, .25, M.stoneDark, 0, .12, 0, 20), G.cyl(.14, .2, 1.0, M.bronze, 0, .72, 0, 12));
    const pivot = new T.Group(); pivot.position.y = 1.55; g.add(pivot);
    const half = E.MIRROR_HALF, glass = new T.Mesh(new T.BoxGeometry(half * 2, 1.45, .06), M.glass); glass.castShadow = true; pivot.add(glass);
    [[0, .78, half * 2 + .16, .12], [0, -.78, half * 2 + .16, .12]].forEach(f => { const b = new T.Mesh(new T.BoxGeometry(f[2], f[3], .16), M.gold); b.position.set(f[0], f[1], 0); b.castShadow = true; pivot.add(b); });
    [-half - .04, half + .04].forEach(x => { const b = new T.Mesh(new T.BoxGeometry(.12, 1.6, .16), M.gold); b.position.set(x, 0, 0); b.castShadow = true; pivot.add(b); const gem = new T.Mesh(new T.SphereGeometry(.1, 10, 8), M.crystal); gem.position.set(x, .85, 0); pivot.add(gem); });
    const flash = G.glow(0x9fe8ff, 3.2, 0); flash.position.y = 0; pivot.add(flash);
    const ring = new T.Group(); for (let i = 0; i < stepsN * 2; i++) { const a = i * PI / stepsN; const tk = new T.Mesh(new T.BoxGeometry(.22, .03, .06), new T.MeshBasicMaterial({ color: i % 2 ? 0x6a5c40 : 0xc9a24c })); tk.position.set(Math.cos(a) * 1.15, .27, Math.sin(a) * 1.15); tk.rotation.y = -a; ring.add(tk); } g.add(ring);
    const cur = new T.Mesh(new T.BoxGeometry(.38, .04, .1), new T.MeshBasicMaterial({ color: 0x7ae8ff })); g.add(cur); g.userData = { pivot, flash, cur };
    g.userData.setAngle = deg => { pivot.rotation.y = -deg * D2R; cur.position.set(Math.cos(deg * D2R) * 1.15, .3, Math.sin(deg * D2R) * 1.15); cur.rotation.y = -deg * D2R; };
    g.add(G.hit('', .95, 2.2, 1.1)); return g;
  }
  function makeNode(kind) {                                                            // 'source' emitter or 'receiver' relay
    const g = new T.Group(); g.add(G.cyl(.75, .9, .3, M.stoneDark, 0, .15, 0, 20), G.cyl(.5, .62, .9, M.stoneWarm, 0, .75, 0, 20));
    const ring = new T.Mesh(new T.TorusGeometry(.62, .09, 10, 32), M.gold); ring.position.y = 1.25; ring.rotation.x = PI / 2; g.add(ring);
    const orb = new T.Mesh(new T.SphereGeometry(.42, 24, 18), new T.MeshStandardMaterial({ color: 0x1b4e68, emissive: 0x1fa8ff, emissiveIntensity: kind === 'source' ? 1.6 : .08, metalness: .3, roughness: .2, envMapIntensity: 1.5 })); orb.position.y = 1.55; orb.castShadow = true; g.add(orb);
    const gl = G.glow(0x4cc8ff, 3.6, kind === 'source' ? .8 : 0); gl.position.y = 1.55; g.add(gl);
    const spin = new T.Group(); spin.position.y = 1.55; for (let i = 0; i < 3; i++) { const c = new T.Mesh(new T.ConeGeometry(.09, .3, 4), new T.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0, blending: T.AdditiveBlending })); const a = i * PI * 2 / 3; c.position.set(Math.cos(a) * .85, .0, Math.sin(a) * .85); c.rotation.z = PI; spin.add(c); } g.add(spin);
    const hole = new T.Mesh(new T.TorusGeometry(.5, .035, 6, 24), new T.MeshBasicMaterial({ color: 0x6a5c40 })); hole.position.y = 1.55; hole.rotation.x = PI / 2; hole.scale.setScalar(1.35); g.add(hole);   // empty ring = unlit (shape cue, not only colour)
    g.userData.set = f => { orb.material.emissiveIntensity = .08 + f * 1.9; gl.material.opacity = f * .85; spin.children.forEach(c => { c.material.opacity = f * .9; }); hole.visible = f < .5; g.userData.f = f; };
    g.userData.spin = spin; g.userData.set(kind === 'source' ? 1 : 0); return g;
  }
  S.beam = function (ctx, st) {
    const v = newView(ctx), p = st.p, B = p.bounds; v.base(B.x1 - B.x0 + 3, B.z1 - B.z0 + 3); v.focusY = 1; v.fitW = B.x1 - B.x0 + 3;
    const stepDeg = 180 / p.steps, BY = 1.55;
    const src = makeNode('source'); src.position.set(p.source.x, 0, p.source.z); v.root.add(src); const arrow = new T.Mesh(new T.ConeGeometry(.22, .6, 4), new T.MeshBasicMaterial({ color: 0xbff4ff })); arrow.rotation.z = -PI / 2; arrow.position.set(.95, 1.55, 0); const ag = new T.Group(); ag.add(arrow); ag.rotation.y = -p.source.dir * D2R; ag.position.set(p.source.x, 0, p.source.z); v.root.add(ag);
    const mir = {}, rec = {}, blk = {}, sockets = {}, mst = {};
    p.mirrors.forEach(m => { const g = makeMirror(p.steps); g.position.set(m.x, 0, m.z); v.add(m.id, g, 'Mirror'); mir[m.id] = { g, cur: m.start * stepDeg, tgt: m.start * stepDeg, step: m.start }; g.userData.setAngle(mir[m.id].cur); });
    p.receivers.forEach(r => { const g = makeNode('receiver'); g.position.set(r.x, 0, r.z); v.add(r.id, g, 'Energy relay'); rec[r.id] = { g, f: 0, on: 0 }; g.add(G.hit(r.id, .85, 2.2, 1.0)); });
    (p.blockers || []).forEach(b => {
      const g = new T.Group(); g.add(G.bevel(1.05, 1.05, 1.05, M.stoneWarm, 0, .55, 0, .08)); const tx = new T.Mesh(new T.PlaneGeometry(.7, .7), new T.MeshBasicMaterial({ map: G.glyphTexture('triangle', '#6d6350', '#f3c777', '#ffb040') })); tx.position.set(0, .55, .6); g.add(tx); const tx2 = tx.clone(); tx2.rotation.y = PI; tx2.position.z = -.6; g.add(tx2);
      g.add(G.hit(b.id, 1, 1.5, .6)); const s = b.slots[b.start]; g.position.set(s.x, 0, s.z); v.add(b.id, g, 'Stone block'); blk[b.id] = { g, x: s.x, z: s.z, slot: b.start };
      sockets[b.id] = b.slots.map((s2, k) => { const m = marker(.8, 0xffc766); m.position.set(s2.x, .04, s2.z); v.root.add(m); const disc = G.cyl(.62, .62, .06, M.stoneDark, s2.x, .03, s2.z, 16); v.root.add(disc); m.userData.slot = k; G.tagAll(m, b.id + '#' + k); disc.userData.oid = b.id + '#' + k; return m; });
    });
    // beam segments
    const MAXS = 14, segs = [], flares = [];
    for (let i = 0; i < MAXS; i++) {
      const core = new T.Mesh(new T.CylinderGeometry(.045, .045, 1, 8), M.energy), glow = new T.Mesh(new T.CylinderGeometry(.16, .16, 1, 10), M.energyGlow);
      const gp = new T.Group(); gp.add(core, glow); gp.visible = false; v.root.add(gp); segs.push(gp);
      const f = G.glow(0xbff4ff, 1.6, .9); f.visible = false; v.root.add(f); flares.push(f);
    }
    const pulses = []; for (let i = 0; i < 5; i++) { const s = G.glow(0xffffff, .7, .95); s.visible = false; v.root.add(s); pulses.push(s); }
    let tr = null, trAt = 0;
    const light = new T.PointLight(0x4cc8ff, 0, 9, 2); light.position.set(p.source.x, 2, p.source.z); v.root.add(light);
    v.sync = (s, instant) => {
      p.mirrors.forEach(m => { const o = mir[m.id], a = s.m[m.id] * stepDeg; let d = a - (o.step * stepDeg); o.step = s.m[m.id]; if (d > 90) d -= 180; if (d < -90) d += 180; o.tgt += d; if (instant) o.cur = o.tgt = a; });
      (p.blockers || []).forEach(b => { const sl = b.slots[s.b[b.id]]; blk[b.id].x = sl.x; blk[b.id].z = sl.z; blk[b.id].slot = s.b[b.id]; if (instant) blk[b.id].g.position.set(sl.x, 0, sl.z); });
      tr = E.trace(p, s); v.tr = tr; v.litNow = Object.keys(tr.lit);
    };
    v.fns.push((t, dt) => {
      p.mirrors.forEach(m => { const o = mir[m.id]; o.cur = tween(o.cur, o.tgt, dt, 12); o.g.userData.setAngle(o.cur); });
      (p.blockers || []).forEach(b => { const o = blk[b.id]; if (!v.dragging || v.dragging !== o.g) { const g = o.g; g.position.x = tween(g.position.x, o.x, dt, 10); g.position.z = tween(g.position.z, o.z, dt, 10); g.position.y = tween(g.position.y, 0, dt, 12); } sockets[b.id].forEach((m, k) => { m.material.opacity = v.dragging === o.g ? .55 + .3 * Math.sin(t * 6) : (k === o.slot ? .0 : .35); }); });
      let n = 0; if (tr) tr.segs.forEach((sg, i) => {
        const g = segs[i], dx = sg.x2 - sg.x1, dz = sg.z2 - sg.z1, L = Math.hypot(dx, dz); g.visible = L > .01; g.position.set((sg.x1 + sg.x2) / 2, BY, (sg.z1 + sg.z2) / 2); g.rotation.set(0, -Math.atan2(dz, dx), PI / 2); g.scale.set(1, L, 1);
        const w = 1 + .12 * Math.sin(t * 20 + i); g.children[0].scale.set(w, 1, w); g.children[1].scale.set(1 + .2 * Math.sin(t * 7 + i), 1, 1 + .2 * Math.sin(t * 7 + i)); n = i + 1;
      });
      for (let i = n; i < MAXS; i++) { segs[i].visible = false; flares[i].visible = false; }
      if (tr) tr.segs.forEach((sg, i) => { const f = flares[i]; f.visible = true; f.position.set(sg.x2, BY, sg.z2); f.material.opacity = .55 + .35 * Math.sin(t * 12 + i); f.scale.setScalar(1.2 + .25 * Math.sin(t * 9 + i)); });
      // travelling pulses along the first segments
      pulses.forEach((s, i) => { if (!tr || !tr.segs.length) { s.visible = false; return; } let total = 0; tr.segs.forEach(q => total += Math.hypot(q.x2 - q.x1, q.z2 - q.z1)); let d = ((t * 5 + i * total / pulses.length) % total), k = 0; while (k < tr.segs.length - 1 && d > Math.hypot(tr.segs[k].x2 - tr.segs[k].x1, tr.segs[k].z2 - tr.segs[k].z1)) { d -= Math.hypot(tr.segs[k].x2 - tr.segs[k].x1, tr.segs[k].z2 - tr.segs[k].z1); k++; } const q = tr.segs[k], L = Math.hypot(q.x2 - q.x1, q.z2 - q.z1) || 1; s.visible = true; s.position.set(q.x1 + (q.x2 - q.x1) * d / L, BY, q.z1 + (q.z2 - q.z1) * d / L); });
      p.receivers.forEach(r => { const o = rec[r.id], on = tr && tr.lit[r.id] ? 1 : 0; if (on && !o.on) { const wp = v.root.localToWorld(new T.Vector3(r.x, 1.6, r.z)); ctx.fx.burst(wp.x, wp.y, wp.z, 22, 0x9fe8ff, 4); } if (on && !o.on) ctx.sfx && ctx.sfx('relay'); o.on = on; o.f = tween(o.f, on, dt, 6); o.g.userData.set(o.f); o.g.userData.spin.rotation.y = t * 1.6; });
      mir[p.mirrors[0].id] && p.mirrors.forEach(m => { const o = mir[m.id]; let hit = false; if (tr) { tr.segs.forEach(sg => { if (Math.hypot(sg.x2 - m.x, sg.z2 - m.z) < 1.1) hit = true; }); } const fl = o.g.userData.flash; fl.material.opacity = tween(fl.material.opacity, hit ? .55 : 0, dt, 8); });
      light.intensity = .8 + .2 * Math.sin(t * 9);
    });
    v.tap = (oid, g) => {
      if (mir[oid]) return { action: { t: 'rot', obj: oid, d: 1 }, select: oid };
      if (blk[oid]) { const b = p.blockers.find(x => x.id === oid), s = g.state(); return { select: oid, note: 'Drag the stone block onto a glowing socket, or tap a socket.' }; }
      const m = /^(.+)#(\d+)$/.exec(oid); if (m && blk[m[1]]) return { action: { t: 'slot', obj: m[1], to: +m[2] } };
      if (rec[oid]) return { note: 'Energy relays light up when the beam passes through them. Light them all together.' };
      return null;
    };
    v.rotate = (oid, d) => mir[oid] ? { t: 'rot', obj: oid, d } : null;
    v.drag = oid => blk[oid] ? ({ group: blk[oid].g, zones: Object.fromEntries(p.blockers.find(b => b.id === oid).slots.map((s, k) => [k, { x: s.x, z: s.z, y: .6 }])), r: 1.7, y: 1.2, action: k => ({ t: 'slot', obj: oid, to: +k }) }) : null;
    v.setDragging = f => { v.dragging = f; };
    v.destPos = a => { if (a.t !== 'slot') return null; const b = p.blockers.find(x => x.id === a.obj), s = b && b.slots[a.to]; return s ? { x: s.x, y: .6, z: s.z } : null; };
    return v;
  };

  /* ======================= SYMBOLS ======================= */
  const GLYPH_COL = { spiral: ['#ffcf6a', '#ff9c20'], triangle: ['#7be3ff', '#1fa8ff'], sun: ['#ffe27a', '#ffa820'], wave: ['#8ff0ff', '#19b5d8'], moon: ['#e8e4ff', '#9a8cff'], eye: ['#b8ffd0', '#32c878'], star: ['#fff2a8', '#ffc83a'] };
  G.GLYPH_COL = GLYPH_COL;
  G.clueTexture = function (p) {
    const rows = p.clue.length, RH = 140, H = 100 + rows * RH, c = G.cv(640, H), x = c.getContext('2d'); x.drawImage(G.stoneCanvas(77, '#8a7a5a', .4), 0, 0, 640, H); x.strokeStyle = '#2a2014'; x.lineWidth = 6; x.strokeRect(10, 10, 620, H - 20);
    x.fillStyle = '#2b2012'; x.font = 'bold 32px Georgia,serif'; x.textAlign = 'center'; x.fillText('THE CARVINGS', 320, 60);
    const N = p.slots, sz = Math.min(84, Math.floor(540 / N) - 14), x0 = 320 - (N * (sz + 12)) / 2;
    const slot = (i, y, sym, cross) => { const sx = x0 + i * (sz + 12); x.strokeStyle = '#2b2012'; x.lineWidth = 3; x.strokeRect(sx, y, sz, sz); if (sym) G.drawGlyph(x, sym, sx + sz / 2, y + sz / 2, sz * .9, '#2b2012'); if (cross) { x.strokeStyle = '#8a1d28'; x.lineWidth = 6; x.beginPath(); x.moveTo(sx + 6, y + 6); x.lineTo(sx + sz - 6, y + sz - 6); x.moveTo(sx + sz - 6, y + 6); x.lineTo(sx + 6, y + sz - 6); x.stroke(); } };
    const cap = (txt, y) => { x.fillStyle = '#2b2012'; x.font = '22px Georgia,serif'; x.textAlign = 'center'; x.fillText(txt, 320, y); };
    let y = 90;
    p.clue.forEach(k => {
      x.fillStyle = 'rgba(40,28,14,.08)'; x.fillRect(24, y - 6, 592, RH - 10);
      if (k.k === 'distinct') { p.symbols.slice(0, 5).forEach((s, i, arr) => G.drawGlyph(x, s, 320 + (i - (arr.length - 1) / 2) * 82, y + 46, 64, '#2b2012')); cap('all different: one carving per slot', y + 106); }
      if (k.k === 'at') { for (let i = 0; i < N; i++) slot(i, y + 4, i === k.pos ? k.s : null); cap('stands in this slot', y + 112); }
      if (k.k === 'notAt') { for (let i = 0; i < N; i++) slot(i, y + 4, i === k.pos ? k.s : null, i === k.pos); cap('never stands in this slot', y + 112); }
      if (k.k === 'left') { G.drawGlyph(x, k.a, 200, y + 44, 66, '#2b2012'); x.strokeStyle = '#2b2012'; x.lineWidth = 7; x.beginPath(); x.moveTo(250, y + 44); x.lineTo(386, y + 44); x.moveTo(358, y + 22); x.lineTo(388, y + 44); x.lineTo(358, y + 66); x.stroke(); G.drawGlyph(x, k.b, 440, y + 44, 66, '#2b2012'); cap('somewhere to the left of', y + 112); }
      y += RH;
    });
    return { tex: G.tex(c, null, true), ratio: H / 640 };
  };
  S.symbols = function (ctx, st) {
    const v = newView(ctx), p = st.p, N = p.slots, SP = N > 3 ? 2.95 : 3.2, W0 = N * SP + 1.2; v.base(Math.max(16, W0 + 4), 10); v.focusY = 2; v.fitW = W0 + 1.2;
    const panels = [], mats = {}; p.symbols.forEach(s => { const gc = GLYPH_COL[s]; mats[s] = new T.MeshStandardMaterial({ map: G.glyphTexture(s, '#5c5444', gc[0], gc[1]), emissive: new T.Color(gc[1]), emissiveMap: G.glyphTexture(s, '#000', '#fff', null), emissiveIntensity: .55, roughness: .7 }); });
    const frame = G.bevel(W0, 4.6, .5, M.stoneDark, 0, 2.3, -.45, .08); v.root.add(frame);
    const xOf = i => (i - (N - 1) / 2) * SP;
    for (let i = 0; i < N; i++) {
      const g = new T.Group(), sl = G.bevel(2.7, 3.4, .5, M.stoneWarm, 0, 0, 0, .07); g.add(sl);
      const face = new T.Mesh(new T.PlaneGeometry(2.1, 2.1), mats[p.symbols[p.start[i]]]); face.position.set(0, .15, .3); g.add(face);
      const rim = new T.Mesh(new T.PlaneGeometry(2.3, 2.3), new T.MeshBasicMaterial({ color: 0xffc766, transparent: true, opacity: .0, blending: T.AdditiveBlending, depthWrite: false })); rim.position.set(0, .15, .27); g.add(rim);
      g.position.set(xOf(i), 2.3, 0); const hit = G.hit('panel_' + i, 1.6, 3.6, 0); hit.rotation.x = PI / 2; g.add(hit); v.add('panel_' + i, g, 'Symbol panel ' + (i + 1));
      const slab = G.bevel(2.9, .5, 1.1, M.stoneDark, xOf(i), .25, .1, .05); v.root.add(slab);
      panels.push({ g, face, rim, spin: 0, cur: p.start[i], disp: p.start[i] });
    }
    const lamps = panels.map((_, i) => { const l = G.glow(0xffb040, 1.4, .0); l.position.set(xOf(i), 4.9, .1); v.root.add(l); return l; });
    const ct = G.clueTexture(p), TW = Math.min(3.4, 2.6 + N * .2), TH = Math.min(4.6, TW * ct.ratio);
    const tab = new T.Mesh(new T.BoxGeometry(TW, TH, .22), [M.stone, M.stone, M.stone, M.stone, new T.MeshStandardMaterial({ map: ct.tex, roughness: .9 }), M.stone]);
    tab.position.set(-W0 / 2 - 1.1, TH / 2 + .1, 3.9); tab.rotation.set(-.42, .35, 0); tab.castShadow = tab.receiveShadow = true; v.add('clue', tab, 'Clue tablet'); tab.add(G.hit('clue', Math.max(1.8, TW / 2), .8, 0));
    v.clueLines = p.clueLines;
    v.sync = (s, instant) => { s.slots.forEach((val, i) => { const o = panels[i]; if (val !== o.cur) { o.cur = val; o.spin = 1; } if (instant) { o.disp = val; o.face.material = mats[p.symbols[val]]; o.spin = 0; } }); v.slots = s.slots; };
    v.fns.push((t, dt) => {
      panels.forEach((o, i) => {
        if (o.spin > 0) { o.spin = Math.max(0, o.spin - dt * 3.2); const k = 1 - o.spin; o.g.rotation.y = k * PI * 2; if (k > .5 && o.disp !== o.cur) { o.disp = o.cur; o.face.material = mats[p.symbols[o.cur]]; } if (o.spin <= 0) { o.g.rotation.y = 0; o.disp = o.cur; o.face.material = mats[p.symbols[o.cur]]; } }
        o.face.material.emissiveIntensity = .55 + (v.done ? .5 : 0) + .15 * Math.sin(t * 2 + i);
        lamps[i].material.opacity = tween(lamps[i].material.opacity, v.done ? .9 : 0, dt, 6);
      });
    });
    v.setDone = f => { v.done = f; v.aura.visible = f; };
    v.tap = oid => /^panel_\d$/.test(oid) ? { action: { t: 'cycle', obj: oid, slot: +oid.slice(6) } } : oid === 'clue' ? { clue: true, note: 'inspect' } : null;
    return v;
  };

  /* ======================= BALANCE ======================= */
  function stoneTexture(w) {
    const c = G.cv(128, 128), x = c.getContext('2d'); x.drawImage(G.stoneCanvas(w * 13, '#9a8a66', .3), 0, 0, 128, 128);
    x.fillStyle = '#2b2012'; const pos = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[w] || [];
    pos.forEach(q => { x.beginPath(); x.arc(64 + q[0] * 26, 64 + q[1] * 26, 9, 0, 7); x.fill(); x.fillStyle = 'rgba(255,230,160,.5)'; x.beginPath(); x.arc(62 + q[0] * 26, 62 + q[1] * 26, 4, 0, 7); x.fill(); x.fillStyle = '#2b2012'; });
    return G.tex(c, null, true);
  }
  S.balance = function (ctx, st) {
    const v = newView(ctx), p = st.p, NS = p.stones.length, TSP = NS > 5 ? 1.95 : 2.2; v.base(Math.max(15, NS * TSP + 4), 11); v.focusY = 2.4; v.fitW = Math.max(14, NS * TSP + 3);
    const col = G.bevel(1.2, 3.8, 1.2, M.stoneWarm, 0, 1.9, 0, .07); v.root.add(col); v.root.add(G.bevel(3.2, .5, 2.4, M.stoneDark, 0, .25, 0, .06));
    const PY = 4.0, beam = new T.Group(); beam.position.y = PY; v.root.add(beam);
    beam.add(G.bevel(7.4, .3, .5, M.bronze, 0, 0, 0, .06)); const piv = new T.Mesh(new T.SphereGeometry(.45, 20, 16), M.gold); beam.add(piv); piv.castShadow = true;
    const ptr = new T.Mesh(new T.ConeGeometry(.16, .6, 4), M.gold); ptr.position.set(0, .7, 0); beam.add(ptr);
    const pans = {}; ['L', 'R'].forEach(side => {
      const sx = side === 'L' ? -3.4 : 3.4, g = new T.Group(); const pan = G.cyl(1.55, 1.2, .24, M.bronze, 0, 0, 0, 28); g.add(pan); const rim = new T.Mesh(new T.TorusGeometry(1.55, .07, 8, 32), M.gold); rim.rotation.x = PI / 2; rim.position.y = .12; g.add(rim);
      for (let i = 0; i < 3; i++) { const a = i * PI * 2 / 3; const chain = new T.Mesh(new T.CylinderGeometry(.03, .03, 2, 5), M.gold); chain.userData.a = a; g.add(chain); chain.userData.chain = 1; }
      const gl = G.glow(0xffd070, 4, 0); gl.position.y = .4; g.add(gl); g.userData.gl = gl; v.root.add(g); pans[side] = { g, sx, slots: [] };
    });
    // plinth numbers: authored weights on each side, readable feedback
    const nc = G.cv(256, 128), nx = nc.getContext('2d'), nt = new T.CanvasTexture(nc); nt.encoding = T.sRGBEncoding; const plaque = new T.Mesh(new T.PlaneGeometry(3, 1.5), new T.MeshBasicMaterial({ map: nt, transparent: true })); plaque.position.set(0, 1.5, .7); v.root.add(plaque); const gold = (p.target > 0);
    const trayZ = 3.7, tray = G.bevel(NS * TSP + .8, .3, 2.2, M.stoneDark, 0, .15, trayZ, .05); v.root.add(tray);
    const stones = {}, order = p.stones.map(s => s.id);
    p.stones.forEach((s, i) => {
      const sc = .62 + s.w * .075, g = new T.Group(), body = new T.Mesh(new T.CylinderGeometry(sc, sc * 1.06, sc * 1.05, 8), [new T.MeshStandardMaterial({ map: stoneTexture(s.w), bumpScale: 1, roughness: .85 }), new T.MeshStandardMaterial({ map: stoneTexture(s.w), roughness: .85 }), M.stoneWarm]);
      body.material[0] = M.stoneWarm.clone(); body.material[0].map = G.tex(G.stoneCanvas(s.w * 9, '#9a8a66', .4), [1, 1]); body.material[1] = new T.MeshStandardMaterial({ map: stoneTexture(s.w), roughness: .85 }); body.material[2] = M.stoneWarm;
      body.castShadow = body.receiveShadow = true; body.position.y = sc * .52; g.add(body); g.add(G.hit(s.id, sc + .45, 2, 1));
      const hx = -((p.stones.length - 1) * TSP) / 2 + i * TSP; stones[s.id] = { g, sc, home: { x: hx, z: trayZ }, pos: { x: hx, y: .3, z: trayZ }, at: 'tray', w: s.w }; g.position.set(hx, .3, trayZ); v.add(s.id, g, 'Stone (weight ' + s.w + ')');
    });
    const zoneCenters = () => ({ L: { x: -3.4, z: 0, y: 2.1 }, R: { x: 3.4, z: 0, y: 2.1 }, tray: { x: 0, z: trayZ, y: .6 } });
    let tilt = 0, tiltT = 0, bal = 0;
    v.sync = (s, instant) => {
      const sm = E.sums(p, s); v.sm = sm; tiltT = Math.max(-.42, Math.min(.42, -(sm.R - sm.L) * .075)); const ok = E.KIND.balance.goal(p, s); v.ok = ok;
      const cnt = { L: 0, R: 0 }; p.stones.forEach(q => { const o = stones[q.id]; o.at = s.pos[q.id]; if (o.at === 'tray') o.slot = null; else o.slot = cnt[o.at]++; });
      nx.clearRect(0, 0, 256, 128); nx.fillStyle = 'rgba(30,22,12,.85)'; nx.fillRect(0, 0, 256, 128); nx.strokeStyle = '#d9a441'; nx.lineWidth = 4; nx.strokeRect(3, 3, 250, 122); nx.font = 'bold 54px Georgia,serif'; nx.textAlign = 'center'; nx.fillStyle = ok ? '#8dffb0' : '#ffe3a0'; nx.fillText(sm.L + '  ' + (sm.L === sm.R ? '=' : sm.L < sm.R ? '<' : '>') + '  ' + sm.R, 128, 82); nx.font = '16px Georgia,serif'; nx.fillStyle = '#d8c79a'; nx.fillText('LEFT              RIGHT', 128, 28); nx.font = 'bold 17px Georgia,serif'; nx.fillStyle = '#9fe8ff'; nx.fillText(p.target ? 'GOAL: right is heavier by ' + p.target : 'GOAL: both sides equal', 128, 112); nt.needsUpdate = true;
      if (instant) tilt = tiltT;
    };
    const slotOff = [[-.62, -.35], [.62, -.35], [0, .6]];
    v.fns.push((t, dt) => {
      tilt = tween(tilt, tiltT, dt, 3.2); beam.rotation.z = tilt; ptr.rotation.z = -tilt;
      ['L', 'R'].forEach(side => {
        const P = pans[side], ex = Math.cos(tilt) * P.sx, ey = PY + Math.sin(tilt) * P.sx; P.g.position.set(ex, ey - 2.05, 0);
        P.g.children.forEach(c => { if (c.userData.chain) { const a = c.userData.a, dx = Math.cos(a) * 1.2, dz = Math.sin(a) * 1.2; c.position.set(dx / 2, 1.05, dz / 2); c.scale.y = 1; c.rotation.set(Math.atan2(dz, 2) * -1 + 0, 0, Math.atan2(dx, 2)); c.rotation.x = Math.atan2(dz, 2); c.rotation.z = -Math.atan2(dx, 2); } });
        P.g.userData.gl.material.opacity = tween(P.g.userData.gl.material.opacity, v.ok ? .7 : 0, dt, 4);
      });
      p.stones.forEach(q => {
        const o = stones[q.id]; if (v.dragging === o.g) return;
        let tx, ty, tz; if (o.at === 'tray') { tx = o.home.x; tz = o.home.z; ty = .3; } else { const P = pans[o.at], so = slotOff[o.slot] || [0, 0]; tx = P.g.position.x + so[0] * .95; tz = so[1] * .95; ty = P.g.position.y + .12; }
        o.pos.x = tween(o.pos.x, tx, dt, 9); o.pos.y = tween(o.pos.y, ty, dt, 9); o.pos.z = tween(o.pos.z, tz, dt, 9); o.g.position.set(o.pos.x, o.pos.y, o.pos.z);
      });
    });
    v.tap = (oid, g) => {
      if (!stones[oid]) return null; const s = g.state(), cur = s.pos[oid], seq = ['L', 'R', 'tray'], full = k => k !== 'tray' && p.stones.filter(x => s.pos[x.id] === k).length >= p.cap;
      let i = seq.indexOf(cur), to = null; for (let k = 1; k <= 3; k++) { const c = seq[(i + k) % 3]; if (c !== cur && !full(c)) { to = c; break; } }
      return to ? { action: { t: 'put', obj: oid, to }, select: oid } : null;
    };
    v.drag = oid => stones[oid] ? ({ group: stones[oid].g, zones: zoneCenters(), r: 2.7, y: 1.6, action: z => ({ t: 'put', obj: oid, to: z }), onStart: o => { o.pos && 0; } }) : null;
    v.setDragging = f => { const g = f || v.dragging; v.dragging = f; if (g) p.stones.forEach(q => { if (stones[q.id].g === g) { stones[q.id].pos.x = g.position.x; stones[q.id].pos.y = g.position.y; stones[q.id].pos.z = g.position.z; } }); };
    v.destPos = a => { if (a.t !== 'put') return null; const z = zoneCenters()[a.to]; return z ? { x: z.x, y: a.to === 'tray' ? .6 : 2, z: z.z } : null; };
    return v;
  };

  /* ======================= WATER ======================= */
  const CS = 2.5;
  function armBox(dirBit, w, mat, y) { const h = CS / 2; const m = new T.Mesh(new T.BoxGeometry(dirBit === 2 || dirBit === 8 ? h : w, y, dirBit === 1 || dirBit === 4 ? h : w), mat); const ox = dirBit === 2 ? h / 2 : dirBit === 8 ? -h / 2 : 0, oz = dirBit === 4 ? h / 2 : dirBit === 1 ? -h / 2 : 0; m.position.set(ox, 0, oz); return m; }
  S.water = function (ctx, st) {
    const v = newView(ctx), p = st.p, W = p.cols * CS + 1.6, H = p.rows * CS + 1.6; v.base(W + 2, H + 2); v.focusY = .2; v.fitW = W + 3;
    const X = c => (c - (p.cols - 1) / 2) * CS, Z = r => (r - (p.rows - 1) / 2) * CS;
    const wetMat = new T.MeshBasicMaterial({ color: 0x38c6ff, transparent: true, opacity: .0, blending: T.AdditiveBlending, depthWrite: false });
    const tiles = {}, glints = [];
    p.tiles.forEach(t => {
      const g = new T.Group(), slab = G.bevel(CS - .08, .34, CS - .08, M.stoneMoss, 0, .17, 0, .05); g.add(slab);
      const inner = new T.Group(); inner.position.y = .36; g.add(inner);
      const mask = E.tileMask(t, 0), grooveMat = M.groove, waterMat = new T.MeshBasicMaterial({ color: 0x30b8ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
      [1, 2, 4, 8].forEach(b => { if (!(mask & b)) return; const a = armBox(b, 1.0, M.stoneWarm, .26); a.position.y = .13; a.castShadow = true; inner.add(a); const gv = armBox(b, .6, grooveMat, .05); gv.position.y = .27; inner.add(gv); const w = armBox(b, .56, waterMat, .05); w.position.y = .285; inner.add(w); });
      const hub = new T.Mesh(new T.CylinderGeometry(.62, .62, .26, 18), M.stoneWarm); hub.position.y = .13; hub.castShadow = true; inner.add(hub); const hg = new T.Mesh(new T.CylinderGeometry(.4, .4, .05, 18), grooveMat); hg.position.y = .27; inner.add(hg); const hw = new T.Mesh(new T.CylinderGeometry(.38, .38, .05, 18), waterMat); hw.position.y = .285; inner.add(hw);
      const o = { g, inner, waterMat, t, rotCur: 0, rotTgt: 0, wet: 0, wetT: 0, rotN: 0 };
      if (t.t === 'valve') { const wheel = new T.Group(), tor = new T.Mesh(new T.TorusGeometry(.62, .08, 8, 24), M.bronze); tor.rotation.x = PI / 2; wheel.add(tor); for (let i = 0; i < 4; i++) { const sp = new T.Mesh(new T.BoxGeometry(1.2, .08, .08), M.bronze); sp.rotation.y = i * PI / 4; wheel.add(sp); } wheel.position.y = .95; const stem = G.cyl(.1, .1, .8, M.gold, 0, .65, 0, 8); inner.parent.add(stem); stem.position.y = .75; g.add(wheel); const gem = new T.Mesh(new T.OctahedronGeometry(.17), M.crystal); gem.position.y = 1.25; g.add(gem); o.wheel = wheel; o.gem = gem; o.wheelCur = 0; o.wheelTgt = 0; if (t.rot) { inner.rotation.y = -t.rot * PI / 2; } g.add(G.hit(t.id, 1.2, 1.6, .7)); }
      else if (t.t === 'source') { const sp = G.bevel(1.1, 1.6, 1.1, M.stoneWarm, -.5, .9, 0, .06); g.add(sp); const fall = G.waterfall(.9, 1.5); fall.obj.position.set(-.2, .3, 0); fall.obj.rotation.y = PI / 2; g.add(fall.obj); v.fns.push(fall.update); }
      else if (t.t === 'receiver') { const bowl = new T.Mesh(new T.CylinderGeometry(.9, .6, .5, 20, 1, true), M.bronze); bowl.position.y = .65; bowl.material = M.bronze.clone(); bowl.material.side = T.DoubleSide; g.add(bowl); const pool = new T.Mesh(new T.CircleGeometry(.85, 20), wetMat.clone()); pool.rotation.x = -PI / 2; pool.position.y = .82; g.add(pool); o.pool = pool; const sp = G.glow(0x4cc8ff, 4, 0); sp.position.y = 1.2; g.add(sp); o.spray = sp; g.add(G.hit(t.id, 1, 1.4, .6)); inner.rotation.y = -(t.rot || 0) * PI / 2; }
      else if (!t.fixed) { o.rotTgt = o.rotCur = 0; g.add(G.hit(t.id, 1.1, 1.0, .5)); const dot = new T.Mesh(new T.CylinderGeometry(.12, .12, .05, 8), M.gold); dot.position.set(0, .4, 0); g.add(dot); }
      if (t.fixed && t.t !== 'valve' && t.t !== 'source' && t.t !== 'receiver') inner.rotation.y = -(t.rot || 0) * PI / 2;
      if (t.fixed && t.t !== 'valve' && t.t !== 'receiver' && t.t !== 'source') slab.material = M.stoneDark;
      g.position.set(X(t.c), 0, Z(t.r)); v.add(t.id, g, t.t === 'valve' ? 'Valve' : 'Channel'); tiles[t.id] = o;
      if (t.fixed && t.t !== 'valve' && t.t !== 'source' && t.t !== 'receiver') { /* decor */ g.userData.decor = true; }
      const k = G.glow(0x7ae8ff, 1.1, 0); k.position.set(0, .6, 0); g.add(k); o.k = k; glints.push(k);
    });
    // empty cells: rocks / moss decor
    for (let c = 0; c < p.cols; c++) for (let r = 0; r < p.rows; r++) if (!p.tiles.some(t => t.c === c && t.r === r)) { const b = G.bevel(CS - .1, .3 + (c * 7 + r * 3) % 3 * .08, CS - .1, M.stoneMoss, X(c), .15, Z(r), .06); v.root.add(b); }
    v.sync = (s, instant) => {
      Object.keys(s.r).forEach(id => { const o = tiles[id], n = s.r[id]; let d = n - o.rotN; if (d < 0) d += 4; if (d) { o.rotTgt -= d * PI / 2; o.rotN = n; } if (instant) o.rotCur = o.rotTgt; });
      Object.keys(s.v).forEach(id => { const o = tiles[id]; o.wheelTgt = s.v[id] ? PI * 1.5 : 0; o.open = !!s.v[id]; if (instant) o.wheelCur = o.wheelTgt; });
      const f = E.flow(p, s); v.fl = f; p.tiles.forEach(t => { tiles[t.id].wetT = f.wet[t.id] ? 1 : 0; }); v.supplied = f.supplied;
    };
    v.fns.push((t, dt) => {
      p.tiles.forEach(tl => {
        const o = tiles[tl.id]; if (!tl.fixed && tl.t !== 'valve') { o.rotCur = tween(o.rotCur, o.rotTgt, dt, 14); o.inner.rotation.y = o.rotCur; }
        o.wet = tween(o.wet, o.wetT, dt, 5); o.waterMat.opacity = o.wet * (.78 + .12 * Math.sin(t * 5 + tl.c)); o.k.material.opacity = o.wet * .35;
        if (o.wheel) { o.wheelCur = tween(o.wheelCur, o.wheelTgt, dt, 6); o.wheel.rotation.y = o.wheelCur; o.gem.rotation.y = t; o.gem.scale.setScalar(o.open ? 1.25 : .8); o.gem.material.emissiveIntensity = o.open ? 1.6 : .15; o.gem.position.y = 1.25 + (o.open ? .15 : 0); }
        if (o.pool) { o.pool.material.opacity = o.wet * .85; o.spray.material.opacity = o.wet * (.6 + .2 * Math.sin(t * 4)); }
      });
    });
    v.tap = (oid, g) => { const s = g.state(); if (oid in s.r) return { action: { t: 'turn', obj: oid }, select: oid }; if (oid in s.v) return { action: { t: 'valve', obj: oid } }; const tl = p.tiles.find(x => x.id === oid); if (tl && tl.fixed) return { note: 'This stone piece is fixed in place.' }; return null; };
    return v;
  };

  /* ======================= SEARCH ======================= */
  const JAR_COLOR = { red: 0xd0502e, blue: 0x3a86d8, green: 0x38b366 }, JAR_CSS = { red: '#d0502e', blue: '#3a86d8', green: '#38b366' };
  function jarMesh(j) {
    const g = new T.Group(), prof = [[.0, 0], [.55, 0], [.85, .35], [1.0, .9], [.85, 1.5], [.55, 1.85], [.5, 2.0]].map(a => new T.Vector2(a[0] * .9, a[1] * .9));
    const big = j.size === 'small' ? .8 : 1.12, mat = new T.MeshStandardMaterial({ color: JAR_COLOR[j.color] || 0xb4452a, emissive: JAR_COLOR[j.color] || 0xb4452a, emissiveIntensity: .22, roughness: .5, metalness: .08, envMapIntensity: .6 });
    const body = new T.Mesh(new T.LatheGeometry(prof, 26), mat); body.castShadow = body.receiveShadow = true; g.add(body);
    const lid = new T.Group(), lm = new T.Mesh(new T.CylinderGeometry(.5, .45, .22, 18), M.stoneDark); lm.castShadow = true; lid.add(lm); lid.position.y = 1.95; g.add(lid); g.userData.lid = lid;
    const seal = new T.Mesh(new T.TorusGeometry(.48, .06, 6, 20), new T.MeshStandardMaterial({ color: 0xe0cc9a, roughness: 1, emissive: 0x403418 })); seal.rotation.x = PI / 2; seal.position.y = 1.82; g.add(seal); g.userData.seal = seal;
    const dtex = (() => { const c = G.cv(256, 256), x = c.getContext('2d'); G.drawGlyph(x, j.sym, 128, 128, 130, '#fff0c0', '#ffb040'); return G.tex(c); })();
    const dec = new T.Mesh(new T.PlaneGeometry(1.2, 1.2), new T.MeshBasicMaterial({ map: dtex, transparent: true })); dec.position.set(0, 1.0, .95); g.add(dec);
    const dec2 = dec.clone(); dec2.rotation.y = PI; dec2.position.z = -.95; g.add(dec2);
    const gl = G.glow(0xffd36a, 3, 0); gl.position.y = 2.4; g.add(gl); g.userData.gl = gl; g.add(G.hit(j.id, 1.0, 2.3, 1.1)); g.scale.setScalar(big); g.userData.big = big; return g;
  }
  function keyMesh() { const g = new T.Group(), m = M.gold; const ring = new T.Mesh(new T.TorusGeometry(.22, .06, 8, 18), m); ring.position.x = -.45; g.add(ring); const sh = new T.Mesh(new T.BoxGeometry(.9, .09, .09), m); g.add(sh); [.25, .38].forEach(x => { const t = new T.Mesh(new T.BoxGeometry(.08, .22, .08), m); t.position.set(x, -.12, 0); g.add(t); }); const gl = G.glow(0xffd36a, 2.4, .8); g.add(gl); return g; }
  /* the wall relief: pictograms for every rule of the clue (a red cross means "not") and the same words in plain text */
  function reliefTexture(p) {
    const c = G.cv(1024, 384), x = c.getContext('2d'); x.drawImage(G.stoneCanvas(5, '#8a7a5a', .3), 0, 0, 1024, 384); x.strokeStyle = '#2b2012'; x.lineWidth = 8; x.strokeRect(10, 10, 1004, 364);
    const cl = p.clue, items = []; ['sym', 'color', 'size'].forEach(k => { if (cl[k]) items.push({ k, v: cl[k], neg: false }); }); ['notSym', 'notColor', 'notSize'].forEach(k => { if (cl[k]) items.push({ k: k.slice(3).toLowerCase(), v: cl[k], neg: true }); });
    const step = Math.min(150, 940 / Math.max(1, items.length)), x0 = 512 - (items.length - 1) * step / 2;
    items.forEach((it, i) => {
      const cx = x0 + i * step, cy = 100;
      if (it.k === 'sym') G.drawGlyph(x, it.v, cx, cy, 100, '#2b2012');
      else if (it.k === 'color') { x.fillStyle = JAR_CSS[it.v]; x.fillRect(cx - 42, cy - 42, 84, 84); x.strokeStyle = '#2b2012'; x.lineWidth = 5; x.strokeRect(cx - 42, cy - 42, 84, 84); }
      else { x.fillStyle = '#2b2012'; x.beginPath(); x.arc(cx, cy + (it.v === 'small' ? 16 : 0), it.v === 'small' ? 20 : 42, 0, 7); x.fill(); }
      if (it.neg) { x.strokeStyle = '#c0222e'; x.lineWidth = 11; x.beginPath(); x.moveTo(cx - 48, cy - 48); x.lineTo(cx + 48, cy + 48); x.moveTo(cx + 48, cy - 48); x.lineTo(cx - 48, cy + 48); x.stroke(); }
    });
    x.fillStyle = '#2b2012'; x.font = 'bold 38px Georgia,serif'; x.textAlign = 'center';
    const words = (p.clueText || '').split(' '); const lines = []; let line = ''; words.forEach(w => { if ((line + ' ' + w).length > 46) { lines.push(line); line = w; } else line = (line ? line + ' ' : '') + w; }); if (line) lines.push(line);
    lines.slice(0, 3).forEach((l, i) => x.fillText(l, 512, 232 + i * 50));
    return G.tex(c, null, true);
  }
  S.search = function (ctx, st) {
    const v = newView(ctx), p = st.p, n = p.jars.length, cols = n <= 4 ? 2 : 3, rows = Math.ceil(n / cols), SX = n <= 4 ? 3.6 : 3.3, SZ = 3.9;
    v.base(Math.max(16, cols * SX + 5), 9 + rows * 3); v.focusY = 1.6; v.fitW = cols * SX + 2.2;
    const jars = {}, zOf = r => 1.4 - r * SZ + (rows - 1) * SZ * .35;
    for (let r = 0; r < rows; r++) { const inRow = Math.min(cols, n - r * cols); v.root.add(G.bevel(inRow * SX + .8, .5, 2.6, M.stoneDark, 0, .8 - 0, zOf(r), .06)); }
    p.jars.forEach((j, i) => { const r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, n - r * cols), g = jarMesh(j); g.position.set((c - (inRow - 1) / 2) * SX, 1.05, zOf(r)); v.add(j.id, g, 'Jar'); jars[j.id] = { g, open: 0, openT: 0, seen: false }; });
    const zBack = zOf(rows - 1) - 2.6, wall = new T.Mesh(new T.BoxGeometry(6.6, 2.5, .3), [M.stone, M.stone, M.stone, M.stone, new T.MeshStandardMaterial({ map: reliefTexture(p), roughness: .9, emissive: 0x2a2010, emissiveIntensity: .5 }), M.stone]);
    wall.position.set(-1.5, 4.4, zBack); wall.castShadow = true; v.add('clue', wall, 'Wall relief'); wall.add(G.hit('clue', 3.4, 1, 0)); wall.children[0].rotation.x = PI / 2;
    const clueGlow = G.glow(0xffc766, 9, .08); clueGlow.position.set(-1.5, 4.4, zBack + .6); v.root.add(clueGlow);
    // the vault door the key opens (part of this view, so it works in any room)
    const door = new T.Group(), slab = G.bevel(2.3, 4.2, .6, M.stoneWarm, 0, 0, 0, .08); door.add(slab); const kh = new T.Mesh(new T.TorusGeometry(.3, .08, 8, 18), M.gold); kh.position.set(0, .1, .36); door.add(kh); const kh2 = new T.Mesh(new T.BoxGeometry(.1, .34, .06), M.gold); kh2.position.set(0, -.2, .36); door.add(kh2);
    const dglow = G.glow(0xffd36a, 4, 0); dglow.position.set(0, .1, .6); door.add(dglow); const behind = new T.Mesh(new T.PlaneGeometry(2.3, 4.2), new T.MeshBasicMaterial({ color: 0xffd9a0 })); behind.position.set(0, 2.2, zBack - .15); behind.visible = false; v.root.add(behind);
    door.position.set(3.3, 2.2, zBack + .1); door.add(G.hit('door', 1.4, 4.2, 0)); v.add('door', door, 'Vault door'); let doorK = 0, doorT = 0;
    const key = keyMesh(); key.position.set(0, -5, 0); v.root.add(key); let keyT = 0, keyMode = 0;
    v.clueText = p.clueText;
    v.setDone = f => { doorT = f ? 1 : 0; v.aura.visible = f; };
    v.sync = (s, instant) => { v.hasKey = !!s.key; p.jars.forEach(j => { const o = jars[j.id]; o.openT = s.opened.includes(j.id) ? 1 : 0; o.isKey = j.id === p.keyIn; o.seen = !!s.seen[j.id]; if (instant) o.open = o.openT; o.g.userData.seal.visible = !o.openT; }); v.st = s; v.key = s.key; v.door = s.door; };
    v.fns.push((t, dt) => {
      p.jars.forEach(j => { const o = jars[j.id], u = o.g.userData; if (o.openT > o.open + .001 && o.open === 0 && o.isKey) { keyMode = 1; keyT = 0; const wp = o.g.getWorldPosition(new T.Vector3()); ctx.fx.burst(wp.x, 2.6, wp.z, 30, 0xffd36a, 4); } o.open = tween(o.open, o.openT, dt, 4); u.lid.position.set(o.open * 1.1, 1.95 + o.open * .5, 0); u.lid.rotation.z = -o.open * .9; u.gl.material.opacity = o.isKey && o.open > .4 ? .9 : (o.seen ? .12 + .06 * Math.sin(t * 3) : 0); });
      doorK = tween(doorK, doorT, dt, 2.2); door.position.y = 2.2 - doorK * 4.3; behind.visible = doorK > .02; dglow.material.opacity = tween(dglow.material.opacity, v.hasKey && !doorT ? .55 + .25 * Math.sin(t * 4) : 0, dt, 6);
      const kj = jars[p.keyIn]; if (keyMode === 1) { keyT += dt; key.position.set(kj.g.position.x, 2.4 + Math.sin(keyT * 3) * .15 + Math.min(1, keyT) * .6, kj.g.position.z); key.rotation.y = t * 2; if (v.door) keyMode = 2; }
      else if (keyMode === 2) { key.visible = false; }
    });
    v.tap = (oid, g) => { const s = g.state(); if (oid === 'clue') return { inspect: { t: 'inspect', obj: 'clue', free: true } }; if (jars[oid]) return { inspect: { t: 'inspect', obj: oid, free: true }, card: { oid, open: { t: 'open', obj: oid }, done: s.opened.includes(oid) } }; if (oid === 'door') return { action: { t: 'unlock', obj: 'door' } }; return null; };
    return v;
  };

  /* ======================= BRIDGE ======================= */
  S.bridge = function (ctx, st) {
    const v = newView(ctx), p = st.p; v.focusY = .5; v.fitW = 30;
    [-12.5, 12.5].forEach(x => { v.root.add(G.bevel(9, 12, 11, M.stoneMoss, x, -6, 0, .12)); v.root.add(G.bevel(9.3, .5, 11.3, M.stoneWarm, x, -.1, 0, .1)); });
    // platform A (plate lifts it) and B (rail wheel lifts it)
    const plat = (id, x, w) => { const g = new T.Group(); g.add(G.bevel(w, .7, 5, M.stoneWarm, 0, 0, 0, .07)); const rune = new T.Mesh(new T.PlaneGeometry(w * .5, 1.5), new T.MeshBasicMaterial({ color: 0xffc766, transparent: true, opacity: .0, blending: T.AdditiveBlending })); rune.rotation.x = -PI / 2; rune.position.y = .37; g.add(rune); g.userData.rune = rune; g.position.set(x, -3.4, 0); v.add(id, g, 'Platform'); return g; };
    const A = plat('platform_a', -6, 4.2), B = plat('platform_b', 6, 4.2);
    // bridge: rolls about its long axis; deck-up when b = 2
    const bridge = new T.Group(); bridge.position.set(0, -.02, 0);
    const deck = new T.Group(); for (let i = 0; i < 16; i++) { const pl = G.box(.44, .2, 2.4, M.wood, -3.5 + i * .47 + .24, .15, 0); pl.rotation.y = (i % 3 - 1) * .01; deck.add(pl); }
    deck.add(G.box(8, .22, .22, M.stoneDark, 0, -.1, -1.2), G.box(8, .22, .22, M.stoneDark, 0, -.1, 1.2)); const strip = new T.Mesh(new T.PlaneGeometry(7.4, .24), new T.MeshBasicMaterial({ color: 0xffc766, transparent: true, opacity: .0, blending: T.AdditiveBlending })); strip.rotation.x = -PI / 2; strip.position.y = .27; deck.add(strip);
    [-1.25, 1.25].forEach(z => { for (let i = 0; i <= 4; i++) { const post = G.box(.14, .9, .14, M.bronze, -3.6 + i * 1.8, .65, z); deck.add(post); } const rp = new T.Mesh(new T.CylinderGeometry(.05, .05, 8, 6), M.rope); rp.rotation.z = PI / 2; rp.position.set(0, 1.0, z); deck.add(rp); });
    const under = G.box(8, .5, 2.6, M.stone, 0, -.35, 0); deck.add(under); bridge.add(deck); bridge.add(G.hit('bridge', 4.4, 2.2, 0).rotateZ(PI / 2)); G.tagAll(bridge, 'lever'); v.root.add(bridge);
    const pivotL = G.cyl(.4, .4, 2.4, M.gold, -4.3, -.2, 0, 14); pivotL.rotation.x = PI / 2; v.root.add(pivotL); const pivotR = pivotL.clone(); pivotR.position.x = 4.3; v.root.add(pivotR);
    // lever (turns the bridge), plate (extends A), wheel (raises B)
    const lever = new T.Group(); lever.add(G.bevel(1.6, .5, 1.4, M.stoneDark, 0, .25, 0, .05)); const arm = new T.Group(); const rod = G.cyl(.07, .07, 1.7, M.bronze, 0, .85, 0, 8); arm.add(rod); const knob = new T.Mesh(new T.SphereGeometry(.2, 12, 10), M.gold); knob.position.y = 1.75; arm.add(knob); arm.position.y = .5; lever.add(arm); lever.position.set(0, 0, 4.4); lever.add(G.hit('lever', 1.2, 2.4, 1.1)); v.add('lever', lever, 'Lever');
    const plate = makePlate(1.2); plate.position.set(-9.4, .0, 3.2); v.add('plate', plate, 'Pressure plate'); plate.add(G.hit('plate', 1.4, 1, .4));
    const wheel = new T.Group(); wheel.add(G.cyl(.55, .7, .9, M.stoneDark, 0, .45, 0, 12)); const wr = new T.Group(); const tor = new T.Mesh(new T.TorusGeometry(.75, .1, 8, 24), M.bronze); tor.rotation.x = PI / 2; wr.add(tor); for (let i = 0; i < 4; i++) { const sp = new T.Mesh(new T.BoxGeometry(1.5, .1, .1), M.bronze); sp.rotation.y = i * PI / 4; wr.add(sp); } wr.position.y = 1.05; wheel.add(wr); wheel.position.set(9.4, 0, 3.2); wheel.add(G.hit('rail', 1.3, 1.6, .7)); v.add('rail', wheel, 'Rail wheel');
    // runner who crosses at the end
    const run = new T.Group(); run.add(G.cyl(.28, .34, .9, new T.MeshStandardMaterial({ color: 0x2a6f8f, roughness: .7 }), 0, .6, 0, 10)); const hd = new T.Mesh(new T.SphereGeometry(.26, 14, 12), new T.MeshStandardMaterial({ color: 0xe0b48a, roughness: .7 })); hd.position.y = 1.3; run.add(hd); const hat = G.cyl(.4, .4, .06, new T.MeshStandardMaterial({ color: 0x8a5a2a }), 0, 1.5, 0, 14); run.add(hat); const cap = G.cyl(.2, .26, .22, new T.MeshStandardMaterial({ color: 0x8a5a2a }), 0, 1.6, 0, 12); run.add(cap); const bp = G.box(.4, .55, .25, new T.MeshStandardMaterial({ color: 0x7a3f1d }), 0, .75, -.3); run.add(bp); run.position.set(-14, 0, 0); v.root.add(run);
    let bridgeAng = -PI, tgtAng = -PI, aT = -3.4, bT = -3.4, leverT = 0, leverC = 0, plateF = 0, walk = -1, wheelAng = 0, wheelT = 0; let s0 = null;
    const door = ctx.exitDoor;
    v.sync = (s, instant) => { tgtAng = (s.b - 2) * PI / 2; const prev = s0; s0 = s; aT = s.p ? -.35 : -3.4; bT = s.q ? -.35 : -3.4; plateF = s.p ? 1 : 0; wheelT = s.q ? PI * 1.5 : 0; leverT = s.b; if (instant) { bridgeAng = tgtAng; A.position.y = aT; B.position.y = bT; wheelAng = wheelT; } v.st = s; v.path = E.bridgePath(s); };
    v.fns.push((t, dt) => {
      bridgeAng = tween(bridgeAng, tgtAng, dt, 4); bridge.rotation.x = bridgeAng; A.position.y = tween(A.position.y, aT, dt, 3); B.position.y = tween(B.position.y, bT, dt, 3);
      plate.userData.set && plate.userData.set(tween(plateF, plateF, dt, 1)); arm.rotation.z = tween(arm.rotation.z, -Math.sin((v.st ? v.st.b : 0) * PI / 2) * .8 + (v.st && v.st.b === 2 ? .5 : 0), dt, 8);
      wheelAng = tween(wheelAng, wheelT, dt, 4); wr.rotation.y = wheelAng; plate.position.y = tween(plate.position.y, v.st && v.st.p ? -.08 : 0, dt, 8);
      const ok = v.st && v.st.p && v.st.q && v.st.b === 2; A.userData.rune.material.opacity = v.st && v.st.p ? .5 + .2 * Math.sin(t * 3) : 0; B.userData.rune.material.opacity = v.st && v.st.q ? .5 + .2 * Math.sin(t * 3) : 0; strip.material.opacity = ok ? .8 : 0;
      if (walk >= 0) { walk += dt; const k = Math.min(1, walk / 4.2); run.position.x = -14 + 30 * k; run.position.y = 0; const x = run.position.x; run.position.y = (x > -9 && x < 9 ? .02 : 0) + Math.abs(Math.sin(walk * 9)) * .12; run.rotation.y = 0; if (k >= 1 && walk < 99) { walk = 100; ctx.onWalkEnd && ctx.onWalkEnd(); } }
    });
    v.finale = () => { walk = 0; }; v.walkDuration = 4.5;
    v.tap = oid => oid === 'lever' || oid === 'bridge' ? { action: { t: 'lever', obj: 'lever' } } : oid === 'plate' ? { action: { t: 'plate', obj: 'plate' } } : oid === 'rail' ? { action: { t: 'rail', obj: 'rail' } } : (oid === 'platform_a' || oid === 'platform_b') ? { note: oid === 'platform_a' ? 'Platform A rises when the pressure plate is pressed.' : 'Platform B rises when its rail wheel is turned.' } : null;
    return v;
  };

  /* ======================= TRAP ======================= */
  S.trap = function (ctx, st) {
    const v = newView(ctx), p = st.p, NSW = p.switches.length, SPX = NSW > 4 ? 3.3 : 4.2; v.base(Math.max(16, NSW * SPX + 4), 11); v.focusY = 1; v.fitW = Math.max(16, NSW * SPX + 4);
    // pit with spikes in front of the exit
    const pit = G.box(14, .3, 3.2, M.dark, 0, -.05, -2.4, false); pit.position.y = .02; v.root.add(pit);
    const spikes = new T.Group(); const sg = new T.ConeGeometry(.16, 1.2, 6), sm = new T.MeshStandardMaterial({ color: 0xaab0b8, metalness: .8, roughness: .35, envMapIntensity: 1 });
    for (let i = 0; i < 14; i++) for (let j = 0; j < 4; j++) { const c = new T.Mesh(sg, sm); c.position.set(-6.5 + i * 1, .6, -3.6 + j * .8); c.castShadow = true; spikes.add(c); } spikes.position.y = -1.3; v.root.add(spikes);
    const flash = new T.Mesh(new T.PlaneGeometry(40, 30), new T.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: 0, depthWrite: false, depthTest: false })); flash.renderOrder = 999; flash.visible = false;
    const sw = {}; p.switches.forEach((w, i) => {
      const g = new T.Group(), x = (i - (NSW - 1) / 2) * SPX; g.add(G.cyl(1.1, 1.3, .8, M.stoneDark, 0, .4, 0, 18));
      const btn = new T.Group(), top = G.cyl(.78, .82, .22, new T.MeshStandardMaterial({ color: 0x8a6a2e, metalness: .85, roughness: .45 - w.wear * .1, envMapIntensity: 1 + w.wear * .35 }), 0, 0, 0, 24); btn.add(top);
      const dec = new T.Mesh(new T.PlaneGeometry(1.1, 1.1), new T.MeshBasicMaterial({ map: (() => { const c = G.cv(256, 256), q = c.getContext('2d'); G.drawGlyph(q, w.sym, 128, 128, 120, '#fff3c8', '#ffb040'); return G.tex(c); })(), transparent: true, opacity: .75 })); dec.rotation.x = -PI / 2; dec.position.y = .13; btn.add(dec); btn.position.y = .92; g.add(btn);
      for (let k = 0; k < Math.min(w.wear * 3, 14); k++) { const sc = new T.Mesh(new T.CircleGeometry(.14, 10), new T.MeshBasicMaterial({ color: 0x120c06, transparent: true, opacity: .5 })); sc.scale.set(1, 1.6, 1); sc.rotation.x = -PI / 2; sc.position.set(-.5 + k * .3, .86 - k * 0.0, 1.4 + (k % 2) * .25); g.add(sc); }   // scuffs: more wear = more footprints leading to it
      const gl = G.glow(0xffd36a, 2.8, Math.min(.5, w.wear * .08)); gl.position.y = 1.4; g.add(gl); g.position.set(x, 0, 2.4); g.add(G.hit(w.id, 1.4, 1.6, .8)); v.add(w.id, g, 'Switch'); sw[w.id] = { g, btn, gl, down: 0, wear: w.wear, lit: 0 };
    });
    // mural: three carved panels explain the idea (dust, travellers, sealing)
    const lampG = p.switches.map((_, i) => { const l = new T.Mesh(new T.SphereGeometry(.22, 14, 10), new T.MeshStandardMaterial({ color: 0x3a3a3a, emissive: 0xffb040, emissiveIntensity: 0, roughness: .5 })); l.position.set((i - (NSW - 1) / 2) * 1.1, 6.3, -5.6); v.root.add(l); return l; });
    let step = 0, spike = 0, spikeT = 0, trapAt = -1;
    v.clueText = p.clueText;
    v.sync = (s, instant) => { step = s.step; v.step = step; if (instant) { /* nothing */ } };
    v.trigger = () => { spikeT = 1; trapAt = 0; };
    v.fns.push((t, dt) => {
      spike = tween(spike, spikeT, dt, spikeT ? 22 : 3); spikes.position.y = -1.3 + spike * 1.25; if (trapAt >= 0) { trapAt += dt; if (trapAt > .9) { spikeT = 0; trapAt = -1; } }
      p.switches.forEach(w => { const o = sw[w.id], idx = p.order.indexOf(w.id), pressed = idx >= 0 && idx < step; o.down = tween(o.down, pressed ? 1 : 0, dt, 12); o.btn.position.y = .92 - o.down * .16; o.gl.material.opacity = pressed ? .9 : Math.min(.5, w.wear * .08) + .04 * Math.sin(t * 2 + w.wear); });
      lampG.forEach((l, i) => { l.material.emissiveIntensity = tween(l.material.emissiveIntensity, i < step ? 2.2 : 0, dt, 6); });
    });
    v.tap = (oid, g) => p.switches.some(w => w.id === oid) ? { inspect: { t: 'inspect', obj: oid, free: true }, card: { oid, open: { t: 'press', obj: oid }, label: 'Press switch' } } : null;
    return v;
  };

  /* ======================= GEAR ======================= */
  function gearMesh(n, R, mat, phase) {
    const sh = new T.Shape(), tooth = PI * 2 / n, a0 = phase || 0;
    for (let i = 0; i < n; i++) { const a = a0 + i * tooth, pts = [[R * .9, a - tooth * .32], [R * 1.1, a - tooth * .17], [R * 1.1, a + tooth * .17], [R * .9, a + tooth * .32]]; pts.forEach((q, k) => { const x = Math.cos(q[1]) * q[0], y = Math.sin(q[1]) * q[0]; if (!i && !k) sh.moveTo(x, y); else sh.lineTo(x, y); }); }
    sh.closePath(); const hole = new T.Path(); hole.absarc(0, 0, R * .22, 0, PI * 2, true); sh.holes.push(hole);
    const g = new T.ExtrudeGeometry(sh, { depth: .5, bevelEnabled: true, bevelThickness: .06, bevelSize: .06, bevelSegments: 2, curveSegments: 12 }); g.rotateX(-PI / 2);
    const m = new T.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m;
  }
  S.gear = function (ctx, st) {
    const v = newView(ctx), p = st.p; v.base(12 + Math.max(p.na, p.nb) * .6, 9 + Math.max(p.na, p.nb) * .2); v.focusY = .4; v.fitW = (p.na + p.nb) * .2 * 2 + 5;
    const u = .2, RA = p.na * u, RB = p.nb * u, ax = -RB * .55, bx = ax + RA + RB;
    const gb = new T.MeshStandardMaterial({ color: 0x6e4a24, metalness: .7, roughness: .55, envMapIntensity: .45 }), gg = new T.MeshStandardMaterial({ color: 0xb98a2e, metalness: .75, roughness: .45, envMapIntensity: .5 }), plate = new T.MeshStandardMaterial({ color: 0x2c2820, metalness: .5, roughness: .6, envMapIntensity: .3 });
    v.root.add(G.bevel(RA * 2 + RB * 2 + 2, .3, RA * 2 + 1.6, plate, (ax + bx) / 2 + 0, .15, 0, .05));
    const gA = new T.Group(), gB = new T.Group(); gA.position.set(ax, .35, 0); gB.position.set(bx, .35, 0);
    gA.add(gearMesh(p.na, RA, gb, 0)); gB.add(gearMesh(p.nb, RB, gg, PI / p.nb));
    [gA, gB].forEach((g, i) => { const hub = G.cyl(.35, .35, .8, M.gold, 0, .35, 0, 14); g.add(hub); const mk = new T.Mesh(new T.ConeGeometry(.2, .5, 3), new T.MeshBasicMaterial({ color: 0xffe28a })); mk.rotation.x = PI / 2; mk.position.set(0, .56, -(i ? RB : RA) * .72); mk.rotation.z = PI; g.add(mk); const notch = new T.Mesh(new T.BoxGeometry(.12, .06, (i ? RB : RA) * .5), new T.MeshBasicMaterial({ color: 0xffe28a })); notch.position.set(0, .56, -(i ? RB : RA) * .45); g.add(notch); const ring = new T.Mesh(new T.RingGeometry((i ? RB : RA) * 1.18, (i ? RB : RA) * 1.28, 48), new T.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: .0, blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false })); ring.rotation.x = -PI / 2; ring.position.y = .05; g.userData.ring = ring; g.add(ring); });
    v.add('gear_a', gA, 'Large gear'); v.add('gear_b', gB, 'Small gear'); gA.add(G.hit('gear_a', RA * 1.1, 1.4, .6)); gB.add(G.hit('gear_b', RB * 1.1, 1.4, .6));
    const pt = (x, R, id) => { const m = new T.Mesh(new T.ConeGeometry(.28, .7, 3), new T.MeshStandardMaterial({ color: 0xffe28a, emissive: 0xffa927, emissiveIntensity: .8 })); m.rotation.set(PI / 2, 0, 0); m.position.set(x, .6, -R * 1.45); v.root.add(m); const l = G.glow(0xffc766, 1.8, .8); l.position.set(x, .8, -R * 1.45); v.root.add(l); };
    pt(ax, RA, 'a'); pt(bx, RB, 'b');
    let aC = 0, aT = 0, bC = 0, bT = 0, ok = 0, okT = 0;
    v.sync = (s, instant) => { aT = s.a * (PI * 2 / p.na); bT = s.b * (PI * 2 / p.nb); okT = (s.a === 0 ? 1 : 0) + (s.b === 0 ? 2 : 0); if (instant) { aC = aT; bC = bT; } v.st = s; };
    v.fns.push((t, dt) => {
      let da = aT - aC, db = bT - bC; aC += da * Math.min(1, dt * 9); bC += db * Math.min(1, dt * 9); gA.rotation.y = -aC; gB.rotation.y = -bC;
      gA.userData.ring.material.opacity = tween(gA.userData.ring.material.opacity, v.st && v.st.a === 0 ? .85 : 0, dt, 6); gB.userData.ring.material.opacity = tween(gB.userData.ring.material.opacity, v.st && v.st.b === 0 ? .85 : 0, dt, 6);
    });
    v.tap = oid => oid === 'gear_a' || oid === 'gear_b' ? { action: { t: 'gear', obj: oid, d: 1 }, select: oid } : null;
    v.rotate = (oid, d) => oid === 'gear_a' || oid === 'gear_b' ? { t: 'gear', obj: oid, d } : null;
    return v;
  };
})();
