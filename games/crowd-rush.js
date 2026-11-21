/* Crowd Rush Legends: lead a crowd of real, motion-captured runners through + and × gates, crush rival crowds,
   dodge traps and defeat the giant boss. Three.js; every person shares a handful of animated skeletons, so a crowd of
   dozens costs only a few animation updates. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { clamp, lerp, fmt } from './cr-util.js';
import { genLevel, ROAD_W } from './cr-level.js';
import { World, THEMES, EDGE } from './cr-world.js';
import { Bursts } from './cr-fx.js';
import * as Snd from './cr-audio.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer:coarse)').matches;

/* ---------- tuning ---------- */
/* Quality tiers. pr = render scale cap, P/E = most runners drawn for the player / a rival crowd, hi = how many runners
   per crowd use the full 11,000-triangle model (the rest use a light copy), deco = amount of scenery. */
const QUAL = [
  { pr: isTouch ? 1 : 0.85, P: 22, E: 8, hi: 0, deco: 0.5, shadow: 0 },
  { pr: isTouch ? 1.5 : 1, P: isTouch ? 32 : 36, E: 12, hi: 6, deco: 0.8, shadow: 1024 },
  { pr: isTouch ? 2 : 1.5, P: isTouch ? 42 : 56, E: 18, hi: 14, deco: 1, shadow: 2048 }
];
const POOL_N = QUAL[2].P + QUAL[2].E * 2 + 8;
/* Read the graphics card name once: integrated / older cards start on a lighter tier. */
function gpuName() {
  try {
    const c = document.createElement('canvas'), g = c.getContext('webgl2'); const e = g.getExtension('WEBGL_debug_renderer_info');
    const n = e ? String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)) : ''; const l = g.getExtension('WEBGL_lose_context'); if (l) l.loseContext(); return n;
  } catch (err) { return ''; }
}
const GPU = gpuName();
const STRONG_GPU = /RTX|GTX 1[0-9]|GTX 16|GTX 9[0-9]0|RX [5-9]ddd|RX 6|RX 7|Arc A|Apple M|Radeon Pro/i.test(GPU) && !/Vega|Graphics/i.test(GPU);
const WEAK_GPU = /Intel|UHD|HD Graphics|Iris|Vega|Radeon(TM) Graphics|Radeon 5dd|R[2-7] |Mali-(T|G3|G5[0-2])|Adreno( (TM))? [1-5]dd|PowerVR|SwiftShader/i.test(GPU);
let savedQ = 2; try { const sv = JSON.parse(localStorage.getItem('rovatics.crowdrush.v1') || '{}'); if (typeof sv.q === 'number') savedQ = clamp(sv.q | 0, 0, 2); } catch (err) { /* private mode */ }
let Q = params.has('q') ? clamp(+params.get('q') | 0, 0, 2) : Math.min(isTouch ? (WEAK_GPU ? 0 : 1) : (STRONG_GPU ? 2 : (WEAK_GPU ? 0 : 1)), savedQ);
const RUN_N = 6, IDLE_N = 3;
const FORM_C = 0.38, PS = 1.15, GOLD = 2.39996;
const JUMP_H = 3.4, JUMP_DUR = 1.3;            // a jump clears blades and reaches the coins and boxes in the air
const SPEED_MIN = 0.4, SPEED_MAX = 2.2;
const YAW0 = params.has('yaw') ? +params.get('yaw') : 0;   // the model natively faces -Z, the way we run
const SKINS = [
  { c: '#3b82ff', cost: 0 }, { c: '#ff9a2e', cost: 120 }, { c: '#2fd36b', cost: 120 },
  { c: '#b061ff', cost: 250 }, { c: '#22d8d0', cost: 250 }, { c: '#ffd23a', cost: 400 }
];
const TEAM_COL = { enemy: '#ff3a4a', neutral: '#ffe9a0' };

/* ---------- save ---------- */
const SAVE_KEY = 'rovatics.crowdrush.v1';
const save = { level: 1, coins: 0, upStart: 0, upGold: 0, skin: 0, skins: [1, 0, 0, 0, 0, 0], muted: false };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* private mode */ }
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } };
const costStart = () => Math.round(40 * Math.pow(1.5, save.upStart));
const costGold = () => Math.round(35 * Math.pow(1.55, save.upGold));

let lastHap = 0;
function haptic(kind) {
  const n = performance.now(); if (n - lastHap < 70) return; lastHap = n;
  try { if (window.RovaticsApp && window.RovaticsApp.haptic) window.RovaticsApp.haptic(kind); } catch (e) { /* no bridge */ }
}

/* ---------- renderer, scene, camera ---------- */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch && Q >= 2, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 380);
const world = new World(scene, renderer, { decorScale: QUAL[Q].deco * (isTouch ? 0.75 : 1), ambientCount: Q >= 2 ? 180 : 90 });
const sparks = new Bursts(scene, 700, true);
const bits = new Bursts(scene, 500, false);
world.fx = { sparks, bits };
world.setShadows(QUAL[Q].shadow);
let W = 1, H = 1, pointScale = 600;
function resize() {
  W = window.innerWidth; H = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUAL[Q].pr));
  renderer.setSize(W, H, false);
  camera.aspect = W / H; camera.updateProjectionMatrix();
  pointScale = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  sparks.setScale(pointScale); bits.setScale(pointScale);
}
window.addEventListener('resize', resize);

/* ---------- audio / sound toggle ---------- */
Snd.setMuted(!!save.muted);
function refreshMute() { $('muteBtn').textContent = save.muted ? '🔇' : '🔊'; }

/* ---------- model, shared animated skeletons, people ---------- */
let gltf = null, bodyGeo = null, bodyGeoLow = null, baseMat = null;
const runMasters = [], idleMasters = [];
const mats = {};
let pool = null, shadows = null, rings = null, bossObj = null;
const teamColors = { player: new THREE.Color('#3b82ff'), enemy: new THREE.Color(TEAM_COL.enemy), neutral: new THREE.Color(TEAM_COL.neutral) };
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _iq = new THREE.Quaternion();
const Y_UP = new THREE.Vector3(0, 1, 0);
const _eu = new THREE.Euler();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

function teamMaterial(hex, mix, emissive) {
  const m = baseMat.clone();
  m.roughness = 0.62; m.metalness = 0.05; m.envMapIntensity = 0.22;
  m.emissive = new THREE.Color(emissive || 0x000000);
  const uTeam = { value: new THREE.Color(hex) }, uMix = { value: mix };
  m.userData.uTeam = uTeam;
  m.onBeforeCompile = sh => {
    sh.uniforms.uTeam = uTeam; sh.uniforms.uMix = uMix;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uTeam; uniform float uMix;')
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv );
          float lum = dot( sampledDiffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
          float l2 = pow(clamp(lum * 1.5, 0.0, 1.0), 1.25); vec3 tc = uTeam * ( 0.1 + l2 * 1.05 ) + uTeam * uTeam * 0.12;
          diffuseColor.rgb = mix( sampledDiffuseColor.rgb, tc, uMix );
          diffuseColor.a *= sampledDiffuseColor.a;
        #endif`);
  };
  m.customProgramCacheKey = () => 'crowdTeam';
  return m;
}

/* A light copy of the runner for the back of the crowd: vertices that fall in the same small cell (and same texture
   patch) are merged into one, keeping that vertex's skinning, so it animates on the same skeleton. */
