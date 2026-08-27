/* Weather + tides for the redesign. Same idea as the original site's weather.js:
   climate normals baked into weather.json show until the trip is ~15 days out,
   then Open-Meteo's real forecast quietly replaces them, day by day. Tides for
   Hirara are final 2026 predictions, baked in. Everything degrades to silence. */
(function () {
  'use strict';
  var LIVE = 'https://api.open-meteo.com/v1/forecast';
  var LS = 'japan2026.wx', FRESH = 3 * 3600 * 1000, HORIZON = 15;
  var WX = null, TIDES = null, live = null;

  var C = 'currentColor';
  var CLOUD = '<path d="M6.6 18.2h10.6a3.4 3.4 0 0 0 .3-6.8 5 5 0 0 0-9.6-1.3 3.7 3.7 0 0 0-1.3 8.1z" fill="' + C + '"/>';
  var CLOUD_HI = '<path d="M6.6 14.4h10.6a3.4 3.4 0 0 0 .3-6.8 5 5 0 0 0-9.6-1.3 3.7 3.7 0 0 0-1.3 8.1z" fill="' + C + '"/>';
  var ICONS = {
    sun: '<circle cx="12" cy="12" r="4.3" fill="' + C + '"/><g stroke="' + C + '" stroke-width="1.8" stroke-linecap="round"><path d="M12 3.4v2M12 18.6v2M3.4 12h2M18.6 12h2M6 6l1.4 1.4M16.6 16.6L18 18M18 6l-1.4 1.4M7.4 16.6L6 18"/></g>',
    part: '<circle cx="9" cy="8.4" r="3.2" fill="' + C + '"/><g stroke="' + C + '" stroke-width="1.5" stroke-linecap="round"><path d="M9 2.4v1.5M2.6 8.4h1.5M4.4 3.8l1 1M14.6 3.8l-1 1"/></g><path d="M8.6 19.6h8.8a3.2 3.2 0 0 0 .3-6.4 4.6 4.6 0 0 0-8.8-1.2 3.5 3.5 0 0 0-.3 7.6z" fill="' + C + '"/>',
    cloud: CLOUD,
    fog: CLOUD_HI + '<g stroke="' + C + '" stroke-width="1.7" stroke-linecap="round" opacity=".75"><path d="M5 17.6h14M7 20.6h10"/></g>',
    drizzle: CLOUD_HI + '<g stroke="' + C + '" stroke-width="1.7" stroke-linecap="round"><path d="M9 17v2.2M13 17v2.2M17 17v2.2"/></g>',
    rain: CLOUD_HI + '<g stroke="' + C + '" stroke-width="1.8" stroke-linecap="round"><path d="M8.6 16.6l-1 4M12.6 16.6l-1 4M16.6 16.6l-1 4"/></g>',
    snow: CLOUD_HI + '<g stroke="' + C + '" stroke-width="1.6" stroke-linecap="round"><path d="M8 17.4v3M6.7 18.2l2.6 1.4M9.3 18.2l-2.6 1.4M16 17.4v3M14.7 18.2l2.6 1.4M17.3 18.2l-2.6 1.4"/></g>',
    storm: CLOUD_HI + '<path d="M13.4 15.8l-3.6 4.4h2.6l-1.2 3.4 4-4.8h-2.6z" fill="' + C + '"/>'
  };
  function codeInfo(c) {
    if (c === 0 || c === 1) return ['sun', c ? 'Mostly clear' : 'Clear'];
    if (c === 2) return ['part', 'Partly cloudy'];
    if (c === 3) return ['cloud', 'Overcast'];
    if (c === 45 || c === 48) return ['fog', 'Fog'];
    if (c >= 51 && c <= 57) return ['drizzle', 'Drizzle'];
    if (c === 61) return ['rain', 'Light rain'];
    if (c === 63) return ['rain', 'Rain'];
    if (c === 65 || c === 81 || c === 82) return ['rain', 'Heavy rain'];
    if (c === 66 || c === 67) return ['rain', 'Freezing rain'];
    if (c === 71) return ['snow', 'Light snow'];
    if (c >= 73 && c <= 77) return ['snow', 'Snow'];
    if (c === 80) return ['rain', 'Showers'];
    if (c === 85 || c === 86) return ['snow', 'Snow showers'];
    if (c >= 95) return ['storm', 'Thunderstorms'];
    return ['cloud', ''];
  }
  function normalInfo(n) {
    if (n.wet >= 55) return ['rain', 'Often wet'];
    if (n.wet >= 42) return ['drizzle', 'Showery'];
    if (n.cloud >= 68) return ['cloud', 'Usually cloudy'];
    if (n.cloud >= 42) return ['part', 'Mixed'];
    return ['sun', 'Usually fine'];
  }
  function svg(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:15px;height:15px;flex:none">' + (ICONS[name] || ICONS.cloud) + '</svg>';
  }
  function t(x) { return Math.round(x) + '\u00B0'; }

  function readDay(rec) {
    var l = live && live[rec.loc] && live[rec.loc][rec.date];
    if (l) { var ci = codeInfo(l.code); return { live: true, icon: ci[0], word: ci[1], tmax: l.tmax, tmin: l.tmin, pop: l.pop }; }
    if (!rec.normal) return null;
    var ni = normalInfo(rec.normal);
    return { live: false, icon: ni[0], word: ni[1], tmax: rec.normal.tmax, tmin: rec.normal.tmin, wet: rec.normal.wet };
  }

  /* Article ids are d18..d31, d01, d02; weather.json arrival records are d-18..d-2. */
  function recFor(artId) { return WX.days['d-' + parseInt(artId.slice(1), 10)]; }

  function chipStyle(el) {
    el.style.cssText = 'display:inline-flex;align-items:center;gap:6px;font-family:ui-monospace,Menlo,monospace;font-size:10.5px;letter-spacing:.08em;font-weight:700;color:#FBF7EC;background:rgba(16,12,7,.42);border:1px solid rgba(251,247,236,.28);border-radius:999px;padding:4px 11px;backdrop-filter:blur(3px)';
  }

  var LEGLOC = { tokyo: 'tokyo', miyako: 'miyako', kakunodate: 'tazawa', aomori: 'aomori', fuji: 'kawaguchiko' };
  function readDayAt(rec, loc) {
    var l = live && live[loc] && live[loc][rec.date];
    if (l) { var ci = codeInfo(l.code); return { live: true, icon: ci[0], word: ci[1], tmax: l.tmax, tmin: l.tmin, pop: l.pop }; }
    var n = rec.loc === loc ? rec.normal : ((rec.alts || []).filter(function (a) { return a.loc === loc; })[0] || {}).normal;
    if (!n) return null;
    var ni = normalInfo(n);
    return { live: false, icon: ni[0], word: ni[1], tmax: n.tmax, tmin: n.tmin, wet: n.wet };
  }
  var DOWS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  function legStrips() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-wxleg]'), function (el) {
      var key = el.getAttribute('data-wxleg'), loc = LEGLOC[key];
      if (!loc) return;
      var ids = Object.keys(WX.days).filter(function (k) {
        var r = WX.days[k];
        return key === 'fuji' ? k === 'd-20' : (r.loc === loc && !/-out$/.test(k));
      }).sort(function (a, b) { return WX.days[a].date < WX.days[b].date ? -1 : 1; });
      var html = '';
      ids.forEach(function (k) {
        var rec = WX.days[k], d = readDayAt(rec, loc);
        if (!d) return;
        var dt = new Date(rec.date + 'T00:00');
        html += '<span title="' + (d.live ? 'Forecast \u00B7 Open-Meteo' : 'Typical for the date') + (d.word ? ' \u00B7 ' + d.word : '') + '" style="display:inline-flex;align-items:center;gap:6px;font-family:ui-monospace,Menlo,monospace;font-size:10.5px;letter-spacing:.06em;font-weight:700;color:#4A4237;background:#FFFDF6;border:1px solid #E0D7C4;border-radius:999px;padding:4px 11px">' +
          '<span style="color:#8B8070;font-weight:600">' + DOWS[dt.getDay()] + ' ' + dt.getDate() + '</span>' + svg(d.icon) + '<span>' + t(d.tmax) + '/' + t(d.tmin) + '</span></span>';
      });
      if (html) el.innerHTML = html + '<span style="align-self:center;font-family:ui-monospace,Menlo,monospace;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;font-weight:600;color:#8B8070;padding-left:3px">' + (live ? 'forecast' : 'typical for the dates') + '</span>';
    });
  }
  function render() {
    if (!WX) return;
    legStrips();
    var arts = document.querySelectorAll('article[id^="d"]');
    if (!arts.length) return false;
    Array.prototype.forEach.call(arts, function (art) {
      if (!/^d\d+$/.test(art.id)) return;
      var rec = recFor(art.id);
      if (!rec) return;
      var bar = art.querySelector('[data-keep] > div:last-child');
      if (!bar) return;
      var d = readDay(rec);
      if (d) {
        var old = bar.querySelector('.wxchip');
        if (old) old.remove();
        var s = document.createElement('span');
        s.className = 'wxchip';
        chipStyle(s);
        s.innerHTML = svg(d.icon) + '<span>' + t(d.tmax) + ' / ' + t(d.tmin) + '</span>';
        s.title = (d.live ? 'Forecast \u00B7 Open-Meteo' : 'Typical for the date \u00B7 ' + WX.source) +
                  (d.word ? ' \u00B7 ' + d.word : '') +
                  (d.live ? (d.pop != null ? ' \u00B7 rain ' + d.pop + '%' : '') : ' \u00B7 wet days ' + d.wet + '%') +
                  (rec.sunrise ? ' \u00B7 light ' + rec.sunrise + '\u2013' + rec.sunset : '');
        var spacer = bar.querySelector(':scope > span[style*="flex:1"], :scope > span[style*="flex: 1"]');
        bar.insertBefore(s, spacer ? spacer.nextSibling : null);
      }
      if (rec.loc === 'miyako' && TIDES && TIDES.days[rec.date]) {
        var td = TIDES.days[rec.date];
        var oldT = bar.querySelector('.tidechip');
        if (oldT) oldT.remove();
        var day = function (evs) { return evs.filter(function (e) { var h = +e.t.slice(0, 2); return h >= 6 && h <= 20; }); };
        var los = day(td.lows), his = day(td.highs);
        if (los.length || his.length) {
          var s2 = document.createElement('span');
          s2.className = 'tidechip';
          chipStyle(s2);
          var parts = his.map(function (e) { return '\u25B2 ' + e.t; }).concat(los.map(function (e) { return '\u25BC ' + e.t; }));
          s2.textContent = parts.join(' \u00B7 ');
          s2.title = 'Tide \u00B7 Hirara \u00B7 \u25B2 high \u25BC low (daytime) \u00B7 range ' + td.range + ' cm \u00B7 ' + td.kind + ' tides';
          var wx = bar.querySelector('.wxchip');
          bar.insertBefore(s2, wx ? wx.nextSibling : null);
        }
      }
    });
    return true;
  }

  function worthFetching() {
    var dates = Object.keys(WX.days).map(function (k) { return WX.days[k].date; }).sort();
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var toStart = Math.round((new Date(dates[0] + 'T00:00') - today) / 86400000);
    var pastEnd = Math.round((today - new Date(dates[dates.length - 1] + 'T00:00')) / 86400000);
    return toStart <= HORIZON && pastEnd <= 0;
  }
  function fetchLive() {
    var keys = {};
    Object.keys(WX.days).forEach(function (k) { keys[WX.days[k].loc] = 1; (WX.days[k].alts || []).forEach(function (a) { keys[a.loc] = 1; }); });
    keys = Object.keys(keys).sort();
    var q = LIVE + '?latitude=' + keys.map(function (k) { return WX.locs[k].lat; }).join(',') +
      '&longitude=' + keys.map(function (k) { return WX.locs[k].lon; }).join(',') +
      '&elevation=' + keys.map(function (k) { return WX.locs[k].elev; }).join(',') +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo&forecast_days=16';
    return fetch(q, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (data) {
      var arr = Array.isArray(data) ? data : [data];
      var out = { __at: Date.now() };
      keys.forEach(function (k, i) {
        var dd = arr[i] && arr[i].daily;
        if (!dd) return;
        var per = {};
        dd.time.forEach(function (iso, j) {
          per[iso] = { code: dd.weather_code[j], tmax: dd.temperature_2m_max[j], tmin: dd.temperature_2m_min[j], pop: dd.precipitation_probability_max[j] };
        });
        out[k] = per;
      });
      try { localStorage.setItem(LS, JSON.stringify(out)); } catch (e) {}
      return out;
    });
  }
  function maybeLive() {
    if (!worthFetching()) return;
    var c = null;
    try { c = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) {}
    if (c && c.__at) { live = c; render(); }
    if (c && c.__at && Date.now() - c.__at < FRESH) return;
    fetchLive().then(function (l) { live = l; render(); }).catch(function () {});
  }

  function json(u) { return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  Promise.all([json('./weather.json'), json('./tides.json')]).then(function (r) {
    WX = r[0]; TIDES = r[1];
    if (!WX || !WX.days) return;
    /* The page streams in; retry until the day articles exist. */
    var tries = 0;
    var iv = setInterval(function () {
      if (render() || ++tries > 120) { clearInterval(iv); maybeLive(); }
    }, 250);
    window.addEventListener('online', maybeLive);
  });
})();
