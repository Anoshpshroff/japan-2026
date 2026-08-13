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

## 3. Shared checkboxes (3 minutes, free)

Right now ticks are saved per device. To make them shared — whoever ticks
something, it updates for everyone:

1. Go to **https://supabase.com**, sign up, **New project**. Free tier, no card.
   Pick any region near Japan or Europe; it makes no practical difference here.

2. Open **SQL Editor → New query**, paste this, and run it:

   ```sql
   create table checks (
     k          text primary key,
     done       boolean not null default false,
     updated_at timestamptz not null default now()
   );

   alter table checks enable row level security;

   create policy "trip party can read"   on checks for select using (true);
   create policy "trip party can insert" on checks for insert with check (true);
   create policy "trip party can update" on checks for update using (true) with check (true);
   ```

3. Go to **Project Settings → API**. Copy the **Project URL** and the
   **anon public** key (the long one, *not* `service_role`).

4. Open `config.js` and paste them in:

   ```js
   window.TRIP_SYNC = {
     url: 'https://yourproject.supabase.co',
     key: 'eyJhbGciOi…'
   };
   ```

5. `git add -A && git commit -m "shared checklist" && git push`

The note under the checklist changes from *"saved on this device"* to
**"Shared across all six of you"**. Test it by ticking something on one phone
and watching it appear on another within thirty seconds.

**Is the anon key safe in a public file?** Yes — it is designed to be public
and ships in every Supabase web app. It grants only what the policies above
allow, which is this one table of tick-boxes. Never paste the `service_role`
key anywhere; that one is not safe to publish.

**Offline:** ticks made with no signal queue up and send when you are back.

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
