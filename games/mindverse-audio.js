/* MindVerse - audio. Everything is synthesized with WebAudio, nothing is downloaded and there is NO noise in it:
 * the background is real music (warm pads, a soft bass, plucked harp notes, bells and a gentle pulse) that follows the
 * world you are in, and every sound effect is built from tones. Settings: sfx volume and music volume. */
(function () {
  'use strict';
  const MV = (window.MV = window.MV || {});

  // semitone offsets from the root; chords are four-note voicings, scale is what the melody may use
  const THEMES = {
    jungle: { root: 2, bpm: 66, scale: [0, 2, 3, 5, 7, 9, 10], chords: [[0, 3, 7, 10], [5, 9, 12, 16], [3, 7, 10, 14], [7, 10, 14, 17], [0, 3, 7, 12], [8, 12, 15, 19], [5, 9, 12, 16], [7, 11, 14, 17]], bright: .9 },
    ocean: { root: 5, bpm: 58, scale: [0, 2, 4, 6, 7, 9, 11], chords: [[0, 4, 7, 11], [2, 6, 9, 12], [9, 12, 16, 19], [7, 11, 14, 18], [0, 4, 7, 11], [4, 7, 11, 14], [2, 6, 9, 14], [7, 11, 14, 18]], bright: 1.1 },
    dusk: { root: 9, bpm: 62, scale: [0, 3, 5, 7, 10], chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [3, 7, 10, 14], [-2, 2, 5, 9], [0, 3, 7, 10], [5, 8, 12, 15], [-4, 0, 3, 7], [7, 10, 14, 17]], bright: .8 }
  };
  const note = n => 261.63 * Math.pow(2, n / 12);

  MV.audio = {
    create(getS) {
      let ctx = null, sfx = null, mus = null, comp = null, verb = null, vsend = null, timer = null, theme = 'jungle', step = 0, nextT = 0, intensity = 0, arpIdx = 2, started = false, paused = false;
      const S = () => getS();

      function init() {
        if (ctx) { if (ctx.state === 'suspended' && !paused) ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC();
        comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = .01; comp.release.value = .25; comp.connect(ctx.destination);
        sfx = ctx.createGain(); mus = ctx.createGain(); sfx.connect(comp); mus.connect(comp);
        // a soft hall: a smooth, dark decay tail
        const len = Math.floor(ctx.sampleRate * 2.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { lp += ((Math.random() * 2 - 1) - lp) * .12; d[i] = lp * Math.pow(1 - i / len, 2.4) * 2.2; } }
        verb = ctx.createConvolver(); verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = .55; verb.connect(vg); vg.connect(mus); vsend = ctx.createGain(); vsend.gain.value = 1; vsend.connect(verb);
        apply(); start();
      }
      function apply() { if (!ctx) return; sfx.gain.value = .85 * S().sfx; mus.gain.value = .62 * S().music; }

      /* ---------- instruments ---------- */
      function env(g, t, a, peak, dur, rel) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a); g.gain.setValueAtTime(Math.max(.0002, peak), t + Math.max(a, dur - rel)); g.gain.exponentialRampToValueAtTime(.0001, t + dur); }
      function voice(freq, t, dur, type, peak, a, rel, dest, wet, cutoff, detune) {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = type; o.frequency.value = freq; if (detune) o.detune.value = detune;
        f.type = 'lowpass'; f.frequency.value = cutoff || 3000; env(g, t, a, peak, dur, rel); o.connect(f); f.connect(g); g.connect(dest || mus); if (wet) { const s = ctx.createGain(); s.gain.value = wet; g.connect(s); s.connect(vsend); }
        o.start(t); o.stop(t + dur + .1);
      }
      const pad = (freq, t, dur) => { voice(freq, t, dur, 'triangle', .035, 1.4, 2.2, mus, .5, 1100, -6); voice(freq, t, dur, 'sine', .03, 1.6, 2.2, mus, .5, 900, 7); };
      const pluck = (freq, t, vel, bright) => { voice(freq, t, 1.5, 'triangle', vel, .006, 1.3, mus, .65, 2600 * (bright || 1) + 900); voice(freq * 2, t, .6, 'sine', vel * .22, .004, .5, mus, .5, 5000); };
      const bass = (freq, t, vel) => voice(freq, t, 1.9, 'sine', vel, .03, 1.5, mus, .15, 600);
      const bell = (freq, t, vel) => { voice(freq, t, 3, 'sine', vel, .004, 2.8, mus, .8, 6000); voice(freq * 2.76, t, 1.6, 'sine', vel * .35, .004, 1.5, mus, .8, 8000); };
      const kick = (t, vel) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + .22); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(.0001, t + .3); o.connect(g); g.connect(mus); o.start(t); o.stop(t + .35); };
      const tick = (t, vel) => voice(2100, t, .05, 'triangle', vel, .002, .04, mus, .2, 4000);

      /* ---------- the score: 8th-note grid, 16 steps (2 bars) per chord ---------- */
      function playStep(i, t) {
        const th = THEMES[theme], spb = 60 / th.bpm, root = th.root, chordI = Math.floor(i / 16) % th.chords.length, ch = th.chords[chordI], inBlock = i % 16;
        if (inBlock === 0) ch.forEach((n, k) => pad(note(root + n - 12 + (k > 2 ? 0 : 0)), t + k * .06, spb * 8 + .6));
        if (inBlock === 0 || inBlock === 8) bass(note(root + ch[0] - 24), t, inBlock === 0 ? .11 : .07);
        if (inBlock === 6 && intensity > .35) bass(note(root + ch[2] - 24), t, .05);
        if (inBlock % 8 === 0 && intensity > .25) kick(t, .1 * Math.min(1, intensity + .3));
        if ((inBlock % 8 === 4 || inBlock % 8 === 7) && intensity > .5) tick(t, .018);
        const base = [.95, .3, .55, .3, .85, .3, .6, .4][inBlock % 8], p = base * (.55 + .5 * intensity);
        if (Math.random() < p) {
          const tones = []; for (let o = 0; o < 2; o++) ch.forEach(n => tones.push(n + o * 12));
          arpIdx = Math.max(1, Math.min(tones.length - 1, arpIdx + [-2, -1, 1, 2, 1][Math.floor(Math.random() * 5)]));
          let n = tones[arpIdx]; if (Math.random() < .25) { const sc = th.scale; n = sc[Math.floor(Math.random() * sc.length)] + (Math.random() < .5 ? 12 : 0); }
          pluck(note(root + n + 12), t, .045 + Math.random() * .03, th.bright);
        }
        if (inBlock === 12 && Math.random() < .55) bell(note(root + ch[Math.floor(Math.random() * 4)] + 24), t, .028);
      }
      function schedule() {
        if (!ctx || paused) return; const th = THEMES[theme], eighth = 60 / th.bpm / 2;
        if (nextT < ctx.currentTime) nextT = ctx.currentTime + .08;
        while (nextT < ctx.currentTime + .7) { playStep(step, nextT); nextT += eighth; step++; }
      }
      function start() { if (started) return; started = true; step = 0; nextT = ctx.currentTime + .15; timer = setInterval(schedule, 120); schedule(); }
      function setTheme(name) { if (THEMES[name] && name !== theme) { theme = name; step = Math.ceil(step / 16) * 16; } }
      function setIntensity(x) { intensity = Math.max(0, Math.min(1, x)); }
      function pause() { paused = true; if (ctx && ctx.state === 'running') ctx.suspend(); }
      function resume() { paused = false; if (ctx && ctx.state === 'suspended') ctx.resume(); }

      /* ---------- sound effects: tones only ---------- */
      function tone(f, dur, type, g, when, slide, a) {
        if (!ctx) return; const t = ctx.currentTime + (when || 0), o = ctx.createOscillator(), gn = ctx.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
        gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(g, t + (a || .008)); gn.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(gn); gn.connect(sfx); const s = ctx.createGain(); s.gain.value = .25; gn.connect(s); s.connect(vsend); o.start(t); o.stop(t + dur + .05);
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
        core() { [0, 7, 12, 19, 24].forEach((n, i) => tone(note(n), 4, 'sine', .12, i * .3, null, .7)); tone(55, 4, 'sawtooth', .06, 0, 110); }
      };
      return { init, apply, setTheme, setIntensity, pause, resume, fx(n) { if (!ctx || !FX[n] || !S().sfx) return; try { FX[n](); } catch (e) { } }, get ctx() { return ctx; } };
    }
  };
})();
