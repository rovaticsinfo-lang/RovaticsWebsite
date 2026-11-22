/* PARALLAX 3D puzzle views. Each view builds real 3D objects for one puzzle family, mirrors the engine state onto them
   (animated), and reports which object was tapped. The rules themselves live in logic.js, never here. */
import * as THREE from 'three';
import { BaseView, label, planeLabel, cyl, box, sphere, ease } from './gfx.js';
import { RULES, tileOpen, pipeFlow, beamTrace, logicEval, echoDoorOpen, echoPos, DR, DC } from './logic.js';

const BALL_COLORS = ['#ff5a5a', '#4fb0ff', '#ffd24a'], ID_COLORS = ['#ff7a45', '#58e0ff', '#c58bff'];
const lerp = (a, b, k) => a + (b - a) * k;
const angDiff = (a, b, m) => ((b - a + m * 1.5) % m + m) % m - m / 2;   // shortest signed step on a circle of m positions

/* ═════════ SEQ ═════════ */
class SeqView extends BaseView {
  constructor(s, M, ctx) {
    super(M, ctx); this.s = s; const n = s.n, sp = 1.55, W = (n - 1) * sp; this.radius = Math.max(5, W * 0.62 + 2); this.pillars = []; this.flash = null; this.fails = s.fails || 0;
    const base = box(W + 3, 0.35, 5, M.stone); base.position.y = -0.175; this.group.add(base);
    const trim = box(W + 3.2, 0.06, 5.2, M.glow(M.W.accent, 0.8)); trim.position.y = 0.02; this.group.add(trim);
    s.attrs.forEach((a, i) => {
      const g = new THREE.Group(); g.position.set(-W / 2 + i * sp, 0, 0); const col = new THREE.Color().setHSL(a.hue / n * 0.82, 0.72, 0.56), h = 0.7 + a.h * 0.42;
      const foot = cyl(0.62, 0.7, 0.28, M.dark); foot.position.y = 0.14; g.add(foot);
      const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.06, roughness: 0.35, metalness: 0.35 });
      const shaft = cyl(0.36, 0.44, h, mat); shaft.position.y = 0.28 + h / 2; g.add(shaft);
      const cap = sphere(0.34, mat); cap.position.y = 0.28 + h + 0.2; g.add(cap);
      for (let r = 0; r < a.rings; r++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.05, 8, 24), M.metal); ring.rotation.x = Math.PI / 2; ring.position.y = 0.5 + r * 0.2; g.add(ring); }
      if (s.rule === 'hue') { const tg = label(String(a.hue + 1), 0.42, { w: 128, h: 96, size: 56, color: '#ffffff', bg: 'rgba(0,0,0,0.55)' }); tg.position.set(0, 0.28 + h + 0.95, 0); g.add(tg); }
      shaft.userData.mat = mat; this.reg(shaft, { k: 'tap', i }); this.reg(cap, { k: 'tap', i }); this.reg(foot, { k: 'tap', i });
      this.group.add(g); this.pillars.push({ g, mat, cap, h, col });
    });
    const txt = s.rule === 'memory' ? 'REPEAT THE BELL\'S SEQUENCE · tap the bell to hear it' : 'WAKE THE PILLARS ' + RULES[s.rule].toUpperCase();
    const pl = planeLabel(txt, Math.min(W + 2, 9), { w: 1024, h: 160, size: 58, color: '#ffe6a8', bg: 'rgba(20,16,10,0.85)', border: M.W.accent }); pl.rotation.x = -0.9; pl.position.set(0, 0.55, 1.9); this.group.add(pl);
    if (s.rule === 'memory') {
      const bell = new THREE.Group(); const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.75, 0.9, 28, 1, true), M.metal); b1.position.y = 0.95; const b2 = sphere(0.2, M.glow('#ffd27a', 1.2)); b2.position.y = 0.5;
      const top = sphere(0.14, M.metal); top.position.y = 1.45; bell.add(b1, b2, top); bell.position.set(0, 0, -1.9); this.group.add(bell); this.bell = bell;
      [b1, b2, top].forEach(o => { o.userData.bell = true; this.pick.push(o); });
      const stand = cyl(0.5, 0.7, 0.3, M.dark); stand.position.set(0, 0.15, -1.9); this.group.add(stand);
    }
    this.sync(s);
  }
  handlePick(ud) { if (ud.bell) { this.playSequence(); return null; } return ud.mv || null; }
  playSequence() { this.flash = { i: 0, t: 0 }; this.ctx.audio.tap(); }
  sync(s) {
    this.s = s; this.pillars.forEach((p, i) => { p.on = s.prog.includes(i); });
    if ((s.fails || 0) > this.fails) { this.shake = 0.5; this.ctx.audio.error(); } this.fails = s.fails || 0;
  }
  tick(t, dt) {
    if (this.bell) this.bell.rotation.z = Math.sin(this.time * 2) * 0.03 + (this.flash ? Math.sin(this.time * 30) * 0.08 : 0);
    if (this.flash) { this.flash.t += dt; const step = 0.7, i = Math.floor(this.flash.t / step); if (i !== this.flash.cur) { this.flash.cur = i; if (i < this.s.target.length) { this.ctx.audio.note(this.s.target[i]); } } if (i >= this.s.target.length) this.flash = null; }
    this.pillars.forEach((p, i) => {
      let lvl = p.on ? 1.3 : 0.06;
      if (this.flash && this.flash.cur !== undefined && this.s.target[this.flash.cur] === i && (this.flash.t % 0.7) < 0.5) lvl = 2.2;
      if (this.shake > 0 && !p.on) { lvl = 0; p.mat.emissive.set('#ff2a2a'); p.mat.emissiveIntensity = 0.9 * this.shake * 2; } else { p.mat.emissive.copy(p.col); p.mat.emissiveIntensity = lerp(p.mat.emissiveIntensity, lvl, Math.min(1, dt * 10)); }
      p.cap.position.y = 0.48 + p.h + (p.on ? 0.15 + Math.sin(this.time * 3 + i) * 0.05 : 0); p.g.position.x += (this.shake > 0 ? Math.sin(this.time * 60) * 0.004 : 0);
    });
    if (this.shake > 0) this.shake -= dt;
  }
}

