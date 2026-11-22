/* Rovatics Game Zone host: owns the renderer, audio, settings, profile and the main loop, and runs the launcher or a game module.
   Games never create their own renderer; they receive this `host` object. */
import * as THREE from 'three';
import { Splash, SPLASH_SECONDS } from './splash.js';
import { Audio } from './audio.js';
import { Store } from './store.js';
import { GAMES } from './registry.js';
import { Launcher } from './launcher.js';

const DEFAULTS = { quality: 'auto', music: 0.6, sfx: 0.9, reduceMotion: false, contrast: false, textScale: 1, captions: true };

class Host {
  constructor() {
    this.canvas = document.getElementById('gl'); this.root = document.getElementById('app'); this.Store = Store; this.audio = new Audio(); this.settings = { ...DEFAULTS, ...Store.load('settings', {}) }; this.profile = Store.profile();
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance', alpha: false }); this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.installGuards(); this.loop = null; this.resizers = []; this.last = performance.now(); this.autoQ = null; this.perf = { t: 0, n: 0 }; this.game = null; this.entry = null;
    addEventListener('resize', () => { this.fit(); this.resizers.forEach(f => f()); }); document.addEventListener('visibilitychange', () => { if (document.hidden) this.audio.ctx && this.audio.ctx.suspend(); else this.audio.ctx && this.audio.ctx.resume(); });
    this.audio.setVolumes(this.settings.music, this.settings.sfx); this.fit();
    setInterval(() => { this.profile.seconds += 30; Store.saveProfile(this.profile); }, 30000);
  }
  /* If anything goes wrong, show what happened (and a safe-mode button) instead of a frozen or blank page. */
  installGuards() {
    const show = (msg) => { if (this.failed) return; this.failed = true; console.error('[gz] ' + msg); const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#070b18f2;color:#e9f1ff;display:grid;place-items:center;padding:24px;font:16px system-ui;text-align:center;pointer-events:auto';
      d.innerHTML = '<div style="max-width:560px"><h2 style="color:#ffb347">Something went wrong</h2><p style="word-break:break-word;color:#9fb0c8">' + String(msg).replace(/[<>&]/g, '') + '</p><p><button id="gz-safe" style="padding:12px 18px;border-radius:12px;border:0;background:#ffb347;font-weight:700">Reload in safe mode</button></p></div>'; document.body.appendChild(d);
      d.querySelector('#gz-safe').onclick = () => { try { const s = JSON.parse(localStorage.getItem('rovatics.gz.settings') || '{}'); s.quality = 'low'; s.reduceMotion = true; localStorage.setItem('rovatics.gz.settings', JSON.stringify(s)); } catch (e) {} location.reload(); }; };
    this.showError = show; addEventListener('error', e => show((e.message || 'error') + (e.filename ? ' @ ' + e.filename.split('/').pop() + ':' + e.lineno : ''))); addEventListener('unhandledrejection', e => show('Unhandled: ' + ((e.reason && e.reason.message) || e.reason)));
    this.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); show('The graphics card reset (WebGL context lost). This usually means the GPU ran out of memory.'); });
  }
  fit() { const w = innerWidth, h = innerHeight; this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); this.renderer.setSize(w, h, false); }
  onResize(f) { this.resizers = [f]; }
  setLoop(f) { this.loop = f; }
  setSetting(k, v) { this.settings[k] = v; Store.save('settings', this.settings); }
  /* graphics tier: chosen by the player, or by the device and then lowered automatically if the game runs slowly */
  quality() {
    if (this.settings.quality !== 'auto') return this.settings.quality; if (this.autoQ) return this.autoQ;
    const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent), mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
    return mobile ? (mem <= 3 || cores <= 4 ? 'low' : 'medium') : (cores <= 4 ? 'medium' : 'high');
  }
  perfSample(dt, onDrop) {
    if (this.settings.quality !== 'auto') return; const p = this.perf; p.t += dt; p.n++; if (p.t < 4) return; const fps = p.n / p.t; p.t = 0; p.n = 0;
    const q = this.quality(); if (fps < 36 && q !== 'low') { this.autoQ = q === 'high' ? 'medium' : 'low'; onDrop(this.autoQ); }
  }
  async launch(id) {
    const entry = GAMES.find(g => g.id === id); if (!entry) return; this.audio.unlock();
    if (entry.kind === 'link') { location.href = entry.href; return; }
    this.launcher.hide(); this.audio.stopBed();
    try { const mod = (await entry.loader()).default; this.entry = entry; this.mod = mod; this.setLoop(null); this.game = await mod.mount(this); }
    catch (e) { console.error('[gz] could not start', id, e); this.launcher.show(); this.launcher.toast('Could not start ' + entry.title + '. Please reload.'); }
  }
  exitToZone() {
    if (this.mod) { this.mod.unmount(); this.mod = null; this.game = null; } this.audio.stopBed(); this.audio.onCaption = null; this.fit(); this.root.innerHTML = '<div id="gzui"></div>'; this.launcher.attach(); this.launcher.show();
    this.onResize(() => this.launcher.resize()); this.launcher.resize(); this.setLoop(dt => this.launcher.frame(dt));
  }
  async boot() {
    const status = document.getElementById('boot'); this.root.innerHTML = '<div id="gzui"></div>'; this.launcher = new Launcher(this);
    try { await this.launcher.init(); } catch (e) { console.error(e); status.textContent = 'Could not load the 3D scene. This needs a recent browser with WebGL2.'; return; }
    status.remove(); this.onResize(() => this.launcher.resize()); this.launcher.resize(); this.setLoop(dt => this.launcher.frame(dt)); this.launcher.startSplash();
    const tick = now => { const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now; if (this.loop) this.loop(dt); requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    const q = window.GZ_GAME || new URLSearchParams(location.search).get('game'); if (q) this.launcher.skipSplash(q);
    window.__gz = this;
  }
}
new Host().boot();
export { SPLASH_SECONDS, GAMES };
