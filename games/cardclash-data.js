/* Card Clash deck data. Add a new deck by pushing another object to DECKS.
   Every attribute is "higher wins". Each deck should have a multiple of 12 cards
   (24 deals evenly to 2, 3 or 4 players).
   NOTE: Cricket numbers are approximate career international totals, for fun only.
   WWE values are fan-made ratings (1-100), not official stats. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CardClashData = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var cricket = {
    id: 'cricket', name: 'Cricket Legends', emoji: '🏏', tagline: 'Runs, wickets and centuries from the greats',
    colors: ['#0a8f4a', '#d6f542'],
    attrs: [
      { key: 'matches', label: 'Matches', icon: '🏟️' },
      { key: 'runs', label: 'Runs', icon: '🏃' },
      { key: 'hundreds', label: 'Centuries', icon: '💯' },
      { key: 'wickets', label: 'Wickets', icon: '🎯' }
    ],
    // name, country, [matches, runs, hundreds, wickets], emoji
    raw: [
      ['Sachin Tendulkar', 'India', [664, 34357, 100, 201], '👑'],
      ['Virat Kohli', 'India', [550, 27600, 82, 4], '🔥'],
      ['MS Dhoni', 'India', [538, 17266, 16, 1], '🧤'],
      ['Ricky Ponting', 'Australia', [560, 27483, 71, 5], '🦘'],
      ['Jacques Kallis', 'South Africa', [519, 25534, 62, 577], '🛡️'],
      ['Kumar Sangakkara', 'Sri Lanka', [594, 28016, 63, 0], '🎩'],
      ['Rahul Dravid', 'India', [509, 24208, 48, 1], '🧱'],
      ['Brian Lara', 'West Indies', [430, 22358, 53, 4], '🌴'],
      ['Shane Warne', 'Australia', [339, 3154, 0, 1001], '🌀'],
      ['Muttiah Muralitharan', 'Sri Lanka', [495, 1935, 0, 1347], '🪄'],
      ['Wasim Akram', 'Pakistan', [460, 6615, 0, 916], '⚡'],
      ['Glenn McGrath', 'Australia', [376, 800, 0, 563], '🎯'],
      ['James Anderson', 'England', [413, 1500, 0, 991], '🌧️'],
      ['Anil Kumble', 'India', [403, 3444, 1, 956], '🦁'],
      ['Kapil Dev', 'India', [356, 9031, 9, 687], '🏆'],
      ['Shaun Pollock', 'South Africa', [423, 7400, 2, 829], '🥇'],
      ['AB de Villiers', 'South Africa', [420, 20014, 47, 7], '🤖'],
      ['Chris Gayle', 'West Indies', [483, 19593, 42, 260], '💥'],
      ['Sourav Ganguly', 'India', [424, 18575, 38, 132], '🐯'],
      ['Viv Richards', 'West Indies', [308, 15261, 35, 150], '😎'],
      ['Don Bradman', 'Australia', [52, 6996, 29, 2], '🎖️'],
      ['R Ashwin', 'India', [287, 4400, 5, 765], '🧠'],
      ['Rohit Sharma', 'India', [499, 19700, 49, 8], '🚀'],
      ['Joe Root', 'England', [353, 20640, 55, 75], '🌹']
    ]
  };

  var wwe = {
    id: 'wwe', name: 'Wrestling Slam', emoji: '🤼', tagline: 'Fan-made ratings — who rules the ring?',
    colors: ['#c4122f', '#ffb703'],
    attrs: [
      { key: 'strength', label: 'Strength', icon: '💪' },
      { key: 'stamina', label: 'Stamina', icon: '🫁' },
      { key: 'charisma', label: 'Charisma', icon: '🎤' },
      { key: 'finisher', label: 'Finisher', icon: '💥' },
      { key: 'toughness', label: 'Toughness', icon: '🛡️' }
    ],
    // strength, stamina, charisma, finisher, toughness
    raw: [
      ['John Cena', 'USA', [88, 95, 96, 90, 92], '🫳'],
      ['The Undertaker', 'USA', [92, 88, 94, 97, 96], '⚰️'],
      ['Roman Reigns', 'USA', [93, 87, 92, 91, 91], '🐺'],
      ['Brock Lesnar', 'USA', [99, 80, 84, 96, 95], '🦍'],
      ['The Rock', 'USA', [90, 85, 99, 93, 88], '🤨'],
      ['Stone Cold Steve Austin', 'USA', [89, 86, 98, 94, 93], '🍺'],
      ['Triple H', 'USA', [91, 88, 93, 89, 90], '🔨'],
      ['Randy Orton', 'USA', [86, 84, 90, 96, 87], '🐍'],
      ['Batista', 'USA', [96, 80, 87, 92, 90], '🦬'],
      ['Kane', 'USA', [95, 79, 85, 88, 94], '🔥'],
      ['Shawn Michaels', 'USA', [74, 92, 97, 93, 82], '🎸'],
      ['Bret Hart', 'Canada', [78, 93, 88, 91, 85], '🎯'],
      ['Hulk Hogan', 'USA', [92, 82, 99, 86, 89], '🇺🇸'],
      ['Ric Flair', 'USA', [76, 94, 98, 84, 83], '💎'],
      ['Edge', 'Canada', [84, 85, 91, 90, 88], '🗡️'],
      ['Rey Mysterio', 'USA', [60, 97, 92, 85, 78], '🎭'],
      ['CM Punk', 'USA', [78, 90, 95, 87, 84], '🕶️'],
      ['Seth Rollins', 'USA', [80, 93, 93, 89, 85], '🏛️'],
      ['Becky Lynch', 'Ireland', [79, 91, 95, 88, 90], '🔥'],
      ['Charlotte Flair', 'USA', [82, 92, 92, 90, 87], '👸'],
      ['AJ Styles', 'USA', [77, 94, 90, 92, 85], '🌀'],
      ['Big Show', 'USA', [97, 70, 85, 83, 93], '🗻'],
      ['Mark Henry', 'USA', [98, 72, 80, 82, 94], '🏋️'],
      ['Kofi Kingston', 'Ghana', [72, 95, 88, 86, 80], '🌟']
    ]
  };

  var robots = {
    id: 'robots', name: 'Rovatics Bots', emoji: '🤖', tagline: 'Our own robot roster — built for battle',
    colors: ['#0878f9', '#42e8f5'],
    attrs: [
      { key: 'power', label: 'Power', icon: '⚡' },
      { key: 'speed', label: 'Speed', icon: '🚀' },
      { key: 'iq', label: 'Brain', icon: '🧠' },
      { key: 'battery', label: 'Battery', icon: '🔋' },
      { key: 'armor', label: 'Armor', icon: '🛡️' }
    ],
    raw: [
      ['Volt-9', 'Sector A', [93, 71, 64, 58, 77], '⚡'], ['Rusty Rex', 'Scrapyard', [81, 52, 41, 66, 90], '🦖'],
      ['Nimbus', 'Cloud Deck', [55, 94, 82, 61, 48], '☁️'], ['Gearhead', 'Workshop', [74, 68, 77, 72, 70], '⚙️'],
      ['Titan-X', 'Dock 7', [98, 40, 55, 70, 97], '🏗️'], ['Pixel', 'Lab 3', [38, 83, 96, 55, 42], '👾'],
      ['Blaze', 'Foundry', [88, 78, 60, 49, 66], '🔥'], ['Frostbyte', 'Arctic Base', [70, 62, 88, 85, 74], '❄️'],
      ['Sparky', 'Garage', [66, 89, 58, 77, 51], '✨'], ['Ironclad', 'Fortress', [85, 45, 62, 80, 99], '🏰'],
      ['Zippy', 'Track 1', [42, 99, 70, 63, 40], '💨'], ['Oracle', 'Data Hall', [47, 54, 99, 82, 58], '🔮'],
      ['Crusher', 'Quarry', [96, 50, 44, 61, 88], '🪨'], ['Echo', 'Studio', [58, 76, 84, 90, 52], '🔊'],
      ['Rocket-R', 'Launchpad', [79, 97, 66, 44, 56], '🚀'], ['Bolt', 'Sector B', [72, 85, 71, 68, 63], '🔩'],
      ['Mender', 'Clinic', [49, 60, 90, 94, 69], '🛠️'], ['Magnus', 'Magnet Lab', [83, 57, 75, 73, 81], '🧲'],
      ['Specter', 'Night Ops', [61, 91, 87, 52, 45], '👻'], ['Atlas', 'Summit', [91, 64, 68, 86, 84], '🌍'],
      ['Turbo', 'Pit Lane', [67, 95, 52, 56, 59], '🏎️'], ['Quark', 'Physics Wing', [52, 73, 97, 75, 54], '⚛️'],
      ['Gizmo', 'Toy Shop', [44, 80, 73, 92, 46], '🧸'], ['Overlord', 'Core', [100, 66, 91, 65, 95], '👑']
    ]
  };

  function build(d) {
    var cards = d.raw.map(function (r, i) {
      var stats = {};
      d.attrs.forEach(function (a, k) { stats[a.key] = r[2][k]; });
      return { id: d.id + '-' + i, idx: i, name: r[0], sub: r[1], emoji: r[3], stats: stats, hue: (i * 47 + d.id.length * 31) % 360 };
    });
    var max = {};
    d.attrs.forEach(function (a) { max[a.key] = Math.max.apply(null, cards.map(function (c) { return c.stats[a.key]; })) || 1; });
    return { id: d.id, name: d.name, emoji: d.emoji, tagline: d.tagline, colors: d.colors, attrs: d.attrs, cards: cards, max: max };
  }

  var DECKS = {};
  [cricket, wwe, robots].forEach(function (d) { DECKS[d.id] = build(d); });
  return { DECKS: DECKS, DECK_IDS: ['cricket', 'wwe', 'robots'] };
});
