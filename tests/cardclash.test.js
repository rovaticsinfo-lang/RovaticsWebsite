// Run: node tests/cardclash.test.js
const assert = require('assert');
const fs = require('fs');
const D = require('../games/cardclash-data.js');
const E = require('../games/cardclash-engine.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const P = c => Array.from({ length: c }, (_, i) => ({ id: 'p' + i, name: 'P' + i, bot: i > 0 }));
const total = g => g.players.reduce((s, p) => s + p.hand.length, 0) + g.pot.length;
const deck = D.DECKS.cricket;
const mkDeck = (vals) => ({ id: 'f', attrs: [{ key: 'v' }], max: { v: 100 }, cards: Object.keys(vals).map(id => ({ id, stats: { v: vals[id] } })) });

// ---------- decks ----------
t('three large decks: 240 / 240 / 200 unique cards', () => {
  assert.deepStrictEqual(D.DECK_IDS.map(id => D.DECKS[id].cards.length), [240, 240, 200]);
  D.DECK_IDS.forEach(id => { const d = D.DECKS[id]; assert.strictEqual(new Set(d.cards.map(c => c.name)).size, d.cards.length, id + ' names unique'); assert.strictEqual(new Set(d.cards.map(c => c.id)).size, d.cards.length); });
});
t('every card has a complete, finite, non-negative stat line, a role/place line and an emoji', () => {
  D.DECK_IDS.forEach(id => { const d = D.DECKS[id]; d.cards.forEach(c => {
    d.attrs.forEach(a => { assert.ok(Number.isFinite(c.stats[a.key]) && c.stats[a.key] >= 0, c.name + ' ' + a.key); });
    assert.ok(c.sub && c.sub.length > 2 && c.emoji && c.name.length > 3, c.name);
  }); });
});
t('decks are built deterministically (same on every device)', () => {
  delete require.cache[require.resolve('../games/cardclash-data.js')];
  const D2 = require('../games/cardclash-data.js');
  D.DECK_IDS.forEach(id => assert.strictEqual(JSON.stringify(D2.DECKS[id].cards), JSON.stringify(D.DECKS[id].cards)));
});
t('decks keep 6-7 attributes each, and stats vary enough that picking matters', () => {
  assert.strictEqual(D.DECKS.cricket.attrs.length, 6); assert.strictEqual(D.DECKS.wwe.attrs.length, 7); assert.strictEqual(D.DECKS.robots.attrs.length, 7);
  D.DECK_IDS.forEach(id => { const d = D.DECKS[id]; d.attrs.forEach(a => { const vals = d.cards.map(c => c.stats[a.key]); assert.ok(new Set(vals).size > 30, id + '.' + a.key + ' has ' + new Set(vals).size + ' distinct values'); }); });
});
t('cricket roles behave: bowlers take wickets, batters score runs and centuries', () => {
  const by = r => deck.cards.filter(c => c.sub.startsWith(r)), avg = (arr, k) => arr.reduce((s, c) => s + c.stats[k], 0) / arr.length;
  assert.ok(avg(by('Fast Bowler'), 'wickets') > avg(by('Top-order Batter'), 'wickets') * 10);
  assert.ok(avg(by('Top-order Batter'), 'runs') > avg(by('Fast Bowler'), 'runs') * 3);
  assert.ok(avg(by('Top-order Batter'), 'hundreds') > avg(by('Spin Bowler'), 'hundreds') * 5);
});
t('wrestling archetypes behave: giants are strong and slow, high-flyers fast', () => {
  const by = r => D.DECKS.wwe.cards.filter(c => c.sub.startsWith(r)), avg = (arr, k) => arr.reduce((s, c) => s + c.stats[k], 0) / arr.length;
  assert.ok(avg(by('Giant'), 'strength') > avg(by('High-Flyer'), 'strength') + 20); assert.ok(avg(by('High-Flyer'), 'speed') > avg(by('Giant'), 'speed') + 30);
});

// ---------- compliance: no real names, no real-world data ----------
t('no real full names appear in any deck (hand-checked list of famous names)', () => {
  const REAL = ['Sachin Tendulkar', 'Virat Kohli', 'MS Dhoni', 'Ricky Ponting', 'Jacques Kallis', 'Kumar Sangakkara', 'Rahul Dravid', 'Brian Lara', 'Shane Warne', 'Muttiah Muralitharan',
    'Wasim Akram', 'Glenn McGrath', 'James Anderson', 'Anil Kumble', 'Kapil Dev', 'Don Bradman', 'Rohit Sharma', 'Joe Root', 'Ben Stokes', 'Jasprit Bumrah', 'Steve Smith', 'Babar Azam',
    'John Cena', 'The Undertaker', 'Roman Reigns', 'Brock Lesnar', 'The Rock', 'Stone Cold Steve Austin', 'Triple H', 'Randy Orton', 'Batista', 'Shawn Michaels', 'Bret Hart', 'Hulk Hogan',
    'Ric Flair', 'Rey Mysterio', 'CM Punk', 'Seth Rollins', 'Becky Lynch', 'Charlotte Flair', 'AJ Styles', 'Big Show', 'Mark Henry', 'Kofi Kingston', 'WWE'];
  const all = D.DECK_IDS.flatMap(id => D.DECKS[id].cards.map(c => c.name.toLowerCase()));
  REAL.forEach(r => assert.ok(!all.includes(r.toLowerCase()), 'real name present: ' + r));
  const src = fs.readFileSync(__dirname + '/../games/cardclash-data.js', 'utf8') + fs.readFileSync(__dirname + '/../games/cardclash.html', 'utf8');
  assert.ok(!/\bWWE\b/.test(src), 'no WWE trademark anywhere in the game files');
});
t('all cards say they are fictional and the data file documents the nods', () => {
  const src = fs.readFileSync(__dirname + '/../games/cardclash-data.js', 'utf8');
  assert.ok(/FICTIONAL/.test(src) && /INVENTED/.test(src));
  const html = fs.readFileSync(__dirname + '/../games/cardclash.html', 'utf8');
  assert.ok(/fictional and every statistic is invented/.test(html), 'the in-game rules carry the disclaimer');
  assert.ok(!/approximate career totals/.test(html), 'the old real-stats disclaimer is gone');
});

// ---------- no hints on the cards ----------
t('card rendering has no best-stat star, no value bar and no rarity frame', () => {
  const html = fs.readFileSync(__dirname + '/../games/cardclash.html', 'utf8');
  assert.ok(!/bestAttr/.test(html), 'bestAttr helper removed'); assert.ok(!/\.attr\.best/.test(html), 'star css removed');
  assert.ok(!/className.*'bar'|el\('div', 'bar'\)/.test(html), 'no bar element is built'); assert.ok(!/class=\"bar\"/.test(html));
  assert.ok(!/el\('div', 'tier'/.test(html), 'no rarity badge');
  assert.ok(/var c = el\('div', 'card tilt'\)/.test(html), 'all cards share one frame');
});

// ---------- dealing ----------
t('default deal splits the whole deck evenly', () => {
  const g = E.createGame(deck, P(4), E.mulberry32(1));
  assert.strictEqual(total(g), 240); g.players.forEach(p => assert.strictEqual(p.hand.length, 60));
});
[6, 8, 10, 12, 15, 20, 25, 30, 40, 50].forEach(per => [2, 3, 4].forEach(k => t('deal ' + per + ' cards each to ' + k + ' players (all three decks)', () => {
  D.DECK_IDS.forEach(id => {
    const g = E.createGame(D.DECKS[id], P(k), E.mulberry32(per * k), { perPlayer: per });
    assert.strictEqual(total(g), per * k); g.players.forEach(p => assert.strictEqual(p.hand.length, per));
    assert.strictEqual(new Set(g.players.flatMap(p => p.hand)).size, per * k, 'no card dealt twice');
  });
})));
t('50 each to 4 players works on every deck, and 51 is refused on the 200-card deck', () => {
  D.DECK_IDS.forEach(id => assert.doesNotThrow(() => E.createGame(D.DECKS[id], P(4), null, { perPlayer: 50 })));
  assert.throws(() => E.createGame(D.DECKS.robots, P(4), null, { perPlayer: 51 }), /deck too small/);
  assert.throws(() => E.createGame(deck, P(2), null, { perPlayer: 0 }), /at least 1/);
});
t('the dealt cards are a random subset: different seeds give different games from the big deck', () => {
  const a = E.createGame(deck, P(2), E.mulberry32(1), { perPlayer: 10 }), b = E.createGame(deck, P(2), E.mulberry32(2), { perPlayer: 10 });
  assert.notDeepStrictEqual(a.players[0].hand, b.players[0].hand);
  const shared = a.players[0].hand.filter(c => b.players[0].hand.includes(c)).length; assert.ok(shared < 5, 'little overlap: ' + shared);
});
t('rejects 1 or 5 players and duplicate ids', () => {
  assert.throws(() => E.createGame(deck, P(1)), RangeError); assert.throws(() => E.createGame(deck, P(5)), RangeError);
  assert.throws(() => E.createGame(deck, [{ id: 'a', name: 'a' }, { id: 'a', name: 'b' }]));
});

// ---------- the original rules still hold ----------
t('teller loses -> listener wins the cards and becomes teller', () => {
  const d = mkDeck({ a: 1, b: 9, c: 2, e: 3 }), g = E.createGame(deck, P(2), E.mulberry32(1), { perPlayer: 2 });
  const [x, y] = g.players; x.hand = ['a', 'c']; y.hand = ['b', 'e']; g.tellerId = x.id; g.pot = [];
  const r = E.choose(g, d, x.id, 'v'); assert.strictEqual(r.winnerId, y.id); assert.strictEqual(g.tellerId, y.id); assert.strictEqual(y.hand.length, 3);
});
t('teller wins -> keeps the turn', () => {
  const d = mkDeck({ a: 9, b: 1, c: 2, e: 3 }), g = E.createGame(deck, P(2), E.mulberry32(1), { perPlayer: 2 });
  const [x, y] = g.players; x.hand = ['a', 'c']; y.hand = ['b', 'e']; g.tellerId = x.id; g.pot = [];
  const r = E.choose(g, d, x.id, 'v'); assert.strictEqual(r.winnerId, x.id); assert.strictEqual(g.tellerId, x.id);
});
t('3 players: highest takes cards from both others', () => {
  const d = mkDeck({ a: 1, b: 9, c: 5, a2: 0, b2: 0, c2: 0 }), g = E.createGame(deck, P(3), E.mulberry32(2), { perPlayer: 2 });
  const [a, b, c] = g.players; a.hand = ['a', 'a2']; b.hand = ['b', 'b2']; c.hand = ['c', 'c2']; g.pot = []; g.tellerId = a.id;
  const r = E.choose(g, d, a.id, 'v'); assert.strictEqual(r.winnerId, b.id); assert.strictEqual(r.moved, 3); assert.strictEqual(b.hand.length, 4);
});
t('tie sends cards to pot; next winner takes it', () => {
  const d = mkDeck({ c1: 5, c2: 5, c3: 9, c4: 1 }), g = E.createGame(deck, P(2), E.mulberry32(3), { perPlayer: 2 });
  const [a, b] = g.players; g.tellerId = a.id; a.hand = ['c1', 'c3']; b.hand = ['c2', 'c4']; g.pot = [];
  let r = E.choose(g, d, a.id, 'v'); assert.ok(r.tie); assert.strictEqual(g.pot.length, 2);
  r = E.choose(g, d, a.id, 'v'); assert.strictEqual(r.winnerId, a.id); assert.strictEqual(r.potWon, 2); assert.ok(g.over && g.winnerId === a.id);
});
t('only the teller may choose; bad attribute rejected', () => {
  const g = E.createGame(deck, P(2), E.mulberry32(1), { perPlayer: 6 }), other = g.players.find(p => p.id !== g.tellerId).id;
  assert.throws(() => E.choose(g, deck, other, 'runs'), /turn/); assert.throws(() => E.choose(g, deck, g.tellerId, 'nope'), /attribute/);
});
t('power play: every loser pays an extra card; usable once; backfires on the teller', () => {
  const vals = { c0: 100 }; for (let i = 1; i < 12; i++) vals['c' + i] = i;
  const d = mkDeck(vals), g = E.createGame(deck, P(3), E.mulberry32(4), { perPlayer: 4 });
  const [a, b, c] = g.players; g.tellerId = a.id; g.pot = [];
  a.hand = ['c0', 'c1', 'c2', 'c3']; b.hand = ['c4', 'c5', 'c6', 'c7']; c.hand = ['c8', 'c9', 'c10', 'c11'];
  const r = E.choose(g, d, a.id, 'v', true); assert.strictEqual(r.moved, 5); assert.strictEqual(a.hand.length, 8); assert.strictEqual(E.choose(g, d, a.id, 'v', true).double, false);
  const v2 = { c5: 100 }; [0, 1, 2, 3, 6, 7, 8].forEach(i => v2['c' + i] = i);
  const d2 = mkDeck(v2), g2 = E.createGame(deck, P(2), E.mulberry32(4), { perPlayer: 4 }), [p, q] = g2.players;
  g2.tellerId = p.id; g2.pot = []; p.hand = ['c0', 'c1', 'c2', 'c3']; q.hand = ['c5', 'c6', 'c7', 'c8'];
  E.choose(g2, d2, p.id, 'v', true); assert.strictEqual(p.hand.length, 1); assert.strictEqual(q.hand.length, 7);
});
t("viewFor never leaks other players' cards, and carries the match settings", () => {
  const g = E.createGame(deck, P(4), E.mulberry32(9), { perPlayer: 20, roundLimit: 100 }), v = E.viewFor(g, deck, 'p1'), s = JSON.stringify(v);
  assert.strictEqual(v.myTop, g.players[1].hand[0]); assert.strictEqual(v.perPlayer, 20); assert.strictEqual(v.totalCards, 80); assert.strictEqual(v.roundLimit, 100);
  g.players.forEach((p, i) => { if (i !== 1) p.hand.forEach(cid => assert.ok(!s.includes('"' + cid + '"'), 'leaked ' + cid)); });
});
t('leaving player cards are redistributed; card count preserved', () => {
  const g = E.createGame(deck, P(4), E.mulberry32(10), { perPlayer: 12 }); E.removePlayer(g, g.tellerId);
  assert.strictEqual(total(g), 48); assert.strictEqual(E.alive(g).length, 3); assert.ok(!E.player(g, g.tellerId).out);
});
t('bot autoPick selects the strongest attribute of its card', () => {
  const g = E.createGame(deck, P(2), E.mulberry32(12), { perPlayer: 6 }), c = E.topCard(g, deck, g.tellerId);
  const best = deck.attrs.map(a => c.stats[a.key] / deck.max[a.key]);
  assert.strictEqual(E.autoPick(g, deck, g.tellerId, () => 0).attr, deck.attrs[best.indexOf(Math.max(...best))].key);
});

// ---------- match length (needed so 50-card games can finish) ----------
const play = (d, k, per, limit, seed) => {
  const rng = E.mulberry32(seed), g = E.createGame(d, P(k), rng, { perPlayer: per, roundLimit: limit }); let r = 0;
  while (!g.over && r < 5000) { const pk = E.autoPick(g, d, g.tellerId, rng); E.choose(g, d, g.tellerId, pk.attr, pk.double); r++; assert.strictEqual(total(g), per * k, 'cards conserved'); }
  return { g, r };
};
t('a round limit ends the match and the player with the most cards wins', () => {
  const { g, r } = play(deck, 4, 20, 40, 3);
  assert.ok(g.over); assert.ok(r <= 40); const most = Math.max(...g.players.map(p => p.hand.length));
  g.winnerIds.forEach(id => assert.strictEqual(E.player(g, id).hand.length, most));
  if (g.endedBy === 'limit') assert.strictEqual(r, 40);
});
t('equal hands at the limit give several winners (a draw)', () => {
  const g = E.createGame(deck, P(2), E.mulberry32(1), { perPlayer: 3, roundLimit: 1 });
  const d = mkDeck({ a: 5, b: 5, c: 5, e: 5, f: 5, h: 5 }); g.players[0].hand = ['a', 'b', 'c']; g.players[1].hand = ['e', 'f', 'h']; g.pot = []; g.tellerId = g.players[0].id;
  E.choose(g, d, g.tellerId, 'v');
  assert.ok(g.over && g.endedBy === 'limit'); assert.strictEqual(g.winnerIds.length, 2);
});
t('without a limit a game still always ends (safety cap), and the cap is sane', () => {
  assert.ok(E.MAX_ROUNDS <= 600); const { g, r } = play(deck, 4, 50, 0, 7);
  assert.ok(g.over && r <= E.MAX_ROUNDS); assert.ok(['last', 'cap'].includes(g.endedBy));
});
t('standard match lengths make 50-card games finish in a sensible number of rounds', () => {
  [[2, 50], [3, 50], [4, 50]].forEach(([k, per]) => { const { g, r } = play(deck, k, per, per * 5, k * 11); assert.ok(g.over && r <= per * 5, k + 'x' + per + ' took ' + r); });
});
D.DECK_IDS.forEach(id => [2, 3, 4].forEach(k => t('full bot simulation ends, cards conserved: ' + id + ' x' + k, () => {
  for (let s = 1; s <= 8; s++) { const { g } = play(D.DECKS[id], k, 12, 60, s * 77 + k); assert.ok(g.over && g.winnerId); }
})));
console.log('\n' + n + ' tests passed');
