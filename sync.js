/* Japan 2026 — shared checkboxes.

   Without config.js filled in, this does nothing at all and the page keeps
   its per-device localStorage behaviour. With it filled in, every tick is
   written to a shared table and pulled back on every other phone.

   No library, no build step, no bundle to cache offline: Supabase speaks
   plain REST, so this is ~120 lines of fetch(). Updates arrive by polling
   while the tab is visible rather than over a websocket — for a trip
   checklist that is the right trade, and it keeps the offline cache tiny.

   Offline: ticks are queued in localStorage and flushed when signal returns,
   so the checklist stays usable on the Hakkoda road.
*/
(function () {
  'use strict';

  var cfg   = window.TRIP_SYNC || {};
  var LS    = 'japan2026.checks';
  var OUTBOX= 'japan2026.outbox';
  var note  = document.querySelector('.chknote p');
  var boxes = Array.prototype.slice.call(document.querySelectorAll('.chkbox'));
  if (!boxes.length) return;

  function setNote(html) { if (note) note.innerHTML = html; }

  if (!cfg.url || !cfg.key) {
    setNote('<b>Ticks are saved on this device only.</b> To make them shared — so whoever ticks something updates it for all six of you — fill in <code>config.js</code>. It takes three minutes and costs nothing.');
    return;
  }

  var API = cfg.url.replace(/\/+$/, '') + '/rest/v1/checks';
  var HEAD = {
    'apikey': cfg.key,
    'Authorization': 'Bearer ' + cfg.key,
    'Content-Type': 'application/json'
  };

  function readLS(k, d) { try { return JSON.parse(localStorage.getItem(k) || d); } catch (e) { return JSON.parse(d); } }
  function writeLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

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

  var lastOk = null;
  function status(ok, msg) {
    if (ok) lastOk = new Date();
    var when = lastOk ? lastOk.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
    setNote(ok
      ? '<b>Shared across all six of you.</b> Tick something here and it updates on everyone else&rsquo;s phone. Last synced ' + when + '.'
      : '<b>Shared checklist — currently offline.</b> ' + (msg || 'Your ticks are saved here and will sync the moment you have signal.'));
  }

  function pull() {
    return fetch(API + '?select=k,done', { headers: HEAD, cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (rows) {
        var remote = {};
        rows.forEach(function (row) { if (row.done) remote[row.k] = true; });
        // anything still queued locally has not reached the server yet — keep it
        var queued = readLS(OUTBOX, '{}');
        Object.keys(queued).forEach(function (k) {
          if (queued[k]) remote[k] = true; else delete remote[k];
        });
        apply(remote);
        status(true);
        return true;
      })
      .catch(function (e) { status(false); return false; });
  }

  function flush() {
    var queued = readLS(OUTBOX, '{}');
    var keys = Object.keys(queued);
    if (!keys.length) return Promise.resolve(true);
    var payload = keys.map(function (k) { return { k: k, done: !!queued[k] }; });
    return fetch(API, {
      method: 'POST',
      headers: Object.assign({}, HEAD, { 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      writeLS(OUTBOX, {});
      status(true);
      return true;
    }).catch(function () { status(false); return false; });
  }

  function queue(k, done) {
    var q = readLS(OUTBOX, '{}');
    q[k] = done;
    writeLS(OUTBOX, q);
    flush();
  }

  boxes.forEach(function (b) {
    b.addEventListener('change', function () {
      queue(b.getAttribute('data-k'), b.checked);
      paintProgress();
    });
  });

  var reset = document.getElementById('chkreset');
  if (reset) reset.addEventListener('click', function () {
    var q = readLS(OUTBOX, '{}');
    boxes.forEach(function (b) { q[b.getAttribute('data-k')] = false; });
    writeLS(OUTBOX, q);
    flush();
  });

  // Show whatever we already had, instantly, then reconcile with the server.
  apply(readLS(LS, '{}'));
  flush().then(pull);

  var timer = null;
  function startPolling() {
    stopPolling();
    timer = setInterval(function () { flush().then(pull); }, 30000);
  }
  function stopPolling() { if (timer) { clearInterval(timer); timer = null; } }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopPolling();
    else { flush().then(pull); startPolling(); }
  });
  window.addEventListener('online', function () { flush().then(pull); });
  window.addEventListener('focus', function () { flush().then(pull); });
  if (!document.hidden) startPolling();
})();
