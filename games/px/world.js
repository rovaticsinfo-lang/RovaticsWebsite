/* PARALLAX environments: one distinct 3D world per chapter (sky, light, terrain, landmark props, living particles), varied by level seed.
   Plus LUMA, the survey drone, and the hidden lore fragment in every level. Everything is procedural. */
import * as THREE from 'three';
import { rng } from './logic.js';
import { sphere, cyl, box } from './gfx.js';

const SKY_VS = 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const SKY_FS = `varying vec3 vP; uniform vec3 cTop, cMid, cHor, cFog, uSun; uniform float uStars, uT;
float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main(){
  float h = vP.y; vec3 c = mix(cHor, cMid, smoothstep(0.0, 0.32, h)); c = mix(c, cTop, smoothstep(0.28, 0.95, h));
  c = mix(c, cFog, smoothstep(0.0, -0.35, h));
  float sd = max(0.0, dot(vP, normalize(uSun))); c += vec3(1.0, 0.85, 0.6) * (pow(sd, 90.0) * 0.9 + pow(sd, 6.0) * 0.18);
  vec3 q = floor(vP * 170.0); float st = step(0.9965, hash(q)); c += st * uStars * (0.6 + 0.4 * sin(uT * 2.0 + hash(q + 3.0) * 40.0)) * smoothstep(-0.05, 0.3, h);
  gl_FragColor = vec4(c, 1.0); }`;

export const QUALITY = { low: { pr: 1, shadow: 0, props: 0.45, motes: 60, bubbles: 40 }, medium: { pr: 1.5, shadow: 1024, props: 0.75, motes: 140, bubbles: 90 }, high: { pr: 2, shadow: 2048, props: 1, motes: 260, bubbles: 160 } };

