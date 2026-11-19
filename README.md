# Vice City Cover Studio — Make GTA 6 Cover Art (gta6-cover-art-01)

An offline web app that turns any photo + caption into GTA-poster-style
cover art and exports it as a PNG to share. No uploads, no network, no
account: photos never leave the machine.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

Node.js 22.18+ required. No build step, no dependencies.

## What it does

- **5 layouts** — Hero + 3, Four Panel (2×2), Nine Mosaic (3×3 with the
  title in the centre cell), Full Bleed, Tilted Snaps (three tilted
  polaroid-style snapshots on a sunset backdrop).
- **6 colour grades** — Vice Sunset, Neon Nights, Teal Heat, Golden Hour,
  Palm Noir, Palm Candy. Each grade is a canvas filter plus a gradient
  wash, so it works on any photo.
- **Poster lettering** — big gradient title with a thick outline (Anton,
  vendored under the SIL Open Font License), neon script subtitle
  (Pacifico, OFL), badge ribbon and a 5-star heat meter.
- **Any photo** — upload up to 6 photos, or use the 4 bundled samples.
  Click a panel to select it, drag to reframe, scroll to zoom, or use
  the zoom slider. Photos can be shuffled across panels.
- **Fast to PNG** — one-click export at 1080×1080, 1080×1350, 1920×1080
  and 1080×1920, or "Export all 4 sizes" at once.
- **Polish** — film grain, vignette, halftone title block, white poster
  frame, undo/redo (Ctrl+Z / Ctrl+Shift+Z), 5 one-tap looks
  ("Sunset Heist", "Neon Shore", "Pier Pressure", "Boulevard Queen",
  "Night Shift").

## Files

- `main.ts` — the entry program (Node 22, stdlib only): copies `app/`
  and `screenshots/` to `/output` and writes `dossier.json`.
- `serve.ts` — tiny static server for local testing.
- `app/` — the web app, static files only:
  - `index.html`, `style.css`
  - `src/cover.js` — the cover render engine (layouts, grades, lettering)
  - `src/main.js` — UI wiring, undo/redo, export
  - `src/shots.js` — fixed `?shot=` scenes for screenshots
  - `fonts/` — Anton + Pacifico (OFL, texts beside them)
  - `samples/` — 4 AI-made sample photos (no real people, no logos)
- `screenshots/` — 4 JPEGs: the cover (hero+3), the editor with a photo
  loaded, the nine-mosaic cover, the tilted-snapshot cover.
- `shots.json` — the scenes/commands the screenshots were taken with.
- `vendor/makefun-app.ts` — the kit's dossier library, unchanged.
- `LICENSE` — MIT.

## Originality

All art, lettering and fonts are original or OFL-licensed. No Rockstar
Games logo, artwork or font is used anywhere. The sample photos were made
for this entry with an image model; the two starter samples are the kit's
own. The app makes no network request: every file it loads lives under
`app/`.

## Verification (2026-11-19, headless Chromium)

- App loads with **zero console errors, zero failed requests, zero
  external requests** (offline check).
- Editor probe: 5 layouts, 6 grades, 5 presets, 4 sizes present; canvas
  renders 399 distinct colours.
- "Export all 4 sizes" downloaded all four PNGs at exactly 1080×1080,
  1080×1350, 1920×1080, 1080×1920.
- `MAKEFUN_OUTPUT_DIR=out node main.ts` builds `dossier.json`
  (997 KB, text 41,681 bytes) and two runs are byte-identical.
- Gate limits self-checked: app/ 13 files / 518 KB (caps 993 / 48 MiB),
  `index.html` 4 KB (cap 1 MiB), screenshots 4 files, each ≤ 256 KiB,
  long side ≤ 1280, short side ≥ 480.
