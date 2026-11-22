/* PARALLAX level table: the 100 design briefs + the proven puzzle for each + world art direction, lore and hint text. */
import { LEVEL_BRIEFS } from './data/briefs.js';
import { PUZZLES } from './data/puzzles.js';
import { RULES } from './logic.js';

export const WORLDS = [
  { id: 1, name: 'The Forgotten Architects', short: 'Architects', tag: 'Topology · Light · Shadow · Resonance', sky: ['#0b1d2a', '#2f6f6a', '#ffd9a0'], fog: '#2a4a48', accent: '#ffcf6b', accent2: '#7be0b0', base: '#8c917f', metal: '#c9984a', sun: '#ffe2a8',
    story: 'Overgrown megastructures hum with the memory of their builders. Gates remember. Stairs fold. The first engine, the Law of Form, is asleep in the roots.' },
  { id: 2, name: 'The Gravity Engine', short: 'Gravity', tag: 'Gravity · Magnetism · Momentum · Energy', sky: ['#1a0b0b', '#7a2e12', '#ff9a4a'], fog: '#4a2214', accent: '#ff8a3c', accent2: '#4fd8ff', base: '#3d4048', metal: '#c8743a', sun: '#ffb070',
    story: 'Foundries hang between poles that no longer agree on which way is down. Rails bend toward magnets, and weight forgets itself.' },
  { id: 3, name: 'The Living Abyss', short: 'Abyss', tag: 'Fluid · Pressure · Resonance · Living systems', sky: ['#021425', '#06506b', '#2fd0c8'], fog: '#073c52', accent: '#59ffd9', accent2: '#ff6ad8', base: '#7fd6d2', metal: '#6ad0ff', sun: '#aaffff',
    story: 'Glass reefs sing in the dark. Submerged cities breathe with the tide, and every creature is half machine, half song.' },
  { id: 4, name: 'The Fractured Continuum', short: 'Continuum', tag: 'Echoes · Causality · Memory · Parallel states', sky: ['#1a1030', '#5a3a72', '#e8b36a'], fog: '#3c2a50', accent: '#c9a2ff', accent2: '#ffc86b', base: '#a8895a', metal: '#d9b46a', sun: '#ffd89a',
    story: 'A city broken across moments. The same street exists three times; a footstep taken yesterday still echoes in the square.' },
  { id: 5, name: 'The Infinite Paradox', short: 'Paradox', tag: 'Every law at once', sky: ['#000008', '#10063a', '#4b2a9a'], fog: '#0c0626', accent: '#ffffff', accent2: '#ffb347', base: '#2a2a44', metal: '#9a8cff', sun: '#ffffff',
    story: 'Black-star oceans, planetary rings and impossible stairs. Here the five laws collide, and one answer must satisfy them all.' }
];

/* Story fragments (one hidden in every level). The twist, clue and place come from the level's own brief. */
const LORE_OPEN = ['A note scratched into the frame reads', 'LUMA decodes a faded recording', 'A dusty plaque admits', 'An echo of the Architects says', 'In the margin of a ruined chart someone wrote'];
const LORE_BODY = [
  w => 'the engines were never broken. They were divided, so no single mind could ever hold all five laws.',
  w => 'every rule here was taught slowly. The ones who rushed it were the ones who got lost.',
  w => 'the Wayfinder is not a hero. The Wayfinder is a question the worlds ask themselves.',
  w => 'LUMA records, but never solves. Only the one who looks closely can complete a law.',
  w => 'when the fracture came, they hid a door in every world, and a key in every puzzle.',
  w => 'the unstable intelligence did not want power. It wanted to be understood.',
  w => 'to solve is to listen. The machine tells you everything, if you test one thing at a time.',
  w => 'five engines, five laws, one hope: that someone would come back to put the pieces in order.'
];
export const loreFor = n => { const b = LEVEL_BRIEFS[n - 1]; return `"${b.title}" — ${LORE_OPEN[n % LORE_OPEN.length]}: ${LORE_BODY[(n * 3) % LORE_BODY.length](b.world)}`; };

