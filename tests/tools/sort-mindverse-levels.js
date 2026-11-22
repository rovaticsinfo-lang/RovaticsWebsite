/* Orders the generated rooms inside each world by proven hardness so difficulty rises on every level.
 * Run after gen-mindverse-levels.js:  node tests/tools/sort-mindverse-levels.js */
const fs = require('fs'), path = require('path');
const E = require('../../games/mindverse-engine.js'), LD = require('../../games/mindverse-levels.js');
const file = path.join(__dirname, '../../games/mindverse-levels-extra.js'); const src = fs.readFileSync(file, 'utf8');
const a = src.indexOf('return [') + 8, b = src.lastIndexOf('];'); const levels = JSON.parse('[' + src.slice(a, b) + ']');
levels.forEach(l => { l.__h = E.verifyLevel(l).hardness; });
const out = [];
for (const w of LD.WORLDS) {
  const grp = levels.filter(l => l.n >= w.from && l.n <= w.to); if (!grp.length) continue;
  const slots = grp.map(l => l.n).sort((x, y) => x - y), pre = w.id.split('_').map(x => x[0]).join('');
  grp.sort((x, y) => x.__h - y.__h);
  const set = l => l.stages.map(s => s.kind).sort().join();
  for (let i = 1; i < grp.length - 1; i++) if (set(grp[i]) === set(grp[i - 1]) && Math.abs(grp[i].__h - grp[i + 1].__h) <= 0.5 && set(grp[i + 1]) !== set(grp[i - 1]) && set(grp[i]) !== (grp[i + 2] ? set(grp[i + 2]) : '')) { const x = grp[i]; grp[i] = grp[i + 1]; grp[i + 1] = x; }
  grp.forEach((l, i) => { l.n = slots[i]; l.levelId = pre + '_L' + l.n; out.push(l); });
}
out.sort((x, y) => x.n - y.n).forEach(l => delete l.__h);
fs.writeFileSync(file, src.slice(0, a) + out.map(l => JSON.stringify(l)).join(',\n') + src.slice(b));
console.log('sorted', out.length, 'levels');
