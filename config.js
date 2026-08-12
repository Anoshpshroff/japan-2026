/* ─────────────────────────────────────────────────────────────
   Almost nothing to configure any more.

   The shared checklist works automatically: state lives in Netlify Blobs
   behind this site's own function, so there is no account to create and
   no key to paste. Tick something and it updates for all six of you.

   Only touch this if you want to turn sharing OFF and go back to
   per-device ticks, or point the checklist at a different endpoint.
   ───────────────────────────────────────────────────────────── */

window.TRIP_SYNC = {
  disabled: false          // true = ticks stay on your own device
  // endpoint: './.netlify/functions/checks'   // override only if you move hosts
};