/* Three-step hint ladder. 1 observe, 2 interpret (explains the rule), 3 demonstrate (the next solver move is highlighted in the 3D scene). */
export const HINTS = {
  seq: [s => s.rule === 'memory' ? 'Observe: the central bell plays a pattern of lights. Tap the bell as often as you like.' : 'Observe: read the plaque, then compare the pillars. They differ in height, colour and number of rings.',
        s => s.rule === 'memory' ? 'Interpret: wake the pillars in exactly the order the bell lit them. A wrong tap only resets your progress.' : 'Interpret: the rule is "' + RULES[s.rule] + '". Start with the first pillar of that order.',
        () => 'Demonstrate: the glowing pillar is the next one to wake.'],
  pipes: [s => 'Observe: a light enters from the left edge. Look for the exit gate on the right' + (s.wrap ? ' and notice the top and bottom edges connect to each other.' : '.'),
          () => 'Interpret: tap a tile to turn it a quarter turn. Gold-bolted tiles are fixed. Build one unbroken channel from source to exit; the channel glows as it fills.',
          () => 'Demonstrate: the glowing tile needs another turn.'],
  coupled: [s => s.kind === 'lights' ? 'Observe: every crystal must end up lit. Notice that tapping one changes its neighbours too.' : 'Observe: each dial shows its current note and the note it must reach. Tapping a dial also nudges others.',
            s => s.kind === 'lights' ? 'Interpret: a tap flips the crystal and the four around it. Order does not matter, only which crystals you tap an odd number of times.' : 'Interpret: tapping raises that dial by one step (wrapping round) and pushes its neighbours as shown by the links. Work from one end.',
            () => 'Demonstrate: tap the glowing one next.'],
  tilt: [() => 'Observe: orbs slide until something stops them. Each orb has a socket of its own colour.',
         () => 'Interpret: use the gravity arrows to slide every orb in one direction at once. Green pads stop an orb; a socket catches only its own orb.',
         () => 'Demonstrate: the highlighted arrow is the next tilt.'],
  beam: [() => 'Observe: light leaves the emitter on the left and travels in a straight line. Crystals glow when it touches them.',
         () => 'Interpret: tap a mirror to swing it between / and \\. Dark mirrors are fixed. Prisms split the beam in two.',
         () => 'Demonstrate: the glowing mirror needs to be turned.'],
  tanks: [s => 'Observe: tanks have different capacities. Gold rings mark the level each target tank must hold.',
          () => 'Interpret: you can fill a tank from the tap, drain it, or pour one into another until the source empties or the target fills. Exact amounts come from the differences.',
          () => 'Demonstrate: the glowing control is your next action.'],
  echo: [() => 'Observe: some gates open only while a pad is held down. You cannot hold a pad and walk through its own gate.',
         () => 'Interpret: first RECORD a route, then release your echo. Your echo repeats the recording and stays on its last tile while you run the level again. Use pauses to get the timing right.',
         () => 'Demonstrate: the glowing control is the next step.'],
  logic: [() => 'Observe: switches feed gates, gates feed lamps. Each lamp ring shows the state the plaque demands.',
          () => 'Interpret: trace wires backwards from a lamp. AND needs both, OR needs one, XOR needs exactly one, NAND is the opposite of AND, NOT flips. Linked switches move together.',
          () => 'Demonstrate: the glowing switch is the next one to throw.'],
  multi: [() => 'Observe: this world-scale puzzle has several chambers. Finishing one opens the next.',
          () => 'Interpret: solve the lit chamber using what each earlier world taught you.',
          () => 'Demonstrate: the glowing control belongs to the current chamber.']
};

export const LEVELS = LEVEL_BRIEFS.map((b, i) => { const p = PUZZLES[i]; if (!p || p.n !== b.n) throw new Error('puzzle data out of sync at level ' + b.n); return { ...b, family: p.f, par: p.par, state: p.state, sol: p.sol, world: WORLDS[b.world - 1] }; });
export const FAMILY_NAME = { seq: 'Pillar Sequence', pipes: 'Channel Routing', coupled: 'Coupled Mechanisms', tilt: 'Gravity Slide', beam: 'Light & Mirrors', tanks: 'Pressure Tanks', echo: 'Temporal Echo', logic: 'Causal Circuit', multi: 'Multi-chamber Paradox' };
