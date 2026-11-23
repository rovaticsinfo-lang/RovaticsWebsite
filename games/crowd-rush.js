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
/* Avatars: each is a full costume (head, torso, arms, legs, boots, accent and pattern), bought once with coins.
   pat: 0 plain, 1 torso stripes, 2 belt, 3 eye mask or visor band. c = the colour of the ring under each runner. */
const AVATARS = [
  { id: 'rookie', name: 'Blue Rookie', cost: 0, c: '#3b82ff', pat: 2, head: '#3b82ff', torso: '#3b82ff', arms: '#3b82ff', legs: '#24407f', boots: '#1d2a4a', acc: '#ffd23a' },
  { id: 'ninja', name: 'Night Ninja', cost: 150, c: '#ff3a4a', pat: 3, head: '#30303e', torso: '#3d3d52', arms: '#3d3d52', legs: '#2c2c3e', boots: '#1e1e2a', acc: '#ff3a4a' },
  { id: 'astro', name: 'Astronaut', cost: 250, c: '#ffa84a', pat: 2, head: '#f2f4f8', torso: '#f2f4f8', arms: '#e9edf3', legs: '#dfe4ec', boots: '#8b94a3', acc: '#ff8a1a' },
  { id: 'pirate', name: 'Pirate', cost: 350, c: '#ff5a5a', pat: 1, head: '#c4222c', torso: '#f2efe8', arms: '#f2efe8', legs: '#2a2420', boots: '#4a2e1c', acc: '#2a2a35' },
  { id: 'knight', name: 'Silver Knight', cost: 500, c: '#b8c4d8', pat: 3, head: '#cfd6e2', torso: '#aab4c4', arms: '#98a3b6', legs: '#7e8aa0', boots: '#d9b64a', acc: '#d9b64a' },
  { id: 'hero', name: 'Super Hero', cost: 650, c: '#ff3a3a', pat: 3, head: '#e0262e', torso: '#e0262e', arms: '#e0262e', legs: '#2250d8', boots: '#ffd23a', acc: '#ffd23a' },
  { id: 'robot', name: 'Robo Runner', cost: 800, c: '#22d8ff', pat: 1, head: '#7fe3ff', torso: '#9ab0c4', arms: '#7a8ea2', legs: '#556577', boots: '#2a3644', acc: '#22d8ff' },
  { id: 'gold', name: 'Golden Legend', cost: 1200, c: '#ffd23a', pat: 3, head: '#ffcf33', torso: '#ffbf1a', arms: '#ffcf33', legs: '#d99a0a', boots: '#fff1a8', acc: '#fff8d0' }
];
/* the player's colour for rings and labels is the avatar's c */
function setCostume(mat, a) {
  const k = mat.userData.cos; k.on.value = 1; k.pat.value = a.pat;
  for (const z of ['head', 'torso', 'arms', 'legs', 'boots', 'acc']) k[z].value.set(a[z]);
  mat.userData.uTeam.value.set(a.c); mat.emissive.set(a.c).multiplyScalar(0.03);
}
const TEAM_COL = { enemy: '#ff3a4a', neutral: '#ffe9a0' };

/* ---------- save ---------- */
const SAVE_KEY = 'rovatics.crowdrush.v1';
const save = { level: 1, coins: 0, upStart: 0, upGold: 0, avatar: 0, avatars: [1, 0, 0, 0, 0, 0, 0, 0], road: -1, muted: false };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* private mode */ }
/* repair older or damaged saves: the avatar list must match, and the equipped avatar must be owned */
if (!Array.isArray(save.avatars)) save.avatars = [];
while (save.avatars.length < AVATARS.length) save.avatars.push(0);
save.avatars[0] = 1;
if (!(save.avatar >= 0 && save.avatar < AVATARS.length) || !save.avatars[save.avatar]) save.avatar = 0;
if (!(save.road >= -1 && save.road < THEMES.length)) save.road = -1;
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
  /* costume: colours for the body zones (head, torso, arms, legs, boots) plus an accent and a pattern. Only the
     player's crowd uses it (uCos = 1); rivals, neutrals and the boss keep one solid team colour. */
  const cos = { on: { value: 0 }, pat: { value: 0 }, head: { value: new THREE.Color() }, torso: { value: new THREE.Color() }, arms: { value: new THREE.Color() },
    legs: { value: new THREE.Color() }, boots: { value: new THREE.Color() }, acc: { value: new THREE.Color() } };
  m.userData.uTeam = uTeam; m.userData.cos = cos;
  m.onBeforeCompile = sh => {
    sh.uniforms.uTeam = uTeam; sh.uniforms.uMix = uMix; sh.uniforms.uCos = cos.on; sh.uniforms.uPat = cos.pat;
    sh.uniforms.uHead = cos.head; sh.uniforms.uTorso = cos.torso; sh.uniforms.uArms = cos.arms; sh.uniforms.uLegs = cos.legs; sh.uniforms.uBoots = cos.boots; sh.uniforms.uAcc = cos.acc;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBP = position;');   // bind-pose position: x = across (arms), z = height 0..183
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uTeam, uHead, uTorso, uArms, uLegs, uBoots, uAcc; uniform float uMix, uCos, uPat; varying vec3 vBP;')
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv );
          float lum = dot( sampledDiffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
          vec3 zc = uTeam;
          if (uCos > 0.5) {
            float hh = vBP.z / 183.0, ax = abs(vBP.x);
            zc = hh > 0.5 ? uTorso : uLegs;
            if (hh > 0.62 && ax > 26.0) zc = uArms;
            if (hh < 0.075) zc = uBoots;
            if (hh > 0.62 && ax > 74.0) zc = uBoots;
            if (hh > 0.845) zc = uHead;
            if (uPat > 0.5 && uPat < 1.5 && hh > 0.52 && hh < 0.83 && ax < 26.0 && mod(hh * 30.0, 2.0) < 1.0) zc = uAcc;
            if (uPat > 1.5 && uPat < 2.5 && hh > 0.46 && hh < 0.53 && ax < 30.0) zc = uAcc;
            if (uPat > 2.5 && hh > 0.875 && hh < 0.935) zc = uAcc;
          }
          float l2 = pow(clamp(lum * 1.5, 0.0, 1.0), 1.25); vec3 tc = zc * ( 0.1 + l2 * 1.05 ) + zc * zc * 0.12;
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
  mats.player = teamMaterial(AVATARS[save.avatar].c, 0.8);
  setCostume(mats.player, AVATARS[save.avatar]);
  mats.enemy = teamMaterial(TEAM_COL.enemy, 0.6, 0x200000);
  mats.neutral = teamMaterial(TEAM_COL.neutral, 0.3);
  mats.boss = teamMaterial('#7a1030', 0.7, 0x000000);
  teamColors.player.set(AVATARS[save.avatar].c);
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
  mesh.frustumCulled = false; mesh.castShadow = false;
  /* everything about the boss hangs on one rig, so a tier\'s armour, crown and every defeat animation move together */
  const rig = new THREE.Group(); rig.visible = false; scene.add(rig); rig.add(mesh);
  const crown = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: '#ffcc22', emissive: '#ff9900', emissiveIntensity: 0.8, metalness: 0.8, roughness: 0.3, flatShading: true });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 4), gold);
    sp.position.set(Math.cos(a) * 0.55, 0.45, Math.sin(a) * 0.55); crown.add(sp);
  }
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.3, 10), gold); crown.add(band);
  rig.add(crown);
  const extras = new THREE.Group(); rig.add(extras);
  const tele = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 15), new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  tele.rotation.x = -Math.PI / 2; tele.visible = false; scene.add(tele);
  bossObj = { root, mixer, idle, walk, mesh, rig, crown, extras, tele, w: 0, gold, halo: null };
}

