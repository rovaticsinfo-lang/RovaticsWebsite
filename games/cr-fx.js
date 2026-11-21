/* Crowd Rush Legends: GPU point-sprite particles (bursts, confetti) and ambient floating motes. */
import * as THREE from 'three';

const POINT_VS = `
attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
uniform float uScale; varying vec3 vC; varying float vA;
void main(){
  vC = aColor; vA = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = max(1.0, aSize * uScale / max(0.1, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;
const POINT_FS = `
varying vec3 vC; varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.08, d) * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vC, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Bursts {
  constructor(scene, max, additive) {
    this.max = max; this.i = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max); this.base = new Float32Array(max);
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -999;
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('aColor', this.aCol);
    g.setAttribute('aSize', this.aSize); g.setAttribute('aAlpha', this.aAlpha);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } }, vertexShader: POINT_VS, fragmentShader: POINT_FS,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false; this.points.renderOrder = 20;
    scene.add(this.points);
    this._c = new THREE.Color();
  }
  setScale(s) { this.mat.uniforms.uScale.value = s; }
  /* hex colour, count, outward speed, point size (world units), life (s), gravity, upward bias */
  emit(x, y, z, hex, count, speed, size, life, grav = -9, up = 0.6, spread = 0.3) {
    this._c.set(hex);
    for (let n = 0; n < count; n++) {
      const i = this.i; this.i = (this.i + 1) % this.max;
      const a = Math.random() * 6.2832, e = Math.random(), sp = speed * (0.35 + Math.random() * 0.65);
      this.pos[i * 3] = x + (Math.random() - 0.5) * spread; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * spread;
      this.vel[i * 3] = Math.cos(a) * sp * (0.4 + e); this.vel[i * 3 + 1] = (up + Math.random() * 0.8) * speed * 0.7; this.vel[i * 3 + 2] = Math.sin(a) * sp * (0.4 + e);
      this.col[i * 3] = this._c.r; this.col[i * 3 + 1] = this._c.g; this.col[i * 3 + 2] = this._c.b;
      this.base[i] = size * (0.6 + Math.random() * 0.8); this.size[i] = this.base[i];
      this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.7); this.grav[i] = grav; this.alpha[i] = 1;
    }
  }
  /* Rainbow confetti falling around a point. */
  confetti(x, y, z, count, spreadXZ) {
    const pal = ['#ff4d6d', '#ffd23a', '#4dd2ff', '#7cff8a', '#c06bff', '#ff9a2e'];
    for (let n = 0; n < count; n++) {
      this.emit(x + (Math.random() - 0.5) * spreadXZ, y + Math.random() * 6, z + (Math.random() - 0.5) * spreadXZ,
        pal[(Math.random() * pal.length) | 0], 1, 2.5, 0.22, 2.8, -2.2, 0.2, 0);
    }
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) { this.alpha[i] = 0; this.pos[i * 3 + 1] = -999; } continue; }
      this.life[i] -= dt;
      const k = i * 3;
      this.vel[k + 1] += this.grav[i] * dt;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      const f = Math.max(0, this.life[i] / this.maxLife[i]);
      this.alpha[i] = Math.min(1, f * 2.2); this.size[i] = this.base[i] * (0.4 + f * 0.8);
      const damp = Math.max(0, 1 - dt * 1.6); this.vel[k] *= damp; this.vel[k + 2] *= damp;
    }
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
  }
}

/* Ambient motes (pollen, dust, snow, neon sparks, embers) that wrap around the camera. */
const AMB_VS = `
attribute vec4 aSeed;
uniform float uT, uScale, uSz, uSway; uniform vec3 uCam, uBox, uVel;
varying float vA;
void main(){
  vec3 p = aSeed.xyz * uBox + uVel * uT;
  p.x += sin(uT * 0.7 + aSeed.w * 30.0) * uSway; p.z += cos(uT * 0.5 + aSeed.w * 20.0) * uSway;
  p.x = mod(p.x - uCam.x + uBox.x * 0.5, uBox.x) - uBox.x * 0.5 + uCam.x;
  p.z = mod(p.z - uCam.z + uBox.z * 0.5, uBox.z) - uBox.z * 0.5 + uCam.z;
  p.y = mod(p.y, uBox.y);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float tw = 0.6 + 0.4 * sin(uT * 2.0 + aSeed.w * 50.0);
  vA = tw * smoothstep(60.0, 12.0, -mv.z) * smoothstep(0.0, 2.0, -mv.z);
  gl_PointSize = max(1.0, uSz * (0.5 + aSeed.w) * uScale / max(0.1, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;
const AMB_FS = `
uniform vec3 uColor; varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vA * 0.9;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Ambient {
  constructor(scene, count) {
    const g = new THREE.BufferGeometry();
    const seed = new Float32Array(count * 4), pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { seed[i * 4] = Math.random(); seed[i * 4 + 1] = Math.random(); seed[i * 4 + 2] = Math.random(); seed[i * 4 + 3] = Math.random(); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uT: { value: 0 }, uScale: { value: 600 }, uSz: { value: 0.12 }, uSway: { value: 0.8 }, uCam: { value: new THREE.Vector3() },
        uBox: { value: new THREE.Vector3(50, 16, 60) }, uVel: { value: new THREE.Vector3(0.3, 0.1, 0.2) }, uColor: { value: new THREE.Color('#fff') }
      },
      vertexShader: AMB_VS, fragmentShader: AMB_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false; this.points.renderOrder = 19;
    scene.add(this.points);
  }
  setTheme(a) {
    const u = this.mat.uniforms;
    u.uColor.value.set(a.color); u.uSz.value = a.size; u.uSway.value = a.sway;
    u.uVel.value.set(a.vel[0], a.vel[1], a.vel[2]); u.uBox.value.set(a.box[0], a.box[1], a.box[2]);
  }
  update(t, cam, scale) {
    const u = this.mat.uniforms; u.uT.value = t; u.uCam.value.copy(cam.position); u.uScale.value = scale;
  }
}
