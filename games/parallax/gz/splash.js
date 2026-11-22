/* ROVATICS GAME ZONE splash: a glass-and-gold 3D "R" with moving light, rings and sparkles, then the title.
   Reusable by every Rovatics game: new Splash(renderer, fontUrl).load() then update(dt)/render(). */
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

export const SPLASH_SECONDS = 4.2;

function rShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(0.95, 0); s.lineTo(0.95, 1.7); s.lineTo(1.35, 1.7); s.lineTo(2.25, 0); s.lineTo(3.45, 0); s.lineTo(2.42, 1.95);
  s.bezierCurveTo(3.3, 2.25, 3.6, 2.8, 3.6, 3.25); s.bezierCurveTo(3.6, 4.0, 3.0, 4.4, 2.1, 4.4); s.lineTo(0, 4.4); s.lineTo(0, 0);
  const h = new THREE.Path(); h.moveTo(0.95, 2.55); h.lineTo(2.0, 2.55); h.bezierCurveTo(2.45, 2.55, 2.65, 2.85, 2.65, 3.2); h.bezierCurveTo(2.65, 3.55, 2.45, 3.85, 2.0, 3.85); h.lineTo(0.95, 3.85); h.lineTo(0.95, 2.55);
  s.holes.push(h); return s;
}

