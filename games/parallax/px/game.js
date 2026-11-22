/* PARALLAX: The Laws of the Lost Universe. The game module for Rovatics Game Zone.
   Owns: story intro, main menu, world map, the level runtime (3D view + camera + touch input), hints, undo/restart/checkpoints,
   rewards, journal, wardrobe, achievements and settings. Rules live in logic.js; this file wires them to the screen. */
import * as THREE from 'three';
import { LEVELS, WORLDS, HINTS, FAMILY_NAME, loreFor } from './levels.js';
import { Session } from './session.js';
import * as P from './progress.js';
import { createView } from './views.js';
import { makeMats, clearLabelCache } from './gfx.js';
import { World, QUALITY } from './world.js';
import { solved, replay } from './logic.js';

const SAVE_KEY = 'parallax.save';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stars = n => '★'.repeat(n) + '☆'.repeat(3 - n);

class Burst {
  constructor(scene) { const n = 260; this.n = n; this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); this.pts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffd27a', size: 0.22, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending })); this.pts.frustumCulled = false; scene.add(this.pts); this.i = 0; for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -99; }
  emit(p, count, color, speed = 6) { this.pts.material.color.set(color); for (let k = 0; k < count; k++) { const i = this.i = (this.i + 1) % this.n, a = Math.random() * 6.283, e = Math.random() * 2 - 1, s = speed * (0.3 + Math.random()); this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([Math.cos(a) * Math.sqrt(1 - e * e) * s, Math.abs(e) * s + 2, Math.sin(a) * Math.sqrt(1 - e * e) * s], i * 3); this.life[i] = 1.2 + Math.random() * 0.8; } }
  update(dt) { for (let i = 0; i < this.n; i++) { if (this.life[i] <= 0) continue; this.life[i] -= dt; this.vel[i * 3 + 1] -= 7 * dt; for (let k = 0; k < 3; k++) this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt; if (this.life[i] <= 0) this.pos[i * 3 + 1] = -99; } this.pts.geometry.attributes.position.needsUpdate = true; }
  dispose(scene) { scene.remove(this.pts); this.pts.geometry.dispose(); this.pts.material.dispose(); }
}

class PX {
  constructor(host) {
    this.host = host; this.R = host.renderer; this.root = host.root; this.audio = host.audio; this.Store = host.Store;
    this.save = P.migrate(this.Store.load(SAVE_KEY, null)); this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    this.cam = { yaw: 0.35, pitch: 0.95, dist: 14, tyaw: 0.35, tpitch: 0.95, tdist: 14, target: new THREE.Vector3(0, 0.7, 0), orbit: true }; this.mode = 'boot'; this.t = 0; this.alive = true;
    this.ray = new THREE.Raycaster(); this.ptrs = new Map(); this.down = null; this.fps = { acc: 0, n: 0, since: 0 };
  }

