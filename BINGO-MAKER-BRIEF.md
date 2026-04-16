# Printable Bingo Card Maker — Project Brief

## What we're building

A static web app that generates randomized, printable 5×5 bingo cards from a library of pre-built themes. Hosted on GitHub Pages. Users pick a theme, choose how many cards they want, hit Shuffle, then Print.

## Starting point

There's a working single-theme prototype at `~/Desktop/naval-aviation-bingo.html` (copy it into the repo as a reference). It has solid bones already:

- Single self-contained HTML file, vanilla JS, no dependencies
- 5×5 grid with a FREE center square
- Fisher-Yates shuffle pulling 24 of N items
- Print CSS that uses real borders (not background-color) + `print-color-adjust: exact` so grid lines and colored accents survive printing on any browser
- Letter-size page layout, one card per printed page
- Navy + gold "official document" aesthetic

**Reuse the CSS and print approach wholesale.** That's the hard-won part — don't re-solve it.

## Target structure

```
/
├── index.html          # theme picker + card generator UI
├── app.js              # shuffle, render, theme loader
├── styles.css          # extracted from prototype
└── themes/
    ├── index.json      # list of available themes {id, name, emoji, description}
    ├── naval-aviation.json
    ├── road-trip.json
    ├── zoo.json
    └── ...
```

Each theme JSON:

```json
{
  "id": "naval-aviation",
  "name": "Naval Aviation Museum",
  "emoji": "✈️",
  "subtitle": "Spot it, check it off — first to five in a row wins!",
  "freeSquare": { "line1": "FREE", "line2": "SPACE" },
  "palette": { "ink": "#0b1b3b", "gold": "#c9a24a", "paper": "#fdfaf2" },
  "items": [
    "A plane hanging from the ceiling",
    "..."
  ]
}
```

Themes need a minimum of ~30 items (24 per card + variety across re-shuffles).

## Pre-built themes to ship with v1

Port the naval aviation one, then add a handful more. Suggestions (pick ~5–6):

- **Road Trip** — license plates from different states, cows, billboards, etc. Great for families.
- **Zoo / Aquarium** — animals doing things (eating, sleeping, splashing), keepers, signs.
- **Grocery Store** — for dragging kids along. "Someone with 20+ items in express lane", etc.
- **Beach Day** — seagulls, sandcastles, someone losing a flip-flop.
- **Theme Park / Disney** — rides, characters, overpriced food.
- **Nature Walk** — different leaf shapes, animal tracks, bird calls.
- **Airport** — waiting-at-the-gate entertainment.
- **Holiday Family Gathering** — someone asking about school, relative falling asleep on couch. Skew gently humorous, not mean.

Each theme gets its own palette — road trip could be retro highway sign colors, zoo could be leafy greens, etc. Keep them print-friendly (avoid huge dark backgrounds that eat toner).

## UI requirements

Keep it dead simple:

1. Theme picker — grid of cards with emoji + name + short description
2. Once selected: "Cards: [n]" input, Shuffle button, Print button (same controls as prototype)
3. Cards render below; scroll to preview, one-per-page on print
4. A "← Back to themes" link

No routing library. Plain JS, show/hide sections.

## Hard constraints

- **Static only.** No build step, no framework. Must run on GitHub Pages as-is. Plain HTML/CSS/JS.
- **No dependencies.** No React, no Tailwind, no bundler. The prototype proves this is enough.
- **Offline-capable.** Once loaded, shuffling/printing should work without a network.
- **Print quality is the feature.** Every theme must be tested by actually printing (or print-previewing) a page. Borders visible, FREE square readable, text not cut off.

## Non-goals (don't do these)

- User accounts, saved cards, backend of any kind
- Custom theme builder UI (users can PR a JSON file — keep it simple)
- Mobile-first fancy UI — this is fundamentally a print-to-paper tool
- PDF export — browser print-to-PDF is good enough

## Nice-to-haves (only if time permits)

- URL-based theme linking: `?theme=zoo` deep-links
- "Surprise me" button that picks a random theme
- Each card's footer shows a tiny seed/ID so people can reproduce a card later
- A minimal README explaining how to contribute a new theme (just add a JSON file + register in `themes/index.json`)

## Contribution workflow for new themes

Write it up in the README so others can PR themes:

1. Copy an existing theme JSON as a template
2. Replace id, name, items, palette
3. Add an entry to `themes/index.json`
4. Test by opening `index.html?theme=your-id` locally
5. Submit PR

## GitHub Pages deploy

After `git init` and first push: Settings → Pages → Source: `main` branch, `/` root. Site goes live at `https://<user>.github.io/<repo>/` within a minute or two.

## Success criteria

- Opening `index.html` locally (no server needed) loads the theme picker
- Picking a theme, shuffling, and printing produces a card that looks good on paper
- Adding a new theme is a one-file change plus one line in `themes/index.json`
- Site deploys cleanly to GitHub Pages with zero config
