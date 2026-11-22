# PARALLAX + Rovatics Game Zone: implementation status

Branch `Parallax` (cut from `Devil-hunters`). Web only. Nothing here touches Android.

## Delivered

| Area | Status |
|---|---|
| Game Zone platform (`games/game-zone.html`, `games/gz/`) | Done. Animated 3D glass-and-gold "R" splash, hub with featured PARALLAX card (3D-rendered cover), profile (name/colour/play time), shared settings. Games register in `gz/registry.js` only. Devil Hunters is listed as a second game. |
| Worlds | 5, each with its own sky, light, ground, landmark props and sound bed. |
| Levels | 100, all titled from the design pack, all with a generated puzzle that the engine has solved and replayed. |
| Puzzle families | 9: pillar sequence, channel routing (incl. wrap-around topology), coupled mechanisms (lights, tuning dials, magnets, pressure), gravity slide, light and mirrors (incl. prisms), pressure tanks, temporal echo, causal circuits, multi-chamber paradox. |
| Mechanic coverage | Topology (wrap-around routing), gravity, magnetism (repelling links), resonance (musical dials and bell), fluid and pressure, temporal echoes, living/causal systems, combined worlds. |
| Validation | A win is the rule engine saying "solved", then re-verified by replaying every move from the start. A button press never completes a level. |
| Progression | Levels unlock in order. 1 star solved, 2 no hints, 3 within 25% of the solver's move count. |
| Economy | Completion + tier + mastery + discovery coins from each level's JSON, paid once. Replays pay a token. 13 achievements. 12 cosmetics (drone shells, trails, journal skins) bought with coins only. |
| Help | 3-step hint ladder (observe, interpret, demonstrate with a 3D halo and LUMA flying to it), free and unlimited. Undo, restart, auto-checkpoints every 6 moves, manual save and load. Progress resumes after closing the page. |
| Accessibility | Text size, high contrast, reduced motion, audio captions, numbers on colour-coded pieces, keyboard play. |
| Performance | Quality tiers (auto by device, lowered automatically if frames drop), pixel-ratio cap, shadows only on medium/high, reduced props and particles. |

## Tests

* `tests/parallax-logic.test.mjs`: 12 tests, all passing (levels, solutions, hints, session, rewards, progression, cosmetics, save repair).
* Browser, real touch taps through the 3D picking: levels 1, 2, 3, 4, 21, 22, 23, 41, 43, 44, 61, 64, 81, 84, 85, 87, 88, 90, 92, 95, 96, 99, 100 completed.
* Browser, whole campaign through the real game pipeline (`startLevel`, then every solution move, win re-verification, rewards, save): **100 of 100 completed in order, 300 stars, 12 of 13 achievements (the 13th needs shop purchases), no console errors.**

## Known limitations (please read)

1. **Not Unity.** The brief asked for Unity 6 / C# / URP / APK / AAB. This branch was requested as web only, so it is three.js. There is no Unity project, APK, AAB or final ZIP.
2. **Levels are 100 distinct puzzle instances of 9 families, not 100 separately hand-designed mechanics.** The pack gives titles and mechanic families but no puzzle specifications. Every level has its own generated layout, difficulty and (for world 5) combination of chambers, but two levels in a world share rules. The titles and story are per level; the mechanisms are per family.
3. **No walkable third-person character.** You orbit and tap a 3D diorama with LUMA hovering over it. The design document allows contextual tap interaction; free movement and platforming were not built.
4. **The 100 concept PNGs are not used in the game** (the brief says they are references). Worlds are procedural; the cover art is rendered in 3D.
5. **Never run on a real phone or with working speakers.** Checked in headless Chrome with a software renderer only, so frame rates are unmeasured and the sounds were never heard (they play without errors). Treat feel, performance and audio balance as untested.
6. **Echo levels take a few seconds to plan a hint from scratch**, so if you wander off the planned route during recording, the hint asks you to undo instead.
7. Lore text is templated from the level title with a pool of eight lines, not 100 unique passages.
8. Level titles and the working title come from the supplied pack, which says to clear trademark/IP before public use.
