// Run: node tests/cardclash.test.js
const assert = require('assert');
const D = require('../games/cardclash-data.js');
const E = require('../games/cardclash-engine.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const P = c => Array.from({ length: c }, (_, i) => ({ id: 'p' + i, name: 'P' + i, bot: i > 0 }));
const total = g => g.players.reduce((s, p) => s + p.hand.length, 0) + g.pot.length;
const deck = D.DECKS.cricket;
const mkDeck = (vals) => ({ id: 'f', attrs: [{ key: 'v' }], max: { v: 100 }, cards: Object.keys(vals).map(id => ({ id, stats: { v: vals[id] } })) });

t('every deck has 24 unique cards and complete stats', () => {
  D.DECK_IDS.forEach(id => {
    const d = D.DECKS[id];
    assert.strictEqual(d.cards.length, 24);
    assert.strictEqual(new Set(d.cards.map(c => c.name)).size, 24);
    d.cards.forEach(c => d.attrs.forEach(a => assert.ok(Number.isFinite(c.stats[a.key]), c.name + ' ' + a.key)));
  });
});
[2, 3, 4].forEach(k => t('deal to ' + k + ' players splits the full deck evenly', () => {
  const g = E.createGame(deck, P(k), E.mulberry32(1));
  assert.strictEqual(total(g), 24);
  g.players.forEach(p => assert.strictEqual(p.hand.length, 24 / k));
  assert.strictEqual(new Set(g.players.flatMap(p => p.hand)).size, 24);
}));
t('rejects 1 or 5 players and duplicate ids', () => {
  assert.throws(() => E.createGame(deck, P(1)), RangeError);
  assert.throws(() => E.createGame(deck, P(5)), RangeError);
  assert.throws(() => E.createGame(deck, [{ id: 'a', name: 'a' }, { id: 'a', name: 'b' }]));
});
t('teller loses -> listener wins the cards and becomes teller', () => {
  const g = E.createGame(deck, P(2), E.mulberry32(1));
  const [x, y] = g.players;
  const sach = deck.cards.find(c => c.name === 'Sachin Tendulkar').id, brad = deck.cards.find(c => c.name === 'Don Bradman').id;
  x.hand = [brad, ...x.hand.filter(c => c !== brad && c !== sach)];
  y.hand = [sach, ...y.hand.filter(c => c !== sach && c !== brad)];
  g.tellerId = x.id;
  const before = [x.hand.length, y.hand.length];
  const r = E.choose(g, deck, x.id, 'matches'); // Bradman 52 vs Sachin 664
  assert.strictEqual(r.winnerId, y.id); assert.strictEqual(g.tellerId, y.id);
  assert.strictEqual(y.hand.length, before[1] + 1); assert.strictEqual(x.hand.length, before[0] - 1);
  assert.strictEqual(y.hand[y.hand.length - 1] === sach || y.hand.includes(sach), true);
  assert.strictEqual(total(g), 24);
});
t('teller wins -> keeps the turn', () => {
  const g = E.createGame(mkDeck({ a: 9, b: 1, c: 2, d: 3 }), P(2), E.mulberry32(1));
  const d = mkDeck({ a: 9, b: 1, c: 2, d: 3 });
  const [x, y] = g.players; x.hand = ['a', 'c']; y.hand = ['b', 'd']; g.tellerId = x.id;
  const r = E.choose(g, d, x.id, 'v'); assert.strictEqual(r.winnerId, x.id); assert.strictEqual(g.tellerId, x.id);
});
t('3 players: highest takes cards from both others', () => {
  const d = mkDeck({ a: 1, b: 9, c: 5, a2: 0, b2: 0, c2: 0 });
  const g = E.createGame(deck, P(3), E.mulberry32(2));
  const [a, b, c] = g.players; a.hand = ['a', 'a2']; b.hand = ['b', 'b2']; c.hand = ['c', 'c2']; g.pot = []; g.tellerId = a.id;
  const r = E.choose(g, d, a.id, 'v');
  assert.strictEqual(r.winnerId, b.id); assert.strictEqual(r.moved, 3);
  assert.strictEqual(b.hand.length, 4); assert.strictEqual(a.hand.length, 1); assert.strictEqual(c.hand.length, 1);
});
t('tie sends cards to pot, teller repeats, next winner takes the pot', () => {
  const d = mkDeck({ c1: 5, c2: 5, c3: 9, c4: 1 });
  const g = E.createGame(deck, P(2), E.mulberry32(3));
  const [a, b] = g.players; g.tellerId = a.id; a.hand = ['c1', 'c3']; b.hand = ['c2', 'c4']; g.pot = [];
  let r = E.choose(g, d, a.id, 'v'); assert.ok(r.tie); assert.strictEqual(g.pot.length, 2); assert.strictEqual(g.tellerId, a.id);
  r = E.choose(g, d, a.id, 'v');
  assert.strictEqual(r.winnerId, a.id); assert.strictEqual(r.potWon, 2); assert.strictEqual(a.hand.length, 4);
  assert.ok(g.over && g.winnerId === a.id && b.out);
});
t('only the teller may choose; bad attribute rejected', () => {
  const g = E.createGame(deck, P(2), E.mulberry32(1));
  const other = g.players.find(p => p.id !== g.tellerId).id;
  assert.throws(() => E.choose(g, deck, other, 'runs'), /turn/);
  assert.throws(() => E.choose(g, deck, g.tellerId, 'nope'), /attribute/);
});
t('power play: every loser pays an extra card; usable once', () => {
  const vals = { c0: 100 }; for (let i = 1; i < 12; i++) vals['c' + i] = i;
  const d = mkDeck(vals), g = E.createGame(deck, P(3), E.mulberry32(4));
  const [a, b, c] = g.players; g.tellerId = a.id; g.pot = [];
  a.hand = ['c0', 'c1', 'c2', 'c3']; b.hand = ['c4', 'c5', 'c6', 'c7']; c.hand = ['c8', 'c9', 'c10', 'c11'];
  const r = E.choose(g, d, a.id, 'v', true);
  assert.strictEqual(r.winnerId, a.id); assert.strictEqual(r.moved, 5);
  assert.strictEqual(a.hand.length, 3 + 5); assert.strictEqual(b.hand.length, 2); assert.strictEqual(c.hand.length, 2);
  assert.ok(a.powerUsed);
  const r2 = E.choose(g, d, a.id, 'v', true); assert.strictEqual(r2.double, false);
});
t('power play backfires: failed teller pays two cards total', () => {
  const vals = { c5: 100 }; [0, 1, 2, 3, 6, 7, 8].forEach(i => vals['c' + i] = i);
  const d = mkDeck(vals), g = E.createGame(deck, P(2), E.mulberry32(4));
  const [a, b] = g.players; g.tellerId = a.id; g.pot = [];
  a.hand = ['c0', 'c1', 'c2', 'c3']; b.hand = ['c5', 'c6', 'c7', 'c8'];
  const r = E.choose(g, d, a.id, 'v', true);
  assert.strictEqual(r.winnerId, b.id); assert.strictEqual(a.hand.length, 1); assert.strictEqual(b.hand.length, 3 + 2 + 2);
  assert.strictEqual(g.tellerId, b.id);
});
t('players with no cards are eliminated; last one standing wins', () => {
  const d = mkDeck({ a: 9, b: 1, c: 2, dd: 3, e: 4 });
  const g = E.createGame(deck, P(3), E.mulberry32(8));
  const [x, y, z] = g.players; g.tellerId = x.id; g.pot = [];
  x.hand = ['a', 'dd']; y.hand = ['b']; z.hand = ['c', 'e'];
  const r = E.choose(g, d, x.id, 'v');
  assert.deepStrictEqual(r.eliminated, [y.id]); assert.ok(y.out); assert.ok(!g.over);
  assert.strictEqual(E.viewFor(g, d, y.id).myTop, null);
  x.hand = ['a', 'dd']; z.hand = ['c'];
  const r2 = E.choose(g, d, x.id, 'v');
  assert.ok(g.over && g.winnerId === x.id && r2.gameOver);
  assert.throws(() => E.choose(g, d, x.id, 'v'), /over/);
});
t("viewFor never leaks other players' cards", () => {
  const g = E.createGame(deck, P(4), E.mulberry32(9));
  const v = E.viewFor(g, deck, 'p1'), s = JSON.stringify(v);
  assert.strictEqual(v.myTop, g.players[1].hand[0]);
  g.players.forEach((p, i) => { if (i !== 1) p.hand.forEach(cid => assert.ok(!s.includes('"' + cid + '"'), 'leaked ' + cid)); });
});
t('leaving player cards are redistributed; card count preserved', () => {
  const g = E.createGame(deck, P(4), E.mulberry32(10));
  E.removePlayer(g, g.tellerId);
  assert.strictEqual(total(g), 24); assert.strictEqual(E.alive(g).length, 3); assert.ok(!E.player(g, g.tellerId).out);
  E.removePlayer(g, E.alive(g)[0].id); E.removePlayer(g, E.alive(g)[0].id);
  assert.ok(g.over); assert.strictEqual(E.alive(g)[0].hand.length, 24);
});
t('bot autoPick selects the strongest attribute of its card', () => {
  const g = E.createGame(deck, P(2), E.mulberry32(12));
  const c = E.topCard(g, deck, g.tellerId);
  const pick = E.autoPick(g, deck, g.tellerId, () => 0);
  const best = deck.attrs.map(a => c.stats[a.key] / deck.max[a.key]);
  assert.strictEqual(pick.attr, deck.attrs[best.indexOf(Math.max(...best))].key);
});
D.DECK_IDS.forEach(id => [2, 3, 4].forEach(k => t('full bot simulation ends, cards conserved: ' + id + ' x' + k, () => {
  const d = D.DECKS[id];
  for (let s = 1; s <= 25; s++) {
    const rng = E.mulberry32(s * 77 + k), g = E.createGame(d, P(k), rng);
    let guard = 0;
    while (!g.over && guard++ < 1000) {
      const pick = E.autoPick(g, d, g.tellerId, rng);
      E.choose(g, d, g.tellerId, pick.attr, pick.double);
      assert.strictEqual(total(g), 24);
    }
    assert.ok(g.over, 'ended'); assert.ok(g.winnerId);
  }
})));
console.log('\n' + n + ' tests passed');
