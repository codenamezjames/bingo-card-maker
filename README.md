# Bingo Card Maker

A static, printable 5×5 bingo card generator. Pick a theme, choose how many cards, hit Shuffle, then Print. Cards are designed to print well on plain letter paper — real borders, `print-color-adjust: exact`, one card per page.

You can also build your own theme in the browser. It saves to `localStorage`, exports as JSON (so you can submit it as a PR), and shares via a link-only URL — no backend.

## Live site

After enabling GitHub Pages (Settings → Pages → Source: `main` branch, `/` root), the site is served at:

```
https://<your-user>.github.io/<repo>/
```

## Run locally

Plain static files — no build step, no dependencies. You can:

- Open the **hosted URL** (easiest).
- Or serve the folder locally so the browser will `fetch()` the theme files:

  ```sh
  python3 -m http.server 8000
  # then open http://localhost:8000/
  ```

  (Opening `index.html` directly from the file system works in Firefox and Safari but not in Chrome, because Chrome blocks `file://` fetches by default.)

## Features

- **Six pre-built themes**: Naval Aviation Museum, Road Trip, Zoo & Aquarium, Grocery Store, Beach Day, Holiday Family Gathering.
- **Custom theme builder** with live card preview, palette presets, and color pickers. Saves to `localStorage`.
- **Seeded shuffle** — each card shows its seed in the footer; entering a seed in the toolbar reproduces the exact same set of cards.
- **Share links** for custom themes — the theme is encoded into the URL fragment. No backend.
- **Export / Import JSON** — download a custom theme as JSON to share or contribute upstream.
- **Surprise me** random theme picker.
- **Deep links**: `#/theme/<id>` or the legacy `?theme=<id>` both work.

## File layout

```
index.html        Theme picker + generator + custom builder (hash-routed)
app.js            All interactive logic
styles.css        Print-quality card styles + UI chrome
themes/
  index.json      List of bundled themes
  <theme>.json    Each bundled theme
```

## Contributing a new theme

1. Copy an existing theme in `themes/` (e.g. `themes/road-trip.json`) to a new file.
2. Edit `id`, `name`, `emoji`, `description`, `items`, and `palette`. You need **at least 30 items** for good variety across shuffles.
3. Add an entry to `themes/index.json` (just the summary fields — `id`, `name`, `emoji`, `description`, `palette`).
4. Test locally:
   - Run `python3 -m http.server 8000` in the repo root.
   - Open `http://localhost:8000/#/theme/<your-id>`.
   - Click Shuffle a few times, then Print-preview (Cmd/Ctrl-P).
5. Open a PR.

### Theme schema

```json
{
  "id": "your-id",
  "name": "Your Theme Name",
  "emoji": "🎲",
  "description": "Short description shown on the picker.",
  "eyebrow": "SMALL TEXT ABOVE TITLE",
  "subtitle": "Italic line under the BINGO title.",
  "footer": "Text in the card footer.",
  "freeSquare": { "line1": "FREE", "line2": "SPACE" },
  "palette": {
    "ink":   "#0b1b3b",
    "gold":  "#c9a24a",
    "paper": "#fdfaf2"
  },
  "items": [
    "An item",
    "Another item",
    "… at least 30, ideally 35–45"
  ]
}
```

### Palette tips

- `paper` is the card background — keep it light to avoid printing big dark blocks.
- `ink` is text, borders, and the FREE square background.
- `gold` is accents (eyebrow, letter underlines, FREE-square text).
- Test every theme in print preview. If text disappears, there's a contrast bug.

## Design decisions

- **No framework, no build step** — plain HTML / CSS / JS. GitHub Pages serves this as-is.
- **Borders, not background colors** — the grid uses real borders so card lines survive on printers with "don't print background graphics" enabled. The `print-color-adjust: exact` rule keeps the FREE square colored.
- **Free center cell** is baked into the grid at index 12 — every card has 24 shuffled items plus the FREE square.
- **User themes are local** — everything lives in `localStorage` under the key `bingo.userThemes`. There is no backend and no sync. Export or share-link if you want to move a theme between devices.

## License

Do whatever you like. A link back is always appreciated.
