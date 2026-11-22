/* MindVerse - the "Rovatics Game Zone" 3D splash / loading scene.
 * A spinning gold medallion carrying the Rovatics logo on a glowing temple dais, with orbit rings, crystals, torches,
 * carved glyphs and the words ROVATICS GAME ZONE. It uses the same materials, lighting and bloom as the game so the
 * company brand and the game look like one world. Also used to render the still images in assets/. */
(function () {
  'use strict';
  const T = THREE, MV = (window.MV = window.MV || {}), G = MV.gfx, PI = Math.PI;

  function titleTexture(w, h) {
    const c = G.cv(w, h), x = c.getContext('2d'); x.textAlign = 'center'; x.textBaseline = 'middle';
    const big = Math.floor(h * .5), small = Math.floor(h * .24);
    x.font = '900 ' + big + 'px Georgia,"Times New Roman",serif'; const word = 'ROVATICS';
    // extruded look: stacked dark copies, then the gold face with a highlight band
    for (let i = 14; i >= 1; i--) { x.fillStyle = 'rgba(' + (60 - i * 2) + ',' + (36 - i) + ',8,1)'; x.fillText(word, w / 2 + i * .9, h * .33 + i * 1.3); }
    const g = x.createLinearGradient(0, h * .08, 0, h * .58); g.addColorStop(0, '#fff3c4'); g.addColorStop(.35, '#f6cb62'); g.addColorStop(.62, '#b9812a'); g.addColorStop(1, '#f2c25a');
    x.lineWidth = 7; x.strokeStyle = '#3a2408'; x.strokeText(word, w / 2, h * .33); x.fillStyle = g; x.fillText(word, w / 2, h * .33);
    x.save(); x.globalCompositeOperation = 'source-atop'; const sh = x.createLinearGradient(0, 0, w, 0); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(.46, 'rgba(255,255,255,0)'); sh.addColorStop(.5, 'rgba(255,255,255,.55)'); sh.addColorStop(.54, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = sh; x.fillText(word, w / 2, h * .33); x.restore();
    // GAME ZONE in glowing cyan, spaced out
    const label = 'G A M E   Z O N E'; x.font = '800 ' + small + 'px "Segoe UI",system-ui,Arial,sans-serif';
    x.shadowColor = '#37d8ff'; x.shadowBlur = 38; x.fillStyle = '#d6f8ff'; x.fillText(label, w / 2, h * .72); x.shadowBlur = 16; x.fillText(label, w / 2, h * .72); x.shadowBlur = 0;
    // ornament line with a diamond
    const y = h * .88; x.strokeStyle = 'rgba(242,194,90,.9)'; x.lineWidth = 4; x.beginPath(); x.moveTo(w * .16, y); x.lineTo(w * .44, y); x.moveTo(w * .56, y); x.lineTo(w * .84, y); x.stroke();
    x.fillStyle = '#f2c25a'; x.beginPath(); x.moveTo(w / 2, y - 14); x.lineTo(w / 2 + 14, y); x.lineTo(w / 2, y + 14); x.lineTo(w / 2 - 14, y); x.closePath(); x.fill();
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; return t;
  }
  function logoTexture(img) {
    const c = G.cv(512, 512), x = c.getContext('2d');
    try { if (!img || !img.complete || !img.naturalWidth) throw new Error('no logo'); x.drawImage(img, 0, 0, 512, 512); x.getImageData(0, 0, 1, 1); }
    catch (e) {                                                              // fallback emblem: a dark disc with a gold R
      x.clearRect(0, 0, 512, 512); const g = x.createRadialGradient(256, 200, 20, 256, 256, 256); g.addColorStop(0, '#1d5d8f'); g.addColorStop(1, '#06162a'); x.fillStyle = g; x.beginPath(); x.arc(256, 256, 250, 0, 7); x.fill();
      x.strokeStyle = '#37d8ff'; x.lineWidth = 10; x.beginPath(); x.arc(256, 256, 226, 0, 7); x.stroke(); x.font = '900 330px Georgia,serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#f2c25a'; x.fillText('R', 256, 270);
    }
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; return t;
  }

  MV.splash = {
    create(canvas, opts) {
      opts = opts || {};
      const renderer = G.makeRenderer(canvas, { aa: false, shadow: 0, preserve: !!opts.preserve }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.dpr || 1.5)); renderer.toneMapping = T.NoToneMapping;
      G.initMaterials(); const M = G.mat, scene = new T.Scene(), camera = new T.PerspectiveCamera(36, 1, .5, 200), anims = []; let post = null, raf = 0, running = false, t0 = performance.now(), sw = 2, sh = 2;
      try { if (/[?&]nopost/.test(location.search)) throw new Error('nopost'); post = G.Post(renderer, { msaa: !!opts.msaa }); } catch (e) { post = null; renderer.toneMapping = T.ACESFilmicToneMapping; }
      scene.environment = G.envMap(renderer); scene.background = new T.Color(0x07161a); scene.fog = new T.FogExp2(0x051a1e, .038);
      scene.add(G.sky('#04101c', '#0f3a44', '#7a5a2a'));
      scene.add(new T.HemisphereLight(0x6fb0e8, 0x2a1c0c, .26)); const sun = new T.DirectionalLight(0xffd8a0, .6); sun.position.set(-8, 14, 10); scene.add(sun); const cyan = new T.PointLight(0x37d8ff, 2.2, 22, 2); cyan.position.set(0, 4.4, 3.5); scene.add(cyan);
      // floor and back wall
      const floor = new T.Mesh(new T.PlaneGeometry(80, 60), G.floorMat(80, 60)); floor.rotation.x = -PI / 2; scene.add(floor);
      const wall = G.bevel(46, 22, 2, M.stoneDark, 0, 11, -9, .2); scene.add(wall);
      for (let i = -3; i <= 3; i++) { const col = new T.Group(); col.add(G.cyl(.9, 1, 15, M.stone, 0, 7.5, 0, 16)); col.add(G.bevel(2.4, .5, 2.4, M.stoneWarm, 0, .25, 0, .06)); col.add(G.bevel(2.4, .5, 2.4, M.stoneWarm, 0, 15.2, 0, .06)); const b = new T.Mesh(new T.TorusGeometry(.95, .07, 8, 20), M.gold); b.rotation.x = PI / 2; b.position.y = 3; col.add(b); col.position.set(i * 6.6, 0, -7.6); scene.add(col); }
      ['spiral', 'triangle', 'sun'].forEach((s, i) => { const gc = G.GLYPH_COL ? G.GLYPH_COL[s] : ['#ffcf6a', '#ff9c20']; const m = new T.Mesh(new T.PlaneGeometry(3.2, 3.2), new T.MeshBasicMaterial({ map: G.glyphTexture(s, '#2a251c', gc[0], gc[1]), toneMapped: false })); m.position.set((i - 1) * 6.6, 9.4, -6.4); scene.add(m); });
      for (let i = -4; i <= 4; i += 2) scene.add(G.vine(i * 4.6 + 1.2, 17, -6.2, 5 + (i + 4) % 3 * 2, i + 9));
      // the dais
      const daisMat = new T.MeshStandardMaterial({ color: 0x24211a, roughness: .55, metalness: .25 }), dais = new T.Group(); dais.add(G.cyl(4.8, 5.1, .6, daisMat, 0, .3, 0, 64)); dais.add(G.cyl(4.1, 4.4, .25, new T.MeshStandardMaterial({ color: 0x38322a, roughness: .5, metalness: .3 }), 0, .72, 0, 64));
      const goldRing = new T.Mesh(new T.TorusGeometry(3.6, .07, 10, 96), M.gold); goldRing.rotation.x = PI / 2; goldRing.position.y = .86; dais.add(goldRing);
      const glowRing = new T.Mesh(new T.RingGeometry(2.55, 2.95, 96), new T.MeshBasicMaterial({ color: 0x37d8ff, transparent: true, opacity: .75, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); glowRing.rotation.x = -PI / 2; glowRing.position.y = .88; dais.add(glowRing);
      const runes = new T.Group(); ['spiral', 'triangle', 'sun', 'wave', 'moon', 'eye', 'star', 'spiral'].forEach((s, i) => { const a = i * PI / 4, gc = G.GLYPH_COL && G.GLYPH_COL[s] || ['#ffcf6a', '#ff9c20']; const m = new T.Mesh(new T.PlaneGeometry(.95, .95), new T.MeshBasicMaterial({ map: G.glyphTexture(s, '#3a3020', gc[0], gc[1]), toneMapped: false })); m.rotation.x = -PI / 2; m.rotation.z = -a; m.position.set(Math.cos(a) * 3.3, .9, Math.sin(a) * 3.3); runes.add(m); }); dais.add(runes);
      scene.add(dais);
      // torches
      [-6.2, 6.2].forEach(x => { const tr = G.torch(true); tr.obj.position.set(x, 0, 2); tr.obj.scale.setScalar(1.5); scene.add(tr.obj); anims.push(tr.update); });
      // medallion
      const med = new T.Group(); med.position.set(0, 4.5, 0); scene.add(med);
      const logo = logoTexture(opts.logoImg), faceMat = new T.MeshStandardMaterial({ map: logo, metalness: .25, roughness: .35, emissive: 0xffffff, emissiveMap: logo, emissiveIntensity: .18, envMapIntensity: .8 });
      const body = new T.Mesh(new T.CylinderGeometry(2.0, 2.0, .36, 96), M.gold); body.rotation.x = PI / 2; med.add(body);
      const rim = new T.Mesh(new T.TorusGeometry(2.02, .26, 24, 96), M.gold); med.add(rim); const rim2 = new T.Mesh(new T.TorusGeometry(1.74, .05, 12, 96), M.gold); rim2.position.z = .2; med.add(rim2); const rim3 = rim2.clone(); rim3.position.z = -.2; med.add(rim3);
      const faceF = new T.Mesh(new T.CircleGeometry(1.72, 96), faceMat); faceF.position.z = .19; med.add(faceF); const faceB = new T.Mesh(new T.CircleGeometry(1.72, 96), faceMat); faceB.rotation.y = PI; faceB.position.z = -.19; med.add(faceB);
      for (let i = 0; i < 12; i++) { const a = i * PI / 6, gem = new T.Mesh(new T.OctahedronGeometry(.1, 0), M.crystal); gem.position.set(Math.cos(a) * 2.02, Math.sin(a) * 2.02, 0); gem.scale.y = 1.6; gem.rotation.z = a; med.add(gem); }
      const halo = G.glow(0x37d8ff, 11, .5); med.add(halo); const halo2 = G.glow(0xffc766, 16, .22); halo2.position.z = -1; med.add(halo2);
      // orbit rings and crystals
      const rings = [0, 1, 2].map(i => { const r = new T.Mesh(new T.TorusGeometry(2.9 + i * .45, .035, 8, 120), new T.MeshStandardMaterial({ color: 0xf2c25a, emissive: 0xffa927, emissiveIntensity: .8, metalness: .8, roughness: .3 })); r.rotation.set(i * 1.05, i * .5, i * .7); med.add(r); const orb = new T.Mesh(new T.SphereGeometry(.12, 12, 10), new T.MeshBasicMaterial({ color: 0xbff4ff })); r.add(orb); orb.position.set(2.9 + i * .45, 0, 0); return { r, orb, i }; });
      const crystals = [0, 1, 2].map(i => { const c = new T.Mesh(new T.OctahedronGeometry(.42, 0), M.crystal); c.scale.set(.8, 1.5, .8); const gl = G.glow(0x37d8ff, 2.4, .7); c.add(gl); scene.add(c); return c; });
      // title slab
      const TW = 1800, TH = 560, tex = titleTexture(TW, TH), title = new T.Mesh(new T.PlaneGeometry(9.4, 9.4 * TH / TW), new T.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false })); title.position.set(0, 1.25, 5.9); title.rotation.x = -.06; scene.add(title);
      const tg = G.glow(0xffc766, 15, .12); tg.position.set(0, 2.4, 5.2); scene.add(tg);
      // atmosphere
      const rays = G.godRays([{ x: -7, y: 10, z: -2, w: 5, len: 24, rz: .5 }, { x: 0, y: 11, z: -3, w: 6, len: 26, rz: .0 }, { x: 7, y: 10, z: -2, w: 5, len: 24, rz: -.5 }], 0xffe6b0); scene.add(rays.obj); anims.push(rays.update);
      const dust = G.dust(150, { w: 30, h: 12, d: 18 }, 0xffe6b0); dust.obj.position.y = 0; scene.add(dust.obj); anims.push(dust.update); const ff = G.fireflies(30, { w: 30, h: 5, d: 16 }); scene.add(ff.obj); anims.push(ff.update);
      const spark = G.spark(scene, 160); let sparkT = 0;

      scene.traverse(o => { const m = o.material; if (m && m.isMeshStandardMaterial && m.metalness < .5 && m.envMapIntensity === 1) m.envMapIntensity = .3; });
      function setSize(w, h) {
        sw = w; sh = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); if (post) post.setSize(w, h);
        const hfov = 2 * Math.atan(Math.tan(36 * PI / 360) * (w / h)), need = 6.6 / Math.tan(hfov / 2);           // keep the whole title in view on tall phone screens
        camera.userData.dist = Math.max(18.5, need + 2.5); scene.fog.density = .038 * 18.5 / camera.userData.dist; camera.userData.up = w / h < .8 ? 1.2 : 0;
      }
      function frame(t) {
        const d = camera.userData.dist || 18.5;
        camera.position.set(Math.sin(t * .22) * 1.1, 4.0 + (camera.userData.up || 0), d); camera.lookAt(0, 3.3 + (camera.userData.up ? .8 : 0), 0);
        med.rotation.y = stillT != null ? .32 : Math.sin(t * .6) * .75 + t * .28; med.position.y = 4.5 + Math.sin(t * 1.3) * .12; halo.material.opacity = .42 + .12 * Math.sin(t * 2.4); glowRing.rotation.z = t * .4; glowRing.material.opacity = .55 + .2 * Math.sin(t * 3); runes.rotation.y = t * .08;
        rings.forEach(o => { o.r.rotation.x += .004 * (1 + o.i * .4); o.r.rotation.y += .006 * (1 + o.i * .3); });
        crystals.forEach((c, i) => { const a = t * .7 + i * PI * 2 / 3; c.position.set(Math.cos(a) * 4.6, 4.5 + Math.sin(t * 1.1 + i) * .7, Math.sin(a) * 2.4 + .4); c.rotation.y = t * 1.2; });
        sparkT += 1; if (sparkT % 6 === 0) { const a = Math.random() * PI * 2; spark.burst(Math.cos(a) * 2.2, 4.5 + Math.sin(a) * 2.2, .3, 3, Math.random() < .5 ? 0xffd36a : 0x9fe8ff, 1.4); }
        title.position.y = 1.25 + Math.sin(t * 1.2) * .03; cyan.intensity = 2 + .5 * Math.sin(t * 2.2);
      }
      let last = performance.now(), tt = 0, stillT = null;
      function tick(now) { if (!running) return; const dt = Math.min(.05, (now - last) / 1000); last = now; tt += dt; anims.forEach(f => f(tt, dt)); spark.update(tt, dt); frame(tt); render(); raf = requestAnimationFrame(tick); }
      function render() { if (post) post.render(scene, camera, tt); else renderer.render(scene, camera); }
      return {
        resize(w, h) { setSize(w, h); if (!running && stillT != null) { frame(stillT); render(); } }, start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(tick); }, stop() { running = false; cancelAnimationFrame(raf); },
        still(t) { tt = t || 2.4; stillT = tt; for (let k = 0; k < 40; k++) { anims.forEach(f => f(tt - 2 + k * .05, .05)); spark.update(tt, .05); if (k % 3 === 0) { const a = Math.random() * PI * 2; spark.burst(Math.cos(a) * 2.4, 4.5 + Math.sin(a) * 2.4, .3, 4, Math.random() < .5 ? 0xffd36a : 0x9fe8ff, 1.6); } } frame(tt); render(); },
        dispose() { running = false; cancelAnimationFrame(raf); if (post) post.dispose(); renderer.dispose(); }
      };
    }
  };
})();
