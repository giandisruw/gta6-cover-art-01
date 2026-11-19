# Golden Hour Cover Studio

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/giandisruw/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/giandisruw/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

An offline browser app that turns any photo into GTA-style cover art — the
multi-panel poster look with a neon-sunset grade — and exports it as a PNG to
share. Built for the [make.fun bounty “Make GTA 6 Cover Art”](https://make.fun/bounty/gta6-cover-art-01) ($250).

## What it does

- **4 layouts** — Vice Grid (hero + 3 panels), Poster Wall (9 panels), Solo Shot
  (one full-bleed photo), Polaroid Stack (three tilted snapshots over a
  procedural sunset sky with drawn palm silhouettes).
- **5 colour grades** — Vice Sunset, Neon Night, Teal Dawn, Rose Gold, Mono Noir.
- **Bold lettering** — Anton title with a Pacifico script subtitle and a gold
  “★ NEON COAST” corner badge. “Neon Coast” is an invented city.
- **Any photo** — pick a sample, upload your own, or mix photos across panels.
  Click a panel to select it, drag to reposition, scroll or slide to zoom.
- **Poster finish** — white frame, film grain, vignette, halftone dots.
- **Undo / redo** — full history, plus Ctrl+Z / Ctrl+Shift+Z.
- **Export PNG** — 1080×1080, 1080×1350, 1920×1080, or all three at once.

## Try it

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no network, no upload. Your
photos never leave your machine.

## How it works

`app/index.html` is the editor; `app/src/cover.js` is the cover engine (plain
2D canvas, no libraries); `app/src/main.js` wires the controls, drag-to-crop
and export; `app/src/shots.js` sets up fixed scenes for screenshots
(`?shot=cover` / `?shot=editor`). `main.ts` (Node 22, stdlib only) copies
`app/` and `screenshots/` to the output and writes `dossier.json` with the
vendored make.fun library.

## Verified in this session

- `node serve.ts` serves every asset with HTTP 200 (page, CSS, 3 modules,
  2 fonts, 4 photos).
- Headless Chromium renders all four layouts; the screenshots in
  `screenshots/` were taken from the running app (see `shots.json`).
- PNG export tested over CDP: valid PNG signature, IHDR 1920×1080 and
  1080×1350, byte-identical on repeat export (seeded grain).
- The page loads zero off-site resources — everything comes from localhost.
- Undo/redo tested in the browser: editing the title, then Undo, restores
  “NEON COAST”; Redo brings the edit back.
- `MAKEFUN_OUTPUT_DIR=out node main.ts` run twice produces identical output
  (byte-identical `dossier.json`).

## Credits

- Fonts: Anton and Pacifico, SIL Open Font License 1.1 — see
  `app/fonts/OFL.txt`.
- Sample photos: Unsplash, free to use (beach sunset, city skyline at dusk,
  neon-lit street, tropical palms).
- No Rockstar Games logo, artwork or font is used anywhere in this entry.

## License

MIT — see [LICENSE](LICENSE).