/* ═════════ PIPES ═════════ */
class PipesView extends BaseView {
  constructor(s, M, ctx) {
    super(M, ctx); this.s = s; const T = 1.45, R = s.R, C = s.C; this.T = T; this.radius = Math.max(R, C) * T * 0.75 + 3; this.tiles = [];
    const slab = box(C * T + 0.6, 0.3, R * T + 0.6, M.rim); slab.position.y = -0.15; this.group.add(slab);
    const x0 = -(C - 1) * T / 2, z0 = -(R - 1) * T / 2; this.x0 = x0; this.z0 = z0;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const t = s.tiles[r][c], g = new THREE.Group(); g.position.set(x0 + c * T, 0, z0 + r * T);
      const base = box(T - 0.1, 0.22, T - 0.1, t.lock ? M.metal : M.stone); base.position.y = 0.05; g.add(base);
      const inner = new THREE.Group(); const mat = new THREE.MeshStandardMaterial({ color: '#3a4250', emissive: '#000', roughness: 0.35, metalness: 0.5 });
      const hub = cyl(0.2, 0.2, 0.2, mat, 16); hub.position.y = 0.24; inner.add(hub);
      const dirs = { S: [0, 2], C: [0, 1], T: [0, 1, 2], X: [0, 1, 2, 3] }[t.ty];
      dirs.forEach(d => { const arm = box(d % 2 ? 0.62 : 0.26, 0.2, d % 2 ? 0.26 : 0.62, mat); arm.position.set(d === 1 ? 0.31 : d === 3 ? -0.31 : 0, 0.24, d === 0 ? -0.31 : d === 2 ? 0.31 : 0); inner.add(arm); });
      g.add(inner); if (t.lock) { const bolt = sphere(0.09, M.glow('#ffd27a', 0.9)); bolt.position.set(0.5, 0.2, 0.5); g.add(bolt); }
      inner.rotation.y = -t.rot * Math.PI / 2; this.group.add(g);
      this.reg(base, { k: 'rot', r, c }); if (t.lock) base.userData.locked = true; inner.children.forEach(o => { o.userData.mv = { k: 'rot', r, c }; this.pick.push(o); });
      this.tiles.push({ r, c, g, inner, mat, ang: -t.rot * Math.PI / 2, rot: t.rot, tgt: -t.rot * Math.PI / 2, base });
    }
    const em = sphere(0.34, M.glow('#fff1b0', 1.6)); em.position.set(x0 - T * 0.85, 0.4, z0 + s.src * T); this.group.add(em); this.emit = em;
    const lead = box(T * 0.5, 0.18, 0.24, M.glow('#fff1b0', 1.2)); lead.position.set(x0 - T * 0.55, 0.3, z0 + s.src * T); this.group.add(lead);
    const gate = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.09, 12, 30), M.glow('#ffcf6b', 0.4)); gate.position.set(x0 + (C - 1) * T + T * 0.8, 0.5, z0 + s.dst * T); gate.rotation.y = Math.PI / 2; this.group.add(gate); this.gate = gate;
    if (s.wrap) { [-1, 1].forEach(k => { const rail = box(C * T, 0.06, 0.06, M.glow(M.W.accent2, 1)); rail.position.set(0, 0.12, k * (R * T / 2 + 0.45)); this.group.add(rail); const l = label('wraps around', 0.4, { w: 256, h: 64, size: 30, color: M.W.accent2 }); l.position.set(0, 0.5, k * (R * T / 2 + 0.7)); this.group.add(l); }); }
    this.sync(s);
  }
  sync(s) {
    this.s = s; this.lit = pipeFlow(s);
    this.tiles.forEach(tl => { const t = s.tiles[tl.r][tl.c]; if (t.rot !== tl.rot) { tl.tgt += -angDiff(tl.rot, t.rot, 4) * Math.PI / 2; tl.rot = t.rot; this.ctx.audio.thunk(); } });
  }
  tick(t, dt) {
    this.tiles.forEach(tl => {
      tl.ang = lerp(tl.ang, tl.tgt, Math.min(1, dt * 14)); tl.inner.rotation.y = tl.ang;
      const on = this.lit.lit.has(tl.r + ',' + tl.c); tl.mat.emissive.set(on ? this.M.W.accent2 : '#000'); tl.mat.emissiveIntensity = lerp(tl.mat.emissiveIntensity, on ? 1.3 + Math.sin(this.time * 5 + tl.c) * 0.25 : 0, Math.min(1, dt * 8));
    });
    this.gate.material.emissiveIntensity = lerp(this.gate.material.emissiveIntensity, this.lit.reached ? 3 : 0.4, Math.min(1, dt * 6)); this.emit.scale.setScalar(1 + Math.sin(this.time * 4) * 0.1);
  }
}