/* Armour that grows with the boss tier: Boss / Super Boss (shoulder spikes) / Big Boss (horns, glowing eyes) / Final Big Boss (halo and flames). */
function buildBossExtras(tier, S) {
  const ex = bossObj.extras;
  for (const c of [...ex.children]) { ex.remove(c); if (c.geometry) c.geometry.dispose(); }
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2230', roughness: 0.4, metalness: 0.7, flatShading: true });
  const eye = new THREE.MeshBasicMaterial({ color: '#ff2a1a' });
  if (tier >= 1) for (const sx of [-1, 1]) for (const k of [0, 1]) {
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.07 * S, 0.34 * S, 6), tier >= 3 ? bossObj.gold : dark);
    sp.position.set(sx * (0.33 + k * 0.06) * S, (1.5 + k * 0.1) * S, 0); sp.rotation.z = -sx * (0.7 + k * 0.5); ex.add(sp);
  }
  if (tier >= 2) {
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.035 * S, 0.3 * S, 6), dark); horn.position.set(sx * 0.15 * S, 1.8 * S, -0.02 * S); horn.rotation.z = -sx * 0.55; ex.add(horn);
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.02 * S, 8, 6), eye); e.position.set(sx * 0.045 * S, 1.66 * S, -0.12 * S); ex.add(e);
    }
  }
  if (tier >= 3) {
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.4 * S, 0.022 * S, 8, 40), new THREE.MeshBasicMaterial({ color: '#ffe066' })); halo.position.y = 2.05 * S; halo.rotation.x = Math.PI / 2; ex.add(halo); bossObj.halo = halo;
  } else bossObj.halo = null;
  bossObj.crown.position.set(0, 1.74 * S, 0); bossObj.crown.scale.setScalar(S * 0.31);
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
function placeLabel(el, x, y, z, minY = 0) {
  const s = toScreen(x, y, z); if (s.y < minY) s.y = minY;
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
    const arenaZ = G.lvl ? G.lvl.boss.z + 20 : -1e9;
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
      if (jumping) { const u = (G.jump.t + p.jo) / G.jumpDur; if (u > 0 && u < 1) y = G.jumpH * 4 * u * (1 - u); }
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
function team_hex(team) { return team === 'player' ? AVATARS[save.avatar].c : TEAM_COL[team]; }
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
  jump: { t: -1 }, jumpH: JUMP_H, jumpDur: JUMP_DUR, boost: 0, tsc: 1, endR: 0, cheered: false,
  speedMul: 1, pad: { up: false, dn: false }, fallen: 0, fellTip: false, tipJump: false, tipEdge: false
};
const bossBase = new THREE.Color(0, 0, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
const SUPER_H = 5.6, SUPER_DUR = 1.9;
const keys = {};
let thrShown = -1, fxShown = -1;

function showTip(text) {
  const el = document.createElement('div'); el.className = 'tip'; el.textContent = text; document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}
function jumpNow() {
  if (G.state !== 'play' || G.jump.t >= 0) return;
  G.jumpH = JUMP_H; G.jumpDur = JUMP_DUR;
  G.jump.t = 0; Snd.sfx.jump(); haptic('tick');
}
let hudCoins = -1, hudProg = -1;

function clearLevel() {
  if (G.player) G.player.release();
  G.enemies.forEach(e => e.release()); G.recruits.forEach(e => e.release());
  G.player = null; G.enemies = []; G.recruits = [];
  if (bossObj) { bossObj.rig.visible = false; bossObj.tele.visible = false; }
}

function loadLevel(n) {
  clearLevel();
  const startN = 4 + save.upStart * 2;
  const lvl = genLevel(n, startN); if (save.road >= 0) lvl.theme = save.road; G.lvl = lvl;
  world.build(lvl);
  G.coinsRun = 0; G.t0 = 0; G.runT = 0; G.endT = 0; G.targetX = 0; G.shake = 0; G.fovKick = 0; G.bossBanner = false; hudCoins = hudProg = -1;
  G.jump.t = -1; G.jumpH = JUMP_H; G.jumpDur = JUMP_DUR; G.boost = 0; G.tsc = 1; G.endR = 0; G.cheered = false;
  G.speedMul = 1; G.pad.up = G.pad.dn = false; G.fallen = 0; G.fellTip = false; G.tipJump = false; G.tipEdge = false; thrShown = fxShown = -1;
  Snd.setAmbience(THEMES[lvl.theme].id); Snd.duckAmbience(false);
  const P = new Crowd('player', () => QUAL[Q].P, -1); P.x = 0; P.z = 0; P.activate(); P.setCount(startN); P.syncVisual(true);
  P.persons.forEach(p => { const a = p.slot * GOLD, rr = FORM_C * Math.sqrt(p.slot + 0.5); p.x = clamp(Math.cos(a) * rr, -3.85, 3.85); p.z = Math.sin(a) * rr; p.s = 1; });
  G.player = P;
  G.enemies = lvl.enemies.map(d => { const c = new Crowd('enemy', () => QUAL[Q].E, 1); c.x = d.x; c.z = d.z; c.count = d.count; c.pop(); return c; });
  G.recruits = lvl.recruits.map(d => { const c = new Crowd('neutral', () => 10, 1); c.x = d.x; c.z = d.z; c.count = d.count; c.pop(); c.label.textContent = '+' + d.count; return c; });
  const b = lvl.boss;
  const S = b.scale;
  G.boss = {
    z: b.z, z0: b.z, x: 0, hp: b.hp, hpMax: b.hpMax, tier: b.tier, style: b.style, name: b.name, scale: S, hint: b.hint, state: 'idle',
    tick: 0, stompT: 0, deadT: 0, hitFlash: 0, rad: S * 0.48, atk: { phase: 0, t: 1.6, side: 1 }, zFight: 0
  };
  if (G.bossLabel) G.bossLabel.remove();
  const bl = document.createElement('div'); bl.className = 'lbl boss'; bl.style.display = 'none';
  bl.innerHTML = '<div class="bossname">👑 ' + b.name + '</div><div class="hpbar"><i></i></div>'; labelsEl.appendChild(bl); G.bossLabel = bl;
  const rig = bossObj.rig; rig.visible = true; rig.position.set(0, 0, b.z); rig.rotation.set(0, YAW0 + Math.PI, 0); rig.scale.setScalar(1);
  bossObj.mesh.scale.setScalar(S); bossObj.mesh.position.set(0, 0, 0); bossObj.tele.visible = false;
  buildBossExtras(b.tier, S);
  bossObj.w = 0;
  const th = THEMES[lvl.theme];
  mats.boss.userData.uTeam.value.set(['#7a1030', '#5a1a8a', '#a04a0a', '#d4a010'][b.tier]);
  bossBase.set(b.tier >= 3 ? 0.22 : 0, b.tier >= 3 ? 0.16 : 0, 0);
  placeCameraHome(true);
  refreshHud();
  return th;
}

function refreshHud() {
  $('lvH').textContent = 'LEVEL ' + G.lvl.n; $('lvHud').textContent = 'LV ' + G.lvl.n; $('themeH').textContent = THEMES[G.lvl.theme].name + ' · ' + G.lvl.boss.name;
  $('coinsH').textContent = fmt(save.coins);
  $('upStartLv').textContent = '+' + save.upStart * 2; $('upStartCost').textContent = fmt(costStart());
  $('upGoldLv').textContent = '+' + save.upGold * 10 + '%'; $('upGoldCost').textContent = fmt(costGold());
  $('upStartBtn').disabled = save.coins < costStart() || save.upStart >= 15;
  $('upGoldBtn').disabled = save.coins < costGold() || save.upGold >= 20;
  refreshAvatarCard(); refreshRoadCard();
}
function refreshRoadCard() {
  $('roadName').textContent = save.road < 0 ? 'Auto' : THEMES[save.road].name;
  $('roadSub').textContent = save.road < 0 ? 'changes every level' : 'your choice';
}
function stepRoad(d) {
  Snd.init(); Snd.sfx.click();
  let i = save.road + d; if (i < -1) i = THEMES.length - 1; if (i >= THEMES.length) i = -1;
  save.road = i; persist(); loadLevel(save.level); refreshRoadCard();
}

/* ---------- avatars: costumes bought with coins ---------- */
function drawAvatar(cv, a) {
  const g = cv.getContext('2d'), w = cv.width, h = cv.height; g.clearRect(0, 0, w, h);
  const u = h / 100, cx = w / 2, shade = (x, y, ww, hh, col, r = 3 * u) => { g.fillStyle = col; g.beginPath(); if (g.roundRect) g.roundRect(x, y, ww, hh, r); else g.rect(x, y, ww, hh); g.fill(); };
  const lg = (x0, y0, x1, y1, col) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(255,255,255,.38)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.28)'); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0); };
  g.save(); g.translate(0, 4 * u);
  shade(cx - 13 * u, 58 * u, 11 * u, 30 * u, a.legs); shade(cx + 2 * u, 58 * u, 11 * u, 30 * u, a.legs);
  shade(cx - 14 * u, 84 * u, 13 * u, 7 * u, a.boots); shade(cx + 1 * u, 84 * u, 13 * u, 7 * u, a.boots);
  shade(cx - 29 * u, 28 * u, 9 * u, 30 * u, a.arms); shade(cx + 20 * u, 28 * u, 9 * u, 30 * u, a.arms);
  shade(cx - 20 * u, 26 * u, 40 * u, 36 * u, a.torso, 6 * u);
  if (a.pat === 1) { g.fillStyle = a.acc; for (let k = 0; k < 4; k++) g.fillRect(cx - 20 * u, (30 + k * 9) * u, 40 * u, 4.5 * u); }
  if (a.pat === 2) { g.fillStyle = a.acc; g.fillRect(cx - 20 * u, 54 * u, 40 * u, 5 * u); }
  g.beginPath(); g.arc(cx, 16 * u, 13 * u, 0, 7); g.fillStyle = a.head; g.fill();
  if (a.pat === 3) { g.fillStyle = a.acc; g.fillRect(cx - 13 * u, 12 * u, 26 * u, 6 * u); }
  g.globalCompositeOperation = 'source-atop'; lg(0, 0, w, h * 0.9, '#fff'); g.restore();
}
function refreshAvatarCard() {
  const a = AVATARS[save.avatar]; $('avName').textContent = a.name; drawAvatar($('avCanvas'), a);
  const owned = save.avatars.filter(Boolean).length; $('avSub').textContent = owned + ' of ' + AVATARS.length + ' owned';
}
function openWardrobe() {
  Snd.init(); Snd.sfx.click(); buildWardrobe(); layer('wardrobe', true);
}
function closeWardrobe() { Snd.sfx.click(); layer('wardrobe', false); refreshHud(); }
function buildWardrobe() {
  $('wdCoins').textContent = fmt(save.coins);
  const grid = $('wdGrid'); grid.innerHTML = '';
  AVATARS.forEach((a, i) => {
    const own = !!save.avatars[i], on = save.avatar === i;
    const d = document.createElement('div'); d.className = 'av' + (on ? ' on' : '');
    const cv = document.createElement('canvas'); cv.width = 96; cv.height = 112; drawAvatar(cv, a); d.appendChild(cv);
    const nm = document.createElement('div'); nm.className = 'avn'; nm.textContent = a.name; d.appendChild(nm);
    const b = document.createElement('button'); b.className = 'avb' + (own ? (on ? ' eq' : ' use') : ' buyit');
    if (on) { b.textContent = 'EQUIPPED'; b.disabled = true; }
    else if (own) { b.textContent = 'USE'; }
    else { b.innerHTML = '<span class="coin"></span> ' + fmt(a.cost); b.disabled = save.coins < a.cost; }
    b.addEventListener('click', () => pickAvatar(i)); d.appendChild(b); grid.appendChild(d);
  });
}
function pickAvatar(i) {
  Snd.init(); const a = AVATARS[i];
  if (!save.avatars[i]) {
    if (save.coins < a.cost) { Snd.sfx.click(); return; }
    save.coins -= a.cost; save.avatars[i] = 1; Snd.sfx.recruit();
  } else Snd.sfx.click();
  save.avatar = i; setCostume(mats.player, a); teamColors.player.set(a.c);
  persist(); buildWardrobe(); $('coinsH').textContent = fmt(save.coins); refreshAvatarCard();
}

