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
    /* Supplied photographs first — these were picked for the specific card. */
    [/street go-?karting|go-?kart/i,'u-street-go-karting.jpg'], [/baseball/i,'u-baseball-japan-series.jpg'],
    [/akasaka backstreet/i,'u-akasaka-backstreets.jpg'], [/depachika|ekiben/i,'u-depachika-ekiben.jpg'],
    [/fujizakura/i,'u-fujizakura-beer.jpg'],
    [/nakanoshima/i,'u-nakanoshima-channel.jpg'], [/wonderful cave|mini grotto/i,'u-wonderful-cave.jpg'],
    [/17-?end/i,'u-17-end-beach.jpg'], [/toguchi/i,'u-toguchi-no-hama.jpg'], [/painagama/i,'u-painagama-beach.jpg'],
    [/pumpkin rock & the mangroves|mangrove/i,'u-pumpkin-rock.jpg'],
    [/stargazing|^stars,/i,'u-stargazing-miyako.jpg'],
    [/sea turtle|turtle snorkel/i,'u-sea-turtle-snorkel.jpg'], [/clear sup/i,'u-clear-sup.jpg'],
    [/yukishio|salt museum/i,'u-yukishio-salt-museum.jpg'], [/umibudo/i,'u-umibudo.jpg'],
    [/loop the lake/i,'u-lake-tazawa-loop.jpg'], [/route 341/i,'u-route-341-akita.jpg'],
    [/sake at the source/i,'u-sake-akita.jpg'], [/yamai/i,'u-yamai-ryori.jpg'],
    [/hakka pass/i,'u-hakka-pass.jpg'], [/jogakura/i,'u-jogakura-ohashi.jpg'],
    [/tsuta-?numa|tsuta/i,'u-tsuta-numa.jpg'], [/hotate|kaiyaki/i,'u-hotate-kaiyaki-miso.jpg'],
    /* Second batch of supplied photographs. These sit before the rules below
       because they are narrower: "Nonbei Yokocho" must not fall through to the
       Omoide photograph, and "Kabazaiku cherry-bark craft" must not fall
       through to "Kabazaiku cherry bark". Specific first, general after. */
    [/nonbei/i,'u-nonbei-yokocho.jpg'],
    [/awamori distillery/i,'u-awamori-cellar.jpg'],
    [/kabazaiku cherry-?bark craft/i,'u-kabazaiku-craft.jpg'],
    [/gold line/i,'u-hakkoda-gold-line.jpg'],
    [/tazawa cruise/i,'u-tazawa-cruise.jpg'],
    [/nyuto kogen|kogen trails/i,'u-nyuto-trails.jpg'],
    /* One rule per subject. No broad regional catch-alls: a card either shows
       its own place or shows nothing. A Tokyo skyline on "Tsukiji outer market"
       is a placeholder, and a placeholder is worse than white space. */

    /* Tokyo */
    [/teamlab/i,'u-teamlab.jpg'], [/shibuya sky/i,'u-shibuya-sky.jpg'],
    [/shibuya|scramble/i,'p-shibuyacross.jpg'], [/tsukiji/i,'p-tsukiji.jpg'],
    [/omoide|golden gai|yokocho/i,'p-omoide.jpg'], [/sumo/i,'p-sumo.jpg'],
    [/kabuki/i,'p-kabukiza.jpg'],

    /* Miyakojima */
    [/irabu/i,'u-irabu-ohashi.jpg'], [/maehama/i,'u-yonaha-maehama.jpg'], [/sunayama/i,'p-sunayama.jpg'],
    [/yoshino/i,'p-yoshino.jpg'], [/hennazaki/i,'u-cape-hennazaki.jpg'],
    [/kurima/i,'p-kurima.jpg'], [/ikema/i,'p-ikema.jpg'], [/toriike/i,'u-toriike-dive.jpg'],
    [/yabiji/i,'p-yabiji.jpg'], [/awamori/i,'p-awamori.jpg'], [/miyako soba/i,'u-miyako-soba.jpg'],
    [/sanshin|shamisen|jamisen/i,'u-izakaya-sanshin.jpg'],

    /* Akita */
    [/dakigaeri/i,'u-dakigaeri.jpg'], [/komagatake/i,'komagatake-summit.jpg'],
    [/tazawa/i,'u-tazawa-shore.jpg'], [/tsurunoyu/i,'u-tsurunoyu-bath.jpg'],
    [/nyuto|taenoyu|kuroyu|ganiba/i,'nyuto-onsen.jpg'],
    [/aspite|hachimantai/i,'p-aspite.jpg'], [/oyasukyo/i,'u-oyasukyo.jpg'],
    [/bukeyashiki|samurai street/i,'u-bukeyashiki.jpg'], [/kabazaiku/i,'u-kabazaiku-bark.jpg'],
    [/aoyagi/i,'u-aoyagi.jpg'], [/kakunodate/i,'kakunodate-autumn.jpg'],
    [/kiritanpo/i,'u-kiritanpo.jpg'], [/inaniwa/i,'u-inaniwa-udon.jpg'], [/hinai/i,'p-hinai.jpg'],

    /* Aomori */
    [/oirase/i,'oirase-stream.jpg'], [/towada/i,'towada-lake.jpg'],
    [/hakkoda|odake|gold line/i,'hakkoda-odake.jpg'], [/sukayu/i,'p-sukayu.jpg'],
    [/aoni/i,'p-aoni.jpg'], [/iwaki/i,'u-iwaki-skyline.jpg'], [/juniko|aoike/i,'u-juniko-aoike.jpg'],
    [/anmon/i,'p-anmon.jpg'], [/osorezan|osore/i,'u-osorezan.jpg'],
    [/nebuta|neputa|warasse/i,'nebuta-float.jpg'], [/sannai|maruyama/i,'u-sannai.jpg'],
    [/hirosaki/i,'p-hirosaki.jpg'], [/apple/i,'p-apple.jpg'],
    [/a-factory|cidre/i,'p-afactory.jpg'], [/nokkedon/i,'p-nokkedon.jpg'],
    [/senbei-jiru/i,'p-senbeijiru.jpg'], [/\u014cma|oma tuna/i,'p-omatuna.jpg'],

    /* Fuji & Kyoto */
    [/chureito/i,'p-chureito.jpg'], [/kawaguchiko|mount fuji/i,'fuji-kawaguchiko.jpg'],
    [/fushimi|inari/i,'kyoto-fushimi.jpg'], [/kiyomizu/i,'p-kiyomizu.jpg']
  ];


  var CREDITS = {};   // filled from credits.json, best-effort

  /* ---------- real coordinates, for handing off to a maps app ---------- */
  var PLACES = {};   // from places.json
  var PLACE_RULES = [
    [/dakigaeri/i,'Dakigaeri Gorge'], [/komagatake/i,'Mt Akita-Komagatake'],
    [/tazawa/i,'Lake Tazawa'], [/tsurunoyu/i,'Tsurunoyu'],
    [/nyuto|taenoyu|kuroyu|ganiba/i,'Nyuto Onsen'], [/bukeyashiki|samurai street/i,'Bukeyashiki-dori'],
    [/aspite|hachimantai/i,'Hachimantai Aspite Line'], [/oyasukyo/i,'Oyasukyo Daifunto'],
    [/katakurinohana/i,'Katakurinohana'],
    [/oirase/i,'Oirase Gorge'], [/towada/i,'Lake Towada'], [/hakkoda ropeway|ropeway/i,'Hakkoda Ropeway'],
    [/sukayu/i,'Sukayu Onsen'], [/tsuta/i,'Tsuta-numa'], [/iwaki/i,'Mt Iwaki'],
    [/juniko|aoike/i,'Juniko Aoike'], [/anmon/i,'Anmon Falls'], [/osorezan/i,'Osorezan'],
    [/nebuta|warasse/i,'Nebuta Warasse'], [/sannai|maruyama/i,'Sannai-Maruyama'],
    [/museum of art/i,'Aomori Museum of Art'], [/a-factory|cidre/i,'A-Factory'],
    [/nokkedon|furukawa/i,'Furukawa Market'], [/hirosaki castle|hirosaki park/i,'Hirosaki Castle'],
    [/apple pick|apple park|apples/i,'Hirosaki Apple Park'], [/aoni/i,'Aoni Onsen'],
    [/maehama/i,'Yonaha Maehama'], [/irabu/i,'Irabu Ohashi'], [/kurima/i,'Kurima Ohashi'],
    [/ikema/i,'Ikema Ohashi'], [/hennazaki/i,'Cape Higashi-Hennazaki'], [/sunayama/i,'Sunayama Beach'],
    [/yoshino/i,'Yoshino Kaigan'], [/toriike/i,'Toriike'], [/yukishio|salt museum/i,'Yukishio Museum'],
    [/shigira/i,'Shigira Ougon Onsen'],
    [/chureito/i,'Chureito Pagoda'], [/kawaguchiko/i,'Kawaguchiko'],
    [/fushimi/i,'Fushimi Inari'], [/kiyomizu/i,'Kiyomizu-dera'],
    [/hie shrine/i,'Hie Shrine'], [/shibuya sky/i,'Shibuya Sky'], [/kabuki/i,'Kabuki-za']
  ];
  function placeFor(title) {
    for (var i = 0; i < PLACE_RULES.length; i++)
      if (PLACE_RULES[i][0].test(title) && PLACES[PLACE_RULES[i][1]]) return PLACES[PLACE_RULES[i][1]];
    return null;
  }


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
    var pl = placeFor(title);
    if (pl) {
      html += '<a class="sheetmap" target="_blank" rel="noopener" ' +
              'href="https://www.google.com/maps/search/?api=1&query=' + pl.lat + ',' + pl.lon + '">' +
              '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.6c-3 0-5.4 2.4-5.4 5.4 0 4 5.4 11.4 5.4 11.4s5.4-7.4 5.4-11.4c0-3-2.4-5.4-5.4-5.4z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="10" cy="7" r="2.1" fill="currentColor"/></svg>' +
              'Open in Maps<span class="sheetcoord">' + pl.lat.toFixed(4) + ', ' + pl.lon.toFixed(4) + '</span></a>';
    }
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
    /* Only things you can actually go and do: walks & drives, beaches & drives,
       activities, diving. Advice cards ("Carry cash in the north") are not doors —
       there is nothing behind them to open. */
    /* A card is a door if there is something behind it: anything in the doable
       panels (walks, drives, activities, diving, food), or any card anywhere
       that resolves to a photograph — which is what makes the Fuji and Kyoto
       pages openable while 'Carry cash in the north' stays inert. */
    var cards = document.querySelectorAll(
      '.legpanel[id$="-do"] .card, .legpanel[id$="-act"] .card,' +
      '.legpanel[id$="-dive"] .card, .legpanel[id$="-eat"] .card, .view .cards > .card'
    );
    Array.prototype.forEach.call(cards, function (card) {
      if (card.dataset.wired) return;
      var h = card.querySelector('h4');
      if (!h) return;
      // Cards outside the doable panels only open if they have a picture to show.
      if (!card.closest('.legpanel[id$="-do"], .legpanel[id$="-act"], .legpanel[id$="-dive"], .legpanel[id$="-eat"]')
          && !photoFor(h.textContent.trim(), '')) return;
      card.dataset.wired = '1';
      card.classList.add('is-tappable');
      /* Surface the photograph on the card itself, not only inside the sheet.
         Title-match only: the body fallback that helps the sheet find *a*
         picture is too loose for an always-visible one — a wrong photograph
         on a card is worse than none. Cards without a match keep the motif. */
      var thumbFile = photoFor(h.textContent.trim(), '');
      if (thumbFile) {
        var cr = CREDITS[thumbFile] || {};
        var fig = document.createElement('figure');
        fig.className = 'cardthumb';
        fig.innerHTML = '<img src="./photos/' + thumbFile + '" alt=""' +
          (cr.w ? ' width="' + cr.w + '" height="' + cr.h + '"' : '') +
          ' loading="lazy" decoding="async">';
        card.insertBefore(fig, card.firstChild);
        card.classList.add('has-photo');
      }
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

  /* The Maps chip sits inside the day's <summary>, so a plain tap would open the
     route AND toggle the day shut behind it. Opening the day is the <summary>'s
     default action rather than a listener, so stopPropagation alone will not do
     it — the click has to be cancelled and the navigation done by hand. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.daychip.maps');
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    window.open(a.href, '_blank', 'noopener');
  });

  function refresh() { wire(); }

  Promise.all([
    fetch('./photos/credits.json').then(function (r) { return r.json(); })
      .then(function (list) { list.forEach(function (c) { CREDITS[c.file] = c; }); }).catch(function () {}),
    fetch('./places.json').then(function (r) { return r.json(); })
      .then(function (o) { PLACES = o || {}; }).catch(function () {})
  ])
    .then(function () {
      refresh();
      window.addEventListener('hashchange', function () { setTimeout(refresh, 60); });
      document.addEventListener('click', function (e) {
        if (e.target.closest('[role="tab"], .navlink, .railday')) setTimeout(refresh, 60);
      });
    });
})();