/* ═════════ COUPLED (lights, tuning dials, magnets, pressure) ═════════ */
class CoupledView extends BaseView {
  constructor(s, M, ctx) {
    super(M, ctx); this.s = s; this.items = []; const lights = s.kind === 'lights';
    if (lights) {
      const T = 1.4, R = s.R, C = s.C; this.radius = Math.max(R, C) * T * 0.8 + 3;
      const slab = box(C * T + 0.7, 0.3, R * T + 0.7, M.rim); slab.position.y = -0.15; this.group.add(slab);
      for (let i = 0; i < s.n; i++) {
        const r = Math.floor(i / C), c = i % C, g = new THREE.Group(); g.position.set(-(C - 1) * T / 2 + c * T, 0, -(R - 1) * T / 2 + r * T);
        const ped = cyl(0.52, 0.6, 0.3, M.dark); ped.position.y = 0.15; g.add(ped);
        const mat = new THREE.MeshStandardMaterial({ color: '#6fe8ff', emissive: '#6fe8ff', emissiveIntensity: 0, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.96 });
        const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), mat); cr.scale.y = 1.35; cr.position.y = 0.78; g.add(cr);
        this.reg(ped, { k: 'tap', i }); this.reg(cr, { k: 'tap', i }); this.group.add(g); this.items.push({ g, mat, cr });
      }
    } else {
      const n = s.n, sp = 1.9, W = (n - 1) * sp; this.radius = Math.max(5.5, W * 0.62 + 2.4);
      const slab = box(W + 2.6, 0.3, 4.4, M.rim); slab.position.y = -0.15; this.group.add(slab);
      for (let i = 0; i < n; i++) {
        const g = new THREE.Group(); g.position.set(-W / 2 + i * sp, 0, 0);
        const ped = cyl(0.5, 0.7, 0.9, M.dark); ped.position.y = 0.45; g.add(ped); const face = new THREE.Group(); face.position.y = 1.6; face.rotation.x = -0.35; g.add(face);
        const disc = cyl(0.82, 0.82, 0.18, M.metal, 40); disc.rotation.x = Math.PI / 2; face.add(disc);
        const mark = new THREE.Group(); face.add(mark); const arm = box(0.1, 0.6, 0.12, M.glow('#7af0ff', 1.4)); arm.position.set(0, 0.38, 0.12); mark.add(arm); const knob = sphere(0.14, M.glow('#7af0ff', 1.6)); knob.position.set(0, 0.7, 0.12); mark.add(knob);
        for (let k = 0; k < s.m; k++) { const a = k / s.m * Math.PI * 2, tk = box(0.07, 0.2, 0.08, M.dark); tk.position.set(Math.sin(a) * 0.72, Math.cos(a) * 0.72, 0.1); tk.rotation.z = -a; face.add(tk); }
        const ta = s.target[i] / s.m * Math.PI * 2, tg = sphere(0.13, M.glow('#ffcf6b', 1.8)); tg.position.set(Math.sin(ta) * 0.74, Math.cos(ta) * 0.74, 0.16); face.add(tg);
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshStandardMaterial({ color: '#2a2f3a', emissive: '#4cff9a', emissiveIntensity: 0, roughness: 0.2 })); gem.position.set(0, 1.0, 0.05); face.add(gem);
        const lab = label('', 0.5, { w: 256, h: 64, size: 34 }); lab.visible = false;
        [ped, disc, arm, knob].forEach(o => this.reg(o, { k: 'tap', i })); this.group.add(g);
        this.items.push({ g, mark, val: s.vals[i], ang: s.vals[i] / s.m * Math.PI * 2, tgtAng: s.vals[i] / s.m * Math.PI * 2, gem, matchLast: false, armMat: arm.material, knobMat: knob.material });
      }
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && s.eff[i][j] !== 0) {
        const a = new THREE.Vector3(-W / 2 + i * sp, 0.45, 1.1), b = new THREE.Vector3(-W / 2 + j * sp, 0.45, 1.1), mid = a.clone().lerp(b, 0.5); mid.y += 0.4 + Math.abs(i - j) * 0.12; mid.z += 0.3 + (i < j ? 0 : 0.35);
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b), neg = s.eff[i][j] > s.m / 2, tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.03, 6), M.glow(neg ? '#ff5ad0' : '#ffd27a', 0.9)); this.group.add(tube);
        const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 8), M.glow(neg ? '#ff5ad0' : '#ffd27a', 1)); arrow.position.copy(curve.getPoint(0.93)); arrow.lookAt(curve.getPoint(1)); arrow.rotateX(Math.PI / 2); this.group.add(arrow);
      }
      const leg = label('gold link: pushes forward · pink link: pushes back', 0.36, { w: 640, h: 64, size: 30, color: '#ffe6a8' }); leg.position.set(0, 0.2, 2.5); this.group.add(leg);
    }
    this.sync(s);
  }
  sync(s, move) {
    this.s = s; if (move) this.ctx.audio.note(s.vals[move.i] || 0, 0.4);
    if (s.kind === 'lights') return;
    this.items.forEach((it, i) => { const d = angDiff(it.val, s.vals[i], s.m); if (d) { it.tgtAng += d * (Math.PI * 2 / s.m); it.val = s.vals[i]; } });
  }
  tick(t, dt) {
    const s = this.s;
    if (s.kind === 'lights') { this.items.forEach((it, i) => { const on = s.vals[i] === s.target[i]; it.mat.emissiveIntensity = lerp(it.mat.emissiveIntensity, on ? 1.9 : 0.04, Math.min(1, dt * 10)); it.mat.color.set(on ? '#9ff3ff' : '#23303a'); it.cr.rotation.y += dt * (on ? 1.4 : 0.2); it.cr.position.y = 0.78 + (on ? Math.sin(this.time * 2 + i) * 0.06 : 0); }); return; }
    this.items.forEach((it, i) => { it.ang = lerp(it.ang, it.tgtAng, Math.min(1, dt * 12)); it.mark.rotation.z = -it.ang; const ok = s.vals[i] === s.target[i]; it.gem.material.emissiveIntensity = lerp(it.gem.material.emissiveIntensity, ok ? 2.2 : 0, Math.min(1, dt * 8)); it.gem.rotation.y += dt; it.armMat.emissive.set(ok ? '#4cff9a' : '#7af0ff'); it.knobMat.emissive.set(ok ? '#4cff9a' : '#7af0ff'); });
  }
}

/* ═════════ TILT ═════════ */
class TiltView extends BaseView {
  constructor(s, M, ctx) {
    super(M, ctx); this.s = s; const T = 1.2, R = s.R, C = s.C; this.T = T; this.radius = Math.max(R, C) * T * 0.8 + 3; this.x0 = -(C - 1) * T / 2; this.z0 = -(R - 1) * T / 2;
    const slab = box(C * T + 0.8, 0.3, R * T + 0.8, M.rim); slab.position.y = -0.15; this.group.add(slab);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const ch = s.g[r][c], p = this.pos(r, c);
      const floor = box(T - 0.06, 0.1, T - 0.06, M.stone); floor.position.set(p.x, 0.02, p.z); this.group.add(floor);
      if (ch === '#') { const w = box(T - 0.04, 0.8, T - 0.04, M.dark); w.position.set(p.x, 0.4, p.z); this.group.add(w); const cap = box(T - 0.2, 0.05, T - 0.2, M.glow(M.W.accent, 0.35)); cap.position.set(p.x, 0.82, p.z); this.group.add(cap); }
      else if (ch === 's') { const pad = cyl(0.42, 0.46, 0.08, M.glow('#4cff9a', 0.6)); pad.position.set(p.x, 0.1, p.z); this.group.add(pad); }
    }
    this.balls = s.balls.map((b, i) => {
      const col = BALL_COLORS[i], p = this.pos(...b), ball = sphere(0.36, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.3, roughness: 0.15, metalness: 0.5 })); ball.position.set(p.x, 0.5, p.z); this.group.add(ball);
      const gp = this.pos(...s.goals[i]), sock = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.07, 10, 30), M.glow(col, 1.1)); sock.rotation.x = Math.PI / 2; sock.position.set(gp.x, 0.12, gp.z); this.group.add(sock);
      const dot = cyl(0.3, 0.3, 0.04, M.glow(col, 0.5)); dot.position.set(gp.x, 0.08, gp.z); this.group.add(dot);
      if (s.balls.length > 1) { const a = label(String(i + 1), 0.42, { w: 96, h: 96, size: 60, color: '#ffffff', bg: 'rgba(0,0,0,0.55)' }), b2 = a.clone(); a.position.set(0, 0.85, 0); ball.add(a); b2.position.set(gp.x, 0.62, gp.z); this.group.add(b2); }
      return { m: ball, from: p.clone(), to: p.clone(), t: 1, col, sock };
    });
    this.sync(s);
  }
  pos(r, c) { return new THREE.Vector3(this.x0 + c * this.T, 0, this.z0 + r * this.T); }
  sync(s, move, prev) {
    this.s = s; if (prev && move) { let moved = false; s.balls.forEach((b, i) => { const o = this.balls[i], np = this.pos(...b); if (Math.abs(o.to.x - np.x) > 0.01 || Math.abs(o.to.z - np.z) > 0.01) { o.from.copy(o.m.position); o.from.y = 0; o.to.copy(np); o.t = 0; o.dur = Math.max(0.18, o.from.distanceTo(np) / 9); moved = true; } }); if (moved) this.ctx.audio.whoosh(); return; }
    s.balls.forEach((b, i) => { const p = this.pos(...b); this.balls[i].to.copy(p); this.balls[i].m.position.set(p.x, 0.5, p.z); this.balls[i].t = 1; });
  }
  actions() { return [{ id: 'u', label: '▲', move: { k: 'tilt', d: 0 }, key: 'ArrowUp' }, { id: 'l', label: '◀', move: { k: 'tilt', d: 3 }, key: 'ArrowLeft' }, { id: 'd', label: '▼', move: { k: 'tilt', d: 2 }, key: 'ArrowDown' }, { id: 'r', label: '▶', move: { k: 'tilt', d: 1 }, key: 'ArrowRight' }]; }
  tick(t, dt) {
    this.balls.forEach((b, i) => { if (b.t < 1) { b.t = Math.min(1, b.t + dt / b.dur); const e = b.t * b.t * (3 - 2 * b.t); b.m.position.set(lerp(b.from.x, b.to.x, e), 0.5, lerp(b.from.z, b.to.z, e)); }
      const docked = this.s.dock[i]; b.m.material.emissiveIntensity = docked ? 1.6 : 0.3; b.sock.material.emissiveIntensity = docked ? 3 : 0.9 + Math.sin(this.time * 3 + i) * 0.3; b.m.scale.setScalar(docked ? 0.85 : 1); });
  }
}

