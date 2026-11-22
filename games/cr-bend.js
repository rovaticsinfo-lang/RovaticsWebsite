/* Devil Hunters: the road curves and rises. The game logic runs on a straight road; this module bends everything that is
   drawn (a "world bend" applied in the vertex shader of every material, shadows included) and mirrors the same maths in
   JavaScript for the camera, labels and the fall height. The bend is zero at the start and near the boss arena. */
import * as THREE from 'three';
import { rng, clamp } from './cr-util.js';

export const BEND = { P: { value: new THREE.Vector4() }, A: { value: new THREE.Vector4() }, L: { value: new THREE.Vector2(3000, 0) } };
const F1 = 1 / 190, F2 = 1 / 73, G1 = 1 / 150, G2 = 1 / 52;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function setBend(seed, length) {
  const r = rng(seed * 7717 + 11);
  BEND.P.value.set(r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28);
  BEND.A.value.set(22 + r() * 12, 7 + r() * 6, 4 + r() * 3, 1.5 + r() * 1.5);   // sideways sweep, sideways wiggle, big rise, small rise
  BEND.L.value.set(length, 0);
}
function weight(t) { return sm(70, 280, t) * (1 - sm(BEND.L.value.x - 300, BEND.L.value.x - 70, t)); }
export function bendX(z) {
  const t = -z, P = BEND.P.value, A = BEND.A.value;
  return weight(t) * (A.x * Math.sin(t * F1 + P.x) + A.y * Math.sin(t * F2 + P.y));
}
export function bendY(z) {
  const t = -z, P = BEND.P.value, A = BEND.A.value;
  return weight(t) * (A.z * (0.5 + 0.5 * Math.sin(t * G1 + P.z)) + A.w * (0.5 + 0.5 * Math.sin(t * G2 + P.w)));
}
export const bendSlope = z => bendX(z + 0.5) - bendX(z - 0.5);          // sideways drift per metre of road
export const bendRise = z => bendY(z - 0.5) - bendY(z + 0.5);           // climb per metre travelled (positive = uphill)
export function bendVec(v) { v.x += bendX(v.z); v.y += bendY(v.z); return v; }

export const BEND_GLSL = `
uniform vec4 uBP; uniform vec4 uBA; uniform vec2 uBL;
float bsm(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
vec3 bendOff(float z){
  float t = -z; float w = bsm(70.0, 280.0, t) * (1.0 - bsm(uBL.x - 300.0, uBL.x - 70.0, t));
  float x = uBA.x * sin(t * ${F1.toFixed(8)} + uBP.x) + uBA.y * sin(t * ${F2.toFixed(8)} + uBP.y);
  float y = uBA.z * (0.5 + 0.5 * sin(t * ${G1.toFixed(8)} + uBP.z)) + uBA.w * (0.5 + 0.5 * sin(t * ${G2.toFixed(8)} + uBP.w));
  return vec3(x * w, y * w, 0.0);
}`;

/* Makes a built-in material bend with the road. Safe to call more than once. */
export function bendify(mat) {
  if (!mat || mat.userData.bent || mat.isShaderMaterial) return mat;
  mat.userData.bent = true;
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : null;
  mat.onBeforeCompile = (sh, rd) => {
    if (prev) prev(sh, rd);
    sh.uniforms.uBP = BEND.P; sh.uniforms.uBA = BEND.A; sh.uniforms.uBL = BEND.L;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + BEND_GLSL)
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        vec4 wpBend = modelMatrix * mvPosition; wpBend.xyz += bendOff( wpBend.z ); mvPosition = viewMatrix * wpBend;
        gl_Position = projectionMatrix * mvPosition;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        #if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
          worldPosition.xyz += bendOff( worldPosition.z );
        #endif`);
  };
  mat.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|bend';
  mat.needsUpdate = true;
  return mat;
}

/* One shared depth material so shadows are drawn bent too. */
let depthMat = null;
export function bendDepthMaterial() {
  if (!depthMat) depthMat = bendify(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
  return depthMat;
}

/* Bend every drawable in a group; widen bounding spheres so culling still works for displaced objects. */
export function bendGroup(group) {
  group.traverse(o => {
    if (!(o.isMesh || o.isPoints || o.isLine)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(bendify);
    if (o.isInstancedMesh) { if (!o.boundingSphere) o.computeBoundingSphere(); o.boundingSphere.radius += 60; }
    else if (o.geometry) { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); if (!o.geometry.userData.widened) { o.geometry.boundingSphere.radius += 60; o.geometry.userData.widened = true; } }
    if (o.castShadow) o.customDepthMaterial = bendDepthMaterial();
  });
}
