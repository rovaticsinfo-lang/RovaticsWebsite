/* Crowd Rush Legends: real-world scenery. Vertex-coloured model factories (trees, cars, trains, planes, towers...),
   procedural buildings with window textures, animated traffic, and one "kit" of set dressing per theme.
   Everything is generated in code, so there is nothing extra to download. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, lerp } from './cr-util.js';
import { ROAD_W } from './cr-level.js';

const HW = ROAD_W / 2, CHUNK = 110;
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3();

/* ---------- model building blocks ---------- */
function PM(geo, hex, mat) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(mat);
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function P(geo, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return PM(geo, hex, new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)));
}
const M = list => mergeGeometries(list, false);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (a, b, h, s = 8) => new THREE.CylinderGeometry(a, b, h, s, 1);
const cone = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
const ico = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);
const sph = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
const HALF = Math.PI / 2;

function frond(a, tx, ty, tz, len, hex) {
  const m = new THREE.Matrix4().makeTranslation(tx, ty, tz)
    .multiply(new THREE.Matrix4().makeRotationY(a))
    .multiply(new THREE.Matrix4().makeRotationZ(-(HALF - 0.25)))
    .multiply(new THREE.Matrix4().makeTranslation(0, len / 2, 0))
    .multiply(new THREE.Matrix4().makeScale(1, 1, 0.28));
  return PM(new THREE.ConeGeometry(0.55, len, 3), hex, m);
}

