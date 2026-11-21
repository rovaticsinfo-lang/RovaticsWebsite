/* Card Clash engine: pure game rules (no DOM, no network). Browser: window.CardClashEngine, Node: module.exports.
   Rules
   - The whole deck is dealt round-robin to 2-4 players. You only ever see your TOP card.
   - The teller picks an attribute on their top card. Every player reveals their top card.
   - Highest value wins ALL revealed cards (plus any tie pot) and becomes the next teller.
   - A tie for highest: revealed cards go to a pot, same teller goes again, next winner takes the pot.
   - POWER PLAY (once per player per game): the teller doubles the stakes. Every loser pays one EXTRA card
     to the winner. If the teller doubles and fails to win, the teller pays one more on top.
   - A player with no cards is out. Last player standing wins. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CardClashEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MIN_PLAYERS = 2, MAX_PLAYERS = 4, MAX_ROUNDS = 600;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }

  // deck: object from CardClashData.DECKS; players: [{id,name,bot}].
  // opts.perPlayer: how many cards each player is dealt, drawn at random from the whole deck
  //   (default: the whole deck, split evenly). Larger decks than the hands dealt give every game a new mix.
  // opts.roundLimit: end the match after this many rounds and award it to whoever holds the most cards
  //   (0 / omitted = play until one player holds everything, with MAX_ROUNDS as a safety net).
  function createGame(deck, players, rng, opts) {
    rng = rng || Math.random; opts = opts || {};
    if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) throw new RangeError('2 to 4 players required');
    var ids = {}; players.forEach(function (p) { if (ids[p.id]) throw new Error('duplicate player id'); ids[p.id] = 1; });
    var per = opts.perPlayer == null ? Math.floor(deck.cards.length / players.length) : Math.floor(opts.perPlayer);
    if (!(per >= 1)) throw new RangeError('perPlayer must be at least 1');
    if (per * players.length > deck.cards.length) throw new RangeError('deck too small: ' + per + ' cards x ' + players.length + ' players');
    var cardIds = shuffle(deck.cards.map(function (c) { return c.id; }), rng).slice(0, per * players.length);
    var ps = players.map(function (p) { return { id: p.id, name: p.name, bot: !!p.bot, hand: [], powerUsed: false, streak: 0, out: false, left: false }; });
    cardIds.forEach(function (cid, i) { ps[i % ps.length].hand.push(cid); });
    return {
      deckId: deck.id, players: ps, tellerId: ps[Math.floor(rng() * ps.length)].id, perPlayer: per, totalCards: cardIds.length,
      roundLimit: Math.max(0, Math.floor(opts.roundLimit || 0)), endedBy: null, winnerIds: [],
      pot: [], round: 1, seq: 0, over: false, winnerId: null, lastResult: null, byId: null
    };
  }

  function alive(g) { return g.players.filter(function (p) { return !p.out; }); }
  function player(g, id) { for (var i = 0; i < g.players.length; i++) if (g.players[i].id === id) return g.players[i]; return null; }
  function cardOf(deck, id) { return deck.cards.filter(function (c) { return c.id === id; })[0]; }
  function topCard(g, deck, id) { var p = player(g, id); return p && p.hand.length ? cardOf(deck, p.hand[0]) : null; }

  // Play one round. Returns the result object (also stored in g.lastResult).
  function choose(g, deck, pid, attr, double) {
    if (g.over) throw new Error('game is over');
    if (pid !== g.tellerId) throw new Error('not your turn');
    if (!deck.attrs.some(function (a) { return a.key === attr; })) throw new Error('unknown attribute');
    var teller = player(g, pid);
    var dbl = !!double && !teller.powerUsed;
    if (dbl) teller.powerUsed = true;

    var act = alive(g);
    var plays = act.map(function (p) {
      var card = cardOf(deck, p.hand.shift());
      return { playerId: p.id, cardId: card.id, value: card.stats[attr] };
    });
    var best = Math.max.apply(null, plays.map(function (x) { return x.value; }));
    var top = plays.filter(function (x) { return x.value === best; });
    var res = { seq: ++g.seq, round: g.round, attr: attr, tellerId: pid, double: dbl, plays: plays, tie: false, winnerId: null,
                moved: 0, extra: [], eliminated: [], potBefore: g.pot.length, potWon: 0, gameOver: false };

    var playedIds = plays.map(function (x) { return x.cardId; });
    if (top.length > 1) {
      res.tie = true; g.pot = g.pot.concat(playedIds);
      act.forEach(function (p) { p.streak = 0; });
    } else {
      var win = player(g, top[0].playerId);
      res.winnerId = win.id;
      var gain = playedIds.concat(g.pot);
      res.potWon = g.pot.length; g.pot = [];
      if (dbl) {
        act.forEach(function (p) {
          if (p.id === win.id) return;
          var pay = 1 + (p.id === pid ? 1 : 0), taken = 0;
          while (pay-- > 0 && p.hand.length) { gain.push(p.hand.shift()); taken++; }
          if (taken) res.extra.push({ playerId: p.id, count: taken });
        });
      }
      win.hand = win.hand.concat(gain);
      res.moved = gain.length;
      act.forEach(function (p) { p.streak = p.id === win.id ? p.streak + 1 : 0; });
      g.tellerId = win.id;
    }
    // eliminations
    act.forEach(function (p) {
      if (!p.hand.length) { p.out = true; res.eliminated.push(p.id); }
    });
    finish(g, res);
    return res;
  }

  function finish(g, res) {
    var left = alive(g);
    g.round++;
    var hitLimit = g.roundLimit > 0 && g.round > g.roundLimit, hitCap = g.round > MAX_ROUNDS;
    if (left.length <= 1 || hitLimit || hitCap) {
      g.over = true;
      g.endedBy = left.length <= 1 ? 'last' : hitLimit ? 'limit' : 'cap';
      var most = left.reduce(function (m, p) { return Math.max(m, p.hand.length); }, 0);
      g.winnerIds = left.filter(function (p) { return p.hand.length === most; }).map(function (p) { return p.id; });
      g.winnerId = g.winnerIds.length ? g.winnerIds[0] : null;
      if (res) res.gameOver = true;
    } else if (player(g, g.tellerId).out) {
      g.tellerId = left[0].id;
    }
    if (!g.over && player(g, g.tellerId).out) g.tellerId = left[0].id;
    if (res) g.lastResult = res;
  }

  // A player leaves/disconnects: their cards are dealt to the remaining players.
  function removePlayer(g, pid) {
    var p = player(g, pid); if (!p || p.out) return;
    var rest = alive(g).filter(function (x) { return x.id !== pid; });
    p.out = true; p.left = true;
    var cards = p.hand.concat(g.pot); p.hand = []; g.pot = [];
    cards.forEach(function (c, i) { if (rest.length) rest[i % rest.length].hand.push(c); });
    if (g.tellerId === pid && rest.length) g.tellerId = rest[0].id;
    finish(g, null);
  }

  // Bot / auto-pick: choose the attribute where my top card is strongest relative to the deck.
  function autoPick(g, deck, pid, rng) {
    rng = rng || Math.random;
    var c = topCard(g, deck, pid), p = player(g, pid);
    var scored = deck.attrs.map(function (a) { return { key: a.key, s: c.stats[a.key] / deck.max[a.key] + rng() * 0.08 }; })
      .sort(function (x, y) { return y.s - x.s; });
    var cardsLeft = p.hand.length;
    var double = !p.powerUsed && scored[0].s > 0.93 && cardsLeft > 2 && rng() < 0.8;
    return { attr: scored[0].key, double: double };
  }

  // What a given player is allowed to see. Opponents' cards stay hidden until a round is revealed.
  function viewFor(g, deck, pid) {
    var me = player(g, pid);
    return {
      deckId: g.deckId, perPlayer: g.perPlayer, totalCards: g.totalCards, roundLimit: g.roundLimit, endedBy: g.endedBy, winnerIds: g.winnerIds, round: g.round, seq: g.seq, over: g.over, winnerId: g.winnerId, tellerId: g.tellerId,
      pot: g.pot.length, you: pid,
      myTop: me && !me.out && me.hand.length ? me.hand[0] : null,
      myPowerUsed: me ? me.powerUsed : false,
      players: g.players.map(function (p) {
        return { id: p.id, name: p.name, bot: p.bot, count: p.hand.length, out: p.out, left: p.left, streak: p.streak, powerUsed: p.powerUsed };
      }),
      lastResult: g.lastResult
    };
  }

  return {
    MIN_PLAYERS: MIN_PLAYERS, MAX_PLAYERS: MAX_PLAYERS, MAX_ROUNDS: MAX_ROUNDS,
    mulberry32: mulberry32, shuffle: shuffle, createGame: createGame, choose: choose, removePlayer: removePlayer,
    autoPick: autoPick, viewFor: viewFor, topCard: topCard, player: player, alive: alive
  };
});
