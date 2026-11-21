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

    // 4. Lobby: dock "Start game" at the bottom so it is always on screen, and fold the three option rows into one line.
    var startBtn = document.getElementById('startBtn'), lobby = document.getElementById('lobby');
    if (startBtn && lobby && !document.getElementById('appDock')) {
      var dock = document.createElement('div'); dock.className = 'app-dock'; dock.id = 'appDock'; dock.hidden = true;
      dock.appendChild(startBtn.parentNode);                       // the row holding Start + the "waiting for host" note
      document.body.appendChild(dock);
      var sync = function () { dock.hidden = lobby.hidden; };
      sync(); if (window.MutationObserver) new MutationObserver(sync).observe(lobby, { attributes: true, attributeFilter: ['hidden'] });
    }
    var box = document.getElementById('settingsBox');
    if (box && !box.querySelector('.opt-toggle')) {
      var tg = document.createElement('button'); tg.type = 'button'; tg.className = 'opt-toggle';
      box.classList.add('collapsed'); box.insertBefore(tg, box.firstChild);
      var label = function () {
        var sel = function (id) { var e = document.querySelector('#' + id + ' .optbtn.sel'); return e ? e.textContent.replace(/^[^A-Za-z0-9]+/, '').trim() : ''; };
        var per = sel('perChips'), len = sel('lenChips'), sp = sel('spdChips');
        var html = '<span>⚙️ Game options</span><small>' + (per ? per + ' cards each · ' + len + ' · ' + sp : 'tap to change') + (box.classList.contains('collapsed') ? ' ▾' : ' ▴') + '</small>';
        if (tg.innerHTML !== html) tg.innerHTML = html;        // never rewrite an unchanged label: that would re-trigger the observer
      };
      tg.addEventListener('click', function () { box.classList.toggle('collapsed'); label(); if (!box.classList.contains('collapsed')) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
      // Watch ONLY the three option rows. (Watching the whole box would also see our own label update and loop forever.)
      label(); if (window.MutationObserver) { var mo = new MutationObserver(label); ['perChips', 'lenChips', 'spdChips'].forEach(function (id) { var e = document.getElementById(id); if (e) mo.observe(e, { childList: true, subtree: true, attributes: true }); }); }
    }

    // 5. Keyboard: bring a focused field into view (the app also resizes the page for the keyboard).
    document.addEventListener('focusin', function (e) {
      var t = e.target; if (!t || (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA')) return;
      setTimeout(function () { try { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (x) {} }, 350);
    });
    // No long-press menu or text selection: handled here in the page, not by a native blocker that can interfere with scrolling.
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // 6. Haptics: a light tick on every button, a firmer buzz when a dialog (win screen, rules...) opens.
    var ov = document.getElementById('overlay');
    if (ov && window.MutationObserver) {
      new MutationObserver(function () { if (!ov.hidden) call('haptic', 'heavy'); }).observe(ov, { attributes: true, attributeFilter: ['hidden'] });
    }
  });

  // The game fires 'cc-turn' when it becomes the player's turn: give the phone a firm double-buzz.
  document.addEventListener('cc-turn', function () { call('haptic', 'success'); setTimeout(function () { call('haptic', 'tick'); }, 140); });

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