function clusterGeometry(g, cell, uvCell) {
  const pos = g.attributes.position, uv = g.attributes.uv, idx = g.index.array, map = new Map(), remap = new Int32Array(pos.count), reps = [];
  for (let i = 0; i < pos.count; i++) {
    const key = Math.round(pos.getX(i) / cell) + ',' + Math.round(pos.getY(i) / cell) + ',' + Math.round(pos.getZ(i) / cell) + '|' + Math.round(uv.getX(i) / uvCell) + ',' + Math.round(uv.getY(i) / uvCell);
    let r = map.get(key); if (r === undefined) { r = reps.length; reps.push(i); map.set(key, r); } remap[i] = r;
  }
  const out = [], seen = new Set();
  for (let t = 0; t < idx.length; t += 3) {
    const a = remap[idx[t]], b = remap[idx[t + 1]], c = remap[idx[t + 2]];
    if (a === b || b === c || a === c) continue;
    const k = [a, b, c].sort((x, y) => x - y).join(','); if (seen.has(k)) continue; seen.add(k); out.push(a, b, c);
  }
  const ng = new THREE.BufferGeometry();
  for (const name of Object.keys(g.attributes)) {
    const at = g.attributes[name], arr = new at.array.constructor(reps.length * at.itemSize);   // getComponent: attributes may be interleaved
    for (let i = 0; i < reps.length; i++) for (let k = 0; k < at.itemSize; k++) arr[i * at.itemSize + k] = at.getComponent(reps[i], k);
    ng.setAttribute(name, new THREE.BufferAttribute(arr, at.itemSize, at.normalized));
  }
  ng.setIndex(out); ng.boundingSphere = g.boundingSphere; ng.boundingBox = g.boundingBox;
  return ng;
}

function makeMaster(kind, i, n) {
  const root = SkeletonUtils.clone(gltf.scene);
  root.visible = false; scene.add(root);
  const skeleton = root.getObjectByName('vanguard_Mesh').skeleton;
  const mixer = new THREE.AnimationMixer(root);
  const clip = THREE.AnimationClip.findByName(gltf.animations, kind === 'run' ? 'Run' : 'Idle');
  const act = mixer.clipAction(clip); act.play(); act.time = (i / n) * clip.duration;
  return { root, skeleton, mixer, speed: kind === 'run' ? 1.35 + (i % 3) * 0.1 : 0.9 + i * 0.08 };
}

function initPeople() {
  const body = gltf.scene.getObjectByName('vanguard_Mesh');
  bodyGeo = body.geometry; baseMat = body.material; bodyGeoLow = clusterGeometry(bodyGeo, 3.6, 0.045);
  console.log('runner model triangles: full', bodyGeo.index.count / 3, 'light', bodyGeoLow.index.count / 3);
  mats.player = teamMaterial(SKINS[save.skin].c, 0.8);
  mats.player.emissive.set(SKINS[save.skin].c).multiplyScalar(0.03);
  mats.enemy = teamMaterial(TEAM_COL.enemy, 0.6, 0x200000);
  mats.neutral = teamMaterial(TEAM_COL.neutral, 0.3);
  mats.boss = teamMaterial('#7a1030', 0.7, 0x000000);
  teamColors.player.set(SKINS[save.skin].c);
  for (let i = 0; i < RUN_N; i++) runMasters.push(makeMaster('run', i, RUN_N));
  for (let i = 0; i < IDLE_N; i++) idleMasters.push(makeMaster('idle', i, IDLE_N));

  const sg = new THREE.CircleGeometry(0.62, 14); sg.rotateX(-Math.PI / 2);
  shadows = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false }), POOL_N);
  shadows.frustumCulled = false; shadows.renderOrder = 2; scene.add(shadows);
  const rg = new THREE.RingGeometry(0.46, 0.64, 24); rg.rotateX(-Math.PI / 2);
  rings = new THREE.InstancedMesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }), POOL_N);
  rings.frustumCulled = false; rings.renderOrder = 3; scene.add(rings);
  for (let i = 0; i < POOL_N; i++) { rings.setMatrixAt(i, ZERO); rings.setColorAt(i, teamColors.player); }
  pool = { items: [], free: [] };
  for (let i = 0; i < POOL_N; i++) {
    const mesh = new THREE.SkinnedMesh(bodyGeo, mats.player);
    mesh.bindMode = THREE.DetachedBindMode;
    mesh.bind(runMasters[i % RUN_N].skeleton, new THREE.Matrix4());
    mesh.frustumCulled = false; mesh.visible = false; mesh.receiveShadow = true; scene.add(mesh);
    const it = { i, mesh, mi: i % RUN_N };
    pool.items.push(it); pool.free.push(it); shadows.setMatrixAt(i, ZERO);
  }
  pool.free.reverse();

  /* the boss: one giant of the same model with its own idle + walk animation */
  const root = SkeletonUtils.clone(gltf.scene); root.visible = false; scene.add(root);
  const mixer = new THREE.AnimationMixer(root);
  const idle = mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, 'Idle'));
  const walk = mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, 'Walk'));
  idle.play(); walk.play(); idle.setEffectiveWeight(1); walk.setEffectiveWeight(0);
  const mesh = new THREE.SkinnedMesh(bodyGeo, mats.boss);
  mesh.bindMode = THREE.DetachedBindMode; mesh.bind(root.getObjectByName('vanguard_Mesh').skeleton, new THREE.Matrix4());
  mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
  const crown = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: '#ffcc22', emissive: '#ff9900', emissiveIntensity: 0.8, metalness: 0.8, roughness: 0.3, flatShading: true });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 4), gold);
    sp.position.set(Math.cos(a) * 0.55, 0.45, Math.sin(a) * 0.55); crown.add(sp);
  }
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.3, 10), gold); crown.add(band);
  crown.scale.setScalar(1.7); crown.visible = false; scene.add(crown);
  bossObj = { root, mixer, idle, walk, mesh, crown, w: 0 };
}

function poolTake(team) {
  const it = pool.free.pop(); if (!it) return null;
  it.mesh.material = mats[team]; it.mesh.visible = true; return it;
}
function poolGive(it) { it.mesh.visible = false; shadows.setMatrixAt(it.i, ZERO); rings.setMatrixAt(it.i, ZERO); pool.free.push(it); }