const GEO = {};
const FACTORY = {
  pine: () => M([P(cyl(0.2, 0.28, 1.4, 6), '#5a3d28', 0, 0.7, 0), P(cone(1.7, 2.6, 7), '#1d5436', 0, 2.5, 0), P(cone(1.35, 2.3, 7), '#256642', 0, 4.0, 0), P(cone(0.95, 2.0, 7), '#2e7a4b', 0, 5.4, 0)]),
  oak: () => M([P(cyl(0.3, 0.4, 2.4, 6), '#5b4128', 0, 1.2, 0), P(ico(1.7), '#3b8a34', 0, 3.7, 0), P(ico(1.3), '#4a9c3c', 0.9, 3.2, 0.5), P(ico(1.2), '#2f7a2f', -0.8, 3.4, -0.6), P(ico(1.0), '#5aab45', 0, 4.8, 0)]),
  bush: () => M([P(ico(0.9), '#2f7a36', 0, 0.6, 0, 0, 0, 0, 1.2, 0.8, 1.2), P(ico(0.6), '#3e9344', 0.6, 0.5, 0.3)]),
  rock: () => M([P(ico(1, 0), '#8a8d90', 0, 0.4, 0, 0, 0, 0, 1.2, 0.8, 1), P(ico(0.6, 0), '#767a7e', 0.9, 0.2, 0.3)]),
  log: () => M([P(cyl(0.35, 0.35, 4, 8), '#6b4a2e', 0, 0.35, 0, 0, 0, HALF), P(cyl(0.3, 0.3, 0.05, 8), '#c9a56a', 2.0, 0.35, 0, 0, 0, HALF)]),
  palm: () => {
    const parts = []; let x = 0, y = 0;
    for (let i = 0; i < 5; i++) { parts.push(P(cyl(0.2 - i * 0.02, 0.27 - i * 0.02, 1.3, 6), i % 2 ? '#9a774c' : '#a98558', x, y + 0.65, 0, 0, 0, -0.1 * i * 0.3)); x += 0.13; y += 1.25; }
    for (let k = 0; k < 8; k++) parts.push(frond((k / 8) * Math.PI * 2, x, y + 0.2, 0, 3.4, k % 2 ? '#2f8f3c' : '#3da048'));
    parts.push(P(sph(0.2), '#5a3b20', x + 0.15, y - 0.1, 0.1), P(sph(0.2), '#5a3b20', x - 0.15, y - 0.1, -0.1));
    return M(parts);
  },
  car: () => M([
    P(box(1.9, 0.62, 4.3), '#ffffff', 0, 0.62, 0), P(box(1.92, 0.22, 4.32), '#1b1b1f', 0, 0.3, 0),
    P(box(1.6, 0.5, 2.2), '#ffffff', 0, 1.16, -0.25), P(box(1.64, 0.36, 2.24), '#16232f', 0, 1.18, -0.25),
    P(cyl(0.36, 0.36, 0.26, 10), '#101010', 0.95, 0.36, 1.35, 0, 0, HALF), P(cyl(0.36, 0.36, 0.26, 10), '#101010', -0.95, 0.36, 1.35, 0, 0, HALF),
    P(cyl(0.36, 0.36, 0.26, 10), '#101010', 0.95, 0.36, -1.35, 0, 0, HALF), P(cyl(0.36, 0.36, 0.26, 10), '#101010', -0.95, 0.36, -1.35, 0, 0, HALF)]),
  truck: () => M([
    P(box(2.5, 3.0, 8.5), '#f2f2f2', 0, 2.3, -1.2), P(box(2.4, 2.3, 2.2), '#ffffff', 0, 1.65, 4.4), P(box(2.42, 0.9, 1.4), '#16232f', 0, 2.3, 4.7),
    P(box(2.2, 0.5, 11), '#222226', 0, 0.55, 0.4),
    ...[-4.2, -2.6, 3.9].flatMap(z => [P(cyl(0.5, 0.5, 0.4, 10), '#101010', 1.2, 0.5, z, 0, 0, HALF), P(cyl(0.5, 0.5, 0.4, 10), '#101010', -1.2, 0.5, z, 0, 0, HALF)])]),
  bus: () => M([
    P(box(2.5, 2.9, 10.5), '#ffffff', 0, 2.0, 0), P(box(2.54, 0.95, 10.0), '#16232f', 0, 2.5, 0), P(box(2.3, 0.4, 10.4), '#222226', 0, 0.55, 0),
    ...[-3.4, 3.4].flatMap(z => [P(cyl(0.5, 0.5, 0.4, 10), '#101010', 1.2, 0.5, z, 0, 0, HALF), P(cyl(0.5, 0.5, 0.4, 10), '#101010', -1.2, 0.5, z, 0, 0, HALF)])]),
  wagon: () => M([
    P(box(3.0, 3.1, 15.2), '#ffffff', 0, 2.55, 0), P(box(3.04, 0.95, 14.6), '#18232e', 0, 2.9, 0), P(box(3.1, 0.25, 15.3), '#dfe3e6', 0, 4.15, 0),
    P(box(2.6, 0.7, 4), '#25262a', 0, 0.75, 5.2), P(box(2.6, 0.7, 4), '#25262a', 0, 0.75, -5.2)]),
  loco: () => M([
    P(box(3.0, 3.6, 17), '#ffffff', 0, 2.6, 0), P(box(3.04, 1.1, 5), '#16232f', 0, 3.4, 6.4), P(box(2.0, 0.3, 17.2), '#222', 0, 4.5, 0),
    P(box(2.6, 0.7, 4.4), '#25262a', 0, 0.75, 5.6), P(box(2.6, 0.7, 4.4), '#25262a', 0, 0.75, -5.6)]),
  lamp: () => M([P(cyl(0.08, 0.13, 7, 6), '#4b505a', 0, 3.5, 0), P(box(1.7, 0.1, 0.1), '#4b505a', 0.85, 7.0, 0), P(box(0.7, 0.18, 0.36), '#d4d8de', 1.6, 6.92, 0)]),
  mast: () => M([P(cyl(0.11, 0.16, 7.6, 6), '#6c717a', 0, 3.8, 0), P(box(4.6, 0.12, 0.12), '#6c717a', 2.3, 6.5, 0), P(cyl(0.05, 0.05, 0.5, 5), '#d6dfe3', 4.4, 6.3, 0), P(box(4.2, 0.1, 0.1), '#80858d', 2.1, 5.0, 0)]),
  pylonHV: () => M([P(box(0.6, 26, 0.6), '#7c828a', 0, 13, 0), P(box(10, 0.4, 0.4), '#7c828a', 0, 24, 0), P(box(7, 0.4, 0.4), '#7c828a', 0, 20, 0)]),
  tower: () => M([P(cyl(2.2, 3.0, 28, 12), '#d8dde2', 0, 14, 0), P(cyl(5.4, 4.0, 4.6, 12), '#2f6585', 0, 30.3, 0), P(cyl(5.8, 5.8, 0.6, 12), '#c8ced4', 0, 28, 0), P(cone(5.9, 1.8, 12), '#8f969e', 0, 33.6, 0), P(cyl(0.12, 0.12, 5, 5), '#bbb', 0, 36, 0)]),
  hangar: () => M([P(box(30, 9, 42), '#d5dade', 0, 4.5, 0), P(cyl(15, 15, 42, 20), '#9aa7b3', 0, 9, 0, HALF, 0, 0, 1, 1, 0.4), P(box(14, 6, 0.4), '#3b4a58', 0, 3, 21.1)]),
  umbrella: () => M([P(cyl(0.04, 0.04, 2.3, 5), '#e6dccb', 0, 1.15, 0), P(cone(1.5, 0.65, 10), '#ffffff', 0, 2.4, 0), P(box(0.8, 0.12, 1.9), '#f6f6f2', 0, 0.2, 1.9)]),
  hut: () => M([P(box(3.2, 2.5, 3.2), '#ead3a8', 0, 1.25, 0), P(cone(2.8, 1.5, 4), '#b5553b', 0, 3.2, 0, 0, Math.PI / 4, 0), P(box(0.9, 1.7, 0.1), '#7a5638', 0, 0.85, 1.62)]),
  lifeguard: () => M([P(box(1.8, 0.15, 1.8), '#e8e0d0', 0, 2.6, 0), P(box(1.7, 1.5, 1.7), '#e84a3a', 0, 3.4, 0), P(cone(1.6, 0.8, 4), '#f4f4f4', 0, 4.5, 0, 0, Math.PI / 4, 0), ...[[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].map(p => P(cyl(0.07, 0.07, 2.6, 5), '#c9c0ac', p[0], 1.3, p[1]))]),
  sailboat: () => M([P(box(2.0, 0.9, 6.8), '#ffffff', 0, 0.45, 0), P(cone(1.0, 1.4, 4), '#ffffff', 0, 0.45, 3.9, HALF, 0, 0, 1, 1, 0.9), P(cyl(0.07, 0.07, 8, 5), '#ccc', 0, 4.8, 0.3), P(cone(1.7, 6.5, 3), '#fbfbf6', 0, 4.4, -0.5, 0, 0, 0, 1, 1, 0.07)]),
  windsock: () => M([P(cyl(0.07, 0.09, 7, 6), '#d9d9d9', 0, 3.5, 0), P(cone(0.55, 3, 8), '#ff7a1a', 1.5, 6.9, 0, 0, 0, -HALF)]),
  sign: () => M([P(cyl(0.05, 0.05, 2.2, 5), '#666', -0.8, 1.1, 0), P(cyl(0.05, 0.05, 2.2, 5), '#666', 0.8, 1.1, 0), P(box(2.2, 1.0, 0.1), '#f2c500', 0, 2.2, 0)]),
  signal: () => M([P(cyl(0.1, 0.12, 6, 6), '#555a60', 0, 3, 0), P(box(0.5, 1.3, 0.4), '#1c1d20', 0, 6.2, 0), P(sph(0.16), '#ff3030', 0, 6.65, 0.22), P(sph(0.16), '#40e060', 0, 5.8, 0.22)]),
  crystal: () => M([P(cone(0.55, 3.2, 5), '#ffffff', 0, 1.6, 0), P(cone(0.35, 2.0, 5), '#ffffff', 0.7, 1.0, 0.3, 0, 0, -0.25)]),
  spire: () => M([P(cone(1.5, 7, 6), '#1d1514', 0, 3.5, 0), P(cone(0.5, 1.8, 6), '#ff7a1a', 0, 6.6, 0)]),
  neonPole: () => M([P(box(0.5, 22, 0.5), '#1b1030', 0, 11, 0), P(box(0.62, 0.3, 0.62), '#ffffff', 0, 6, 0), P(box(0.62, 0.3, 0.62), '#ffffff', 0, 13, 0), P(box(0.62, 0.3, 0.62), '#ffffff', 0, 19, 0)])
};
function geo(name) { return GEO[name] || (GEO[name] = FACTORY[name]()); }
export function disposeKitCache() { for (const k of Object.keys(GEO)) { GEO[k].dispose(); delete GEO[k]; } }

function planeGeo(tailHex) {
  const key = 'plane' + tailHex;
  if (GEO[key]) return GEO[key];
  const body = '#f3f5f8';
  return (GEO[key] = M([
    P(cyl(1.9, 1.9, 24, 14), body, 0, 0, 0, HALF, 0, 0), P(cone(1.9, 5.5, 14), body, 0, 0, 14.7, HALF, 0, 0), P(cone(1.9, 8, 14), body, 0, 0.3, -16, -HALF, 0, 0, 1, 1, 0.7),
    P(box(1.5, 0.45, 0.4), '#111c28', 0, 0.9, 15.2), P(cyl(1.93, 1.93, 14, 14), '#1d4f9a', 0, -0.7, 0, HALF, 0, 0, 1, 1, 0.16),
    P(box(14.5, 0.35, 5.2), '#e6e9ee', 8.5, -0.6, 0.8, 0, 0.5, 0), P(box(14.5, 0.35, 5.2), '#e6e9ee', -8.5, -0.6, 0.8, 0, -0.5, 0),
    P(cyl(0.95, 0.95, 3.4, 10), '#9aa0a8', 6.2, -1.6, 2.6, HALF, 0, 0), P(cyl(0.95, 0.95, 3.4, 10), '#9aa0a8', -6.2, -1.6, 2.6, HALF, 0, 0),
    P(box(0.4, 6.2, 5), tailHex, 0, 4.4, -14.5, -0.3, 0, 0), P(box(8.5, 0.3, 2.6), '#e6e9ee', 4.2, 1.2, -15, 0, 0.4, 0), P(box(8.5, 0.3, 2.6), '#e6e9ee', -4.2, 1.2, -15, 0, -0.4, 0)]));
}

/* ---------- textures ---------- */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
function windowTextures(night) {
  const S = 512, rnd = Math.random;
  const mk = emissive => {
    const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
    g.fillStyle = emissive ? '#000' : '#dad6ce'; g.fillRect(0, 0, S, S);
    if (!emissive) {
      for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${rnd() * 0.05})`; g.fillRect(rnd() * S, rnd() * S, 2, 2); }
      g.fillStyle = 'rgba(0,0,0,.10)'; for (let r = 0; r < 4; r++) g.fillRect(0, r * 128 + 120, S, 8);
    }
    return { c, g };
  };
  const day = mk(false), em = mk(true);
  const seed = []; for (let i = 0; i < 16; i++) seed.push([rnd(), rnd(), rnd()]);
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const x = col * 128 + 24, y = row * 128 + 20, w = 80, h = 88, s = seed[row * 4 + col];
    const lit = s[0] < (night ? 0.5 : 0.07);
    const g = day.g;
    g.fillStyle = '#23262c'; g.fillRect(x - 4, y - 4, w + 8, h + 8);
    const gr = g.createLinearGradient(x, y, x + w, y + h);
    if (night) { gr.addColorStop(0, lit ? '#ffd98a' : '#0e1a2a'); gr.addColorStop(1, lit ? '#ffb85a' : '#08111c'); }
    else { gr.addColorStop(0, lit ? '#f4e8bc' : '#6f93b3'); gr.addColorStop(0.5, lit ? '#f1dca0' : '#486a88'); gr.addColorStop(1, lit ? '#e8d08a' : '#35546f'); }
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    if (!lit) { g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x + 10, y); g.lineTo(x + 34, y); g.lineTo(x + 6, y + h); g.lineTo(x, y + h); g.fill(); }
    g.fillStyle = '#23262c'; g.fillRect(x + w / 2 - 2, y, 4, h);
    if (night && lit) {
      const e = em.g, hue = s[1] < 0.6 ? '#ffd98a' : s[1] < 0.85 ? '#cfeaff' : '#ffb0e0';
      e.fillStyle = hue; e.fillRect(x, y, w, h); e.fillStyle = '#000'; e.fillRect(x + w / 2 - 2, y, 4, h);
    }
  }
  const mkT = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
  return { map: mkT(day.c), emissive: mkT(em.c) };
}
function adTexture(text, c1, c2) {
  return canvasTex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.14)'; for (let i = 0; i < 9; i++) g.fillRect(i * 70 - 30, 0, 26, h);
    g.font = '900 96px "Arial Black",Impact,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 14; g.strokeStyle = 'rgba(10,20,50,.7)'; g.strokeText(text, w / 2, h / 2); g.fillStyle = '#fff'; g.fillText(text, w / 2, h / 2);
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
  });
}
function signTexture(text, sub) {
  return canvasTex(512, 220, (g, w, h) => {
    g.fillStyle = '#0c6b3c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 10; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 84px "Arial Black",Arial,sans-serif'; g.fillText(text, w / 2, h * 0.42);
    g.font = '700 46px Arial,sans-serif'; g.fillText(sub, w / 2, h * 0.76);
  });
}

/* ---------- placement helpers ---------- */
function makeCtx(base) {
  const c = base;
  c.rand = (a, b) => a + c.r() * (b - a);
  c.pick = arr => arr[Math.floor(c.r() * arr.length) % arr.length];
  c.scatter = (nPer100, axMin, axMax, o = {}) => {
    const n = Math.round(c.span / 100 * nPer100 * c.density), out = [];
    for (let i = 0; i < n; i++) {
      const sd = o.side || (c.r() < 0.5 ? -1 : 1), ax = c.rand(axMin, axMax), x = sd * ax, z = c.Z0 - c.r() * c.span, y = c.H(x, z);
      if (y < (o.minY !== undefined ? o.minY : c.minY)) continue;
      out.push({ x, y: o.y !== undefined ? o.y : y, z, ry: o.fixedRy !== undefined ? o.fixedRy : c.r() * 6.283, s: c.rand(o.s0 || 0.8, o.s1 || 1.3), c: o.colors ? c.pick(o.colors) : '#ffffff' });
    }
    return out;
  };
  c.line = (step, ax, o = {}) => {
    const out = [];
    for (const sd of o.sides || [-1, 1]) for (let z = c.Z0 - (o.offset || 0); z > c.Z1; z -= step) {
      const x = sd * ax, y = o.y !== undefined ? o.y : c.H(x, z);
      out.push({ x, y, z, ry: sd > 0 ? Math.PI : 0, s: o.s || 1, c: o.colors ? c.pick(o.colors) : '#ffffff' });
    }
    return out;
  };
  /* Scenery is split into 110 m chunks. Each chunk is its own mesh with a bounding sphere, so the GPU only draws the
     chunks that are on screen (and in the shadow view) instead of the whole 700 m level every frame. */
  const chunks = recs => { const by = new Map(); for (const r of recs) { const k = Math.floor(r.z / CHUNK); (by.get(k) || by.set(k, []).get(k)).push(r); } return by.values(); };
  c.inst = (geometry, mat, recs, o = {}) => {
    if (!recs.length) return null;
    const d = new THREE.Object3D(), col = new THREE.Color(); let last = null;
    for (const part of chunks(recs)) {
      const m = new THREE.InstancedMesh(geometry, mat, part.length);
      part.forEach((r, i) => {
        d.position.set(r.x, r.y + (o.dy || 0), r.z); d.rotation.set(0, r.ry || 0, 0);
        const s = r.s || 1; d.scale.set(s * (o.sx || 1), s * (o.sy || 1), s * (o.sx || 1)); d.updateMatrix(); m.setMatrixAt(i, d.matrix);
        col.set(r.c || '#ffffff'); if (o.vary) col.multiplyScalar(0.82 + c.r() * 0.36); m.setColorAt(i, col);
      });
      m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere(); m.castShadow = !!o.cast; m.receiveShadow = true; c.g.add(m); last = m;
    }
    return last;
  };
  c.glowSpheres = (recs, color, radius, dy) => {
    if (!recs.length) return;
    const geometry = new THREE.SphereGeometry(radius, 8, 6), mat = c.track(new THREE.MeshBasicMaterial({ color })), d = new THREE.Object3D();
    for (const part of chunks(recs)) {
      const m = new THREE.InstancedMesh(geometry, mat, part.length);
      part.forEach((r, i) => { d.position.set(r.x + (r.glowDx || 0), r.y + dy, r.z); d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
      m.computeBoundingSphere(); c.g.add(m);
    }
  };
  return c;
}

export class Fleet {
  constructor(g, geometry, mat, specs, opts = {}) {
    this.mesh = new THREE.InstancedMesh(geometry, mat, specs.length); this.specs = specs; this.L = opts.L || 260; this.extras = [];
    const col = new THREE.Color();
    specs.forEach((s, i) => { col.set(s.color || '#ffffff'); this.mesh.setColorAt(i, col); });
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.frustumCulled = false; this.mesh.castShadow = !!opts.cast; this.mesh.receiveShadow = true; g.add(this.mesh);
    this._m = new THREE.Matrix4(); this._m2 = new THREE.Matrix4(); this._p = new THREE.Vector3(); this._qq = new THREE.Quaternion(); this._sc = new THREE.Vector3(); this._ax = new THREE.Vector3(0, 1, 0);
  }
  addExtra(g, geometry, mat, offset) {
    const m = new THREE.InstancedMesh(geometry, mat, this.specs.length); m.frustumCulled = false; g.add(m);
    this.extras.push({ mesh: m, off: offset }); return m;
  }
  update(t, camZ) {
    const L = this.L;
    for (let i = 0; i < this.specs.length; i++) {
      const s = this.specs[i];
      let a = s.z0 + s.v * t - camZ; a = ((a % L) + L) % L - L / 2;
      this._p.set(s.x, s.y || 0, camZ + a);
      this._qq.setFromAxisAngle(this._ax, s.yaw !== undefined ? s.yaw : (s.v > 0 ? 0 : Math.PI));
      this._sc.setScalar(s.s || 1);
      this._m.compose(this._p, this._qq, this._sc); this.mesh.setMatrixAt(i, this._m);
      for (const e of this.extras) { this._m2.multiplyMatrices(this._m, e.off); e.mesh.setMatrixAt(i, this._m2); }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    for (const e of this.extras) e.mesh.instanceMatrix.needsUpdate = true;
  }
}

/* ---------- buildings ---------- */
function buildingGeo(w, h, d, x, y, z, tint) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, ou = Math.random(), ov = Math.random();
  const sc = [[d / 12, h / 12.8], [d / 12, h / 12.8], [0, 0], [0, 0], [w / 12, h / 12.8], [w / 12, h / 12.8]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    if (f === 2 || f === 3) uv.setXY(i, 0.02, 0.02); else uv.setXY(i, uv.getX(i) * sc[f][0] + ou, uv.getY(i) * sc[f][1] + ov);
  }
  return PM(g, tint, new THREE.Matrix4().makeTranslation(x, y + h / 2, z));
}
function buildRows(c, o) {
  const geos = [], zOf = new Map();
  const add = (g, z) => { geos.push(g); zOf.set(g, z); };
  for (const sd of [-1, 1]) for (let row = 0; row < o.rows; row++) {
    let z = c.Z0 - c.r() * 10;
    while (z > c.Z1) {
      const w = c.rand(o.wMin, o.wMax), d = c.rand(o.dMin, o.dMax);
      const h = row === 0 ? c.rand(o.h0[0], o.h0[1]) : c.rand(o.h1[0], o.h1[1]);
      const gap = c.rand(3, 8) + (c.r() < 0.12 ? 22 : 0);
      if (c.r() < (o.fill || 0.9)) {
        const ax = o.ax0 + row * o.rowDepth + w / 2, x = sd * ax, y = c.H(x, z - d / 2);
        if (y > c.minY) {
          add(buildingGeo(w, h, d, x, y - 0.6, z - d / 2, c.pick(o.colors)), z);
          if (c.r() < 0.5) add(P(box(w * 0.3, 1.6, d * 0.3), '#8d9096', x + c.rand(-w / 4, w / 4), y + h - 0.2, z - d / 2 + c.rand(-d / 4, d / 4)), z);
        }
      }
      z -= d + gap;
    }
  }
  if (!geos.length) return;
  const by = new Map();
  for (const g of geos) { const k = Math.floor(zOf.get(g) / CHUNK); (by.get(k) || by.set(k, []).get(k)).push(g); }
  for (const list of by.values()) {
    const mesh = new THREE.Mesh(M(list), c.matWin); mesh.castShadow = true; mesh.receiveShadow = true; c.g.add(mesh);
  }
  geos.forEach(x => x.dispose());
}

/* ---------- shared kit pieces ---------- */
function lamps(c, step, o = {}) {
  const recs = c.line(step, HW + 0.14, { y: 0, offset: 8 });
  c.inst(geo('lamp'), c.matV, recs, { cast: true });
  c.glowSpheres(recs.map(r => Object.assign({}, r, { glowDx: r.ry ? -1.6 : 1.6 })), o.color || c.th.lamp, 0.17, 6.8);
}
function mountains(c, n, colors, snow, axMin = 150, axMax = 280, size = 1) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const sd = c.r() < 0.5 ? -1 : 1, ax = c.rand(axMin, axMax), z = c.Z0 - c.r() * c.span, rad = c.rand(45, 90) * size, hh = c.rand(50, 110) * size, y = c.th.floorY - 8;
    parts.push(P(cone(rad, hh, 7), c.pick(colors), sd * ax, y + hh / 2, z, 0, c.r() * 3, 0));
    if (snow) parts.push(P(cone(rad * 0.36, hh * 0.34, 7), '#f1f6fa', sd * ax, y + hh * 0.83, z, 0, 0, 0));
  }
  if (!parts.length) return;
  c.g.add(new THREE.Mesh(M(parts), c.matV)); parts.forEach(p => p.dispose());
}
function billboards(c, n, texts) {
  for (let i = 0; i < n; i++) {
    const sd = c.r() < 0.5 ? -1 : 1, z = c.Z0 - 30 - c.r() * (c.span - 60), ax = c.rand(c.bbAx[0], c.bbAx[1]), x = sd * ax, y = c.H(x, z);
    if (y < c.minY) continue;
    const t = c.track(adTexture(c.pick(texts), c.pick(['#ff7a1a', '#1a8cff', '#c01a5a', '#14a05a']), '#1a2a5a'));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), c.track(new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide })));
    const frame = new THREE.Mesh(new THREE.BoxGeometry(14.6, 7.6, 0.4), c.matV2 || c.matV);
    m.position.set(x, y + 11, z); frame.position.set(x, y + 11, z - 0.3); m.rotation.y = frame.rotation.y = sd > 0 ? -0.5 : 0.5;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 9, 6), c.matV2);
    pole.position.set(x, y + 4.5, z - 0.3); frame.castShadow = true; pole.castShadow = true; c.g.add(m, frame, pole);
  }
}
const CAR_COLORS = ['#d8d8dc', '#1b1b20', '#b01e22', '#1f4fa8', '#e6e6ea', '#2a7a4a', '#c9a227', '#6a6f78', '#e07b1a'];
function carFleet(c, lanes, opts = {}) {
  const specs = [];
  for (const ln of lanes) {
    const per = ln.n || 6;
    for (let i = 0; i < per; i++) specs.push({ x: ln.x, y: ln.y || 0, v: ln.v * c.rand(0.9, 1.1), z0: (i / per) * 260 + c.rand(-12, 12), color: c.pick(opts.colors || CAR_COLORS), s: ln.s || 1 });
  }
  const f = new Fleet(c.g, opts.geo || geo('car'), c.matCar, specs, { L: 260, cast: false });
  if (opts.lights) {
    const front = new THREE.Matrix4().makeTranslation(0, 0.62, 2.18), rear = new THREE.Matrix4().makeTranslation(0, 0.66, -2.18);
    f.addExtra(c.g, new THREE.BoxGeometry(1.5, 0.16, 0.1), c.track(new THREE.MeshBasicMaterial({ color: '#fff4c8' })), front);
    f.addExtra(c.g, new THREE.BoxGeometry(1.5, 0.14, 0.1), c.track(new THREE.MeshBasicMaterial({ color: '#ff2a2a' })), rear);
  }
  c.fleets.push(f); return f;
}
function zebra(c, step, ax, w, texOnly) {
  const t = c.track(canvasTex(256, 64, (g, W, H) => { g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(245,245,245,.92)'; for (let i = 0; i < 8; i++) g.fillRect(i * 32 + 4, 0, 18, H); }));
  const m = c.track(new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  for (let z = c.Z0 - 40; z > c.Z1 + 160; z -= step) {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(w, 3.2), m); q.rotation.x = -Math.PI / 2; q.position.set(0, 0.03, z); q.receiveShadow = true; c.g.add(q);
  }
}

/* ---------- the kits ---------- */
function kitCity(c, night) {
  const th = c.th;
  const strip = c.track(new THREE.MeshStandardMaterial({ map: c.roadTex, roughness: night ? 0.45 : 0.8 }));
  for (const sd of [-1, 1]) {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(6.4, c.roadLen), strip); q.rotation.x = -Math.PI / 2; q.position.set(sd * 20.4, th.bankH + 0.03, c.roadMid); q.receiveShadow = true; c.g.add(q);
  }
  buildRows(c, { rows: 3, ax0: 25, rowDepth: 27, wMin: 11, wMax: 22, dMin: 12, dMax: 24, h0: [10, 30], h1: [28, 85], fill: 0.92,
    colors: night ? ['#9aa0b0', '#8d96aa', '#a79fb0', '#8a93a3'] : ['#e8e2d6', '#cfd6de', '#d9b99a', '#b8c4cf', '#e6d2b5', '#aab6c2', '#ffffff'] });
  lamps(c, 22, { color: night ? '#ffd9a0' : '#fff6cc' });
  c.inst(geo('oak'), c.matV, c.line(16, 24.2, { y: th.bankH, s: 0.55, offset: 4 }).map(r => Object.assign(r, { s: 0.5 + c.r() * 0.2 })), { cast: true, vary: true });
  c.inst(geo('oak'), c.matV, c.scatter(8, 18, 24, { s0: 0.55, s1: 0.8 }), { cast: true, vary: true });
  carFleet(c, [{ x: -18.8, v: 14, n: 6 }, { x: -21.9, v: -13, n: 6 }, { x: 18.8, v: -14, n: 6 }, { x: 21.9, v: 13, n: 6 }], { lights: night });
  carFleet(c, [{ x: -18.8, v: 14, n: 1, s: 1.0 }], { geo: geo('bus'), colors: ['#e0b020', '#2a6fb8', '#d8d8dc'] });
  carFleet(c, [{ x: 21.9, v: 13, n: 1 }, { x: -21.9, v: -13, n: 1 }], { geo: geo('truck'), colors: ['#d8d8dc', '#e0e0e0', '#2a6fb8'] });
  zebra(c, 70, 0, ROAD_W - 0.6);
  c.inst(geo('signal'), c.matV, c.line(70, HW + 0.2, { y: 0, offset: 40 }), { cast: true });
  if (night) c.inst(geo('neonPole'), c.matBasicV, c.scatter(10, 26, 60, { y: undefined, colors: ['#00f0ff', '#ff4fd8', '#ffd23a', '#8a4dff'] }).map(r => Object.assign(r, { s: 0.6 + c.r() * 0.5 })), { sx: 1 });
  c.bbAx = [28, 40]; billboards(c, 7, ['ROVATICS', 'CROWD RUSH', 'RUN & WIN', 'LEGENDS']);
}

function kitForest(c) {
  const th = c.th;
  c.inst(geo('pine'), c.matV, c.scatter(130, 8.5, 95, { s0: 0.8, s1: 1.7, minY: th.waterY + 0.5 }), { cast: true, vary: true });
  c.inst(geo('oak'), c.matV, c.scatter(60, 9, 90, { s0: 0.8, s1: 1.5, minY: th.waterY + 0.5 }), { cast: true, vary: true });
  c.inst(geo('bush'), c.matV, c.scatter(90, 8.5, 60, { s0: 0.7, s1: 1.5, minY: th.waterY + 0.4 }), { vary: true });
  c.inst(geo('rock'), c.matV, c.scatter(35, 6.5, 70, { s0: 0.6, s1: 1.9, minY: th.waterY - 0.6 }), { cast: true, vary: true });
  c.inst(geo('log'), c.matV, c.scatter(8, 10, 40, { s0: 0.8, s1: 1.2, minY: th.waterY + 0.5 }), { cast: true });
  mountains(c, 16, ['#6f8aa0', '#7b94a8', '#647c92'], true);
}

function kitBeach(c) {
  const th = c.th;
  c.inst(geo('palm'), c.matV, c.scatter(38, 17, 60, { side: 1, s0: 0.9, s1: 1.4, minY: th.waterY + 0.6 }), { cast: true, vary: true });
  c.inst(geo('umbrella'), c.matV, c.scatter(34, 17.5, 40, { side: 1, s0: 0.9, s1: 1.2, minY: th.waterY + 0.5, colors: ['#ff4a4a', '#ffd23a', '#2ab0ff', '#ffffff', '#ff8a3a', '#7ae05a'] }), { cast: true });
  c.inst(geo('hut'), c.matV, c.scatter(8, 22, 50, { side: 1, s0: 1, s1: 1.4, minY: th.waterY + 0.5 }), { cast: true });
  c.inst(geo('lifeguard'), c.matV, c.scatter(3, 18, 26, { side: 1, s0: 1, s1: 1.1, minY: th.waterY + 0.4 }), { cast: true });
  c.inst(geo('rock'), c.matV, c.scatter(16, 6.5, 30, { s0: 0.5, s1: 1.4, minY: th.waterY - 0.8 }), { cast: true, vary: true });
  buildRows(c, { rows: 2, ax0: 50, rowDepth: 30, wMin: 14, wMax: 24, dMin: 12, dMax: 20, h0: [10, 22], h1: [18, 40], fill: 0.6, colors: ['#ffffff', '#ffe9c9', '#cfeaf5', '#ffd1d1', '#e9f5d2'] }, true);
  const boats = [];
  for (let i = 0; i < 9; i++) boats.push({ x: -c.rand(26, 120), y: -2.2, v: c.rand(1.2, 2.8) * (c.r() < 0.5 ? 1 : -1), z0: c.r() * 380, color: c.pick(['#ffffff', '#ffe9c9', '#ffd1d1', '#cfeaf5']), s: c.rand(0.9, 1.7) });
  const bf = new Fleet(c.g, geo('sailboat'), c.matV, boats, { L: 400 }); c.fleets.push(bf);
  mountains(c, 8, ['#4f7a5a', '#5b8a63', '#476f55'], false, 170, 300, 0.8);
  lamps(c, 30, { color: '#fff1c0' });
  c.bbAx = [30, 40]; billboards(c, 3, ['ROVATICS', 'BEACH RUN']);
}

function kitHighway(c) {
  const th = c.th;
  const slabMat = c.track(new THREE.MeshStandardMaterial({ map: c.roadTex, roughness: 0.8 }));
  const concrete = c.track(new THREE.MeshStandardMaterial({ color: '#8e9296', roughness: 0.9 }));
  for (const sd of [-1, 1]) {
    const w = 8.4, x = sd * 12.9;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(w, c.roadLen), slabMat); top.rotation.x = -Math.PI / 2; top.position.set(x, 0, c.roadMid); top.receiveShadow = true; c.g.add(top);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 1.4, c.roadLen), concrete); slab.position.set(x, -0.72, c.roadMid); slab.receiveShadow = true; c.g.add(slab);
    c.inst(new THREE.CylinderGeometry(1.0, 1.3, -th.floorY - 1.4, 8), concrete, Array.from({ length: Math.floor(c.roadLen / 24) }, (_, i) => ({ x, y: (th.floorY - 1.4) / 2, z: c.roadStart - 12 - i * 24, s: 1 })), { cast: true });
    for (const zz of [0]) { /* median barrier on the far outer edge */ }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.95, c.roadLen), concrete); bar.position.set(x + sd * 4.25, 0.45, c.roadMid); bar.castShadow = true; c.g.add(bar);
  }
  carFleet(c, [{ x: -10.8, v: 24, n: 6 }, { x: -14.8, v: 29, n: 6 }, { x: 10.8, v: -21, n: 6 }, { x: 14.8, v: -26, n: 6 }]);
  carFleet(c, [{ x: -10.8, v: 24, n: 2 }, { x: 14.8, v: -26, n: 2 }], { geo: geo('truck'), colors: ['#e0e0e0', '#2a6fb8', '#c9392b', '#f2f2f2'] });
  carFleet(c, [{ x: 10.8, v: -21, n: 1 }], { geo: geo('bus'), colors: ['#e0b020', '#2a6fb8'] });
  lamps(c, 26, { color: '#ffd9a0' });
  for (const zz of c.gantryZ) {
    const gg = new THREE.Mesh(M([P(box(0.5, 8.4, 0.5), '#8d939a', -4.45, 4.2, 0), P(box(0.5, 8.4, 0.5), '#8d939a', 4.45, 4.2, 0), P(box(9.4, 0.9, 0.7), '#8d939a', 0, 8.2, 0), P(box(9.4, 0.12, 0.12), '#6c727a', 0, 7.6, 0)]), c.matV);
    gg.position.z = zz; gg.castShadow = true; c.g.add(gg);
    const st = c.track(signTexture(c.pick(['EXIT 14', 'CITY 5', 'AIRPORT', 'NORTH']), c.pick(['Rovatics', 'Next 5 km', 'Centre', 'Beach'])));
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.0), c.track(new THREE.MeshBasicMaterial({ map: st })));
    sg.position.set(-1.6, 6.8, zz + 0.4); c.g.add(sg); const sg2 = sg.clone(); sg2.position.set(2.6, 6.8, zz + 0.4); c.g.add(sg2);
  }
  buildRows(c, { rows: 2, ax0: 40, rowDepth: 30, wMin: 14, wMax: 26, dMin: 14, dMax: 26, h0: [14, 38], h1: [30, 95], fill: 0.85, colors: ['#e8e2d6', '#cfd6de', '#b8c4cf', '#aab6c2', '#dcd2c0'] });
  c.inst(geo('oak'), c.matV, c.scatter(40, 24, 90, { s0: 1, s1: 1.8, minY: th.floorY + 0.2 }), { vary: true });
  c.bbAx = [30, 38]; billboards(c, 4, ['ROVATICS', 'FAST LANE', 'CROWD RUSH']);
}

function kitRail(c) {
  const th = c.th;
  const slabMat = c.track(new THREE.MeshStandardMaterial({ map: c.roadTex, roughness: 0.95 }));
  const concrete = c.track(new THREE.MeshStandardMaterial({ color: '#8c8a84', roughness: 0.95 }));
  for (const sd of [-1, 1]) {
    const w = 7.6, x = sd * 11.2;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(w, c.roadLen), slabMat); top.rotation.x = -Math.PI / 2; top.position.set(x, 0, c.roadMid); top.receiveShadow = true; c.g.add(top);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 1.4, c.roadLen), concrete); slab.position.set(x, -0.72, c.roadMid); slab.receiveShadow = true; c.g.add(slab);
    c.inst(new THREE.CylinderGeometry(1.2, 1.7, -th.floorY - 1.4, 8), concrete, Array.from({ length: Math.floor(c.roadLen / 26) }, (_, i) => ({ x, y: (th.floorY - 1.4) / 2, z: c.roadStart - 12 - i * 26, s: 1 })), { cast: true });
  }
  const loco = [], wag = [];
  const mk = (x, v, z0, colors) => {
    for (let i = 0; i < 9; i++) wag.push({ x, v, z0: z0 + i * 16.2 * (v > 0 ? -1 : 1) - 18, color: colors[i % colors.length] });
  };
  mk(-11.2, 26, 0, ['#e8ecef', '#d9dde0']);
  mk(11.2, -19, 300, ['#c0392b', '#2a6fb8', '#e0b020']);
  const wf = new Fleet(c.g, geo('wagon'), c.matCar, wag, { L: 640 }); c.fleets.push(wf);
  loco.push({ x: -11.2, v: 26, z0: 16.2, color: '#c0392b' }, { x: 11.2, v: -19, z0: 300 + 16.2 * 5, color: '#2a6fb8' });
  c.fleets.push(new Fleet(c.g, geo('loco'), c.matCar, loco, { L: 640 }));
  /* catenary masts, wires and shadows */
  const masts = c.line(22, HW + 0.2, { y: 0, offset: 6 });
  c.inst(geo('mast'), c.matV, masts, { cast: true });
  for (const [yy, ww] of [[6.45, 0.05], [5.05, 0.06]]) { const wire = new THREE.Mesh(new THREE.BoxGeometry(ww, ww, c.roadLen), c.matV2); wire.position.set(0, yy, c.roadMid); wire.castShadow = true; c.g.add(wire); }
  c.inst(geo('signal'), c.matV, c.line(150, HW + 0.2, { y: 0, offset: 60 }), { cast: true });
  c.inst(geo('pine'), c.matV, c.scatter(70, 16, 90, { s0: 0.9, s1: 1.7, minY: th.waterY + 0.6 }), { cast: true, vary: true });
  c.inst(geo('oak'), c.matV, c.scatter(40, 16, 90, { s0: 0.9, s1: 1.5, minY: th.waterY + 0.6 }), { cast: true, vary: true });
  c.inst(geo('pylonHV'), c.matV, c.line(110, 38, { sides: [-1], y: undefined }).map(r => Object.assign(r, { y: c.H(r.x, r.z) })), { cast: false });
  c.inst(geo('rock'), c.matV, c.scatter(30, 6.5, 60, { s0: 0.6, s1: 1.8, minY: th.waterY - 0.6 }), { cast: true, vary: true });
  mountains(c, 10, ['#6f8aa0', '#7b94a8', '#6a7f86'], true);
}

function kitAirport(c) {
  const th = c.th;
  /* taxiway + apron strips on the airfield beside the runway */
  const tw = c.track(new THREE.MeshStandardMaterial({ map: c.taxiTex, roughness: 0.85 }));
  const tq = new THREE.Mesh(new THREE.PlaneGeometry(9, c.roadLen), tw); tq.rotation.x = -Math.PI / 2; tq.position.set(-21, 0.03, c.roadMid); tq.receiveShadow = true; c.g.add(tq);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(70, c.roadLen), c.track(new THREE.MeshStandardMaterial({ color: '#6f7378', roughness: 0.95 })));
  apron.rotation.x = -Math.PI / 2; apron.position.set(70, 0.02, c.roadMid); apron.receiveShadow = true; c.g.add(apron);
  /* blue edge lights + yellow signs */
  const edge = []; for (const sd of [-1, 1]) for (let z = c.Z0; z > c.Z1; z -= 9) edge.push({ x: sd * (HW + 0.35), y: 0.02, z });
  c.glowSpheres(edge, '#2aa0ff', 0.17, 0.2);
  c.inst(geo('sign'), c.matV, c.line(120, 9.2, { sides: [-1], y: 0, offset: 20 }), { cast: true });
  c.inst(geo('windsock'), c.matV, c.line(260, 10.5, { sides: [1], y: 0, offset: 90 }), { cast: true });
  /* terminal, tower, hangars, parked airliners */
  buildRows(c, { rows: 1, ax0: 108, rowDepth: 0, wMin: 60, wMax: 100, dMin: 18, dMax: 24, h0: [11, 16], h1: [11, 16], fill: 0.55, colors: ['#e6eef5', '#d3e2ee', '#cfd8de'] });
  c.inst(geo('tower'), c.matV, c.scatter(2.2, 90, 130, { side: 1, minY: -1, s0: 1, s1: 1.15 }), { cast: true });
  c.inst(geo('hangar'), c.matV, c.scatter(7, 90, 140, { side: 1, minY: -1, s0: 0.9, s1: 1.2, fixedRy: 0 }), { cast: true });
  const tails = ['#c0392b', '#1f6fd0', '#1a9a5a', '#e0a020'];
  tails.forEach((tc, i) => {
    const recs = c.scatter(5, 60, 85, { side: 1, minY: -1, y: 0.05, fixedRy: HALF * 2 * 0 + (i % 2 ? 0.4 : -0.4) }).filter((_, k) => k % 4 === i % 4);
    c.inst(planeGeo(tc), c.matCar, recs, { cast: true });
  });
  /* moving: taxiing airliner, fuel truck, planes in the sky */
  c.fleets.push(new Fleet(c.g, planeGeo('#1f6fd0'), c.matCar, [{ x: -21, y: 1.9, v: 9, z0: 40, yaw: 0, s: 1 }, { x: -21, y: 1.9, v: -9, z0: 260, yaw: Math.PI, s: 1 }], { L: 520, cast: true }));
  const sky = []; for (let i = 0; i < 4; i++) sky.push({ x: c.rand(-90, 90), y: c.rand(55, 95), v: c.rand(40, 60) * (c.r() < 0.5 ? 1 : -1), z0: c.r() * 600, s: c.rand(1.2, 1.8) });
  c.fleets.push(new Fleet(c.g, planeGeo('#c0392b'), c.matCar, sky, { L: 700 }));
  carFleet(c, [{ x: -23.5, v: 8, n: 2 }], { geo: geo('truck'), colors: ['#e0b020', '#f2f2f2'] });
  c.inst(geo('bush'), c.matV, c.scatter(40, 14, 40, { s0: 1, s1: 2 }), { vary: true });
  mountains(c, 8, ['#7d93a0', '#8aa0ac', '#74888f'], false, 200, 320, 0.8);
  c.bbAx = [36, 44]; billboards(c, 3, ['ROVATICS', 'WELCOME', 'FLY HIGH']);
}

function kitLava(c) {
  const th = c.th;
  c.inst(geo('spire'), c.matV, c.scatter(50, 14, 85, { s0: 0.7, s1: 1.7, minY: th.waterY + 0.6 }), { cast: true, vary: true });
  c.inst(geo('rock'), c.matV, c.scatter(40, 12, 60, { s0: 0.7, s1: 1.8, minY: th.waterY + 0.4, colors: ['#34201f', '#2a1a1a', '#3f2622'] }), { cast: true });
  const volc = [], glow = [];
  for (let i = 0; i < 6; i++) {
    const sd = i % 2 ? 1 : -1, x = sd * (62 + c.r() * 36), z = c.Z0 - 80 - i * (c.span / 6), y = c.H(x, z) - 2, s = 1.2 + c.r() * 0.8;
    volc.push(P(cone(16 * s, 26 * s, 10), '#2a1613', x, y + 13 * s, z)); glow.push(P(cyl(4.6 * s, 4.6 * s, 0.6, 12), '#ff7a1a', x, y + 25.6 * s, z));
    c.craters.push({ x, y: y + 26 * s, z });
  }
  c.g.add(new THREE.Mesh(M(volc), c.matV)); c.g.add(new THREE.Mesh(M(glow), c.matBasicV));
  lamps(c, 30, { color: '#ffb04a' });
}

export const KITS = { city: c => kitCity(c, false), night: c => kitCity(c, true), forest: kitForest, beach: kitBeach, highway: kitHighway, rail: kitRail, airport: kitAirport, lava: kitLava };

export function buildKit(kind, base) {
  const c = makeCtx(base);
  KITS[kind](c);
}
export { windowTextures, canvasTex, geo };
