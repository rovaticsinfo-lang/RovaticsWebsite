/* Devil Hunters: procedural level generator. Every level number always produces the same course.
   It tracks the best possible crowd size ("est") as it goes, so enemies and the devil are always beatable by a
   player who picks the good gates, dodges the traps and collects the weapons. Levels differ in length, mix of challenges
   ("style"), devil tier and the way the devil has to be beaten. */
import { rng } from './cr-util.js';

export const ROAD_W = 8;
export const THEME_COUNT = 8;

/* Devil tiers climb every three levels; each has its own size and toughness. */
export const BOSS_TIERS = [
  { name: 'BEAST', scale: 5.5, hpK: 0.30 },
  { name: 'DEVIL', scale: 6.4, hpK: 0.40 },
  { name: 'ARCH DEVIL', scale: 7.4, hpK: 0.50 },
  { name: 'DEVIL KING', scale: 8.6, hpK: 0.60 }
];
/* The four ways a fight plays out, cycling with the level number. */
export const BOSS_STYLES = [
  { id: 'brawl', hint: 'CRUSH HIM! Use your weapons', hpMul: 1.0 },
  { id: 'dodge', hint: 'DODGE THE SLAMS! Move or JUMP', hpMul: 0.8 },
  { id: 'push', hint: 'PUSH HIM OFF THE EDGE!', hpMul: 1.0 },
  { id: 'smash', hint: 'JUMP to smash him!', hpMul: 0.85 }
];
const STYLES = [
  { name: 'balanced', w: {} },
  { name: 'gauntlet', w: { saw: 2, spikes: 2, wall: 2.2, roller: 2.4 } },
  { name: 'battle', w: { enemy: 3, recruit: 1.4 } },
  { name: 'treasure', w: { pad: 3, speed: 2, recruit: 1.6 } }
];

/* Run speed on the road (metres per second at the default throttle). */
export const baseSpeed = n => 10 + Math.min(n, 20) * 0.12;
/* Levels last 2.5 minutes at the start, and 15 seconds longer with every level. */
export const levelSeconds = n => 150 + 15 * (n - 1);
/* One extra person in the starting crowd for every three levels reached (4 at level 1, 5 at level 3, 6 at level 6...). */
export const startBonus = n => Math.floor(n / 3);
/* How much harder the devil hits at this level (more people lost per blow). */
export const devilPower = n => Math.min(4, 1 + 0.14 * (n - 1));