/* ---------- labels, floating text, banners ---------- */
const labelsEl = $('labels');
function makeLabel(kind) {
  const el = document.createElement('div');
  el.className = 'lbl ' + kind;
  if (kind === 'neutral') { el.style.background = 'linear-gradient(#7cff8a,#18c25a)'; el.style.fontSize = '18px'; }
  el.style.display = 'none'; labelsEl.appendChild(el); return el;
}
function toScreen(x, y, z) {
  _v.set(x, y, z).project(camera);
  return { x: (_v.x * 0.5 + 0.5) * W, y: (-_v.y * 0.5 + 0.5) * H, ok: _v.z < 1 && _v.z > -1 };
}
function placeLabel(el, x, y, z) {
  const s = toScreen(x, y, z);
  if (!s.ok || s.x < -80 || s.x > W + 80 || s.y < -60 || s.y > H + 40) { el.style.display = 'none'; return; }
  el.style.display = ''; el.style.transform = `translate(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px) translate(-50%,-100%)`;
}
function floatText(text, color, x, y, z) {
  const s = toScreen(x, y, z); if (!s.ok) return;
  const el = document.createElement('div'); el.className = 'float'; el.textContent = text; el.style.color = color;
  el.style.left = s.x + 'px'; el.style.top = s.y + 'px'; labelsEl.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
function showBanner(text) { const b = $('banner'); b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
function flashScreen(color, a) {
  const f = $('flash'); f.style.transition = 'none'; f.style.background = color; f.style.opacity = a; void f.offsetWidth;
  f.style.transition = 'opacity .35s'; f.style.opacity = 0;
}

/* ---------- crowds ---------- */
class Crowd {
  constructor(team, capFn, dir) {
    this.team = team; this.capFn = capFn; this.dir = dir;
    this.persons = []; this.count = 0; this.x = 0; this.z = 0; this.radius = 0.6;
    this.active = false; this.running = false; this.fighting = false; this.cheer = false; this.charging = false; this.done = false;
    this.tick = 0; this.fightT = 0;
    this.label = makeLabel(team === 'enemy' ? 'foe' : team === 'player' ? 'me' : 'neutral');
  }
  hex() { return team_hex(this.team); }
  activate() { if (this.active) return; this.active = true; this.syncVisual(true); }
  setCount(n) { this.count = Math.max(0, Math.round(n)); this.syncVisual(false); this.pop(); }
  syncVisual(snap) {
    const target = this.active ? Math.min(this.count, this.capFn()) : 0;
    while (this.persons.length < target) { if (!this.addPerson(snap)) break; }
    while (this.persons.length > target) this.removePerson();
    this.radius = FORM_C * Math.sqrt(Math.max(1, this.persons.length)) + 0.35;
  }
  addPerson(snap) {
    const it = poolTake(this.team); if (!it) return false;
    const slot = this.persons.length;
    const p = { o: it, slot, x: this.x, y: 0, z: this.z, s: snap ? 1 : 0, jx: (Math.random() - 0.5) * 0.22, jz: (Math.random() - 0.5) * 0.22, ph: Math.random() * 6.28, jo: (Math.random() - 0.5) * 0.1 };
    if (snap) { const a = slot * GOLD, rr = FORM_C * Math.sqrt(slot + 0.5); p.x = this.x + Math.cos(a) * rr; p.z = this.z + Math.sin(a) * rr; if (this.team !== 'player') p.x = clamp(p.x, -3.85, 3.85); }
    this.persons.push(p); return true;
  }
  /* Someone stepped off the road: they tumble down and are lost when they reach the water, lava or ground below. */
  startFall(p) {
    p.fall = true; p.age = 0; p.y = Math.max(0, p.y || 0); p.vy = 1.5 + Math.random();
    p.vx = Math.sign(p.x || 1) * (1.2 + Math.random() * 1.8); p.vz = -(0.5 + Math.random() * 2); p.tx = (Math.random() - 0.5) * 9; p.tz = (Math.random() - 0.5) * 9;
    haptic('tick');
    if (!G.fellTip && G.lvl && G.lvl.n <= 6) { G.fellTip = true; showTip('⚠ STAY ON THE ROAD!'); }
  }
  finishFall(p, k) {
    const per = Math.max(1, Math.round(this.count / Math.max(1, this.persons.length)));
    dropFx(p.x, p.z);
    poolGive(p.o);
    const last = this.persons.pop();
    if (last !== p) { this.persons[k] = last; last.slot = k; }
    this.count = Math.max(0, this.count - per);
    this.syncVisual(false); this.pop();
    G.fallen = (G.fallen || 0) + per;
  }
  removePerson(at) {
    let k = at ? this.persons.indexOf(at) : -1;
    if (k < 0) k = (Math.random() * this.persons.length) | 0;
    const p = this.persons[k]; if (!p) return;
    poof(p.x, p.z, this.hex()); poolGive(p.o);
    const last = this.persons.pop();
    if (last !== p) { this.persons[k] = last; last.slot = k; }
  }
  hit(k, at) {
    const before = this.persons.length;
    this.count = Math.max(0, this.count - k);
    const target = this.active ? Math.min(this.count, this.capFn()) : 0;
    let first = true;
    while (this.persons.length > target) { this.removePerson(first ? at : undefined); first = false; }
    if (this.persons.length === before && before > 0) { const p = this.persons[(Math.random() * before) | 0]; poof(p.x, p.z, this.hex()); }
    this.radius = FORM_C * Math.sqrt(Math.max(1, this.persons.length)) + 0.35;
    this.pop();
  }
  pop() {
    const el = this.label; el.textContent = fmt(this.count);
    el.classList.add('pop'); clearTimeout(this._pt); this._pt = setTimeout(() => el.classList.remove('pop'), 130);
  }
  update(dt, t) {
    if (!this.active) return;
    const isP = this.team === 'player';
    const f = 1 - Math.exp(-dt * (this.fighting ? 5 : 10));
    const yawBase = YAW0 + (this.dir > 0 ? Math.PI : 0);
    const jumping = isP && G.jump.t >= 0;
    const onRoad = isP && G.boss && G.state !== 'home' && G.state !== 'result';
    const arenaZ = G.boss ? G.boss.z + 20 : -1e9;
    for (let k = this.persons.length - 1; k >= 0; k--) {
      const p = this.persons[k], o = p.o, m = o.mesh;
      if (p.fall) {
        p.age += dt; p.vy -= 22 * dt; p.y += p.vy * dt; p.x += p.vx * dt; p.z += p.vz * dt;
        if (p.y < world.drop.y - 0.35) { this.finishFall(p, k); continue; }
        m.position.set(p.x, p.y, p.z);
        _q.setFromEuler(_eu.set(p.age * p.tx, yawBase, p.age * p.tz)); m.quaternion.copy(_q);
        m.scale.setScalar(PS);
        const skf = runMasters[o.mi].skeleton; if (m.skeleton !== skf) m.skeleton = skf;
        shadows.setMatrixAt(o.i, ZERO); rings.setMatrixAt(o.i, ZERO);
        continue;
      }
      const a = p.slot * GOLD, rr = FORM_C * Math.sqrt(p.slot + 0.5);
      let tx = this.x + Math.cos(a) * rr + p.jx; const tz = this.z + Math.sin(a) * rr + p.jz;
      if (!isP) tx = clamp(tx, -3.85, 3.85);
      p.x += (tx - p.x) * f; p.z += (tz - p.z) * f; p.s = Math.min(1, p.s + dt * 4);
      let y = 0;
      if (jumping) { const u = (G.jump.t + p.jo) / JUMP_DUR; if (u > 0 && u < 1) y = JUMP_H * 4 * u * (1 - u); }
      if (this.cheer) y = Math.abs(Math.sin(t * 7 + p.ph)) * 0.7;
      p.y = y;
      if (onRoad && y < 0.05 && p.s > 0.6 && Math.abs(p.x) > EDGE && p.z > arenaZ) { this.startFall(p); continue; }
      m.position.set(p.x, y, p.z);
      _q.setFromAxisAngle(Y_UP, yawBase + Math.sin(t * 3 + p.ph) * 0.1 + (this.fighting ? Math.sin(t * 9 + p.ph) * 0.5 : 0));
      m.quaternion.copy(_q);
      m.scale.setScalar(PS * (0.15 + 0.85 * p.s));
      const sk = (this.running && !this.cheer ? runMasters[o.mi] : idleMasters[o.mi % IDLE_N]).skeleton;
      if (m.skeleton !== sk) m.skeleton = sk;
      const gw = k < QUAL[Q].hi ? bodyGeo : bodyGeoLow; if (m.geometry !== gw) m.geometry = gw;
      _v.set(p.x, 0.04, p.z); _s.setScalar(p.s * (1 - Math.min(0.6, y * 0.2)));
      _m.compose(_v, _iq, _s); shadows.setMatrixAt(o.i, _m); rings.setMatrixAt(o.i, _m); rings.setColorAt(o.i, teamColors[this.team]);
    }
  }
  release() {
    for (const p of this.persons) poolGive(p.o);
    this.persons.length = 0; this.active = false; this.label.remove();
  }
}
function team_hex(team) { return team === 'player' ? SKINS[save.skin].c : TEAM_COL[team]; }
/* Splash, fire or dust where someone lands after falling off the road. */
function dropFx(x, z) {
  const y = world.drop.y, kind = world.drop.kind;
  if (kind === 'water') { sparks.emit(x, y + 0.2, z, '#cfeeff', 12, 5.5, 0.3, 0.7, -9, 1.5); bits.emit(x, y + 0.1, z, '#ffffff', 8, 3, 0.5, 0.9, -5, 1.2); Snd.sfx.splash(); }
  else if (kind === 'lava') { sparks.emit(x, y + 0.3, z, '#ff8a2a', 18, 8, 0.34, 1.0, -6, 1.7); bits.emit(x, y + 0.2, z, '#40302c', 6, 3, 0.7, 1.4, -1, 1.2); Snd.sfx.sizzle(); }
  else { bits.emit(x, y + 0.2, z, '#cdbd9a', 12, 4, 0.7, 1.0, -2, 0.8); sparks.emit(x, y + 0.2, z, '#ffeeb0', 4, 3, 0.2, 0.4); Snd.sfx.thud(); }
}
function poof(x, z, hex) {
  sparks.emit(x, 1.0, z, hex, 5, 4.5, 0.2, 0.5);
  bits.emit(x, 0.5, z, '#ffffff', 3, 2.5, 0.28, 0.6, -3, 0.4);
  Snd.sfx.pop();
}

/* ---------- game state ---------- */
const G = {
  state: 'loading', prev: 'home', lvl: null, player: null, enemies: [], recruits: [], boss: null,
  coinsRun: 0, t: 0, runT: 0, endT: 0, targetX: 0, shake: 0, fovKick: 0, camPos: new THREE.Vector3(0, 8, 14), camLook: new THREE.Vector3(),
  win: false, bossBanner: false, reward: 0, stars: 1, fpsAcc: 0, fpsN: 0,
  jump: { t: -1 }, speedMul: 1, pad: { up: false, dn: false }, fallen: 0, fellTip: false, tipJump: false, tipEdge: false
};
const keys = {};
let thrShown = -1, fxShown = -1;

function showTip(text) {
  const el = document.createElement('div'); el.className = 'tip'; el.textContent = text; document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}
function jumpNow() {
  if (G.state !== 'play' || G.jump.t >= 0) return;
  G.jump.t = 0; Snd.sfx.jump(); haptic('tick');
}
let hudCoins = -1, hudProg = -1;

function clearLevel() {
  if (G.player) G.player.release();
  G.enemies.forEach(e => e.release()); G.recruits.forEach(e => e.release());
  G.player = null; G.enemies = []; G.recruits = [];
  if (bossObj) { bossObj.mesh.visible = false; bossObj.crown.visible = false; }
}

function loadLevel(n) {
  clearLevel();
  const startN = 4 + save.upStart * 2;
  const lvl = genLevel(n, startN); G.lvl = lvl;
  world.build(lvl);
  G.coinsRun = 0; G.t0 = 0; G.runT = 0; G.endT = 0; G.targetX = 0; G.shake = 0; G.fovKick = 0; G.bossBanner = false; hudCoins = hudProg = -1;
  G.jump.t = -1; G.speedMul = 1; G.pad.up = G.pad.dn = false; G.fallen = 0; G.fellTip = false; G.tipJump = false; G.tipEdge = false; thrShown = fxShown = -1;
  const P = new Crowd('player', () => QUAL[Q].P, -1); P.x = 0; P.z = 0; P.activate(); P.setCount(startN); P.syncVisual(true);
  P.persons.forEach(p => { const a = p.slot * GOLD, rr = FORM_C * Math.sqrt(p.slot + 0.5); p.x = clamp(Math.cos(a) * rr, -3.85, 3.85); p.z = Math.sin(a) * rr; p.s = 1; });
  G.player = P;
  G.enemies = lvl.enemies.map(d => { const c = new Crowd('enemy', () => QUAL[Q].E, 1); c.x = d.x; c.z = d.z; c.count = d.count; c.pop(); return c; });
  G.recruits = lvl.recruits.map(d => { const c = new Crowd('neutral', () => 10, 1); c.x = d.x; c.z = d.z; c.count = d.count; c.pop(); c.label.textContent = '+' + d.count; return c; });
  const b = lvl.boss;
  G.boss = { z: b.z, hp: b.hp, hpMax: b.hpMax, state: 'idle', tick: 0, stompT: 0, deadT: 0, hitFlash: 0, rad: 2.6 };
  if (!G.boss.label) { /* created below */ }
  if (G.bossLabel) G.bossLabel.remove();
  const bl = document.createElement('div'); bl.className = 'lbl boss'; bl.style.display = 'none';
  bl.innerHTML = '<div class="bossname">👑 BOSS</div><div class="hpbar"><i></i></div>'; labelsEl.appendChild(bl); G.bossLabel = bl;
  bossObj.mesh.visible = true; bossObj.crown.visible = true;
  bossObj.mesh.position.set(0, 0, b.z); bossObj.mesh.scale.setScalar(5.5);
  bossObj.mesh.quaternion.setFromAxisAngle(Y_UP, YAW0 + Math.PI);
  bossObj.w = 0;
  const th = THEMES[lvl.theme];
  mats.boss.userData.uTeam.value.set(['#7a1030', '#3a6a2a', '#1a6a9a', '#6a6a72', '#8a5a1a', '#2a5fb0', '#a020c0', '#a02a0a'][lvl.theme % 8]);
  placeCameraHome(true);
  refreshHud();
  return th;
}

function refreshHud() {
  $('lvH').textContent = 'LEVEL ' + G.lvl.n; $('lvHud').textContent = 'LV ' + G.lvl.n; $('themeH').textContent = THEMES[G.lvl.theme].name;
  $('coinsH').textContent = fmt(save.coins);
  $('upStartLv').textContent = '+' + save.upStart * 2; $('upStartCost').textContent = fmt(costStart());
  $('upGoldLv').textContent = '+' + save.upGold * 10 + '%'; $('upGoldCost').textContent = fmt(costGold());
  $('upStartBtn').disabled = save.coins < costStart() || save.upStart >= 15;
  $('upGoldBtn').disabled = save.coins < costGold() || save.upGold >= 20;
  const sw = $('swatches'); sw.innerHTML = '';
  SKINS.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'sw' + (save.skin === i ? ' sel' : '') + (save.skins[i] ? '' : ' lock'); d.style.background = s.c;
    d.addEventListener('click', () => pickSkin(i)); sw.appendChild(d);
  });
  $('skinCost').textContent = '';
}
function pickSkin(i) {
  Snd.init(); Snd.sfx.click();
  if (!save.skins[i]) {
    if (save.coins < SKINS[i].cost) { $('skinCost').textContent = 'Need ' + (SKINS[i].cost - save.coins) + ' more'; return; }
    save.coins -= SKINS[i].cost; save.skins[i] = 1;
  }
  save.skin = i; mats.player.userData.uTeam.value.set(SKINS[i].c); mats.player.emissive.set(SKINS[i].c).multiplyScalar(0.03); teamColors.player.set(SKINS[i].c); persist(); refreshHud();
}