export class Splash {
  constructor(renderer, fontUrl) {
    this.renderer = renderer; this.fontUrl = fontUrl; this.t = 0; this.ready = false; this.mode = 'splash'; this.hubK = 0;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120); this.scene.background = new THREE.Color('#04060f'); this.scene.fog = new THREE.Fog('#04060f', 16, 46);
  }
  async load() {
    const S = this.scene, R = this.renderer;
    const font = await new Promise((res, rej) => new FontLoader().load(this.fontUrl, res, undefined, rej));
    const env = new THREE.Scene(); env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 16, 12), new THREE.MeshBasicMaterial({ color: '#0a1022', side: THREE.BackSide })));
    for (const [c, p, s] of [['#9ff0ff', [-9, 5, 6], [7, 3]], ['#ff7ad8', [10, 3, 4], [6, 3]], ['#ffffff', [0, 10, -2], [12, 3]], ['#ffd27a', [0, -2, 10], [9, 2]], ['#7a8cff', [-6, -3, -8], [8, 3]]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(s[0], s[1]), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(...p); m.lookAt(0, 0, 0); env.add(m); }
    this.pm = new THREE.PMREMGenerator(R); this.envRT = this.pm.fromScene(env, 0.03); S.environment = this.envRT.texture; S.environmentIntensity = 1.2;
    S.add(new THREE.HemisphereLight('#a8d8ff', '#1a1030', 0.5)); this.l1 = new THREE.PointLight('#6fe8ff', 220, 40, 1.5); this.l2 = new THREE.PointLight('#ff66d0', 70, 40, 1.5); S.add(this.l1, this.l2);

    this.logo = new THREE.Group(); S.add(this.logo);
    const geo = new THREE.ExtrudeGeometry(rShape(), { depth: 0.9, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.12, bevelSegments: 6, curveSegments: 20 }); geo.center();
    const gold = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: '#ffc45a', metalness: 1, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, emissive: '#8a5200', emissiveIntensity: 0.55 }));
    const glass = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: '#bfeaff', metalness: 0, roughness: 0.03, transparent: true, opacity: 0.16, clearcoat: 1, envMapIntensity: 2.0, depthWrite: false })); glass.scale.set(1.09, 1.07, 1.45);
    this.logo.add(gold, glass); this.gold = gold; this.glass = glass; this.logo.scale.setScalar(0.62);
    const ringM = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85 });
    this.ring1 = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.04, 10, 140), ringM('#6fe8ff')); this.ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.03, 10, 120), ringM('#ff66d0')); this.logo.add(this.ring1, this.ring2);
    const tm = new THREE.MeshPhysicalMaterial({ color: '#f4fbff', metalness: 0.9, roughness: 0.2, clearcoat: 1, emissive: '#3aa8d8', emissiveIntensity: 0.5 });
    this.words = new THREE.Group(); S.add(this.words); this.letters = [];
    const word = (text, size, depth, y, delay, gap, mat) => {
      const gs = [...text].map(ch => ch === ' ' ? null : new TextGeometry(ch, { font, size, depth, curveSegments: 6, bevelEnabled: true, bevelThickness: depth * 0.15, bevelSize: size * 0.025, bevelSegments: 3 }));
      const ws = gs.map(g => { if (!g) return size * 0.5; g.computeBoundingBox(); return g.boundingBox.max.x - g.boundingBox.min.x; }); const total = ws.reduce((a, b) => a + b + gap, -gap); let x = -total / 2;
      gs.forEach((g, i) => { if (g) { g.translate(-g.boundingBox.min.x - ws[i] / 2, 0, -depth / 2); const m = new THREE.Mesh(g, mat); const pv = new THREE.Group(); pv.add(m); pv.position.set(x + ws[i] / 2, y, 0); this.words.add(pv); this.letters.push({ pv, y, delay: delay + i * 0.07 }); } x += ws[i] + gap; });
    };
    word('ROVATICS', 0.82, 0.3, -3.35, 1.7, 0.1, tm); word('GAME ZONE', 0.5, 0.18, -4.45, 2.3, 0.1, new THREE.MeshStandardMaterial({ color: '#7af6ff', emissive: '#2ad8ff', emissiveIntensity: 1.5, roughness: 0.3, metalness: 0.4 }));
    this.words.scale.setScalar(1);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshStandardMaterial({ color: '#060b1c', metalness: 0.9, roughness: 0.22 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -2.6; S.add(floor);
    const n = 320, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 30; pos[i * 3 + 1] = Math.random() * 14 - 2.4; pos[i * 3 + 2] = (Math.random() - 0.5) * 18 - 4; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); this.sparks = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#c8f4ff', size: 0.08, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })); S.add(this.sparks);
    this.ready = true;
  }
  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.portrait = w < h; const d = this.portrait ? 21 : 15.5, vw = 2 * d * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect; this.fit = Math.min(1, vw / 12); this.dist = d; }
  /* After the splash the logo glides into a hub pose: smaller, to the upper left, still turning. */
  toHub() { this.mode = 'hub'; this.hubT = 0; }
  update(dt) {
    this.t += dt; const t = this.t; if (!this.ready) return;
    const e = k => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
    const intro = e(t / 1.6), wiggle = (1 - intro) * 3.5;
    if (this.mode === 'hub') this.hubT = Math.min(1, this.hubT + dt / 1.4);
    const hk = this.mode === 'hub' ? e(this.hubT) : 0, fit = this.fit || 1;
    this.logo.scale.setScalar((0.62 * intro + 0.001) * (1 - hk * 0.45) * fit); this.logo.rotation.y = Math.sin(t * 0.6) * 0.5 + wiggle; this.logo.rotation.x = Math.sin(t * 0.4) * 0.08;
    this.logo.position.set(-hk * 6.2 * fit, 0.7 + Math.sin(t * 0.9) * 0.1 + hk * 2.2 * fit, 0);
    this.ring1.rotation.x = t * 0.7; this.ring1.rotation.y = t * 0.4; this.ring2.rotation.x = -t * 0.5; this.ring2.rotation.z = t * 0.8;
    const sweep = (t * 0.5) % 1; this.glass.material.opacity = 0.12 + Math.max(0, 0.3 - Math.abs(sweep - 0.5)) * 0.5;
    this.letters.forEach(L => { const u = Math.max(0, t - L.delay), k = Math.min(1, u / 0.7), bounce = k >= 1 ? 0 : Math.abs(Math.cos(k * 7)) * Math.pow(1 - k, 1.6); L.pv.position.y = L.y + (u < 0.01 ? 9 : 9 * bounce); L.pv.visible = t >= L.delay; L.pv.rotation.y = (1 - k) * 2.2; });
    this.words.scale.setScalar(fit * (1 - hk * 0.0)); this.words.position.y = hk * -1.5 * fit; this.words.visible = this.mode === 'splash' || hk < 0.95; this.words.children.forEach(c => { });
    this.l1.position.set(Math.cos(t * 1.4) * 8, 2 + Math.sin(t) * 2, 5); this.l2.position.set(-Math.cos(t * 1.1) * 8, 1, 5 + Math.sin(t * 1.7) * 2);
    this.sparks.rotation.y = t * 0.04; const d = this.dist || 15.5;
    this.camera.position.set(Math.sin(t * 0.3) * 1.6, 1.2 + (1 - e(t / 3)) * 2, d - e(t / 3.4) * 2.5); this.camera.lookAt(0, -0.3 + hk * 0.6, 0);
  }
  render() { this.renderer.render(this.scene, this.camera); }
  dispose() { this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); }); if (this.envRT) this.envRT.dispose(); if (this.pm) this.pm.dispose(); }
}
