/* Crowd Rush Legends: the world. Procedural sky, terrain with a deadly drop on both sides of the road (water, lava or
   ground), eight real-world themes, sun shadows, sky reflections, gates, blades, coins, mystery boxes and the boss arena.
   Everything is generated in code, so there are no textures to download. */
import * as THREE from 'three';
import { clamp, lerp, smoothstep, rng, fbm2 } from './cr-util.js';
import { ROAD_W } from './cr-level.js';
import { Ambient } from './cr-fx.js';
import { setBend, bendGroup } from './cr-bend.js';
import { buildKit, windowTextures, disposeKitCache } from './cr-kits.js';

const HW = ROAD_W / 2;
export const EDGE = HW + 0.15;   // beyond this the road is gone: people fall

const T = (o) => Object.assign({ stars: 0, aurora: null, cloud: 0.8, hill: 0, bankH: 0.4, riseStart: 13.5, riseW: 2.5, curb: true, exp: 1.05, bump: 1, density: 1 }, o);
export const THEMES = [
  T({ id: 'city', name: 'Riverside City', top: '#2a6fe0', mid: '#80c0f2', bot: '#e8f5ff', sun: '#fff1c8', sunDir: [-0.45, 0.4, -0.8], cloud: 0.9,
    fog: '#c9e2f5', fogD: 0.0072, hemi: ['#dcecff', '#6b6a60', 0.7], dir: ['#fff0d6', 2.8, [-0.75, 0.8, 0.4]], env: 0.55,
    gA: '#76807a', gB: '#8f948c', gWall: '#7b756c', floorY: -3.6, waterY: -2.4, drop: 'water', water: { mode: 0, c1: '#2a7fa8', c2: '#9edcf0' },
    road: 'city', edge: '#d8d8d2', lamp: '#fff2c0', kit: 'city', amb: { color: '#fff8d0', size: 0.08, sway: 0.6, vel: [0.2, 0.08, 0.1], box: [50, 14, 60] } }),
  T({ id: 'forest', name: 'Pine Forest Road', top: '#4a82c8', mid: '#a6d0e8', bot: '#eef5ea', sun: '#ffe9b0', sunDir: [-0.4, 0.34, -0.8], cloud: 0.7,
    fog: '#b7d2c4', fogD: 0.0105, hemi: ['#d6eede', '#3a4a2a', 0.85], dir: ['#ffe8c0', 2.5, [-0.65, 0.75, 0.45]], env: 0.5,
    gA: '#2f5a2a', gB: '#5f8f3a', gWall: '#5b4a3a', floorY: -3.8, waterY: -2.5, drop: 'water', water: { mode: 0, c1: '#1f6e66', c2: '#8fe0cf' },
    hill: 1.0, bankH: 0.6, riseStart: 11, riseW: 18, bump: 1.6, curb: false, road: 'country', edge: '#6a5a44', lamp: '#ffe9b0', kit: 'forest',
    amb: { color: '#fff3b8', size: 0.12, sway: 0.9, vel: [0.25, 0.1, 0.18], box: [50, 14, 60] } }),
  T({ id: 'beach', name: 'Beach Road', top: '#1672e8', mid: '#58c2f5', bot: '#fdf6e6', sun: '#fff6d8', sunDir: [-0.5, 0.45, -0.8], cloud: 0.8, exp: 1.1,
    fog: '#d1ebf5', fogD: 0.0072, hemi: ['#e8f4ff', '#c9b68a', 0.9], dir: ['#fff3d9', 3.0, [-0.7, 0.8, 0.4]], env: 0.7,
    gA: '#d4bf8a', gB: '#f0e0b0', gWall: '#a8987a', floorY: -3.4, waterY: -2.2, drop: 'water', water: { mode: 0, c1: '#00a0c8', c2: '#8ff3ee' },
    hill: 0.1, hillL: 0, bankH: 0.2, bankL: -6, riseStart: 14, riseW: 12, curb: true, road: 'coast', edge: '#f4efe4', lamp: '#fff1c0', kit: 'beach',
    amb: { color: '#ffffff', size: 0.07, sway: 0.5, vel: [0.3, 0.05, 0.2], box: [50, 10, 60] } }),
  T({ id: 'highway', name: 'Sky Highway', top: '#3a76c8', mid: '#9acaee', bot: '#e4eef6', sun: '#fff0cc', sunDir: [-0.4, 0.4, -0.8], cloud: 0.7,
    fog: '#cfdde8', fogD: 0.0068, hemi: ['#dce8f5', '#55595a', 0.75], dir: ['#fff0d8', 2.8, [-0.7, 0.8, 0.4]], env: 0.55,
    gA: '#5a5f57', gB: '#6e7a58', gWall: '#8d8f90', floorY: -9, waterY: null, drop: 'ground', water: { mode: 0, c1: '#000', c2: '#000' },
    hill: 0.15, bankH: -9, riseStart: 40, riseW: 30, curb: false, road: 'highway', edge: '#e8e8e8', lamp: '#ffd9a0', kit: 'highway',
    amb: { color: '#ffffff', size: 0.06, sway: 0.4, vel: [0.2, 0.05, 0.1], box: [50, 12, 60] } }),
  T({ id: 'rail', name: 'Railway Viaduct', top: '#4a7ec4', mid: '#a4cbe8', bot: '#f0f3ec', sun: '#fff0c8', sunDir: [-0.4, 0.38, -0.8], cloud: 0.8,
    fog: '#c6d6e0', fogD: 0.008, hemi: ['#dbe9f5', '#5a5a50', 0.75], dir: ['#fff0d0', 2.7, [-0.7, 0.8, 0.4]], env: 0.5,
    gA: '#5f7448', gB: '#8a9a5a', gWall: '#6e665a', floorY: -6, waterY: -4.5, drop: 'water', water: { mode: 0, c1: '#3a8296', c2: '#b6e8ee' },
    hill: 0.6, bankH: 0.3, riseStart: 15, riseW: 16, curb: false, road: 'rail', edge: '#6a6258', lamp: '#fff0c0', kit: 'rail',
    amb: { color: '#fff8d0', size: 0.08, sway: 0.6, vel: [0.2, 0.08, 0.1], box: [50, 12, 60] } }),
  T({ id: 'airport', name: 'Airport Runway', top: '#2c72d8', mid: '#88c2ee', bot: '#eaf3fa', sun: '#fff2dc', sunDir: [-0.45, 0.42, -0.8], cloud: 0.85,
    fog: '#d6e4ef', fogD: 0.0062, hemi: ['#e2eefa', '#6e7a58', 0.8], dir: ['#fff2dc', 2.9, [-0.7, 0.85, 0.35]], env: 0.55,
    gA: '#5f8a45', gB: '#7ea850', gWall: '#8a8f94', floorY: -3.0, waterY: null, drop: 'ground', water: { mode: 0, c1: '#000', c2: '#000' },
    hill: 0, bankH: 0, riseStart: 10.5, riseW: 1.6, curb: false, road: 'runway', edge: '#f2f2f2', lamp: '#2aa0ff', kit: 'airport',
    amb: { color: '#ffffff', size: 0.06, sway: 0.4, vel: [0.3, 0.05, 0.2], box: [50, 10, 60] } }),
  T({ id: 'night', name: 'Neon City Night', top: '#04010f', mid: '#1b0c4a', bot: '#8a2aa8', sun: '#ff6adf', sunDir: [0, 0.2, -1], stars: 1, aurora: '#6a4dff', cloud: 0, exp: 0.95,
    fog: '#150a30', fogD: 0.0085, hemi: ['#6a56c8', '#140c30', 0.8], dir: ['#8a9cff', 1.5, [-0.5, 0.7, 0.5]], env: 0.45,
    gA: '#1c1a2a', gB: '#2a2640', gWall: '#2d2840', floorY: -3.6, waterY: -2.4, drop: 'water', water: { mode: 0, c1: '#070c26', c2: '#2c3c9a' },
    road: 'night', edge: '#00f0ff', lamp: '#ffd9a0', kit: 'night', amb: { color: '#7af6ff', size: 0.1, sway: 0.5, vel: [0, 0.9, 0], box: [50, 18, 60] } }),
  T({ id: 'lava', name: 'Volcano Bridge', top: '#120303', mid: '#5e1307', bot: '#ff6a1a', sun: '#ff9a3a', sunDir: [0.2, 0.14, -1], cloud: 0, aurora: '#ff5a1a', exp: 1.0,
    fog: '#3a0f09', fogD: 0.0105, hemi: ['#ff9a6a', '#3a120c', 0.8], dir: ['#ff9a5a', 2.2, [-0.5, 0.75, 0.4]], env: 0.4,
    gA: '#2b1713', gB: '#5e2d1c', gWall: '#1b0c0a', floorY: -3.6, waterY: -2.4, drop: 'lava', water: { mode: 1, c1: '#ff4a0a', c2: '#ffd23a' },
    hill: 1.1, bankH: 0.6, riseStart: 13, riseW: 22, curb: false, road: 'lava', edge: '#ff6a1a', lamp: '#ffb04a', kit: 'lava',
    amb: { color: '#ffa050', size: 0.13, sway: 0.5, vel: [0.3, 2.3, 0.2], box: [50, 20, 60] } })
];
export const THEME_COUNT = THEMES.length;