/* ---------- layers ---------- */
function layer(id, on) { const e = $(id); e.classList.toggle('hide', !on); e.classList.toggle('on', on); }
function setState(s) {
  G.state = s;
  document.body.classList.toggle('playing', s !== 'home');
  layer('home', s === 'home'); layer('hud', s === 'play' || s === 'win' || s === 'lose');
  layer('pause', s === 'pause'); layer('result', s === 'result'); layer('ctrl', s === 'play');
  if (s !== 'play') { G.pad.up = G.pad.dn = false; document.querySelectorAll('.pad.on').forEach(b => b.classList.remove('on')); }
}
function goHome() { loadLevel(save.level); setState('home'); }
function startRun() {
  Snd.init(); Snd.startMusic(); Snd.sfx.whoosh();
  setState('play'); G.runT = 0; G.player.running = true; showBanner('GO!'); haptic('tick');
  const nm = THEMES[G.lvl.theme].name; setTimeout(() => { if (G.state === 'play') showTip(nm); }, 900);
}
function pauseGame() { if (G.state !== 'play') return; G.prev = 'play'; setState('pause'); }
function resumeGame() { if (G.state !== 'pause') return; setState('play'); }

/* ---------- gameplay ---------- */
function passGate(gt) {
  const P = G.player, side = P.x < 0 ? 0 : 1, o = side ? gt.r : gt.l, before = P.count;
  let n;
  switch (o.op) { case '+': n = before + o.v; break; case 'x': n = before * o.v; break; case '-': n = before - o.v; break; default: n = Math.ceil(before / o.v); }
  n = Math.max(0, Math.round(n));
  world.flashGate(gt, side);
  const good = n >= before;
  const gx = side ? 2 : -2;
  for (let i = 0; i < 5; i++) sparks.emit(gx + (Math.random() - 0.5) * 3.2, 1 + Math.random() * 2.4, gt.z, good ? '#6cb0ff' : '#ff5a6a', 7, 5, 0.26, 0.9, -3, 0.5, 0.6);
  if (n <= 0) { P.count = 0; P.hit(0); finish(false); return; }
  P.setCount(n);
  const diff = n - before;
  floatText((diff >= 0 ? '+' : '') + fmt(diff), good ? '#7cc0ff' : '#ff6a7a', P.x, 2.6, P.z);
  if (good) { (o.op === 'x' ? Snd.sfx.great : Snd.sfx.good)(); haptic('success'); G.fovKick = o.op === 'x' ? 7 : 4; flashScreen('#9fd0ff', 0.18); }
  else { Snd.sfx.bad(); haptic('reject'); G.shake = 0.5; flashScreen('#ff3a4a', 0.16); }
}

