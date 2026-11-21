# Rovatics Arcade — Android apps (Card Clash, Sudoku, Racers, Beam Bots, Scene Blocks)

One Gradle project, five Play Store apps (product flavors). Each app is a native shell (splash, welcome tour, About, haptics,
share sheet, Back handling, edge-to-edge + keyboard-safe layout) around the offline web game from `games/`.

| Flavor | Application ID | Game |
|---|---|---|
| cardclash | com.rovatics.cardclash | games/cardclash.html (only app with INTERNET, for online rooms) |
| sudoku | com.rovatics.sudoku | games/sudoku.html |
| racers | com.rovatics.racers | games/kids-car-race-game.html |
| beambots | com.rovatics.beambots | games/beambots.html |
| sceneblocks | com.rovatics.sceneblocks | games/scene-blocks.html |

## Build
```
node android/arcade/sync-assets.js        # copy + adapt the web games into the app (re-run after editing a game)
cd android/arcade
./gradlew assembleDebug                    # debug APKs  -> app/build/outputs/apk/<flavor>/debug/
./gradlew assembleRelease bundleRelease    # signed APKs + .aab (Play upload) -> app/build/outputs/bundle/<flavor>Release/
```
Needs JDK 17 and the Android SDK (35). Create `local.properties` with `sdk.dir=...`.

## Signing (important)
`keystore.properties` (git-ignored) points at the signing key. The one on the dev machine is a **TEST key — never upload test-signed
builds to Play**. Create your own upload key (see `keystore.properties.example`), back it up safely, then rebuild `bundleRelease`.
Enrol in Play App Signing when creating each app in Play Console.

## Play checklist
- Listings, icons and feature graphics: `play-assets/<flavor>/`.
- Sudoku / Racers / Beam Bots / Scene Blocks: no permissions, no INTERNET, no ads, no data collected → simplest Data-safety form. Card Clash: INTERNET only (online rooms; see below).
- Privacy policy URL: https://rovatics.com/privacy.html (must be live).
- Add 2-8 phone screenshots per app; complete content rating and target audience (Racers: see its listing note on Families policy).
- New personal developer accounts must run a closed test (12 testers, 14 days) before production.

## Tests
`node tests/sudoku.test.js`, `node tests/beambots.test.js`, and the headless-Chrome pages `tests/ui-test.html`,
`tests/racers-ui-test.html`, `tests/beambots-ui-test.html`, `tests/sceneblocks-ui-test.html` (open with `chrome --headless --dump-dom`).

## Verified
Built (debug, release APK, release AAB) for all three flavors; installed on an Android emulator: splash, welcome tour, game screens,
race popups and Back handling confirmed. **Test on a real phone before publishing.** Sudoku challenge links open rovatics.com in the friend's browser.

## Scene Blocks
Offline canvas puzzle (1000 levels, rotatable shapes, animated scenes). It follows the same contract as the other offline games:
Rovatics badge, `window.__androidBack`, haptics through `RovaticsApp.haptic`, and `viewport-fit=cover`. Two things are specific to it:
- The page keeps a bottom strip free through the CSS variable `--reserve` (34px on the web for the badge). `web-overrides/sceneblocks.css`
  raises it to 64px in the app, so the floating About button has room too, and removes `common.css`'s own body padding.
- Back closes the level picker, or opens it from a win/lose card; during play it falls through to "press back again to exit".
Scene Blocks has no invite or challenge links. Its `assetlinks.json` entry only exists to keep every package listed in one place.

## Card Clash: online rooms, invite links and the TURN relay
- **Invite links** (`https://www.rovatics.com/games/cardclash.html?room=CODE`, and Sudoku `?c=...` challenge links) open the app (Android App Links) and show
  "Join room / No thanks" (Sudoku: "Accept / Decline"). For Android to open them *automatically*, `/.well-known/assetlinks.json` (website repo root) must list the
  SHA-256 of the key that signs the installed app. It lists the TEST key now. After your first Play upload add the **Play App Signing** SHA-256
  (Play Console > Setup > App signing) for each package. Until then the link opens in the browser, which shows an "Open app" button.
- **Phones on different mobile networks** use the Metered TURN relay configured in `games/turn-config.js` (credentials are public in the page/app; free tier,
  rotate in the Metered dashboard if abused, then re-run `node android/arcade/sync-assets.js` and rebuild). Verified: an emulator host behind NAT and a desktop
  guest, both forced through the relay (`window.RV_FORCE_RELAY = true`), joined and played rounds together.
- **Shared invite**: the message contains the room code and the link. The link opens the app (the web page tries `intent://` automatically on Android), the code is
  pre-filled in the Join box and a "You are invited" dialog asks for a name and "Join room".
- The host app keeps its room alive while backgrounded (flavor bool `keep_alive_in_background`); joiners retry for ~10 s.
- Data safety: online rooms send IP addresses to PeerJS signalling / STUN (and your TURN) servers; declare accordingly in Play Console.
- Card Clash upgrade note: the app is the same applicationId and signing key as before, so existing installs update in place.

## Build outputs
`./gradlew assembleDebug assembleRelease bundleRelease` then copy results to one folder, e.g. `E:/Android/arcade-builds/`
(`<Game>-debug.apk`, `<Game>-release-TESTKEY.apk`, `<Game>-release-TESTKEY.aab`).