/* ---------- shaders ---------- */
const NOISE_GLSL = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }`;

const SKY_VS = `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FS = `
varying vec3 vD; uniform vec3 uTop, uMid, uBot, uSun, uSunDir, uAur; uniform float uT, uStars, uCloud, uAurAmt;
${NOISE_GLSL}
void main(){
  vec3 d = normalize(vD); float y = d.y;
  vec3 col = mix(uBot, uMid, smoothstep(-0.05, 0.22, y));
  col = mix(col, uTop, smoothstep(0.18, 0.85, y));
  float s = max(0.0, dot(d, normalize(uSunDir)));
  col += uSun * (pow(s, 700.0) * 4.0 + pow(s, 14.0) * 0.4 + pow(s, 3.0) * 0.08);
  float ang = atan(d.z, d.x);
  if (uCloud > 0.0 && y > 0.0) {
    vec2 p = d.xz / (y + 0.3) * 1.5 + vec2(uT * 0.012, 0.0);
    float c = smoothstep(0.5, 0.82, fbm(p));
    col = mix(col, mix(vec3(1.0), uSun, 0.25), c * uCloud * smoothstep(0.0, 0.22, y) * 0.85);
  }
  if (uStars > 0.0 && y > 0.02) {
    vec2 uv = vec2(ang * 60.0, y * 120.0); vec2 cell = floor(uv);
    float h = hash(cell); float tw = 0.5 + 0.5 * sin(uT * 3.0 + h * 60.0);
    float st = step(0.975, h) * smoothstep(0.42, 0.0, length(fract(uv) - 0.5)) * tw;
    col += vec3(st) * uStars * smoothstep(0.02, 0.3, y);
  }
  if (uAurAmt > 0.0 && y > 0.0) {
    float wob = 0.07 * sin(ang * 3.0 + uT * 0.2) + 0.04 * sin(ang * 7.0 - uT * 0.35);
    float band = smoothstep(0.2, 0.0, abs(y - 0.36 - wob));
    float streak = 0.5 + 0.5 * sin(ang * 14.0 + uT * 0.5 + fbm(vec2(ang * 3.0, uT * 0.1)) * 6.0);
    col += uAur * band * streak * uAurAmt;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const WATER_VS = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WATER_FS = `
