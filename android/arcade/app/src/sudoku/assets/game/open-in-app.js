/* Shown only in an Android browser, on a shared invite / challenge link: offers to open the Rovatics app.
   Uses an explicit-package intent, so it works even before Android has verified the link, and falls back to Google Play. */
(function () {
  'use strict';
  if (location.hostname === 'appassets.androidplatform.net' || !/Android/i.test(navigator.userAgent)) return;
  if (!/[?&](room|c)=/.test(location.search)) return;
  var PKG = { 'cardclash.html': 'com.rovatics.cardclash', 'sudoku.html': 'com.rovatics.sudoku' }[location.pathname.split('/').pop()];
  if (!PKG) return;
  var intent = 'intent://' + location.host + location.pathname + location.search +
    '#Intent;scheme=https;package=' + PKG + ';S.browser_fallback_url=' + encodeURIComponent('https://play.google.com/store/apps/details?id=' + PKG) + ';end';
  function add() {
    var b = document.createElement('div');
    b.setAttribute('style', 'position:fixed;left:0;right:0;top:0;z-index:2147483600;display:flex;gap:10px;align-items:center;justify-content:center;padding:10px 12px;background:#0b2a6b;color:#fff;font:600 15px system-ui,Arial,sans-serif;box-shadow:0 2px 12px rgba(0,0,0,.5)');
    b.innerHTML = '<span>📱 Play in the app for the best experience</span><a href="' + intent + '" style="background:#42e8f5;color:#04142d;padding:8px 14px;border-radius:999px;text-decoration:none;font-weight:800">Open app</a>' +
      '<button type="button" aria-label="Dismiss" style="background:none;border:0;color:#fff;font-size:20px">✕</button>';
    b.lastChild.onclick = function () { b.remove(); };
    document.body.appendChild(b);
  }
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
})();