function startFight(e) {
  e.fighting = true; e.fightT = 0; e.tick = 0; e.running = true; haptic('heavy'); G.shake = 0.35;
}
function fightTick(e, dt) {
  const P = G.player;
  e.z += (P.z - (P.radius + e.radius) * 0.3 - e.z) * (1 - Math.exp(-dt * 6));
  e.x += (P.x - e.x) * (1 - Math.exp(-dt * 6));
  e.tick -= dt;
  if (e.tick <= 0) {
    e.tick = 0.085;
    const m = Math.min(P.count, e.count), k = Math.max(1, Math.ceil(m * 0.2));
    P.hit(k); e.hit(k);
    const cx = (P.x + e.x) / 2 + (Math.random() - 0.5) * P.radius, cz = (P.z + e.z) / 2;
    sparks.emit(cx, 1.3, cz, Math.random() < 0.5 ? '#ff7a6a' : '#7ab0ff', 6, 6, 0.24, 0.45);
    Snd.sfx.clash(); haptic('tick'); G.shake = Math.max(G.shake, 0.2);
  }
  if (e.count <= 0) {
    e.fighting = false; e.done = true; e.release(); flashScreen('#ffffff', 0.12);
  }
}

function updateEnemies(dt) {
  const P = G.player;
  for (const e of G.enemies) {
    if (e.done) continue;
    const dist = P.z - e.z;
    if (!e.active && dist < 85) e.activate();
    if (!e.active) continue;
    if (!e.fighting) {
      if (dist < 42 && !e.charging) { e.charging = true; e.running = true; }
      if (e.charging) { e.z += 7 * dt; e.x += clamp(P.x - e.x, -3 * dt, 3 * dt); }
      if (P.z - e.z < P.radius * 0.5 + e.radius * 0.5 + 1.2) startFight(e);
    } else fightTick(e, dt);
  }
  P.fighting = G.enemies.some(e => e.fighting && !e.done);
}

function updateBoss(dt) {
  const P = G.player, B = G.boss;
  if (B.state === 'idle' && P.z - B.z < 78) {
    B.state = 'walk'; if (!G.bossBanner) { G.bossBanner = true; showBanner('FINAL BOSS!'); Snd.sfx.boss(); G.shake = 0.7; haptic('heavy'); }
  }
  if (B.state === 'walk') {
    B.z += 3.6 * dt;
    if (P.z - B.z < B.rad + P.radius * 0.7 + 0.8) { B.state = 'fight'; B.tick = 0; B.stompT = 0; }
  } else if (B.state === 'fight') {
    B.tick -= dt; B.stompT -= dt;
    if (B.stompT <= 0) {
      B.stompT = 0.9; Snd.sfx.stomp(); G.shake = Math.max(G.shake, 0.55); haptic('heavy');
      for (let i = 0; i < 18; i++) { const a = (i / 18) * 6.28; bits.emit(B.mesh_x || 0, 0.3, B.z + 1.2, '#d9c9a0', 1, 5, 0.5, 0.8, -4, 0.3, 0); }
      sparks.emit(0, 0.4, B.z + 1.5, '#ffb04a', 14, 7, 0.3, 0.7);
    }
    if (B.tick <= 0) {
      B.tick = 0.1;
      const k = Math.max(1, Math.ceil(Math.min(P.count, B.hp) * 0.1));
      B.hp = Math.max(0, B.hp - k); P.hit(k); B.hitFlash = 1;
      sparks.emit((Math.random() - 0.5) * 3, 2 + Math.random() * 5, B.z + 2, '#ffd24a', 5, 6, 0.3, 0.5);
      Snd.sfx.bossHit(); haptic('tick');
      if (B.hp <= 0) { if (P.count <= 0) P.setCount(1); finish(true); return; }
      if (P.count <= 0) { finish(false); return; }
    }
  }
}

const HAZ_R2 = 1.55;
function updateHazards(dt) {
  const P = G.player;
  for (const h of G.lvl.hazards) {
    h.cd -= dt;
    if (Math.abs(h.z - P.z) > P.radius + 4 || h.cd > 0) continue;
    let hit = null;
    for (const p of P.persons) {
      if (p.fall || p.y > (h.type === 'saw' ? 0.9 : 1.05)) continue;   // anyone airborne above the blades is safe
      if (h.type === 'saw') { const dx = p.x - h.x, dz = p.z - h.z; if (dx * dx + dz * dz < HAZ_R2) { hit = p; break; } }
      else if (p.x > h.x0 && p.x < h.x1 && Math.abs(p.z - h.z) < 1.0) { hit = p; break; }
    }
    if (!hit) continue;
    h.cd = 0.07;
    const w = Math.max(1, Math.round(P.count / Math.max(1, P.persons.length)));
    sparks.emit(hit.x, 0.8, hit.z, h.type === 'saw' ? '#ffd24a' : '#ff5a4a', 8, 6, 0.22, 0.5);
    P.hit(w, hit); G.shake = Math.max(G.shake, 0.25); haptic('tick');
    if (P.count <= 0) { finish(false); return; }
  }
}