varying vec3 vW; uniform float uT, uMode, uFogD; uniform vec3 uC1, uC2, uFog, uCam, uSunC;
${NOISE_GLSL}
void main(){
  vec2 p = vW.xz; vec3 col;
  if (uMode < 0.5) {
    float w = fbm(p * 0.22 + vec2(uT * 0.15, uT * 0.1));
    float w2 = fbm(p * 0.9 - vec2(uT * 0.22, 0.0) + w * 2.2);
    col = mix(uC1, uC2, smoothstep(0.32, 0.85, w2));
    vec3 V = normalize(uCam - vW);
    float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
    col = mix(col, uFog * 1.0, fres * 0.3);
    col += pow(max(0.0, sin(w2 * 34.0 + uT * 2.2)), 24.0) * 0.4 * uSunC;
  } else {
    float w = fbm(p * 0.16 + vec2(uT * 0.03, uT * 0.02));
    float c = fbm(p * 0.45 + w * 3.0 - uT * 0.05);
    float crack = smoothstep(0.40, 0.5, c) * (1.0 - smoothstep(0.5, 0.6, c));
    col = mix(vec3(0.07, 0.015, 0.015), uC1, smoothstep(0.34, 0.62, c));
    col = mix(col, uC2, crack * 1.4 + smoothstep(0.62, 0.82, c));
  }
  float d = length(vW - uCam); float fg = 1.0 - exp(-pow(uFogD * d, 2.0));
  col = mix(col, uFog, clamp(fg, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/* ---------- terrain: road on a causeway, a deadly drop beside it, then the surroundings ---------- */
export function terrainH(x, z, th) {
  const ax = Math.abs(x);
  if (ax < HW + 0.35) return (th.endZ !== undefined && z < th.endZ) ? th.floorY : -1.0;
  const wall = smoothstep(HW + 0.35, HW + 1.7, ax);
  const rise = smoothstep(th.riseStart, th.riseStart + th.riseW, ax);
  const hs = (x < 0 && th.hillL !== undefined) ? th.hillL : th.hill;
  const bank = (x < 0 && th.bankL !== undefined) ? th.bankL : th.bankH;
  const amp = (2 + fbm2(x * 0.035 + 3.1, z * 0.035, 3) * 22) * hs;
  const bump = (fbm2(x * 0.12, z * 0.12, 2) - 0.5) * 1.2 * th.bump;
  return lerp(-1.0, th.floorY, wall) + bump * wall + rise * (bank - th.floorY + amp);
}
function makeGrid(xs, zs, fn) {
  const nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
  let k = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = xs[i], z = zs[j]; const o = fn(x, z);
    pos[k] = x; pos[k + 1] = o.y; pos[k + 2] = z; col[k] = o.c.r; col[k + 1] = o.c.g; col[k + 2] = o.c.b; k += 3;
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* ---------- painted surfaces ---------- */
const ROAD_BASE = { city: '#383b41', country: '#42454a', coast: '#6e6f73', highway: '#2f3136', rail: '#6d6a64', runway: '#3b3d42', night: '#1f2029', lava: '#2b2321' };
function paintRoad(kind, taxi) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d'); const rnd = Math.random;
  const em = document.createElement('canvas'); em.width = 256; em.height = 512; const eg = em.getContext('2d'); eg.fillStyle = '#000'; eg.fillRect(0, 0, 256, 512);
  g.fillStyle = ROAD_BASE[kind]; g.fillRect(0, 0, 256, 512);
  if (kind === 'rail') {
    for (let i = 0; i < 12000; i++) { const v = 70 + rnd() * 90 | 0; g.fillStyle = `rgb(${v},${v - 4},${v - 10})`; const s = 2 + rnd() * 4; g.fillRect(rnd() * 256, rnd() * 512, s, s * (0.6 + rnd() * 0.6)); }
    for (let j = 0; j < 24; j++) {
      const y = j * 21.333; g.fillStyle = '#4a4036'; g.fillRect(34, y + 2, 188, 15); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(34, y + 2, 188, 3); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(34, y + 15, 188, 2);
    }
    for (const x of [84, 172]) {
      g.fillStyle = '#2b2d31'; g.fillRect(x - 6, 0, 12, 512); g.fillStyle = '#b8bec6'; g.fillRect(x - 4, 0, 8, 512); g.fillStyle = '#eef2f6'; g.fillRect(x - 3, 0, 2.5, 512); g.fillStyle = 'rgba(120,70,40,.4)'; g.fillRect(x + 1, 0, 3, 512);
      for (let j = 0; j < 24; j++) { g.fillStyle = '#7a7f86'; g.fillRect(x - 8, j * 21.333 + 6, 16, 6); }
    }
  } else {
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + rnd() * 0.05})`; g.fillRect(rnd() * 256, rnd() * 512, 20 + rnd() * 90, 20 + rnd() * 110); }
    for (let i = 0; i < 6500; i++) { const v = rnd() < 0.5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${0.04 + rnd() * 0.14})`; const s = 1 + rnd() * 2; g.fillRect(rnd() * 256, rnd() * 512, s, s); }
    g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(48, 0, 44, 512); g.fillRect(164, 0, 44, 512);
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) { g.beginPath(); let x = rnd() * 256, y = rnd() * 512; g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (rnd() - 0.5) * 24; y += 6 + rnd() * 18; g.lineTo(x, y); } g.stroke(); }
  }
  const dashes = (x, w, on, period, color, alpha = 1) => { g.fillStyle = color; g.globalAlpha = alpha; for (let y = 0; y < 512; y += period) g.fillRect(x, y + (period - on) / 2, w, on); g.globalAlpha = 1; };
  const solid = (x, w, color, alpha = 1) => { g.fillStyle = color; g.globalAlpha = alpha; g.fillRect(x, 0, w, 512); g.globalAlpha = 1; };
  switch (kind) {
    case 'city': dashes(125, 6, 128, 256, '#f0c419'); solid(12, 5, '#f2f2f2', 0.9); solid(239, 5, '#f2f2f2', 0.9); break;
    case 'country':
      solid(119, 5, '#e8b923', 0.95); solid(132, 5, '#e8b923', 0.95); solid(14, 4, '#f2f2f2', 0.6); solid(238, 4, '#f2f2f2', 0.6);
      for (const [a, b] of [[0, 22], [234, 256]]) { const gr = g.createLinearGradient(a, 0, b, 0); gr.addColorStop(0, 'rgba(110,86,52,.5)'); gr.addColorStop(1, 'rgba(110,86,52,0)'); g.fillStyle = gr; g.fillRect(Math.min(a, b), 0, Math.abs(b - a), 512); }
      break;
    case 'coast': dashes(126, 5, 128, 256, '#f4f4f4'); solid(12, 5, '#f4f4f4', 0.9); solid(239, 5, '#f4f4f4', 0.9);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(235,215,160,${0.1 + rnd() * 0.15})`; g.fillRect(rnd() < 0.5 ? rnd() * 40 : 216 + rnd() * 40, rnd() * 512, 6 + rnd() * 30, 4 + rnd() * 14); } break;
    case 'highway': dashes(126, 6, 96, 256, '#f4f4f4'); solid(10, 6, '#f0c419', 0.95); solid(240, 6, '#f6f6f6', 0.95); break;
    case 'runway':
      if (taxi) { solid(124, 6, '#f0c419'); solid(12, 4, '#f0c419', 0.9); solid(240, 4, '#f0c419', 0.9); }
      else {
        dashes(118, 20, 256, 512, '#f6f6f6'); solid(14, 8, '#f6f6f6', 0.95); solid(234, 8, '#f6f6f6', 0.95);
        g.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 30; i++) g.fillRect(100 + rnd() * 56, rnd() * 512, 2 + rnd() * 6, 20 + rnd() * 60);
        g.fillStyle = '#f6f6f6'; for (const x of [52, 196]) for (let y = 0; y < 512; y += 256) g.fillRect(x, y + 10, 16, 150);
      }
      break;
    case 'night':
      dashes(125, 6, 128, 256, '#ffd23a'); solid(12, 6, '#00f0ff', 0.95); solid(238, 6, '#ff4fd8', 0.95);
      for (let i = 0; i < 12; i++) { const gr = g.createRadialGradient(0, 0, 1, 0, 0, 60); const col = rnd() < 0.5 ? '0,240,255' : '255,79,216'; gr.addColorStop(0, `rgba(${col},.22)`); gr.addColorStop(1, `rgba(${col},0)`); g.save(); g.translate(rnd() * 256, rnd() * 512); g.scale(1, 0.5 + rnd() * 0.8); g.fillStyle = gr; g.fillRect(-60, -60, 120, 120); g.restore(); }
      eg.fillStyle = '#00f0ff'; eg.fillRect(12, 0, 6, 512); eg.fillStyle = '#ff4fd8'; eg.fillRect(238, 0, 6, 512); break;
    case 'lava':
      g.strokeStyle = '#ff7a1a'; g.lineWidth = 3; eg.strokeStyle = '#ff7a1a'; eg.lineWidth = 3;
      for (let i = 0; i <= 8; i++) for (const gg of [g, eg]) { gg.beginPath(); gg.moveTo(i * 32, 0); gg.lineTo(i * 32, 512); gg.stroke(); }
      for (let j = 0; j <= 16; j++) for (const gg of [g, eg]) { gg.beginPath(); gg.moveTo(0, j * 32); gg.lineTo(256, j * 32); gg.stroke(); }
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,120,30,${rnd() * 0.18})`; g.fillRect(rnd() * 256, rnd() * 512, 2, 2 + rnd() * 20); }
      break;
  }
  const mk = cv => { const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return { map: mk(c), emissive: kind === 'night' || kind === 'lava' ? mk(em) : null };
}
function bumpTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 9000; i++) { const v = 60 + Math.random() * 140 | 0; g.fillStyle = `rgb(${v},${v},${v})`; const s = 1 + Math.random() * 2; g.fillRect(Math.random() * 256, Math.random() * 512, s, s); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; return t;
}
function textTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function gateTexture(o, good) {
  return textTex(256, 320, (g, w, h) => {
    const col = good ? '40,125,255' : '255,52,72';
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgba(${col},.06)`); grad.addColorStop(1, `rgba(${col},.42)`);
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, h - i * 52 - 10); g.lineTo(w, h - i * 52 - 10); g.stroke(); }
    const label = o.op === 'x' ? '×' + o.v : o.op === '÷' ? '÷' + o.v : o.op === '+' ? '+' + o.v : '−' + o.v;
    let size = 150; g.font = `900 ${size}px "Arial Black",Impact,sans-serif`;
    while (g.measureText(label).width > w - 36 && size > 40) { size -= 6; g.font = `900 ${size}px "Arial Black",Impact,sans-serif`; }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = size * 0.16; g.strokeStyle = 'rgba(10,20,60,.85)'; g.strokeText(label, w / 2, h * 0.52);
    g.fillStyle = '#fff'; g.fillText(label, w / 2, h * 0.52);
  });
}
function bannerTexture(text, c1, c2) {
  return textTex(512, 128, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, 0); grad.addColorStop(0, c1); grad.addColorStop(1, c2);
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.16)'; for (let i = 0; i < 12; i++) g.fillRect(i * 48 - 20, 0, 24, h);
    let fs = 76; g.font = `900 ${fs}px "Arial Black",Impact,sans-serif`;
    while (g.measureText(text).width > w - 40 && fs > 30) { fs -= 4; g.font = `900 ${fs}px "Arial Black",Impact,sans-serif`; }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 14; g.strokeStyle = 'rgba(30,0,20,.8)'; g.strokeText(text, w / 2, h / 2 + 4);
    g.fillStyle = '#fff'; g.fillText(text, w / 2, h / 2 + 4);
  });
}
function mysteryTexture() {
  return textTex(128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#ffe066'); gr.addColorStop(1, '#ff9a1a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = '#a85a00'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#fff3a8'; for (const [x, y] of [[16, 16], [112, 16], [16, 112], [112, 112]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
    g.font = '900 92px "Arial Black",Impact,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 12; g.strokeStyle = '#7a3a00'; g.strokeText('?', w / 2, h / 2 + 6); g.fillStyle = '#fff'; g.fillText('?', w / 2, h / 2 + 6);
  });
}

export class World {
  constructor(scene, renderer, opts) {
    this.scene = scene; this.renderer = renderer; this.density = opts.decorScale || 1; this.fx = null;
    this.pads = []; this.strips = []; this.weapons = []; this.wlists = [];
    this.group = null; this.theme = THEMES[0]; this.coinMesh = null; this.boxMesh = null; this.coins = []; this.boxes = []; this.hazards = []; this.gates = [];
    this.fleets = []; this.craters = []; this.disposables = []; this.t = 0; this.drop = { y: -2.4, kind: 'water' }; this.envRT = null;
    scene.fog = new THREE.FogExp2(0xbfe6ff, 0.0085);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x446644, 1); scene.add(this.hemi);
    this.dir = new THREE.DirectionalLight(0xffffff, 2); this.lightVec = new THREE.Vector3(-0.6, 0.8, 0.4); scene.add(this.dir, this.dir.target);
    const sc = this.dir.shadow.camera; sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42; sc.near = 1; sc.far = 170;
    this.dir.shadow.bias = -0.0004; this.dir.shadow.normalBias = 0.06; this.shadowSize = 0;
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uSun: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3(0, 0.3, -1) }, uAur: { value: new THREE.Color() }, uT: { value: 0 }, uStars: { value: 0 }, uCloud: { value: 0 }, uAurAmt: { value: 0 }
      },
      vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false
    });
    const skyGeo = new THREE.SphereGeometry(300, 32, 16);
    this.sky = new THREE.Mesh(skyGeo, this.skyMat); this.sky.frustumCulled = false; this.sky.renderOrder = -10; scene.add(this.sky);
    this.envScene = new THREE.Scene(); this.envScene.add(new THREE.Mesh(skyGeo, this.skyMat));
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.ambient = new Ambient(scene, opts.ambientCount || 180);
    this.waterMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uMode: { value: 0 }, uFogD: { value: 0.0085 }, uC1: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uFog: { value: new THREE.Color() }, uCam: { value: new THREE.Vector3() }, uSunC: { value: new THREE.Color() } },
      vertexShader: WATER_VS, fragmentShader: WATER_FS
    });
    this.bump = bumpTexture(); this._o = new THREE.Object3D(); this._zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.mystery = mysteryTexture();
  }

  setShadows(size) {
    this.shadowSize = size;
    this.dir.castShadow = size > 0;
    this.renderer.shadowMap.enabled = size > 0; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (size > 0) { this.dir.shadow.mapSize.set(size, size); if (this.dir.shadow.map) { this.dir.shadow.map.dispose(); this.dir.shadow.map = null; } }
  }

  dispose() {
    if (!this.group) return;
    this.scene.remove(this.group);
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); });
    this.disposables.forEach(d => d.dispose && d.dispose());
    disposeKitCache();
    this.disposables = []; this.group = null; this.fleets = []; this.craters = [];
  }
  track(x) { this.disposables.push(x); return x; }

  build(lvl) {
    this.dispose();
    const th0 = THEMES[lvl.theme]; this.theme = th0;
    const g = new THREE.Group(); this.group = g; this.scene.add(g);
    const bossZ = lvl.boss.z;
    const th = Object.assign({}, th0, { endZ: bossZ - 22 });   // the ground ends just behind the arena: a real drop for a pushed boss
    const Z0 = 70, Z1 = bossZ - 190, mid = (Z0 + Z1) / 2, len = Z0 - Z1;
    const r = rng(lvl.n * 131 + 5);
    this.drop = { y: th.waterY !== null ? th.waterY : th.floorY, kind: th.drop }; this.endZ = bossZ - 20;

    /* light, fog, sky, reflections */
    this.scene.fog.color.set(th.fog); this.scene.fog.density = th.fogD;
    this.renderer.setClearColor(new THREE.Color(th.fog)); this.renderer.toneMappingExposure = th.exp;
    this.hemi.color.set(th.hemi[0]); this.hemi.groundColor.set(th.hemi[1]); this.hemi.intensity = th.hemi[2];
    this.dir.color.set(th.dir[0]); this.dir.intensity = th.dir[1]; this.lightVec.set(...th.dir[2]).normalize();
    this.dir.position.copy(this.lightVec).multiplyScalar(70);
    const su = this.skyMat.uniforms;
    su.uTop.value.set(th.top); su.uMid.value.set(th.mid); su.uBot.value.set(th.bot); su.uSun.value.set(th.sun);
    su.uSunDir.value.set(...th.sunDir); su.uStars.value = th.stars; su.uCloud.value = th.cloud;
    su.uAur.value.set(th.aurora || '#000'); su.uAurAmt.value = th.aurora ? 0.7 : 0;
    this.ambient.setTheme(th.amb);
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(this.envScene, 0.02, 0.1, 1000);
    this.scene.environment = this.envRT.texture; this.scene.environmentIntensity = th.env;

    /* terrain */
    const posX = [4.35, 4.8, 5.3, 5.9, 6.7, 8, 9.5, 10.5, 11.5, 12.5, 13.5, 14.3, 15.2, 16.2, 17.5, 19, 21, 23, 26, 30, 35, 40, 46, 53, 61, 70, 80, 92, 105, 120];
    const xs = [...posX.map(v => -v).reverse(), 0, ...posX];
    const zs = []; for (let z = Z0; z >= Z1; z -= 3) zs.push(z);
    const cA = new THREE.Color(th.gA), cB = new THREE.Color(th.gB), cW = new THREE.Color(th.gWall), cc = new THREE.Color();
    const dropY = this.drop.y;
    const tg = makeGrid(xs, zs, (x, z) => {
      const y = terrainH(x, z, th), ax = Math.abs(x);
      const wallK = 1 - smoothstep(HW + 1.5, HW + 2.8, ax);
      const hk = clamp((y - th.floorY) / 22 + (fbm2(x * 0.08, z * 0.08, 2) - 0.5) * 0.5, 0, 1);
      cc.copy(cA).lerp(cB, hk);
      cc.lerp(cW, clamp(wallK * 1.2 + (th.drop !== 'ground' && y < dropY + 0.4 && ax > HW + 2 ? 0.7 : 0), 0, 1));
      cc.multiplyScalar(0.88 + Math.random() * 0.24);
      return { y, c: cc.clone() };
    });
    const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }));
    terrain.receiveShadow = true; g.add(terrain);

    /* water / lava (hidden when the drop is plain ground) */
    const wu = this.waterMat.uniforms;
    wu.uMode.value = th.water.mode; wu.uC1.value.set(th.water.c1); wu.uC2.value.set(th.water.c2); wu.uFog.value.set(th.fog); wu.uFogD.value = th.fogD; wu.uSunC.value.set(th.sun);
    if (th.waterY !== null) {
      const water = new THREE.Mesh(new THREE.PlaneGeometry(300, len), this.waterMat);
      water.rotation.x = -Math.PI / 2; water.position.set(0, th.waterY, mid); g.add(water);
    }

    /* road */
    const roadEnd = bossZ + 24, roadStart = 60, roadLen = roadStart - roadEnd, roadMid = (roadStart + roadEnd) / 2;
    const paint = paintRoad(th.road, false);
    const rt = this.track(paint.map); rt.repeat.set(1, roadLen / 16);
    const bump = this.bump.clone(); bump.repeat.set(1, roadLen / 16); bump.needsUpdate = true; this.track(bump);
    const wet = th.road === 'night';
    const roadMat = new THREE.MeshStandardMaterial({ map: rt, bumpMap: bump, bumpScale: 1.2, roughness: wet ? 0.32 : (th.road === 'rail' ? 1 : 0.78), metalness: wet ? 0.25 : 0.02 });
    if (paint.emissive) { const et = this.track(paint.emissive); et.repeat.set(1, roadLen / 16); roadMat.emissiveMap = et; roadMat.emissive = new THREE.Color(0xffffff); roadMat.emissiveIntensity = th.road === 'lava' ? 1.6 : 1.1; }
    this.track(roadMat);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, roadLen, 1, Math.ceil(roadLen / 4)), roadMat);
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0, roadMid); road.receiveShadow = true; g.add(road);
    const slabColor = new THREE.Color(ROAD_BASE[th.road]).multiplyScalar(0.7);
    const slabMat = this.track(new THREE.MeshStandardMaterial({ color: slabColor, roughness: 0.95, flatShading: true }));
    const slab = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 0.9, 1.5, roadLen, 1, 1, Math.ceil(roadLen / 4)), slabMat); slab.position.set(0, -0.78, roadMid); slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
    if (th.curb) {
      const curbMat = this.track(new THREE.MeshStandardMaterial({ color: th.edge, roughness: 0.85 }));
      [-1, 1].forEach(s => { const cb = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, roadLen, 1, 1, Math.ceil(roadLen / 4)), curbMat); cb.position.set(s * (HW + 0.17), 0.07, roadMid); cb.receiveShadow = true; g.add(cb); });
    }
    const pillarH = -1.5 - th.floorY, pillars = Math.floor(roadLen / 22);
    if (pillarH > 0.5) {
      const pm = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.0, 1.35, pillarH, 8), slabMat, pillars), o = this._o;
      for (let i = 0; i < pillars; i++) { o.position.set(0, -1.5 - pillarH / 2, roadStart - 11 - i * 22); o.rotation.set(0, 0, 0); o.scale.setScalar(1); o.updateMatrix(); pm.setMatrixAt(i, o.matrix); }
      pm.frustumCulled = false; pm.castShadow = true; g.add(pm);
    }

    /* shared materials for the kits */
    const win = windowTextures(th.id === 'night'); this.track(win.map); this.track(win.emissive);
    const mk = (m) => this.track(m);
    const ctx = {
      g, th, r, Z0, Z1, span: len, density: this.density, lvl, fleets: this.fleets, craters: this.craters, track: x => this.track(x),
      H: (x, z) => terrainH(x, z, th), minY: (th.waterY !== null ? th.waterY : th.floorY) + 0.35,
      roadTex: rt, roadLen, roadMid, roadStart, gantryZ: [], bbAx: [30, 40],
      matV: mk(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 })),
      matV2: mk(new THREE.MeshStandardMaterial({ color: '#7b8088', roughness: 0.6, metalness: 0.4, flatShading: true })),
      matCar: mk(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.32, metalness: 0.55 })),
      matBasicV: mk(new THREE.MeshBasicMaterial({ vertexColors: true })),
      matWin: mk(new THREE.MeshStandardMaterial({ map: win.map, vertexColors: true, roughness: 0.55, metalness: 0.12, emissive: 0xffffff, emissiveMap: win.emissive, emissiveIntensity: th.id === 'night' ? 1.3 : 0 }))
    };
    if (th.road === 'runway') { const tp = paintRoad('runway', true); const tt = this.track(tp.map); tt.repeat.set(1, roadLen / 16); ctx.taxiTex = tt; }
    for (let z = -150; z > bossZ + 60; z -= 150) ctx.gantryZ.push(z);
    buildKit(th.kit, ctx);

    /* start line */
    const sl = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 0.9), new THREE.MeshBasicMaterial({ map: this.track(textTex(256, 32, (cx) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { cx.fillStyle = ((i + j) & 1) ? '#fff' : '#222'; cx.fillRect(i * 16, j * 16, 16, 16); } })), transparent: true, opacity: 0.92 }));
    sl.rotation.x = -Math.PI / 2; sl.position.set(0, 0.04, -3); g.add(sl);

    this.gates = lvl.gates; lvl.gates.forEach(gt => this.buildGate(g, gt));
    this.hazards = lvl.hazards; lvl.hazards.forEach(h => this.buildHazard(g, h));
    this.pads = lvl.pads; lvl.pads.forEach(p => this.buildPad(g, p));
    this.strips = lvl.strips; lvl.strips.forEach(s => this.buildStrip(g, s));
    this.coins = lvl.coins; this.buildCoins(g, lvl.coins);
    this.boxes = lvl.boxes; this.buildBoxes(g, lvl.boxes);
    this.weapons = lvl.weapons; this.buildWeapons(g, lvl.weapons);
    this.buildArena(g, th, bossZ, lvl);
    setBend(lvl.n, lvl.length); bendGroup(g);   // curves and hills: bend everything that was just built
  }

  buildGate(g, gt) {
    const grp = new THREE.Group(); grp.position.set(0, 0, gt.z); g.add(grp);
    gt.panels = [];
    [[gt.l, -1], [gt.r, 1]].forEach(([o, side]) => {
      const good = o.op === '+' || o.op === 'x';
      const tex = this.track(gateTexture(o, good));
      const mat = this.track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      const w = HW - 0.3;
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, 3.6), mat);
      panel.position.set(side * HW / 2, 2.1, 0); grp.add(panel);
      gt.panels.push({ mesh: panel, mat, flash: 0 });
      const fm = this.track(new THREE.MeshStandardMaterial({ color: good ? '#2a7bff' : '#ff3344', emissive: good ? '#1a55ff' : '#ff1a2a', emissiveIntensity: 1.6, roughness: 0.4 }));
      const top = new THREE.Mesh(new THREE.BoxGeometry(HW, 0.34, 0.34), fm); top.position.set(side * HW / 2, 4.0, 0); grp.add(top);
      const base = new THREE.Mesh(new THREE.BoxGeometry(HW, 0.18, 0.34), fm); base.position.set(side * HW / 2, 0.09, 0); grp.add(base);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.2, 0.4), fm); edge.position.set(side * (HW - 0.15), 2.1, 0); grp.add(edge);
    });
    const cm = this.track(new THREE.MeshStandardMaterial({ color: '#e8f0ff', emissive: '#9fb8ff', emissiveIntensity: 1.2, roughness: 0.3 }));
    const cpost = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.3, 0.4), cm); cpost.position.set(0, 2.15, 0); grp.add(cpost);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), cm); cap.position.set(0, 4.5, 0); grp.add(cap);
  }

  buildHazard(g, h) { const n0 = g.children.length; this._buildHazard(g, h); h.parts = g.children.slice(n0); }
  destroyHazard(h) { h.dead = true; (h.parts || []).forEach(p => { p.visible = false; }); }
  _buildHazard(g, h) {
    if (h.type === 'wall') {
      /* a barrier across the road with one gap: squeeze through it or jump over */
      const stripes = this.track(textTex(128, 64, (cx, w, hh) => {
        cx.fillStyle = '#e8b923'; cx.fillRect(0, 0, w, hh); cx.fillStyle = '#1a1a1a';
        for (let i = -2; i < 8; i++) { cx.beginPath(); cx.moveTo(i * 24, hh); cx.lineTo(i * 24 + 14, hh); cx.lineTo(i * 24 + 38, 0); cx.lineTo(i * 24 + 24, 0); cx.fill(); }
      }));
      const topMat = this.track(new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.7, metalness: 0.1 }));
      const body = this.track(new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.85, flatShading: true }));
      for (const side of [-1, 1]) {
        const x0 = side < 0 ? -4.4 : h.gx + h.gw / 2, x1 = side < 0 ? h.gx - h.gw / 2 : 4.4, w = x1 - x0;
        if (w < 0.2) continue;
        const blk = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, 1.1), body); blk.position.set((x0 + x1) / 2, 0.6, h.z); blk.castShadow = true; blk.receiveShadow = true; g.add(blk);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.3, 1.14), topMat); cap.position.set((x0 + x1) / 2, 1.35, h.z); cap.castShadow = true; g.add(cap);
      }
      const glow = this.track(new THREE.MeshBasicMaterial({ color: '#ff3a2a' }));
      for (const gxp of [h.gx - h.gw / 2, h.gx + h.gw / 2]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), glow); l.position.set(gxp, 1.7, h.z); g.add(l); }
      return;
    }
    if (h.type === 'roller') {
      const grp = new THREE.Group();
      const barrel = this.track(new THREE.MeshStandardMaterial({ color: '#d8481e', roughness: 0.5, metalness: 0.35 }));
      const band = this.track(new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.4, metalness: 0.5 }));
      const cy = new THREE.CylinderGeometry(0.85, 0.85, 2.2, 20); cy.rotateX(Math.PI / 2);
      const bodyMesh = new THREE.Mesh(cy, barrel); bodyMesh.castShadow = true; grp.add(bodyMesh);
      for (const zz of [-0.7, 0.7]) { const bd = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.07, 8, 24), band); bd.position.z = zz; grp.add(bd); }
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 2.25), this.track(new THREE.MeshStandardMaterial({ color: '#ffd23a', emissive: '#ff9a00', emissiveIntensity: 0.4 })));
      mark.position.y = 0.55; grp.add(mark);
      grp.position.set(h.x, 0.85, h.z); g.add(grp); h.obj = grp;
      return;
    }
    if (h.type === 'saw') {
      const grp = new THREE.Group();
      const metal = this.track(new THREE.MeshStandardMaterial({ color: '#c8d0dc', metalness: 0.85, roughness: 0.28 }));
      const glow = this.track(new THREE.MeshBasicMaterial({ color: '#ff5a2a' }));
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.14, 28), metal); disc.castShadow = true; grp.add(disc);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 4), metal);
        tooth.position.set(Math.cos(a) * 1.15, 0, Math.sin(a) * 1.15); tooth.rotation.z = -Math.PI / 2; tooth.rotation.y = -a; tooth.castShadow = true; grp.add(tooth);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 8, 24), glow); ring.rotation.x = Math.PI / 2; ring.position.y = 0.1; grp.add(ring);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.3, 10), glow); grp.add(hub);
      grp.position.set(h.x, 0.65, h.z); g.add(grp); h.obj = grp;
      if (!h._rail) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W, 0.06, 0.5), this.track(new THREE.MeshStandardMaterial({ color: '#1b1f2a', roughness: 0.6 })));
        rail.position.set(0, 0.04, h.z); g.add(rail); h._rail = true;
      }
    } else {
      const w = h.x1 - h.x0, cx = (h.x0 + h.x1) / 2;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, 2.2), this.track(new THREE.MeshStandardMaterial({ color: '#2a1c22', emissive: '#ff2a3a', emissiveIntensity: 0.35, roughness: 0.6 })));
      plate.position.set(cx, 0.07, h.z); g.add(plate);
      const cols = Math.max(2, Math.floor(w / 0.55)), rows = 3, n = cols * rows;
      const sp = new THREE.InstancedMesh(new THREE.ConeGeometry(0.2, 0.95, 6), this.track(new THREE.MeshStandardMaterial({ color: '#e8eef8', metalness: 0.8, roughness: 0.3, emissive: '#ff2a3a', emissiveIntensity: 0.4 })), n);
      const o = this._o; let k = 0;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        o.position.set(h.x0 + (i + 0.5) * (w / cols), 0.55, h.z - 0.8 + j * 0.8); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); sp.setMatrixAt(k++, o.matrix);
      }
      sp.frustumCulled = false; sp.castShadow = true; g.add(sp);
    }
  }

  buildPad(g, p) {
    const tex = this.track(textTex(256, 256, (cx, w, h) => {
      const gr = cx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, 125); gr.addColorStop(0, 'rgba(130,255,160,1)'); gr.addColorStop(0.7, 'rgba(40,200,90,.9)'); gr.addColorStop(1, 'rgba(20,120,60,0)');
      cx.fillStyle = gr; cx.fillRect(0, 0, w, h); cx.strokeStyle = '#fff'; cx.lineWidth = 14; cx.lineJoin = 'round';
      for (const dy of [30, -20]) { cx.beginPath(); cx.moveTo(60, h / 2 + 30 + dy); cx.lineTo(w / 2, h / 2 - 30 + dy); cx.lineTo(w - 60, h / 2 + 30 + dy); cx.stroke(); }
    }));
    const mat = this.track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), mat); m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.06, p.z); g.add(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.09, 8, 32), new THREE.MeshBasicMaterial({ color: '#8dffb0' })); ring.rotation.x = Math.PI / 2; ring.position.set(p.x, 0.1, p.z); g.add(ring);
    p.obj = m; p.ring = ring; p.mat = mat;
  }
  buildStrip(g, s) {
    const tex = this.track(textTex(256, 256, (cx, w, h) => {
      cx.fillStyle = 'rgba(20,20,30,.55)'; cx.fillRect(0, 0, w, h);
      for (let i = 0; i < 3; i++) { cx.fillStyle = '#ffd23a'; cx.beginPath(); const y = 200 - i * 70; cx.moveTo(30, y); cx.lineTo(w / 2, y - 60); cx.lineTo(w - 30, y); cx.lineTo(w - 30, y + 28); cx.lineTo(w / 2, y - 32); cx.lineTo(30, y + 28); cx.fill(); }
    }));
    const mat = this.track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W - 0.8, 5), mat); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.05, s.z); g.add(m);
    s.obj = m; s.mat = mat;
  }

  buildCoins(g, coins) {
    if (!coins.length) { this.coinMesh = null; return; }
    const geo = new THREE.CylinderGeometry(0.34, 0.34, 0.09, 18); geo.rotateX(Math.PI / 2);
    this.coinMesh = new THREE.InstancedMesh(geo, this.track(new THREE.MeshStandardMaterial({ color: '#ffc61a', emissive: '#ff9a00', emissiveIntensity: 0.55, metalness: 0.7, roughness: 0.25 })), coins.length);
    this.coinMesh.frustumCulled = false; g.add(this.coinMesh);
    coins.forEach((c, i) => { c.i = i; this.setCoin(c, 0); });
  }
  setCoin(c, t) {
    const o = this._o; o.position.set(c.x, c.y + Math.sin(t * 3 + c.ph) * 0.1, c.z); o.rotation.set(0, t * 3 + c.ph, 0); o.scale.set(1, 1, 1); o.updateMatrix();
    this.coinMesh.setMatrixAt(c.i, o.matrix);
  }
  hideCoin(c) { this.coinMesh.setMatrixAt(c.i, this._zero); this.coinMesh.instanceMatrix.needsUpdate = true; }

  buildBoxes(g, boxes) {
    if (!boxes.length) { this.boxMesh = null; return; }
    const mat = this.track(new THREE.MeshStandardMaterial({ map: this.mystery, emissive: '#ff9a1a', emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.3 }));
    this.boxMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.35, 1.35, 1.35), mat, boxes.length);
    this.boxMesh.frustumCulled = false; this.boxMesh.castShadow = true; g.add(this.boxMesh);
    boxes.forEach((b, i) => { b.i = i; this.setBox(b, 0); });
  }
  setBox(b, t) {
    const o = this._o; o.position.set(b.x, b.y + Math.sin(t * 2 + b.ph) * 0.2, b.z); o.rotation.set(0.25 * Math.sin(t + b.ph), t * 1.4 + b.ph, 0); o.scale.set(1, 1, 1); o.updateMatrix();
    this.boxMesh.setMatrixAt(b.i, o.matrix);
  }
  hideBox(b) { this.boxMesh.setMatrixAt(b.i, this._zero); this.boxMesh.instanceMatrix.needsUpdate = true; }

  buildWeapons(g, list) {
    this.wlists = [];
    for (const type of ['gun', 'bomb']) {
      const arr = list.filter(x => x.type === type); if (!arr.length) continue;
      const tex = this.track(textTex(128, 128, (cx, w, h) => {
        cx.fillStyle = type === 'gun' ? '#1d3a63' : '#6b1a1a'; cx.fillRect(0, 0, w, h);
        cx.strokeStyle = type === 'gun' ? '#58a6ff' : '#ff6a4a'; cx.lineWidth = 8; cx.strokeRect(5, 5, w - 10, h - 10);
        cx.fillStyle = '#fff';
        if (type === 'gun') { cx.fillRect(18, 40, 84, 22); cx.fillRect(18, 34, 56, 10); cx.beginPath(); cx.moveTo(30, 62); cx.lineTo(54, 62); cx.lineTo(46, 100); cx.lineTo(24, 100); cx.fill(); cx.fillRect(100, 44, 14, 12); }
        else { cx.beginPath(); cx.arc(64, 72, 30, 0, 7); cx.fill(); cx.fillRect(58, 30, 12, 14); cx.strokeStyle = '#ffd23a'; cx.lineWidth = 6; cx.beginPath(); cx.moveTo(70, 32); cx.quadraticCurveTo(92, 18, 98, 34); cx.stroke(); cx.fillStyle = '#ffd23a'; cx.beginPath(); cx.arc(99, 34, 7, 0, 7); cx.fill(); }
      }));
      const mat = this.track(new THREE.MeshStandardMaterial({ map: tex, emissive: type === 'gun' ? '#2a6fd0' : '#d03a1a', emissiveIntensity: 0.55, roughness: 0.5, metalness: 0.3 }));
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.25, 1.25, 1.25), mat, arr.length);
      mesh.frustumCulled = false; mesh.castShadow = true; g.add(mesh);
      arr.forEach((w2, i) => { w2.i = i; w2.mesh = mesh; this.setWeapon(w2, 0); });
      this.wlists.push({ mesh, arr });
    }
  }
  setWeapon(w, t) {
    const o = this._o; o.position.set(w.x, w.y + Math.sin(t * 2.4 + w.ph) * 0.18, w.z); o.rotation.set(0, t * 1.6 + w.ph, 0); o.scale.set(1, 1, 1); o.updateMatrix();
    w.mesh.setMatrixAt(w.i, o.matrix);
  }
  hideWeapon(w) { w.mesh.setMatrixAt(w.i, this._zero); w.mesh.instanceMatrix.needsUpdate = true; }

  buildArena(g, th, bossZ, lvl) {
    const L = lvl.length;
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(17, 18.5, 1.6, 44), this.track(new THREE.MeshStandardMaterial({ color: new THREE.Color(ROAD_BASE[th.road]).multiplyScalar(0.9), roughness: 0.9 })));
    plat.position.set(0, -0.8, bossZ - 2); plat.receiveShadow = true; g.add(plat);
    const top = new THREE.Mesh(new THREE.CircleGeometry(16.6, 44), new THREE.MeshStandardMaterial({ map: this.track(textTex(256, 256, (cx, w, h) => {
      cx.fillStyle = ROAD_BASE[th.road]; cx.fillRect(0, 0, w, h);
      cx.strokeStyle = th.edge; cx.lineWidth = 5; cx.globalAlpha = 0.9;
      for (let i = 1; i <= 4; i++) { cx.beginPath(); cx.arc(w / 2, h / 2, i * 28, 0, 7); cx.stroke(); }
      cx.globalAlpha = 0.5; for (let a = 0; a < 12; a++) { cx.beginPath(); cx.moveTo(w / 2, h / 2); cx.lineTo(w / 2 + Math.cos(a / 12 * 6.283) * 120, h / 2 + Math.sin(a / 12 * 6.283) * 120); cx.stroke(); }
    })), roughness: 0.7 }));
    top.rotation.x = -Math.PI / 2; top.position.set(0, 0.01, bossZ - 2); top.receiveShadow = true; g.add(top);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(17, 0.28, 8, 64), new THREE.MeshBasicMaterial({ color: th.edge })); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.2, bossZ - 2); g.add(ring);
    this.arenaRing = ring;
    const az = -(L + 14);
    const pm = this.track(new THREE.MeshStandardMaterial({ color: new THREE.Color(ROAD_BASE[th.road]).multiplyScalar(1.2), roughness: 0.8, flatShading: true }));
    const arch = new THREE.Group(); g.add(arch); this.arch = arch;   // the entrance arch: hidden once the boss starts to walk in, so it never blocks the fight
    [-1, 1].forEach(s => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 15, 0.9), pm); p.position.set(s * (HW + 0.6), 7.5, az); p.castShadow = true; arch.add(p); });
    const ban = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 0.6, 2.6, 0.5), this.track(new THREE.MeshBasicMaterial({ map: this.track(bannerTexture(lvl.boss.name, ['#c4122a', '#8a1ac4', '#c46a12', '#c49a12'][lvl.boss.tier], ['#ff7a1a', '#ff4fd8', '#ff3a2a', '#fff08a'][lvl.boss.tier])) })));
    ban.position.set(0, 15.5, az); arch.add(ban);
    const flame = new THREE.MeshBasicMaterial({ color: '#ffa24a' }); this.track(flame);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, x = Math.cos(a) * 15.6, z = bossZ - 2 + Math.sin(a) * 15.6;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 2.6, 6), pm); post.position.set(x, 1.3, z); g.add(post);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.1, 6), flame); fl.position.set(x, 3.1, z); g.add(fl);
    }
  }

  hideArch() { if (this.arch) this.arch.visible = false; }
  flashGate(gt, side) { if (gt.panels && gt.panels[side]) gt.panels[side].flash = 1; }

  update(dt, t, cam, scale, focusZ) {
    this.t = t;
    this.sky.position.copy(cam.position);
    this.skyMat.uniforms.uT.value = t;
    this.waterMat.uniforms.uT.value = t; this.waterMat.uniforms.uCam.value.copy(cam.position);
    this.ambient.update(t, cam, scale);
    if (this.dir.castShadow) {
      const snap = 84 / this.shadowSize, tz = Math.round((focusZ - 6) / snap) * snap;
      this.dir.target.position.set(0, 0, tz); this.dir.position.copy(this.dir.target.position).addScaledVector(this.lightVec, 80);
    }
    if (this.arenaRing) this.arenaRing.material.color.set(this.theme.edge).multiplyScalar(0.8 + 0.4 * Math.sin(t * 3));
    for (const gt of this.gates) {
      if (!gt.panels) continue;
      gt.panels.forEach(p => {
        if (p.flash > 0) p.flash = Math.max(0, p.flash - dt * 2.2);
        p.mesh.scale.setScalar(1 + p.flash * 0.18);
        p.mat.opacity = 0.9 + 0.1 * Math.sin(t * 3 + gt.z) + p.flash * 0.1;
        p.mat.color.setScalar(1 + p.flash * 1.5);
      });
    }
    for (const h of this.hazards) {
      if (h.type === 'saw' && h.obj) { h.x = h.cx + h.amp * Math.sin(t * h.sp + h.ph); h.obj.position.x = h.x; h.obj.rotation.y = t * 14; }
      else if (h.type === 'roller' && h.obj) { h.x = h.cx + h.amp * Math.sin(t * h.sp + h.ph); h.obj.position.x = h.x; h.obj.rotation.z = -h.x / 0.85; }
    }
    for (const p of this.pads) { if (p.glow > 0) p.glow = Math.max(0, p.glow - dt * 1.5); if (p.mat) p.mat.opacity = 0.75 + 0.25 * Math.sin(t * 5 + p.z) + p.glow; if (p.ring) p.ring.scale.setScalar(1 + 0.08 * Math.sin(t * 6 + p.z) + p.glow * 0.6); }
    for (const s of this.strips) { if (s.glow > 0) s.glow = Math.max(0, s.glow - dt * 1.5); if (s.mat) s.mat.opacity = 0.7 + 0.3 * Math.sin(t * 8 - s.z * 0.5) + s.glow; }
    const cz = cam.position.z;
    if (this.coinMesh) {
      let dirty = false;
      for (const c of this.coins) { if (c.taken || Math.abs(c.z - cz) > 70) continue; this.setCoin(c, t); dirty = true; }
      if (dirty) this.coinMesh.instanceMatrix.needsUpdate = true;
    }
    if (this.boxMesh) {
      let dirty = false;
      for (const b of this.boxes) { if (b.taken || Math.abs(b.z - cz) > 70) continue; this.setBox(b, t); dirty = true; }
      if (dirty) this.boxMesh.instanceMatrix.needsUpdate = true;
    }
    for (const wl of this.wlists) {
      let dirty = false;
      for (const x of wl.arr) { if (x.taken || Math.abs(x.z - cz) > 70) continue; this.setWeapon(x, t); dirty = true; }
      if (dirty) wl.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const f of this.fleets) f.update(t, cz);
    if (this.fx && this.craters.length) {
      for (const c of this.craters) if (Math.abs(c.z - cz) < 220 && Math.random() < dt * 5) this.fx.sparks.emit(c.x, c.y, c.z, '#ff8a2a', 3, 16, 0.9, 2.6, -6, 2.6, 4);
    }
  }
}
