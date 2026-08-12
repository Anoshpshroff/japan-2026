# Japan 2026 — putting this on the web

Everything here is free. No account is needed for step 1, and steps 2–4 are optional.

---

## 1. Put it online (2 minutes, no account needed)

Go to **https://app.netlify.com/drop** and drag this whole `site` folder onto the page.

That's it. You get a live URL like `https://random-words-123.netlify.app` straight away.

- Make a free account when it offers, or the site expires after an hour.
- Once you have an account: **Site settings → Change site name** to something like
  `shroff-japan-2026`, giving you `https://shroff-japan-2026.netlify.app`.
- To update later, drag the folder again. Same URL.

*Cloudflare Pages (`pages.dev`) and GitHub Pages work identically if you prefer them.*

**Want your own domain?** That's the only thing here that costs money — about £10 a year
from Namecheap or Cloudflare. Netlify points at it for free. Entirely optional.

---

## 2. Install it on everyone's phone (30 seconds each)

This is what makes it work with no signal — which matters on Miyakojima,
at Nyuto, and on the Hakkoda road.

- **iPhone:** open the URL in Safari → Share → **Add to Home Screen**
- **Android:** open in Chrome → menu → **Install app** / **Add to Home screen**

It gets a maple-leaf icon, opens without browser chrome, and **the whole itinerary
works offline** from then on. The first visit caches everything; after that signal is optional.

Send the URL to all six of you. Nothing on the page can be used against a booking —
no reference numbers, no PINs, no names — so it is safe to share freely.

---

## 3. Shared checkboxes (3 minutes, free, optional)

Right now ticks are saved per device. To make them shared — whoever ticks something,
it updates for everyone:

1. Go to **https://supabase.com**, sign up, **New project** (free tier, no card).
2. Open **SQL Editor** and run this:

   ```sql
   create table checks (
     k          text primary key,
     done       boolean not null default false,
     updated_at timestamptz not null default now()
   );

   alter table checks enable row level security;

   create policy "trip party can read"  on checks for select using (true);
   create policy "trip party can write" on checks for insert with check (true);
   create policy "trip party can update" on checks for update using (true) with check (true);
   ```

3. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key.
4. Paste both into `config.js`:

   ```js
   window.TRIP_SYNC = {
     url: 'https://yourproject.supabase.co',
     key: 'eyJhbGciOi...'
   };
   ```

5. Drag the folder onto Netlify again.

The note under the checklist will change from *"saved on this device"* to
*"shared across all six of you"*.

**Is the key safe in a public file?** Yes — the anon key is designed to be public and is
what every Supabase web app ships. It only grants what the policies above allow, which is
this one table of tick-boxes. Worst case, someone who finds your URL could tick a box.
Nothing else in your project is reachable with it.

**Offline:** ticks made with no signal are queued and sent the moment you're back.

---

## 4. Real photos (optional)

Drop JPEGs into `photos/` and tell me the filenames — I'll place them into the right
legs and days. The artifact version couldn't do this at all; a real site can.

Keep them under about 400 KB each so the offline cache stays quick. Any phone photo
resized to 1600px wide is fine.

---

## What's in this folder

| File | What it does |
|---|---|
| `index.html` | The entire itinerary. One self-contained file. |
| `config.js` | **The only file you edit.** Shared-checkbox settings. |
| `sync.js` | Talks to Supabase. Does nothing until `config.js` is filled in. |
| `sw.js` | Service worker — makes it work offline. |
| `manifest.webmanifest` | Makes it installable to the home screen. |
| `icons/` | App icons. |
| `photos/` | Empty, ready for step 4. |

If you redeploy and phones still show the old version, bump `CACHE = 'japan2026-v1'`
to `v2` in `sw.js`. That forces every installed copy to refresh.