/* ═════════ BEAM ═════════ */
class BeamView extends BaseView {
  constructor(s, M, ctx) {
    super(M, ctx); this.s = s; const T = 1.2, R = s.R, C = s.C; this.T = T; this.radius = Math.max(R, C) * T * 0.8 + 3; this.x0 = -(C - 1) * T / 2; this.z0 = -(R - 1) * T / 2; this.mir = []; this.tg = [];
    const slab = box(C * T + 1.6, 0.3, R * T + 0.8, M.rim); slab.position.set(-0.4, -0.15, 0); this.group.add(slab);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const p = this.pos(r, c), f = box(T - 0.06, 0.08, T - 0.06, M.stone); f.position.set(p.x, 0.02, p.z); this.group.add(f);
      if (s.g[r][c] === '#') { const w = cyl(0.38, 0.5, 1.2, M.dark, 6); w.position.set(p.x, 0.6, p.z); this.group.add(w); }
    }
    const ep = this.pos(s.emit, 0), tow = cyl(0.3, 0.45, 1.0, M.metal); tow.position.set(ep.x - T * 0.95, 0.5, ep.z); this.group.add(tow); const core = sphere(0.26, M.glow('#fff2b0', 2.4)); core.position.set(ep.x - T * 0.95, 1.1, ep.z); this.group.add(core);
    s.mirrors.forEach((m, i) => {
      const p = this.pos(m.r, m.c), g = new THREE.Group(); g.position.set(p.x, 0, p.z);
      const foot = cyl(0.3, 0.36, 0.14, m.fixed ? M.dark : M.metal); foot.position.y = 0.1; g.add(foot);
      const pane = new THREE.Group(); const mat = m.splitter ? new THREE.MeshStandardMaterial({ color: '#9fe8ff', emissive: '#5fd0ff', emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.8 }) : new THREE.MeshStandardMaterial({ color: m.fixed ? '#6a7080' : '#e8f3ff', roughness: 0.05, metalness: 1 });
      const body = box(0.98, 0.8, 0.07, mat); body.position.y = 0.55; pane.add(body); const frame = box(1.02, 0.84, 0.05, m.fixed ? M.dark : M.glow(M.W.accent, 0.8)); frame.position.y = 0.55; frame.position.z = -0.03; pane.add(frame); g.add(pane);
      if (m.fixed) { const lock = sphere(0.09, M.glow('#ff6a6a', 1)); lock.position.set(0, 1.08, 0); g.add(lock); }
      if (m.splitter) { const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), M.glow('#ffffff', 1.4)); gem.position.set(0, 1.12, 0); g.add(gem); }
      pane.rotation.y = m.o === 0 ? Math.PI / 4 : -Math.PI / 4; this.group.add(g);
      if (!m.fixed) { [foot, body, frame].forEach(o => this.reg(o, { k: 'flip', i })); }
      this.mir.push({ pane, o: m.o, ang: pane.rotation.y, tgt: pane.rotation.y });
    });
    s.targets.forEach(([r, c]) => { const p = this.pos(r, c), mat = new THREE.MeshStandardMaterial({ color: '#ff9a4a', emissive: '#ff7a2a', emissiveIntensity: 0.2, roughness: 0.2, metalness: 0.3 }), cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), mat); cr.scale.y = 1.4; cr.position.set(p.x, 0.62, p.z); this.group.add(cr); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 28), M.glow('#ffcf6b', 0.7)); ring.rotation.x = Math.PI / 2; ring.position.set(p.x, 0.1, p.z); this.group.add(ring); this.tg.push({ cr, mat, r, c }); });
    this.beamGroup = new THREE.Group(); this.group.add(this.beamGroup); this.beamMat = new THREE.MeshBasicMaterial({ color: '#fff0b0' }); this.beamGlow = new THREE.MeshBasicMaterial({ color: '#ffb84a', transparent: true, opacity: 0.28, depthWrite: false });
    this.sync(s);
  }
  pos(r, c) { return new THREE.Vector3(this.x0 + c * this.T, 0, this.z0 + r * this.T); }
  sync(s) {
    this.s = s; s.mirrors.forEach((m, i) => { const cur = this.mir[i]; if (cur.o !== m.o) { cur.o = m.o; cur.tgt = m.o === 0 ? Math.PI / 4 : -Math.PI / 4; this.ctx.audio.thunk(); } });
    while (this.beamGroup.children.length) { const o = this.beamGroup.children.pop(); o.geometry.dispose(); }
    const { lit, segs } = beamTrace(s); this.lit = lit;
    for (const [r, c, nr, nc] of segs) {
      const a = this.pos(r, c), b = this.pos(nr, nc); const len = a.distanceTo(b); if (len < 0.01) continue; const horiz = Math.abs(b.x - a.x) > 0.01;
      const m = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : 0.09, 0.09, horiz ? 0.09 : len), this.beamMat), gl = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : 0.3, 0.3, horiz ? 0.3 : len), this.beamGlow);
      const mid = a.clone().lerp(b, 0.5); mid.y = r === nr && c === nc ? 0 : 0.58; m.position.copy(mid); gl.position.copy(mid); this.beamGroup.add(m, gl);
    }
    const prevOk = this.allLit; this.allLit = s.targets.every(t => lit.has(t[0] + ',' + t[1])); if (this.allLit && !prevOk) this.ctx.audio.power();
  }
  tick(t, dt) {
    this.mir.forEach(m => { m.ang = lerp(m.ang, m.tgt, Math.min(1, dt * 12)); m.pane.rotation.y = m.ang; });
    this.tg.forEach((x, i) => { const on = this.lit.has(x.r + ',' + x.c); x.mat.emissiveIntensity = lerp(x.mat.emissiveIntensity, on ? 2.6 : 0.15, Math.min(1, dt * 10)); x.mat.color.set(on ? '#ffe39a' : '#7a4a2a'); x.cr.rotation.y += dt * (on ? 2 : 0.4); });
    this.beamMat.color.setHSL(0.12, 0.9, 0.78 + Math.sin(this.time * 14) * 0.04);
  }
}