/* ---------- layers ---------- */
function layer(id, on) { const e = $(id); e.classList.toggle('hide', !on); e.classList.toggle('on', on); }
function setState(s) {
  G.state = s;
  document.body.classList.toggle('playing', s !== 'home');
  layer('home', s === 'home'); layer('hud', s === 'play' || s === 'win' || s === 'lose');
  layer('pause', s === 'pause'); layer('result', s === 'result'); layer('ctrl', s === 'play'); Snd.duckAmbience(s === 'pause');
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

/* ---- boss fights: each level plays differently (brawl / dodge / push / smash) ---- */
const FIGHT_RATE = { brawl: 0.10, dodge: 0.05, push: 0.06, smash: 0.08 };   // share of the smaller side lost per 0.1 s
const PUSH_BACK = 14;                                                       // how far the crowd shoves the boss over the fight
function showTelegraph(side) {
  const T = bossObj.tele, P = G.player;
  if (!side) { T.visible = false; return; }
  T.visible = true; T.material.opacity = 0.5; T.position.set(side * 2.3, 0.09, P.z - 1);
}
function slamImpact(side) {
  const P = G.player, B = G.boss;
  Snd.sfx.stomp(); Snd.sfx.explode(); G.shake = 1; haptic('heavy'); flashScreen('#ff5a2a', 0.2);
  for (let i = 0; i < 24; i++) bits.emit(side * (0.5 + Math.random() * 3.6), 0.3, P.z - 1 + (Math.random() - 0.5) * 12, '#d9c9a0', 1, 6, 0.8, 0.9, -4, 0.8, 0);
  sparks.emit(side * 2.3, 0.6, P.z - 1, '#ff7a3a', 40, 9, 0.4, 0.8, -6, 1.2, 4);
  const per = Math.max(1, Math.round(P.count / Math.max(1, P.persons.length))), victims = [];
  for (const p of P.persons) if (!p.fall && p.y < 0.7 && p.x * side > -0.2 && Math.abs(p.z - (P.z - 1)) < 7.5) victims.push(p);
  for (const p of victims) { if (P.count <= 0) break; P.hit(per, p); }
  if (victims.length) floatText('-' + fmt(victims.length * per), '#ff6a6a', side * 2.3, 2.4, P.z);
}
function dodgeAttacks(dt) {
  const A = G.boss.atk, P = G.player;
  A.t -= dt;
  if (A.phase === 0 && A.t <= 0) {          // warn: a red zone appears on one half of the arena
    A.side = P.x < 0 ? -1 : 1; if (Math.random() < 0.3) A.side = -A.side;
    A.phase = 1; A.t = 1.15; showTelegraph(A.side); Snd.sfx.alarm(); haptic('tick');
  } else if (A.phase === 1) {
    bossObj.tele.material.opacity = 0.3 + 0.3 * Math.abs(Math.sin(G.t * 14)); bossObj.tele.position.z = P.z - 1;
    if (A.t <= 0) { A.phase = 0; A.t = 1.5; showTelegraph(0); slamImpact(A.side); }
  }
}
function updateBoss(dt) {
  const P = G.player, B = G.boss;
  if (B.state === 'idle' && P.z - B.z < 78 + B.scale * 2) {
    B.state = 'walk'; world.hideArch(); showBanner(B.name + '!'); Snd.sfx.boss(); G.shake = 0.7; haptic('heavy');
    setTimeout(() => { if (G.state === 'play') showTip(B.hint); }, 1400);
  }
  if (B.state === 'walk') {
    B.z += 3.6 * dt;
    if (P.z - B.z < B.rad + P.radius * 0.7 + 0.8) { B.state = 'fight'; B.tick = 0; B.stompT = 0; B.zFight = B.z; B.atk.t = 1.4; B.atk.phase = 0; if (B.style === 'smash') showTip('JUMP to smash him!'); }
  } else if (B.state === 'fight') {
    B.tick -= dt; B.stompT -= dt;
    if (B.stompT <= 0) {
      B.stompT = 0.9; Snd.sfx.stomp(); G.shake = Math.max(G.shake, 0.45); haptic('heavy');
      for (let i = 0; i < 16; i++) bits.emit((Math.random() - 0.5) * 6, 0.3, B.z + B.rad, '#d9c9a0', 1, 5, 0.6, 0.8, -4, 0.3, 0);
    }
    if (B.style === 'dodge') dodgeAttacks(dt);
    if (B.style === 'push') {
      /* every hit shoves him back and the crowd follows, until he teeters at the edge */
      const target = B.zFight - (1 - B.hp / B.hpMax) * PUSH_BACK;
      B.z += (target - B.z) * Math.min(1, dt * 6);
      P.z += (B.z + B.rad + P.radius * 0.7 + 0.8 - P.z) * Math.min(1, dt * 6);
    }
    if (B.tick <= 0) {
      B.tick = 0.1;
      const L = Math.max(1, Math.ceil(Math.min(P.count, B.hp) * FIGHT_RATE[B.style]));
      let dmg = L;
      if (B.style === 'smash') dmg = P.jy > 0.8 ? L * 3 : (Math.random() < 0.3 ? L : 0);   // only a leaping crowd really hurts him
      dmg = Math.min(dmg, B.hp);
      B.hp -= dmg; P.hit(L); if (dmg) B.hitFlash = 1;
      sparks.emit((Math.random() - 0.5) * 3, B.scale * (0.2 + Math.random() * 0.8), B.z + B.rad * 0.6, B.style === 'smash' && dmg ? '#ffffff' : '#ffd24a', dmg ? 6 : 2, 6, 0.3, 0.5);
      if (dmg) { Snd.sfx.bossHit(); haptic('tick'); }
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
      if (p.fall) continue;
      if (h.type === 'saw') { if (p.y > 0.9) continue; const dx = p.x - h.x, dz = p.z - h.z; if (dx * dx + dz * dz < HAZ_R2) { hit = p; break; } }
      else if (h.type === 'roller') { if (p.y > 1.15) continue; if (Math.abs(p.x - h.x) < 1.05 && Math.abs(p.z - h.z) < 1.25) { hit = p; break; } }
      else if (h.type === 'wall') { if (p.y > 1.6) continue; if (Math.abs(p.z - h.z) < 0.9 && Math.abs(p.x) < 4.6 && Math.abs(p.x - h.gx) > h.gw / 2) { hit = p; break; } }
      else { if (p.y > 1.05) continue; if (p.x > h.x0 && p.x < h.x1 && Math.abs(p.z - h.z) < 1.0) { hit = p; break; } }
    }
    if (!hit) continue;
    h.cd = h.type === 'wall' ? 0.05 : 0.07;
    const w = Math.max(1, Math.round(P.count / Math.max(1, P.persons.length)));
    if (h.type === 'wall' || h.type === 'roller') Snd.sfx.crash();
    sparks.emit(hit.x, 0.8, hit.z, h.type === 'saw' ? '#ffd24a' : h.type === 'wall' ? '#ffe9a0' : h.type === 'roller' ? '#ff9a3a' : '#ff5a4a', 8, 6, 0.22, 0.5);
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
      sparks.emit(b.x, b.y, b.z, '#c46bff', 40, 9, 0.4, 1.0, -6, 0.8, 1); sparks.emit(b.x, b.y, b.z, '#ff7ae8', 16, 6, 0.25, 0.7, -4, 0.8, 0.5);
      Snd.sfx.box(); haptic('success'); flashScreen('#e3c2ff', 0.2);
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
  if (G.boost > 0) { G.boost -= dt; sp *= 1.6; }   // speed strip
  if (P.fighting) sp *= 0.25;
  if (B.state === 'walk') sp = 7; else if (B.state === 'fight') sp = 0;
  P.z -= sp * dt; P.running = true;
  /* jump arc */
  if (G.jump.t >= 0) {
    G.jump.t += dt * Math.max(0.6, G.speedMul);   // a jump covers the same ground at any speed
    if (G.jump.t > G.jumpDur + 0.08) { G.jump.t = -1; P.jy = 0; Snd.sfx.land(); bits.emit(P.x, 0.1, P.z, '#e8e2d0', 8, 3, 0.5, 0.6, -1, 0.3, P.radius); }
    else { const u = clamp(G.jump.t / G.jumpDur, 0, 1); P.jy = G.jumpH * 4 * u * (1 - u); }
  } else P.jy = 0;
  /* jump pads fling the crowd high into a sky full of treasure; speed strips give a burst of speed */
  for (const pad of lvl.pads) {
    if (pad.used || Math.abs(P.z - pad.z) > 2.2) continue;
    if (Math.abs(P.x - pad.x) < P.radius * 0.6 + 1.8) {
      pad.used = true; pad.glow = 1; G.jumpH = SUPER_H; G.jumpDur = SUPER_DUR; G.jump.t = 0;
      Snd.sfx.boing(); haptic('heavy'); G.fovKick = 9; flashScreen('#aaffcc', 0.25); showTip('SUPER JUMP!');
      sparks.emit(pad.x, 0.3, pad.z, '#8dffb0', 40, 8, 0.35, 0.9, -4, 1.4, 1.2);
    }
  }
  for (const s of lvl.strips) {
    if (s.used || Math.abs(P.z - s.z) > 2.6) continue;
    s.used = true; s.glow = 1; G.boost = 2.4; Snd.sfx.boost(); haptic('success'); G.fovKick = 8; showTip('SPEED BOOST!');
  }
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
    /* the finishing blow: slow motion, a camera on the boss, and a defeat that depends on how this level\'s boss was fought */
    const B = G.boss; B.state = 'dying'; B.deadT = 0; B.hitFlash = 1; B.fx1 = B.fell = false; B.slideV = 0; B.vy = 0; B.fy = 0;
    P.running = false; G.endR = 0; G.cheered = false; G.tsc = 0.35; showTelegraph(0);
    Snd.sfx.explode(); haptic('heavy'); flashScreen('#ffffff', 0.35); G.shake = 1;
    sparks.emit(0, B.scale * 0.8, B.z + B.rad * 0.5, '#ffd24a', 90, 14, 0.5, 1.2, -6, 0.8, 2); sparks.emit(0, B.scale * 0.8, B.z + B.rad * 0.5, '#ff6a2a', 60, 11, 0.6, 1.0, -6, 0.8, 2);
    if (B.style === 'smash') Snd.sfx.rocket();
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
  $('resText').textContent = win ? (G.boss.name + ' defeated with ' + fmt(P.count) + ' survivors!') : 'Your crowd was wiped out. Pick better gates and dodge the traps!';
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
    const S = B.scale, rp = bossObj.rig.position;
    if (G.endR < 3.6) {
      /* cinematic: a low three-quarter view that keeps the whole boss in frame while he goes down */
      const a = 0.55 + G.endR * 0.15;
      posTmp.set(Math.sin(a) * (S * 1.8 + 6), Math.min(S * 0.5 + 3 + Math.max(0, rp.y) * 0.35, 40), rp.z + Math.cos(a) * (S * 2.5 + 9));
      lookTmp.set(0, Math.max(S * 0.7, rp.y + S * 0.6), rp.z);
    } else {
      const a = Math.PI * 0.8 + (G.endR - 3.6) * 0.5, R = 13;
      posTmp.set(P.x + Math.sin(a) * R, 5.5, P.z + Math.cos(a) * R); lookTmp.set(P.x, 2.4, P.z - 3);
    }
  } else if (s === 'lose') {
    posTmp.set(P.x * 0.5, D * 0.6, P.z + D * 0.85); lookTmp.set(P.x * 0.5, 0.5, P.z - D * 0.3);
  } else {
    const boss = B.state === 'walk' || B.state === 'fight';
    if (boss) {
      /* raised and pulled back so the whole boss, not just his feet, is in view with the crowd below him */
      const S = B.scale, midZ = (P.z + B.z) / 2;
      posTmp.set(P.x * 0.3, 6 + S * 1.1, P.z + 10 + S * 1.55 + D * 0.15);
      lookTmp.set(P.x * 0.2, S * 0.8, midZ - S * 0.1);
    } else {
      const k = 1 + (G.speedMul - 1) * 0.1;
      posTmp.set(P.x * 0.55, D * 0.58 * k, P.z + D * 0.82 * k);
      lookTmp.set(P.x * 0.55, 0.8, P.z - D * 0.32);
    }
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
  const bossCam = G.state === 'win' || (G.state === 'play' && (G.boss.state === 'walk' || G.boss.state === 'fight'));
  const fov = 58 + G.fovKick + (G.state === 'play' ? 2 + (G.speedMul - 1) * 5 : 0) + (bossCam ? 6 : 0);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); pointScale = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2)); sparks.setScale(pointScale); bits.setScale(pointScale); }
  G.fovKick *= Math.exp(-dt * 4);
}

