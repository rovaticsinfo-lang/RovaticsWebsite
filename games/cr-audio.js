/* Crowd Rush Legends: synthesised sound effects, a small looping tune, a crowd cheer and quiet ambience for each
   location (no audio files). */
let ctx = null, master = null, ambGain = null, muted = false, musicTimer = null, step = 0, wantMusic = false, noiseBuf = null, brownBuf = null;
let lastPop = 0, lastSplash = 0;
const rnd = (a, b) => a + Math.random() * (b - a);

export function init() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    ambGain = ctx.createGain(); ambGain.gain.value = 0.6; ambGain.connect(master);
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    brownBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0), b = brownBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; d[i] = w; last = (last + 0.02 * w) / 1.02; b[i] = last * 3.5; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  if (wantMusic) startMusic();
  if (ambWant) startAmb();
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.55; }
export function isMuted() { return muted; }

function tone(f, dur, type, vol, delay = 0, slide = 0, dest = null) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || master);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol, freq, delay = 0, q = 1, dest = null, type = 'bandpass') {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || master);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
/* noise that swells up and down while its filter sweeps (a car or jet passing) */
function swell(dur, vol, f0, f1, dest, type = 'bandpass', q = 0.8) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
/* one voice of a crowd shouting "ye": a buzzing pitch shaped by two vowel resonances */
function voice(f0, dur, delay, vol) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 1.2, t + 0.13); o.frequency.exponentialRampToValueAtTime(f0 * 1.08, t + dur);
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = rnd(5, 7); lg.gain.value = f0 * 0.012; lfo.connect(lg); lg.connect(o.frequency);
  const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = rnd(480, 600); f1.Q.value = 5;
  const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = rnd(1900, 2400); f2.Q.value = 7;
  const g = ctx.createGain(), g2 = ctx.createGain(); g2.gain.value = 0.55;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.04); g.gain.setValueAtTime(vol, t + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f1); f1.connect(g); o.connect(f2); f2.connect(g2); g2.connect(g); g.connect(master);
  o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}