/* ═════════ TANKS ═════════ */
class TanksView extends BaseView {
  constructor(s, M, ctx) {
    super(M, ctx); this.s = s; this.sel = null; this.U = 0.42; const n = s.caps.length, sp = 2.9, W = (n - 1) * sp; this.radius = Math.max(6, W * 0.7 + 3.5); this.tanks = [];
    const slab = box(W + 3.6, 0.3, 5.2, M.rim); slab.position.y = -0.15; this.group.add(slab);
    const src = cyl(0.3, 0.3, 4.4, M.metal); src.rotation.z = Math.PI / 2; src.position.set(0, this.U * 14 + 1.4, -1.7); src.scale.y = (W + 3) / 4.4; this.group.add(src);
    s.caps.forEach((cap, i) => {
      const x = -W / 2 + i * sp, h = cap * this.U, g = new THREE.Group(); g.position.set(x, 0, 0);
      const bs = cyl(0.98, 1.05, 0.2, M.dark); bs.position.y = 0.1; g.add(bs);
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, h, 32, 1, true), M.glass); glass.position.y = 0.2 + h / 2; g.add(glass);
      const wmat = new THREE.MeshStandardMaterial({ color: '#4cc8ff', emissive: '#1a78c8', emissiveIntensity: 0.55, roughness: 0.1, transparent: true, opacity: 0.86 });
      const water = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.84, 1, 32), wmat); water.position.y = 0.2; g.add(water);
      for (let k = 1; k < cap; k++) { const tk = box(0.1, 0.02, 0.02, M.dark); tk.position.set(0.9, 0.2 + k * this.U, 0); g.add(tk); }
      const topr = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.05, 8, 32), M.metal); topr.rotation.x = Math.PI / 2; topr.position.y = 0.2 + h; g.add(topr);
      const fill = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), M.glow('#4fd8ff', 1)); fill.position.set(0, 0.2 + h + 0.9, -1.7 + 0.0); const pipe = cyl(0.08, 0.08, 0.9 + (0.2 + h) * 0, M.metal); pipe.position.set(0, 0.2 + h + 0.55, -0.85); pipe.rotation.x = 0.9; g.add(pipe); fill.position.set(0, 0.2 + h + 1.0, -1.5); g.add(fill);
      const fl = label('FILL', 0.5, { w: 192, h: 64, size: 36, color: '#aef0ff' }); fl.position.set(0, 0.2 + h + 1.5, -1.5); g.add(fl);
      const drain = sphere(0.25, M.glow('#ff6a6a', 0.9)); drain.position.set(0, 0.35, 1.25); g.add(drain); const dl = label('DRAIN', 0.5, { w: 192, h: 64, size: 34, color: '#ffb0b0' }); dl.position.set(0, 0.85, 1.25); g.add(dl);
      const txt = label('', 0.5, { w: 256, h: 96 }); txt.position.set(0, 0.2 + h + 2.2, 0); g.add(txt);
      let gm = null; if (s.goal[i] !== null) { gm = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.045, 8, 36), M.glow('#ffcf6b', 1.5)); gm.rotation.x = Math.PI / 2; gm.position.y = 0.2 + s.goal[i] * this.U; g.add(gm); const gl = label('goal ' + s.goal[i], 0.5, { w: 256, h: 64, size: 36, color: '#ffe08a' }); gl.position.set(1.65, 0.2 + s.goal[i] * this.U, 0); g.add(gl); }
      this.group.add(g);
      [glass, bs].forEach(o => { o.userData.tank = i; this.pick.push(o); }); water.userData.tank = i; this.pick.push(water); fill.userData.mv = { k: 'fill', i }; this.pick.push(fill); drain.userData.mv = { k: 'drain', i }; this.pick.push(drain);
      this.tanks.push({ g, water, wmat, h, glass, cur: s.vol[i], txt, bs, gm, cap });
    });
    this.sync(s);
  }
  handlePick(ud) {
    if (ud.mv) { this.sel = null; return ud.mv; }
    if (ud.tank === undefined) return null; const i = ud.tank;
    if (this.sel === null) { this.sel = i; this.ctx.audio.click(); return null; } if (this.sel === i) { this.sel = null; return null; }
    const mv = { k: 'pour', i: this.sel, j: i }; this.sel = null; return mv;
  }
  hlTargets(mv) { if (mv.k === 'pour') return [this.tanks[mv.i].bs, this.tanks[mv.j].bs]; return this.findPick(mv); }
  sync(s, move) { this.s = s; if (move && (move.k === 'pour' || move.k === 'fill')) this.ctx.audio.drop(); }
  tick(t, dt) {
    this.tanks.forEach((tk, i) => {
      tk.cur = lerp(tk.cur, this.s.vol[i], Math.min(1, dt * 5)); const hh = Math.max(0.001, tk.cur * this.U); tk.water.scale.y = hh; tk.water.position.y = 0.2 + hh / 2;
      const ok = this.s.goal[i] !== null && this.s.vol[i] === this.s.goal[i]; tk.wmat.emissive.set(ok ? '#2aff9a' : '#1a78c8'); tk.bs.material.emissive = tk.bs.material.emissive || new THREE.Color(); tk.glass.scale.setScalar(this.sel === i ? 1.04 + Math.sin(this.time * 8) * 0.01 : 1);
      if (!tk.last || tk.last !== this.s.vol[i] + '/' + this.sel) { tk.last = this.s.vol[i] + '/' + this.sel; const l = label(this.s.vol[i] + ' / ' + tk.cap, 0.5, { w: 256, h: 96, size: 52, color: ok ? '#7dffb0' : (this.sel === i ? '#ffe08a' : '#ffffff'), bg: 'rgba(10,20,30,0.7)' }); tk.txt.material.map = l.material.map; tk.txt.material.needsUpdate = true; }
    });
  }
}

