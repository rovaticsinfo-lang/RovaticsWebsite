#!/usr/bin/env node
/*
 * Copies the three web games into the Android app (one assets folder per product flavor) and applies the few
 * changes the app build needs. Run it after editing any game:
 *
 *     node android/arcade/sync-assets.js
 *
 * What it changes in the bundled copy, and why:
 *   1. The Rovatics badge image points at a bundled, circle-masked logo.
 *   2. viewport-fit=cover, so the page reaches under rounded corners and cutouts.
 *   3. web-overrides/common.css + <game>.css and common.js are linked in (app skin + native behaviour).
 *      The website never loads them.
 * The games already provide window.__androidBack() and use window.RovaticsApp when present.
 *
 * Every substitution is asserted, so if a game changes shape this script fails loudly instead of shipping a broken app.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(ROOT, 'games');
const LOGO_APP = path.join(ROOT, 'android', 'cardclash', 'app', 'src', 'main', 'assets', 'game', 'logo.png'); // circle-masked
const LOGO_SITE = path.join(ROOT, 'assets', 'rovatics-logo.png');

const GAMES = {
  sudoku:   { page: 'sudoku.html',               extra: ['sudoku-engine.js'] },
  racers:   { page: 'kids-car-race-game.html',   extra: [] },
  beambots: { page: 'beambots.html',             extra: ['beambots-engine.js'] }
};

function must(haystack, needle, what, page) {
  if (haystack.indexOf(needle) < 0) {
    console.error('\nSYNC FAILED: could not find ' + what + ' in ' + page);
    console.error('Looked for: ' + needle.slice(0, 90));
    console.error('The web game has changed shape. Update sync-assets.js to match.\n');
    process.exit(1);
  }
}

Object.keys(GAMES).forEach(function (flavor) {
  const g = GAMES[flavor];
  const dest = path.join(__dirname, 'app', 'src', flavor, 'assets', 'game');
  fs.mkdirSync(dest, { recursive: true });

  g.extra.forEach(function (f) { fs.copyFileSync(path.join(SRC, f), path.join(dest, f)); console.log(flavor + ': copied   ' + f); });

  let html = fs.readFileSync(path.join(SRC, g.page), 'utf8');

  const IMG = 'src="../assets/rovatics-logo.png"';
  must(html, IMG, 'the Rovatics badge image', g.page);
  html = html.split(IMG).join('src="logo.png"');

  const VP_PLAIN = '<meta name="viewport" content="width=device-width, initial-scale=1">';
  const VP_FIT = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">';
  if (html.indexOf(VP_PLAIN) >= 0) html = html.replace(VP_PLAIN, VP_FIT);
  else must(html, VP_FIT, 'the viewport meta tag', g.page);

  must(html, '</head>', 'the closing head tag', g.page);
  must(html, '</body>', 'the closing body tag', g.page);
  html = html.replace('</head>', '<link rel="stylesheet" href="common.css">\n<link rel="stylesheet" href="' + flavor + '.css">\n</head>');
  html = html.replace('</body>', '<script src="common.js"></script>\n</body>');

  ['common.css', 'common.js'].forEach(function (f) { fs.copyFileSync(path.join(__dirname, 'web-overrides', f), path.join(dest, f)); });
  fs.copyFileSync(path.join(__dirname, 'web-overrides', flavor + '.css'), path.join(dest, flavor + '.css'));
  fs.writeFileSync(path.join(dest, g.page), html);
  console.log(flavor + ': adapted  ' + g.page);

  fs.copyFileSync(fs.existsSync(LOGO_APP) ? LOGO_APP : LOGO_SITE, path.join(dest, 'logo.png'));
});

console.log('\nAssets are in sync. Build with:  cd android/arcade && ./gradlew assembleDebug  (or bundleRelease)');
