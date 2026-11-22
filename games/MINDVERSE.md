# MindVerse: Beyond the Puzzle

A realistic 3D temple-puzzle adventure that runs in any modern browser (desktop, phone, tablet). Built from the
"MindVerse Claude Development Pack": the design document, technical architecture, ten level definitions, art direction
and the generated concept images were the brief. Open `games/mindverse.html` (it is listed in `games/games.json`).

## What was built, and how it maps to the pack

| Pack item | In this game |
|---|---|
| Realistic 3D cinematic look | Real-time three.js scene with PBR materials, image-based lighting, soft shadows, bloom, filmic tone mapping, god rays, dust, fireflies, fog, animated water and waterfalls. Every texture and model is generated in code. |
| World 1 "Lost Civilization", ten levels | `games/mindverse-levels.js`: `WC_L01` to `WC_L10`, same ids, titles, objectives, mechanics and the three hints per level as in `04_Level_Design`. |
| Data-driven levels, schema-validated | Levels are plain data. `validateLevel()` rejects missing ids, bad references, unknown mechanics and malformed goals with a clear message. |
| Reusable puzzle engine, deterministic | `games/mindverse-engine.js`: nine mechanic modules (place, beam, symbols, balance, water, search, bridge, trap, gear) share one contract: `init / actions / apply / goal`. No rendering code in it. |
| "Every published puzzle has a solution" | BFS solver over the exact game rules. `verifyLevel()` proves each stage solvable, that clues have exactly one answer, that no level starts solved and that par is not below the best possible. |
| Undo, restart, hints (3 levels), stars, save | `createGame()`: snapshot undo (also across the Mind Core stages), exact restart, progressive hints that never move anything, 3 stars, versioned local save with safe write. |
| Touch controls | Tap, drag, rotate buttons, swipe to look around, pinch / scroll to zoom, reset camera. Large hit proxies so nothing needs pixel-perfect taps. |
| Low / Medium / High quality | Settings screen plus automatic detection and an FPS-based downgrade. Low turns off shadows and post-processing. |
| Accessibility and all-ages | Captions for sound cues, reduce-motion, vibration switch, volume sliders, shape cues as well as colour (unlit relays show a hollow ring), no violence, no ads, no tracking. |
| Audio | Everything synthesized with WebAudio: ambience, generative music, and a sound for every interaction. |

Level 10 "The Mind Core" has five staged mechanisms (balance, water, gear, beam, three receivers) placed around a
grand chamber. Each stage is sealed until the previous one is done, and finishing all five restores the Mind Core.

## The ten levels

| # | Title | Mechanic | Best possible moves | Par |
|---|---|---|---|---|
| 1 | The Awakening | drag a crystal onto a plate | 1 | 2 |
| 2 | The Rotating Mirror | rotate a mirror (22.5 degree steps) | 3 | 5 |
| 3 | The Three Symbols | deduce a sequence from a carved tablet | 6 | 8 |
| 4 | The Weight of Knowledge | balance stones of authored weight | 4 | 6 |
| 5 | The Water Path | channels and two valves | 7 | 12 |
| 6 | The Hidden Key | read the relief, deduce the jar, open the door | 2 (+1 free look) | 4 |
| 7 | The Energy Network | three mirrors, three relays, a movable block | 10 | 14 |
| 8 | The Moving Bridge | lever, plate and rail with interlocking rules | 9 | 11 |
| 9 | The Ancient Trap | worn switches reveal the safe order | 3 | 3 |
| 10 | The Mind Core | five combined stages | 30 | 32 |

Stars: 1 for solving, 2 for finishing within par, 3 for finding the hidden relic (a glowing shard in every room) without using hints.
Hints are free and never block progress.

## Files

| File | Role |
|---|---|
| `games/mindverse.html` | Page, UI (menu, level map, HUD, hint / clue cards, settings), input, audio, save handling |
| `games/mindverse-engine.js` | Rules, solver, validation, game session, scoring, save format |
| `games/mindverse-levels.js` | The ten levels as data, plus the four future worlds shown as "coming soon" |
| `games/mindverse-gfx.js` | Procedural textures, materials, water, foliage, effects, post-processing |
| `games/mindverse-props.js` | The 3D view of each mechanic (mirrors, scales, pipes, gears, bridge...) |
| `games/mindverse-world.js` | Renderer, camera, quality profiles, the temple environments, picking |
| `games/vendor/three.min.js` | three.js r128 (MIT licence), vendored so the game works offline |
| `tests/mindverse.test.js` | 29 engine tests |
| `tests/tools/mindverse-ui-test.py` | Plays all ten levels in headless Chrome with real mouse input |

## Running the tests

```
node tests/mindverse.test.js
python tests/tools/mindverse-ui-test.py      # needs Chrome and: pip install websocket-client
```

The UI test uses WebGL through Chrome's software renderer, so it is slow but needs no GPU.

## Controls

* Tap a mirror, channel, valve, gear, switch or panel to use it. Tap a jar or switch to look at it first, then confirm.
* Drag crystals and stones to a glowing spot. Or tap the object and tap the spot.
* Swipe empty space to look around, pinch or scroll to zoom, the target button resets the view.
* Keyboard: Z undo, R restart, H hint, Q / E rotate the selected object, Esc pause.

## Honest notes and limits

* The pack describes a Unity / Android project. This is a web implementation of the same design, so it runs on the
  site and on phones through the browser. The rules engine is plain JavaScript with no engine dependencies, so it can be
  ported or wrapped (for example in the existing WebView Android shell) later. A Unity build was not made.
* The concept images were used as art direction only. There are no photographs or downloaded models in the game.
* Performance was not profiled on real phones. The quality profiles are in place but the numbers are estimates.
* Only World 1 exists. The other four worlds are shown as planned.
* Progress is stored in the browser (`localStorage`) and nothing is sent anywhere.
