/* Shared checklist state, stored in Netlify Blobs.
 *
 * Why this and not Supabase: you already have a Netlify account, so there is
 * nothing to sign up for, no anon key to publish in client-side JS, and no
 * cross-origin request. The store lives with the site.
 *
 *   GET  /.netlify/functions/checks   -> { "<key>": true, ... }
 *   POST /.netlify/functions/checks   body: [{ k, done }, ...]  -> merged state
 *
 * One blob holds the whole map. With six people ticking a checklist that is
 * plenty — and a single document means a tick can never half-apply.
 */
import { getStore } from '@netlify/blobs';

const BLOB = 'checklist';
const KEY = 'state';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type'
    }
  });

export default async (req) => {
  if (req.method === 'OPTIONS') return json({}, 204);

  let store;
  try {
    store = getStore(BLOB);
  } catch (e) {
    return json({ error: 'store unavailable', detail: String(e) }, 500);
  }

  if (req.method === 'GET') {
    try {
      const state = (await store.get(KEY, { type: 'json' })) || {};
      return json(state);
    } catch (e) {
      return json({ error: 'read failed', detail: String(e) }, 500);
    }
  }

  if (req.method === 'POST') {
    let changes;
    try {
      changes = await req.json();
    } catch {
      return json({ error: 'bad json' }, 400);
    }
    if (!Array.isArray(changes)) return json({ error: 'expected an array' }, 400);
    if (changes.length > 500) return json({ error: 'too many changes' }, 413);

    try {
      const state = (await store.get(KEY, { type: 'json' })) || {};
      for (const c of changes) {
        if (!c || typeof c.k !== 'string' || c.k.length > 120) continue;
        if (c.done) state[c.k] = true;
        else delete state[c.k];
      }
      await store.setJSON(KEY, state);
      return json(state);
    } catch (e) {
      return json({ error: 'write failed', detail: String(e) }, 500);
    }
  }

  return json({ error: 'method not allowed' }, 405);
};