function updateCollect(dt) {
  const P = G.player;
  for (const c of G.lvl.coins) {
    if (c.taken || Math.abs(c.z - P.z) > 2.4) continue;
    /* ground coins need feet on the ground; air coins need a jump (the crowd reaches about 2 m above its feet) */
    if (Math.abs(c.x - P.x) < P.radius * 0.85 + 0.6 && c.y >= P.jy - 0.5 && c.y <= P.jy + 2.3) {
      c.taken = true; world.hideCoin(c); G.coinsRun++;
      sparks.emit(c.x, c.y, c.z, '#ffd23a', 4, 3, 0.2, 0.4); Snd.sfx.coin();
    }
  }
  for (const b of G.lvl.boxes) {
    if (b.taken || Math.abs(b.z - P.z) > 2.8) continue;
    if (Math.abs(b.x - P.x) < P.radius * 0.9 + 1.1 && b.y >= P.jy + 0.4 && b.y <= P.jy + 3.0) {
      b.taken = true; world.hideBox(b);
      sparks.emit(b.x, b.y, b.z, '#ffd24a', 40, 9, 0.4, 1.0, -6, 0.8, 1); sparks.emit(b.x, b.y, b.z, '#ffffff', 16, 6, 0.25, 0.7, -4, 0.8, 0.5);
      Snd.sfx.box(); haptic('success'); flashScreen('#ffe9a0', 0.2);
      if (b.reward.t === 'crowd') { P.setCount(P.count + b.reward.v); floatText('🎁 +' + b.reward.v, '#7cff8a', P.x, 3.2, P.z); showTip('🎁 +' + b.reward.v + ' PEOPLE!'); }
      else { G.coinsRun += b.reward.v; floatText('🎁 +' + b.reward.v + ' 🪙', '#ffd23a', P.x, 3.2, P.z); showTip('🎁 +' + b.reward.v + ' COINS!'); }
    }
  }
  for (const rc of G.recruits) {
    if (rc.done) continue;
    const dz = P.z - rc.z;
    if (!rc.active && dz < 90) rc.activate();
    if (!rc.active) continue;
    if (dz < -6) { rc.release(); rc.done = true; continue; }
    if (Math.abs(dz) < P.radius * 0.6 + 1.4 && Math.abs(P.x - rc.x) < P.radius * 0.8 + rc.radius + 0.9) {
      const n = rc.count; rc.done = true;
      sparks.emit(rc.x, 1.4, rc.z, '#7cff8a', 20, 6, 0.28, 0.8);
      floatText('+' + n, '#7cff8a', rc.x, 2.4, rc.z); rc.release(); P.setCount(P.count + n); Snd.sfx.recruit(); haptic('success');
    }
  }
}

function updatePlay(dt) {
  const P = G.player, lvl = G.lvl, B = G.boss;
  G.runT += dt;
  const kd = (keys.ArrowRight || keys.d || keys.D ? 1 : 0) - (keys.ArrowLeft || keys.a || keys.A ? 1 : 0);
  if (kd) G.targetX += kd * 7 * dt;
  /* throttle: the player sets the speed (it stays where it is left) */
  const gas = G.pad.up || keys.w || keys.W, brake = G.pad.dn || keys.s || keys.S || keys.ArrowDown;
  if (gas) G.speedMul = Math.min(SPEED_MAX, G.speedMul + 1.0 * dt);
  if (brake) G.speedMul = Math.max(SPEED_MIN, G.speedMul - 1.5 * dt);
  let sp = (10 + Math.min(lvl.n, 20) * 0.12) * G.speedMul;
  if (P.fighting) sp *= 0.25;
  if (B.state === 'walk') sp = 7; else if (B.state === 'fight') sp = 0;
  P.z -= sp * dt; P.running = true;
  /* jump arc */
  if (G.jump.t >= 0) {
    G.jump.t += dt * Math.max(0.6, G.speedMul);   // a jump covers the same ground at any speed
    if (G.jump.t > JUMP_DUR + 0.08) { G.jump.t = -1; P.jy = 0; Snd.sfx.land(); bits.emit(P.x, 0.1, P.z, '#e8e2d0', 8, 3, 0.5, 0.6, -1, 0.3, P.radius); }
    else { const u = clamp(G.jump.t / JUMP_DUR, 0, 1); P.jy = JUMP_H * 4 * u * (1 - u); }
  } else P.jy = 0;
  /* no guard rails: the crowd may be steered off the edge, and whoever steps off falls */
  const lim = EDGE + 1.4;
  G.targetX = clamp(G.targetX, -lim, lim);
  P.x += (G.targetX - P.x) * (1 - Math.exp(-dt * 12));
  if (!G.tipEdge && G.lvl.n <= 3 && Math.abs(P.x) + P.radius * 0.7 > EDGE + 0.3 && B.state === 'idle') { G.tipEdge = true; showTip('⚠ NO GUARD RAILS!'); }
  if (!G.tipJump && lvl.n <= 5) {
    for (const h of lvl.hazards) { const d = P.z - h.z; if (d > 14 && d < 30) { G.tipJump = true; showTip('JUMP! ⤴ swipe up'); break; } }
  }
  for (const gt of lvl.gates) { if (!gt.done && P.z <= gt.z) { gt.done = true; passGate(gt); if (G.state !== 'play') return; } }
  updateEnemies(dt); if (G.state !== 'play') return;
  updateHazards(dt); if (G.state !== 'play') return;
  updateCollect(dt);
  updateBoss(dt);
  if (P.count <= 0 && G.state === 'play') finish(false);
  /* footstep dust */
  if (Math.random() < dt * 14 && P.persons.length) { const p = P.persons[(Math.random() * P.persons.length) | 0]; bits.emit(p.x, 0.1, p.z + 0.4, '#e8e2d0', 1, 1.2, 0.3, 0.5, 0.4, 0.2); }
  const prog = clamp(-P.z / -B.z, 0, 1);
  if (Math.abs(prog - hudProg) > 0.004) { hudProg = prog; $('progFill').style.width = (prog * 100).toFixed(1) + '%'; }
  if (hudCoins !== G.coinsRun) { hudCoins = G.coinsRun; $('coinsHud').textContent = fmt(save.coins + G.coinsRun); }
}

function finish(win) {
  if (G.state !== 'play') return;
  G.state = win ? 'win' : 'lose'; G.endT = 0; G.win = win;
  const P = G.player;
  if (win) {
    P.cheer = true; P.running = false; G.boss.state = 'dead'; G.boss.deadT = 0;
    Snd.sfx.explode(); Snd.sfx.win(); haptic('success'); showBanner('VICTORY!'); flashScreen('#ffffff', 0.5);
    sparks.emit(0, 4, G.boss.z, '#ffd24a', 120, 16, 0.5, 1.2, -6, 0.8, 2); sparks.emit(0, 4, G.boss.z, '#ff6a2a', 80, 12, 0.6, 1.0, -6, 0.8, 2);
    G.shake = 1;
  } else {
    P.running = false; Snd.sfx.lose(); haptic('reject'); showBanner('CROWD LOST'); G.shake = 0.4;
  }
}

function showResult() {
  const win = G.win, lvl = G.lvl, P = G.player;
  const par = Math.max(1, lvl.estFinal - lvl.boss.hpMax);
  const ratio = P.count / par;
  const stars = win ? (ratio >= 0.9 ? 3 : ratio >= 0.45 ? 2 : 1) : 0;
  const base = G.coinsRun * (1 + save.upGold * 0.1);
  const reward = Math.round(base + (win ? 30 + stars * 15 : 0));
  save.coins += reward;
  if (win && lvl.n === save.level) save.level = lvl.n + 1;
  persist();
  $('resTitle').textContent = win ? 'VICTORY!' : 'DEFEATED'; $('resTitle').className = win ? 'win' : 'lose';
  $('resText').textContent = win ? ('Boss crushed with ' + fmt(P.count) + ' survivors!') : 'Your crowd was wiped out. Pick better gates and dodge the traps!';
  $('resCoins').textContent = '+' + fmt(reward);
  [...$('stars').children].forEach((el, i) => el.classList.toggle('on', i < stars));
  $('stars').style.display = win ? '' : 'none';
  $('nextBtn').textContent = win ? 'NEXT LEVEL' : 'TRY AGAIN';
  G.nextLevel = win ? lvl.n + 1 : lvl.n;
  setState('result'); if (win) Snd.sfx.great();
}

