// Run: node tests/sudoku.test.js
const assert = require('assert');
const E = require('../games/sudoku-engine.js');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

const full = () => E.generateSolution(E.mulberry32(42));

t('generated solution is valid', () => {
  assert.strictEqual(E.validate(full()).ok, true);
});
t('empty cells reported as missing, not ok', () => {
  const g = full(); g[0] = 0;
  const r = E.validate(g);
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(r.emptyCells, [0]);
  assert.ok(r.missing.length >= 3); // row, column, box
});
t('duplicate in a row/col/box is detected', () => {
  const g = full(); g[1] = g[0];
  const r = E.validate(g);
  assert.strictEqual(r.ok, false);
  assert.ok(r.conflictCells.includes(0) && r.conflictCells.includes(1));
  assert.ok(r.duplicates.some(d => d.kind === 'row' && d.index === 1));
  assert.ok(r.duplicates.some(d => d.kind === 'box' && d.index === 1));
  assert.ok(r.missing.length > 0);
});
t('counting solver: empty grid has many, full grid has 1', () => {
  assert.strictEqual(E.countSolutions(new Array(81).fill(0), 2), 2);
  assert.strictEqual(E.countSolutions(full(), 2), 1);
});
t('contradictory givens -> 0 solutions', () => {
  const g = new Array(81).fill(0); g[0] = 5; g[1] = 5;
  assert.strictEqual(E.countSolutions(g, 2), 0);
});
let prev = 82;
for (let lv = 1; lv <= E.LEVELS; lv++) {
  t('level ' + lv + ': unique solution, consistent, getting harder', () => {
    const p = E.makePuzzle(lv);
    assert.strictEqual(E.validate(p.solution).ok, true);
    assert.strictEqual(E.countSolutions(p.puzzle, 2), 1);
    p.puzzle.forEach((v, i) => { if (v) assert.strictEqual(v, p.solution[i]); });
    assert.strictEqual(p.puzzle.filter(Boolean).length, p.givens);
    assert.ok(p.givens <= E.GIVENS[lv - 1] + 2, 'givens ' + p.givens);
    assert.ok(p.givens <= prev, 'not harder than previous'); prev = p.givens;
  });
}
t('puzzles are deterministic and unique per level', () => {
  assert.deepStrictEqual(E.makePuzzle(3).puzzle, E.makePuzzle(3).puzzle);
  const seen = new Set();
  for (let lv = 1; lv <= 10; lv++) seen.add(E.makePuzzle(lv).puzzle.join(''));
  assert.strictEqual(seen.size, 10);
});
t('hint fills a correct number into an empty cell; never a given', () => {
  const p = E.makePuzzle(5), g = p.puzzle.slice(), given = p.puzzle.map(Boolean);
  const h = E.pickHint(g, p.solution, given, E.mulberry32(1));
  assert.ok(!given[h.index] && g[h.index] === 0 && h.value === p.solution[h.index]);
});
t('hint corrects a wrong cell when nothing is empty; null when solved', () => {
  const p = E.makePuzzle(2), given = p.puzzle.map(Boolean), g = p.solution.slice();
  assert.strictEqual(E.pickHint(g, p.solution, given), null);
  const i = given.indexOf(false); g[i] = (g[i] % 9) + 1;
  assert.strictEqual(E.pickHint(g, p.solution, given).index, i);
});
t('solving a puzzle with its solution validates', () => {
  assert.strictEqual(E.validate(E.makePuzzle(10).solution).ok, true);
});
t('formatTime', () => {
  assert.strictEqual(E.formatTime(0), '0:00');
  assert.strictEqual(E.formatTime(65), '1:05');
  assert.strictEqual(E.formatTime(3725), '1:02:05');
});
t('invalid level throws', () => assert.throws(() => E.makePuzzle(11), RangeError));
console.log('\n' + n + ' tests passed');
