/* Card Clash deck data.
   Every character is FICTIONAL and every statistic is INVENTED. Nothing here is real career data.

   A small set of "nod" characters have playful, altered names that echo famous sporting figures
   (see CRICKET_NODS / WRESTLING_NODS). Everyone else is an original character built from invented
   names. All of it is data: to remove the nods completely, delete those two lists.

   Decks are generated at load time from fixed seeds, so every device builds the identical deck.
   Each deck is large (200+ cards) so a host can deal up to 50 cards to each of 4 players.
   Every attribute is "higher wins". Nothing in a card hints which stat is its best. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CardClashData = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function between(rng, a, b) { return a + rng() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---------- invented name machinery ----------
  var FIRST = ['Arjun', 'Rohan', 'Kabir', 'Imran', 'Tariq', 'Farhan', 'Nikhil', 'Dev', 'Sameer', 'Vikram', 'Omar', 'Zaid', 'Rayan', 'Hamza',
    'Liam', 'Noah', 'Jack', 'Oliver', 'Harry', 'Mason', 'Ethan', 'Callum', 'Riley', 'Jordan', 'Marcus', 'Dante', 'Kofi', 'Kwame', 'Tendai',
    'Sipho', 'Themba', 'Andile', 'Devon', 'Jamal', 'Winston', 'Marlon', 'Kemar', 'Chaminda', 'Lasith', 'Dinesh', 'Nuwan', 'Ruvan', 'Hemant',
    'Aiden', 'Finn', 'Tane', 'Ravi', 'Mohit', 'Karan', 'Yash', 'Aarav', 'Ishaan', 'Pranav', 'Siddharth', 'Rahul', 'Anil', 'Suresh', 'Naveen',
    'Mustafa', 'Bilal', 'Asif', 'Junaid', 'Saad', 'Waqar', 'Danish', 'Hassan', 'Ahmed', 'Karim', 'Tobias', 'Lachlan', 'Cooper', 'Hayden', 'Brodie',
    'Declan', 'Rhys', 'Gareth', 'Angus', 'Duncan', 'Felix', 'Hugo', 'Leon', 'Mateo', 'Santiago', 'Diego', 'Rafael', 'Xavier', 'Idris', 'Jabari'];
  var FIRST_F = ['Aisha', 'Priya', 'Meera', 'Sana', 'Zara', 'Nadia', 'Leila', 'Anya', 'Maya', 'Isla', 'Freya', 'Chloe', 'Imogen', 'Tess', 'Kiara',
    'Amara', 'Nia', 'Thandi', 'Lerato', 'Zola', 'Shreya', 'Divya', 'Riya', 'Tara', 'Mina', 'Saira', 'Hira', 'Alina', 'Selma', 'Ines'];
  var SYL_A = ['Kar', 'Mal', 'Ven', 'Dra', 'Sor', 'Tal', 'Bren', 'Gal', 'Har', 'Jas', 'Kel', 'Lor', 'Mor', 'Nar', 'Ost', 'Pal', 'Quin', 'Ras', 'Sev', 'Tor',
    'Ul', 'Vor', 'Wen', 'Yor', 'Zan', 'Ash', 'Bel', 'Cor', 'Dal', 'Esk', 'Fen', 'Gor', 'Hal', 'Ion', 'Jar', 'Kor', 'Lun', 'Mar', 'Nev', 'Orr'];
  var SYL_B = ['vendra', 'horan', 'bright', 'masti', 'derson', 'rilla', 'stone', 'kumar', 'wick', 'mont', 'field', 'ward', 'thorne', 'deen', 'vale',
    'shaw', 'burn', 'ford', 'lan', 'mere', 'drick', 'goda', 'lin', 'rath', 'zey', 'dari', 'kova', 'nell', 'pura', 'sky', 'tano', 'vari', 'wood', 'yan'];
  function surname(rng) { return cap(pick(rng, SYL_A).toLowerCase()) + pick(rng, SYL_B); }

  var NATIONS = ['Indira', 'Pakara', 'Kangaria', 'Albion', 'Veldtland', 'Caribbea', 'Lankara', 'Kiwiland', 'Bengalia', 'Afghara', 'Zimbara', 'Emerald Isle', 'Saharia', 'Pacifica'];
  var CITIES = ['Ironport', 'Steelhaven', 'Thunder Bay', 'Redmoor', 'Crowfield', 'Stormgate', 'Ashfall', 'Brightwater', 'Highrock', 'Dunmere', 'Silverkeep', 'Gravelton', 'Oakridge', 'Foxhollow', 'Kingsmoor'];

  function uniqueMaker() {
    var seen = {};
    return function (name) { var n = name, i = 2; while (seen[n]) { n = name + ' ' + (i++); } seen[n] = 1; return n; };
  }

  // =====================================================================
  //  CRICKET — invented stars. "Nods" are playful altered names, nothing more.
  // =====================================================================
  var CRICKET_NODS = [
    ['Sach Endlukar', 'Master Batter', 'Indira', 't', .98], ['Viraj Kohlee', 'Chase Master', 'Indira', 't', .94], ['Maahi Dhawni', 'Cool Keeper', 'Indira', 'k', .9],
    ['Rikki Pontang', 'Fearless Captain', 'Kangaria', 't', .9], ['Jack Callus', 'All-round Giant', 'Veldtland', 'a', .93], ['Kumara Sangaka', 'Elegant Keeper', 'Lankara', 'k', .9],
    ['Rahool Dravad', 'The Wall', 'Indira', 't', .88], ['Brain Lahra', 'Record Breaker', 'Caribbea', 't', .92], ['Shaun Wharne', 'Spin Wizard', 'Kangaria', 's', .97],
    ['Muthu Muralidharan', 'Mystery Spinner', 'Lankara', 's', .98], ['Wasim Ackram', 'Swing King', 'Pakara', 'f', .93], ['Glen McGrath-ee', 'Line & Length', 'Kangaria', 'f', .88],
    ['Jimmy Andersen', 'Seam Master', 'Albion', 'f', .9], ['Anil Kumbley', 'Leg-spin Legend', 'Indira', 's', .9], ['Kapil Dave', 'Swashbuckler', 'Indira', 'a', .88],
    ['Shawn Pollack', 'Steady Allrounder', 'Veldtland', 'a', .84], ['AB De Villains', 'Mr. 360', 'Veldtland', 't', .95], ['Chris Gayle-Force', 'Sixer Machine', 'Caribbea', 't', .88],
    ['Sourav Gangooly', 'The Prince', 'Indira', 't', .83], ['Viv Richardson', 'Swagger King', 'Caribbea', 't', .92], ['Don Bradmann', 'Once-in-a-Century', 'Kangaria', 't', 1],
    ['Ravi Ashwyn', 'Carrom Ball Genius', 'Indira', 's', .86], ['Rohit Sharmaa', 'Hitman', 'Indira', 't', .9], ['Joe Rooter', 'Quiet Accumulator', 'Albion', 't', .88],
    ['Ben Stoakes', 'Match Winner', 'Albion', 'a', .9], ['Jasprit Boomrah', 'Yorker Machine', 'Indira', 'f', .93], ['Steve Smyth', 'Quirky Genius', 'Kangaria', 't', .92],
    ['Kane Williamstone', 'Calm Captain', 'Kiwiland', 't', .88], ['Babar Azzam', 'Cover-drive King', 'Pakara', 't', .9], ['Rashid Khanna', 'Googly Wizard', 'Afghara', 's', .86],
    ['Shakib Al Hassun', 'Bengal Allrounder', 'Bengalia', 'a', .87], ['Dale Steynn', 'Express Pace', 'Veldtland', 'f', .9], ['Mitchell Starkk', 'Left-arm Thunder', 'Kangaria', 'f', .88],
    ['Trent Boldt', 'Swing Merchant', 'Kiwiland', 'f', .84], ['Hashim Almah', 'Silent Run-Machine', 'Veldtland', 't', .86]
  ];
  var CRICKET_ROLES = {
    t: { label: 'Top-order Batter', emoji: '🏏' }, m: { label: 'Middle-order Batter', emoji: '🏏' }, a: { label: 'All-rounder', emoji: '⭐' },
    f: { label: 'Fast Bowler', emoji: '⚡' }, s: { label: 'Spin Bowler', emoji: '🌀' }, k: { label: 'Wicketkeeper', emoji: '🧤' }
  };
  // matches, runs, hundreds, wickets, highest, avg -- all invented from a role and a skill level (0..1)
  function cricketStats(role, q, rng) {
    var j = function (v, s) { return v * (1 + (rng() - .5) * s); };
    var matches = Math.round(clamp(j(60 + q * 520, .35), 18, 700));
    var runs, hundreds, wickets, highest, avg;
    if (role === 't' || role === 'm') {
      runs = matches * j(20 + q * 42, .3); hundreds = runs / j(560 - q * 260, .35); wickets = j(q * 12, 1.4) * (role === 'm' ? 1.4 : 1);
      highest = j(95 + q * 260, .3); avg = j(24 + q * 32, .18);
    } else if (role === 'k') {
      runs = matches * j(16 + q * 30, .3); hundreds = runs / j(900 - q * 380, .4); wickets = j(q * 1.2, 2);
      highest = j(80 + q * 200, .3); avg = j(21 + q * 22, .18);
    } else if (role === 'a') {
      runs = matches * j(13 + q * 26, .3); hundreds = runs / j(1400 - q * 700, .4); wickets = matches * j(.55 + q * .95, .3);
      highest = j(70 + q * 160, .3); avg = j(18 + q * 20, .18);
    } else {                                                    // f, s: bowlers
      runs = matches * j(3.5 + q * 9, .5); hundreds = runs > 2500 ? j(.5, 1.5) : 0; wickets = matches * j(role === 'f' ? .85 + q * 1.45 : .95 + q * 1.5, .25);
      highest = j(24 + q * 70, .4); avg = j(7 + q * 14, .25);
    }
    return [matches, Math.round(clamp(runs, 80, 38000)), Math.round(clamp(hundreds, 0, 110)), Math.round(clamp(wickets, 0, 1300)),
      Math.round(clamp(highest, 18, 400)), Math.round(clamp(avg, 4, 62) * 10) / 10];
  }

  function makeCricket(total) {
    var rng = mulberry32(2025), uniq = uniqueMaker(), raw = [];
    CRICKET_NODS.forEach(function (n) {
      var r = mulberry32(100 + raw.length * 7);
      raw.push([uniq(n[0]), CRICKET_ROLES[n[3]].label + ' · ' + n[2], cricketStats(n[3], n[4], r), CRICKET_ROLES[n[3]].emoji, 'nod']);
    });
    var roleBag = ['t', 't', 'm', 'm', 'a', 'a', 'f', 'f', 's', 'k'];
    while (raw.length < total) {
      var role = pick(rng, roleBag), q = clamp(.12 + Math.pow(rng(), 1.35) * .86, .1, .97);
      var first = rng() < .1 ? pick(rng, FIRST_F) : pick(rng, FIRST), name = uniq(first + ' ' + surname(rng)), nation = pick(rng, NATIONS);
      raw.push([name, CRICKET_ROLES[role].label + ' · ' + nation, cricketStats(role, q, rng), CRICKET_ROLES[role].emoji, 'gen']);
    }
    return raw;
  }

  // =====================================================================
  //  WRESTLING — invented fighters. "Nods" are playful altered names, nothing more.
  // =====================================================================
  var WRESTLING_NODS = [
    ['Jon Seenah', 'Never-Give-Up Champion', 'h', .96], ['The Gravekeeper', 'Phenom of the Dark', 'p', .97], ['Roman Rains', 'Tribal Chief', 'p', .94],
    ['Brock Lesnarr', 'The Beast Reborn', 'g', .97], ['The Boulder', 'Most Electrifying', 'x', .95], ['Stone Chill Steve Austen', 'Rattlesnake Rebel', 'b', .95],
    ['Triple Aitch Hunter', 'The Game Master', 'c', .93], ['Randy Ortonn', 'The Viper Strike', 'x', .9], ['Dave Bautisto', 'The Animal Unleashed', 'g', .9],
    ['Kayne the Red', 'Big Red Machine', 'g', .88], ['Shawn Michaelz', 'Heartbreak Showman', 'f', .96], ['Brett Heart', 'The Excellence', 'c', .93],
    ['Hulk Hoggan', 'Hulkster of Hype', 'x', .92], ['Rick Flare', 'Nature Boy Royal', 'c', .9], ['Edgey Rated', 'The Ultimate Opportunist', 'b', .88],
    ['Rey Mysterious', 'Masked Marvel', 'f', .9], ['CM Punkk', 'Best In The World', 'c', .91], ['Seth Rawlins', 'The Visionary', 'f', .9],
    ['Becky Lynchpin', 'The Man of the Ring', 'b', .9], ['Charlotte Flaire', 'Queen of Queens', 'c', .91], ['AJ Stylez', 'The Phenomenal One', 'c', .93],
    ['Big Showman', 'The Giant', 'g', .87], ['Mark Hendry', "World's Strongest", 'g', .86], ['Kofi Kingstown', 'Boom Dynamite', 'f', .86],
    ['Undertaker Jr. Bones', 'Deadman Heir', 'p', .84], ['Bobby Lashly-Lash', 'Full Clip Powerhouse', 'p', .84], ['Drew McIntyre-Mac', 'The Scottish Warrior', 'b', .87],
    ['Sheamus Seamus', 'The Celtic Brawler', 'b', .86], ['Cesaro Cesare', 'Swiss Superman', 'c', .88], ['Jeff Hardee', 'Charismatic Enigma', 'f', .87]
  ];
  var WRESTLING_ARCH = {
    p: { label: 'Powerhouse', emoji: '💪' }, f: { label: 'High-Flyer', emoji: '🦅' }, c: { label: 'Technician', emoji: '🎓' },
    x: { label: 'Showman', emoji: '🎤' }, b: { label: 'Brawler', emoji: '🥊' }, g: { label: 'Giant', emoji: '🗻' }, h: { label: 'Veteran', emoji: '🛡️' }
  };
  // strength, stamina, charisma, finisher, toughness, speed, technique (1-100 ratings, invented)
  var WR_BASE = {
    p: [.9, .7, .55, .75, .85, .4, .5], f: [.45, .85, .7, .7, .55, .95, .8], c: [.6, .8, .6, .6, .7, .65, .95],
    x: [.6, .65, .97, .8, .6, .6, .6], b: [.8, .75, .65, .7, .9, .55, .5], g: [.97, .5, .55, .65, .9, .3, .4], h: [.75, .8, .9, .75, .85, .55, .75]
  };
  function wrestlingStats(arch, q, rng) {
    return WR_BASE[arch].map(function (b) { return Math.round(clamp((b * (.55 + q * .55)) * 100 * (1 + (rng() - .5) * .22), 12, 99)); });
  }
  var NICK_A = ['Iron', 'Crimson', 'Silent', 'Raging', 'Golden', 'Midnight', 'Savage', 'Royal', 'Mighty', 'Rapid', 'Rogue', 'Solar', 'Frozen', 'Blazing', 'Shadow', 'Thunder', 'Wicked', 'Grand'];
  var NICK_B = ['Anvil', 'Comet', 'Tempest', 'Sentinel', 'Falcon', 'Bulldozer', 'Maverick', 'Gladiator', 'Cobra', 'Avalanche', 'Mastiff', 'Phantom', 'Warlord', 'Jackal', 'Titan', 'Crusader', 'Outlaw', 'Dynamo'];

  function makeWrestling(total) {
    var rng = mulberry32(777), uniq = uniqueMaker(), raw = [], i;
    WRESTLING_NODS.forEach(function (n, idx) {
      raw.push([uniq(n[0]), WRESTLING_ARCH[n[2]].label + ' · ' + n[1], wrestlingStats(n[2], n[3], mulberry32(500 + idx * 11)), WRESTLING_ARCH[n[2]].emoji, 'nod']);
    });
    var bag = ['p', 'f', 'c', 'x', 'b', 'g', 'p', 'f', 'b', 'c'];
    while (raw.length < total) {
      var arch = pick(rng, bag), q = clamp(.1 + Math.pow(rng(), 1.3) * .88, .1, .97);
      var nick = pick(rng, NICK_A) + ' ' + pick(rng, NICK_B), first = rng() < .15 ? pick(rng, FIRST_F) : pick(rng, FIRST);
      var name = uniq(first + ' "' + nick + '" ' + surname(rng));
      raw.push([name, WRESTLING_ARCH[arch].label + ' · ' + pick(rng, CITIES), wrestlingStats(arch, q, rng), WRESTLING_ARCH[arch].emoji, 'gen']);
    }
    return raw;
  }

  // =====================================================================
  //  ROBOTS — Rovatics' own roster, fully original
  // =====================================================================
  var ROBOT_CORE = [
    ['Volt-9', 'Sector A', [93, 71, 64, 58, 77, 68, 40], '⚡'], ['Rusty Rex', 'Scrapyard', [81, 52, 41, 66, 90, 45, 30], '🦖'],
    ['Nimbus', 'Cloud Deck', [55, 94, 82, 61, 48, 90, 75], '☁️'], ['Gearhead', 'Workshop', [74, 68, 77, 72, 70, 70, 50], '⚙️'],
    ['Titan-X', 'Dock 7', [98, 40, 55, 70, 97, 35, 22], '🏗️'], ['Pixel', 'Lab 3', [38, 83, 96, 55, 42, 80, 70], '👾'],
    ['Blaze', 'Foundry', [88, 78, 60, 49, 66, 72, 35], '🔥'], ['Frostbyte', 'Arctic Base', [70, 62, 88, 85, 74, 64, 66], '❄️'],
    ['Sparky', 'Garage', [66, 89, 58, 77, 51, 88, 45], '✨'], ['Ironclad', 'Fortress', [85, 45, 62, 80, 99, 30, 28], '🏰'],
    ['Zippy', 'Track 1', [42, 99, 70, 63, 40, 96, 60], '💨'], ['Oracle', 'Data Hall', [47, 54, 99, 82, 58, 50, 88], '🔮'],
    ['Crusher', 'Quarry', [96, 50, 44, 61, 88, 38, 25], '🪨'], ['Echo', 'Studio', [58, 76, 84, 90, 52, 74, 82], '🔊'],
    ['Rocket-R', 'Launchpad', [79, 97, 66, 44, 56, 85, 38], '🚀'], ['Bolt', 'Sector B', [72, 85, 71, 68, 63, 78, 60], '🔩'],
    ['Mender', 'Clinic', [49, 60, 90, 94, 69, 66, 72], '🛠️'], ['Magnus', 'Magnet Lab', [83, 57, 75, 73, 81, 52, 48], '🧲'],
    ['Specter', 'Night Ops', [61, 91, 87, 52, 45, 92, 99], '👻'], ['Atlas', 'Summit', [91, 64, 68, 86, 84, 55, 42], '🌍'],
    ['Turbo', 'Pit Lane', [67, 95, 52, 56, 59, 90, 36], '🏎️'], ['Quark', 'Physics Wing', [52, 73, 97, 75, 54, 62, 80], '⚛️'],
    ['Gizmo', 'Toy Shop', [44, 80, 73, 92, 46, 86, 68], '🧸'], ['Overlord', 'Core', [100, 66, 91, 65, 95, 60, 60], '👑']
  ];
  var BOT_A = ['Arc', 'Zenith', 'Nova', 'Hex', 'Pulse', 'Vector', 'Cinder', 'Orbit', 'Prism', 'Rivet', 'Static', 'Torque', 'Quasar', 'Helix', 'Ember', 'Cobalt', 'Lumen', 'Onyx', 'Fuse', 'Sprocket', 'Axiom', 'Kilo', 'Mega', 'Neon'];
  var BOT_B = ['Rover', 'Drone', 'Guard', 'Crawler', 'Spark', 'Striker', 'Walker', 'Scout', 'Sentry', 'Hopper', 'Smasher', 'Glider', 'Warden', 'Racer', 'Builder', 'Hunter'];
  var BOT_PLACES = ['Sector C', 'Sector D', 'Assembly Hall', 'Cargo Bay', 'Reactor Deck', 'Test Track', 'Hangar 2', 'Server Farm', 'Dry Dock', 'Skyline Lab', 'Deep Vault', 'Power Plant'];
  var BOT_EMOJI = ['🤖', '🦾', '⚙️', '🔋', '🛰️', '🧿', '🔧', '💾', '📡', '🔌', '🧪', '🦿'];
  function makeRobots(total) {
    var rng = mulberry32(31337), uniq = uniqueMaker(), raw = ROBOT_CORE.map(function (r) { uniq(r[0]); return [r[0], r[1], r[2], r[3], 'gen']; });
    while (raw.length < total) {
      var q = clamp(.15 + Math.pow(rng(), 1.2) * .8, .1, .98), mix = [rng(), rng(), rng(), rng(), rng(), rng(), rng()], hi = Math.floor(rng() * 7);
      var stats = mix.map(function (m, k) { return Math.round(clamp((.25 + m * .5 + (k === hi ? .25 : 0)) * (.6 + q * .5) * 100 + 8, 14, 99)); });
      raw.push([uniq(pick(rng, BOT_A) + '-' + (2 + Math.floor(rng() * 98)) + ' ' + pick(rng, BOT_B)), pick(rng, BOT_PLACES), stats, pick(rng, BOT_EMOJI), 'gen']);
    }
    return raw;
  }

  // ---------- deck definitions ----------
  var DEF = {
    cricket: {
      id: 'cricket', name: 'Cricket Stars', emoji: '🏏', tagline: 'Invented cricketers — runs, wickets & centuries', colors: ['#0a8f4a', '#d6f542'],
      attrs: [{ key: 'matches', label: 'Matches', icon: '🏟️' }, { key: 'runs', label: 'Runs', icon: '🏃' }, { key: 'hundreds', label: 'Centuries', icon: '💯' },
        { key: 'wickets', label: 'Wickets', icon: '🎯' }, { key: 'highest', label: 'Top Score', icon: '🚀' }, { key: 'avg', label: 'Average', icon: '📊' }],
      raw: makeCricket(240)
    },
    wwe: {
      id: 'wwe', name: 'Wrestling Slam', emoji: '🤼', tagline: 'Invented fighters — rated for the ring', colors: ['#c4122f', '#ffb703'],
      attrs: [{ key: 'strength', label: 'Strength', icon: '💪' }, { key: 'stamina', label: 'Stamina', icon: '🫁' }, { key: 'charisma', label: 'Charisma', icon: '🎤' },
        { key: 'finisher', label: 'Finisher', icon: '💥' }, { key: 'toughness', label: 'Toughness', icon: '🛡️' }, { key: 'speed', label: 'Speed', icon: '💨' }, { key: 'technique', label: 'Technique', icon: '🎓' }],
      raw: makeWrestling(240)
    },
    robots: {
      id: 'robots', name: 'Rovatics Bots', emoji: '🤖', tagline: 'Our own robot roster — built for battle', colors: ['#0878f9', '#42e8f5'],
      attrs: [{ key: 'power', label: 'Power', icon: '⚡' }, { key: 'speed', label: 'Speed', icon: '🚀' }, { key: 'iq', label: 'Brain', icon: '🧠' }, { key: 'battery', label: 'Battery', icon: '🔋' },
        { key: 'armor', label: 'Armor', icon: '🛡️' }, { key: 'agility', label: 'Agility', icon: '🤸' }, { key: 'stealth', label: 'Stealth', icon: '🥷' }],
      raw: makeRobots(200)
    }
  };

  function build(d) {
    var cards = d.raw.map(function (r, i) {
      var stats = {}; d.attrs.forEach(function (a, k) { stats[a.key] = r[2][k]; });
      var h = 0, s = r[0]; for (var c = 0; c < s.length; c++) h = (h * 31 + s.charCodeAt(c)) % 360;
      return { id: d.id + '-' + i, idx: i, name: r[0], sub: r[1], emoji: r[3], stats: stats, hue: h };
    });
    var max = {};
    d.attrs.forEach(function (a) { max[a.key] = Math.max.apply(null, cards.map(function (c) { return c.stats[a.key]; })) || 1; });
    return { id: d.id, name: d.name, emoji: d.emoji, tagline: d.tagline, colors: d.colors, attrs: d.attrs, cards: cards, max: max };
  }

  var DECKS = {};
  ['cricket', 'wwe', 'robots'].forEach(function (id) { DECKS[id] = build(DEF[id]); });

  // Options for "cards each". A choice is allowed only if every player can be dealt that many from the deck.
  var PER_PLAYER_OPTIONS = [6, 8, 10, 12, 15, 20, 25, 30, 40, 50];
  function maxPerPlayer(deck, players) { return Math.floor(deck.cards.length / Math.max(1, players)); }

  return { DECKS: DECKS, DECK_IDS: ['cricket', 'wwe', 'robots'], PER_PLAYER_OPTIONS: PER_PLAYER_OPTIONS, DEFAULT_PER_PLAYER: 8, maxPerPlayer: maxPerPlayer };
});
