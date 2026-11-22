# ROVATICS GAME ZONE + PARALLAX (web edition)

`games/parallax/parallax.html` is the Rovatics Game Zone platform. PARALLAX: The Laws of the Lost Universe is its first game.
Built with three.js (r170, ES modules, no build step). Works offline once loaded. No ads, timers or purchases.

> **Scope note.** The master brief asked for Unity 6 / C# / URP / Android. The request in this branch was *web only, no Android code for now*,
> so this edition is a three.js implementation of the same design (Game Zone launcher + the 100-level PARALLAX campaign).
> Unity, APK and AAB output are **not** part of this branch. See "Android later" below.

## Run it

```
cd games
python -m http.server 8140        # or: node any-static-server, or the repo's own server
# open http://localhost:8140/game-zone.html      (add ?game=parallax to jump straight into PARALLAX)
```
It must be served over http(s) (ES modules and an import map). Needs a browser with WebGL2 and import-map support (Chrome / Edge 89+, Firefox 108+, Safari 16.4+).

## Tests (Node 20+)

```
node --test tests/parallax-logic.test.mjs      # rules, all 100 levels, hints, progression, rewards, saves
node tools/gen-parallax.mjs                    # regenerates + re-proves every puzzle -> games/parallax/px/data/puzzles.js (about 4 min)
node tools/extract-parallax-levels.mjs <pack folder> games/parallax/px/data/briefs.js   # re-import the design pack
```
`gen-parallax.mjs` refuses to write a level unless the engine solves it and a replay of the solution ends in the solved state.

## Layout

| Path | What it is |
|---|---|
| `parallax/game-zone.html` (hub) or `parallax/parallax.html` (straight into the game) | page, styles, import map |
| `parallax/gz/host.js` | platform host: renderer, audio, settings, quality tiers, main loop, game launching |
| `parallax/gz/launcher.js`, `parallax/gz/splash.js` | 3D "R" splash, game hub, profile, settings |
| `parallax/gz/registry.js` | **the only place a game is registered.** Add an entry to add a game |
| `parallax/gz/store.js`, `parallax/gz/audio.js` | per-game namespaced saves, procedural audio |
| `parallax/px/logic.js` | pure puzzle engine: 9 families, shared BFS / Dijkstra / Gaussian solvers |
| `parallax/px/gen.js` | seeded generators and the level plan (which family each level uses) |
| `parallax/px/data/briefs.js` | the 100 level briefs from the design pack |
| `parallax/px/data/puzzles.js` | the 100 generated and proven puzzles, with a stored solution each |
| `parallax/px/session.js` | one play session: moves, undo, restart, checkpoints, hint ladder |
| `parallax/px/progress.js` | stars, coins, achievements, cosmetics, save migration |
| `parallax/px/views.js`, `parallax/px/world.js`, `parallax/px/gfx.js` | the 3D puzzle views, the five worlds, LUMA, shared helpers |
| `parallax/px/game.js` | the game module: story, menu, map, level runtime, input, win flow |

## Adding another game to the Game Zone
1. Create a module whose default export is `{ id, title, mount(host), unmount(), summary(Store) }`. `host` gives you the shared WebGL renderer, `host.root` (DOM layer), `host.audio`, `host.Store`, `host.settings`, `host.setLoop(fn)` and `host.exitToZone()`.
2. Add one entry to `parallax/gz/registry.js` (use `kind: 'link'` for a standalone page such as Devil Hunters).

## Android later
The Android shell used for the other Rovatics games (WebView + `sync-assets.js` flavors in the arcade repo) can wrap `parallax/game-zone.html` (hub) or `parallax/parallax.html` (straight into the game) unchanged.
It was deliberately not touched in this branch.

## Known limitations
See `docs/PARALLAX_STATUS.md`.
