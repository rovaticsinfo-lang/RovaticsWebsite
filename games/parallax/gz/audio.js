/* Rovatics Game Zone audio: a tiny Web Audio synth (no files). Sound effects, musical notes for resonance puzzles and a soft ambient bed per theme.
   Everything is created lazily after the first tap (browsers require it). Every sound can also raise a caption for players who cannot hear it. */
export class Audio {
  constructor() { this.ctx = null; this.music = 0.6; this.sfx = 0.9; this.onCaption = null; this.bed = null; }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = this.sfx; this.sfxBus.connect(this.master);
    this.musBus = this.ctx.createGain(); this.musBus.gain.value = this.music * 0.35; this.musBus.connect(this.master);
    const len = this.ctx.sampleRate * 1.6, buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);   // soft reverb tail
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.verb = this.ctx.createConvolver(); this.verb.buffer = buf; const vg = this.ctx.createGain(); vg.gain.value = 0.35; this.verb.connect(vg); vg.connect(this.master);
  }
  setVolumes(music, sfx) { this.music = music; this.sfx = sfx; if (this.ctx) { this.musBus.gain.value = music * 0.35; this.sfxBus.gain.value = sfx; } }
  caption(t) { if (this.onCaption) this.onCaption(t); }
  tone(freq, dur = 0.3, type = 'sine', vol = 0.25, delay = 0, bus = null, wet = 0.4) {
    if (!this.ctx) return; const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfxBus); if (wet && this.verb) { const w = this.ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(this.verb); }
    o.start(t); o.stop(t + dur + 0.05);
  }
  note(i, dur = 0.5) { const sc = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3, 784]; this.tone(sc[i % sc.length], dur, 'triangle', 0.22); this.tone(sc[i % sc.length] * 2, dur * 0.6, 'sine', 0.06); }
  click() { this.tone(520, 0.07, 'triangle', 0.14, 0, null, 0.1); }
  tap() { this.tone(330, 0.12, 'sine', 0.18); this.tone(660, 0.1, 'sine', 0.07, 0.02); }
  thunk() { this.tone(110, 0.22, 'sine', 0.3, 0, null, 0.15); this.tone(70, 0.3, 'sine', 0.2); this.caption('[stone shifts]'); }
  error() { this.tone(160, 0.25, 'sawtooth', 0.1); this.tone(150, 0.3, 'square', 0.06, 0.05); this.caption('[wrong tone]'); }
  power() { [0, 4, 7, 12].forEach((s, i) => this.tone(220 * Math.pow(2, s / 12), 0.35, 'triangle', 0.14, i * 0.06)); this.caption('[mechanism hums]'); }
  hint() { this.tone(880, 0.5, 'sine', 0.12); this.tone(1320, 0.7, 'sine', 0.08, 0.12); this.caption('[soft chime: hint]'); }
  coin() { this.tone(1320, 0.1, 'square', 0.07); this.tone(1760, 0.2, 'square', 0.07, 0.07); }
  win() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(262 * Math.pow(2, s / 12), 0.9, 'triangle', 0.16, i * 0.11)); this.caption('[the mechanism sings: solved]'); }
  whoosh() { if (!this.ctx) return; const t = this.ctx.currentTime, n = this.ctx.createBufferSource(), b = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.7, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / d.length); n.buffer = b; const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.6);
    const g = this.ctx.createGain(); g.gain.value = 0.2; n.connect(f); f.connect(g); g.connect(this.sfxBus); n.start(t); }
  drop() { this.tone(900, 0.4, 'sine', 0.12); this.tone(600, 0.5, 'sine', 0.1, 0.06); this.caption('[water]'); }
  /* A slow evolving pad. Each world has its own mode, root and brightness. */
  setBed(world) {
    if (!this.ctx) return; this.stopBed(); const P = [[110, [0, 7, 12, 16]], [98, [0, 5, 10, 15]], [123.5, [0, 7, 14, 19]], [87.3, [0, 3, 7, 14]], [73.4, [0, 7, 11, 18]]][world - 1] || [110, [0, 7, 12]];
    const bus = this.ctx.createGain(); bus.gain.value = 0.0001; bus.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 3); bus.connect(this.musBus); if (this.verb) bus.connect(this.verb);
    const oscs = P[1].map((s, i) => { const o = this.ctx.createOscillator(), g = this.ctx.createGain(), l = this.ctx.createOscillator(), lg = this.ctx.createGain();
      o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = P[0] * Math.pow(2, s / 12); g.gain.value = 0.12 / (1 + i * 0.3);
      l.frequency.value = 0.05 + i * 0.03; lg.gain.value = 0.05; l.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(bus); o.start(); l.start(); return [o, l]; });
    this.bed = { bus, oscs };
  }
  stopBed() { if (!this.bed) return; const { bus, oscs } = this.bed, t = this.ctx.currentTime; bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value, t); bus.gain.linearRampToValueAtTime(0.0001, t + 1); oscs.forEach(([o, l]) => { o.stop(t + 1.1); l.stop(t + 1.1); }); this.bed = null; }
}
