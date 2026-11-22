/* Rovatics Game Zone launcher: splash, then the game selection hub with a featured game, profile and settings. */
import { Splash, SPLASH_SECONDS } from './splash.js';
import { GAMES } from './registry.js';
import { Store } from './store.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtTime = s => { const m = Math.round(s / 60); return m < 60 ? m + ' min' : (m / 60).toFixed(1) + ' h'; };

export class Launcher {
  constructor(host) { this.host = host; this.state = 'boot'; this.covers = {}; }
  async init() {
    this.splash = new Splash(this.host.renderer, 'fonts/helvetiker_bold.typeface.json'); await this.splash.load(); this.attach();
  }
  attach() { this.ui = this.host.root.querySelector('#gzui'); this.ui.onclick = e => { const b = e.target.closest('[data-g]'); if (b) { this.host.audio.unlock(); this.host.audio.click(); this.act(b.dataset.g, b); } }; }
  resize() { const w = this.host.canvas.clientWidth || innerWidth, h = this.host.canvas.clientHeight || innerHeight; this.host.renderer.setSize(w, h, false); this.splash.resize(w, h); }
  startSplash() {
    this.state = 'splash'; this.ui.innerHTML = '<div class="gz-splash"><div class="gz-skip">Tap to continue</div></div>'; this.host.audio.setBed && 0;
    const go = () => { if (this.state === 'splash') this.skipSplash(); }; this.ui.querySelector('.gz-splash').onclick = () => { this.host.audio.unlock(); go(); };
    this.splashTimer = setTimeout(go, SPLASH_SECONDS * 1000);
  }
  skipSplash(thenPlay) { clearTimeout(this.splashTimer); this.state = 'hub'; this.splash.toHub(); this.hub(); if (thenPlay) setTimeout(() => this.host.launch(thenPlay), 400); }
  hide() { this.state = 'game'; this.ui.innerHTML = ''; }
  show() { this.state = 'hub'; this.splash.toHub(); this.hub(); }
  toast(t) { const d = document.createElement('div'); d.className = 'gz-toast'; d.textContent = t; this.ui.appendChild(d); setTimeout(() => d.remove(), 3000); }
  frame(dt) { this.splash.update(dt); this.splash.render(); }