/* ---------- camera ---------- */
const lookTmp = new THREE.Vector3(), posTmp = new THREE.Vector3();
function fitDistance() {
  const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect);
  return clamp(5.0 / Math.tan(half), 12, 24);
}
function cameraTargets() {
  const P = G.player, B = G.boss, s = G.state, D = fitDistance();
  if (s === 'home' || s === 'result' || s === 'pause' && G.prev === 'home') {
    const a = Math.PI * 0.86 + Math.sin(G.t * 0.35) * 0.55, R = 8.5;
    posTmp.set(P.x + Math.sin(a) * R, 3.4 + Math.sin(G.t * 0.5) * 0.5, P.z + Math.cos(a) * R);
    lookTmp.set(P.x + (W > H ? 3.6 : 0), -0.2 - (W < H ? 0.45 : 0), P.z);
  } else if (s === 'win') {
    const a = Math.PI * 0.8 + G.endT * 0.55, R = 12;
    posTmp.set(P.x + Math.sin(a) * R, 5.5, P.z + Math.cos(a) * R); lookTmp.set(P.x, 2, P.z - 2);
  } else if (s === 'lose') {
    posTmp.set(P.x * 0.5, D * 0.6, P.z + D * 0.85); lookTmp.set(P.x * 0.5, 0.5, P.z - D * 0.3);
  } else {
    const boss = B.state === 'walk' || B.state === 'fight';
    const k = (boss ? 1.3 : 1) * (1 + (G.speedMul - 1) * 0.1);
    posTmp.set(P.x * 0.55, D * 0.58 * k + (boss ? 2 : 0), P.z + D * 0.82 * k);
    lookTmp.set(P.x * 0.55, 0.8, boss ? (P.z + B.z) / 2 + 2 : P.z - D * 0.32);
  }
}
function placeCameraHome() { G.camPos.set(0, 5, -6); cameraTargets(); G.camPos.copy(posTmp); G.camLook.copy(lookTmp); }
function updateCamera(dt) {
  if (G.freeCam) return;
  cameraTargets();
  const f = 1 - Math.exp(-dt * (G.state === 'play' ? 6 : 3.2));
  G.camPos.lerp(posTmp, f); G.camLook.lerp(lookTmp, f);
  camera.position.copy(G.camPos);
  if (G.shake > 0.01) { camera.position.x += (Math.random() - 0.5) * G.shake * 0.5; camera.position.y += (Math.random() - 0.5) * G.shake * 0.4; G.shake *= Math.exp(-dt * 6); }
  camera.lookAt(G.camLook);
  const fov = 58 + G.fovKick + (G.state === 'play' ? 2 + (G.speedMul - 1) * 5 : 0);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); pointScale = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2)); sparks.setScale(pointScale); bits.setScale(pointScale); }
  G.fovKick *= Math.exp(-dt * 4);
}

/* ---------- per-frame ---------- */
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000;
  if (rawDt < 0.011) return;   // 60-90 fps is plenty; a 144 Hz screen should not draw twice the work
  let dt = Math.min(0.05, rawDt); last = now;
  if (G.state === 'loading' || !G.player) return;
  const paused = G.state === 'pause';
  if (!paused) {
    G.t += dt;
    const am = G.state === 'play' ? lerp(0.6, 1.6, (G.speedMul - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) : 1;   // legs keep up with the speed
    for (const m of runMasters) m.mixer.update(dt * m.speed * am);
    for (const m of idleMasters) m.mixer.update(dt * m.speed);
    const B = G.boss;
    B.hitFlash = Math.max(0, B.hitFlash - dt * 4);
    const bo = bossObj;
    bo.w += ((B.state === 'walk' ? 1 : 0) - bo.w) * (1 - Math.exp(-dt * 4));
    bo.walk.setEffectiveWeight(bo.w); bo.idle.setEffectiveWeight(1 - bo.w);
    bo.walk.timeScale = 1.1; bo.mixer.update(dt);
    if (G.state === 'play') updatePlay(dt);
    else if (G.state === 'win' || G.state === 'lose') {
      G.endT += dt;
      if (G.state === 'win') {
        const B2 = G.boss; B2.deadT += dt;
        const k = clamp(B2.deadT / 1.1, 0, 1);
        bo.mesh.quaternion.setFromAxisAngle(Y_UP, YAW0 + Math.PI).multiply(_q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -k * k * 1.45));
        bo.mesh.position.y = 0; bo.crown.position.set(0, -50, B2.z);
        if (B2.deadT > 1.1 && B2.deadT < 1.2 && !B2.slam) { B2.slam = true; Snd.sfx.stomp(); G.shake = 1; sparks.emit(0, 0.5, B2.z + 7, '#ffd24a', 60, 12, 0.5, 1); }
        if (B2.deadT > 1.6) { const s2 = Math.max(0, 1 - (B2.deadT - 1.6) * 1.2); bo.mesh.scale.setScalar(5.5 * s2); }
        if (Math.random() < dt * 30) bits.confetti(G.player.x, 8, G.player.z, 4, 10);
      }
      if (G.endT > (G.state === 'win' ? 3.2 : 1.6)) showResult();
    }
    if (G.state !== 'play') { /* keep crowds animating in every other state */ }
    G.player.update(dt, G.t);
    G.enemies.forEach(e => e.update(dt, G.t)); G.recruits.forEach(e => e.update(dt, G.t));
    shadows.instanceMatrix.needsUpdate = true; rings.instanceMatrix.needsUpdate = true; if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
    /* boss placement and flash */
    if (G.state !== 'win') {
      const B2 = G.boss;
      bo.mesh.position.set(0, 0, B2.z);
      if (B2.state === 'fight') bo.mesh.position.x = Math.sin(G.t * 40) * 0.08;
      bo.crown.position.set(bo.mesh.position.x, 9.5 + Math.sin(G.t * 2) * 0.08, B2.z); bo.crown.rotation.y = G.t * 1.3;
    }
    mats.boss.emissive.setRGB(B_flash(G.boss.hitFlash), B_flash(G.boss.hitFlash) * 0.12, 0);
    sparks.update(dt); bits.update(dt);
    updateCamera(dt);
  }
  world.update(paused ? 0 : dt, G.t, camera, pointScale * 0.5, G.player.z);
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = (Q >= 2) || ((G.frameNo = (G.frameNo || 0) + 1) % 2 === 0);
  /* speedometer + speed lines */
  const thr = Math.round(G.speedMul * 10), fxv = G.state === 'play' ? Math.round(clamp((G.speedMul - 1.15) / 1.05, 0, 0.75) * 100) : 0;
  if (thr !== thrShown) { thrShown = thr; $('thrVal').textContent = (thr / 10).toFixed(1) + '×'; $('thrFill').style.height = ((G.speedMul - SPEED_MIN) / (SPEED_MAX - SPEED_MIN) * 100).toFixed(0) + '%'; }
  if (fxv !== fxShown) { fxShown = fxv; const sf = $('speedfx'); sf.style.display = fxv ? '' : 'none'; sf.style.opacity = fxv / 100; }
  updateLabels();
  renderer.render(scene, camera);
  /* adaptive quality */
  if (!paused && G.state === 'play' && G.runT > 2.5) {
    G.fpsAcc += dt; G.fpsN++; G.slow = rawDt > 0.14 ? (G.slow || 0) + 1 : 0;
    if ((G.fpsAcc > 1.2 && G.fpsAcc / G.fpsN > 1 / 42) || G.slow >= 3) { if (Q > 0 && !params.has('q')) lowerQuality(); G.fpsAcc = 0; G.fpsN = 0; G.slow = 0; }
    else if (G.fpsAcc > 1.2) { G.fpsAcc = 0; G.fpsN = 0; }
  }
}
const B_flash = v => v * v * 0.22;