export function genLevel(n, startN) {
  const r = rng(n * 92821 + 7);
  const diff = Math.min(1, (n - 1) / 20);
  const tier = Math.min(3, Math.floor((n - 1) / 3));
  const style = STYLES[[0, 3, 2, 0, 1, 2, 3, 0, 2, 1, 3, 1][(n - 1) % 12]];
  const length = Math.round(levelSeconds(n) * baseSpeed(n));
  const lvl = {
    n, theme: (n - 1) % THEME_COUNT, length, seconds: levelSeconds(n), startN, styleName: style.name,
    gates: [], enemies: [], recruits: [], hazards: [], coins: [], boxes: [], pads: [], strips: [], weapons: [], boss: null
  };
  /* A row of coins that follows the arc of a jump, so you can see where to leap. */
  const airArc = (zc, x, len, peak, base = 0.95) => {
    const m = 10;
    for (let i = 0; i < m; i++) { const u = i / (m - 1); lvl.coins.push({ x, z: zc + len / 2 - u * len, y: base + peak * 4 * u * (1 - u), taken: false, ph: i * 0.6 }); }
  };
  let est = startN;
  const nice = v => (v < 20 ? Math.round(v) : Math.round(v / 5) * 5);
  const apply = (o, x) => (o.op === '+' ? x + o.v : o.op === 'x' ? x * o.v : o.op === '-' ? Math.max(0, x - o.v) : Math.ceil(x / o.v));
  /* growth is steady rather than runaway: past a few hundred people gates add fixed amounts */
  const good = () => {
    if (est > 120) return { op: '+', v: nice(20 + Math.min(est, 300) * 0.1 + r() * 20) };   // big crowds grow steadily, not explosively
    if (r() < 0.55) return { op: '+', v: Math.max(3, nice(est * (0.12 + r() * 0.3) + 2)) };
    return { op: 'x', v: 2 };
  };
  const bad = () => (n >= 6 && est <= 120 && r() < 0.3 ? { op: '÷', v: 2 } : { op: '-', v: Math.max(2, nice(est * (0.08 + r() * 0.18))) });

  const KINDS = [
    { k: 'recruit', from: 1, w: 1.2 }, { k: 'speed', from: 1, w: 0.7 }, { k: 'pad', from: 2, w: 0.9 }, { k: 'enemy', from: 2, w: 1.5 },
    { k: 'saw', from: 3, w: 1 }, { k: 'wall', from: 3, w: 1 }, { k: 'spikes', from: 4, w: 1 }, { k: 'roller', from: 5, w: 1 }
  ].filter(x => n >= x.from);
  let lastKind = '';
  const pickKind = () => {
    const opts = KINDS.filter(x => x.k !== lastKind), tot = opts.reduce((s, x) => s + x.w * (style.w[x.k] || 1), 0);
    let roll = r() * tot;
    for (const x of opts) { roll -= x.w * (style.w[x.k] || 1); if (roll <= 0) return x.k; }
    return opts[0].k;
  };
  const gap = (a, b) => a + r() * (b - a);   // varied spacing, so the run has a rhythm of busy and calm stretches

  let z = -46, seg = 0;
  while (-z < length - 60) {
    if (seg % 2 === 0) {
      const a = good();
      const wantBad = n >= 2 && r() < 0.35 + 0.4 * diff;
      let b = wantBad ? bad() : good();
      if (!wantBad && a.op === b.op && a.v === b.v) b = { op: a.op === 'x' ? '+' : 'x', v: a.op === 'x' ? Math.max(3, nice(est * 0.3 + 2)) : 2 };
      const flip = r() < 0.5;
      lvl.gates.push({ z, l: flip ? b : a, r: flip ? a : b, done: false });
      est = Math.max(apply(a, est), apply(b, est));
      z -= gap(38, 58);
    } else {
      const kind = pickKind(); lastKind = kind;
      if (kind === 'enemy') {
        const size = Math.max(3, Math.round(est * (0.12 + 0.2 * diff + 0.1 * r())));
        lvl.enemies.push({ z, x: (r() - 0.5) * 3, count: size });
        est = Math.max(2, est - size);
        z -= gap(52, 72);
      } else if (kind === 'saw') {
        const sp = 1.5 + r() * 0.7, ph = r() * 6;
        lvl.hazards.push({ type: 'saw', z, cx: -1.9, amp: 1.7, sp, ph, x: -1.9, cd: 0 });
        lvl.hazards.push({ type: 'saw', z, cx: 1.9, amp: 1.7, sp, ph: ph + Math.PI, x: 1.9, cd: 0 });
        airArc(z, 0, 11, 2.6); z -= gap(46, 64);
      } else if (kind === 'spikes') {
        const mode = r();
        if (mode < 0.34) lvl.hazards.push({ type: 'spikes', z, x0: -4, x1: -0.9, cd: 0 });
        else if (mode < 0.67) lvl.hazards.push({ type: 'spikes', z, x0: 0.9, x1: 4, cd: 0 });
        else { lvl.hazards.push({ type: 'spikes', z, x0: -4, x1: -1.3, cd: 0 }); lvl.hazards.push({ type: 'spikes', z, x0: 1.3, x1: 4, cd: 0 }); }
        airArc(z, 0, 11, 2.6); z -= gap(46, 64);
      } else if (kind === 'wall') {
        const gx = (r() - 0.5) * 4.4, gw = Math.max(2.4, 3.2 - diff * 0.8);
        lvl.hazards.push({ type: 'wall', z, gx, gw, cd: 0 });
        airArc(z, gx, 10, 2.8); z -= gap(46, 64);
      } else if (kind === 'roller') {
        const sp = 1.1 + r() * 0.8, ph = r() * 6;
        lvl.hazards.push({ type: 'roller', z, cx: 0, amp: 2.9, sp, ph, x: 0, cd: 0 });
        lvl.hazards.push({ type: 'roller', z: z - 9, cx: 0, amp: 2.9, sp: sp * 0.9, ph: ph + 2.4, x: 0, cd: 0 });
        airArc(z - 4, 0, 16, 2.7); z -= gap(54, 72);
      } else if (kind === 'pad') {
        const px = (r() - 0.5) * 3;
        lvl.pads.push({ x: px, z, used: false, glow: 0 });
        airArc(z - 10, px, 17, 4.6);
        lvl.boxes.push({ x: px, y: 5.0, z: z - 12, taken: false, ph: r() * 6, reward: r() < 0.5 ? { t: 'crowd', v: Math.max(4, Math.round(Math.min(est, 400) * 0.12) + 2) } : { t: 'coins', v: 25 + Math.floor(r() * 26) } });
        z -= gap(50, 66);
      } else if (kind === 'speed') {
        lvl.strips.push({ x: 0, z, used: false, glow: 0 });
        for (let i = 0; i < 12; i++) lvl.coins.push({ x: Math.sin(i * 0.8) * 1.6, z: z - 6 - i * 2.4, y: 0.95, taken: false, ph: i * 0.5 });
        z -= gap(48, 62);
      } else {
        const count = Math.max(2, Math.round(Math.min(est, 400) * 0.08) + 1);
        lvl.recruits.push({ z, x: (r() - 0.5) * 4.2, count });
        est += count * 0.6;
        z -= gap(40, 56);
      }
    }
    if (r() < 0.8) {
      const zc = z + 24, dir = r() < 0.5 ? -1 : 1, amp = 0.8 + r() * 1.6;
      for (let i = 0; i < 8; i++) lvl.coins.push({ x: Math.sin((i / 7) * Math.PI) * amp * dir, z: zc - i * 1.3, y: 0.95, taken: false, ph: i * 0.6 });
    }
    const sky = r();
    if (sky < 0.3) airArc(z + 10, (r() - 0.5) * 4, 12, 2.6);
    else if (sky < 0.62) {
      const bx = (r() - 0.5) * 4.4, bz = z + 8 + r() * 14, crowd = r() < 0.62;
      lvl.boxes.push({ x: bx, y: 3.4, z: bz, taken: false, ph: r() * 6, reward: crowd ? { t: 'crowd', v: Math.max(3, Math.round(Math.min(est, 400) * (0.06 + r() * 0.08)) + 2) } : { t: 'coins', v: 10 + Math.floor(r() * 21) } });
      airArc(bz, bx, 9, 2.6);
    }
    seg++;
  }
  /* weapons: guns raise the crowd's firepower and shoot obstacles; bombs blow up whatever is ahead. More of both as devils get deadlier. */
  const nGuns = Math.min(14, 2 + Math.floor(n / 2)), nBombs = Math.min(10, 2 + Math.floor(n / 3));
  const place = (type, count) => {
    for (let i = 0; i < count; i++) {
      const zz = -(80 + ((i + r() * 0.8) / count) * (length - 220));
      lvl.weapons.push({ type, x: (r() - 0.5) * 5.2, y: r() < 0.25 ? 3.4 : 1.25, z: zz, taken: false, ph: r() * 6 });
    }
  };
  place('gun', nGuns); place('bomb', nBombs);
  lvl.estFinal = est;
  const st = BOSS_STYLES[(n - 1) % 4], tr = BOSS_TIERS[tier];
  const hp = Math.max(6, Math.round(est * Math.min(0.85, tr.hpK + 0.18 * diff) * st.hpMul));
  lvl.boss = { z: -(length + 62), hp, hpMax: hp, tier, style: st.id, name: tr.name, scale: tr.scale, hint: st.hint, power: devilPower(n) };
  return lvl;
}
