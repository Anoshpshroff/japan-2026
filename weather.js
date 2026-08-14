/* Japan 2026 — weather for every day, and tides for Miyakojima.
 *
 * Two things are going on here, and they are deliberately different.
 *
 * WEATHER is a forecast problem. No forecast exists more than about 16 days
 * out, and the trip is months away, so most of the time there is nothing live
 * to show. Rather than an empty box, each day carries a climate normal baked
 * into weather.json — fifteen years of reanalysis pooled over a week-wide
 * window around that calendar date. Once the trip enters the forecast window
 * the real forecast is fetched from Open-Meteo and quietly replaces the
 * normal, day by day, and the label changes from "typical" to "forecast" so
 * you always know which one you are reading.
 *
 * TIDES are an astronomy problem. The 2026 predictions for Hirara are already
 * final and cannot change, so they are baked in whole from the Japan
 * Meteorological Agency and never fetched. That is also why they still work on
 * a dive boat with no signal, which is the entire point.
 *
 * Everything degrades to silence: no network, stale cache, missing file, bad
 * JSON — the day cards render exactly as they did before this file existed.
 */
(function () {
  'use strict';

  var LIVE = 'https://api.open-meteo.com/v1/forecast';
  var LS = 'japan2026.wx';
  var FRESH = 3 * 3600 * 1000;      // re-fetch a forecast older than three hours
  var HORIZON = 15;                 // days ahead Open-Meteo will actually answer for

  var WX = null, TIDES = null, live = null;

  /* ---------- icons ---------- */
  var C = 'currentColor';
  var CLOUD = '<path d="M6.6 18.2h10.6a3.4 3.4 0 0 0 .3-6.8 5 5 0 0 0-9.6-1.3 3.7 3.7 0 0 0-1.3 8.1z" fill="' + C + '"/>';
  var CLOUD_HI = '<path d="M6.6 14.4h10.6a3.4 3.4 0 0 0 .3-6.8 5 5 0 0 0-9.6-1.3 3.7 3.7 0 0 0-1.3 8.1z" fill="' + C + '"/>';
  var ICONS = {
    sun: '<circle cx="12" cy="12" r="4.3" fill="' + C + '"/>' +
         '<g stroke="' + C + '" stroke-width="1.8" stroke-linecap="round"><path d="M12 3.4v2M12 18.6v2M3.4 12h2M18.6 12h2M6 6l1.4 1.4M16.6 16.6L18 18M18 6l-1.4 1.4M7.4 16.6L6 18"/></g>',
    part: '<circle cx="9" cy="8.4" r="3.2" fill="' + C + '"/>' +
          '<g stroke="' + C + '" stroke-width="1.5" stroke-linecap="round"><path d="M9 2.4v1.5M2.6 8.4h1.5M4.4 3.8l1 1M14.6 3.8l-1 1"/></g>' +
          '<path d="M8.6 19.6h8.8a3.2 3.2 0 0 0 .3-6.4 4.6 4.6 0 0 0-8.8-1.2 3.5 3.5 0 0 0-.3 7.6z" fill="' + C + '"/>',
    cloud: CLOUD,
    fog: CLOUD_HI + '<g stroke="' + C + '" stroke-width="1.7" stroke-linecap="round" opacity=".75"><path d="M5 17.6h14M7 20.6h10"/></g>',
    drizzle: CLOUD_HI + '<g stroke="' + C + '" stroke-width="1.7" stroke-linecap="round"><path d="M9 17v2.2M13 17v2.2M17 17v2.2"/></g>',
    rain: CLOUD_HI + '<g stroke="' + C + '" stroke-width="1.8" stroke-linecap="round"><path d="M8.6 16.6l-1 4M12.6 16.6l-1 4M16.6 16.6l-1 4"/></g>',
    snow: CLOUD_HI + '<g stroke="' + C + '" stroke-width="1.6" stroke-linecap="round"><path d="M8 17.4v3M6.7 18.2l2.6 1.4M9.3 18.2l-2.6 1.4M16 17.4v3M14.7 18.2l2.6 1.4M17.3 18.2l-2.6 1.4"/></g>',
    storm: CLOUD_HI + '<path d="M13.4 15.8l-3.6 4.4h2.6l-1.2 3.4 4-4.8h-2.6z" fill="' + C + '"/>'
  };

  /* WMO weather codes, grouped to the icon and the words a person would use. */
  function codeInfo(c) {
    if (c === 0) return ['sun', 'Clear'];
    if (c === 1) return ['sun', 'Mostly clear'];
    if (c === 2) return ['part', 'Partly cloudy'];
    if (c === 3) return ['cloud', 'Overcast'];
    if (c === 45 || c === 48) return ['fog', 'Fog'];
    if (c >= 51 && c <= 57) return ['drizzle', 'Drizzle'];
    if (c === 61) return ['rain', 'Light rain'];
    if (c === 63) return ['rain', 'Rain'];
    if (c === 65) return ['rain', 'Heavy rain'];
    if (c === 66 || c === 67) return ['rain', 'Freezing rain'];
    if (c === 71) return ['snow', 'Light snow'];
    if (c === 73) return ['snow', 'Snow'];
    if (c === 75 || c === 77) return ['snow', 'Heavy snow'];
    if (c === 80) return ['rain', 'Showers'];
    if (c === 81 || c === 82) return ['rain', 'Heavy showers'];
    if (c === 85 || c === 86) return ['snow', 'Snow showers'];
    if (c >= 95) return ['storm', 'Thunderstorms'];
    return ['cloud', ''];
  }

  /* Snow deliberately does NOT lead here. Aomori city carries a 3-5% chance of
     a flake in late October on a 14 degree day; letting that win made every
     northern card read "Snow possible", which is how you get someone packing
     for the wrong trip. It surfaces as its own metric below instead, and only
     when it is high enough to plan around. */
  function normalInfo(n) {
    if (n.wet >= 55) return ['rain', 'Often wet'];
    if (n.wet >= 42) return ['drizzle', 'Showery'];
    if (n.cloud >= 68) return ['cloud', 'Usually cloudy'];
    if (n.cloud >= 42) return ['part', 'Mixed'];
    return ['sun', 'Usually fine'];
  }

  function svg(name, cls) {
    return '<svg class="' + (cls || 'wxi') + '" viewBox="0 0 24 24" aria-hidden="true">' +
           (ICONS[name] || ICONS.cloud) + '</svg>';
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function t(x) { return Math.round(x) + '°'; }

  /* ---------- reading a day: live forecast if we have one, else the normal ---------- */
  function readDay(id, rec, locKey) {
    var key = locKey || rec.loc;
    var l = live && live[key] && live[key][rec.date];
    if (l) {
      var ci = codeInfo(l.code);
      return {
        live: true, icon: ci[0], word: ci[1],
        tmax: l.tmax, tmin: l.tmin, wind: l.wind,
        pop: l.pop, mm: l.mm
      };
    }
    var n = (locKey && rec.alts) ? altNormal(rec, locKey) : rec.normal;
    if (!n) return null;
    var ni = normalInfo(n);
    return {
      live: false, icon: ni[0], word: ni[1],
      tmax: n.tmax, tmin: n.tmin, wind: n.wind,
      wet: n.wet, mm: n.rain, warm: n.warm, cool: n.cool, snow: n.snow
    };
  }
  function altNormal(rec, key) {
    for (var i = 0; i < rec.alts.length; i++) if (rec.alts[i].loc === key) return rec.alts[i].normal;
    return null;
  }

  /* ---------- the compact chip on the closed card ---------- */
  function chip(rec) {
    var d = readDay(null, rec);
    if (!d) return null;
    var s = document.createElement('span');
    s.className = 'daychip wx' + (d.live ? ' is-live' : '');
    var inner = svg(d.icon, 'wxi sm') +
      '<span class="wxt">' + t(d.tmax) + '</span>' +
      '<span class="wxlo">' + t(d.tmin) + '</span>';
    if (rec.sunrise && rec.sunset) {
      inner += '<span class="wxdaylight">' + rec.sunrise + '–' + rec.sunset + '</span>';
    }
    s.innerHTML = inner;
    s.title = (d.live ? 'Forecast' : 'Typical for the date') +
              (d.word ? ' · ' + d.word : '');
    return s;
  }

  /* ---------- compact tide chip for Miyakojima day headers ---------- */
  function tideChip(iso) {
    var d = TIDES && TIDES.days[iso];
    if (!d) return null;
    // Pick daytime events (06:00–20:00) first, then any if none found
    function bestDaytime(events) {
      var day = events.filter(function(e) {
        var h = parseInt(e.t.slice(0, 2), 10);
        return h >= 6 && h <= 20;
      });
      return day.length ? day : events;
    }
    var highs = bestDaytime(d.highs);
    var lows  = bestDaytime(d.lows);
    if (!highs.length && !lows.length) return null;

    var s = document.createElement('span');
    s.className = 'daychip tide-mini';
    var parts = [];
    highs.forEach(function(e) { parts.push({ t: e.t, label: '↑ ' + e.t, sort: e.t }); });
    lows.forEach(function(e)  { parts.push({ t: e.t, label: '↓ ' + e.t, sort: e.t }); });
    parts.sort(function(a, b) { return a.sort < b.sort ? -1 : 1; });
    s.textContent = parts.map(function(p) { return p.label; }).join(' · ');
    s.title = 'Tide times · Hirara · ↑ high · ↓ low';
    return s;
  }

  /* ---------- the full strip inside the weather tab ---------- */
  function metric(label, value) {
    return '<div class="wxm"><dt>' + label + '</dt><dd>' + value + '</dd></div>';
  }

  function strip(id, rec) {
    var d = readDay(id, rec);
    if (!d) return '';
    var loc = WX.locs[rec.loc] || { name: rec.loc, short: '' };
    var h = '<section class="wxstrip' + (d.live ? ' is-live' : '') + '">';

    h += '<div class="wxmain">' +
           '<div class="wxglyph">' + svg(d.icon, 'wxi lg') + '</div>' +
           '<div class="wxnow">' +
             '<div class="wxtemps"><span class="hi">' + t(d.tmax) + '</span>' +
               '<span class="lo">' + t(d.tmin) + '</span></div>' +
             '<div class="wxword">' + esc(d.word) + '</div>' +
             '<div class="wxwhere">' + esc(loc.name) +
               (loc.short ? ' · ' + esc(loc.short) : '') + '</div>' +
           '</div>' +
           '<span class="wxbadge">' + (d.live ? 'Forecast' : 'Typical') + '</span>' +
         '</div>';

    h += '<dl class="wxgrid">';
    if (d.live) {
      if (d.pop != null) h += metric('Rain', d.pop + '%');
      if (d.mm != null && d.mm > 0) h += metric('Total', d.mm.toFixed(1) + ' mm');
    } else {
      h += metric('Wet days', d.wet + '%');
      h += metric('Usual range', t(d.cool) + '–' + t(d.warm));
      // Only once it is worth planning around — roughly one year in ten.
      if (d.snow >= 8) h += metric('Snow risk', d.snow + '%');
    }
    if (d.wind != null) h += metric('Wind', Math.round(d.wind) + ' km/h');
    if (rec.sunrise) h += metric('Light', rec.sunrise + '–' + rec.sunset);
    if (rec.sea) {
      h += metric('Sea', rec.sea.sst.toFixed(1) + '°');
      h += metric('Swell', rec.sea.wave.toFixed(1) + ' m');
    }
    h += '</dl>';

    if (rec.alts) {
      h += '<div class="wxalts">';
      rec.alts.forEach(function (a) {
        var ad = readDay(id, rec, a.loc);
        var al = WX.locs[a.loc] || { name: a.loc };
        if (!ad) return;
        h += '<div class="wxalt">' + svg(ad.icon, 'wxi sm') +
             '<span class="an">' + esc(al.name) +
             (al.elev >= 600 ? ' <i>' + al.elev.toLocaleString() + ' m</i>' : '') + '</span>' +
             '<span class="at">' + t(ad.tmax) + '<span class="lo">' + t(ad.tmin) + '</span></span>' +
             /* This is where snow actually earns a mention: the Aspite Line and
                the Hakkoda road are the things that shut, not Aomori station. */
             (ad.snow >= 8 ? '<span class="asnow">snow ' + ad.snow + '%</span>' : '') +
             '</div>';
      });
      h += '</div>';
    }

    h += '<p class="wxsrc">' + esc(sourceLine(d)) + '</p>';
    h += '</section>';
    return h;
  }

  function sourceLine(d) {
    if (d.live) {
      var at = live && live.__at ? new Date(live.__at) : null;
      return 'Live forecast from Open-Meteo' +
        (at ? ', fetched ' + at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '') + '.';
    }
    return 'Typical for this date — ' + WX.source +
           '. A real forecast replaces this once the trip is about two weeks away.';
  }

  /* ---------- tides ---------- */
  function tidePanel(iso) {
    var d = TIDES && TIDES.days[iso];
    if (!d) return '';
    var W = 620, H = 132, PADL = 8, PADR = 8, TOP = 16, BOT = 40;
    var lo = d.hmin, hi = d.hmax, span = Math.max(1, hi - lo);
    var pts = d.hourly.concat([d.hourly[23]]);
    function X(i) { return PADL + i * (W - PADL - PADR) / 24; }
    function Y(v) { return TOP + (1 - (v - lo) / span) * (H - TOP - BOT); }

    var line = '';
    for (var i = 0; i < pts.length; i++) {
      var x = X(i), y = Y(pts[i]);
      if (!i) { line += 'M' + x.toFixed(1) + ' ' + y.toFixed(1); continue; }
      var px = X(i - 1), py = Y(pts[i - 1]), cx = (px + x) / 2;
      line += ' C' + cx.toFixed(1) + ' ' + py.toFixed(1) + ',' + cx.toFixed(1) + ' ' + y.toFixed(1) +
              ',' + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    var area = line + ' L' + X(24).toFixed(1) + ' ' + (H - BOT) + ' L' + X(0).toFixed(1) + ' ' + (H - BOT) + ' Z';

    var marks = '', labels = '';
    function mark(ev, cls) {
      ev.forEach(function (e) {
        var hh = parseInt(e.t.slice(0, 2), 10) + parseInt(e.t.slice(3), 10) / 60;
        var x = X(hh), y = Y(e.cm);
        marks += '<circle class="' + cls + '" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3.6"/>';
        var anchor = x < 60 ? 'start' : x > W - 60 ? 'end' : 'middle';
        var dx = x < 60 ? 2 : x > W - 60 ? -2 : 0;
        labels += '<text class="tl-' + cls + '" x="' + (x + dx).toFixed(1) + '" y="' +
                  (cls === 'th' ? (y - 9).toFixed(1) : (y + 17).toFixed(1)) +
                  '" text-anchor="' + anchor + '">' + e.t + '</text>';
      });
    }
    mark(d.highs, 'th');
    mark(d.lows, 'tlo');

    var hours = '';
    [0, 6, 12, 18, 24].forEach(function (hh) {
      hours += '<text class="txh" x="' + X(hh).toFixed(1) + '" y="' + (H - 20) + '" text-anchor="' +
               (hh === 0 ? 'start' : hh === 24 ? 'end' : 'middle') + '">' +
               (hh === 24 ? '24' : String(hh).padStart(2, '0')) + '</text>';
      hours += '<line class="txg" x1="' + X(hh).toFixed(1) + '" y1="' + TOP + '" x2="' +
               X(hh).toFixed(1) + '" y2="' + (H - BOT) + '"/>';
    });

    var kind = { spring: 'Spring tides — biggest range of the week',
                 neap: 'Neap tides — the sea barely moves',
                 middling: 'Middling tides' }[d.kind];

    var h = '<section class="tide">' +
      '<div class="tidehead"><h5>Tide · Hirara</h5>' +
        '<span class="tidekind">' + esc(kind) + ' · ' + d.range + ' cm</span></div>' +
      '<svg class="tidechart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
        esc(tideAlt(d)) + '">' +
        '<path class="tarea" d="' + area + '"/>' +
        '<path class="tline" d="' + line + '"/>' +
        hours + marks + labels +
      '</svg>' +
      '<div class="tidelist">';
    d.lows.forEach(function (e) {
      h += '<span class="tp low"><b>Low</b> ' + e.t + ' <i>' + e.cm + ' cm</i></span>';
    });
    d.highs.forEach(function (e) {
      h += '<span class="tp high"><b>High</b> ' + e.t + ' <i>' + e.cm + ' cm</i></span>';
    });
    h += '</div>';
    var note = tideNote(iso, d);
    if (note) h += '<p class="tidenote">' + note + '</p>';
    h += '</section>';
    return h;
  }

  function tideAlt(d) {
    return 'Tide curve. ' +
      d.highs.map(function (e) { return 'High ' + e.t + ' ' + e.cm + ' cm'; }).join(', ') + '. ' +
      d.lows.map(function (e) { return 'Low ' + e.t + ' ' + e.cm + ' cm'; }).join(', ') + '.';
  }

  var TIDE_PLANS = {
    '2026-10-22': ['17-END', 'the sandbar is a low-tide feature — it drowns at high water'],
    '2026-10-23': ['Yoshino Kaigan', 'the reef shallows snorkel best either side of low water'],
    '2026-10-24': ['the mangrove kayak', 'Pumpkin Rock sits in the tidal flat behind Shimajiri']
  };

  function tideNote(iso, d) {
    var out = [];
    var plan = TIDE_PLANS[iso];
    if (plan && d.lows.length) {
      var best = d.lows.reduce(function (a, b) { return b.cm < a.cm ? b : a; });
      var day = d.lows.filter(function (e) {
        var hh = parseInt(e.t.slice(0, 2), 10); return hh >= 7 && hh <= 18;
      });
      var use = day.length ? day[0] : best;
      out.push('<b>' + esc(plan[0]) + ':</b> low water at <b>' + use.t + '</b> (' + use.cm +
               ' cm) — ' + esc(plan[1]) + '. Aim for the hour either side.');
    }
    if (d.moon && d.moon.lit >= 0.9) {
      out.push('Moon <b>' + Math.round(d.moon.lit * 100) + '% lit</b> (' + esc(d.moon.phase) +
               '), so it is up most of the night — poor for stargazing.');
    }
    return out.join(' ');
  }

  /* ---------- weather tab ---------- */
  /* Legs are keyed by the `loc` in weather.json, not by the nav slug — the two
     differ for Kakunodate, whose weather station is Lake Tazawa. Keying this by
     the nav slug matched zero days and dropped the leg from the page entirely. */
  var LEGS = [
    { key: 'tokyo',  label: 'Tokyo' },
    { key: 'miyako', label: 'Miyakojima' },
    { key: 'tazawa', label: 'Kakunodate & Lake Tazawa' },
    { key: 'aomori', label: 'Aomori' }
  ];

  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
             'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* Derive the label from the date rather than a hand-kept table: the table
     silently missed the four travel-day records (d-21-out, d-26, d-29-out, d-2)
     and rendered their raw ids as headings. */
  function dayLabel(rec, id) {
    var d = new Date(rec.date + 'T00:00');
    var s = DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()];
    /* Two records share a date on each travel day — one for the place you leave,
       one for the place you arrive. Say which is which. */
    if (/-out$/.test(id)) s += ' · leaving';
    return s;
  }

  function legDates(days) {
    if (!days.length) return '';
    var a = new Date(days[0].date + 'T00:00');
    var b = new Date(days[days.length - 1].date + 'T00:00');
    var left = a.getDate() + (a.getMonth() === b.getMonth() ? '' : ' ' + MON[a.getMonth()]);
    return left + '–' + b.getDate() + ' ' + MON[b.getMonth()];
  }

  function renderWeatherTab() {
    var tab = document.getElementById('v-weather');
    if (!tab || !WX) return;
    var body = tab.querySelector('.wx-tab-body');
    if (!body) return;

    var html = '';
    LEGS.forEach(function (leg) {
      var legDays = Object.keys(WX.days)
        .filter(function (id) { return WX.days[id].loc === leg.key; })
        .map(function (id) { return { id: id, rec: WX.days[id] }; })
        .sort(function (x, y) { return x.rec.date < y.rec.date ? -1 : 1; });

      if (!legDays.length) return;
      html += '<div class="wx-leg">';
      html += '<div class="wx-leg-head"><h3>' + esc(leg.label) + '</h3>' +
              '<span class="wx-leg-dates">' +
              esc(legDates(legDays.map(function (o) { return o.rec; }))) + '</span></div>';

      legDays.forEach(function (o) {
        html += '<div class="wx-day-row">';
        html += '<div class="wx-day-label">' + esc(dayLabel(o.rec, o.id)) + '</div>';
        html += strip(o.id, o.rec);
        if (o.rec.loc === 'miyako') html += tidePanel(o.rec.date);
        html += '</div>';
      });

      html += '</div>';
    });

    body.innerHTML = html ||
      '<p style="color:var(--ink-3);padding:24px 0">Weather data unavailable.</p>';
  }

  /* ---------- the journey rail ---------- */
  /* The rail has one cell per calendar day, but weather.json has two records for
     each travel day — one for the place you leave, one for the place you arrive.
     Resolve by matching the cell's own leg, so 21 Oct under MIYAKOJIMA reads the
     island record and not the Tokyo one. */
  var LEG_TO_LOC = { tokyo:'tokyo', miyako:'miyako', kakunodate:'tazawa', aomori:'aomori' };

  function railDate(day) {
    var n = parseInt(day, 10);
    return n >= 18 ? '2026-10-' + n : '2026-11-0' + n;
  }

  function recordFor(leg, day) {
    var want = LEG_TO_LOC[leg], date = railDate(day);
    var keys = Object.keys(WX.days);
    for (var i = 0; i < keys.length; i++) {
      var r = WX.days[keys[i]];
      if (r.date === date && r.loc === want) return r;
    }
    return null;
  }

  function paintRail() {
    var cells = document.querySelectorAll('.railday');
    if (!cells.length) return;

    Array.prototype.forEach.call(cells, function (btn) {
      var rec = recordFor(btn.getAttribute('data-leg'), btn.getAttribute('data-day'));
      if (!rec) return;
      var d = readDay(null, rec);
      if (!d) return;

      var wx = btn.querySelector('.rwx');
      if (!wx) {
        wx = document.createElement('span');
        wx.className = 'rwx';
        btn.appendChild(wx);
      }
      wx.innerHTML = '<b>' + t(d.tmax) + '</b><i>' + t(d.tmin) + '</i>';

      if (rec.sunrise && rec.sunset) {
        var lt = btn.querySelector('.rlt');
        if (!lt) {
          lt = document.createElement('span');
          lt.className = 'rlt';
          btn.appendChild(lt);
        }
        lt.textContent = rec.sunrise + '–' + rec.sunset;
      }
    });

    paintRailTides();
  }

  /* A tide strip that sits under the rail and spans only the island days, so it
     reads as a property of those five columns rather than a global bar. */
  function paintRailTides() {
    var rail = document.querySelector('.rail');
    if (!rail || !TIDES) return;

    var miyako = [].slice.call(rail.querySelectorAll('.railday[data-leg="miyako"]'));
    if (!miyako.length) return;

    var all = [].slice.call(rail.querySelectorAll('.railday'));
    var old = rail.querySelectorAll('.railtide');
    Array.prototype.forEach.call(old, function (n) { n.remove(); });

    miyako.forEach(function (btn) {
      var iso = railDate(btn.getAttribute('data-day'));
      var d = TIDES.days[iso];
      if (!d) return;

      var cell = document.createElement('span');
      cell.className = 'railtide';
      cell.style.gridColumn = (all.indexOf(btn) + 1);

      /* The day's extremes only — the single highest high and lowest low. Listing
         all four events made this strip four lines tall, which is most of a phone
         viewport once it is stuck to the top. Every event is on the Weather page. */
      var hi = d.highs.reduce(function (a, b) { return b.cm > a.cm ? b : a; });
      var lo = d.lows.reduce(function (a, b) { return b.cm < a.cm ? b : a; });

      cell.innerHTML =
        '<i class="h">▲' + hi.t + '</i>' +
        '<i class="l">▼' + lo.t + '</i>';
      cell.title = 'Hirara · highest ' + hi.t + ' (' + hi.cm + ' cm) · lowest ' +
                   lo.t + ' (' + lo.cm + ' cm)';
      rail.appendChild(cell);
    });

    /* Label the strip, in the first column so it lines up with the leg labels. */
    var lab = document.createElement('span');
    lab.className = 'railtide railtidelabel';
    lab.style.gridColumn = '1 / ' + (all.indexOf(miyako[0]) + 1);
    lab.textContent = 'TIDE · HIRARA';
    rail.appendChild(lab);
  }

  /* ---------- render ---------- */
  function render() {
    paintRail();
    Object.keys(WX.days).forEach(function (id) {
      var card = document.getElementById(id);
      if (!card) return;
      var rec = WX.days[id];

      // Weather chip (temp + daylight hours) in the day header
      var chips = card.querySelector('.daychips');
      if (chips) {
        var old = chips.querySelector('.daychip.wx');
        if (old) old.remove();
        var c = chip(rec);
        if (c) chips.insertBefore(c, chips.firstChild);

        // Tide mini-chip for Miyakojima days
        if (rec.loc === 'miyako') {
          var oldTide = chips.querySelector('.daychip.tide-mini');
          if (oldTide) oldTide.remove();
          var tc = tideChip(rec.date);
          if (tc) chips.appendChild(tc);
        }
      }
    });

    // Populate the weather tab
    renderWeatherTab();
  }

  /* ---------- the live forecast ---------- */
  function tripWindow() {
    var all = Object.keys(WX.days).map(function (k) { return WX.days[k].date; }).sort();
    return [all[0], all[all.length - 1]];
  }

  function worthFetching() {
    var w = tripWindow();
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var start = new Date(w[0] + 'T00:00'), end = new Date(w[1] + 'T00:00');
    var daysToStart = Math.round((start - today) / 86400000);
    var daysPastEnd = Math.round((today - end) / 86400000);
    return daysToStart <= HORIZON && daysPastEnd <= 0;
  }

  function locList() {
    var keys = {};
    Object.keys(WX.days).forEach(function (k) {
      keys[WX.days[k].loc] = 1;
      (WX.days[k].alts || []).forEach(function (a) { keys[a.loc] = 1; });
    });
    return Object.keys(keys).sort();
  }

  function fetchLive() {
    var keys = locList();
    var q = LIVE +
      '?latitude=' + keys.map(function (k) { return WX.locs[k].lat; }).join(',') +
      '&longitude=' + keys.map(function (k) { return WX.locs[k].lon; }).join(',') +
      '&elevation=' + keys.map(function (k) { return WX.locs[k].elev; }).join(',') +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,' +
      'precipitation_probability_max,precipitation_sum,wind_speed_10m_max' +
      '&timezone=Asia%2FTokyo&forecast_days=16';

    return fetch(q, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        var arr = Array.isArray(data) ? data : [data];
        var out = { __at: Date.now() };
        keys.forEach(function (k, i) {
          var dd = arr[i] && arr[i].daily;
          if (!dd) return;
          var per = {};
          dd.time.forEach(function (iso, j) {
            per[iso] = {
              code: dd.weather_code[j],
              tmax: dd.temperature_2m_max[j], tmin: dd.temperature_2m_min[j],
              pop: dd.precipitation_probability_max[j], mm: dd.precipitation_sum[j],
              wind: dd.wind_speed_10m_max[j]
            };
          });
          out[k] = per;
        });
        try { localStorage.setItem(LS, JSON.stringify(out)); } catch (e) {}
        return out;
      });
  }

  function cachedLive() {
    try {
      var v = JSON.parse(localStorage.getItem(LS) || 'null');
      return v && v.__at ? v : null;
    } catch (e) { return null; }
  }

  function maybeLive() {
    if (!worthFetching()) return;
    var c = cachedLive();
    if (c) { live = c; render(); }
    if (c && Date.now() - c.__at < FRESH) return;
    fetchLive().then(function (l) { live = l; render(); })
               .catch(function () {});
  }

  /* ---------- go ---------- */
  function json(u) {
    return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  Promise.all([json('./weather.json'), json('./tides.json')]).then(function (r) {
    WX = r[0]; TIDES = r[1];
    if (!WX || !WX.days) return;
    render();
    maybeLive();
    window.addEventListener('online', maybeLive);
    // Re-render weather tab when user navigates to it
    window.addEventListener('hashchange', function () {
      if ((location.hash || '').indexOf('weather') !== -1) renderWeatherTab();
    });
  });
})();
