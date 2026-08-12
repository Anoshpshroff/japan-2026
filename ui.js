/* Japan 2026 — the bits a real website can do that an artifact could not.
 *
 *  1. Tap any card to open it properly: its photograph, full text, room to read.
 *  2. Cards arrive with a short stagger when a panel opens (CSS, not JS).
 *  3. Everything defers to prefers-reduced-motion.
 *
 * No dependencies. ~7 KB. Written to fail quietly: if anything here breaks,
 * the page underneath still works exactly as it did.
 */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- which photograph belongs to which card ---------- */
  var PHOTOS = [
    [/tsurunoyu/i,                              'tsurunoyu-autumn.jpg'],
    [/komagatake/i,                             'komagatake-summit.jpg'],
    [/nyuto|taenoyu|kuroyu|ganiba/i,            'nyuto-onsen.jpg'],
    [/towada/i,                                 'towada-lake.jpg'],
    [/juniko|aoike|shirakami/i,                 'juniko-aoike.jpg'],
    [/oirase/i,                                 'oirase-stream.jpg'],
    [/nebuta|neputa|warasse/i,                  'nebuta-float.jpg'],
    [/hennazaki|higashi-henna|cape/i,           'miyako-higashihenna.jpg'],
    [/irabu|kurima|ikema|maehama|sunayama|beach|snorkel|sup|turtle/i, 'miyako-irabu.jpg'],
    [/fushimi|kiyomizu|gion|kyoto/i,            'kyoto-fushimi.jpg'],
    [/fuji|kawaguchiko|tenjozan|chureito/i,     'fuji-kawaguchiko.jpg'],
    [/hakkoda|odake|sukayu|tsuta/i,             'hakkoda-odake.jpg'],
    [/kakunodate|samurai|kabazaiku|aoyagi|ishiguro|dakigaeri|tazawa|suzuki/i, 'kakunodate-autumn.jpg'],
    [/teamlab|shibuya|kabuki|sumo|kart|baseball|akasaka|shinjuku/i, 'tokyo-skyline.jpg']
  ];
  var CREDITS = {};   // filled from credits.json, best-effort

  function photoFor(title, body) {
    var i;
    for (i = 0; i < PHOTOS.length; i++) if (PHOTOS[i][0].test(title)) return PHOTOS[i][1];
    for (i = 0; i < PHOTOS.length; i++) if (PHOTOS[i][0].test(body)) return PHOTOS[i][1];
    return null;
  }

  /* ---------- the card detail sheet ---------- */
  var sheet, sheetBody, lastFocus;

  function buildSheet() {
    sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.hidden = true;
    sheet.innerHTML =
      '<div class="sheetscrim" data-close></div>' +
      '<div class="sheetpanel" role="document">' +
        '<button type="button" class="sheetclose" data-close aria-label="Close">' +
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
        '</button>' +
        '<div class="sheetscroll"><div class="sheetinner"></div></div>' +
      '</div>';
    document.body.appendChild(sheet);
    sheetBody = sheet.querySelector('.sheetinner');
    sheet.addEventListener('click', function (e) { if (e.target.hasAttribute('data-close')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) close(); });
  }

  function open(card) {
    if (!sheet) buildSheet();
    var h4 = card.querySelector('h4');
    var title = h4 ? h4.textContent.trim() : '';
    var key = card.querySelector('.k');
    var jp = card.querySelector('.jp');
    var foot = card.querySelector('.foot');
    var paras = [].slice.call(card.querySelectorAll('p')).filter(function (p) {
      return !p.classList.contains('jp') && !p.classList.contains('foot');
    });
    var accent = card.getAttribute('style') || '';
    var file = photoFor(title, card.textContent || '');

    var html = '';
    if (file) {
      var c = CREDITS[file] || {};
      html += '<figure class="sheetphoto">' +
              '<img src="./photos/' + file + '" alt="' + (c.caption ? String(c.caption).replace(/"/g, '') : title) + '"' +
              (c.w ? ' width="' + c.w + '" height="' + c.h + '"' : '') + ' decoding="async">' +
              (c.source ? '<figcaption><a href="' + c.source + '" target="_blank" rel="noopener">' +
                 (c.artist || 'Wikimedia Commons') + ' · ' + (c.licence || 'CC') + '</a></figcaption>' : '') +
              '</figure>';
    }
    html += '<div class="sheettext">';
    if (key) html += '<span class="k">' + key.innerHTML + '</span>';
    html += '<h3>' + title + '</h3>';
    if (jp) html += '<p class="jp">' + jp.innerHTML + '</p>';
    paras.forEach(function (p) { html += '<p>' + p.innerHTML + '</p>'; });
    if (foot) html += '<p class="sheetfoot">' + foot.innerHTML + '</p>';
    html += '</div>';

    sheetBody.innerHTML = html;
    sheet.querySelector('.sheetpanel').setAttribute('style', accent);
    lastFocus = document.activeElement;
    sheet.hidden = false;
    document.body.classList.add('sheet-open');
    // Force a reflow so the transition has a start state, then open. Using rAF
    // here meant the panel stayed at opacity:0 whenever rAF did not fire.
    void sheet.offsetWidth;
    sheet.classList.add('is-open');
    var closeBtn = sheet.querySelector('.sheetclose');
    if (closeBtn) closeBtn.focus();
  }

  function close() {
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove('is-open');
    var done = function () {
      sheet.hidden = true;
      document.body.classList.remove('sheet-open');
      sheetBody.innerHTML = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };
    if (reduce) done(); else setTimeout(done, 190);
  }

  /* ---------- wire the cards ---------- */
  function wire() {
    var cards = document.querySelectorAll('.legpanel .card, .view .cards > .card');
    Array.prototype.forEach.call(cards, function (card) {
      if (card.dataset.wired) return;
      if (!card.querySelector('h4')) return;
      card.dataset.wired = '1';
      card.classList.add('is-tappable');
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      var t = card.querySelector('h4');
      card.setAttribute('aria-label', 'Open ' + (t ? t.textContent.trim() : 'details'));
      card.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;      // let real links win
        open(card);
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(card); }
      });
    });
  }

  /* Reveal is CSS-only now — see riseIn in the stylesheet. A JS observer that
     silently fails leaves every card at opacity:0, which is exactly what it did. */

  function refresh() { wire(); }

  fetch('./photos/credits.json').then(function (r) { return r.json(); })
    .then(function (list) { list.forEach(function (c) { CREDITS[c.file] = c; }); })
    .catch(function () {})
    .then(function () {
      refresh();
      window.addEventListener('hashchange', function () { setTimeout(refresh, 60); });
      document.addEventListener('click', function (e) {
        if (e.target.closest('[role="tab"], .navlink, .railday')) setTimeout(refresh, 60);
      });
    });
})();
