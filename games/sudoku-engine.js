/* Sudoku engine: puzzle generation, uniqueness solver, validation, hints.
   Works in the browser (window.SudokuEngine) and Node (module.exports). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SudokuEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LEVELS = 10;
  // Number of pre-filled cells per level: fewer givens = harder.
  var GIVENS = [44, 40, 37, 34, 32, 30, 29, 28, 27, 26];
  var LEVEL_NAMES = ['Warm-up', 'Easy', 'Gentle', 'Steady', 'Tricky', 'Challenging', 'Hard', 'Expert', 'Master', 'Legend'];

  // Seeded PRNG so a challenge link reproduces the identical puzzle.
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // Valid full grid from the base pattern, then shuffled digits/rows/cols/bands.
  function generateSolution(rng) {
    var digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
    var bands = shuffle([0, 1, 2], rng);
    var stacks = shuffle([0, 1, 2], rng);
    var rows = [], cols = [];
    bands.forEach(function (b) { shuffle([0, 1, 2], rng).forEach(function (r) { rows.push(b * 3 + r); }); });
    stacks.forEach(function (s) { shuffle([0, 1, 2], rng).forEach(function (c) { cols.push(s * 3 + c); }); });
    var grid = new Array(81);
    for (var r = 0; r < 9; r++) {
      for (var c = 0; c < 9; c++) {
        var pr = rows[r], pc = cols[c];
        var v = (3 * (pr % 3) + Math.floor(pr / 3) + pc) % 9;
        grid[r * 9 + c] = digits[v];
      }
    }
    return grid;
  }

  // Count solutions (stops at `limit`) using bitmasks + fewest-candidates heuristic.
  function countSolutions(puzzle, limit) {
    limit = limit || 2;
    var g = puzzle.slice();
    var rowM = new Array(9).fill(0), colM = new Array(9).fill(0), boxM = new Array(9).fill(0);
    for (var i = 0; i < 81; i++) {
      if (g[i]) {
        var bit = 1 << g[i], r = (i / 9) | 0, c = i % 9, b = ((r / 3) | 0) * 3 + ((c / 3) | 0);
        if ((rowM[r] | colM[c] | boxM[b]) & bit) return 0; // contradictory givens
        rowM[r] |= bit; colM[c] |= bit; boxM[b] |= bit;
      }
    }
    var count = 0;
    function pop(m) { var n = 0; while (m) { m &= m - 1; n++; } return n; }
    function rec() {
      var best = -1, bestMask = 0, bestN = 10;
      for (var i = 0; i < 81; i++) {
        if (g[i]) continue;
        var r = (i / 9) | 0, c = i % 9, b = ((r / 3) | 0) * 3 + ((c / 3) | 0);
        var mask = ~(rowM[r] | colM[c] | boxM[b]) & 0x3FE;
        var n = pop(mask);
        if (n === 0) return;
        if (n < bestN) { bestN = n; best = i; bestMask = mask; if (n === 1) break; }
      }
      if (best === -1) { count++; return; }
      var br = (best / 9) | 0, bc = best % 9, bb = ((br / 3) | 0) * 3 + ((bc / 3) | 0);
      for (var d = 1; d <= 9 && count < limit; d++) {
        var bit = 1 << d;
        if (!(bestMask & bit)) continue;
        g[best] = d; rowM[br] |= bit; colM[bc] |= bit; boxM[bb] |= bit;
        rec();
        g[best] = 0; rowM[br] &= ~bit; colM[bc] &= ~bit; boxM[bb] &= ~bit;
      }
    }
    rec();
    return count;
  }

  function levelSeed(level, variant) { return (level * 104729 + (variant || 0) * 7919 + 12345) >>> 0; }

  // Build a puzzle with a unique solution. Same (level, variant) => same puzzle.
  function makePuzzle(level, variant) {
    if (level < 1 || level > LEVELS) throw new RangeError('level must be 1..' + LEVELS);
    var rng = mulberry32(levelSeed(level, variant));
    var solution = generateSolution(rng);
    var puzzle = solution.slice();
    var target = GIVENS[level - 1];
    var order = shuffle(Array.from({ length: 81 }, function (_, i) { return i; }), rng);
    var givens = 81;
    for (var k = 0; k < order.length && givens > target; k++) {
      var idx = order[k], keep = puzzle[idx];
      puzzle[idx] = 0;
      if (countSolutions(puzzle, 2) !== 1) puzzle[idx] = keep; else givens--;
    }
    return { level: level, variant: variant || 0, puzzle: puzzle, solution: solution, givens: givens };
  }

  // Validate a grid. Intended to be called ONLY on submit.
  // Every row/column/box must hold each of 1-9 exactly once.
  function validate(grid) {
    var res = { ok: true, duplicates: [], missing: [], conflictCells: [], emptyCells: [] };
    var bad = {};
    function unit(kind, index, cells) {
      var seen = {}, dupVals = {};
      cells.forEach(function (ci) {
        var v = grid[ci];
        if (!v) return;
        (seen[v] = seen[v] || []).push(ci);
      });
      var missing = [];
      for (var d = 1; d <= 9; d++) {
        if (!seen[d]) missing.push(d);
        else if (seen[d].length > 1) {
          dupVals[d] = true;
          seen[d].forEach(function (ci) { bad[ci] = true; });
        }
      }
      var dups = Object.keys(dupVals).map(Number);
      if (dups.length) res.duplicates.push({ kind: kind, index: index, values: dups });
      if (missing.length) res.missing.push({ kind: kind, index: index, values: missing });
    }
    for (var i = 0; i < 9; i++) {
      var row = [], col = [], box = [];
      for (var j = 0; j < 9; j++) {
        row.push(i * 9 + j);
        col.push(j * 9 + i);
        box.push((Math.floor(i / 3) * 3 + Math.floor(j / 3)) * 9 + (i % 3) * 3 + (j % 3));
      }
      unit('row', i + 1, row); unit('column', i + 1, col); unit('box', i + 1, box);
    }
    for (var c = 0; c < 81; c++) {
      if (!grid[c]) res.emptyCells.push(c);
      if (bad[c]) res.conflictCells.push(c);
    }
    res.ok = !res.duplicates.length && !res.missing.length && !res.emptyCells.length;
    return res;
  }

  // Pick a cell for a clue: prefer a wrong cell, else an empty one. Returns {index,value} or null.
  function pickHint(grid, solution, given, rng) {
    rng = rng || Math.random;
    var wrong = [], empty = [];
    for (var i = 0; i < 81; i++) {
      if (given[i]) continue;
      if (!grid[i]) empty.push(i);
      else if (grid[i] !== solution[i]) wrong.push(i);
    }
    var pool = empty.length ? empty : wrong;
    if (!pool.length) return null;
    var idx = pool[Math.floor(rng() * pool.length)];
    return { index: idx, value: solution[idx] };
  }

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var mm = (h ? String(m).padStart(2, '0') : String(m)), ss = String(s).padStart(2, '0');
    return (h ? h + ':' : '') + mm + ':' + ss;
  }

  return {
    LEVELS: LEVELS, GIVENS: GIVENS, LEVEL_NAMES: LEVEL_NAMES,
    mulberry32: mulberry32, generateSolution: generateSolution, countSolutions: countSolutions,
    makePuzzle: makePuzzle, validate: validate, pickHint: pickHint, formatTime: formatTime
  };
});
