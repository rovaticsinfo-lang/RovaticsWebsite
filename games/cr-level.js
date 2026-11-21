/* Crowd Rush Legends: procedural level generator. Every level number always produces the same course.
   It tracks the best possible crowd size ("est") as it goes, so enemies and the boss are always beatable by a
   player who picks the good gates and dodges the traps. */
import { rng } from './cr-util.js';

export const ROAD_W = 8;
export const THEME_COUNT = 8;

export function genLevel(n, startN) {
  const r = rng(n * 92821 + 7);
  const diff = Math.min(1, (n - 1) / 20);
  const lvl = {
    n, theme: (n - 1) % THEME_COUNT, length: 210 + Math.min(n, 24) * 8, startN,
    gates: [], enemies: [], recruits: [], hazards: [], coins: [], boxes: [], boss: null
  };
  /* A row of coins that follows the arc of a jump, so you can see where to leap. */
  const airArc = (zc, x, len, peak) => {
    const n = 10;
    for (let i = 0; i < n; i++) { const u = i / (n - 1); lvl.coins.push({ x, z: zc + len / 2 - u * len, y: 0.95 + peak * 4 * u * (1 - u), taken: false, ph: i * 0.6 }); }
  };
  let est = startN;
  const nice = v => (v < 20 ? Math.round(v) : Math.round(v / 5) * 5);
  const apply = (o, x) => (o.op === '+' ? x + o.v : o.op === 'x' ? x * o.v : o.op === '-' ? Math.max(0, x - o.v) : Math.ceil(x / o.v));
  const good = () => {
    if (r() < 0.55) return { op: '+', v: Math.max(3, nice(est * (0.18 + r() * 0.4) + 2)) };
    return { op: 'x', v: n >= 8 && r() < 0.12 ? 4 : r() < 0.72 ? 2 : 3 };
  };
  const bad = () => (n >= 6 && r() < 0.3 ? { op: '÷', v: 2 } : { op: '-', v: Math.max(2, nice(est * (0.1 + r() * 0.22))) });

  let z = -38, seg = 0;
  while (-z < lvl.length - 20) {
    if (seg % 2 === 0) {
      const a = good();
      const wantBad = n >= 2 && r() < 0.35 + 0.45 * diff;
      let b = wantBad ? bad() : good();
      if (!wantBad && a.op === b.op && a.v === b.v) b = { op: a.op === 'x' ? '+' : 'x', v: a.op === 'x' ? Math.max(3, nice(est * 0.3 + 2)) : 2 };
      const flip = r() < 0.5;
      lvl.gates.push({ z, l: flip ? b : a, r: flip ? a : b, done: false });
      est = Math.max(apply(a, est), apply(b, est));
      z -= 34;
    } else {
      const roll = r();
      if (n >= 2 && roll < 0.5 + diff * 0.15) {
        const size = Math.max(3, Math.round(est * (0.14 + 0.22 * diff + 0.1 * r())));
        lvl.enemies.push({ z, x: (r() - 0.5) * 3, count: size });
        est = Math.max(2, est - size);
        z -= 46;
      } else if (n >= 3 && roll < 0.82) {
        if (n < 4 || r() < 0.5) {
          const sp = 1.5 + r() * 0.7, ph = r() * 6;
          lvl.hazards.push({ type: 'saw', z, cx: -1.9, amp: 1.7, sp, ph, x: -1.9, cd: 0 });
          lvl.hazards.push({ type: 'saw', z, cx: 1.9, amp: 1.7, sp, ph: ph + Math.PI, x: 1.9, cd: 0 });
        } else {
          const mode = r();
          if (mode < 0.34) lvl.hazards.push({ type: 'spikes', z, x0: -4, x1: -0.9, cd: 0 });
          else if (mode < 0.67) lvl.hazards.push({ type: 'spikes', z, x0: 0.9, x1: 4, cd: 0 });
          else { lvl.hazards.push({ type: 'spikes', z, x0: -4, x1: -1.3, cd: 0 }); lvl.hazards.push({ type: 'spikes', z, x0: 1.3, x1: 4, cd: 0 }); }
        }
        for (const h of lvl.hazards.slice(-2)) if (h.type === 'saw' || h.z === z) { airArc(z, h.type === 'saw' ? 0 : (h.x0 + h.x1) / 2, 11, 2.6); break; }
        z -= 40;
      } else {
        const count = Math.max(2, Math.round(est * 0.08) + 1);
        lvl.recruits.push({ z, x: (r() - 0.5) * 4.2, count });
        est += count * 0.6;
        z -= 36;
      }
    }
    if (r() < 0.8) {
      const zc = z + 20, dir = r() < 0.5 ? -1 : 1, amp = 0.8 + r() * 1.6;
      for (let i = 0; i < 8; i++) lvl.coins.push({ x: Math.sin((i / 7) * Math.PI) * amp * dir, z: zc - i * 1.3, y: 0.95, taken: false, ph: i * 0.6 });
    }
    /* sky treats: an air arc of coins, or a mystery box that only a jump can reach */
    const sky = r();
    if (sky < 0.38) airArc(z + 8, (r() - 0.5) * 4, 12, 2.6);
    else if (sky < 0.78) {
      const bx = (r() - 0.5) * 4.4, bz = z + 6 + r() * 10, crowd = r() < 0.62;
      lvl.boxes.push({ x: bx, y: 3.4, z: bz, taken: false, ph: r() * 6, reward: crowd ? { t: 'crowd', v: Math.max(3, Math.round(est * (0.08 + r() * 0.1)) + 2) } : { t: 'coins', v: 10 + Math.floor(r() * 21) } });
      airArc(bz, bx, 9, 2.6);
    }
    seg++;
  }
  lvl.estFinal = est;
  lvl.boss = { z: -(lvl.length + 62), hp: Math.max(6, Math.round(est * (0.3 + 0.35 * diff))), hpMax: 0 };
  lvl.boss.hpMax = lvl.boss.hp;
  return lvl;
}