/* ---------- how each boss goes down ---------- */
function fireworks(x, y, z, n) {
  const pal = ['#ff4d6d', '#ffd23a', '#4dd2ff', '#7cff8a', '#c06bff', '#ff9a2e', '#ffffff'];
  for (let i = 0; i < n; i++) sparks.emit(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 6, z + (Math.random() - 0.5) * 6, pal[i % pal.length], 36, 13, 0.55, 1.5, -4, 0.6, 1);
  bits.confetti(x, y, z, 50, 10);
}
function bigDropFx(x, z) {
  const y = world.drop.y, kind = world.drop.kind;
  if (kind === 'water') { sparks.emit(x, y + 0.3, z, '#cfeeff', 120, 13, 0.7, 1.6, -9, 1.6, 4); bits.emit(x, y, z, '#ffffff', 50, 6, 1.2, 1.6, -5, 1.2, 4); Snd.sfx.bigSplash(); }
  else if (kind === 'lava') { sparks.emit(x, y + 0.3, z, '#ff8a2a', 140, 15, 0.8, 1.8, -6, 1.8, 4); bits.emit(x, y, z, '#40302c', 40, 5, 1.4, 2.2, -1, 1.2, 4); Snd.sfx.bigSplash(); Snd.sfx.sizzle(); }
  else { bits.emit(x, y + 0.3, z, '#cdbd9a', 80, 9, 1.4, 1.8, -2, 1, 5); sparks.emit(x, y + 0.5, z, '#ffeeb0', 30, 8, 0.4, 0.8, -4, 1, 3); Snd.sfx.thud(); Snd.sfx.explode(); }
}
function updateBossDying(dt) {
  const B = G.boss, rig = bossObj.rig, S = B.scale;
  B.deadT += dt; const t = B.deadT;
  const face = _qa.setFromAxisAngle(Y_UP, YAW0 + Math.PI);
  bossObj.crown.rotation.y = G.t * 3; if (bossObj.halo) bossObj.halo.rotation.z = G.t * 3;
  if (B.style === 'brawl') {
    /* topples slowly backwards, away from the crowd, and hits the ground with a crash */
    const k = clamp(t / 1.5, 0, 1);
    rig.quaternion.copy(face).multiply(_qb.setFromAxisAngle(X_AXIS, k * k * 1.5)); rig.position.set(0, 0, B.z);
    if (t > 1.5 && !B.fx1) {
      B.fx1 = true; Snd.sfx.stomp(); G.shake = 1.3; haptic('heavy');
      for (let i = 0; i < 40; i++) bits.emit((Math.random() - 0.5) * S * 0.6, 0.3, B.z - S * 1.5 + (Math.random() - 0.5) * S * 0.5, '#d9c9a0', 1, 8, 1.1, 1.3, -4, 0.8, 0);
      sparks.emit(0, 1, B.z - S * 1.5, '#ffd24a', 70, 12, 0.5, 1);
    }
    if (t > 3.8) rig.scale.setScalar(Math.max(0.001, 1 - (t - 3.8) * 1.4));
  } else if (B.style === 'dodge') {
    /* shudders, then bursts into fireworks */
    rig.quaternion.copy(face);
    if (t < 1.3) {
      rig.position.set(Math.sin(t * 70) * 0.35, 0, B.z); B.hitFlash = 0.6 + 0.4 * Math.sin(t * 40);
      if (Math.random() < dt * 70) sparks.emit((Math.random() - 0.5) * S * 0.5, S * Math.random() * 1.6, B.z, '#ffd24a', 2, 5, 0.3, 0.5);
    } else {
      rig.position.set(0, 0, B.z);
      if (!B.fx1) { B.fx1 = true; Snd.sfx.explode(); G.shake = 1.4; flashScreen('#ffffff', 0.5); fireworks(0, S * 0.9, B.z, 7); }
      rig.scale.setScalar(Math.max(0.001, 1 - (t - 1.3) * 4)); if (rig.scale.x <= 0.002) rig.visible = false;
    }
  } else if (B.style === 'push') {
    /* the crowd's last shove sends him sliding off the edge of the arena into the drop */
    const edge = G.lvl.boss.z - 19;
    if (!B.fell) {
      B.slideV += 9 * dt; B.z -= (2 + B.slideV) * dt; rig.position.set(0, 0, B.z);
      rig.quaternion.copy(face).multiply(_qb.setFromAxisAngle(X_AXIS, 0.15 + Math.sin(t * 8) * 0.05));
      if (B.z < edge) { B.fell = true; B.vy = 3; B.tf = 0; Snd.sfx.boss(); }
    } else {
      B.tf += dt; B.vy -= 26 * dt; B.fy += B.vy * dt; B.z -= 4 * dt;
      rig.position.set(0, B.fy, B.z); rig.quaternion.copy(face).multiply(_qb.setFromAxisAngle(X_AXIS, Math.min(2.6, B.tf * 1.6)));
      if (B.fy < world.drop.y - S * 0.35 && !B.fx1) { B.fx1 = true; bigDropFx(0, B.z); rig.visible = false; G.shake = 1.5; }
    }
  } else {
    /* smash: crouches, then is blasted into the sky like a rocket and bursts into fireworks */
    if (t < 0.8) {
      rig.quaternion.copy(face); rig.position.set(Math.sin(t * 50) * 0.2, 0, B.z); B.hitFlash = 0.5;
      if (Math.random() < dt * 80) sparks.emit(0, 0.2, B.z, '#ffb04a', 2, 6, 0.4, 0.5, -3, 1.2, S * 0.3);
    } else {
      const v = t - 0.8, y = 14 * v * v + 3 * v;
      if (!B.fx0) { B.fx0 = true; G.shake = 1.2; haptic('heavy'); }
      rig.quaternion.setFromAxisAngle(Y_UP, YAW0 + Math.PI + v * 11).multiply(_qb.setFromAxisAngle(X_AXIS, 0.35)); rig.position.set(0, y, B.z);
      sparks.emit(0, y, B.z, '#ff9a2a', 3, 5, 0.9, 0.7, -2, -0.6, S * 0.25);
      if (y > 75 && !B.fx1) { B.fx1 = true; fireworks(0, y, B.z, 8); Snd.sfx.explode(); rig.visible = false; }
    }
  }
}