  async hub() {
    const prof = this.host.profile; this.ui.innerHTML = `<div class="gz-hub">
      <div class="gz-top"><div class="gz-badge">ROVATICS <b>GAME ZONE</b></div><div class="gz-right"><button class="gz-chip" data-g="profile"><i style="background:${esc(prof.color)}"></i>${esc(prof.name)}</button><button class="gz-chip" data-g="settings" aria-label="Settings">⚙</button></div></div>
      <div class="gz-cards"></div><div class="gz-foot">More Rovatics games will appear here. Free to play · works offline · no ads</div></div>`;
    const box = this.ui.querySelector('.gz-cards');
    for (const g of GAMES) {
      let stat = ''; try { if (g.kind === 'module') { const mod = (await g.loader()).default; const s = mod.summary(Store); stat = `<div class="gz-stat"><b>${s.levels}</b> / 100 solved · <b>${s.stars}</b> ★ · <b>${s.coins}</b> coins</div>`; g.next = s.next; g.started = s.levels > 0; } } catch (e) { console.warn(e); }
      const art = g.kind === 'module' ? `<div class="gz-art" data-art="${g.id}"></div>` : `<div class="gz-art" style="background:${g.art}"><span class="gz-emoji">${g.emoji || ''}</span></div>`;
      box.insertAdjacentHTML('beforeend', `<article class="gz-card ${g.featured ? 'feat' : ''}" style="--ac:${g.accent}">${art}<div class="gz-meta">${g.featured ? '<span class="gz-flag">FEATURED</span>' : ''}<h2>${esc(g.title)}</h2><h3>${esc(g.subtitle)}</h3><p>${esc(g.tagline)}</p>${stat}<div class="gz-btns"><button class="gz-play" data-g="play" data-id="${g.id}">${g.started ? 'Continue' : g.kind === 'link' ? 'Play' : 'Play'} ▶</button><button class="gz-info" data-g="info" data-id="${g.id}">Info</button></div></div></article>`);
    }
    for (const g of GAMES) if (g.cover) { const el = this.ui.querySelector(`[data-art="${g.id}"]`); if (!el) continue; if (this.covers[g.id]) el.style.backgroundImage = `url(${this.covers[g.id]})`; else this.makeCover(g, el); }
  }
  /* the cover is rendered in 3D once (while the hub is idle) and cached for the session */
  makeCover(g, el) {
    el.classList.add('gz-wait'); setTimeout(async () => { try { const url = await g.cover(this.host.renderer); this.covers[g.id] = url; this.host.renderer.setSize(innerWidth, innerHeight, false); el.style.backgroundImage = `url(${url})`; el.classList.remove('gz-wait'); this.resize(); } catch (e) { console.warn('[gz] cover failed', e); el.style.background = `radial-gradient(120% 90% at 70% 20%, ${g.accent}, #0a0d1c)`; } }, 900);
  }
  act(a, b) {
    if (a === 'play') this.host.launch(b.dataset.id);
    else if (a === 'info') this.info(GAMES.find(g => g.id === b.dataset.id));
    else if (a === 'profile') this.profile(); else if (a === 'settings') this.settings(); else if (a === 'close') this.closeSheet();
  }
  sheet(title, body) { this.closeSheet(); const d = document.createElement('div'); d.className = 'gz-sheetwrap'; d.innerHTML = `<div class="gz-sheet"><div class="gz-sh"><b>${title}</b><button class="gz-chip" data-g="close">✕</button></div><div class="gz-sb">${body}</div></div>`; this.ui.appendChild(d); return d; }
  closeSheet() { const s = this.ui.querySelector('.gz-sheetwrap'); if (s) s.remove(); }
  info(g) { this.sheet(esc(g.title), `<p>${esc(g.about)}</p><ul>${g.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul><button class="gz-play" data-g="play" data-id="${g.id}">Play ▶</button>`); }
  profile() {
    const p = this.host.profile;
    const sw = ['#ffb347', '#6fe8ff', '#ff7ad8', '#7affb0', '#c9a2ff', '#ff6a6a'].map(c => `<button class="gz-sw ${c === p.color ? 'on' : ''}" data-g="color" data-c="${c}" style="background:${c}" aria-label="colour"></button>`).join('');
    const d = this.sheet('Player profile', `<label class="gz-set">Name <input id="gz-name" maxlength="16" value="${esc(p.name)}"></label><div class="gz-set">Colour <span>${sw}</span></div><p class="dim">Time in Game Zone: ${fmtTime(p.seconds)}</p><div id="gz-games"></div>`);
    d.querySelector('#gz-name').oninput = e => { p.name = e.target.value.slice(0, 16) || 'Wayfinder'; Store.saveProfile(p); };
    d.onclick = e => { const b = e.target.closest('[data-g=color]'); if (b) { p.color = b.dataset.c; Store.saveProfile(p); this.profile(); } };
    (async () => { const el = d.querySelector('#gz-games'); for (const g of GAMES.filter(x => x.kind === 'module')) { const mod = (await g.loader()).default, s = mod.summary(Store); el.insertAdjacentHTML('beforeend', `<div class="gz-prog"><b>${esc(g.title)}</b><span>${s.levels}/100 levels · ${s.stars} ★ · ${s.coins} coins · ${fmtTime(s.seconds)}</span></div>`); } })();
  }
  settings() {
    const s = this.host.settings, sl = (k, l, min, max, st) => `<label class="gz-set">${l}<input type="range" data-s="${k}" min="${min}" max="${max}" step="${st}" value="${s[k]}"></label>`, tg = (k, l) => `<label class="gz-set">${l}<input type="checkbox" data-s="${k}" ${s[k] ? 'checked' : ''}></label>`;
    const d = this.sheet('Settings', `${sl('music', 'Music', 0, 1, 0.05)}${sl('sfx', 'Sound effects', 0, 1, 0.05)}${sl('textScale', 'Text size', 0.85, 1.5, 0.05)}<label class="gz-set">Graphics<select data-s="quality">${['auto', 'low', 'medium', 'high'].map(q => `<option ${s.quality === q ? 'selected' : ''}>${q}</option>`).join('')}</select></label>${tg('reduceMotion', 'Reduce motion')}${tg('contrast', 'High contrast')}${tg('captions', 'Audio captions')}`);
    d.oninput = e => { const k = e.target.dataset.s; if (!k) return; const el = e.target; this.host.setSetting(k, el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value); document.documentElement.style.setProperty('--ts', this.host.settings.textScale); document.body.classList.toggle('hc', !!this.host.settings.contrast); this.host.audio.setVolumes(this.host.settings.music, this.host.settings.sfx); };
  }
}
