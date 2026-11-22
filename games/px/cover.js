/* PARALLAX cover art: rendered once in 3D (a solved mirror puzzle in front of the black star) and shown on the Game Zone card. */
import * as THREE from 'three';
import { World, QUALITY } from './world.js';
import { WORLDS, LEVELS } from './levels.js';
import { createView } from './views.js';
import { makeMats } from './gfx.js';
import { apply } from './logic.js';

export async function renderCover(renderer) {
  const W = 960, H = 540, scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(55, W / H, 0.1, 600), world = new World(renderer, scene, WORLDS[4], 5, QUALITY.low, true);
  const L = LEVELS[22]; let st = L.state; for (const m of L.sol) st = apply(st, m);                     // level 23, shown solved: the beam is lit
  const M = makeMats(WORLDS[4]), noop = () => {}, view = createView(st, M, { audio: new Proxy({}, { get: () => noop }) }); view.group.scale.setScalar(0.9); view.group.position.y = 3.2; scene.add(view.group);
  world.lumaPos.set(-3.6, 6.4, 5); world.luma.position.copy(world.lumaPos); world.lumaTarget = world.lumaPos.clone();
  cam.position.set(0, 4.6, 13.5); cam.lookAt(-2, 8, -30); for (let i = 0; i < 8; i++) { world.update(i * 0.1, 0.1); view.update(i * 0.1, 0.1); }
  const old = new THREE.Vector2(); renderer.getSize(old); const pr = renderer.getPixelRatio(); renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.render(scene, cam);
  const url = renderer.domElement.toDataURL('image/jpeg', 0.86); renderer.setPixelRatio(pr); renderer.setSize(old.x, old.y, false);
  scene.remove(view.group); view.destroy(); world.dispose(); return url;
}
