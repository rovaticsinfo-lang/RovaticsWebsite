/* PARALLAX - the explorer: an original, fully rigged 3D human built in code (no downloaded model, nothing copied from any game).
 * Detailed clothing (jacket with collar, straps, belt and pouches, gloves, knee pads, boots, glowing backpack), a face with brows, eyes, nose,
 * mouth and ears, hair, and a joint skeleton animated by a pose blender: idle, walk, run, jump, reach, rotate, pull, press, inspect, celebrate.
 * The avatar faces +z in its own space; the world turns it with root.rotation.y.
 */
(function () {
  'use strict';
  const T = THREE, MV = (window.MV = window.MV || {}), PI = Math.PI;

  function capsule(r, len, mat, seg) {                                   // lathe capsule, centred on y=0, total length len (including caps)
    const pts = [], h = Math.max(0, len / 2 - r), n = 6; seg = seg || 14;
    for (let i = 0; i <= n; i++) { const a = -PI / 2 + PI / 2 * i / n; pts.push(new T.Vector2(Math.cos(a) * r, -h + Math.sin(a) * r)); }
    for (let i = 0; i <= n; i++) { const a = PI / 2 * i / n; pts.push(new T.Vector2(Math.cos(a) * r, h + Math.sin(a) * r)); }
    const m = new T.Mesh(new T.LatheGeometry(pts, seg), mat); m.castShadow = true; return m;
  }
  const box = (w, h, d, mat, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; return m; };
  const ball = (r, mat, x, y, z, sx, sy, sz) => { const m = new T.Mesh(new T.SphereGeometry(r, 16, 12), mat); m.position.set(x || 0, y || 0, z || 0); m.scale.set(sx || 1, sy || 1, sz || 1); m.castShadow = true; return m; };
  const std = (c, r, m, e) => new T.MeshStandardMaterial({ color: c, roughness: r == null ? .7 : r, metalness: m || 0, envMapIntensity: e == null ? .5 : e });

  MV.avatar = {
    create() {
      const skin = std(0xd6a07a, .55, 0, .3), hairM = std(0x1c1511, .55, .05), jacket = std(0x22304a, .5, .12, .6), shirt = std(0x56677a, .8), pants = std(0x2b3345, .8), boot = std(0x4b3322, .5, .05, .5),
        glove = std(0x181a1f, .6, .1), gold = std(0xcf9f45, .3, .9, 1.2), strap = std(0x3a2a1c, .7), pack = std(0x2a303c, .6, .2), eye = std(0xf4f1ea, .3), iris = std(0x2a1c12, .3), dark = std(0x1a0f0c, .8);
      const glowM = new T.MeshBasicMaterial({ color: 0x4cc8ff }), glowM2 = new T.MeshBasicMaterial({ color: 0x4cc8ff, transparent: true, opacity: .35, blending: T.AdditiveBlending, depthWrite: false });
      const root = new T.Group(), body = new T.Group(); root.add(body);
      const hips = new T.Group(); hips.position.y = .96; body.add(hips);
      hips.add(box(.34, .17, .2, pants, 0, 0, 0)); const belt = box(.37, .06, .23, strap, 0, .1, 0); hips.add(belt); hips.add(box(.07, .06, .02, gold, 0, .1, .122));
      [-.2, .2].forEach(x => { hips.add(box(.07, .1, .08, strap, x, .06, .06)); }); hips.add(box(.1, .09, .06, strap, -.05, .04, -.13));               // pouches
      const spine = new T.Group(); spine.position.y = .1; hips.add(spine);
      const torso = new T.Mesh(new T.CylinderGeometry(.215, .18, .54, 20, 1), jacket); torso.scale.z = .62; torso.position.y = .26; torso.castShadow = true; spine.add(torso);
      spine.add(box(.3, .5, .02, shirt, 0, .26, .13).clone());
      const zip = box(.015, .5, .01, gold, 0, .27, .142); spine.add(zip);
      [-1, 1].forEach(sx => { const s = box(.045, .5, .012, strap, sx * .1, .27, .146); s.rotation.z = sx * .08; spine.add(s); spine.add(ball(.065, gold, sx * .09, .43, .146, 1, .5, .25)); });   // chest straps
      const collar = new T.Mesh(new T.TorusGeometry(.14, .045, 8, 18), jacket); collar.rotation.x = PI / 2; collar.position.set(0, .53, -.01); collar.scale.set(1, 1.1, 1); spine.add(collar);
      const chest = new T.Group(); chest.position.y = .5; spine.add(chest);
      const neck = new T.Mesh(new T.CylinderGeometry(.055, .065, .12, 12), skin); neck.position.y = .09; chest.add(neck);
      const head = new T.Group(); head.position.y = .13; chest.add(head);
      head.add(ball(.112, skin, 0, .08, 0, .95, 1.14, 1.02));
      head.add(ball(.05, skin, 0, .03, .105, .7, .55, .7)); [-1, 1].forEach(sx => { head.add(ball(.03, skin, sx * .108, .07, 0, .5, 1, .8)); });      // chin, ears
      head.add(ball(.02, skin, 0, .075, .118, .8, 1.1, 1)); head.children[head.children.length - 1].rotation.x = .3;                                       // nose
      [-1, 1].forEach(sx => { head.add(ball(.021, eye, sx * .042, .105, .097, 1.2, .85, .6)); head.add(ball(.011, iris, sx * .042, .105, .108)); const br = box(.05, .009, .012, hairM, sx * .045, .134, .1); br.rotation.z = -sx * .12; head.add(br); });
      head.add(box(.045, .008, .01, dark, 0, .026, .112));
      const hair = new T.Mesh(new T.SphereGeometry(.122, 18, 12, 0, PI * 2, 0, PI * .56), hairM); hair.position.set(0, .1, -.008); hair.scale.set(1, 1.06, 1.08); hair.castShadow = true; head.add(hair);
      const fringe = box(.15, .035, .05, hairM, 0, .165, .075); fringe.rotation.x = -.35; head.add(fringe); [-1, 1].forEach(sx => head.add(box(.018, .06, .04, hairM, sx * .11, .08, .02)));
      // backpack with a glowing core (matches the concept art)
      const bp = new T.Group(); bp.position.set(0, .26, -.17); spine.add(bp); bp.add(box(.3, .38, .13, pack, 0, 0, 0)); bp.add(box(.26, .08, .15, strap, 0, .2, 0)); [-1, 1].forEach(sx => bp.add(box(.03, .34, .02, strap, sx * .1, 0, .07)));
      const core = new T.Mesh(new T.CylinderGeometry(.06, .06, .02, 18), glowM); core.rotation.x = PI / 2; core.position.set(0, .02, -.07); bp.add(core); const coreHalo = new T.Mesh(new T.RingGeometry(.065, .1, 24), glowM2); coreHalo.position.set(0, .02, -.082); coreHalo.rotation.y = PI; bp.add(coreHalo);
      // limbs
      const mkArm = sx => {
        const sh = new T.Group(); sh.position.set(sx * .27, -.09, 0); chest.add(sh); sh.add(ball(.068, jacket, 0, 0, 0, 1.15, .9, 1));
        sh.add(box(.1, .015, .12, strap, 0, .062, 0));
        const up = capsule(.052, .31, jacket); up.position.y = -.15; sh.add(up); const el = new T.Group(); el.position.y = -.31; sh.add(el); el.add(ball(.05, jacket, 0, 0, 0));
        const fo = capsule(.046, .29, jacket); fo.position.y = -.14; el.add(fo); const cuff = new T.Mesh(new T.CylinderGeometry(.05, .05, .045, 12), gold); cuff.position.y = -.26; el.add(cuff);
        const hand = ball(.05, glove, 0, -.33, .005, .9, 1.1, .9); el.add(hand); const th = ball(.02, glove, sx * -.04, -.31, .03); el.add(th); return { sh, el, hand };
      };
      const arms = [mkArm(-1), mkArm(1)];
      const mkLeg = sx => {
        const hp = new T.Group(); hp.position.set(sx * .105, -.03, 0); hips.add(hp);
        const th = capsule(.088, .46, pants); th.position.y = -.21; hp.add(th); const kn = new T.Group(); kn.position.y = -.43; hp.add(kn);
        const pad = ball(.065, strap, 0, .01, .06, 1, 1.1, .6); kn.add(pad);
        const sh = capsule(.07, .44, pants); sh.position.y = -.2; kn.add(sh); const bt = box(.12, .13, .13, boot, 0, -.37, 0); kn.add(bt);
        const foot = box(.115, .09, .27, boot, 0, -.44, .06); kn.add(foot); const sole = box(.12, .025, .29, dark, 0, -.49, .06); kn.add(sole); kn.add(box(.09, .02, .03, strap, 0, -.34, .08));
        return { hp, kn };
      };
      const legs = [mkLeg(-1), mkLeg(1)];
      root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });

      /* ---------- animation ---------- */
      const P = { hl: 0, hr: 0, kl: 0, kr: 0, sl: 0, sr: 0, szl: 0, szr: 0, el: 0, er: 0, sx: 0, sy: 0, hx: 0, hy: 0, bob: 0, lean: 0, hy2: 0 };   // current pose
      const A = { name: 'idle', t: 0, dur: 0, from: 0 }, st = { phase: 0, speed: 0, ground: true, vy: 0, yawLook: 0, time: 0 };
      const target = () => {
        const T0 = { hl: 0, hr: 0, kl: 0, kr: 0, sl: 0, sr: 0, szl: .06, szr: -.06, el: -.12, er: -.12, sx: 0, sy: 0, hx: 0, hy: 0, bob: 0, lean: 0, hy2: 0 }, t = st.time, k = A.dur ? Math.min(1, A.t / A.dur) : 0;
        const sp = st.speed;
        if (!st.ground) {                                                                     // jumping / falling
          const up = st.vy > 0; T0.hl = up ? -1.0 : -.5; T0.hr = up ? -.2 : -.3; T0.kl = up ? 1.3 : .5; T0.kr = up ? .5 : .4; T0.sl = -.5; T0.sr = -.5; T0.szl = .7; T0.szr = -.7; T0.er = T0.el = -.5; T0.lean = up ? .05 : .12; return T0;
        }
        if (sp > .02) {                                                                       // walk -> run blend
          const s = Math.sin(st.phase), c = Math.cos(st.phase), run = Math.max(0, Math.min(1, (sp - .55) / .45)), amp = .55 + run * .45;
          T0.hl = s * amp; T0.hr = -s * amp; T0.kl = Math.max(0, -c) * (.8 + run * .9); T0.kr = Math.max(0, c) * (.8 + run * .9);
          T0.sl = -s * (.5 + run * .5); T0.sr = s * (.5 + run * .5); T0.el = -.25 - run * .9; T0.er = -.25 - run * .9; T0.bob = Math.abs(c) * (.035 + run * .03); T0.lean = .05 + run * .14; T0.sy = s * .07; T0.hy2 = -s * .05;
        } else {                                                                              // idle breathing, small weight shift and looking about
          const b = Math.sin(t * 1.7); T0.sl = b * .02; T0.sr = -b * .02; T0.bob = b * .006; T0.sy = Math.sin(t * .5) * .04; T0.hy = Math.sin(t * .35) * .35 * (Math.sin(t * .17) > .2 ? 1 : 0); T0.hx = Math.sin(t * .27) * .04;
          T0.hl = Math.sin(t * .4) * .015; T0.hr = -T0.hl; T0.el = -.14 + b * .02; T0.er = -.14 - b * .02;
        }
        if (A.dur && A.t < A.dur) {                                                           // timed actions override the arms and spine
          const e = Math.sin(k * PI), hold = Math.min(1, Math.sin(Math.min(1, k * 1.15) * PI) * 1.6);
          if (A.name === 'reach') { T0.sr = -1.45 * hold; T0.szr = -.12; T0.er = -.15 * hold - .1; T0.sl = -.35 * hold; T0.el = -.6 * hold; T0.sx = .16 * hold; T0.hx = .12 * hold; }
          else if (A.name === 'press') { T0.sr = -1.5 * hold; T0.er = -.1; T0.sx = .12 * hold + .1 * Math.sin(k * PI * 3); T0.sl = -.3 * hold; T0.el = -.7 * hold; T0.hx = .1 * hold; }
          else if (A.name === 'turn') { const w = Math.sin(k * PI * 2.4) * .22; T0.sr = -1.25 * hold + w; T0.sl = -1.25 * hold - w; T0.er = -.55 * hold; T0.el = -.55 * hold; T0.szr = -.25 * hold; T0.szl = .25 * hold; T0.sx = .12 * hold; T0.sy = Math.sin(k * PI * 2.4) * .3 * hold; T0.hx = .1 * hold; }
          else if (A.name === 'pull') { const pu = Math.min(1, k * 2) * (k > .5 ? 1 - (k - .5) * 1.4 : 1); T0.sr = -1.2 * hold - .15 * (k > .4 ? e : 0); T0.sl = -.5 * hold; T0.er = -.35 * hold; T0.el = -.8 * hold; T0.sx = .1 + .22 * (1 - pu) * hold; T0.lean = .25 * (k > .4 ? e : 0); T0.hl = -.15 * hold; T0.hr = .25 * hold; }
          else if (A.name === 'inspect') { T0.sr = -1.55 * hold; T0.er = -1.7 * hold; T0.szr = -.1 * hold; T0.sx = .12 * hold; T0.hx = .3 * hold * (.6 + .4 * Math.sin(k * PI * 4)); T0.hy = .22 * hold * Math.sin(k * PI * 2); }
          else if (A.name === 'celebrate') { const up = Math.max(0, Math.sin(k * PI * 3)); T0.sl = T0.sr = -2.7 * Math.min(1, k * 6) + .2 * Math.sin(k * 30); T0.szl = 1.0 * Math.min(1, k * 6); T0.szr = -1.0 * Math.min(1, k * 6); T0.el = T0.er = -.25; T0.hl = T0.hr = -.1 * up; T0.kl = T0.kr = .5 * up; T0.bob = .18 * up; T0.hx = -.2; T0.sy = Math.sin(k * PI * 4) * .25; }
          else if (A.name === 'marvel') { T0.hx = -.28 * hold; T0.sx = -.05 * hold; T0.sr = -.35 * hold; T0.szr = -.45 * hold; T0.sl = -.2 * hold; T0.szl = .3 * hold; T0.hy = Math.sin(k * PI * 2) * .5 * hold; }
        }
        return T0;
      };
      const joints = () => {
        legs[0].hp.rotation.x = P.hl; legs[1].hp.rotation.x = P.hr; legs[0].kn.rotation.x = P.kl; legs[1].kn.rotation.x = P.kr;
        arms[0].sh.rotation.set(P.sl, 0, P.szl); arms[1].sh.rotation.set(P.sr, 0, P.szr); arms[0].el.rotation.x = P.el; arms[1].el.rotation.x = P.er;
        spine.rotation.set(P.sx + P.lean, P.sy, 0); head.rotation.set(P.hx - P.lean * .5, P.hy + P.hy2, 0); hips.position.y = .96 + P.bob; hips.rotation.y = -P.sy * .5;
      };
      const api = {
        root, hips, head, arms, legs, coreGlow: glowM,
        play(name, dur) { A.name = name; A.dur = dur || 1; A.t = 0; },
        get busy() { return A.dur > 0 && A.t < A.dur; }, get action() { return A.name; }, get actionK() { return A.dur ? Math.min(1, A.t / A.dur) : 1; },
        setMotion(speed, ground, vy) { st.speed = speed; st.ground = ground; st.vy = vy || 0; },
        update(dt) {
          st.time += dt; if (A.dur && A.t < A.dur) A.t += dt;
          if (st.speed > .02 && st.ground) st.phase += dt * (6 + st.speed * 6.5);
          const k = 1 - Math.exp(-dt * 16), tg = target(); for (const key in P) P[key] += (tg[key] - P[key]) * k;
          joints(); glowM.color.setHSL(.55, 1, .56 + .08 * Math.sin(st.time * 3)); glowM2.opacity = .3 + .12 * Math.sin(st.time * 3);
        },
        handPos(side, out) { const h = arms[side === 'L' ? 0 : 1].hand; h.updateWorldMatrix(true, false); return (out || new T.Vector3()).setFromMatrixPosition(h.matrixWorld); },
        headPos(out) { head.updateWorldMatrix(true, false); return (out || new T.Vector3()).setFromMatrixPosition(head.matrixWorld); }
      };
      joints(); return api;
    }
  };
})();
