/* PARALLAX shared 3D helpers: materials per world, text labels, and the base class every puzzle view extends. */
import * as THREE from 'three';

export function makeMats(W) {
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.1, ...o });
  const M = {
    W, stone: std(W.base, { roughness: 0.85 }), dark: std('#14161e', { roughness: 0.45, metalness: 0.5 }), metal: std(W.metal, { metalness: 0.85, roughness: 0.28 }),
    rim: std('#2a2e3a', { roughness: 0.4, metalness: 0.7 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#cdeeff', transparent: true, opacity: 0.26, roughness: 0.04, metalness: 0, clearcoat: 1, depthWrite: false }),
    glow: (c, i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.3, metalness: 0.2 }),
    basic: c => new THREE.MeshBasicMaterial({ color: c })
  };
  ['stone', 'dark', 'metal', 'rim', 'glass'].forEach(k => { M[k].userData.shared = true; });
  return M;
}

const texCache = new Map();
export function labelTexture(text, { w = 512, h = 128, size = 56, color = '#ffffff', bg = null, weight = '700', border = null } = {}) {
  const key = [text, w, h, size, color, bg, border].join('|'); if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 22); g.fill(); }
  if (border) { g.strokeStyle = border; g.lineWidth = 4; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 22); g.stroke(); }
  g.fillStyle = color; g.font = `${weight} ${size}px system-ui, Segoe UI, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const words = String(text).split(' '); const lines = []; let cur = '';
  for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (g.measureText(t).width > w - 40 && cur) { lines.push(cur); cur = wd; } else cur = t; } lines.push(cur);
  lines.forEach((ln, i) => g.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.12));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; texCache.set(key, tex); return tex;
}
export function label(text, scale = 1, opts = {}) {
  const w = opts.w || 512, h = opts.h || 128, m = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(text, opts), transparent: true, depthWrite: false, depthTest: opts.depthTest !== false }));
  m.scale.set(scale * w / h, scale, 1); return m;
}
export function planeLabel(text, width, opts = {}) {
  const w = opts.w || 512, h = opts.h || 128, m = new THREE.Mesh(new THREE.PlaneGeometry(width, width * h / w), new THREE.MeshBasicMaterial({ map: labelTexture(text, opts), transparent: true, depthWrite: false }));
  return m;
}
export const cyl = (rt, rb, h, mat, seg = 28) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
export const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
export const sphere = (r, mat, seg = 24) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg * 0.7), mat);
export const ease = t => t * t * (3 - 2 * t);

/* Base for all puzzle views: picking, a golden halo that points at the hinted control, and cleanup. */
export class BaseView {
  constructor(M, ctx) {
    this.M = M; this.ctx = ctx; this.group = new THREE.Group(); this.pick = []; this.halos = []; this.time = 0; this.radius = 6; this.mixers = [];
    this.haloGeo = new THREE.TorusGeometry(0.62, 0.05, 10, 40); this.haloMat = new THREE.MeshBasicMaterial({ color: '#ffd45a', transparent: true, opacity: 0.95, depthTest: false });
  }
  reg(mesh, mv) { mesh.userData.mv = mv; this.pick.push(mesh); return mesh; }
  findPick(mv) { const k = JSON.stringify(mv); return this.pick.filter(m => JSON.stringify(m.userData.mv) === k); }
  highlight(mv) {
    this.halos.forEach(h => { this.group.remove(h); }); this.halos = []; if (!mv) return;
    const targets = this.hlTargets ? this.hlTargets(mv) : this.findPick(mv);
    for (const t of targets) { const h = new THREE.Mesh(this.haloGeo, this.haloMat); h.renderOrder = 30; const v = new THREE.Vector3(); t.getWorldPosition(v); this.group.worldToLocal(v); h.position.copy(v); h.rotation.x = Math.PI / 2; this.group.add(h); this.halos.push(h); }
  }
  update(t, dt) { this.time += dt; this.halos.forEach((h, i) => { const s = 1 + 0.18 * Math.sin(this.time * 6 + i); h.scale.setScalar(s); h.rotation.z += dt * 2; }); if (this.tick) this.tick(t, dt); }
  handlePick(ud) { return ud && ud.mv ? ud.mv : null; }
  actions() { return []; }
  status() { return ''; }
  destroy() { this.group.traverse(o => { if (o.geometry && o.geometry !== this.haloGeo) o.geometry.dispose(); if (o.material && !o.material.map && o.material !== this.haloMat && !o.material.userData.shared) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); }); this.haloGeo.dispose(); this.haloMat.dispose(); }
}
