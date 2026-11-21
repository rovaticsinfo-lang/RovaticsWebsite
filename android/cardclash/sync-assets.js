#!/usr/bin/env node
/*
 * Copies the Card Clash web game into the Android app and applies the few
 * changes the app build needs. Run it from anywhere after editing the web game:
 *
 *     node android/cardclash/sync-assets.js
 *
 * What it changes, and why:
 *   1. PeerJS is loaded from a bundled copy instead of a CDN, so the app does not
 *      depend on cdnjs being reachable and ships no remote code.
 *   2. The Rovatics badge image points at the copy inside the app assets.
 *   3. viewport-fit=cover, so the page reaches under rounded corners and cutouts.
 *   4. A window.__androidBack() hook, which MainActivity calls on the Back button:
 *      it closes a dialog, then leaves the room, before the app will exit.
 *   5. web-overrides/android.css and android.js, which give the game an app-style layout
 *      and native behaviour (haptics, share sheet, About button). The website never loads them.
 *
 * Every substitution is asserted, so if the web game changes shape this script
 * fails loudly instead of silently shipping a broken app.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(ROOT, 'games');
const DEST = path.join(__dirname, 'app/src/main/assets/game');
const LOGO = path.join(ROOT, 'assets', 'rovatics-logo.png');

function must(haystack, needle, what) {
  if (haystack.indexOf(needle) < 0) {
    console.error('\nSYNC FAILED: could not find ' + what + ' in cardclash.html');
    console.error('Looked for: ' + needle.slice(0, 90));
    console.error('The web game has changed shape. Update sync-assets.js to match.\n');
    process.exit(1);
  }
}

fs.mkdirSync(DEST, { recursive: true });

// --- plain copies ----------------------------------------------------------
['cardclash-engine.js', 'cardclash-data.js', 'open-in-app.js', 'turn-config.js'].forEach(function (f) {
  fs.copyFileSync(path.join(SRC, f), path.join(DEST, f));
  console.log('copied   ' + f);
});

// --- the page, with Android adaptations ------------------------------------
let html = fs.readFileSync(path.join(SRC, 'cardclash.html'), 'utf8');

const CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js"></script>';
must(html, CDN, 'the PeerJS CDN tag');
html = html.replace(CDN, '<script src="peerjs.min.js"></script>');

const IMG = 'src="../assets/rovatics-logo.png"';
must(html, IMG, 'the Rovatics badge image');
html = html.split(IMG).join('src="logo.png"');

const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1">';
must(html, VIEWPORT, 'the viewport meta tag');
html = html.replace(VIEWPORT,
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');

must(html, '</body>', 'the closing body tag');
const BRIDGE = [
  '',
  '<script>',
  '/* Added by sync-assets.js for the Android app. MainActivity calls this on Back:',
  '   return true when the game handled it, false to let the app ask about exiting. */',
  '(function () {',
  "  window.__androidBack = function () {",
  "    var ov = document.getElementById('overlay');",
  '    if (ov && !ov.hidden) { ov.hidden = true; return true; }   // close a dialog',
  "    var leave = document.getElementById('leaveBtn');",
  '    if (leave && !leave.hidden) { leave.click(); return true; } // leave the room first',
  '    return false;                                              // at the home screen: let the app exit',
  '  };',
  '})();',
  '</script>',
  ''
].join('\n');
html = html.replace(/<\/body>/, BRIDGE + '</body>');

// App skin + behaviour. The CSS goes last in <head> so it wins; the JS runs before the page scripts
// so window.RovaticsApp is read as soon as possible.
must(html, '</head>', 'the closing head tag');
html = html.replace('</head>', '<link rel="stylesheet" href="android.css">' + String.fromCharCode(10) + '</head>');;
html = html.replace('<script src="peerjs.min.js"></script>', '<script src="android.js"></script>' + String.fromCharCode(10) + '<script src="peerjs.min.js"></script>');
['android.css', 'android.js'].forEach(function (f) {
  fs.copyFileSync(path.join(__dirname, 'web-overrides', f), path.join(DEST, f));
  console.log('copied   ' + f);
});

fs.writeFileSync(path.join(DEST, 'cardclash.html'), html);
console.log('adapted  cardclash.html');

// --- the badge logo, circle-masked so it sits on the dark background --------
if (!fs.existsSync(path.join(DEST, 'logo.png'))) {
  fs.copyFileSync(LOGO, path.join(DEST, 'logo.png'));
  console.log('copied   logo.png (fallback: not circle-masked)');
}

if (!fs.existsSync(path.join(DEST, 'peerjs.min.js'))) {
  console.error('\nWARNING: peerjs.min.js is missing from ' + DEST);
  console.error('Download it once with:');
  console.error('  curl -fsSL https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js -o "' + path.join(DEST, 'peerjs.min.js') + '"\n');
  process.exit(1);
}

console.log('\nAssets are in sync. Build with:  cd android/cardclash && ./gradlew bundleRelease');
