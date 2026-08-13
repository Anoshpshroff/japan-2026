/* Japan 2026 — shared checklist.
 *
 * Whoever ticks something, it updates for all six of you.
 *
 * Backends, tried in this order:
 *   1. Supabase   — if config.js has a url + key. Works on any static host,
 *                   including GitHub Pages, which cannot run server code.
 *   2. A function — /.netlify/functions/checks, if the host provides one.
 *   3. Nothing    — falls back to per-device localStorage and says so plainly.
 *
 * No library: Supabase speaks plain REST, so this is fetch() and nothing else.
 * That matters here because the whole site is precached for offline use and a
 * client bundle would be dead weight on a phone in Nyuto.
 *
 * Offline: ticks queue in localStorage and flush when signal returns.
 */
(function () {
  'use strict';

  var cfg      = window.TRIP_SYNC || {};
  var DISABLED = !!cfg.disabled;
  var LS       = 'japan2026.checks';
  var OUTBOX   = 'japan2026.outbox';
  var TABLE    = 'checks';

  var note  = document.querySelector('.chknote p');
  var boxes = Array.prototype.slice.call(document.querySelectorAll('.chkbox'));
  if (!boxes.length) return;

  function readLS(k, d) { try { return JSON.parse(localStorage.getItem(k) || d); } catch (e) { return JSON.parse(d); } }
  function writeLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function setNote(html) { if (note) note.innerHTML = html; }

  function paintProgress() {
    Array.prototype.forEach.call(document.querySelectorAll('.checkgroup'), function (g) {
      var bs = g.querySelectorAll('.chkbox');
      var done = g.querySelectorAll('.chkbox:checked').length;
      var out = g.querySelector('.chkprog');
      if (!out || !bs.length) return;
      out.textContent = done + '/' + bs.length;
      out.classList.toggle('done', done === bs.length);
    });
  }

  function apply(state) {
    boxes.forEach(function (b) { b.checked = state[b.getAttribute('data-k')] === true; });
    writeLS(LS, state);
    paintProgress();
  }

  // Show what we already have, instantly, before any network work.
  apply(readLS(LS, '{}'));

  if (DISABLED) {
    setNote('<b>Ticks are saved on this device only.</b> Sharing is switched off in <code>config.js</code>.');
    return;
  }

  /* ---------- pick a backend ---------- */
  var supa = (cfg.url && cfg.key)
    ? { base: cfg.url.replace(/\/+$/, '') + '/rest/v1/' + TABLE,
        head: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json' } }
    : null;
  var fnEndpoint = supa ? null : (cfg.endpoint || './.netlify/functions/checks');

  if (!supa && location.hostname.indexOf('github.io') !== -1) {
    // GitHub Pages serves static files only — there is no function to call.
    setNote('<b>Ticks are saved on this device only.</b> To share them across all six of you, ' +
            'add a Supabase url and key to <code>config.js</code> — three minutes, no cost. ' +
            'The steps are in <code>DEPLOY.md</code>.');
    wireLocalOnly();
    return;
  }

  var lastOk = null, shared = null;

  function status(ok, hardFail) {
    if (ok) { lastOk = new Date(); shared = true; }
    if (hardFail) shared = false;
    if (shared === false) {
      setNote('<b>Ticks are saved on this device only.</b> The shared checklist is not reachable from here.');
      return;
    }
    var when = lastOk ? lastOk.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
    setNote(ok
      ? '<b>Shared across all six of you.</b> Tick something and it appears on everyone else&rsquo;s phone. Last synced ' + when + '.'
      : '<b>Shared checklist — offline just now.</b> Your ticks are saved here and go up when you have signal.');
  }

  function pull() {
    var url = supa ? (supa.base + '?select=k,done') : fnEndpoint;
    var opts = supa ? { headers: supa.head, cache: 'no-store' } : { headers: { accept: 'application/json' }, cache: 'no-store' };
    return fetch(url, opts)
      .then(function (r) {
        if (r.status === 404) { status(false, true); return null; }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        if (!data) return false;
        var remote = {};
        if (Array.isArray(data)) data.forEach(function (row) { if (row.done) remote[row.k] = true; });
        else remote = data;
        var queued = readLS(OUTBOX, '{}');
        Object.keys(queued).forEach(function (k) { if (queued[k]) remote[k] = true; else delete remote[k]; });
        apply(remote);
        status(true);
        return true;
      })
      .catch(function () { status(false); return false; });
  }

  function flush() {
    var queued = readLS(OUTBOX, '{}');
    var keys = Object.keys(queued);
    if (!keys.length) return Promise.resolve(true);
    var payload = keys.map(function (k) { return { k: k, done: !!queued[k] }; });
    var url  = supa ? supa.base : fnEndpoint;
    var head = supa
      ? Object.assign({}, supa.head, { Prefer: 'resolution=merge-duplicates,return=minimal' })
      : { 'content-type': 'application/json' };
    return fetch(url, { method: 'POST', headers: head, body: JSON.stringify(payload) })
      .then(function (r) {
        if (r.status === 404) { status(false, true); return false; }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        writeLS(OUTBOX, {});
        status(true);
        return true;
      })
      .catch(function () { status(false); return false; });
  }

  function queue(k, done) {
    var q = readLS(OUTBOX, '{}'); q[k] = done; writeLS(OUTBOX, q);
    var s = readLS(LS, '{}');
    if (done) s[k] = true; else delete s[k];
    writeLS(LS, s);
    paintProgress();
    flush();
  }

  function wireLocalOnly() {
    boxes.forEach(function (b) {
      b.addEventListener('change', function () {
        var s = readLS(LS, '{}');
        if (b.checked) s[b.getAttribute('data-k')] = true; else delete s[b.getAttribute('data-k')];
        writeLS(LS, s); paintProgress();
      });
    });
    var r = document.getElementById('chkreset');
    if (r) r.addEventListener('click', function () {
      boxes.forEach(function (b) { b.checked = false; }); writeLS(LS, {}); paintProgress();
    });
  }

  boxes.forEach(function (b) {
    b.addEventListener('change', function () { queue(b.getAttribute('data-k'), b.checked); });
  });
  var reset = document.getElementById('chkreset');
  if (reset) reset.addEventListener('click', function () {
    var q = readLS(OUTBOX, '{}');
    boxes.forEach(function (b) { q[b.getAttribute('data-k')] = false; });
    writeLS(OUTBOX, q); flush();
  });

  flush().then(pull);

  var timer = null;
  function start() { stop(); timer = setInterval(function () { flush().then(pull); }, 30000); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else { flush().then(pull); start(); }
  });
  window.addEventListener('online', function () { flush().then(pull); });
  window.addEventListener('focus',  function () { flush().then(pull); });
  if (!document.hidden) start();
})();
