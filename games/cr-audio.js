/* Crowd Rush Legends: synthesised sound effects and a small looping tune (no audio files). */
let ctx = null, master = null, muted = false, musicTimer = null, step = 0, wantMusic = false, noiseBuf = null;
let lastPop = 0, lastSplash = 0;

export function init() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    const len = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  if (wantMusic) startMusic();
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.55; }
export function isMuted() { return muted; }

function tone(f, dur, type, vol, delay = 0, slide = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol, freq, delay = 0, q = 1) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
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
  splash() {
    const n = performance.now(); if (n - lastSplash < 60) return; lastSplash = n;
    noise(0.35, 0.22, 1400 + Math.random() * 600, 0, 0.5); tone(240, 0.2, 'sine', 0.06, 0, 0.4);
  },
  sizzle() {
    const n = performance.now(); if (n - lastSplash < 60) return; lastSplash = n;
    noise(0.4, 0.18, 3200, 0, 0.4); tone(90, 0.3, 'sawtooth', 0.05, 0, 0.5);
  },
  thud() { tone(70, 0.2, 'sine', 0.2, 0, 0.5); noise(0.12, 0.12, 300, 0, 0.7); },
  box() { [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.14, 'square', 0.07, i * 0.05)); tone(1760, 0.3, 'triangle', 0.1, 0.2); }
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