export const sfx = {
  click() { tone(660, 0.07, 'triangle', 0.15); },
  good() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.17, i * 0.05)); },
  great() { [392, 523, 659, 784, 1047, 1318].forEach((f, i) => tone(f, 0.2, 'triangle', 0.17, i * 0.045)); },
  bad() { tone(320, 0.32, 'sawtooth', 0.12, 0, 0.45); tone(240, 0.32, 'square', 0.07, 0.04, 0.45); },
  coin() { tone(1250, 0.07, 'square', 0.06); tone(1780, 0.12, 'square', 0.06, 0.05); },
  recruit() { [440, 554, 659].forEach((f, i) => tone(f, 0.1, 'sine', 0.14, i * 0.04)); },
  pop() {
    const n = performance.now(); if (n - lastPop < 45) return; lastPop = n;
    noise(0.07, 0.22, 900 + Math.random() * 700, 0, 0.8); tone(180 + Math.random() * 90, 0.06, 'sine', 0.1, 0, 0.5);
  },
  clash() { noise(0.12, 0.2, 500 + Math.random() * 400, 0, 0.6); },
  stomp() { tone(90, 0.25, 'sine', 0.35, 0, 0.4); noise(0.2, 0.3, 200, 0, 0.5); },
  boss() { [110, 104, 98].forEach((f, i) => tone(f, 0.55, 'sawtooth', 0.14, i * 0.3, 0.8)); },
  bossHit() { tone(140, 0.18, 'square', 0.12, 0, 0.5); noise(0.1, 0.2, 400, 0, 0.7); },
  explode() { noise(0.9, 0.5, 220, 0, 0.4); tone(70, 0.8, 'sawtooth', 0.3, 0, 0.3); },
  win() { [523, 659, 784, 1047, 784, 1047, 1318].forEach((f, i) => tone(f, 0.3, 'triangle', 0.2, i * 0.11)); },
  lose() { [392, 349, 311, 262].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.1, i * 0.17, 0.9)); },
  whoosh() { noise(0.35, 0.12, 1800, 0, 0.5); },
  jump() { tone(280, 0.22, 'sine', 0.16, 0, 2.4); noise(0.18, 0.07, 2600, 0, 0.6); },
  land() { tone(110, 0.1, 'sine', 0.14, 0, 0.6); noise(0.08, 0.08, 500, 0, 0.8); },
  shot() { noise(0.06, 0.16, 2400, 0, 0.7); tone(190, 0.07, 'square', 0.05, 0, 0.4); },
  cock() { tone(900, 0.05, 'square', 0.07); tone(600, 0.05, 'square', 0.07, 0.07); },
  boom() { noise(0.5, 0.35, 260, 0, 0.4); tone(80, 0.4, 'sine', 0.22, 0, 0.4); },
  boing() { tone(180, 0.5, 'sine', 0.22, 0, 4.5); tone(360, 0.4, 'triangle', 0.1, 0.05, 3); },
  boost() { swell(0.9, 0.22, 600, 3200, null); tone(300, 0.6, 'sawtooth', 0.07, 0, 4); },
  crash() { noise(0.18, 0.3, 700, 0, 0.5); tone(120, 0.14, 'square', 0.1, 0, 0.5); },
  alarm() { for (let i = 0; i < 3; i++) tone(880, 0.12, 'square', 0.07, i * 0.2); },
  rocket() { swell(2.0, 0.3, 200, 3000, null, 'bandpass', 0.6); tone(120, 1.8, 'sawtooth', 0.12, 0, 9); },
  splash() {
    const n = performance.now(); if (n - lastSplash < 60) return; lastSplash = n;
    noise(0.35, 0.22, 1400 + Math.random() * 600, 0, 0.5); tone(240, 0.2, 'sine', 0.06, 0, 0.4);
  },
  bigSplash() { noise(1.1, 0.5, 900, 0, 0.4); noise(0.6, 0.35, 2400, 0, 0.5); tone(70, 0.7, 'sine', 0.3, 0, 0.4); },
  sizzle() {
    const n = performance.now(); if (n - lastSplash < 60) return; lastSplash = n;
    noise(0.4, 0.18, 3200, 0, 0.4); tone(90, 0.3, 'sawtooth', 0.05, 0, 0.5);
  },
  thud() { tone(70, 0.2, 'sine', 0.2, 0, 0.5); noise(0.12, 0.12, 300, 0, 0.7); },
  box() { [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.14, 'square', 0.07, i * 0.05)); tone(1760, 0.3, 'triangle', 0.1, 0.2); },
  /* The crowd erupts: "Ye! Ye! Ye! Yeeee!" with a roar and applause. */
  cheer() {
    if (!ctx || muted) return;
    const syl = [[0, 0.24], [0.36, 0.24], [0.72, 0.24], [1.08, 1.1]];
    syl.forEach(([d, len], si) => {
      for (let v = 0; v < 11; v++) voice(rnd(170, 330) * (si === 3 ? 1.12 : 1), len, d + rnd(0, 0.06), 0.05 + (si === 3 ? 0.02 : 0));
      noise(len + 0.2, 0.09, rnd(900, 1500), d, 0.5);
    });
    swell(2.6, 0.2, 700, 1600, null, 'bandpass', 0.4);
    for (let i = 0; i < 46; i++) noise(0.05, rnd(0.03, 0.07), rnd(2500, 4500), 0.5 + Math.random() * 2.6, 1.5);
  }
};

const CH = [[45, 52, 57, 60], [41, 48, 53, 57], [48, 55, 60, 64], [43, 50, 55, 59]]; // bass, then arp notes (MIDI)
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
function tick() {
  if (!ctx || muted) return;
  const bar = Math.floor(step / 8) % 4, s = step % 8, c = CH[bar];
  if (s === 0 || s === 4) tone(mf(c[0]), 0.28, 'sine', 0.16);
  const arp = [1, 2, 3, 2, 1, 3, 2, 3][s];
  tone(mf(c[arp] + 12), 0.16, 'triangle', 0.05);
  if (s % 2 === 1) noise(0.04, 0.035, 7000, 0, 2);
  step++;
}
export function startMusic() {
  wantMusic = true;
  if (!ctx || musicTimer) return;
  musicTimer = setInterval(tick, 135);
}
export function stopMusic() {
  wantMusic = false;
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}

