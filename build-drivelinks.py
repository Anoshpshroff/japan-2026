#!/usr/bin/env python3
"""Generate Google Maps directions links for the driving days.

The point of these is NOT to get from A to B — a satnav already does that, and
it will pick the expressway every time. The point is to pin the route to the
road the itinerary actually wants: Route 341 past the dam lakes rather than the
Akita expressway, Route 103 over Hakkoda rather than around it.

That is what the waypoints are for. Each one is a place ON the intended road, so
Maps cannot quietly reroute you onto something faster and duller.

Coordinates come from places.json where we have them verified. Everything else
uses the Japanese place name, which Google resolves reliably inside Japan and
which is safer than me guessing a lat/lon to four decimals.
"""

import json
import os
from urllib.parse import quote

BASE = os.path.dirname(os.path.abspath(__file__))
PLACES = json.load(open(os.path.join(BASE, 'places.json')))


def pt(name):
    """A verified coordinate if we have one, else the name as written.

    The Miyakojima days start from the villa's own address rather than a generic
    "Hirara", because Seahorse is out at Kugai on the edge of town and starting a
    route from the port would understate every leg by a few minutes."""
    if name in PLACES:
        p = PLACES[name]
        return f"{p['lat']:.5f},{p['lon']:.5f}"
    return name


def url(origin, dest, waypoints=()):
    u = ('https://www.google.com/maps/dir/?api=1'
         f'&origin={quote(pt(origin))}'
         f'&destination={quote(pt(dest))}')
    if waypoints:
        u += '&waypoints=' + quote('|'.join(pt(w) for w in waypoints))
    return u + '&travelmode=driving'


# day id -> (label, why-this-route note, origin, [waypoints], destination)
ROUTES = {
    # ---------- MIYAKOJIMA ----------
    'd-21': ("Airport → Irabu Ohashi → Maehama",
             "The bridge first because you cannot check in until 16:00",
             'Miyako Airport', ['Irabu Ohashi'], 'Yonaha Maehama'),

    'd-23': ("Hirara → Shigira Ougon Onsen",
             "Straight down after the boat",
             '沖縄県宮古島市平良字久貝', [], 'Shigira Ougon Onsen'),

    'd-24': ("Hirara → Maehama → Painagama",
             "Both half-days are operator pickup; this is the evening only",
             '沖縄県宮古島市平良字久貝', ['Yonaha Maehama'], 'パイナガマビーチ'),

    'd-25': ("The island loop — Ikema, Sunayama, Kurima, Irabu",
             "North first, back through Hirara for soba, then the two south bridges at golden hour",
             '沖縄県宮古島市平良字久貝',
             ['Ikema Ohashi', 'Yukishio Museum', 'Sunayama Beach',
              'Kurima Ohashi', 'Irabu Ohashi'],
             'パイナガマビーチ'),

    'd-26-out': ("Hirara → Miyako Airport",
                 "Cars back by 10:00",
                 '沖縄県宮古島市平良字久貝', [], 'Miyako Airport'),

    # ---------- KAKUNODATE ----------
    # No waypoint here on purpose. Pinning Shizukuishi Station pulled the route
    # off Route 46 and onto prefectural 1; left alone, Maps offers 国道46号 as a
    # near-identical option and picks the right road by itself.
    'd-26': ("Morioka Station → Route 46 → the inn",
             "≈50 km over the pass. Maps says an hour; allow 1h20 in the dark",
             'Morioka Station', [], 'Katakurinohana'),

    'd-27': ("Inn → Dakigaeri Gorge → Bukeyashiki-dori → inn",
             "Gorge first, before the coaches; the samurai street after lunch",
             'Katakurinohana', ['Dakigaeri Gorge', 'Bukeyashiki-dori'], 'Katakurinohana'),

    'd-28': ("Inn → Route 341 → Aspite Line → Tsurunoyu",
             "Tamagawa Onsen pins you to Route 341; back for the bath by 15:00",
             'Katakurinohana',
             ['玉川温泉', 'Hachimantai Aspite Line', 'Tsurunoyu'],
             'Katakurinohana'),

    'd-29-out': ("Inn → 341 → Hakka Pass → Towada → Oirase → Hakkoda → Aomori",
                 "The whole point of the day. Without these pins Maps sends you down the Akita expressway and you see nothing",
                 'Katakurinohana',
                 ['玉川温泉', '発荷峠展望台', 'Lake Towada', 'Oirase Gorge', '睡蓮沼'],
                 'Art Hotel Aomori'),

    # ---------- AOMORI ----------
    'd-30': ("Aomori → Jogakura → Ropeway → Tsuta-numa → Sukayu → Aomori",
             "Route 103 both ways, the Hakkoda–Towada Gold Line",
             'Art Hotel Aomori',
             ['城ヶ倉大橋', 'Hakkoda Ropeway', 'Tsuta-numa', 'Sukayu Onsen'],
             'Art Hotel Aomori'),

    'd-2': ("Aomori → Morioka Station",
            "The one day the expressway is the right answer — cars are due back",
            'Art Hotel Aomori', [], 'Morioka Station'),
}

# The 31st is a choose-your-own day, so it gets more than one.
ALTERNATES = {
    'd-31': [
        ("Iwaki Skyline & Hirosaki",
         "69 hairpins to the 8th station; last car up 16:00",
         'Art Hotel Aomori', ['津軽岩木スカイライン', 'Hirosaki Castle', 'Hirosaki Apple Park'],
         'Art Hotel Aomori'),
        ("Shirakami — Aoike & Anmon Falls",
         "Route 101 down the Nihonkai coast on the way back",
         'Art Hotel Aomori', ['Juniko Aoike', 'Anmon Falls'], 'Art Hotel Aomori'),
        ("Osorezan, on Shimokita",
         "2h+ each way, so it is the whole day — and it shuts on the 31st",
         'Art Hotel Aomori', ['Osorezan'], 'Art Hotel Aomori'),
    ],
}

# The 31st shows three, so a bare "Route" on each would not say which is which.
SHORT = {
    'Iwaki Skyline & Hirosaki': 'Iwaki',
    'Shirakami — Aoike & Anmon Falls': 'Shirakami',
    'Osorezan, on Shimokita': 'Osorezan',
}

if __name__ == '__main__':
    out = {}
    for day, (label, note, o, w, d) in ROUTES.items():
        out[day] = [{'label': label, 'note': note, 'url': url(o, d, w),
                     'stops': len(w), 'short': 'Route'}]
    for day, alts in ALTERNATES.items():
        out[day] = [{'label': l, 'note': n, 'url': url(o, d, w), 'stops': len(w),
                     'short': SHORT.get(l, 'Route')}
                    for l, n, o, w, d in alts]

    json.dump(out, open(os.path.join(BASE, 'drivelinks.json'), 'w'),
              ensure_ascii=False, indent=1)

    for day in sorted(out):
        for r in out[day]:
            print(f"{day:10s} {r['stops']} stops  {r['label']}")
            print(f"           {r['url']}\n")
