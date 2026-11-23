# PARALLAX: The Laws of the Lost Universe

A cinematic 3D puzzle adventure from **Rovatics Game Zone**. You play a fully animated human explorer in grand floating temples. Three complete levels, built from the "Parallax Grand 3D Three-Level" development pack.

Play: open `games/parallax.html` (or build the Android app, see below).

## Important: why this is not a Unity project

The brief asked for Unity 6 / C# / URP. This machine only has Unity Hub with Unity 2020.3 (no Unity 6 and no Android module), so a Unity project could not be built or tested here. Instead PARALLAX is built in the same stack as the other Rovatics games, **three.js (WebGL) + a WebView Android app**, which was built, run and tested end to end. All requested systems exist (character controller, third-person camera, interaction, puzzle logic and validation, level manager, UI, audio, save, rewards, Android input, graphics settings). If a Unity port is wanted later, `parallax-engine.js` is pure logic with no graphics and maps one-to-one to C#.

## The three levels

| # | Level | Puzzle | Solution (as in the pack) |
|---|-------|--------|---------------------------|
| 1 | **The Forgotten Gate** (floating observatory, monumental sealed gate, hanging gardens) | Three mirrors catch sunlight shafts and throw them onto three floor plates. A plate only reveals its symbol while a beam touches it. | Turn each mirror until its plate glows (moon, sun, star from left to right), then wake the three pillars in that order. Wrong order silences them; pillars refuse to wake before the symbols are revealed. |
| 2 | **The Floating Path** (floating platforms, huge stairs, sea of clouds) | Three bridge sections (A elbow, B straight, C elbow) rotate in quarter turns on consoles A, B, C. Blue sockets glow where two ends meet. | Join entrance to A, A to B, B to the middle platform, C to the exit, then activate the lock and walk across the bridge. |
| 3 | **The Energy Core** (colossal futuristic chamber, gyroscope rings, central core) | Three coloured beams with symbols (moon, sun, star) are redirected by three mirrors into receivers with the same symbol. A beam into the wrong receiver flashes red. | Exactly one mirror arrangement satisfies all three receivers (found and proved by `tests/tools/gen-parallax-core.js`); then activate the console: the core ignites, the roof opens and the universe is revealed. |

Colour is never the only clue: every emitter, receiver and pillar also carries its symbol.

## Hints (three steps, short and friendly)

1. Observation, 2. Guidance (a golden beacon marks the object), 3. Clear direction. Texts are the ones from the pack. Using hints only costs the third star.

## Controls

* Move: left joystick (touch) or W A S D. Look: drag on the right side (mouse or touch). Zoom: pinch / mouse wheel (zoom only, the viewing angle never tilts by accident). Tilt and turn buttons exist on desktop.
* Use: walk close to something that glows and press the gold **hand** button (E / F), or tap an object and the explorer walks over and uses it. Tap the ground to walk there. Jump: button / Space.
* Hint 💡, Undo ↶, Restart ↻, Pause ☰.

## Systems

| Requirement | Where |
|-------------|-------|
| Rovatics Game Zone intro and launcher | `mindverse-splash.js` (3D logo animation), `parallax.html` (data-driven launcher: add an entry to `GAMES`) |
| Character, animations (idle, walk, run, jump, reach, turn mirror, pull, press, inspect, celebrate) | `parallax-avatar.js`, rigged procedurally, original design |
| Character controller, follow camera, close-ups, cinematics, interaction, tap-to-walk, hint beacon, coins | `parallax-world.js` |
| The three environments, shared scenery | `parallax-env.js`, `parallax-env-b.js` |
| Puzzle logic, validation, hints, undo/restart, stars and coins, save | `parallax-engine.js` |
| Music and sound effects | `mindverse-audio.js` (per-level tunes: bright, adventurous, cosmic) |
| UI, HUD, joystick, settings, progress, pause | `parallax.html` |
| Graphics settings | Auto / Low / Medium / High (post-processing bloom and shadows scale with it) |

Graphics are all generated in code (no downloaded art): PBR materials with procedural stone, metal and glass, image-based lighting, ACES grade with bloom, soft shadows, god rays, clouds, waterfalls, instanced foliage, glowing mechanisms.

## Tests

```
node tests/parallax.test.js                      # 16 engine tests: tracer, uniqueness of each solution, hints, undo, rewards, saving
python tests/tools/parallax-ui-test.py           # real mouse/keyboard run through all three levels in headless Chrome
node tests/tools/gen-parallax-core.js 2          # regenerates the level 3 layout and proves it has exactly one solution
```

## Android

Flavor `parallax` (`com.rovatics.parallax`) on branch `f-parallax-android`:

```
node android/arcade/sync-assets.js
cd android/arcade
./gradlew assembleParallaxDebug assembleParallaxRelease bundleParallaxRelease
```

APK/AAB are signed with the test key (not for Play). For Play, add a real upload key in `keystore.properties`.

## Known limitations

* Built with three.js, not Unity 6 (see above).
* The explorer is an original stylised procedural model; it is detailed (jacket, straps, belt, backpack, gloves, boots, face and hair) but not a motion-captured photoreal character.
* Not yet tried on a physical phone: the Android emulator here cannot render WebGL.
