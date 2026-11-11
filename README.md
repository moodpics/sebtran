# Seb Trân — Cinematographer & Director

Portfolio site. Static HTML/CSS/JS, hosted on GitHub Pages. No build step.

## Structure

```
index.html      page skeleton
style.css       all styles (dark theme, accent changes per discipline)
films.js        ← the film catalogue (edit this)
app.js          interactions + CONFIG (email, clients, bio texts)
```

## Two disciplines, one site

The switch in the header toggles **Cinematography** and **Direction**.
Each has its own URL, so you can send the right one to the right person:

- `…/#cinematography` — DoP work
- `…/#direction` — directed films

The accent colour, hero film, bio text, HUD and film list all change with the mode.

## Adding / removing a film

Open `films.js`. Each film looks like this:

```js
{
  "id": "1050188257",          // Vimeo video id
  "h": "abc123",               // Vimeo privacy hash (only needed for unlisted videos)
  "client": "Cartier",
  "title": "Gong Li",
  "category": "Commercial",    // Commercial · Fashion · Music Video · Short Film …
  "director": "Yohan Si",      // leave null on films you directed
  "production": "Mazarine",
  "year": "2024",              // optional
  "duration": 50,              // seconds
  "thumb": "https://i.vimeocdn.com/video/…-d"   // Vimeo thumbnail base link (no size suffix)
}
```

- Move a film between the `cinematography` and `direction` lists to change where it appears.
- Order in the list = order on the site. **The first film of each list is the hero loop.**
- Categories become filter chips automatically.

Hover previews use Vimeo's background player, which needs a paid Vimeo plan (Plus or higher) and videos whose embed privacy allows this domain.

## Settings

In `app.js`, the `CONFIG` block at the top holds the contact email, the client marquee and the bio texts for both modes.

## Custom domain

When `sebastien-tran.com` moves off Wix: add a `CNAME` file containing `sebastien-tran.com`, then point the DNS to GitHub Pages (Settings → Pages).
