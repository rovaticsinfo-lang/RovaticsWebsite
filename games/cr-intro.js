/* Rovatics Game Zone: the 3D opening shown when a Rovatics game starts. Real extruded 3D letters that drop in and bounce,
   polished metal lit by reflected light panels, a spinning glow ring, sparkles and a camera that glides in.
   It renders on the game's own renderer and cleans up after itself. Reusable by any Rovatics game. */
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

export const INTRO_SECONDS = 3.9;

export class Intro {
  constructor(renderer, fontUrl) {
    this.renderer = renderer; this.fontUrl = fontUrl; this.t = 0; this.ready = false; this.letters = []; this.alive = true;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    this.scene.background = new THREE.Color('#050a18'); this.scene.fog = new THREE.Fog('#050a18', 14, 40);
  }

  async load() {
    const font = await new Promise((res, rej) => new FontLoader().load(this.fontUrl, res, undefined, rej));
    const R = this.renderer, S = this.scene;
    /* reflections for the metal: a little studio made of bright panels */
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 16, 12), new THREE.MeshBasicMaterial({ color: '#10182c', side: THREE.BackSide })));
    for (const [c, p, s] of [['#8fe8ff', [-8, 4, 6], [6, 3]], ['#ff6ad8', [9, 2, 4], [5, 3]], ['#ffffff', [0, 9, -2], [10, 3]], ['#ffd27a', [0, -3, 9], [8, 2]]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s[0], s[1]), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(...p); m.lookAt(0, 0, 0); env.add(m);
    }
    this.pm = new THREE.PMREMGenerator(R); this.envRT = this.pm.fromScene(env, 0.03); S.environment = this.envRT.texture; S.environmentIntensity = 1.3;
    S.add(new THREE.HemisphereLight('#9fdcff', '#1a1030', 0.6));
    this.l1 = new THREE.PointLight('#5fe6ff', 160, 40); this.l2 = new THREE.PointLight('#ff5ad0', 130, 40); S.add(this.l1, this.l2);

    const metal = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.8, roughness: 0.22, emissive: '#3aa8d8', emissiveIntensity: 0.85 });
    const neon = new THREE.MeshStandardMaterial({ color: '#7af6ff', emissive: '#2ad8ff', emissiveIntensity: 1.6, metalness: 0.4, roughness: 0.3 });
    const mirror = new THREE.MeshBasicMaterial({ color: '#8fd8ff', transparent: true, opacity: 0.16, depthWrite: false });
    this.group = new THREE.Group(); S.add(this.group); this.group.scale.setScalar(this.fit || 1);
    this.word = (text, size, depth, mat, y, delay0, gap) => {
      const geos = [...text].map(ch => ch === ' ' ? null : new TextGeometry(ch, { font, size, depth, curveSegments: 6, bevelEnabled: true, bevelThickness: depth * 0.18, bevelSize: size * 0.03, bevelSegments: 3 }));
      let total = 0; const ws = geos.map(g => { if (!g) return size * 0.5; g.computeBoundingBox(); const w = g.boundingBox.max.x - g.boundingBox.min.x; return w; });
      ws.forEach(w => { total += w + gap; }); total -= gap;
      let x = -total / 2;
      geos.forEach((g, i) => {
        if (g) {
          g.translate(-g.boundingBox.min.x - ws[i] / 2, 0, -depth / 2);
          const m = new THREE.Mesh(g, mat), pivot = new THREE.Group(); pivot.add(m); pivot.position.set(x + ws[i] / 2, y, 0); this.group.add(pivot);
          this.letters.push({ pivot, y, delay: delay0 + i * 0.12, x: pivot.position.x });
        }
        x += ws[i] + gap;
      });
    };
    this.word('ROVATICS', 1.55, 0.55, metal, 0.55, 0.25, 0.14);
    this.word('GAME ZONE', 0.62, 0.22, neon, -1.35, 1.25, 0.1);
    /* glow ring behind the title and a glossy floor */
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.05, 12, 120), new THREE.MeshBasicMaterial({ color: '#5fe6ff' })); this.ring.position.set(0, 0.2, -2.4); S.add(this.ring);
    this.ring2 = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.035, 12, 100), new THREE.MeshBasicMaterial({ color: '#ff5ad0' })); this.ring2.position.set(0, 0.2, -2.6); S.add(this.ring2);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: '#070d1e', metalness: 0.85, roughness: 0.28 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -1.9; S.add(floor);
    /* sparkles */
    const n = 260, pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 22; pos[i * 3 + 1] = Math.random() * 9 - 1.5; pos[i * 3 + 2] = (Math.random() - 0.5) * 14 - 3; seed[i] = Math.random(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.sparks = new THREE.Points(g, new THREE.PointsMaterial({ color: '#bff4ff', size: 0.07, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })); S.add(this.sparks);
    this.ready = true;
  }

  resize(w, h) {
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.portrait = w < h;
    /* shrink the whole title so ROVATICS always fits across the screen */
    const d = this.portrait ? 15 : 11.5, visW = 2 * d * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect;
    this.fit = Math.min(1, visW / 12.8); if (this.group) this.group.scale.setScalar(this.fit);
  }

  update(dt) {
    this.t += dt; const t = this.t;
    if (!this.ready) return;
    for (const L of this.letters) {
      const u = Math.max(0, t - L.delay);
      /* drop from above and bounce */
      const k = u < 0.01 ? 0 : Math.min(1, u / 0.9), bounce = k >= 1 ? 0 : Math.abs(Math.cos(k * 7.5)) * Math.pow(1 - k, 1.7);
      L.pivot.position.y = L.y + (u < 0.01 ? 12 : 12 * bounce);
      L.pivot.rotation.y = (1 - Math.min(1, u / 1.4)) * 2.6 * Math.sign(L.x || 1); L.pivot.visible = t >= L.delay;
      L.pivot.scale.setScalar(0.6 + 0.4 * Math.min(1, u * 3));
    }
    this.ring.rotation.z = t * 0.7; this.ring.rotation.x = Math.sin(t * 0.6) * 0.25; this.ring2.rotation.z = -t * 1.1; this.ring2.rotation.y = Math.sin(t * 0.8) * 0.35;
    const s = 1 + Math.max(0, 0.4 - Math.abs(t - 1.5)) * 0.3; this.ring.scale.setScalar(s);
    this.l1.position.set(Math.cos(t * 1.7) * 7, 2 + Math.sin(t * 1.1) * 2, 4); this.l2.position.set(-Math.cos(t * 1.3) * 7, 1.5, 4 + Math.sin(t * 1.9) * 2);
    this.sparks.rotation.y = t * 0.05; this.sparks.position.y = Math.sin(t) * 0.2;
    /* camera glides in and drifts */
    const e = 1 - Math.pow(1 - Math.min(1, t / 3.2), 3), dist = (this.portrait ? 19 : 14.5) - e * (this.portrait ? 4 : 3);
    this.camera.position.set(Math.sin(t * 0.55 - 0.6) * 2.4 * (1 - e * 0.5), 1.1 + (1 - e) * 2.2, dist);
    this.camera.lookAt(0, -0.2, 0);
  }

  render() { this.renderer.render(this.scene, this.camera); }

  dispose() {
    this.alive = false;
    this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); });
    if (this.envRT) this.envRT.dispose(); if (this.pm) this.pm.dispose();
  }
}