/* ---------- ambience: a quiet bed of sound plus now-and-then events for each place ---------- */
let ambWant = null, amb = null;
const EV = {
  bird() { const f = rnd(2200, 4200), n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) tone(f * rnd(0.9, 1.15), 0.07, 'sine', 0.05, i * 0.1, rnd(0.6, 1.6), ambGain); },
  bird2() { tone(720, 0.18, 'sine', 0.05, 0, 0.8, ambGain); tone(560, 0.26, 'sine', 0.05, 0.22, 0.85, ambGain); },
  gull() { const f = rnd(1100, 1500); tone(f, 0.4, 'sawtooth', 0.022, 0, 0.55, ambGain); tone(f * 0.9, 0.5, 'sawtooth', 0.02, 0.45, 0.5, ambGain); },
  honk() { const f = rnd(380, 480); tone(f, 0.3, 'square', 0.02, 0, 0, ambGain); tone(f * 1.25, 0.3, 'square', 0.016, 0, 0, ambGain); },
  car() { swell(rnd(1.2, 2.0), 0.05, rnd(400, 700), rnd(900, 1600), ambGain); },
  truck() { swell(rnd(1.8, 2.6), 0.07, 180, 480, ambGain, 'lowpass', 0.6); },
  siren() { const t0 = 2.6; if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; for (let i = 0; i < 6; i++) o.frequency.setValueAtTime(i % 2 ? 700 : 950, t + i * 0.43); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.018, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + t0); o.connect(g); g.connect(ambGain); o.start(t); o.stop(t + t0); },
  chime() { tone(880, 0.5, 'sine', 0.035, 0, 0.99, ambGain); tone(659, 0.7, 'sine', 0.035, 0.45, 0.99, ambGain); },
  jet() { swell(rnd(2.6, 3.6), 0.09, 260, 900, ambGain, 'lowpass', 0.7); },
  clack() { noise(0.07, 0.07, 220, 0, 1.5, ambGain); noise(0.07, 0.06, 240, 0.14, 1.5, ambGain); },
  horn() { tone(311, 1.1, 'sawtooth', 0.025, 0, 0, ambGain); tone(392, 1.1, 'sawtooth', 0.02, 0, 0, ambGain); },
  crackle() { const n = 3 + Math.floor(Math.random() * 5); for (let i = 0; i < n; i++) noise(0.03, rnd(0.04, 0.09), rnd(1800, 5000), Math.random() * 0.6, 2, ambGain); },
  boom() { tone(52, 0.8, 'sine', 0.07, 0, 0.6, ambGain); noise(0.6, 0.05, 160, 0, 0.5, ambGain, 'lowpass'); },
  gust() { swell(rnd(2, 3), 0.04, 500, 900, ambGain, 'bandpass', 0.3); }
};
/* bed: looping noise through a filter, optionally with a slow swell (waves, wind); events: [name, chance per 0.8 s] */
const PROFILES = {
  city: { beds: [{ n: 'brown', f: 220, t: 'lowpass', g: 0.5 }, { n: 'white', f: 1800, t: 'bandpass', q: 0.5, g: 0.012, lfo: [0.2, 0.01] }, { n: 'white', f: 900, t: 'lowpass', g: 0.02, lfo: [0.3, 0.015] }], ev: [['car', 0.45], ['honk', 0.1], ['truck', 0.12], ['bird', 0.1]] },
  forest: { beds: [{ n: 'white', f: 650, t: 'bandpass', q: 0.4, g: 0.025, lfo: [0.1, 0.02] }, { n: 'brown', f: 330, t: 'lowpass', g: 0.28 }], ev: [['bird', 0.9], ['bird2', 0.4], ['bird', 0.5], ['gust', 0.08]] },
  beach: { beds: [{ n: 'white', f: 800, t: 'lowpass', g: 0.02, lfo: [0.13, 0.05] }, { n: 'brown', f: 260, t: 'lowpass', g: 0.3, lfo: [0.13, 0.15] }, { n: 'white', f: 4200, t: 'bandpass', q: 0.8, g: 0.006, lfo: [0.13, 0.006] }], ev: [['gull', 0.3], ['gust', 0.1], ['bird', 0.08]] },
  highway: { beds: [{ n: 'brown', f: 200, t: 'lowpass', g: 0.45 }, { n: 'white', f: 1300, t: 'bandpass', q: 0.4, g: 0.02, lfo: [0.5, 0.012] }], ev: [['car', 1.0], ['truck', 0.35], ['honk', 0.08]] },
  rail: { beds: [{ n: 'brown', f: 150, t: 'lowpass', g: 0.32 }, { n: 'white', f: 600, t: 'bandpass', q: 0.4, g: 0.02, lfo: [0.12, 0.012] }], ev: [['clack', 1.2], ['truck', 0.18], ['horn', 0.05], ['bird', 0.2]] },
  airport: { beds: [{ n: 'white', f: 520, t: 'lowpass', g: 0.03, lfo: [0.06, 0.012] }, { n: 'brown', f: 180, t: 'lowpass', g: 0.3 }], ev: [['jet', 0.2], ['chime', 0.07], ['car', 0.12]] },
  night: { beds: [{ n: 'brown', f: 170, t: 'lowpass', g: 0.4 }, { n: 'white', f: 4300, t: 'bandpass', q: 6, g: 0.012, lfo: [22, 0.012] }], ev: [['car', 0.35], ['siren', 0.07], ['honk', 0.08], ['truck', 0.1]] },
  lava: { beds: [{ n: 'brown', f: 95, t: 'lowpass', g: 0.9 }, { n: 'white', f: 420, t: 'lowpass', g: 0.03, lfo: [0.2, 0.012] }], ev: [['crackle', 1.0], ['boom', 0.1], ['gust', 0.06]] }
};
function stopAmb() {
  if (!amb) return;
  clearInterval(amb.timer);
  const old = amb, t = ctx.currentTime;
  old.out.gain.setTargetAtTime(0, t, 0.4);
  setTimeout(() => { old.nodes.forEach(n => { try { n.stop ? n.stop() : n.disconnect(); } catch (e) { /* already stopped */ } }); try { old.out.disconnect(); } catch (e) { /* ignore */ } }, 1800);
  amb = null;
}
function startAmb() {
  if (!ctx || !ambWant) return;
  const prof = PROFILES[ambWant]; if (!prof) return;
  if (amb && amb.kind === ambWant) return;
  stopAmb();
  const out = ctx.createGain(); out.gain.value = 0; out.connect(ambGain); out.gain.setTargetAtTime(1, ctx.currentTime, 1.2);
  const nodes = [];
  for (const b of prof.beds) {
    const s = ctx.createBufferSource(); s.buffer = b.n === 'brown' ? brownBuf : noiseBuf; s.loop = true; s.loopStart = Math.random();
    const f = ctx.createBiquadFilter(); f.type = b.t; f.frequency.value = b.f; f.Q.value = b.q || 0.7;
    const g = ctx.createGain(); g.gain.value = b.g;
    s.connect(f); f.connect(g); g.connect(out); s.start();
    nodes.push(s, f, g);
    if (b.lfo) {
      const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = b.lfo[0]; lg.gain.value = b.lfo[1]; l.connect(lg); lg.connect(g.gain); l.start(); nodes.push(l, lg);
    }
  }
  const timer = setInterval(() => {
    if (!ctx || muted || ctx.state !== 'running' || (ambGain && ambGain.gain.value < 0.05)) return;
    for (const [name, p] of prof.ev) if (Math.random() < p * 0.45) EV[name]();
  }, 800);
  amb = { kind: ambWant, out, nodes, timer };
}
/* Call with the theme id; starts as soon as audio is unlocked by the first tap. */
export function setAmbience(kind) { ambWant = kind; if (ctx) startAmb(); }
export function duckAmbience(on) { if (ambGain && ctx) ambGain.gain.setTargetAtTime(on ? 0 : 0.6, ctx.currentTime, 0.15); }
