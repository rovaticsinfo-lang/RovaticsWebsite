---
name: rovatics-arcade-android
description: Develop Rovatics web games for the Arcade Android project (android/arcade on branch f-arcade-android) and build their APK/AAB files. Covers the game-to-app contract, adding a game as a new Gradle product flavor, generating icons and the Play listing, installing the Windows build toolchain without admin rights, building and verifying debug/release APKs and AABs, and preparing the PR. Use when asked to make an APK or AAB for a game, add a game to the arcade app, build the arcade apps, or touch anything under android/arcade.
---

# Rovatics Arcade: games to Android apps

One Gradle project (`android/arcade`), one **product flavor per game**. Each app is a native shell (splash, welcome tour, About, haptics, share sheet, Back handling) around the **offline web game** in `games/`. The web game stays the source of truth: `sync-assets.js` copies it into the app and applies a few asserted substitutions.

| Flavor | Application ID | Game page |
|---|---|---|
| sudoku | com.rovatics.sudoku | games/sudoku.html |
| racers | com.rovatics.racers | games/kids-car-race-game.html |
| beambots | com.rovatics.beambots | games/beambots.html |
| cardclash | com.rovatics.cardclash | games/cardclash.html (only app with INTERNET) |
| sceneblocks | com.rovatics.sceneblocks | games/scene-blocks.html |

Authoritative project doc: `android/arcade/README.md`. Read it before changing anything; this skill is the workflow around it.

## Rules that save you from damage
- **Work in a clone of `f-arcade-android`**, on a new branch off it. `main` does not contain `android/arcade`. Open PRs against `f-arcade-android` unless told otherwise. Never push to `main`.
- **Never commit** `keystore.properties`, `*.jks`, `local.properties`, or any `.apk`/`.aab`. The first three are already git-ignored (`android/arcade/.gitignore`); confirm with `git check-ignore -v <file>`. Build outputs go **outside** the repo (default `C:\Android\arcade-builds`).
- **Test-signed builds are never uploaded to Google Play.** Files signed with a test key keep the `-TESTKEY` suffix so they cannot be mistaken for release files.
- **Do not run `git checkout -- <file>` on a file you edited** (it silently discards your work). To undo a generated file, rewrite it from `git show HEAD:<path>`.
- No `gh` CLI on the dev PC and the GitHub connector may be unauthenticated: push the branch, then give the user the `https://github.com/<owner>/<repo>/pull/new/<branch>` link plus a ready PR description.

## Line endings (this bites on Windows)
`core.autocrlf=true`: **blobs are LF, working files are CRLF**. Edit freely; git normalises. Do not "fix" endings by hand, and do not trust `git show HEAD:f | grep -c $'\r'` (Git Bash reports CRs that are not in the blob). Use `git cat-file blob HEAD:f | tr -cd '\r' | wc -c` to see the truth. After editing a tracked file with LF tools, either leave it (git warns, harmless) or convert it back (`sed -i 's/\r$//; s/$/\r/' file`). A tracked file showing ` M` with no real diff means only endings changed.

## The game-to-app contract
A game that ships as an app must, in its web page, **already** have:
1. **Rovatics badge**: `<img src="../assets/rovatics-logo.png">` inside `.rv-brand-badge` (copy the block from `games/sudoku.html`). `sync-assets.js` rewrites that `src` to the bundled circular logo and **fails loudly if the badge is missing**.
2. **`viewport-fit=cover`** in the viewport meta. A page with extra flags (e.g. `user-scalable=no`) is fine.
3. **`window.__androidBack = function () {...}`**: return `true` if the game handled Back (closed a dialog, left a screen); `false` at the top level so the app shows "press back again to exit".
4. **Native bridge, guarded**, never required: `RovaticsApp.haptic('tick'|'heavy'|'success'|'reject')` (needs no VIBRATE permission; fall back to `navigator.vibrate`), `RovaticsApp.share(text)`, `RovaticsApp.orientation('landscape'|'auto')`, `RovaticsApp.openAbout()`.
5. **Fully offline and self-contained**: no CDN scripts, fonts or fetches (no INTERNET permission). Vendor third-party code (see `web-overrides/vendor/`).
6. **A test hook** (`window.__<game>`) and a `tests/<game>-ui-test.html` in the repo's iframe style (see `tests/racers-ui-test.html`, `tests/sceneblocks-ui-test.html`).