/* ═════════ ECHO ═════════ */
function avatar(M, color, ghost) {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: ghost ? 0.9 : 0.5, roughness: 0.25, metalness: 0.4, transparent: ghost, opacity: ghost ? 0.55 : 1 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 6, 14), mat); body.position.y = 0.55; const head = sphere(0.19, ghost ? mat : M.glow('#ffffff', 0.7)); head.position.y = 1.04; g.add(body, head);
  if (!ghost) { const l = sphere(0.07, M.glow('#7af0ff', 2)); l.position.set(0.3, 1.15, 0); g.add(l); g.userData.luma = l; } return g;
}
class EchoView extends BaseView {
  constructor(s, M, ctx) {
    super(M, ctx); this.s = s; const T = 1.2, R = s.R, C = s.C; this.T = T; this.radius = Math.max(R, C) * T * 0.8 + 3; this.x0 = -(C - 1) * T / 2; this.z0 = -(R - 1) * T / 2; this.trail = [];
    const slab = box(C * T + 0.8, 0.3, R * T + 0.8, M.rim); slab.position.y = -0.15; this.group.add(slab);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const p = this.pos(r, c);
      if (s.g[r][c] === '#') { const w = box(T - 0.04, 1.0, T - 0.04, M.dark); w.position.set(p.x, 0.5, p.z); this.group.add(w); const cap = box(T - 0.2, 0.05, T - 0.2, M.glow(M.W.accent, 0.3)); cap.position.set(p.x, 1.02, p.z); this.group.add(cap); }
      else { const f = box(T - 0.06, 0.08, T - 0.06, M.stone); f.position.set(p.x, 0.02, p.z); f.userData.cell = [r, c]; this.pick.push(f); this.group.add(f); }
    }
    this.plates = s.plates.map(pl => { const p = this.pos(pl.r, pl.c), col = ID_COLORS[pl.id % 3], m = cyl(0.4, 0.4, 0.07, M.glow(col, 0.9)); m.position.set(p.x, 0.1, p.z); m.userData.cell = [pl.r, pl.c]; this.pick.push(m); this.group.add(m); if (s.doors.length > 1) { const lb = label('ABC'[pl.id], 0.4, { w: 96, h: 96, size: 60, color: '#ffffff', bg: 'rgba(0,0,0,0.55)' }); lb.position.set(p.x, 0.55, p.z); this.group.add(lb); } const rg = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.04, 8, 30), M.glow(col, 1.4)); rg.rotation.x = Math.PI / 2; rg.position.set(p.x, 0.12, p.z); this.group.add(rg); return { m, id: pl.id }; });
    this.doors = s.doors.map(d => { const p = this.pos(d.r, d.c), col = ID_COLORS[d.id % 3], gm = new THREE.Group(); gm.position.set(p.x, 0, p.z); const bar = box(T - 0.12, 1.0, 0.3, M.glow(col, 0.8)); bar.position.y = 0.5; const frame = box(T, 0.12, 0.4, M.metal); frame.position.y = 1.02; gm.add(bar, frame); if (s.doors.length > 1) { const lb = label('ABC'[d.id], 0.4, { w: 96, h: 96, size: 60, color: '#ffffff', bg: 'rgba(0,0,0,0.55)' }); lb.position.set(0, 1.4, 0); gm.add(lb); } this.group.add(gm); return { gm, id: d.id, y: 0, bar }; });
    const ep = this.pos(...s.exit), portal = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.07, 10, 30), M.glow('#ffffff', 2)); portal.position.set(ep.x, 0.55, ep.z); this.group.add(portal); this.portal = portal;
    const orb = sphere(0.2, M.glow('#ffffff', 2.4)); orb.position.set(ep.x, 0.55, ep.z); this.group.add(orb);
    this.agent = avatar(M, '#ffb347', false); this.ghost = avatar(M, '#7af0ff', true); this.group.add(this.agent, this.ghost);
    this.apos = new THREE.Vector3(); this.gpos = new THREE.Vector3(); this.trailGroup = new THREE.Group(); this.group.add(this.trailGroup); this.sync(s, null, null, true);
  }
  pos(r, c) { return new THREE.Vector3(this.x0 + c * this.T, 0, this.z0 + r * this.T); }
  handlePick(ud) {
    if (!ud.cell) return null; const s = this.s; if (s.phase === 'play' && s.pos[0] === s.exit[0] && s.pos[1] === s.exit[1]) return null;
    const dr = ud.cell[0] - s.pos[0], dc = ud.cell[1] - s.pos[1]; if (dr === 0 && dc === 0) return { k: 'step', d: 4 };
    if (Math.abs(dr) + Math.abs(dc) !== 1) return null; return { k: 'step', d: dr === -1 ? 0 : dc === 1 ? 1 : dr === 1 ? 2 : 3 };
  }
  actions() {
    const a = [{ id: 'u', label: '▲', move: { k: 'step', d: 0 }, key: 'ArrowUp' }, { id: 'l', label: '◀', move: { k: 'step', d: 3 }, key: 'ArrowLeft' }, { id: 'w', label: '⏸', move: { k: 'step', d: 4 }, key: ' ', title: 'Wait one beat' }, { id: 'd', label: '▼', move: { k: 'step', d: 2 }, key: 'ArrowDown' }, { id: 'r', label: '▶', move: { k: 'step', d: 1 }, key: 'ArrowRight' }];
    if (this.s.phase === 'rec') a.push({ id: 'rel', label: 'Release echo', move: { k: 'release' }, key: 'Enter', wide: true }); return a;
  }
  status() { const s = this.s; return s.phase === 'rec' ? `RECORDING  ${s.rec.length}/${s.T} beats — walk a route, then release your echo` : `ECHO PLAYING  beat ${s.tick} — your echo repeats the recording. Reach the exit.`; }
  sync(s, move, prev, first) {
    this.s = s; const p = this.pos(...s.pos); this.apos.copy(p);
    const e = echoPos(s); if (e) { this.gpos.copy(this.pos(...e)); this.ghost.visible = true; } else this.ghost.visible = false;
    if (first) { this.agent.position.copy(p); this.ghost.position.copy(this.gpos); }
    while (this.trailGroup.children.length) { const o = this.trailGroup.children.pop(); o.geometry.dispose(); }
    if (s.phase === 'rec') { let q = s.start.slice(); s.rec.forEach(d => { q = [q[0] + DR[d], q[1] + DC[d]]; const pp = this.pos(...q), dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), this.M.glow('#7af0ff', 1.2)); dot.position.set(pp.x, 0.15, pp.z); this.trailGroup.add(dot); }); }
    if (move && move.k === 'release') this.ctx.audio.power(); else if (move) this.ctx.audio.tap();
  }
  tick(t, dt) {
    const k = Math.min(1, dt * 12); this.agent.position.lerp(new THREE.Vector3(this.apos.x, 0.05 + Math.abs(Math.sin(this.time * 4)) * 0.03, this.apos.z), k); this.ghost.position.lerp(new THREE.Vector3(this.gpos.x, 0.05, this.gpos.z), k);
    if (this.agent.userData.luma) this.agent.userData.luma.position.set(Math.cos(this.time * 2) * 0.32, 1.15 + Math.sin(this.time * 3) * 0.05, Math.sin(this.time * 2) * 0.32);
    this.ghost.rotation.y += dt; this.portal.rotation.y += dt * 2; this.portal.rotation.x = Math.sin(this.time) * 0.4;
    this.plates.forEach(pl => { const held = this.s.plates.some(x => x.id === pl.id && ((x.r === this.s.pos[0] && x.c === this.s.pos[1]) || (this.s.echo && echoPos(this.s) && x.r === echoPos(this.s)[0] && x.c === echoPos(this.s)[1]))); pl.m.material.emissiveIntensity = lerp(pl.m.material.emissiveIntensity, held ? 2.8 : 0.6, Math.min(1, dt * 10)); pl.m.position.y = held ? 0.06 : 0.1; });
    this.doors.forEach(d => { const open = echoDoorOpen(this.s, d.id); d.y = lerp(d.y, open ? -1.05 : 0, Math.min(1, dt * 8)); d.bar.position.y = 0.5 + d.y; });
  }
}