/* ---------- per-frame ---------- */
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000;
  if (rawDt < 0.011) return;   // 60-90 fps is plenty; a 144 Hz screen should not draw twice the work
  let dt = Math.min(0.05, rawDt); last = now;
  if (G.state === 'loading' || !G.player) return;
  /* slow motion for the finishing blow, easing back to normal speed */
  if (G.state === 'win') { G.endR += dt; G.tsc = G.endR < 1.7 ? 0.35 : Math.min(1, 0.35 + (G.endR - 1.7) * 1.3); } else G.tsc = 1;
  const rdt = dt; dt *= G.tsc;
  const paused = G.state === 'pause';
  if (!paused) {
    G.t += dt;
    const am = G.state === 'play' ? lerp(0.6, 1.6, (G.speedMul - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) : 1;   // legs keep up with the speed
    for (const m of runMasters) m.mixer.update(dt * m.speed * am);
    for (const m of idleMasters) m.mixer.update(dt * m.speed);
    const B = G.boss, bo = bossObj;
    B.hitFlash = Math.max(0, B.hitFlash - dt * 4);
    const wTarget = B.state === 'walk' ? 1 : (B.state === 'fight' && B.style === 'push' ? 0.6 : 0);
    bo.w += (wTarget - bo.w) * (1 - Math.exp(-dt * 4));
    bo.walk.setEffectiveWeight(bo.w); bo.idle.setEffectiveWeight(1 - bo.w);
    bo.walk.timeScale = 1.1; bo.mixer.update(dt);
    if (G.state === 'play') updatePlay(dt);
    else if (G.state === 'win') {
      G.endT += dt; updateBossDying(dt);
      if (!G.cheered && G.endR > 2.4) {
        G.cheered = true; G.player.cheer = true; Snd.sfx.cheer(); Snd.sfx.win(); haptic('success'); showBanner('VICTORY!'); flashScreen('#ffffff', 0.25);
      }
      if (G.cheered && Math.random() < dt * 30) bits.confetti(G.player.x, 8, G.player.z, 4, 10);
      if (G.endR > 6.4) showResult();
    } else if (G.state === 'lose') {
      G.endT += dt; if (G.endT > 1.6) showResult();
    }
    G.player.update(dt, G.t);
    G.enemies.forEach(e => e.update(dt, G.t)); G.recruits.forEach(e => e.update(dt, G.t));
    shadows.instanceMatrix.needsUpdate = true; rings.instanceMatrix.needsUpdate = true; if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
    /* boss placement (while he is not being defeated) */
    if (G.state !== 'win') {
      bo.rig.position.set(B.state === 'fight' ? Math.sin(G.t * 40) * 0.08 : 0, 0, B.z);
      bo.rig.quaternion.setFromAxisAngle(Y_UP, YAW0 + Math.PI); bo.rig.scale.setScalar(1);
      bo.crown.rotation.y = G.t * 1.3; bo.crown.position.y = 1.74 * B.scale + Math.sin(G.t * 2) * 0.08;
      if (bo.halo) bo.halo.rotation.z = G.t * 1.5;
      /* final big boss: flames licking up from his body */
      if (B.tier >= 3 && B.state !== 'idle' && Math.random() < dt * 40) sparks.emit((Math.random() - 0.5) * 2.4, 0.3, B.z + (Math.random() - 0.5) * 2, '#ff9a2a', 1, 2, 0.5, 0.9, 4, 1.5, 1.2);
    }
    const f = B_flash(B.hitFlash);
    mats.boss.emissive.setRGB(bossBase.r + f, bossBase.g + f * 0.12, bossBase.b);
    sparks.update(dt); bits.update(dt);
    updateCamera(rdt);
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
    if (B.state === 'dead' || B.state === 'dying' || G.state === 'home' || G.state === 'result' || G.state === 'win') G.bossLabel.style.display = 'none';
    else if (B.state !== 'idle' || P.z - B.z < 110) {
      placeLabel(G.bossLabel, 0, B.scale * 2.35, B.z, 104);
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
$('avBtn').addEventListener('click', openWardrobe); $('wdClose').addEventListener('click', closeWardrobe);
$('roadPrev').addEventListener('click', () => stepRoad(-1)); $('roadNext').addEventListener('click', () => stepRoad(1));
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

window.__cr = { G, world, scene, camera, renderer, loadLevel, startRun, finish, save, AVATARS, THEMES, mats, get bossObj() { return bossObj; }, jumpNow, showTip, get Q() { return Q; }, runMasters, pool };
boot();