WebView survival kit (the app runs in the user's Android System WebView, which can be old):
- `100dvh` needs Chrome 108+. Put a `vh` declaration **before** the `dvh` one, or a stale WebView drops the whole rule.
- Canvas `roundRect` needs Chrome 99+. Add the small polyfill (see `games/scene-blocks.html`).
- Reserve the bottom strip: the app adds a floating About button (bottom-left) and the badge sits bottom-right. `common.css` adds `body{padding-bottom:64px}`; a game with its own full-height layout should expose a `--reserve` CSS variable and override it in `web-overrides/<flavor>.css` (see `sceneblocks.css`).
- `localStorage`, WebAudio (after a first tap) and pointer events work. Pages are served from `https://appassets.androidplatform.net/`, not `file://`.

## Add a game as a new flavor (do these in order)
Replace `<f>` with the lowercase flavor id (`sceneblocks`), `<Game>` with the display name.
1. **Branch**: clone `f-arcade-android` into its own folder, `git checkout -b f-<f>-android`.
2. **Game page** meets the contract above. Run its tests.
3. **`android/arcade/sync-assets.js`**: add `<f>: { page: '<file>.html', extra: [engine/data files], common: true }` to `GAMES`.
4. **`android/arcade/app/build.gradle`**: add `<f> { dimension 'game'; applicationId 'com.rovatics.<f>'; manifestPlaceholders = [linkPath: '/games/<file>.html'] }`.
5. **Flavor resources** in `android/arcade/app/src/<f>/res/values/`: `strings.xml` (`app_name`, `app_tagline`, `app_description`, `start_page`, `share_app_text`), `colors.xml` (`brand_bg`, `brand_bg2`, `brand_accent`, `brand_blue`, `ic_launcher_background`), `arrays.xml` (`ob_emoji`, `ob_titles`, `ob_bodies` = 4-slide welcome tour; `about_headings`, `about_bodies`). Copy `sudoku`'s files and rewrite; keep the arrays the same length. Avoid apostrophes in XML strings.
6. **App skin**: `android/arcade/web-overrides/<f>.css` (may be nearly empty; `sync-assets.js` requires the file to exist).
7. **Icons + Play graphics** with the generator (needs only Windows PowerShell):
   ```powershell
   $s = ".claude\skills\rovatics-arcade-android\scripts"
   powershell -ExecutionPolicy Bypass -File $s\New-BlocksGlyph.ps1 -Out $env:TEMP\glyph.png      # template: draw your own 432x432 glyph, art in the central ~66%
   powershell -ExecutionPolicy Bypass -File $s\New-ArcadeIcons.ps1 -Flavor <f> -Glyph $env:TEMP\glyph.png `
       -Title "<Game>" -Tagline "<short tagline>" -Bg1 "#0f6f86" -Bg2 "#19b5c9" -Accent "#7CF5C8"
   ```
   It writes the 5 launcher densities, round icons, adaptive foreground + `mipmap-anydpi-v26` XML, `play-assets/<f>/icon-512.png` and `feature-graphic-1024x500.png`. Set `ic_launcher_background` in `colors.xml` to `-Bg1`. **Look at the PNGs** (the round crop can cut the badge off; the first version did).
8. **Play listing**: `android/arcade/play-assets/<f>/store-listing.md` in the same format as `sudoku`'s (name 30, short 80, full 4000, what's new 500 characters). Verify the counts by script, do not eyeball.
9. **Deep links**: add the package to `.well-known/assetlinks.json` (same dev-key SHA-256 as the others). It only matters for games with invite/challenge links.
10. **README**: add the flavor to the table, the test list, and a short section for anything game-specific.
11. **Sync + regression check**: `node android/arcade/sync-assets.js`. The four other flavors' bundled pages must come out **unchanged** (`git status` on their `assets/` folders shows nothing real). If they differ, your `sync-assets.js` edit changed behaviour.
12. **Build, verify** (next section), then commit and push the branch.

## One-time toolchain (Windows, no admin)
This PC may have **no JDK, no Node, no Android SDK**. One script installs everything per-user under `C:\Android`, with checksum verification, and is safe to re-run:
```powershell
powershell -ExecutionPolicy Bypass -File .claude\skills\rovatics-arcade-android\scripts\Setup-AndroidToolchain.ps1 -WriteLocalProperties
```
Running it means accepting the Android SDK licence (ask the user first; about 700 MB download, 3 GB on disk). Notes learned the hard way:
- `winget install ... --scope user` fails ("No applicable installer"): Temurin/Node are machine-wide MSIs. The script unpacks the official zips instead.
- **Use cmdline-tools `11076708`, not the newest.** Current builds replace `sdkmanager` with a new "Android CLI" that downloads its own runtime and fails (`Unable to load jimage library`). If you hit that, delete `%USERPROFILE%\.android\cli` and use 11076708.
- Piping `y` into `sdkmanager.bat` does not answer the licence prompt; redirecting a file through `cmd /c "... < yes.txt"` does.
- `local.properties` must read `sdk.dir=C:/Android/Sdk` (forward slashes). Backslashes are escapes in `.properties` files and silently become `C:AndroidSdk`.
- Needs JDK **17** (Gradle 8.9, AGP 8.7.3), SDK platform 35, build-tools 34.0.0.

## Signing
`android/arcade/keystore.properties` (git-ignored) points at the key; `build.gradle` signs the release build only if it exists. For local TEST builds create a key **outside the repo**:
```
keytool -genkeypair -keystore C:\Android\keys\rovatics-TEST.jks -alias rovatics -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Rovatics TEST KEY, O=Rovatics, C=US"
```
then `storeFile=C:/Android/keys/rovatics-TEST.jks`, `storePassword`, `keyAlias=rovatics`, `keyPassword`. A freshly generated test key has a **different SHA-256** from the one in `assetlinks.json`, so App Links will not auto-verify for such builds (harmless for games without invite links). The real **upload key** and Play App Signing are the owner's job; remind them, never invent one.

## Build and collect (the documented output format)
```powershell
powershell -ExecutionPolicy Bypass -File .claude\skills\rovatics-arcade-android\scripts\Build-ArcadeApks.ps1 -Flavors sceneblocks
```
Runs `sync-assets.js`, then `gradlew assemble<F>Debug assemble<F>Release bundle<F>Release`, and writes to `C:\Android\arcade-builds\`:
`<Game>-debug.apk`, `<Game>-release-TESTKEY.apk`, `<Game>-release-TESTKEY.aab` (exactly the README's "Build outputs" names), then verifies each with `aapt2 dump badging` (package, label, version) and `apksigner verify`. No `-Flavors` builds all of them. The first run downloads Gradle 8.9 and the Android dependencies (several minutes); later runs are fast. The full Gradle log is kept as `last-build.log` beside the APKs. Without `keystore.properties` it builds the debug APK only and says so.

Manual equivalent: `node android/arcade/sync-assets.js`, then in `android/arcade`: `./gradlew assembleDebug assembleRelease bundleRelease` (outputs under `app/build/outputs/{apk,bundle}/`).

## Verify before calling it done
- **Tests**: `node tests/sudoku.test.js`, `node tests/beambots.test.js`, and the headless pages. Run a UI page with Edge/Chrome:
  `msedge --headless=new --disable-gpu --allow-file-access-from-files --virtual-time-budget=15000 --dump-dom tests/<game>-ui-test.html`
  (`--allow-file-access-from-files` is required for the iframe to be scriptable.) Wrap it in `timeout 90`; an animated canvas under virtual time can hang. A test that calls `location.reload()` inside `onload` loops forever: guard it with a counter.
- **Real device or emulator**: the README says "test on a real phone before publishing"; headless checks do not prove the splash, tour, Back handling or touch input. With a phone on USB and debugging on: `C:\Android\Sdk\platform-tools\adb install -r <file>.apk`. Say plainly when you did not run the app on a device.
- **Regression**: other flavors' bundled assets unchanged after sync (step 11).
- **Hygiene**: `git status` shows no `.jks`, `.apk`, `.aab`, `keystore.properties`, `local.properties`.

## Pull request
Commit in logical pieces (game adaptation + flavor + icons/listing; tooling/skill as a separate commit). Push `f-<f>-android`. PR target `f-arcade-android`. The description should list: what changed in the web game, the new flavor files, test results (counts), what was **not** verified (device run, real upload key, App Links), and that APKs are not in the PR.

## Troubleshooting
| Symptom | Cause / fix |
|---|---|
| `SYNC FAILED: could not find the Rovatics badge image` | The game page lacks the badge block (contract item 1). |
| `Unable to load jimage library` from sdkmanager | Newest cmdline-tools; use 11076708 (see toolchain). |
| `Duplicate class kotlin.*` | Already pinned in `app/build.gradle`; do not remove the `resolutionStrategy` block. |
| `SDK location not found` / `C:AndroidSdk` | Fix `local.properties` (forward slashes). |
| Release APK builds but will not install | No signing config: `keystore.properties` missing. |
| Launcher icon shows only part of the badge | Round crop; regenerate with a smaller glyph / scale (see `New-ArcadeIcons.ps1`). |
| Game layout cut off at the bottom in the app | `common.css` 64px body padding stacked on the game's own reserve; override in `web-overrides/<f>.css`. |
