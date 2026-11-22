/* MindVerse - audio. Everything is synthesized with WebAudio, nothing is downloaded.
 * The background is lively game music: a real groove (kick, snare, hats), a punchy bass line, plucky arpeggios and a
 * catchy lead melody with an echo, each world with its own key, tempo and tune. More layers join as the levels get harder.
 * Sound effects are tone based. Short drum hits use a tiny burst of noise; there is no noise bed. */
(function () {
  'use strict';
  const MV = (window.MV = window.MV || {});
  const note = n => 261.63 * Math.pow(2, n / 12);

  /* ---- the tunes ----
   * root: semitones above C.  scale: the notes the melody lives in.  chords: 4-bar loops, A part and B part (triads/7ths, semitones from root).
   * bass: 16 steps (16th notes), semitone offset from the chord root or null.  lead: scale degrees on an 8th-note grid, 8 slots per bar, 4 bars per part. */
  const TUNES = {
    jungle: {
      bpm: 112, root: 2, scale: [0, 2, 4, 5, 7, 9, 10], swing: .03,
      A: [[0, 4, 7], [-2, 2, 5], [5, 9, 12], [0, 4, 7]], B: [[5, 9, 12], [7, 11, 14], [0, 4, 7], [-2, 2, 5]],
      bass: [0, null, null, 0, null, null, 12, null, 0, null, null, 7, null, null, 5, null],
      kick: [1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1], tom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
      leadA: [4, 0, 5, 4, 2, 0, 4, 0, /**/ 2, 0, 4, 2, 0, 0, 2, 0, /**/ 5, 0, 7, 5, 4, 0, 2, 0, /**/ 4, 2, 0, 2, 4, 0, 0, 0],
      leadB: [7, 0, 5, 7, 9, 0, 7, 0, /**/ 5, 0, 4, 5, 7, 0, 5, 0, /**/ 4, 0, 2, 4, 5, 0, 4, 0, /**/ 2, 4, 5, 7, 9, 0, 0, 0], tone: 'square'
    },
    ocean: {
      bpm: 120, root: 5, scale: [0, 2, 4, 6, 7, 9, 11], swing: 0,
      A: [[0, 4, 7, 11], [2, 6, 9], [9, 12, 16], [7, 11, 14]], B: [[0, 4, 7, 11], [9, 12, 16], [2, 6, 9], [7, 11, 14]],
      bass: [0, null, 0, null, null, 7, null, 0, null, null, 0, null, 12, null, 7, null],
      kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], tom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      leadA: [0, 2, 4, 0, 6, 0, 4, 2, /**/ 5, 0, 4, 2, 4, 0, 0, 0, /**/ 5, 0, 7, 5, 9, 0, 7, 5, /**/ 4, 0, 2, 0, 4, 0, 0, 0],
      leadB: [9, 0, 7, 9, 11, 0, 9, 7, /**/ 7, 0, 6, 4, 6, 0, 0, 0, /**/ 5, 0, 4, 5, 7, 0, 5, 4, /**/ 2, 4, 6, 4, 2, 0, 0, 0], tone: 'triangle'
    },
    dusk: {
      bpm: 126, root: 9, scale: [0, 2, 3, 5, 7, 8, 10], swing: 0,
      A: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], B: [[-4, 0, 3], [-2, 2, 5], [0, 3, 7], [0, 3, 7]],
      bass: [0, null, 0, 0, null, 0, null, 7, 0, null, 0, 0, null, 12, null, 7],
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], tom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      leadA: [4, 0, 4, 5, 4, 0, 2, 0, /**/ 3, 0, 3, 4, 3, 0, 1, 0, /**/ 4, 0, 6, 4, 2, 0, 4, 0, /**/ 5, 4, 2, 0, 1, 0, 0, 0],
      leadB: [7, 0, 6, 4, 6, 0, 7, 0, /**/ 5, 0, 4, 2, 4, 0, 5, 0, /**/ 4, 0, 2, 4, 6, 0, 4, 0, /**/ 2, 1, 2, 4, 2, 0, 0, 0], tone: 'sawtooth'
    },
    forge: {
      bpm: 132, root: 4, scale: [0, 2, 3, 5, 7, 8, 10], swing: 0,
      A: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, 2, 7]], B: [[0, 3, 7], [3, 7, 10], [5, 8, 12], [7, 11, 14]],
      bass: [0, 0, null, 0, 0, null, 0, 12, 0, 0, null, 0, 7, null, 5, null],
      kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], tom: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      leadA: [0, 0, 2, 0, 3, 0, 2, 0, /**/ 0, 0, 2, 0, 4, 0, 3, 0, /**/ 2, 0, 3, 0, 5, 0, 4, 0, /**/ 3, 2, 0, 0, 2, 0, 0, 0],
      leadB: [7, 0, 7, 5, 7, 0, 9, 0, /**/ 8, 0, 7, 5, 7, 0, 4, 0, /**/ 5, 0, 7, 8, 7, 0, 5, 0, /**/ 4, 5, 7, 5, 4, 0, 0, 0], tone: 'square'
    },
    cosmic: {
      bpm: 138, root: 0, scale: [0, 2, 4, 6, 7, 9, 11], swing: 0,
      A: [[0, 4, 7], [4, 8, 11], [9, 12, 16], [5, 9, 12]], B: [[5, 9, 12], [7, 11, 14], [4, 8, 11], [0, 4, 7]],
      bass: [0, null, 12, null, 0, null, 7, null, 0, null, 12, null, 0, 7, 5, null],
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], tom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      leadA: [0, 2, 4, 7, 4, 2, 0, 0, /**/ 2, 4, 6, 9, 6, 4, 2, 0, /**/ 4, 6, 9, 11, 9, 6, 4, 0, /**/ 7, 6, 4, 2, 0, 0, 0, 0],
      leadB: [9, 0, 11, 9, 7, 0, 6, 0, /**/ 7, 0, 9, 7, 6, 0, 4, 0, /**/ 6, 0, 7, 9, 11, 0, 9, 0, /**/ 7, 6, 4, 2, 4, 0, 0, 0], tone: 'sawtooth'
    }
  };
  TUNES.default = TUNES.jungle;

  MV.audio = {
    create(getS) {
      let ctx = null, sfx = null, mus = null, comp = null, verb = null, vsend = null, dly = null, dsend = null, timer = null, theme = 'jungle', step = 0, nextT = 0, intensity = .4, started = false, paused = false;
      const S = () => getS();

      function init() {
        if (ctx) { if (ctx.state === 'suspended' && !paused) ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC();
        comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = .008; comp.release.value = .2; comp.connect(ctx.destination);
        sfx = ctx.createGain(); mus = ctx.createGain(); sfx.connect(comp); mus.connect(comp);
        // a small bright room reverb
        const len = Math.floor(ctx.sampleRate * 1.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { lp += ((Math.random() * 2 - 1) - lp) * .25; d[i] = lp * Math.pow(1 - i / len, 3) * 1.8; } }
        verb = ctx.createConvolver(); verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = .35; verb.connect(vg); vg.connect(mus); vsend = ctx.createGain(); vsend.connect(verb);
        // dotted-eighth echo for the lead and the arps
        dly = ctx.createDelay(1); dly.delayTime.value = .36; const fb = ctx.createGain(); fb.gain.value = .32; const dg = ctx.createGain(); dg.gain.value = .5; const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 2600;
        dly.connect(lp2); lp2.connect(fb); fb.connect(dly); lp2.connect(dg); dg.connect(mus); dsend = ctx.createGain(); dsend.connect(dly);
        apply(); start();
      }
      function apply() { if (!ctx) return; sfx.gain.value = .85 * S().sfx; mus.gain.value = .7 * S().music; }

      /* ---------- instruments ---------- */
      function env(g, t, a, peak, dur, rel) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a); g.gain.setValueAtTime(Math.max(.0002, peak), t + Math.max(a, dur - rel)); g.gain.exponentialRampToValueAtTime(.0001, t + dur); }
      function voice(freq, t, dur, type, peak, a, rel, dest, wet, cutoff, detune, echo, sweep) {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = type; o.frequency.value = freq; if (detune) o.detune.value = detune;
        f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff || 3000, t); if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(200, sweep), t + dur * .8);
        env(g, t, a, peak, dur, rel); o.connect(f); f.connect(g); g.connect(dest || mus);
        if (wet) { const s = ctx.createGain(); s.gain.value = wet; g.connect(s); s.connect(vsend); } if (echo) { const s = ctx.createGain(); s.gain.value = echo; g.connect(s); s.connect(dsend); }
        o.start(t); o.stop(t + dur + .1);
      }
      const noiseBuf = () => { if (noiseBuf.b) return noiseBuf.b; const n = Math.floor(ctx.sampleRate * .5), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return (noiseBuf.b = b); };
      function hit(t, dur, type, f0, gain, q) { const s = ctx.createBufferSource(); s.buffer = noiseBuf(); const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = f0; f.Q.value = q || .8; const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(f); f.connect(g); g.connect(mus); s.start(t); s.stop(t + dur + .02); }
      const kick = (t, v) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(46, t + .16); g.gain.setValueAtTime(.55 * v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .28); o.connect(g); g.connect(mus); o.start(t); o.stop(t + .3); };
      const snare = (t, v) => { hit(t, .14, 'bandpass', 2200, .32 * v, .7); voice(190, t, .13, 'triangle', .22 * v, .002, .1, mus, .15, 2500); };
      const hat = (t, v, open) => hit(t, open ? .16 : .045, 'highpass', 7000, .13 * v, .5);
      const tom = (t, v) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(110, t + .2); g.gain.setValueAtTime(.3 * v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .3); o.connect(g); g.connect(mus); o.start(t); o.stop(t + .32); };
      const bassNote = (freq, t, d, v) => { voice(freq, t, d, 'sawtooth', .17 * v, .006, d * .6, mus, 0, 520, 0, 0, 160); voice(freq / 2, t, d, 'sine', .22 * v, .006, d * .5, mus, 0, 300); };
      const pluck = (freq, t, v, th) => { voice(freq, t, .38, 'triangle', .1 * v, .004, .3, mus, .35, 4200, 0, .4); voice(freq * 2.003, t, .2, 'sine', .04 * v, .003, .15, mus, .3, 6000); };
      const leadNote = (freq, t, d, v, type) => { voice(freq, t, d, type, .09 * v, .012, d * .55, mus, .3, 3600, 5, .55); voice(freq, t, d, type, .06 * v, .012, d * .55, mus, .3, 3000, -6, .45); };
      const padChord = (notes, t, dur) => notes.forEach(n => voice(note(n), t, dur, 'triangle', .028, .08, dur * .45, mus, .45, 1500, -5));

      /* ---------- the score: 16th-note grid, 16 steps per bar, 4-bar parts, A A B A form ---------- */
      function playStep(i, t) {
        const T = TUNES[theme] || TUNES.default, sp = 60 / T.bpm / 4, bar = Math.floor(i / 16), s16 = i % 16, part = Math.floor(bar / 4) % 4, isB = part === 2, chordI = bar % 4;
        const ch = (isB ? T.B : T.A)[chordI], root = T.root, lvl = intensity, sw = (s16 % 2 ? T.swing * sp : 0), tt = t + sw;
        // groove
        if (T.kick[s16]) kick(tt, 1);
        if (T.snare[s16] && lvl > .15) snare(tt, 1);
        if (s16 % 2 === 0) hat(tt, s16 % 4 === 0 ? 1 : .6, false); else if (lvl > .5) hat(tt, .35, s16 === 15);
        if (T.tom[s16] && lvl > .3) tom(tt, 1);
        // bass
        const bo = T.bass[s16]; if (bo !== null) bassNote(note(root + ch[0] - 24 + bo), tt, sp * 1.8, 1);
        // chord stabs / pad once per bar
        if (s16 === 0) padChord(ch.map(n => root + n - 12), t, sp * 16);
        // arpeggio: climbs the chord, gets busier with intensity
        const arpOn = lvl > .3 && (s16 % 2 === 0 || lvl > .65);
        if (arpOn) { const k = [0, 1, 2, 1, 2, 1, 0, 1][(s16 >> 1) % 8], tones = [ch[0], ch[1], ch[2], ch[0] + 12]; pluck(note(root + tones[k % 4] + 12), tt, .8 + (s16 % 4 === 0 ? .3 : 0), T); }
        // lead melody on the 8th-note grid (even steps)
        if (s16 % 2 === 0 && (lvl > .2 || part > 0)) {
          const line = (isB ? T.leadB : T.leadA), slot = (bar % 4) * 8 + (s16 >> 1), deg = line[slot];
          if (deg) { const sc = T.scale, n = root + sc[deg % sc.length] + 12 * Math.floor(deg / sc.length); let len = 1; while (line[slot + len] === 0 && len < 4 && (slot + len) % 8 !== 0) len++; leadNote(note(n + 12), tt, sp * 2 * len * .92, .85 + (part === 2 ? .2 : 0), T.tone); }
        }
        // a rising fill into every part change
        if (chordI === 3 && s16 >= 12 && lvl > .35) { snare(t, .6 + (s16 - 12) * .15); }
      }
      function schedule() {
        if (!ctx || paused) return; const T = TUNES[theme] || TUNES.default, sp = 60 / T.bpm / 4;
        if (nextT < ctx.currentTime) nextT = ctx.currentTime + .08;
        while (nextT < ctx.currentTime + .6) { playStep(step, nextT); nextT += sp; step++; }
      }
      function start() { if (started) return; started = true; step = 0; nextT = ctx.currentTime + .12; timer = setInterval(schedule, 100); schedule(); }
      function setTheme(name) { name = TUNES[name] ? name : 'jungle'; if (name !== theme) { theme = name; step = Math.ceil(step / 64) * 64; } }
      function setIntensity(x) { intensity = Math.max(.05, Math.min(1, x)); }
      function pause() { paused = true; if (ctx && ctx.state === 'running') ctx.suspend(); }
      function resume() { paused = false; if (ctx && ctx.state === 'suspended') ctx.resume(); }

      /* ---------- sound effects: tones ---------- */
      function tone(f, dur, type, g, when, slide, a) {
        if (!ctx) return; const t = ctx.currentTime + (when || 0), o = ctx.createOscillator(), gn = ctx.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
        gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(g, t + (a || .008)); gn.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(gn); gn.connect(sfx); const s = ctx.createGain(); s.gain.value = .22; gn.connect(s); s.connect(vsend); o.start(t); o.stop(t + dur + .05);
      }
      const chord = (list, dur, g, gap, type) => list.forEach((n, i) => tone(note(n + 12), dur, type || 'triangle', g, i * (gap || .07)));
      const FX = {
        tap() { tone(660, .08, 'triangle', .09, 0, 520); },
        pick() { tone(520, .12, 'sine', .08, 0, 780); },
        rot() { tone(180, .09, 'triangle', .14, 0, 120); tone(260, .07, 'triangle', .09, .07, 190); },
        place() { tone(120, .26, 'sine', .3, 0, 55); tone(330, .1, 'triangle', .07, .02, 200); },
        plateOn() { tone(96, .4, 'sine', .3, 0, 50); chord([0, 4, 7, 12], .8, .09, .09, 'sine'); },
        relay() { chord([7, 12, 16, 19], .7, .08, .06, 'sine'); },
        glyph() { tone(note(7), .35, 'triangle', .11); tone(note(14), .25, 'sine', .05, .05); },
        stone() { tone(100, .2, 'sine', .28, 0, 58); tone(250, .08, 'triangle', .06, .01, 160); },
        turn() { tone(200, .12, 'triangle', .1, 0, 130); tone(150, .1, 'triangle', .07, .09, 110); },
        valve() { tone(230, .3, 'sawtooth', .035, 0, 140); tone(520, .1, 'sine', .04, .22, 380); },
        water() { for (let i = 0; i < 6; i++) tone(520 + Math.random() * 620, .09, 'sine', .04, i * .07, 1300); },
        gear() { tone(150, .1, 'square', .045, 0, 95); tone(210, .08, 'triangle', .07, .06, 140); },
        bridge() { tone(70, .7, 'sawtooth', .05, 0, 48); tone(110, .5, 'triangle', .05, .1, 70); },
        plate() { tone(105, .3, 'sine', .28, 0, 60); },
        rail() { tone(90, .5, 'sawtooth', .035, 0, 70); },
        key() { chord([0, 4, 7, 12, 16], .6, .08, .07); },
        empty() { tone(160, .3, 'sine', .12, 0, 105); },
        door() { tone(46, 1.9, 'sawtooth', .13, 0, 34); tone(92, 1.6, 'triangle', .09, .1, 60); chord([0, 7, 12], 1.4, .06, .35, 'sine'); },
        switchOk() { tone(note(0), .3, 'triangle', .12); tone(note(7), .35, 'triangle', .1, .1); },
        trap() { tone(72, .7, 'sine', .42, 0, 30); tone(240, .3, 'sawtooth', .12, 0, 60); tone(1400, .5, 'sine', .04, 0); tone(1990, .45, 'sine', .03, .02); },
        reset() { tone(400, .4, 'sine', .07, 0, 200); },
        blocked() { tone(140, .18, 'square', .06, 0, 100); tone(110, .16, 'square', .05, .09, 80); },
        hint() { chord([12, 16, 19], .7, .07, .1, 'sine'); },
        undo() { tone(460, .13, 'triangle', .08, 0, 280); },
        relic() { [0, 2, 4, 7, 9, 12, 14, 16].forEach((n, i) => tone(note(n + 12), .55, 'sine', .07, i * .06)); },
        stageDone() { chord([0, 4, 7, 12, 16, 19], 1, .1, .1); },
        complete() { chord([0, 4, 7, 12, 16, 19, 24], 1.5, .11, .11); tone(note(0), 3, 'sine', .14, 0); },
        fanfare() { [[0, 0], [4, .14], [7, .28], [12, .42]].forEach(a => { tone(note(a[0] + 12), .5, 'triangle', .13, a[1]); tone(note(a[0] + 24), .5, 'sine', .05, a[1]); }); [12, 16, 19, 24].forEach((n, i) => tone(note(n + 12), 1.8, 'triangle', .1, .6 + i * .04)); tone(note(0), 3.2, 'sine', .15, .6); },
        core() { [0, 7, 12, 19, 24].forEach((n, i) => tone(note(n), 4, 'sine', .12, i * .3, null, .7)); tone(55, 4, 'sawtooth', .06, 0, 110); },
        slide() { tone(140, .18, 'triangle', .1, 0, 100); }, step() { tone(300, .05, 'triangle', .06, 0, 240); }, push() { tone(110, .14, 'sine', .22, 0, 70); tone(200, .08, 'triangle', .07, .02, 150); },
        rune() { chord([7, 12, 16], .35, .07, .05, 'sine'); }, disc() { tone(260, .12, 'triangle', .1, 0, 180); }
      };
      /* test helper: render a tune offline (no sound card needed) and return it as a buffer */
      function renderOffline(OfflineCtor, name, seconds, level) {
        const AC0 = window.AudioContext, AC1 = window.webkitAudioContext; const off = new OfflineCtor(2, Math.floor(44100 * seconds), 44100); window.AudioContext = function () { return off; }; window.webkitAudioContext = undefined;
        ctx = null; started = false; try { init(); } finally { window.AudioContext = AC0; window.webkitAudioContext = AC1; }
        clearInterval(timer); theme = name; intensity = level; step = 0; const T = TUNES[name], sp = 60 / T.bpm / 4; nextT = .05; while (nextT < seconds - 1) { playStep(step, nextT); nextT += sp; step++; }
        return off.startRendering();
      }
      return { init, apply, setTheme, setIntensity, pause, resume, renderOffline, fx(n) { if (!ctx || !FX[n] || !S().sfx) return; try { FX[n](); } catch (e) { } }, get ctx() { return ctx; }, tunes: TUNES };
    }
  };
})();
