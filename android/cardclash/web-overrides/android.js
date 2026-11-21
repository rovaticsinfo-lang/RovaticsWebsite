/* Card Clash — Android app behaviour.
   Injected ONLY into the copy of the game bundled in the app (see sync-assets.js).
   Talks to the native side through window.RovaticsApp, which MainActivity exposes.
   Everything is guarded, so the page still works if the bridge is missing. */
(function () {
  'use strict';
  var app = window.RovaticsApp || null;
  function call(name) { try { if (app && app[name]) return app[name].apply(app, Array.prototype.slice.call(arguments, 1)); } catch (e) {} }

  document.addEventListener('DOMContentLoaded', function () {
    // 1. The fan of cards that makes the home screen feel like an app, not a page.
    var home = document.getElementById('home');
    if (home && !home.querySelector('.app-fan')) {
      var fan = document.createElement('div');
      fan.className = 'app-fan'; fan.setAttribute('aria-hidden', 'true');
      fan.innerHTML = '<i>🏏</i><i>🤼</i><i>🤖</i>';
      home.insertBefore(fan, home.firstChild);
      var h1 = home.querySelector('h1'); if (h1) h1.textContent = 'Card Clash';
    }

    // 2. An About button in the app bar (opens the native About screen).
    var bar = document.querySelector('.topbar');
    if (bar && !document.getElementById('aboutBtn')) {
      var b = document.createElement('button');
      b.className = 'btn sm'; b.id = 'aboutBtn'; b.type = 'button'; b.setAttribute('aria-label', 'About Card Clash');
      b.textContent = 'ℹ️ About';
      b.addEventListener('click', function () { call('openAbout'); });
      bar.insertBefore(b, bar.firstChild);
    }

    // 3. A web page can't share an "invite link" from inside the app (its address is internal),
    //    so hand the room code to the Android share sheet instead.
    var copy = document.getElementById('copyBtn');
    if (copy) {
      copy.textContent = '📤 Invite friends';
      copy.addEventListener('click', function (e) {
        var code = (document.getElementById('roomCode') || {}).textContent || '';
        if (!/^[A-Z0-9]{5}$/.test(code)) return;
        e.preventDefault(); e.stopImmediatePropagation();
        call('share', 'Join my Card Clash room! Open the app, tap "Join a friend" and enter the code: ' + code);
      }, true);
    }

    // 4. Haptics: a light tick on every button, a firmer buzz when a dialog (win screen, rules...) opens.
    var ov = document.getElementById('overlay');
    if (ov && window.MutationObserver) {
      new MutationObserver(function () { if (!ov.hidden) call('haptic', 'heavy'); }).observe(ov, { attributes: true, attributeFilter: ['hidden'] });
    }
  });

  document.addEventListener('pointerdown', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('button') : null;
    if (t && !t.disabled) call('haptic', 'tick');
  }, true);

  // The game wins/loses rounds with an animation; buzz on the reveal banner turning into a result.
  document.addEventListener('DOMContentLoaded', function () {
    var banner = document.getElementById('banner');
    if (banner && window.MutationObserver) {
      new MutationObserver(function () {
        if (banner.classList.contains('win')) call('haptic', 'success');
        else if (banner.classList.contains('lose')) call('haptic', 'reject');
      }).observe(banner, { attributes: true, attributeFilter: ['class'] });
    }
  });
})();