function updateLabels() {
  const P = G.player, B = G.boss;
  if (!P) return;
  const showP = P.count > 0 && G.state !== 'result' && G.state !== 'pause' || G.state === 'pause';
  if (P.count > 0) placeLabel(P.label, P.x, 2.9 + P.radius * 0.1, P.z); else P.label.style.display = 'none';
  for (const e of G.enemies) { if (e.active && !e.done && e.count > 0) placeLabel(e.label, e.x, 3.0, e.z); else e.label.style.display = 'none'; }
  for (const r of G.recruits) { if (r.active && !r.done) placeLabel(r.label, r.x, 2.8, r.z); else r.label.style.display = 'none'; }
  if (G.bossLabel) {
    if (B.state === 'dead' || G.state === 'home' || G.state === 'result') G.bossLabel.style.display = 'none';
    else if (B.state !== 'idle' || P.z - B.z < 110) {
      placeLabel(G.bossLabel, 0, 12.8, B.z);
      G.bossLabel.querySelector('i').style.width = (B.hp / B.hpMax * 100).toFixed(1) + '%';
    } else G.bossLabel.style.display = 'none';
  }
  void showP;
}

function lowerQuality() {
  Q--; save.q = Q; persist(); applyQuality();
  if (!G.qTip) { G.qTip = true; showTip('Graphics lowered for smoother play'); }
}
function applyQuality() {
  resize(); world.setShadows(QUAL[Q].shadow); world.density = QUAL[Q].deco * (isTouch ? 0.75 : 1);
  if (G.player) { G.player.syncVisual(false); G.enemies.forEach(e => e.syncVisual(false)); }
}

/* ---------- input ---------- */
/* One finger steers (drag sideways) and a quick swipe up jumps; the buttons work with other fingers at the same time. */
let steerId = null, lastX = 0, startY = 0, startT = 0, swiped = false;
window.addEventListener('pointerdown', e => {
  Snd.init();
  if (G.state !== 'play' || steerId !== null || e.target.closest('button')) return;
  steerId = e.pointerId; lastX = e.clientX; startY = e.clientY; startT = performance.now(); swiped = false;
});
window.addEventListener('pointermove', e => {
  if (e.pointerId !== steerId || G.state !== 'play') return;
  const dx = e.clientX - lastX; lastX = e.clientX;
  G.targetX += dx * (11 / Math.max(320, Math.min(window.innerWidth, 700)));
  if (!swiped && startY - e.clientY > 48 && performance.now() - startT < 500) { swiped = true; jumpNow(); }
});
const endSteer = e => { if (e.pointerId === steerId) steerId = null; };
window.addEventListener('pointerup', endSteer);
window.addEventListener('pointercancel', endSteer);
function holdButton(id, flag) {
  const b = $(id), on = v => { G.pad[flag] = v; b.classList.toggle('on', v); };
  b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } on(true); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => on(false));
}
holdButton('thrUp', 'up'); holdButton('thrDn', 'dn');
$('jumpBtn').addEventListener('pointerdown', e => { e.preventDefault(); $('jumpBtn').classList.add('on'); jumpNow(); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('jumpBtn').addEventListener(ev, () => $('jumpBtn').classList.remove('on'));
window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if ((e.key === ' ' || e.key === 'ArrowUp') && G.state === 'play') { e.preventDefault(); jumpNow(); }
  if (e.key === 'Escape' || e.key === 'p') { if (G.state === 'play') pauseGame(); else if (G.state === 'pause') resumeGame(); }
  if ((e.key === 'Enter' || e.key === ' ') && G.state === 'home') startRun();
});
window.addEventListener('keyup', e => { keys[e.key] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play') pauseGame(); });

/* ---------- UI wiring ---------- */
$('playBtn').addEventListener('click', () => { Snd.init(); Snd.sfx.click(); startRun(); });
$('pauseBtn').addEventListener('click', () => { Snd.sfx.click(); pauseGame(); });
$('resumeBtn').addEventListener('click', () => { Snd.sfx.click(); resumeGame(); });
$('restartBtn').addEventListener('click', () => { Snd.sfx.click(); loadLevel(G.lvl.n); startRun(); });
$('homeBtn').addEventListener('click', () => { Snd.sfx.click(); goHome(); });
$('resHomeBtn').addEventListener('click', () => { Snd.sfx.click(); goHome(); });
$('nextBtn').addEventListener('click', () => { Snd.sfx.click(); loadLevel(G.nextLevel); startRun(); });
$('muteBtn').addEventListener('click', () => {
  Snd.init(); save.muted = !save.muted; Snd.setMuted(save.muted); persist(); refreshMute(); if (!save.muted) Snd.sfx.click();
});
$('upStartBtn').addEventListener('click', () => {
  if (save.coins < costStart()) return; save.coins -= costStart(); save.upStart++; persist(); Snd.init(); Snd.sfx.recruit(); loadLevel(save.level);
});
$('upGoldBtn').addEventListener('click', () => {
  if (save.coins < costGold()) return; save.coins -= costGold(); save.upGold++; persist(); Snd.init(); Snd.sfx.coin(); refreshHud();
});

/* Android Back (and test hook): play -> pause, pause/result -> home, home -> let the app exit. */
window.__androidBack = function () {
  if (G.state === 'play') { pauseGame(); return true; }
  if (G.state === 'pause' || G.state === 'result' || G.state === 'win' || G.state === 'lose') { goHome(); return true; }
  return false;
};

/* ---------- boot ---------- */
function setProgress(p, msg) { $('lfill').style.width = Math.round(p * 100) + '%'; if (msg) $('loadMsg').textContent = msg; }
async function boot() {
  try {
    if (!renderer.capabilities.isWebGL2) throw new Error('WebGL 2 is not available on this device.');
    resize(); applyQualityInit();
    setProgress(0.08, 'Calling the runners…');
    const loader = new GLTFLoader();
    gltf = await new Promise((res, rej) => loader.load('models/soldier.glb', res, e => { if (e.total) setProgress(0.1 + 0.7 * e.loaded / e.total); }, rej));
    setProgress(0.85, 'Building the crowd…');
    initPeople();
    refreshMute();
    const lvlNo = params.has('level') ? Math.max(1, +params.get('level') | 0) : save.level;
    loadLevel(lvlNo);
    setProgress(1, 'Ready!');
    await new Promise(r => setTimeout(r, 250));
    setState('home'); layer('loading', false);
    requestAnimationFrame(t => { last = t; frame(t); });
  } catch (err) {
    console.error(err);
    $('loadMsg').textContent = 'Could not start the game: ' + (err && err.message ? err.message : err);
  }
}
function applyQualityInit() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUAL[Q].pr)); }

window.__cr = { G, world, scene, camera, renderer, loadLevel, startRun, finish, save, bossObj, jumpNow, showTip, get Q() { return Q; }, runMasters, pool };
boot();