export class World {
  constructor(renderer, scene, W, seed, q, reduceMotion) {
    this.renderer = renderer; this.scene = scene; this.W = W; this.q = q; this.r = rng(seed * 313 + W.id * 17); this.anim = []; this.group = new THREE.Group(); this.reduce = reduceMotion; this.t = 0; scene.add(this.group);
    const top = new THREE.Color(W.sky[0]), mid = new THREE.Color(W.sky[1]), hor = new THREE.Color(W.sky[2]), fog = new THREE.Color(W.fog);
    const hue = (this.r() - 0.5) * 0.05;   // each level shifts the palette a touch so no two skies are the same
    [top, mid, hor].forEach(c => c.offsetHSL(hue, 0, 0));
    this.sunDir = new THREE.Vector3(-0.5 + this.r() * 0.3, 0.35 + this.r() * 0.2, -0.8).normalize();
    this.skyMat = new THREE.ShaderMaterial({ uniforms: { cTop: { value: top }, cMid: { value: mid }, cHor: { value: hor }, cFog: { value: fog }, uSun: { value: this.sunDir }, uStars: { value: [0.25, 0.1, 0.1, 0.55, 1.4][W.id - 1] }, uT: { value: 0 } }, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 20), this.skyMat); this.sky.renderOrder = -10; this.group.add(this.sky);
    scene.background = null; scene.fog = new THREE.Fog(fog.clone().lerp(hor, 0.45), 28, 170);
    this.hemi = new THREE.HemisphereLight(mid, new THREE.Color(W.base).multiplyScalar(0.3), 0.55); this.group.add(this.hemi);
    this.sun = new THREE.DirectionalLight(W.sun, 1.5); this.sun.position.copy(this.sunDir).multiplyScalar(40); this.group.add(this.sun, this.sun.target);
    if (q.shadow) { this.sun.castShadow = true; this.sun.shadow.mapSize.set(q.shadow, q.shadow); const c = this.sun.shadow.camera; c.left = -16; c.right = 16; c.top = 16; c.bottom = -16; c.near = 5; c.far = 90; this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; } else renderer.shadowMap.enabled = false;
    this.l1 = new THREE.PointLight(W.accent, 60, 30, 1.6); this.l1.position.set(-7, 5, 6); this.l2 = new THREE.PointLight(W.accent2, 50, 30, 1.6); this.l2.position.set(7, 4, -4); this.group.add(this.l1, this.l2);
    /* reflections for the metals and glass: the sky itself, baked once */
    const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(60, 24, 16), new THREE.ShaderMaterial({ uniforms: this.skyMat.uniforms, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide })));
    for (const [c, p] of [[W.accent, [-20, 10, 10]], [W.accent2, [20, 8, -10]], ['#ffffff', [0, 30, 0]]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(...p); m.lookAt(0, 0, 0); envScene.add(m); }
    this.pm = new THREE.PMREMGenerator(renderer); this.envRT = this.pm.fromScene(envScene, 0.04); scene.environment = this.envRT.texture; scene.environmentIntensity = 0.55;
    this.buildGround(); [this.w1, this.w2, this.w3, this.w4, this.w5][W.id - 1].call(this); this.buildMotes(); this.buildLuma(); this.buildShard();
  }
  add(o) { this.group.add(o); return o; }
  mat(c, o = {}) { return new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0.05, ...o }); }
  glowMat(c, i = 1) { return new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.4 }); }
  n(x) { return Math.max(2, Math.round(x * this.q.props)); }
  ring(rmin, rmax, count, fn) { for (let i = 0; i < count; i++) { const a = (i / count) * Math.PI * 2 + this.r() * 0.4, d = rmin + this.r() * (rmax - rmin); fn(Math.cos(a) * d, Math.sin(a) * d, a, i); } }

  buildGround() {
    const W = this.W, g = new THREE.Mesh(new THREE.CircleGeometry(160, 64), this.mat(new THREE.Color(W.base).multiplyScalar(0.4), { roughness: [0.9, 0.55, 0.15, 0.85, 0.2][W.id - 1], metalness: [0.05, 0.5, 0.4, 0.15, 0.7][W.id - 1] }));
    g.rotation.x = -Math.PI / 2; g.position.y = -0.31; g.receiveShadow = true; this.group.add(g);
    const rg = new THREE.Mesh(new THREE.RingGeometry(11, 11.25, 96), new THREE.MeshBasicMaterial({ color: W.accent, transparent: true, opacity: 0.55, side: THREE.DoubleSide })); rg.rotation.x = -Math.PI / 2; rg.position.y = -0.29; this.group.add(rg); this.rg = rg;
    const rg2 = new THREE.Mesh(new THREE.RingGeometry(13.5, 13.62, 96), new THREE.MeshBasicMaterial({ color: W.accent2, transparent: true, opacity: 0.35, side: THREE.DoubleSide })); rg2.rotation.x = -Math.PI / 2; rg2.position.y = -0.29; this.group.add(rg2);
  }
  /* World 1: basalt columns, moss, arches and floating gardens in warm light. */
  w1() {
    const W = this.W, stone = this.mat(W.base, { roughness: 0.9 }), moss = this.mat('#5f8a4a', { roughness: 1 }), bronze = new THREE.MeshStandardMaterial({ color: W.metal, metalness: 0.8, roughness: 0.35 });
    this.ring(16, 60, this.n(26), (x, z, a, i) => { const h = 6 + this.r() * 22, c = new THREE.Group(); const s = cyl(1.1 + this.r() * 0.7, 1.4 + this.r() * 0.7, h, stone, 6); s.position.y = h / 2; s.castShadow = true; c.add(s); if (this.r() < 0.6) { const cap = sphere(1.5, moss, 10); cap.scale.y = 0.35; cap.position.y = h; c.add(cap); } if (this.r() < 0.35) { const rg = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 6, 20), bronze); rg.rotation.x = Math.PI / 2; rg.position.y = h * 0.6; c.add(rg); } c.position.set(x, 0, z); c.rotation.y = this.r() * 3; this.group.add(c); });
    this.ring(24, 50, this.n(5), (x, z, a) => { const arch = new THREE.Mesh(new THREE.TorusGeometry(5, 0.9, 6, 20, Math.PI), stone); arch.position.set(x, 0, z); arch.rotation.y = a + Math.PI / 2; arch.castShadow = true; this.group.add(arch); });
    this.ring(20, 55, this.n(7), (x, z, a, i) => { const g = new THREE.Group(), top = cyl(3.2, 2.8, 0.8, moss, 12); top.position.y = 0.4; const rock = new THREE.Mesh(new THREE.ConeGeometry(2.8, 3.6, 8), stone); rock.rotation.x = Math.PI; rock.position.y = -1.6; g.add(top, rock); for (let k = 0; k < 3; k++) { const tr = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2, 6), this.mat('#3f7a3c')); tr.position.set((this.r() - 0.5) * 3, 1.8, (this.r() - 0.5) * 3); g.add(tr); } g.position.set(x, 9 + this.r() * 12, z); this.group.add(g); this.anim.push((t, dt) => { g.position.y += Math.sin(t * 0.5 + i) * 0.003; g.rotation.y += dt * 0.05; }); });
    const sun = new THREE.Mesh(new THREE.TorusGeometry(26, 0.5, 8, 80), this.glowMat('#ffe2a8', 1.6)); sun.position.set(-30, 40, -110); this.group.add(sun); this.anim.push((t) => { sun.rotation.z = t * 0.05; });
  }
  /* World 2: foundry pylons, magnet rings and rocks that hang the wrong way up. */
  w2() {
    const W = this.W, dark = this.mat(W.base, { roughness: 0.5, metalness: 0.7 }), glow = this.glowMat(W.accent2, 1.6), copper = new THREE.MeshStandardMaterial({ color: W.metal, metalness: 0.9, roughness: 0.3 });
    this.ring(16, 58, this.n(20), (x, z, a, i) => { const h = 8 + this.r() * 26, g = new THREE.Group(), s = cyl(0.7, 1.2, h, dark, 8); s.position.y = h / 2; s.castShadow = true; g.add(s); for (let k = 0; k < 3; k++) { const rg = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.2, 8, 24), k % 2 ? glow : copper); rg.rotation.x = Math.PI / 2; rg.position.y = h * (0.35 + k * 0.2); g.add(rg); this.anim.push((t) => { rg.rotation.z = t * (0.6 + k * 0.3) * (i % 2 ? 1 : -1); }); } g.position.set(x, 0, z); this.group.add(g); });
    this.ring(18, 52, this.n(7), (x, z, a, i) => { const rg = new THREE.Mesh(new THREE.TorusGeometry(5 + this.r() * 4, 0.45, 10, 48), i % 2 ? glow : copper); rg.position.set(x, 10 + this.r() * 14, z); rg.rotation.set(this.r() * 3, this.r() * 3, 0); this.group.add(rg); const sp = 0.2 + this.r() * 0.3; this.anim.push((t, dt) => { rg.rotation.x += dt * sp; rg.rotation.y += dt * sp * 0.6; }); });
    this.ring(14, 50, this.n(16), (x, z, a, i) => { const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 + this.r() * 2.2, 0), new THREE.MeshStandardMaterial({ color: '#4a4f5a', flatShading: true, roughness: 0.8 })); rock.position.set(x, 12 + this.r() * 16, z); this.group.add(rock); const cone = new THREE.Mesh(new THREE.ConeGeometry(0.8, 8, 6), dark); cone.rotation.x = Math.PI; cone.position.set(x, rock.position.y + 5.5, z); this.group.add(cone); this.anim.push((t, dt) => { rock.rotation.y += dt * 0.1; rock.position.y += Math.sin(t + i) * 0.004; }); });
  }
  /* World 3: glass reef spires, swaying kelp, jellyfish and rising bubbles. */
  w3() {
    const W = this.W, glass = new THREE.MeshPhysicalMaterial({ color: '#9ff4ee', transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.1, clearcoat: 1, emissive: '#1fb6b0', emissiveIntensity: 0.35 }), pink = new THREE.MeshPhysicalMaterial({ color: '#ff9ae6', transparent: true, opacity: 0.5, roughness: 0.05, emissive: '#c0309a', emissiveIntensity: 0.4 }), kelp = this.mat('#1f9a6a', { roughness: 0.6, emissive: '#0a4a30', emissiveIntensity: 0.5 });
    this.ring(14, 56, this.n(30), (x, z, a, i) => { const h = 5 + this.r() * 24, s = new THREE.Mesh(new THREE.ConeGeometry(0.9 + this.r() * 1.8, h, 5 + (i % 3)), i % 4 === 0 ? pink : glass); s.position.set(x, h / 2 - 0.3, z); s.rotation.z = (this.r() - 0.5) * 0.25; this.group.add(s); });
    this.ring(12, 48, this.n(28), (x, z, a, i) => { const h = 6 + this.r() * 10, k = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, h, 6, 6), kelp); k.geometry.translate(0, h / 2, 0); k.position.set(x, -0.3, z); this.group.add(k); this.anim.push((t) => { k.rotation.z = Math.sin(t * 0.8 + i) * 0.12; k.rotation.x = Math.cos(t * 0.6 + i * 2) * 0.1; }); });
    this.ring(14, 44, this.n(9), (x, z, a, i) => { const g = new THREE.Group(), bell = new THREE.Mesh(new THREE.SphereGeometry(1.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ff8ae0', emissive: '#ff4ac8', emissiveIntensity: 0.9, transparent: true, opacity: 0.75 })); g.add(bell); for (let k = 0; k < 6; k++) { const t = cyl(0.04, 0.03, 3, this.glowMat('#ffa0e8', 0.8), 5); const ang = k / 6 * Math.PI * 2; t.position.set(Math.cos(ang) * 0.9, -1.5, Math.sin(ang) * 0.9); g.add(t); } g.position.set(x, 7 + this.r() * 12, z); this.group.add(g); this.anim.push((t, dt) => { g.position.y += Math.sin(t * 0.9 + i) * 0.01; bell.scale.y = 1 + Math.sin(t * 2 + i) * 0.08; g.rotation.y += dt * 0.2; }); });
    for (let i = 0; i < 5; i++) { const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 55, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#7affee', transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); cone.position.set(-30 + i * 15 + this.r() * 6, 24, -20 - this.r() * 30); cone.rotation.z = 0.15; this.group.add(cone); }
    const n = this.q.bubbles, pos = new Float32Array(n * 3), spd = new Float32Array(n); for (let i = 0; i < n; i++) { pos[i * 3] = (this.r() - 0.5) * 70; pos[i * 3 + 1] = this.r() * 30; pos[i * 3 + 2] = (this.r() - 0.5) * 70 - 5; spd[i] = 1 + this.r() * 2.5; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#d8fffb', size: 0.35, transparent: true, opacity: 0.7, depthWrite: false })); this.group.add(pts);
    this.anim.push((t, dt) => { for (let i = 0; i < n; i++) { pos[i * 3 + 1] += spd[i] * dt; if (pos[i * 3 + 1] > 30) pos[i * 3 + 1] = -0.3; } g.attributes.position.needsUpdate = true; });
  }
  /* World 4: colossal gears, a stopped clock, shattered blocks of city and frozen rain. */
  w4() {
    const W = this.W, brass = new THREE.MeshStandardMaterial({ color: W.metal, metalness: 0.85, roughness: 0.35 }), dark = this.mat('#3a2f44', { roughness: 0.7 });
    this.ring(18, 58, this.n(9), (x, z, a, i) => { const R = 4 + this.r() * 6, g = new THREE.Group(), body = new THREE.Mesh(new THREE.TorusGeometry(R, 0.7, 6, 40), brass); g.add(body); const teeth = 12 + Math.floor(R * 2); for (let k = 0; k < teeth; k++) { const t = box(0.9, 1.2, 0.9, brass), ang = k / teeth * Math.PI * 2; t.position.set(Math.cos(ang) * (R + 0.8), Math.sin(ang) * (R + 0.8), 0); t.rotation.z = ang; g.add(t); } for (let k = 0; k < 4; k++) { const sp = box(R * 2, 0.5, 0.5, brass); sp.rotation.z = k * Math.PI / 4; g.add(sp); } g.position.set(x, 6 + this.r() * 14, z); g.rotation.y = a + Math.PI / 2; this.group.add(g); const sp = (0.15 + this.r() * 0.25) * (i % 2 ? 1 : -1); this.anim.push((t, dt) => { body.parent.children.forEach(c => { }); g.children.forEach(c => { }); g.rotation.z += dt * sp; }); });
    this.ring(16, 55, this.n(18), (x, z, a, i) => { const w = 2 + this.r() * 4, h = 4 + this.r() * 10, b = box(w, h, w, dark); b.position.set(x, 8 + this.r() * 16, z); b.rotation.set(this.r() * 0.5, this.r() * 3, this.r() * 0.5); this.group.add(b); for (let k = 0; k < 3; k++) { const win = box(w * 0.3, 0.7, 0.05, this.glowMat('#ffc86b', 1.3)); win.position.set(0, h * (0.3 - k * 0.3), w / 2 + 0.03); b.add(win); } this.anim.push((t, dt) => { b.rotation.y += dt * 0.05; b.position.y += Math.sin(t * 0.4 + i) * 0.004; }); });
    const face = new THREE.Mesh(new THREE.CircleGeometry(22, 48), new THREE.MeshBasicMaterial({ color: '#e8c98a', transparent: true, opacity: 0.3, side: THREE.DoubleSide })); face.position.set(10, 36, -105); this.group.add(face);
    const hand1 = box(1.2, 17, 0.4, this.glowMat('#ffd89a', 1)), hand2 = box(0.8, 12, 0.4, this.glowMat('#c9a2ff', 1)); hand1.geometry.translate(0, 8.5, 0); hand2.geometry.translate(0, 6, 0); hand1.position.copy(face.position); hand2.position.copy(face.position); hand1.position.z += 0.5; hand2.position.z += 0.6; this.group.add(hand1, hand2); this.anim.push((t) => { hand1.rotation.z = -t * 0.04; hand2.rotation.z = -t * 0.5; });
    const n = this.n(160), pos = []; for (let i = 0; i < n; i++) { const x = (this.r() - 0.5) * 90, y = this.r() * 30, z = (this.r() - 0.5) * 80 - 10; pos.push(x, y, z, x, y - 1.6, z); } const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); this.group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#cbb8ff', transparent: true, opacity: 0.4 })));
  }
  /* World 5: a black star with a burning ring, planetary rings, impossible stairs and drifting fragments. */
  w5() {
    const W = this.W, star = sphere(9, new THREE.MeshBasicMaterial({ color: '#000000' }), 32); star.position.set(-20, 34, -120); this.group.add(star);
    const acc = new THREE.Mesh(new THREE.TorusGeometry(16, 1.4, 12, 90), new THREE.MeshBasicMaterial({ color: '#ffb25a' })); acc.position.copy(star.position); acc.rotation.x = 1.25; this.group.add(acc); const acc2 = new THREE.Mesh(new THREE.TorusGeometry(21, 0.5, 8, 90), new THREE.MeshBasicMaterial({ color: '#8a6aff', transparent: true, opacity: 0.8 })); acc2.position.copy(star.position); acc2.rotation.x = 1.25; this.group.add(acc2);
    this.anim.push((t) => { acc.rotation.z = t * 0.2; acc2.rotation.z = -t * 0.12; });
    for (let i = 0; i < 3; i++) { const pl = new THREE.Mesh(new THREE.RingGeometry(26 + i * 6, 30 + i * 6, 80), new THREE.MeshBasicMaterial({ color: ['#6a5aff', '#ff7ad8', '#7affe0'][i], transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })); pl.position.set(40, 18, -60); pl.rotation.set(1.2 + i * 0.1, 0.3, i * 0.2); this.group.add(pl); }
    const planet = sphere(7, this.mat('#4a3a8a', { roughness: 0.6, emissive: '#1a1040', emissiveIntensity: 0.5 }), 24); planet.position.set(40, 18, -60); this.group.add(planet);
    const stairs = new THREE.Group(), blockM = new THREE.MeshStandardMaterial({ color: '#c8c0ff', roughness: 0.3, metalness: 0.5, emissive: '#2a1f66', emissiveIntensity: 0.6 }); for (let i = 0; i < 28; i++) { const side = Math.floor(i / 7), k = i % 7, b = box(2.2, 0.5, 2.2, blockM), L = 7 * 2.2; const p = [[k * 2.2, 0], [L, k * 2.2], [L - k * 2.2, L], [0, L - k * 2.2]][side]; b.position.set(p[0] - L / 2, i * 0.35, p[1] - L / 2); stairs.add(b); } stairs.position.set(26, 6, -26); this.group.add(stairs); this.anim.push((t, dt) => { stairs.rotation.y += dt * 0.06; });
    const mob = new THREE.Mesh(new THREE.TorusKnotGeometry(5, 0.35, 160, 8, 2, 3), this.glowMat('#ffffff', 1.4)); mob.position.set(-30, 16, -34); this.group.add(mob); this.anim.push((t, dt) => { mob.rotation.y += dt * 0.15; mob.rotation.x += dt * 0.1; });
    this.ring(15, 55, this.n(26), (x, z, a, i) => { const b = box(1 + this.r() * 3, 1 + this.r() * 3, 1 + this.r() * 3, new THREE.MeshStandardMaterial({ color: '#14122a', roughness: 0.3, metalness: 0.8, emissive: i % 2 ? '#3a2a9a' : '#9a4a2a', emissiveIntensity: 0.5 })); b.position.set(x, 3 + this.r() * 24, z); b.rotation.set(this.r() * 3, this.r() * 3, this.r() * 3); this.group.add(b); const s = (this.r() - 0.5) * 0.5; this.anim.push((t, dt) => { b.rotation.x += dt * s; b.rotation.y += dt * s * 0.7; b.position.y += Math.sin(t * 0.5 + i) * 0.005; }); });
  }
  buildMotes() {
    const n = this.q.motes, pos = new Float32Array(n * 3), v = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (this.r() - 0.5) * 36; pos[i * 3 + 1] = this.r() * 14; pos[i * 3 + 2] = (this.r() - 0.5) * 36; v[i * 3] = (this.r() - 0.5) * 0.3; v[i * 3 + 1] = (this.r() - 0.3) * 0.25; v[i * 3 + 2] = (this.r() - 0.5) * 0.3; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); this.motes = new THREE.Points(g, new THREE.PointsMaterial({ color: this.W.accent, size: 0.1, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })); this.group.add(this.motes);
    this.anim.push((t, dt) => { if (this.reduce) return; for (let i = 0; i < n; i++) { for (let k = 0; k < 3; k++) pos[i * 3 + k] += v[i * 3 + k] * dt; if (pos[i * 3 + 1] > 14) pos[i * 3 + 1] = 0; if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] = 14; if (Math.abs(pos[i * 3]) > 18) pos[i * 3] *= -0.98; if (Math.abs(pos[i * 3 + 2]) > 18) pos[i * 3 + 2] *= -0.98; } g.attributes.position.needsUpdate = true; });
  }
  /* LUMA: the survey drone. Records clues, never solves. Its colours and trail come from the player's cosmetics. */
  buildLuma() {
    const g = new THREE.Group(); this.lumaShellMat = new THREE.MeshStandardMaterial({ color: '#ffb347', roughness: 0.25, metalness: 0.6 }); this.lumaGlowMat = new THREE.MeshStandardMaterial({ color: '#fff1c9', emissive: '#fff1c9', emissiveIntensity: 1.6 });
    const body = sphere(0.34, this.lumaShellMat, 24); const eye = sphere(0.14, this.lumaGlowMat, 14); eye.position.set(0, 0.02, 0.28); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 32), this.lumaGlowMat); ring.rotation.x = Math.PI / 2; g.add(body, eye, ring); this.luma = g; this.lumaRing = ring; this.add(g);
    this.lumaTarget = null; this.lumaPos = new THREE.Vector3(-6, 5, 5); g.position.copy(this.lumaPos); this.trailMax = 40; this.trailPos = new Float32Array(this.trailMax * 3); const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3)); this.trail = new THREE.Points(tg, new THREE.PointsMaterial({ color: '#ffd27a', size: 0.18, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })); this.trail.frustumCulled = false; this.trail.visible = false; this.group.add(this.trail); this.trailI = 0;
  }
  setCosmetics(shell, trail) { this.lumaShellMat.color.set(shell.c1); this.lumaGlowMat.color.set(shell.c2); this.lumaGlowMat.emissive.set(shell.c2); this.trail.visible = !!(trail && trail.color); if (trail && trail.color) this.trail.material.color.set(trail.color); this.trailKind = trail && trail.id; }
  buildShard() {
    const a = (this.r() * 1.6 - 0.8) + Math.PI / 2 * 0, d = 9 + this.r() * 5, ang = -Math.PI / 2 + (this.r() - 0.5) * 2.4;   // somewhere in front of the default camera, around the diorama
    const g = new THREE.Group(), core = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), new THREE.MeshStandardMaterial({ color: '#fff3c0', emissive: '#ffcf5a', emissiveIntensity: 2.2, roughness: 0.1 })); core.scale.y = 1.5; g.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.025, 6, 30), new THREE.MeshBasicMaterial({ color: '#ffe9a0' })); g.add(ring); g.position.set(Math.cos(ang) * d, 1.8 + this.r() * 4.5, Math.sin(ang) * d - 1); g.userData.lore = true; core.userData.lore = true; ring.userData.lore = true; this.shard = g; this.shardPick = [core, ring]; this.group.add(g);
    const pl = new THREE.PointLight('#ffcf5a', 10, 6, 1.5); g.add(pl); this.shardTaken = false;
  }
  takeShard() { if (this.shardTaken) return false; this.shardTaken = true; this.shardBurst = 1.2; return true; }
  update(t, dt) {
    this.t += dt; this.skyMat.uniforms.uT.value = this.t; this.anim.forEach(f => f(this.t, dt));
    this.rg.material.opacity = 0.4 + Math.sin(this.t * 1.5) * 0.15; this.l1.position.x = -7 + Math.sin(this.t * 0.3) * 2; this.l2.position.z = -4 + Math.cos(this.t * 0.25) * 3;
    const s = this.shard; if (s) { if (this.shardTaken) { this.shardBurst = Math.max(0, this.shardBurst - dt); s.scale.setScalar(Math.max(0.001, this.shardBurst)); s.position.y += dt * 4; s.visible = this.shardBurst > 0; } else { s.rotation.y += dt * 1.2; s.position.y += Math.sin(this.t * 1.7) * 0.003; } }
    /* LUMA hovers; when a hint asks it to, it floats over to the thing to look at */
    const home = new THREE.Vector3(Math.sin(this.t * 0.35) * 7, 4.2 + Math.sin(this.t * 0.9) * 0.4, 5.5 + Math.cos(this.t * 0.35) * 2), want = this.lumaTarget ? this.lumaTarget : home;
    this.lumaPos.lerp(want, Math.min(1, dt * (this.lumaTarget ? 3.2 : 1.2))); this.luma.position.copy(this.lumaPos); this.luma.lookAt(this.lumaPos.x + (want.x - this.lumaPos.x) * 0.2, this.lumaPos.y - 0.2, this.lumaPos.z - 2); this.lumaRing.rotation.z += dt * 3;
    if (this.trail.visible) { const i = this.trailI = (this.trailI + 1) % this.trailMax; this.trailPos[i * 3] = this.lumaPos.x; this.trailPos[i * 3 + 1] = this.lumaPos.y; this.trailPos[i * 3 + 2] = this.lumaPos.z; this.trail.geometry.attributes.position.needsUpdate = true; this.trail.material.size = this.trailKind === 'trail_ribbon' ? 0.28 : this.trailKind === 'trail_stars' ? 0.14 : 0.2; }
  }
  dispose() {
    this.scene.remove(this.group); this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); });
    if (this.envRT) this.envRT.dispose(); if (this.pm) this.pm.dispose(); this.scene.environment = null; this.scene.fog = null;
  }
}