/* ═════════ LOGIC ═════════ */
const OPCOL = { AND: '#ff9a4a', OR: '#5ad0ff', XOR: '#c58bff', NAND: '#ff6a8a', NOT: '#7affb0' };
class LogicView extends BaseView {
  constructor(s, M, ctx) {
    super(M, ctx); this.s = s; const n = s.n, layer = new Array(n + s.gates.length).fill(0);
    s.gates.forEach((g, i) => { layer[n + i] = 1 + Math.max(layer[g.a], g.b === undefined ? 0 : layer[g.b]); }); const L = Math.max(...layer), W = Math.max(8, n * 1.5);
    this.radius = Math.max(7, W * 0.6 + 2); const zOf = l => 3.2 - l * (7.2 / L), cols = {}; layer.forEach((l, i) => { (cols[l] = cols[l] || []).push(i); });
    this.nodes = []; const slab = box(W + 2.6, 0.3, 9.6, M.rim); slab.position.y = -0.15; this.group.add(slab);
    Object.entries(cols).forEach(([l, ids]) => ids.forEach((id, k) => { const x = (k - (ids.length - 1) / 2) * Math.min(2.1, (W - 0.5) / Math.max(1, ids.length - 1 || 1)); this.nodes[id] = new THREE.Vector3(x, 0, zOf(+l)); }));
    this.wires = [];
    const wire = (a, b, on) => { const pa = this.nodes[a].clone(), pb = this.nodes[b].clone(); pa.y = 0.26; pb.y = 0.26; const d = pb.clone().sub(pa), len = d.length(), m = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, len, 8), new THREE.MeshStandardMaterial({ color: '#2a303c', emissive: '#000', roughness: 0.4 })); m.position.copy(pa).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); this.group.add(m); return m; };
    s.gates.forEach((g, i) => { const id = n + i; this.wires.push({ m: wire(g.a, id), src: g.a }); if (g.b !== undefined) this.wires.push({ m: wire(g.b, id), src: g.b }); });
    this.levers = []; for (let i = 0; i < n; i++) {
      const p = this.nodes[i], g = new THREE.Group(); g.position.copy(p); const bs = box(0.9, 0.3, 0.9, M.dark); bs.position.y = 0.15; g.add(bs); const sl = box(0.14, 0.14, 0.7, M.metal); sl.position.y = 0.34; g.add(sl);
      const h = new THREE.Group(); h.position.y = 0.34; const arm = cyl(0.07, 0.07, 0.8, M.metal, 10); arm.position.y = 0.4; const kn = sphere(0.17, new THREE.MeshStandardMaterial({ color: '#888', emissive: '#000', roughness: 0.3 })); kn.position.y = 0.82; h.add(arm, kn); g.add(h);
      const tag = label('S' + (i + 1), 0.4, { w: 128, h: 64, size: 40, color: '#ffe08a' }); tag.position.set(0, 0.05, 0.75); g.add(tag); this.group.add(g);
      [bs, arm, kn, sl].forEach(o => this.reg(o, { k: 'flip', i })); this.levers.push({ h, kn });
    }
    s.gates.forEach((g, i) => { const p = this.nodes[n + i], isOut = s.outs.includes(n + i); if (isOut) return; const b = box(1.15, 0.5, 0.8, new THREE.MeshStandardMaterial({ color: OPCOL[g.op], emissive: OPCOL[g.op], emissiveIntensity: 0.15, roughness: 0.4, metalness: 0.4 })); b.position.set(p.x, 0.25, p.z); this.group.add(b); const l = label(g.op, 0.42, { w: 192, h: 64, size: 40, color: '#10141c' }); l.position.set(p.x, 0.62, p.z); this.group.add(l); this.nodes[n + i].mesh = b; });
    this.lamps = s.outs.map((gid, k) => { const p = this.nodes[gid], g = new THREE.Group(); g.position.set(p.x, 0, p.z); const bs = cyl(0.55, 0.62, 0.25, M.dark); bs.position.y = 0.12; g.add(bs);
      const mat = new THREE.MeshStandardMaterial({ color: '#555', emissive: '#ffd27a', emissiveIntensity: 0, roughness: 0.2, transparent: true, opacity: 0.95 }), bulb = sphere(0.42, mat); bulb.position.y = 0.72; g.add(bulb);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 30), M.glow(s.want[k] ? '#ffd27a' : '#5a6270', 1)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.18; g.add(ring);
      const gl = label(s.want[k] ? 'must be ON' : 'must be OFF', 0.34, { w: 320, h: 64, size: 34, color: s.want[k] ? '#ffe08a' : '#b8c0cc' }); gl.position.set(0, 1.5, 0); g.add(gl);
      const op = label(s.gates[gid - n].op, 0.3, { w: 192, h: 64, size: 34, color: OPCOL[s.gates[gid - n].op] }); op.position.set(0, -0.15 + 0.0, 0.8); g.add(op); this.group.add(g); return { mat, bulb, ring, gid }; });
    (s.links || []).forEach(([a, b]) => { const pa = this.nodes[a], pb = this.nodes[b], mid = pa.clone().lerp(pb, 0.5); mid.y = 1.6 + Math.abs(pa.x - pb.x) * 0.12; const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(pa.clone().setY(1.3), mid, pb.clone().setY(1.3)), 18, 0.03, 6), M.glow('#ff5ad0', 0.9)); this.group.add(tube); });
    if ((s.links || []).length) { const l = label('pink arcs: these switches are linked (A also throws B)', 0.34, { w: 700, h: 64, size: 30, color: '#ffb0e8' }); l.position.set(0, 2.2, 3.4); this.group.add(l); }
    this.sync(s);
  }
  sync(s, move) { this.s = s; this.vals = logicEval(s); if (move) this.ctx.audio.thunk(); }
  tick(t, dt) {
    const v = this.vals, k = Math.min(1, dt * 10);
    this.levers.forEach((lv, i) => { const on = !!this.s.vals[i]; lv.h.rotation.x = lerp(lv.h.rotation.x, on ? -0.7 : 0.7, k); lv.kn.material.emissive.set(on ? '#7af0ff' : '#000'); lv.kn.material.emissiveIntensity = on ? 1.6 : 0; lv.kn.material.color.set(on ? '#aaf6ff' : '#888'); });
    this.wires.forEach(w => { const on = !!v[w.src]; w.m.material.emissive.set(on ? this.M.W.accent2 : '#000'); w.m.material.emissiveIntensity = on ? 1.5 : 0; w.m.material.color.set(on ? '#9fffe0' : '#2a303c'); });
    this.s.gates.forEach((g, i) => { const nd = this.nodes[this.s.n + i]; if (nd.mesh) nd.mesh.material.emissiveIntensity = lerp(nd.mesh.material.emissiveIntensity, v[this.s.n + i] ? 1.0 : 0.1, k); });
    this.lamps.forEach((l, i) => { const on = !!v[l.gid], ok = on === !!this.s.want[i]; l.mat.emissiveIntensity = lerp(l.mat.emissiveIntensity, on ? 2.4 : 0, k); l.mat.color.set(on ? '#ffe9a8' : '#555'); l.ring.material.emissive.set(ok ? '#4cff9a' : (this.s.want[i] ? '#ffd27a' : '#6a7280')); l.ring.material.emissiveIntensity = ok ? 2.2 : 0.8; });
  }
}

