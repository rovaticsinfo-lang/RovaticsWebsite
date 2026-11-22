#!/usr/bin/env node
/*
 * Copies the web games into the Android app (one assets folder per product flavor) and applies the few
 * changes the app build needs. Run it after editing any game:
 *
 *     node android/arcade/sync-assets.js
 *
 * What it changes in the bundled copy, and why:
 *   1. The Rovatics badge image points at a bundled, circle-masked logo.
 *   2. viewport-fit=cover, so the page reaches under rounded corners and cutouts.
 *   3. web-overrides/<game>.css (+ common.css/common.js for the offline games) are linked in: the app skin
 *      and native behaviour. The website never loads them.
 *   4. Card Clash only: PeerJS is loaded from a bundled copy (no CDN, no remote code), and a window.__androidBack()
 *      hook closes a dialog, then leaves the room, before the app will exit. The other games define that hook themselves.
 *
 * Every substitution is asserted, so if a game changes shape this script fails loudly instead of shipping a broken app.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(ROOT, 'games');
const VENDOR = path.join(__dirname, 'web-overrides', 'vendor');

const GAMES = {
  sudoku:   { page: 'sudoku.html',             extra: ['sudoku-engine.js', 'open-in-app.js'], common: true },
  racers:   { page: 'kids-car-race-game.html', extra: [],                                      common: true },
  beambots: { page: 'beambots.html',           extra: ['beambots-engine.js'],                  common: true },
  sceneblocks: { page: 'scene-blocks.html',    extra: [],                                      common: true },
  mindverse: { page: 'mindverse.html', common: true,
    extra: ['mindverse-engine.js', 'mindverse-levels.js', 'mindverse-gfx.js', 'mindverse-props.js', 'mindverse-world.js', 'vendor/three.min.js'] },
  cardclash: {
    page: 'cardclash.html', extra: ['cardclash-engine.js', 'cardclash-data.js', 'open-in-app.js', 'turn-config.js'], common: false,
    vendor: ['peerjs.min.js'],
    transform: function (html, must) {
      const CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js"></script>';
      must(html, CDN, 'the PeerJS CDN tag');
      html = html.replace(CDN, '<script src="cardclash.js"></script>\n<script src="peerjs.min.js"></script>');
      const BRIDGE = [
        '', '<script>',
        '/* Added by sync-assets.js for the Android app. MainActivity calls this on Back:',
        '   return true when the game handled it, false to let the app ask about exiting. */',
        '(function () {',
        '  window.__androidBack = function () {',
        "    var ov = document.getElementById('overlay');",
        '    if (ov && !ov.hidden) { ov.hidden = true; return true; }   // close a dialog',
        "    var leave = document.getElementById('leaveBtn');",
        '    if (leave && !leave.hidden) { leave.click(); return true; } // leave the room first',
        '    return false;                                              // at the home screen: let the app exit',
        '  };', '})();', '</script>', ''
      ].join('\n');
      must(html, '</body>', 'the closing body tag');
      return html.replace(/<\/body>/, BRIDGE + '</body>');
    }
  }
};

Object.keys(GAMES).forEach(function (flavor) {
  const g = GAMES[flavor];
  const must = function (haystack, needle, what) {
    if (haystack.indexOf(needle) < 0) {
      console.error('\nSYNC FAILED: could not find ' + what + ' in ' + g.page);
      console.error('Looked for: ' + needle.slice(0, 90));
      console.error('The web game has changed shape. Update sync-assets.js to match.\n');
      process.exit(1);
    }
  };
  const dest = path.join(__dirname, 'app', 'src', flavor, 'assets', 'game');
  fs.mkdirSync(dest, { recursive: true });

  g.extra.forEach(function (f) { fs.mkdirSync(path.dirname(path.join(dest, f)), { recursive: true }); fs.copyFileSync(path.join(SRC, f), path.join(dest, f)); console.log(flavor + ': copied   ' + f); });
  (g.vendor || []).forEach(function (f) { fs.copyFileSync(path.join(VENDOR, f), path.join(dest, f)); console.log(flavor + ': copied   ' + f); });
  fs.copyFileSync(path.join(VENDOR, 'logo.png'), path.join(dest, 'logo.png'));

  let html = fs.readFileSync(path.join(SRC, g.page), 'utf8');

  const IMG = 'src="../assets/rovatics-logo.png"';
  must(html, IMG, 'the Rovatics badge image');
  html = html.split(IMG).join('src="logo.png"');

  const VP_PLAIN = '<meta name="viewport" content="width=device-width, initial-scale=1">';
  const VP_FIT = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">';
  if (html.indexOf(VP_PLAIN) >= 0) html = html.replace(VP_PLAIN, VP_FIT);
  // A game may already carry its own viewport meta (e.g. Scene Blocks adds user-scalable=no); all we need is viewport-fit=cover.
  else must(html, 'viewport-fit=cover', 'a viewport meta tag with viewport-fit=cover');

  must(html, '</head>', 'the closing head tag');
  must(html, '</body>', 'the closing body tag');
  if (g.common) {
    html = html.replace('</head>', '<link rel="stylesheet" href="common.css">\n<link rel="stylesheet" href="' + flavor + '.css">\n</head>');
    html = html.replace('</body>', '<script src="common.js"></script>\n</body>');
    ['common.css', 'common.js'].forEach(function (f) { fs.copyFileSync(path.join(__dirname, 'web-overrides', f), path.join(dest, f)); });
    fs.copyFileSync(path.join(__dirname, 'web-overrides', flavor + '.css'), path.join(dest, flavor + '.css'));
  } else {
    html = html.replace('</head>', '<link rel="stylesheet" href="' + flavor + '.css">\n</head>');
    fs.copyFileSync(path.join(__dirname, 'web-overrides', flavor + '.css'), path.join(dest, flavor + '.css'));
    fs.copyFileSync(path.join(__dirname, 'web-overrides', flavor + '.js'), path.join(dest, flavor + '.js'));
  }
  if (g.transform) html = g.transform(html, must);

  fs.writeFileSync(path.join(dest, g.page), html);
  console.log(flavor + ': adapted  ' + g.page);
});

console.log('\nAssets are in sync. Build with:  cd android/arcade && ./gradlew assembleDebug  (or bundleRelease)');
