# Card Clash — Android app

An Android wrapper around the Card Clash web game, ready to build into an **AAB** for the
Google Play Console.

The game itself is unchanged HTML/JS/CSS, bundled inside the app and served to a `WebView`
over `https://appassets.androidplatform.net/` by `WebViewAssetLoader`. That gives the page a
real secure origin, so `localStorage`, the clipboard and WebRTC behave exactly as they do on
rovatics.com. Nothing is downloaded at runtime — PeerJS ships inside the app.

| | |
|---|---|
| Application ID | `com.rovatics.cardclash` |
| Version | `1.0.0` (versionCode `1`) |
| Min SDK | 24 (Android 7.0) |
| Target / compile SDK | 35 (Android 15) |
| Language | Java 17 |
| App size | roughly 2–3 MB |

---

## 1. Prerequisites

Install **Android Studio** (it brings the Android SDK and Gradle with it). Nothing else is
needed — this machine already has JDK 17, but Android Studio ships its own JDK too.

> **Built and verified.** The project compiles with Android SDK 35 / Gradle 8.9 / JDK 17 and produces
> a debug APK (3.6 MB) and a release AAB (2.8 MB). It has **not** been run on a physical device or
> emulator yet, and the release AAB is **unsigned** until you add your upload key (section 3).

## 2. Open and run

```
Android Studio  →  File  →  Open  →  select  android/cardclash
```

Press **Run** to install a debug build on a connected phone or emulator. From the command
line, once the SDK is installed:

```bash
cd android/cardclash
./gradlew assembleDebug      # debug APK  -> app/build/outputs/apk/debug/
```

## 3. One-time: create your upload key

Google Play needs a signed build. Create the keystore **once** and back it up somewhere safe —
if you lose it you can no longer publish updates to the same listing.

```bash
keytool -genkeypair -v -keystore cardclash-release.jks \
    -keyalg RSA -keysize 2048 -validity 10000 -alias cardclash
```

Then copy the example file and fill in the real values:

```bash
cp keystore.properties.example keystore.properties
```

`keystore.properties` and `*.jks` are listed in `.gitignore` and **must never be committed**.

## 4. Build the release bundle for Play

```bash
cd android/cardclash
./gradlew bundleRelease       # -> app/build/outputs/bundle/release/app-release.aab
```

Upload that `.aab` in the Play Console. (Play has required App Bundles rather than APKs for
new apps since 2021. If you need a plain APK for side-loading or testing, use
`./gradlew assembleRelease`.)

## 5. Keeping the app in step with the website

The app has its own copy of the game under `app/src/main/assets/game/`. After changing the web
game in `games/`, re-sync it:

```bash
node android/cardclash/sync-assets.js
```

That copies the engine, data and page across and applies four Android-specific changes:

1. PeerJS loads from the bundled copy instead of a CDN, so the app ships no remote code.
2. The Rovatics badge points at the bundled logo.
3. `viewport-fit=cover`, so the page reaches under rounded corners and camera cutouts.
4. A `window.__androidBack()` hook that `MainActivity` calls on the Back button.

Each substitution is asserted — if the web game changes shape the script **fails loudly**
rather than silently shipping a broken app.

---

## 6. Play Console checklist

Assets already generated for you, in `play-assets/`:

- `icon-512.png` — 512×512 app icon
- `feature-graphic-1024x500.png` — the banner shown at the top of the listing

Still to do in the Play Console:

- [ ] **Screenshots** — at least 2 phone screenshots (min 320 px, max 3840 px on the long
      edge). Run the app and capture the lobby, a card reveal and the winner screen.
- [ ] **Privacy policy URL** — required for every app. You already have
      <https://rovatics.com/privacy.html>; make sure it covers what the app does (see below).
- [ ] **Data safety form** — answer it from the facts below, not from a template.
- [ ] **Content rating questionnaire** — note that the Wrestling deck is combat-themed.
- [ ] **Target audience and content** — if you tick under-13, Families Policy applies and the
      rules get much stricter.