/* ═════════ MULTI ═════════ */
class MultiView extends BaseView {
  constructor(s, M, ctx) {
    super(M, ctx); this.s = s; this.cur = -1; this.sub = null; this.orbs = s.stages.map((_, i) => { const o = sphere(0.18, M.glow('#7af0ff', 0.4)); o.position.set((i - (s.stages.length - 1) / 2) * 0.6, 0, 0); this.group.add(o); return o; }); this.orbHolder = new THREE.Group(); this.group.add(this.orbHolder);
    this.orbs.forEach(o => { this.group.remove(o); this.orbHolder.add(o); }); this.sync(s, null, null, true);
  }
  build(i, first) {
    if (this.sub) { this.group.remove(this.sub.group); this.sub.destroy(); }
    this.sub = createView(this.s.stages[i], this.M, this.ctx); this.group.add(this.sub.group); this.radius = this.sub.radius + 1; this.cur = i; this.grow = first ? 1 : 0; this.orbHolder.position.set(0, 0.2, this.sub.radius * 0.0 + 4.2 + (this.sub.radius > 8 ? 1 : 0));
    this.sub.group.scale.setScalar(this.grow || 0.01); this.pick = this.sub.pick;
  }
  handlePick(ud) { const m = this.sub.handlePick(ud); return m ? { k: 'sub', m } : null; }
  highlight(mv) { if (this.sub) this.sub.highlight(mv && mv.k === 'sub' ? mv.m : null); }
  actions() { return this.sub.actions().map(a => ({ ...a, move: { k: 'sub', m: a.move } })); }
  status() { return `CHAMBER ${this.cur + 1} of ${this.s.stages.length} — ` + (this.sub.status() || 'solve it to open the next'); }
  sync(s, move, prev, first) {
    this.s = s; if (s.cur !== this.cur) { this.build(s.cur, first); if (!first) { this.ctx.audio.power(); } }
    this.sub.sync(s.stages[s.cur], move && move.k === 'sub' ? move.m : null, prev ? prev.stages[prev.cur] : null);
  }
  update(t, dt) {
    this.time += dt; if (this.grow < 1) { this.grow = Math.min(1, this.grow + dt * 1.6); this.sub.group.scale.setScalar(ease(this.grow) * 0.99 + 0.01); }
    this.sub.update(t, dt); this.pick = this.sub.pick;
    this.orbs.forEach((o, i) => { const done = i < this.s.cur || (i === this.s.cur && false); o.material.emissive.set(i < this.cur ? '#4cff9a' : i === this.cur ? '#ffd27a' : '#334455'); o.material.emissiveIntensity = i <= this.cur ? 1.6 + Math.sin(this.time * 4 + i) * 0.3 : 0.2; o.material.color.set(i < this.cur ? '#4cff9a' : i === this.cur ? '#ffd27a' : '#334455'); });
  }
  destroy() { if (this.sub) { this.sub.destroy(); } super.destroy(); }
}

const MAP = { seq: SeqView, pipes: PipesView, coupled: CoupledView, tilt: TiltView, beam: BeamView, tanks: TanksView, echo: EchoView, logic: LogicView, multi: MultiView };
export function createView(state, M, ctx) { return new MAP[state.t](state, M, ctx); }