  /* ───────── lifecycle ───────── */
  mount() {
    this.root.innerHTML = '<div class="px"><div class="px-ui"></div><div class="px-fade"></div><div class="px-cap"></div></div>'; this.ui = this.root.querySelector('.px-ui'); this.fade = this.root.querySelector('.px-fade'); this.capEl = this.root.querySelector('.px-cap');
    const s = this.host.settings; this.applySettings(); this.audio.onCaption = t => { if (this.host.settings.captions) this.caption(t); };
    this.onDown = e => this.pDown(e); this.onMove = e => this.pMove(e); this.onUp = e => this.pUp(e); this.onWheel = e => { e.preventDefault(); this.cam.tdist = THREE.MathUtils.clamp(this.cam.tdist * (1 + e.deltaY * 0.001), this.cam.min || 5, this.cam.max || 40); };
    this.onKey = e => this.key(e); const c = this.host.canvas; c.addEventListener('pointerdown', this.onDown); window.addEventListener('pointermove', this.onMove); window.addEventListener('pointerup', this.onUp); window.addEventListener('pointercancel', this.onUp); c.addEventListener('wheel', this.onWheel, { passive: false }); window.addEventListener('keydown', this.onKey);
    this.host.setLoop(dt => this.update(dt)); this.host.onResize(() => this.resize()); this.resize();
    window.__px = this; this.audio.setVolumes(s.music, s.sfx);
    if (!this.save.seenIntro) this.cinematic(() => { this.save.seenIntro = true; this.persistSave(); this.menu(); }); else this.menu();
  }
  unmount() {
    this.alive = false; const c = this.host.canvas; c.removeEventListener('pointerdown', this.onDown); window.removeEventListener('pointermove', this.onMove); window.removeEventListener('pointerup', this.onUp); window.removeEventListener('pointercancel', this.onUp); c.removeEventListener('wheel', this.onWheel); window.removeEventListener('keydown', this.onKey);
    this.audio.stopBed(); this.audio.onCaption = null; this.clearScene(); this.root.innerHTML = ''; this.host.setLoop(null); delete window.__px;
  }
  persistSave() { this.Store.save(SAVE_KEY, this.save); }
  applySettings() { const s = this.host.settings; this.Q = QUALITY[this.host.quality()]; this.R.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.Q.pr)); document.documentElement.style.setProperty('--ts', s.textScale); document.body.classList.toggle('hc', !!s.contrast); this.audio.setVolumes(s.music, s.sfx); this.resize(); }
  resize() { const w = this.host.canvas.clientWidth || innerWidth, h = this.host.canvas.clientHeight || innerHeight; this.R.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.portrait = h > w; }
  caption(t) { const el = document.createElement('div'); el.textContent = t; this.capEl.appendChild(el); setTimeout(() => el.remove(), 1800); while (this.capEl.children.length > 3) this.capEl.firstChild.remove(); }
  toast(t, ms = 2200) { const el = document.createElement('div'); el.className = 'px-toast'; el.textContent = t; (this.ui.querySelector('.px-hud') || this.ui).appendChild(el); setTimeout(() => el.remove(), ms); }
  fadeTo(fn, ms = 380) { this.fade.style.transition = `opacity ${ms}ms`; this.fade.style.opacity = 1; setTimeout(() => { try { fn(); } finally { requestAnimationFrame(() => { this.fade.style.opacity = 0; }); } }, ms); }

  /* ───────── 3D scene management ───────── */
  clearScene() {
    if (this.view) { this.scene.remove(this.view.group); this.view.destroy(); this.view = null; } if (this.world) { this.world.dispose(); this.world = null; } if (this.burst) { this.burst.dispose(this.scene); this.burst = null; }
    this.M = null; this.worldId = 0;
  }
  setWorld(wid, seed) {
    if (this.world && this.worldId === wid && this.worldSeed === seed) return; if (this.view) { this.scene.remove(this.view.group); this.view.destroy(); this.view = null; } if (this.world) { this.world.dispose(); this.world = null; } if (this.burst) this.burst.dispose(this.scene);
    clearLabelCache(); const W = WORLDS[wid - 1]; this.world = new World(this.R, this.scene, W, seed, this.Q, this.host.settings.reduceMotion); this.M = makeMats(W); this.worldId = wid; this.worldSeed = seed; this.burst = new Burst(this.scene);
    const sh = P.COSMETICS.find(c => c.id === this.save.equipped.shell), tr = P.COSMETICS.find(c => c.id === this.save.equipped.trail); this.world.setCosmetics(sh, tr); this.audio.setBed(wid);
  }
  /* camera distance that shows the whole board whatever the screen shape (portrait phones need to stand further back) */
  fitDist(r) { const hf = 0.4142 * Math.max(0.3, this.camera.aspect); return Math.max(r * 1.75, (r * 0.95) / hf); }
  showView(level) {
    if (this.view) { this.scene.remove(this.view.group); this.view.destroy(); }
    this.view = createView(this.session ? this.session.state : level.state, this.M, { audio: this.audio }); this.scene.add(this.view.group);
    const r = this.view.radius; const fd = this.fitDist(r); this.cam.min = r * 0.7; this.cam.max = fd * 1.7; this.cam.tdist = fd; this.cam.dist = fd * 1.5; this.cam.tpitch = this.portrait ? 0.92 : 0.85; this.cam.pitch = 1.25; this.cam.tyaw = 0.0; this.cam.yaw = 0.7; this.cam.target.set(0, 0.7, this.portrait ? r * 0.16 : 0);   // portrait: nudge the board up, clear of the button bar
  }

  /* ───────── screens ───────── */
  setScreen(html) { this.ui.innerHTML = html; this.ui.onclick = e => { const b = e.target.closest('[data-a]'); if (b) { this.audio.unlock(); this.audio.click(); this.act(b.dataset.a, b); } }; }
  menu() {
    this.mode = 'menu'; const n = P.nextLevel(this.save), L = LEVELS[n - 1], done = P.levelsDone(this.save);
    this.session = null; this.setWorld(L.world.id, n); this.showMenuView(L); this.cam.orbit = true;
    this.setScreen(`<div class="px-menu"><div class="px-brand">ROVATICS GAME ZONE</div><h1 class="px-logo">PARALLAX</h1><div class="px-tag">The Laws of the Lost Universe</div>
      <div class="px-prog">${done} / 100 levels · ${P.totalStars(this.save)} ★ · ${this.save.coins} coins</div>
      <button class="px-btn primary" data-a="continue">${done ? 'Continue' : 'Begin'} · Level ${n}<small>${esc(L.title)} · ${esc(L.world.short)}</small></button>
      <div class="px-row"><button class="px-btn" data-a="map">Levels</button><button class="px-btn" data-a="journal">Journal</button><button class="px-btn" data-a="shop">Wardrobe</button></div>
      <div class="px-row"><button class="px-btn" data-a="ach">Achievements</button><button class="px-btn" data-a="settings">Settings</button><button class="px-btn" data-a="intro">Story</button></div>
      <button class="px-btn ghost" data-a="zone">◀ Rovatics Game Zone</button></div>`);
  }
  showMenuView(L) { if (this.view) { this.scene.remove(this.view.group); this.view.destroy(); } this.view = createView(L.state, this.M, { audio: { ...this.audio, note() {}, tap() {}, thunk() {}, power() {}, error() {}, whoosh() {}, drop() {}, click() {} } }); this.scene.add(this.view.group); this.cam.tdist = this.fitDist(this.view.radius) * 1.45; this.cam.tpitch = 0.7; this.cam.target.set(0, 0.7, 0); }
  map(wid) {
    this.mode = 'map'; wid = wid || this.mapWorld || LEVELS[P.nextLevel(this.save) - 1].world.id; this.mapWorld = wid; const W = WORLDS[wid - 1];
    this.setWorld(wid, wid * 7); const f = LEVELS.find(l => l.world.id === wid); this.showMenuView(f); this.cam.orbit = true; this.audio.setBed(wid);
    const tabs = WORLDS.map(w => { const d = LEVELS.filter(l => l.world.id === w.id && P.isDone(this.save, l.n)).length, open = P.isUnlocked(this.save, (w.id - 1) * 20 + 1); return `<button class="px-tab ${w.id === wid ? 'on' : ''} ${open ? '' : 'lock'}" data-a="world" data-w="${w.id}"><b>${w.id}</b><span>${esc(w.short)}</span><i>${d}/20</i></button>`; }).join('');
    const tiles = LEVELS.filter(l => l.world.id === wid).map(l => { const st = this.save.levels[l.n], open = P.isUnlocked(this.save, l.n), cur = l.n === P.nextLevel(this.save); return `<button class="px-tile ${st && st.done ? 'done' : ''} ${open ? '' : 'lock'} ${cur ? 'cur' : ''}" data-a="pick" data-n="${l.n}"><b>${l.n}</b><i>${st && st.done ? stars(st.stars) : open ? '' : '🔒'}</i></button>`; }).join('');
    this.setScreen(`<div class="px-map"><div class="px-topbar"><button class="px-btn small" data-a="menu">◀</button><div class="px-wt"><b style="color:${W.accent}">${esc(W.name)}</b><span>${esc(W.tag)}</span></div><div class="px-coins">🪙 ${this.save.coins}</div></div>
      <div class="px-tabs">${tabs}</div><p class="px-story">${esc(W.story)}</p><div class="px-grid">${tiles}</div><div class="px-info"></div></div>`);
    this.pickTile(this.selected && LEVELS[this.selected - 1].world.id === wid ? this.selected : Math.max((wid - 1) * 20 + 1, Math.min(P.nextLevel(this.save), wid * 20)));
  }
  pickTile(n) {
    this.selected = n; const L = LEVELS[n - 1], st = this.save.levels[n], open = P.isUnlocked(this.save, n), el = this.ui.querySelector('.px-info'); if (!el) return;
    this.ui.querySelectorAll('.px-tile').forEach(t => t.classList.toggle('sel', +t.dataset.n === n));
    el.innerHTML = `<div class="px-card"><div><b>Level ${n} · ${esc(L.title)}</b><span class="px-chip">${esc(L.tier)}</span></div><p>${esc(L.brief)}.</p><p class="dim">${esc(FAMILY_NAME[L.family])} · ${esc(L.mechanics)} · about ${L.minutes[0]}–${L.minutes[1]} min</p>
      <p class="dim">Rewards: ${L.rewards.coins + L.rewards.tier} coins · mastery +${L.rewards.mastery} · discovery +${L.rewards.discovery}${st && st.done ? ` · best ${stars(st.stars)} in ${st.moves} moves` : ''}</p>
      <button class="px-btn primary" data-a="play" data-n="${n}" ${open ? '' : 'disabled'}>${open ? (this.save.checkpoints[n] ? 'Resume' : st && st.done ? 'Replay' : 'Play') : 'Locked: solve level ' + (n - 1)}</button></div>`;
  }
  act(a, b) {
    switch (a) {
      case 'continue': this.startLevel(P.nextLevel(this.save)); break; case 'map': this.map(); break; case 'menu': this.menu(); break;
      case 'world': this.map(+b.dataset.w); break; case 'pick': this.pickTile(+b.dataset.n); break; case 'play': this.startLevel(+b.dataset.n); break;
      case 'journal': this.journal(); break; case 'shop': this.shop(); break; case 'ach': this.achievements(); break; case 'settings': this.settings(); break;
      case 'intro': this.cinematic(() => this.menu()); break; case 'zone': this.host.exitToZone(); break; case 'close': this.closePanel(); break;
      case 'undo': this.undo(); break; case 'restart': this.restart(); break; case 'hint': this.hint(); break; case 'ckpt': this.checkpoint(); break; case 'load': this.loadCheckpoint(); break; case 'recenter': this.recenter(); break;
      case 'next': this.startLevel(Math.min(100, this.level.n + 1)); break; case 'replay': this.startLevel(this.level.n, true); break; case 'tomap': this.map(this.level ? this.level.world.id : 1); break;
      case 'buy': { const r = P.buy(this.save, b.dataset.id); if (r.ok) { this.audio.coin(); this.persistSave(); } else this.toast(r.why); this.shop(); break; }
      case 'equip': P.equip(this.save, b.dataset.id); this.persistSave(); { const sh = P.COSMETICS.find(c => c.id === this.save.equipped.shell), tr = P.COSMETICS.find(c => c.id === this.save.equipped.trail); if (this.world) this.world.setCosmetics(sh, tr); } this.shop(); break;
      case 'play-act': break;
      default: if (a.startsWith('mv:')) this.doMove(JSON.parse(b.dataset.mv));
    }
  }
  closePanel() { const p = this.ui.querySelector('.px-panel'); if (p) p.remove(); }
  panel(title, body) { this.closePanel(); const d = document.createElement('div'); d.className = 'px-panel'; d.innerHTML = `<div class="px-sheet"><div class="px-sh"><b>${title}</b><button class="px-btn small" data-a="close">✕</button></div><div class="px-body">${body}</div></div>`; this.ui.appendChild(d); return d; }
  journal() {
    const sk = P.COSMETICS.find(c => c.id === this.save.equipped.skin) || P.COSMETICS[9], found = [...this.save.lore].sort((a, b) => a - b);
    this.panel('Journal', `<div class="px-journal" style="background:${sk.bg};color:${sk.fg}"><p><b>The Wayfinder's notes.</b> Five engines once held the laws of reality. They were deliberately divided so that no single unstable mind could ever control all of it. LUMA records what you find.</p><p class="dim">Lore fragments found: ${found.length} / 100. Look for a drifting golden shard in each level and tap it.</p>${found.map(n => `<p class="lore">${esc(loreFor(n))}</p>`).join('') || '<p class="dim">Nothing yet. Every level hides one fragment.</p>'}<hr><p class="dim">Levels solved: ${P.levelsDone(this.save)} · stars ${P.totalStars(this.save)} · moves ${this.save.stats.moves} · hints used ${this.save.stats.hints} · play time ${Math.round(this.save.stats.seconds / 60)} min</p></div>`);
  }
  shop() {
    const row = c => { const own = this.save.owned.includes(c.id), eq = this.save.equipped[c.kind] === c.id; return `<div class="px-item"><div class="sw" style="background:linear-gradient(135deg,${c.c1 || c.color || c.bg || '#444'},${c.c2 || c.fg || '#ddd'})"></div><div><b>${esc(c.name)}</b><span class="dim">${c.kind}</span></div>${eq ? '<span class="px-chip">equipped</span>' : own ? `<button class="px-btn small" data-a="equip" data-id="${c.id}">Equip</button>` : `<button class="px-btn small" data-a="buy" data-id="${c.id}" ${this.save.coins < c.price ? 'disabled' : ''}>🪙 ${c.price}</button>`}</div>`; };
    this.panel('Wardrobe · 🪙 ' + this.save.coins, `<p class="dim">Cosmetics for LUMA and your journal. Earned with coins only. They never change gameplay.</p>${['shell', 'trail', 'skin'].map(k => `<h4>${{ shell: 'Drone shells', trail: 'Trails', skin: 'Journal skins' }[k]}</h4>${P.COSMETICS.filter(c => c.kind === k).map(row).join('')}`).join('')}`);
  }
  achievements() { this.panel('Achievements', P.ACHIEVEMENTS.map(a => `<div class="px-item ${this.save.ach[a.id] ? '' : 'off'}"><div class="sw">${this.save.ach[a.id] ? '🏆' : '🔒'}</div><div><b>${esc(a.name)}</b><span class="dim">${esc(a.desc)}</span></div><span class="px-chip">🪙 ${a.coins}</span></div>`).join('')); }
  settings() {
    const s = this.host.settings, sl = (k, l, min, max, st) => `<label class="px-set">${l}<input type="range" data-s="${k}" min="${min}" max="${max}" step="${st}" value="${s[k]}"></label>`, tg = (k, l) => `<label class="px-set">${l}<input type="checkbox" data-s="${k}" ${s[k] ? 'checked' : ''}></label>`;
    const d = this.panel('Settings', `${sl('music', 'Music', 0, 1, 0.05)}${sl('sfx', 'Sound effects', 0, 1, 0.05)}${sl('textScale', 'Text size', 0.85, 1.5, 0.05)}<label class="px-set">Graphics<select data-s="quality">${['auto', 'low', 'medium', 'high'].map(q => `<option ${s.quality === q ? 'selected' : ''}>${q}</option>`).join('')}</select></label>${tg('reduceMotion', 'Reduce motion')}${tg('contrast', 'High contrast')}${tg('captions', 'Audio captions')}<p class="dim">Hints are free and never block progress. Nothing in this game is timed or pay-to-win.</p><button class="px-btn ghost" data-a="reset">Reset PARALLAX progress…</button>`);
    d.oninput = e => { const k = e.target.dataset.s; if (!k) return; const el = e.target; this.host.setSetting(k, el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value); this.applySettings(); };
    d.querySelector('[data-a=reset]').onclick = () => { if (confirm('Erase all PARALLAX progress on this device?')) { this.save = P.defaultSave(); this.persistSave(); this.menu(); } };
  }

  /* ───────── story ───────── */
  cinematic(done) {
    this.mode = 'cine'; const cards = [[1, 'Five ancient engines once held the laws of reality in balance.'], [5, 'They fractured, and trapped whole civilizations in five impossible realms.'], [3, 'You are the Wayfinder. LUMA, your survey drone, records every clue, but never solves a puzzle.'], [4, 'Find the rule. Test one thing at a time. Put the Laws back in order.']];
    let i = -1, ended = false; this.cam.orbit = false; const next = () => { if (ended) return; i++; if (i >= cards.length) { ended = true; this.fadeTo(done); return; } this.fadeTo(() => { this.setWorld(cards[i][0], 11 + i); if (this.view) { this.scene.remove(this.view.group); this.view.destroy(); this.view = null; } this.cineT = 0; this.cineK = i; this.audio.whoosh(); this.ui.querySelector('.px-line').textContent = cards[i][1]; this.ui.querySelector('.px-line').classList.add('on'); }, i < 0 ? 10 : 600); clearTimeout(this.cineTimer); this.cineTimer = setTimeout(next, 5200); };
    this.setScreen('<div class="px-cine"><div class="px-line"></div><button class="px-btn ghost small" data-a="skip">Skip ▶▶</button></div>'); this.audio.unlock();
    this.ui.onclick = e => { if (e.target.closest('[data-a=skip]')) { ended = true; clearTimeout(this.cineTimer); this.fadeTo(done); } }; next();
  }

  /* ───────── level runtime ───────── */
  startLevel(n, fresh) {
    this.audio.unlock(); this.audio.whoosh();
    this.fadeTo(() => {
      const L = LEVELS[n - 1]; this.level = L; if (fresh) delete this.save.checkpoints[n];
      this.worldSeed = null; this.setWorld(L.world.id, n); this.runSeconds = 0; this.session = this.buildSession(L); this.showView(L); this.view.sync(this.session.state, null, null, true);
      this.mode = 'play'; this.cam.orbit = false; this.runStart = performance.now(); this.discovered = false; this.world.shardTaken = false; this.lastHint = null; this.hud(); this.updateHud();
      if (this.session.moves === 0) this.toast('Tap the glowing mechanisms. Drag to look around. Pinch or scroll to zoom.', 3600);
    });
  }
  buildSession(L) {
    const s = new Session(L.state, L.sol, L.par), ck = this.save.checkpoints[L.n]; if (!ck) return s;
    try { for (const m of ck.log) { if (!s.play(m)) throw new Error('bad move'); if (ck.ck != null && s.moves === ck.ck) s.saveCheckpoint(false); } s.hints = ck.hints || 0; s.undos = ck.undos || 0; s.restarts = ck.restarts || 0; if (s.won) { delete this.save.checkpoints[L.n]; return new Session(L.state, L.sol, L.par); } } catch (e) { console.warn('[px] checkpoint unusable, starting fresh', e); delete this.save.checkpoints[L.n]; return new Session(L.state, L.sol, L.par); }
    return s;
  }
  persist() { const s = this.session; if (!s || s.won) return; this.save.checkpoints[this.level.n] = { log: s.moveLog, hints: s.hints, undos: s.undos, restarts: s.restarts, ck: s.checkpoint ? s.checkpoint.moves : null }; this.persistSave(); }
  hud() {
    const L = this.level; this.setScreen(`<div class="px-hud"><div class="px-topbar"><button class="px-btn small" data-a="tomap" title="Level map">☰</button><div class="px-wt"><b>${L.n}. ${esc(L.title)}</b><span>${esc(L.world.short)} · ${esc(FAMILY_NAME[L.family])}</span></div><div class="px-coins">🪙 ${this.save.coins}</div></div>
      <div class="px-status"></div><div class="px-hint"></div><div class="px-moves"></div><div class="px-actions"></div>
      <div class="px-bar"><button class="px-btn" data-a="undo">↶ Undo</button><button class="px-btn" data-a="restart">↺ Restart</button><button class="px-btn hintb" data-a="hint">💡 Hint</button><button class="px-btn" data-a="ckpt">⚑ Save</button><button class="px-btn" data-a="load">⚐ Load</button><button class="px-btn" data-a="recenter">◎</button></div></div>`);
  }
  updateHud() {
    const s = this.session, v = this.view; if (!v) return; const q = sel => this.ui.querySelector(sel); if (!q('.px-moves')) return;
    q('.px-moves').textContent = `Moves ${s.moves}  ·  par ${s.par}  ·  hints ${s.hints}`; q('.px-status').textContent = v.status(); q('.px-status').style.display = v.status() ? '' : 'none';
    const acts = v.actions(); q('.px-actions').className = 'px-actions' + (acts.some(a => a.id === 'u') ? ' pad' : '');
    q('.px-actions').innerHTML = acts.map(a => `<button class="px-btn act ${a.wide ? 'wide' : ''}" data-p="${a.id}" data-a="mv:" data-mv='${JSON.stringify(a.move)}' title="${a.title || ''}">${a.label}</button>`).join('');
    q('.px-actions').style.display = acts.length ? '' : 'none'; this.markHintAction();
  }
  markHintAction() { const m = this.lastHint; this.ui.querySelectorAll('.px-actions .act').forEach(b => b.classList.toggle('hl', !!m && b.dataset.mv === JSON.stringify(m))); }
  doMove(m) {
    const s = this.session; if (!s || this.mode !== 'play' || s.won) return; const prev = s.state; this.audio.unlock();
    if (!s.play(m)) { this.audio.error(); return; }
    this.lastHint = null; this.view.highlight(null); this.world.lumaTarget = null; const hp = this.ui.querySelector('.px-hint'); if (hp) hp.textContent = '';
    this.view.sync(s.state, m, prev); this.updateHud(); this.persist(); if (s.won) this.finish();
  }
  undo() { const s = this.session; if (!s || this.mode !== 'play') return; if (s.undo()) { this.save.stats.undos++; this.lastHint = null; this.view.highlight(null); this.view.sync(s.state, null, null); this.audio.click(); this.updateHud(); this.persist(); } else this.toast('Nothing to undo'); }
  restart() { const s = this.session; if (!s || this.mode !== 'play') return; s.restart(); this.lastHint = null; this.view.highlight(null); this.view.sync(s.state, null, null, true); this.audio.whoosh(); delete this.save.checkpoints[this.level.n]; this.persist(); this.updateHud(); this.toast('Level restarted'); }
  checkpoint() { const s = this.session; if (!s || this.mode !== 'play') return; s.saveCheckpoint(false); this.persist(); this.audio.coin(); this.toast('Checkpoint saved'); }
  loadCheckpoint() { const s = this.session; if (!s || this.mode !== 'play') return; if (s.restoreCheckpoint()) { this.view.highlight(null); this.view.sync(s.state, null, null, true); this.updateHud(); this.persist(); this.audio.whoosh(); this.toast('Returned to your checkpoint'); } else this.toast('No checkpoint yet. Progress saves automatically every few moves.'); }
  recenter() { this.cam.target.set(0, 0.7, this.portrait ? this.view.radius * 0.16 : 0); this.cam.tyaw = 0; this.cam.tpitch = this.portrait ? 0.92 : 0.85; this.cam.tdist = this.fitDist(this.view.radius); }
  hint() {
    const s = this.session; if (!s || this.mode !== 'play' || s.won) return; const stage = s.askHint(), st = s.state.t === 'multi' ? s.state.stages[s.state.cur] : s.state, fam = HINTS[st.t][stage - 1], el = this.ui.querySelector('.px-hint'); this.audio.hint(); const pre = s.state.t === 'multi' ? 'Chamber ' + (s.state.cur + 1) + ': ' : ''; let text = pre + fam(st);
    if (stage === 3) { const m = s.nextMove(); if (m) { this.lastHint = m; this.view.highlight(m); const h = this.view.halos[0] || (this.view.sub && this.view.sub.halos[0]); if (h) { const v = new THREE.Vector3(); h.getWorldPosition(v); v.y += 1.6; this.world.lumaTarget = v; } text = pre + fam(st) + ' LUMA is pointing at it.'; } else text = 'Your recent moves lead away from the solution. Undo a few steps, or restart, and LUMA will show you the way.'; }
    else if (stage === 1 && this.view.focusClue) this.view.focusClue();
    el.innerHTML = `<b>Hint ${stage}/3</b> ${esc(text)}`; this.markHintAction(); this.updateHud(); this.persist();
  }
  finish() {
    const s = this.session, L = this.level, secs = this.runSeconds || 0;
    const ok = solved(s.state) && replay(L.state, s.moveLog).ok;           // the win is verified twice: the live state and a clean replay of every move
    if (!ok) { console.error('[px] win verification failed for level', L.n); this.toast('Something is off with that solution. Try again.'); s.won = false; return; }
    const rw = P.completeLevel(this.save, L, { moves: s.moves, par: s.par, hints: s.hints, discovered: this.discovered, seconds: secs }), newAch = P.checkAchievements(this.save), cos = this.save.coins;
    this.persistSave(); this.mode = 'win'; this.audio.win(); this.cam.orbit = true; this.cam.tpitch = 0.6;
    const c = new THREE.Vector3(0, 2, 0); this.burst.emit(c, 120, '#ffd27a', 7); this.burst.emit(c, 80, '#7af0ff', 6); setTimeout(() => { if (this.burst) { this.burst.emit(c, 100, '#ff7ad8', 8); this.audio.coin(); } }, 500);
    const rows = [['Completion', rw.completion], ['Difficulty bonus', rw.tier], ['Mastery', rw.mastery], ['Discovery', rw.discovery], ['Replay', rw.replay]].filter(r => r[1]).map(r => `<div class="px-rw"><span>${r[0]}</span><b>+${r[1]} 🪙</b></div>`).join('');
    const lore = this.discovered ? `<p class="lore">${esc(loreFor(L.n))}</p>` : (this.save.lore.includes(L.n) ? '' : '<p class="dim">A lore fragment is hidden in this level. Replay to find it.</p>');
    const ach = newAch.map(a => `<div class="px-rw gold"><span>🏆 ${esc(a.name)}</span><b>+${a.coins} 🪙</b></div>`).join('');
    const hasNext = L.n < 100, worldEnd = L.n % 20 === 0;
    setTimeout(() => { if (this.mode !== 'win') return; const d = document.createElement('div'); d.className = 'px-win'; d.innerHTML = `<div class="px-sheet"><h2>${worldEnd ? 'World complete!' : 'Solved'}</h2><div class="px-stars">${stars(rw.stars)}</div><p>${esc(L.title)} · ${s.moves} moves (par ${s.par}) · ${s.hints} hints</p><div class="px-rws">${rows}${ach}<div class="px-rw tot"><span>Total</span><b>🪙 ${cos}</b></div></div>${lore}${L.n === 100 ? '<p class="lore">The fifth law is rebuilt. The Wayfinder looks up: the sky is, for the first time, in order.</p>' : ''}<div class="px-row">${hasNext ? '<button class="px-btn primary" data-a="next">Next level ▶</button>' : ''}<button class="px-btn" data-a="replay">Replay</button><button class="px-btn" data-a="tomap">Levels</button></div></div>`; this.ui.appendChild(d); }, 1100);
  }

  /* ───────── input ───────── */
  key(e) {
    if (this.mode !== 'play') { if (e.key === 'Escape') this.closePanel(); return; } if (e.target && /INPUT|SELECT/.test(e.target.tagName)) return;
    const acts = this.view ? this.view.actions() : []; const a = acts.find(x => x.key === e.key); if (a) { e.preventDefault(); this.doMove(a.move); return; }
    if (e.key === 'z' || (e.ctrlKey && e.key === 'z')) this.undo(); else if (e.key === 'h') this.hint(); else if (e.key === 'Escape') this.act('tomap');
  }
  pDown(e) { this.audio.unlock(); this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (this.ptrs.size === 1) this.down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }; else { this.down = null; this.pinch = this.pdist(); } }
  pdist() { const p = [...this.ptrs.values()]; return p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0; }
  pMove(e) {
    const p = this.ptrs.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (this.ptrs.size === 2) { const d = this.pdist(); if (this.pinch) this.cam.tdist = THREE.MathUtils.clamp(this.cam.tdist * this.pinch / d, this.cam.min || 5, this.cam.max || 40); this.pinch = d; return; }
    if (this.down) { this.down.moved += Math.abs(dx) + Math.abs(dy); if (this.mode === 'play' && this.down.moved > 8) { this.cam.tyaw -= dx * 0.006; this.cam.tpitch = THREE.MathUtils.clamp(this.cam.tpitch + dy * 0.005, 0.25, 1.45); } }
  }
  pUp(e) {
    const had = this.ptrs.delete(e.pointerId); if (!had) return; const d = this.down; this.down = null; if (this.ptrs.size === 0) this.pinch = 0;
    if (d && d.moved < 10 && performance.now() - d.t < 600 && this.mode === 'play' && e.target === this.host.canvas) this.tap(e.clientX, e.clientY);
  }
  tap(x, y) {
    const r = this.host.canvas.getBoundingClientRect(); this.ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), this.camera);
    let hit = this.ray.intersectObjects(this.view.pick, false)[0];                  // puzzle controls win over the lore shard when they overlap on screen
    if (!hit && !this.world.shardTaken) hit = this.ray.intersectObjects(this.world.shardPick, false)[0]; if (!hit) return; const ud = hit.object.userData;
    if (ud.lore) { if (this.world.takeShard()) { this.discovered = true; this.audio.coin(); this.audio.win(); this.burst.emit(this.world.shard.position, 60, '#ffe9a0', 4); this.toast('Lore fragment found! It is saved to your journal when you solve the level.', 3400); } return; }
    if (ud.locked) { this.audio.error(); this.toast('Gold-bolted tiles are fixed in place', 1600); return; }
    const mv = this.view.handlePick(ud); if (mv) this.doMove(mv);
  }

  /* ───────── frame ───────── */
  update(dt) {
    dt = Math.min(dt, 0.05); this.t += dt; if (!this.world) return; const c = this.cam, reduce = this.host.settings.reduceMotion;
    if (this.mode === 'play') this.runSeconds = (this.runSeconds || 0) + (document.hidden ? 0 : dt);
    if (this.mode === 'menu' || this.mode === 'map' || this.mode === 'win') { if (!reduce) c.tyaw += dt * 0.12; c.tdist = THREE.MathUtils.lerp(c.tdist, this.view ? this.fitDist(this.view.radius) * (this.mode === 'win' ? 1.5 : 1.45) : 14, dt); }
    if (this.mode === 'cine') { this.cineT = (this.cineT || 0) + dt; const k = this.cineT / 5.2, a = -0.9 + k * 1.2 + (this.cineK || 0) * 0.5; c.yaw = a; c.tyaw = a; c.pitch = c.tpitch = 0.14 + Math.sin(k * 2) * 0.05; c.dist = c.tdist = 26 - k * 6; c.target.set(0, 9 + k * 2, 0); }
    const e = Math.min(1, dt * 5); c.yaw += (c.tyaw - c.yaw) * e; c.pitch += (c.tpitch - c.pitch) * e; c.dist += (c.tdist - c.dist) * e;
    const cp = Math.cos(c.pitch), sway = reduce ? 0 : Math.sin(this.t * 0.3) * 0.015; this.camera.position.set(c.target.x + Math.sin(c.yaw + sway) * cp * c.dist, c.target.y + Math.sin(c.pitch) * c.dist, c.target.z + Math.cos(c.yaw + sway) * cp * c.dist); this.camera.lookAt(c.target);
    this.world.update(this.t, dt); if (this.view) this.view.update(this.t, dt); if (this.burst) this.burst.update(dt);
    this.host.perfSample(dt, q => { this.applySettings(); this.toast('Graphics lowered for smoother play', 2400); });
    this.R.render(this.scene, this.camera);
  }

  /* ───────── test / debug hooks ───────── */
  autoSolve() { const L = this.level; for (const m of L.sol) { if (this.mode !== 'play') break; this.doMove(m); } return this.session.won; }
}

export default {
  id: 'parallax', title: 'PARALLAX',
  async mount(host) { const g = new PX(host); this.inst = g; g.mount(); return g; },
  unmount() { if (this.inst) { this.inst.unmount(); this.inst = null; } },
  /* Shown on the Game Zone card and profile. */
  summary(Store) { const s = P.migrate(Store.load(SAVE_KEY, null)); return { levels: P.levelsDone(s), stars: P.totalStars(s), coins: s.coins, seconds: s.stats.seconds, next: P.nextLevel(s) }; }
};
