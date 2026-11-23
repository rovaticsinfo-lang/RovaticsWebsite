/* Finds a layout for PARALLAX level 3 (The Energy Core): three emitters on the west wall, three mirrors, three receivers on the rim.
 * Rule: exactly ONE of the 8^3 mirror arrangements sends every beam into the receiver with its own symbol, the start is not it,
 * every mirror is needed, and the beams really interact (at least five mirror hits in the solution).
 * Run:  node tests/tools/gen-parallax-core.js   -> prints the JSON to paste into games/parallax-engine.js (marker /*CORE_LAYOUT*\/) */
const E = require('../../games/parallax-engine.js');
const seedArg = +(process.argv[2] || 1); let s = seedArg >>> 0; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
const SY = ['moon', 'sun', 'star'], LAT = [-18, -9, 0, 9, 18], EZ = [-18, 0, 18], HL = 1.7, RIM = 31;
const dirs = []; for (let i = 0; i < 8; i++) dirs.push([Math.round(Math.cos(i * Math.PI / 4) * 1000) / 1000, Math.round(Math.sin(i * Math.PI / 4) * 1000) / 1000]);
function attempt() {
  const used = new Set(), mirrors = [];
  while (mirrors.length < 3) {
    const x = LAT[(rnd() * 5) | 0], z = LAT[(rnd() * 5) | 0], key = x + ',' + z; if (used.has(key) || (Math.abs(x) <= 9 && Math.abs(z) <= 9)) continue;   // keep the centre free for the core
    used.add(key); mirrors.push({ id: 'm' + mirrors.length, x, z, k: 0, hl: HL });
  }
  const em = EZ.map((z, i) => ({ x: -34, z, dx: 1, dz: 0, sym: SY[i] }));
  const target = mirrors.map(() => (rnd() * 8) | 0); const tm = mirrors.map((m, i) => Object.assign({}, m, { k: target[i] }));
  const tr = em.map(e => E.trace(e, tm, [])); if (tr.some(t => t.bounced.length < 1)) return null;
  const hits = tr.reduce((a, t) => a + t.bounced.length, 0); if (hits < 5) return null;
  const used3 = new Set(); tr.forEach(t => t.bounced.forEach(id => used3.add(id))); if (used3.size < 3) return null;
  // receivers: where each solved beam meets the rim of the chamber
  const rc = []; for (let i = 0; i < 3; i++) {
    const seg = tr[i].segs[tr[i].segs.length - 1], dx = seg.x1 - seg.x0, dz = seg.z1 - seg.z0, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    const b = seg.x0 * ux + seg.z0 * uz, c = seg.x0 * seg.x0 + seg.z0 * seg.z0 - RIM * RIM, disc = b * b - c; if (disc < 0) return null; const t = -b + Math.sqrt(disc);
    if (t < 4) return null; rc.push({ id: 'r' + i, x: Math.round((seg.x0 + ux * t) * 10) / 10, z: Math.round((seg.z0 + uz * t) * 10) / 10, r: 1.6, sym: SY[i] });
  }
  for (const q of rc) for (const e of em) if (Math.hypot(q.x - e.x, q.z - e.z) < 16) return null;                // a receiver never sits beside an emitter
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (Math.hypot(rc[i].x - rc[j].x, rc[i].z - rc[j].z) < 12) return null;
  // beams must not hit a receiver they should not before the real one in the solution
  const check = k => { const m2 = mirrors.map((m, i) => Object.assign({}, m, { k: k[i] })); const t = em.map(e => E.trace(e, m2, rc)); return t.every((b, i) => b.hit === 'r' + i); };
  if (!check(target)) return null;
  const sols = []; for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) for (let c = 0; c < 8; c++) if (check([a, b, c])) sols.push([a, b, c]);
  if (sols.length !== 1) return null;
  let start; do { start = mirrors.map(() => (rnd() * 8) | 0); } while (start.some((k, i) => k === target[i]) );          // every mirror starts wrong
  // a start that lights a wrong receiver teaches the symbol rule: prefer one
  const sm = mirrors.map((m, i) => Object.assign({}, m, { k: start[i] })), st = em.map(e => E.trace(e, sm, rc));
  return { emitters: em.map((e, i) => ({ id: 'e' + i, x: e.x, z: e.z, dx: 1, dz: 0, sym: e.sym })), mirrors: mirrors.map((m, i) => ({ id: m.id, x: m.x, z: m.z, start: start[i], solve: target[i] })), receivers: rc, hits, startHits: st.map(t => t.hit) };
}
let r = null, tries = 0; while (!r && tries < 200000) { r = attempt(); tries++; }
if (!r) { console.error('no layout found in', tries); process.exit(1); }
console.error('found after', tries, 'tries; mirror hits in the solution:', r.hits, 'start hits:', r.startHits.join());
delete r.hits; delete r.startHits; console.log(JSON.stringify(r));
