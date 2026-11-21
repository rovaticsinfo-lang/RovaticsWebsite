/* Rovatics Arcade — Android app behaviour shared by Sudoku, Racers and Beam Bots.
   Injected ONLY into the copies of the games bundled in the apps (see sync-assets.js).
   Talks to the native side through window.RovaticsApp, which MainActivity exposes.
   Everything is guarded, so a game still works if the bridge is missing. The games themselves
   already buzz, share and handle Back through RovaticsApp / window.__androidBack. */
(function () {
  'use strict';
  var app = window.RovaticsApp || null;

  document.addEventListener('DOMContentLoaded', function () {
    // An About button that opens the native About screen (privacy, rate, share, contact).
    if (!document.getElementById('appAbout')) {
      var b = document.createElement('button');
      b.id = 'appAbout'; b.type = 'button'; b.setAttribute('aria-label', 'About this app'); b.textContent = 'ℹ️';
      b.addEventListener('click', function () { try { if (app && app.openAbout) app.openAbout(); } catch (e) {} });
      document.body.appendChild(b);
    }
    // Keep a focused text field visible above the keyboard (the app also resizes the page for it).
    document.addEventListener('focusin', function (e) {
      var t = e.target; if (!t || (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA')) return;
      setTimeout(function () { try { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (x) {} }, 350);
    });
    // No long-press menu: handled in the page, not by a native blocker that can interfere with scrolling.
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  });
})();
