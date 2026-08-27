# Adding new finds to the Explore tab

Everything on the Explore tab comes from `explore.json`. To add a place, drop a new
object into the right region's category and redeploy (or just tell Claude in chat and
it will fold it in and rebuild).

## Where

`explore.json` → `regions[]` → find your region (`tokyo`, `fuji`, `miyako`,
`kakunodate`, `aomori`) → `cats[]` → find the category (`eat`, `do`, `walks`,
`drives`, `water`, `shops`) → append to `cards` (photo entry) or `rows` (plain tip).

## Entry shape

```json
{
  "card": true,
  "title": "Name of the place",
  "sub": "one-line qualifier",
  "text": "Why it's worth it, how to find it.",
  "img": "./photos/your-photo.jpg",
  "effort": "quick | half-day | full-day",
  "map": "https://www.google.com/maps?q=LAT,LON(Name)",
  "book": "how to book, if it needs booking",
  "when": "best time to go",
  "phone": "", "url": "", "meta": ""
}
```

Rows are the same minus `card`, `img`, `title` (put everything in `text`).
Photos go in `photos/`; landscape 3:2 crops look best. Every field except `text`
and `effort` can be an empty string.
