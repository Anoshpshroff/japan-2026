/* Japan 2026 — shared checklist.
 *
 * Whoever ticks something, it updates for all six of you.
 *
 * There is nothing to configure. State lives in Netlify Blobs behind a function
 * on this same site (netlify/functions/checks.mjs), so there is no third-party
 * account, no API key published in this file, and no cross-origin request.
 *
 * If the endpoint is unreachable — opened from a file:// path, or a host with no
 * functions — this quietly falls back to per-device localStorage and says so.
 *
 * Offline: ticks are queued and flushed when signal returns, which matters on
 * the Hakkoda road and most of Miyakojima.
 */
(function () {
  'use strict';

  var ENDPOINT = (window.TRIP_SYNC && window.TRIP_SYNC.endpoint) || './.netlify/functions/checks';
  var DISABLED = !!(window.TRIP_SYNC && window.TRIP_SYNC.disabled);
  var LS = 'japan2026.checks';
  var OUTBOX = 'japan2026.outbox';

  var note = document.querySelector('.chknote p');
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

  // Show what we already had, instantly — before any network work.
  apply(readLS(LS, '{}'));

  if (DISABLED) {
    setNote('<b>Ticks are saved on this device only.</b> Sharing is switched off in <code>config.js</code>.');
    return;
  }

  var shared = null;          // null = not yet known
  var lastOk = null;

  function status(ok, hardFail) {
    if (ok) { lastOk = new Date(); shared = true; }
    if (hardFail) shared = false;
    if (shared === false) {
      setNote('<b>Ticks are saved on this device only.</b> The shared checklist needs the site&rsquo;s own function, which is not reachable from here.');
      return;
    }
    var when = lastOk ? lastOk.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
    setNote(ok
      ? '<b>Shared across all six of you.</b> Tick something and it appears on everyone else&rsquo;s phone. Last synced ' + when + '.'
      : '<b>Shared checklist — offline just now.</b> Your ticks are saved here and go up the moment you have signal.');
  }

  function pull() {
    return fetch(ENDPOINT, { headers: { 'accept': 'application/json' }, cache: 'no-store' })
      .then(function (r) {
        if (r.status === 404) { status(false, true); return false; }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (remote) {
        if (!remote) return false;
        // anything still queued locally has not reached the server yet — keep it
        var queued = readLS(OUTBOX, '{}');
        Object.keys(queued).forEach(function (k) {
          if (queued[k]) remote[k] = true; else delete remote[k];
        });
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
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (r.status === 404) { status(false, true); return false; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (state) {
      if (!state) return false;
      writeLS(OUTBOX, {});
      apply(state);
      status(true);
      return true;
    }).catch(function () { status(false); return false; });
  }

  function queue(k, done) {
    var q = readLS(OUTBOX, '{}');
    q[k] = done;
    writeLS(OUTBOX, q);
    // reflect locally straight away so the UI never feels laggy
    var s = readLS(LS, '{}');
    if (done) s[k] = true; else delete s[k];
    writeLS(LS, s);
    paintProgress();
    flush();
  }

  boxes.forEach(function (b) {
    b.addEventListener('change', function () { queue(b.getAttribute('data-k'), b.checked); });
  });

  var reset = document.getElementById('chkreset');
  if (reset) reset.addEventListener('click', function () {
    var q = readLS(OUTBOX, '{}');
    boxes.forEach(function (b) { q[b.getAttribute('data-k')] = false; });
    writeLS(OUTBOX, q);
    flush();
  });

  flush().then(function () { return pull(); });

  var timer = null;
  function start() { stop(); timer = setInterval(function () { flush().then(pull); }, 30000); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else { flush().then(pull); start(); }
  });
  window.addEventListener('online', function () { flush().then(pull); });
  window.addEventListener('focus', function () { flush().then(pull); });
  if (!document.hidden) start();
})();
