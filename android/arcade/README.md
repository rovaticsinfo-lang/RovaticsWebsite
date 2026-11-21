# Rovatics Arcade — Android apps (Sudoku, Racers, Beam Bots)

One Gradle project, three Play Store apps (product flavors). Each app is a native shell (splash, welcome tour, About, haptics,
share sheet, Back handling, edge-to-edge + keyboard-safe layout) around the offline web game from `games/`.

| Flavor | Application ID | Game |
|---|---|---|
| sudoku | com.rovatics.sudoku | games/sudoku.html |
| racers | com.rovatics.racers | games/kids-car-race-game.html |
| beambots | com.rovatics.beambots | games/beambots.html |

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
- No permissions, no INTERNET, no ads, no data collected → simplest Data-safety form ("no data collected").
- Privacy policy URL: https://rovatics.com/privacy.html (must be live).
- Add 2-8 phone screenshots per app; complete content rating and target audience (Racers: see its listing note on Families policy).
- New personal developer accounts must run a closed test (12 testers, 14 days) before production.

## Tests
`node tests/sudoku.test.js`, `node tests/beambots.test.js`, and the headless-Chrome pages `tests/ui-test.html`,
`tests/racers-ui-test.html`, `tests/beambots-ui-test.html` (open with `chrome --headless --dump-dom`).

## Verified
Built (debug, release APK, release AAB) for all three flavors; installed on an Android emulator: splash, welcome tour, game screens,
race popups and Back handling confirmed. **Test on a real phone before publishing.** Sudoku challenge links open rovatics.com in the friend's browser.