- [ ] **Target API level** — this project targets API 35. Play raises the minimum every year
      (it was API 35 from Aug 2025). **Check the current requirement in the Console** and if it
      is higher, change `compileSdk` and `targetSdk` in `app/build.gradle` and rebuild.
- [ ] **App signing** — let Play manage the app signing key (recommended); your `.jks` is then
      only the upload key.

### What to declare on the Data safety form

Be accurate here — it is the part most often filled in wrongly.

| Question | Answer for this app |
|---|---|
| Does it collect or share user data? | Yes, a small amount |
| What | The **display name** the player types, plus in-game moves |
| Where does it go | Directly to the other players in the room, peer-to-peer (WebRTC). It is not sent to a Rovatics server and is not stored anywhere after the game |
| Stored on device | Player name, win/loss record, and the sound setting, in `localStorage` |
| Is data encrypted in transit | Yes — WebRTC connections are encrypted |
| Can users request deletion | Yes — clearing the app's storage removes everything |
| Third party | Connection setup uses the **public PeerJS broker** (`0.peerjs.com`), which sees the randomly generated room ID and connection metadata |

---

## 7. Things to decide before you publish

**1. Real people's names (please read).** The Cricket deck uses real cricketers and the
Wrestling deck real wrestlers, with made-up or approximate statistics. Publishing that
commercially is a different matter from hosting it on your own site: names and personas can be
protected by publicity rights, and "WWE" and wrestler names are trademarks. I am not a lawyer
and this is not legal advice, but this is the single biggest risk in shipping this app as-is.
The safest fix is to replace both decks with original characters — the Robots deck already
shows the game plays just as well with invented ones. Say the word and I will do the swap.

**2. The multiplayer broker.** Online play depends on the free public PeerJS server, which has
no uptime guarantee. For a published app it would be worth running your own PeerJS server or
moving to a hosted realtime service. Bot games work with no network at all.

**3. Ads, payments, accounts.** There are none, which keeps the Play review simple. Adding any
of them changes the Data safety answers and the content rating.

---

## 8. What has and has not been tested

**Run on an Android 15 emulator** (x86_64, Google APIs), installing the debug APK as a first-time user:

- the branded splash, then the **4-page welcome tour** (only on first launch, never again after)
- the game in full-screen: home, lobby, and a bot game with card flips, reveals and the reactions bar
- the **About** screen from the app bar: version read from the installed app, what the game is, features,
  how to play, permissions & privacy, notice, credits, and the Share / Rate / tour / privacy / website /
  contact buttons
- typing a name on the Android keyboard
- **Back button**: one press stays in the game, a second press exits
- no crash from Card Clash at any point

**Built:** `./gradlew assembleDebug` and `./gradlew bundleRelease` succeed.

**Verified in a browser:** the bundled game passes the full Card Clash test suite.

**Not verified:** a physical phone and real hardware haptics, the Share sheet and e-mail hand-off (they open other
apps), and online play between two devices. Please try those on your phone before uploading to Play.

### Where the app differs from the website

The website game in `games/` is unchanged. The app copy gets two extra files, `web-overrides/android.css` and
`android.js`, injected by `sync-assets.js`. They give it an app-style launcher home, phone-sized lobby and game
layouts, an app bar, no text selection, a floating reactions bar, bottom-sheet dialogs, haptics, and a native share
sheet in place of an invite link (which would have pointed at the app's internal address).

### First-time setup on a new machine

`local.properties` (git-ignored) must point at your Android SDK, using **forward slashes** -- a backslash
in a properties file is an escape character and silently corrupts the path:

```
sdk.dir=C:/Users/you/AppData/Local/Android/Sdk
```

### Before you publish

- The About screen's **Rate on Google Play** and **Share the app** buttons point at the Play listing id and
  rovatics.com. Once the app is live, change the share text in `res/values/strings.xml` to the Play Store URL.
- The listing text for the Play Console is ready to paste from `play-assets/store-listing.md`.
