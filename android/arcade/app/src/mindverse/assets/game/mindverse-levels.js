/* MindVerse - World 1 "Lost Civilization": the ten campaign levels as data.
 * Pack ids/titles/objectives/hints follow the supplied level definitions (WC_L01..WC_L10).
 * Stage parameters (p) are what the rules engine plays; every level is proven solvable by tests/mindverse.test.js.
 * View hints: env = which temple set to build, cam = start camera {az, el, d, target}, relic = hidden collectible.
 * Beam coordinates: x to the right, z toward the player; mirror angle index m means m * 22.5 degrees.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MindverseLevels = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const WORLD = {
    id: 'LOST_CIVILIZATION', name: 'Lost Civilization', blurb: 'Jungle temples, stone mechanisms, mirrors, water and symbols.',
    story: 'A vanished people built the Mind Core, a heart of living energy. Five regions went dark when they disappeared. Wake the first one.'
  };
  const FUTURE = [
    { id: 'QUANTUM_LAB', name: 'Quantum Laboratory', blurb: 'Energy circuits, lasers, magnets and switches.', icon: '⚛' },
    { id: 'DEEP_OCEAN', name: 'Deep Ocean Mystery', blurb: 'Currents, valves, pressure and submerged routes.', icon: '🌊' },
    { id: 'FROZEN_FRONTIER', name: 'Frozen Frontier', blurb: 'Ice, friction, momentum, wind and temperature.', icon: '❄' },
    { id: 'BEYOND_REALITY', name: 'Beyond Reality', blurb: 'Gravity, portals and dimensional paths.', icon: '✦' }
  ];

  const bm = (x0, x1, z0, z1) => ({ x0, x1, z0, z1 });

  const LEVELS = [
    {
      n: 1, levelId: 'WC_L01', worldId: 'LOST_CIVILIZATION', title: 'The Awakening', difficulty: 'TUTORIAL', mechanic: 'CRYSTAL_PLACEMENT',
      objective: 'Activate the ancient stone door by placing the energy crystal on the activation plate.',
      intro: 'Sunlight pours through the canopy onto a sealed temple door. A blue crystal rests on a pedestal.',
      goalConditions: ['crystal_01 overlaps plate_01', 'plate_01 is active', 'door_01 is open'],
      hints: ['The floor plate appears connected to the door.', 'Try moving the glowing crystal.', 'Place the crystal directly on the activation plate.'],
      par: 2, validation: { solutionRequired: true, resetRequired: true, undoRequired: true },
      env: 'entrance', cam: { az: 0, el: 27, d: 21, t: [0, 2.6, -1.2] }, relic: { x: -6.4, y: 0.9, z: -2.6, name: 'Sun Shard' },
      stages: [{
        id: 'place', kind: 'place', goal: 'Drag the crystal onto the glowing plate.',
        p: { start: 'pedestal', plate: 'plate', zones: { pedestal: { x: -4.2, z: 2.2 }, moss: { x: -2.2, z: 4.4 }, step: { x: 1.5, z: 4.6 }, rock: { x: -1.2, z: 0.2 }, plate: { x: 3.6, z: 2.4 }, urn: { x: 5.6, z: 5.2 } } }
      }]
    },
    {
      n: 2, levelId: 'WC_L02', worldId: 'LOST_CIVILIZATION', title: 'The Rotating Mirror', difficulty: 'EASY', mechanic: 'BEAM_REFLECTION',
      objective: 'Rotate the mirror so the energy beam reaches the receiver.',
      intro: 'A hall of banners. An energy source hums and a bronze mirror waits on its stand.',
      goalConditions: ['beam_path_reaches_receiver_01', 'receiver_01 is active'],
      hints: ['The beam can change direction when it touches a mirror.', 'Select the mirror and change its angle.', 'Align the reflected beam with the receiver.'],
      par: 5, validation: { solutionRequired: true, angleToleranceDegrees: 3 },
      env: 'hall', cam: { az: 0, el: 52, d: 20, t: [0, 0, 0] }, relic: { x: -6.2, y: 1.2, z: 4.4, name: 'Mirror Shard' },
      stages: [{
        id: 'beam', kind: 'beam', goal: 'Send the beam into the receiver.',
        p: { steps: 8, bounds: bm(-8, 8, -6, 6), source: { x: -7, z: 0, dir: 0 }, mirrors: [{ id: 'mirror_01', x: 0, z: 0, start: 2 }], receivers: [{ id: 'receiver_01', x: 4, z: -4 }], need: ['receiver_01'], blockers: [] }
      }]
    },
    {
      n: 3, levelId: 'WC_L03', worldId: 'LOST_CIVILIZATION', title: 'The Three Symbols', difficulty: 'EASY', mechanic: 'SYMBOL_SEQUENCE',
      objective: 'Discover and enter the correct three-symbol sequence.',
      intro: 'A carved wall, three silent panels and a gate that will not move. The old tablet says more than it seems.',
      goalConditions: ['enteredSequence matches clueDerivedSequence', 'gate_01 is unlocked'],
      hints: ['The wall inscription contains the order.', 'Compare the symbols on the wall with the panel.', 'Enter the symbols in the order shown by the clue.'],
      par: 8, validation: { solutionRequired: true, clueMustBeSufficient: true },
      env: 'wall', cam: { az: 0, el: 20, d: 15, t: [0, 2.4, 0] }, relic: { x: 6.4, y: 0.8, z: 2.2, name: 'Glyph Shard' },
      stages: [{
        id: 'symbols', kind: 'symbols', goal: 'Set the three panels to match the tablet.',
        p: {
          slots: 3, symbols: ['spiral', 'triangle', 'sun'], start: [2, 1, 0], solution: ['triangle', 'spiral', 'sun'],
          clue: [{ k: 'distinct' }, { k: 'at', s: 'sun', pos: 2 }, { k: 'notAt', s: 'spiral', pos: 0 }],
          clueLines: ['Three different carvings, one in each panel.', 'The sun looks over the right shoulder of the wall.', 'The spiral never leads the way.']
        }
      }]
    },
    {
      n: 4, levelId: 'WC_L04', worldId: 'LOST_CIVILIZATION', title: 'The Weight of Knowledge', difficulty: 'EASY_MEDIUM', mechanic: 'WEIGHT_BALANCE',
      objective: 'Balance the platform using movable stones.',
      intro: 'A great bronze scale stands in a sunlit ruin. Four carved stones wait in the dust: notches on each tell its weight.',
      goalConditions: ['absoluteWeightDifference <= authoredTolerance'],
      hints: ['Look at the markings on the platform.', 'Each stone contributes a different weight.', 'Arrange the stones so both sides balance.'],
      par: 6, validation: { solutionRequired: true, useDeterministicWeightValues: true },
      env: 'scale', cam: { az: 0, el: 24, d: 18, t: [0, 2.4, 0] }, relic: { x: 6.8, y: 0.8, z: -2.4, name: 'Balance Shard' },
      stages: [{
        id: 'balance', kind: 'balance', goal: 'Rest every stone on a pan so the beam sits level.',
        p: { stones: [{ id: 'stone_a', w: 2 }, { id: 'stone_b', w: 3 }, { id: 'stone_c', w: 1 }, { id: 'stone_d', w: 4 }], cap: 3, tol: 0, target: 0, requireAll: true }
      }]
    },
    {
      n: 5, levelId: 'WC_L05', worldId: 'LOST_CIVILIZATION', title: 'The Water Path', difficulty: 'MEDIUM', mechanic: 'WATER_ROUTING',
      objective: 'Connect the water source to the receiver using channels and valves.',
      intro: 'The waterfall pours into a maze of stone channels. The basin below is dry and thirsty.',
      goalConditions: ['continuousValidPathExists', 'valve_a is open', 'receiver_a is supplied'],
      hints: ['Water needs a continuous route.', 'Inspect the channel connections.', 'Align the channels, then open the valve.'],
      par: 12, validation: { solutionRequired: true, flowModel: 'DETERMINISTIC_GRID' },
      env: 'waterworks', cam: { az: 0, el: 55, d: 19, t: [0, 0, 0.6] }, relic: { x: 8.2, y: 0.8, z: 5.0, name: 'Tide Shard' },
      stages: [{
        id: 'water', kind: 'water', goal: 'Turn the channels and valves until water reaches the basin.',
        p: {
          cols: 6, rows: 4, tiles: [
            { id: 'water_source', t: 'source', c: 0, r: 0, fixed: true },
            { id: 'ch_1', t: 'straight', c: 1, r: 0, rot: 0 },
            { id: 'ch_2', t: 'elbow', c: 2, r: 0, rot: 0 },
            { id: 'valve_b', t: 'valve', c: 2, r: 1, rot: 1, fixed: true },
            { id: 'ch_3', t: 'elbow', c: 2, r: 2, rot: 3 },
            { id: 'valve_a', t: 'valve', c: 3, r: 2, rot: 0, fixed: true },
            { id: 'ch_4', t: 'elbow', c: 4, r: 2, rot: 1 },
            { id: 'receiver_a', t: 'receiver', c: 4, r: 3, rot: 1, fixed: true },
            { id: 'old_1', t: 'elbow', c: 1, r: 1, rot: 2, fixed: true },
            { id: 'old_2', t: 'tee', c: 3, r: 1, rot: 0, fixed: true },
            { id: 'old_3', t: 'straight', c: 5, r: 2, rot: 1, fixed: true },
            { id: 'old_4', t: 'straight', c: 3, r: 3, rot: 1, fixed: true },
            { id: 'old_5', t: 'elbow', c: 5, r: 0, rot: 1, fixed: true }
          ]
        }
      }]
    },
    {
      n: 6, levelId: 'WC_L06', worldId: 'LOST_CIVILIZATION', title: 'The Hidden Key', difficulty: 'MEDIUM', mechanic: 'ENVIRONMENTAL_DEDUCTION',
      objective: 'Use environmental clues to find the key and unlock the secret door.',
      intro: 'Four sealed jars in a candle-lit niche. A relief on the wall hints which one guards the key.',
      goalConditions: ['key_01 discovered', 'door_secret unlocked'],
      hints: ['Look for a clue that refers to a particular object.', 'Inspect the containers and compare their markings.', 'The container matching the clue holds the key.'],
      par: 4, validation: { solutionRequired: true, clueMustUniquelyIdentifyContainer: true },
      env: 'niche', cam: { az: 0, el: 22, d: 14, t: [0, 1.7, 0] }, relic: { x: -6.6, y: 1.0, z: 1.6, name: 'Ember Shard' },
      stages: [{
        id: 'search', kind: 'search', goal: 'Read the clue, find the right jar, take the key to the door.',
        p: {
          clue: { sym: 'sun', notColor: 'red' }, clueText: 'The key sleeps where the sun is carved, but never in a jar the colour of fire.', keyIn: 'jar_d',
          jars: [
            { id: 'jar_a', sym: 'spiral', color: 'red', look: 'A red jar carved with a spiral.' },
            { id: 'jar_b', sym: 'triangle', color: 'blue', look: 'A blue jar carved with a triangle.' },
            { id: 'jar_c', sym: 'sun', color: 'red', look: 'A red jar carved with a sun.' },
            { id: 'jar_d', sym: 'sun', color: 'blue', look: 'A blue jar carved with a sun.' }
          ]
        }
      }]
    },
    {
      n: 7, levelId: 'WC_L07', worldId: 'LOST_CIVILIZATION', title: 'The Energy Network', difficulty: 'MEDIUM_HARD', mechanic: 'MULTI_TARGET_BEAM_ROUTING',
      objective: 'Direct energy to all three receivers using mirrors.',
      intro: 'Three mirrors, three relays and a stone block that always seems to be in the way.',
      goalConditions: ['receiver_07a active', 'receiver_07b active', 'receiver_07c active'],
      hints: ['One beam route can interact with more than one mechanism.', 'Inspect the obstacles and mirror positions.', 'Plan a route that activates all three receivers.'],
      par: 14, validation: { solutionRequired: true, allReceiversMustBeActiveTogether: true },
      env: 'network', cam: { az: 0, el: 55, d: 23, t: [0, 0, 0] }, relic: { x: -8.4, y: 1.0, z: -4.8, name: 'Prism Shard' },
      stages: [{
        id: 'beam', kind: 'beam', goal: 'Light all three relays with one beam at the same time.',
        p: {
          steps: 8, bounds: bm(-9.5, 9.5, -6.5, 6.5), source: { x: -8.5, z: 4, dir: 0 },
          mirrors: [{ id: 'mirror_07a', x: 0, z: 4, start: 2 }, { id: 'mirror_07b', x: 0, z: -4, start: 0 }, { id: 'mirror_07c', x: 7, z: -4, start: 5 }],
          receivers: [{ id: 'receiver_07a', x: 0, z: 0 }, { id: 'receiver_07b', x: 3.5, z: -4 }, { id: 'receiver_07c', x: 7, z: 1 }],
          need: ['receiver_07a', 'receiver_07b', 'receiver_07c'],
          blockers: [{ id: 'blocker_07a', start: 0, slots: [{ x: 0, z: 2.2 }, { x: 5.2, z: -4 }, { x: -4.6, z: -2.4 }, { x: 4, z: 2.6 }] }]
        }
      }]
    },
    {
      n: 8, levelId: 'WC_L08', worldId: 'LOST_CIVILIZATION', title: 'The Moving Bridge', difficulty: 'HARD', mechanic: 'SEQUENCED_PLATFORM_PUZZLE',
      objective: 'Reposition the bridge and platforms to create a safe crossing.',
      intro: 'A ravine, a waterfall and an ancient bridge that no longer points the right way. Three mechanisms control it.',
      goalConditions: ['pathFromStartToExitIsConnected', 'bridgeIsLockedInSafePosition'],
      hints: ['The bridge responds to more than one mechanism.', 'Look for a control that changes the bridge position.', 'Activate the mechanisms in the correct order, then align the platforms.'],
      par: 11, validation: { solutionRequired: true, pathConnectivityTest: true },
      env: 'ravine', cam: { az: -8, el: 30, d: 24, t: [0, 0.5, 0] }, relic: { x: 1.4, y: 1.0, z: 5.4, name: 'Cliff Shard' },
      stages: [{
        id: 'bridge', kind: 'bridge', goal: 'Plan the order: the lever, the plate and the rail rules must be respected.',
        p: { start: { b: 1, p: 0, q: 0 } }
      }]
    },
    {
      n: 9, levelId: 'WC_L09', worldId: 'LOST_CIVILIZATION', title: 'The Ancient Trap', difficulty: 'HARD', mechanic: 'SEQUENCE_AND_CONSEQUENCE',
      objective: 'Infer the safe switch sequence and unlock the exit without triggering the trap.',
      intro: 'Spikes sleep under the floor. Three switches guard the exit and only one order is safe. Look at how the stone remembers.',
      goalConditions: ['safeSequenceEntered', 'exit_09 unlocked'],
      hints: ['The markings describe a sequence.', 'Compare the clues near each switch.', 'Follow the order implied by the environmental symbols.'],
      par: 3, validation: { solutionRequired: true, failureResetsPuzzleOnly: true },
      env: 'trap', cam: { az: 0, el: 30, d: 16, t: [0, 1.2, 0] }, relic: { x: 6.4, y: 0.8, z: 4.4, name: 'Spike Shard' },
      stages: [{
        id: 'trap', kind: 'trap', goal: 'Press the switches in the safe order. A wrong one resets the room.',
        p: {
          clueText: 'Tread first where the travellers trod most. Finish where the dust sleeps.',
          switches: [
            { id: 'switch_a', sym: 'sun', wear: 1, look: 'The sun switch is dusty and untouched. Nobody has pressed it in ages.' },
            { id: 'switch_b', sym: 'spiral', wear: 3, look: 'The spiral switch is worn to a shine. Countless hands pressed it.' },
            { id: 'switch_c', sym: 'triangle', wear: 2, look: 'The triangle switch is scuffed but not polished. It was pressed now and then.' }
          ],
          order: ['switch_b', 'switch_c', 'switch_a']
        }
      }]
    },
    {
      n: 10, levelId: 'WC_L10', worldId: 'LOST_CIVILIZATION', title: 'The Mind Core', difficulty: 'WORLD_FINAL', mechanic: 'MULTI_STAGE_COMBINATION',
      objective: 'Combine the learned mechanisms to restore the first Mind Core.',
      intro: 'The great chamber. Five dormant mechanisms circle the Mind Core. Wake them in order.',
      goalConditions: ['allStagesComplete', 'mindCoreRestored'],
      hints: ['The chamber combines mechanisms from earlier rooms.', 'Restore the physical mechanisms before routing energy.', 'Complete each stage in dependency order, then activate all receivers.'],
      par: 32, validation: { solutionRequired: true, stageDependenciesExplicit: true },
      env: 'core', cam: { az: 0, el: 30, d: 30, t: [0, 3, -12] }, relic: { x: 5.5, y: 1.2, z: 6.5, name: 'Core Shard' },
      stages: [
        {
          id: 'stage_1', kind: 'balance', goal: 'Stage 1 of 5: balance the platform.', view: { x: 0, z: -36, rot: 3.1416, cam: { az: 0, el: 22, d: 24, t: [0, 3, 0] } },
          p: { stones: [{ id: 'stone_1', w: 3 }, { id: 'stone_2', w: 5 }, { id: 'stone_3', w: 2 }, { id: 'stone_4', w: 4 }, { id: 'stone_5', w: 6 }], cap: 3, tol: 0, target: 0, requireAll: true }
        },
        {
          id: 'stage_2', kind: 'water', goal: 'Stage 2 of 5: wake the water mechanism.', view: { x: 34.24, z: -11.12, rot: 1.885, cam: { az: 0, el: 50, d: 17, t: [0, 0, 0] } },
          p: {
            cols: 5, rows: 2, tiles: [
              { id: 'w2_source', t: 'source', c: 0, r: 0, fixed: true },
              { id: 'w2_a', t: 'straight', c: 1, r: 0, rot: 0 },
              { id: 'w2_b', t: 'elbow', c: 2, r: 0, rot: 0 },
              { id: 'w2_c', t: 'elbow', c: 2, r: 1, rot: 2 },
              { id: 'w2_valve', t: 'valve', c: 3, r: 1, rot: 0, fixed: true },
              { id: 'w2_recv', t: 'receiver', c: 4, r: 1, rot: 0, fixed: true },
              { id: 'w2_old', t: 'elbow', c: 1, r: 1, rot: 3, fixed: true },
              { id: 'w2_old2', t: 'straight', c: 3, r: 0, rot: 1, fixed: true }
            ]
          }
        },
        {
          id: 'stage_3', kind: 'gear', goal: 'Stage 3 of 5: align both gears to their marks.', view: { x: 21.16, z: 29.12, rot: 0.6283, cam: { az: 0, el: 50, d: 14, t: [0, 0, 0] } },
          p: { na: 12, nb: 8, start: [5, 3] }
        },
        {
          id: 'stage_4', kind: 'beam', goal: 'Stage 4 of 5: route energy to the feeder relay.', view: { x: -21.16, z: 29.12, rot: 5.655, cam: { az: 0, el: 52, d: 23, t: [0, 0, 0] } },
          p: {
            steps: 8, bounds: bm(-8.5, 8.5, -6, 6), source: { x: -7.5, z: 3, dir: 0 },
            mirrors: [{ id: 'mirror_4a', x: -3, z: 3, start: 3 }, { id: 'mirror_4b', x: -3, z: -3, start: 0 }],
            receivers: [{ id: 'relay_4', x: 3, z: -3 }], need: ['relay_4'], blockers: []
          }
        },
        {
          id: 'stage_5', kind: 'beam', goal: 'Stage 5 of 5: light all three receivers.', view: { x: -34.24, z: -11.12, rot: 4.398, cam: { az: 0, el: 52, d: 25, t: [0, 0, 0] } },
          p: {
            steps: 8, bounds: bm(-9.5, 9.5, -6.5, 6.5), source: { x: -8.5, z: -4, dir: 0 },
            mirrors: [{ id: 'mirror_5a', x: -1, z: -4, start: 6 }, { id: 'mirror_5b', x: -1, z: 4, start: 0 }, { id: 'mirror_5c', x: 7, z: 4, start: 3 }],
            receivers: [{ id: 'recv_5a', x: -1, z: 0 }, { id: 'recv_5b', x: 3, z: 4 }, { id: 'recv_5c', x: 7, z: 0 }], need: ['recv_5a', 'recv_5b', 'recv_5c'],
            blockers: [{ id: 'block_5', start: 0, slots: [{ x: -1, z: 2 }, { x: 5, z: 4 }, { x: 2, z: -2 }, { x: -5, z: 0 }] }]
          }
        }
      ]
    }
  ];

  return { WORLD, FUTURE, LEVELS };
});
