# Golden Hour Cover Studio

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/giandisruw/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/giandisruw/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

An offline web app that turns any photo and caption into GTA 6-style cover art — the multi-panel poster look with bold lettering and a Vice City sunset or neon grade — exported as a PNG to share. Built for the [make.fun](https://make.fun/bounty/gta6-cover-art-01) bounty **Make GTA 6 Cover Art**.

## How it works

1. Pick a layout: **Vice Grid** (hero + three panels), **Poster Wall** (nine panels), **Solo Shot** (full bleed), or **Polaroid Stack** (tilted snapshots on a sunset sky).
2. Tap a panel, then tap a photo — four bundled samples, or add your own. Drag a photo to reposition it, scroll to zoom, or use the crop buttons.
3. Write the title (Anton, with outline), subtitle (Pacifico script), and corner badge.
4. Pick a grade — Vice Sunset, Neon Night, Teal Dawn, Rose Gold, Mono Noir — plus frame, grain, vignette, and halftone dots.
5. Export a PNG in 1080 × 1080, 1080 × 1350, or 1920 × 1080 — one size, or all three at once. Undo/redo included.

Everything runs offline in the browser from static files; photos never leave the machine. No Rockstar Games logo, artwork, or font is used anywhere: the lettering is Anton and Pacifico under the SIL Open Font License (see `app/fonts/`), and all sample photos are CC0 photos from Picsum.

## Verified (20 Nov 2026, round-4 build)

- `node serve.ts` serves the app; all four screenshots were rendered in headless Chrome from the app's own `?shot=` scenes (see `shots.json`).
- `?shot=export-test` produced a real 1080 × 1080 PNG data URL (3,305,562 chars, signature `iVBORw0KGg`).
- `MAKEFUN_OUTPUT_DIR=out node main.ts` writes `out/` with `app/`, 4 screenshots, and `dossier.json` (927,099 bytes; 8 source files, 42,762 bytes; app total 788,937 bytes in 19 files/dirs — inside the gate's caps). Two runs produce byte-identical output.
- No network requests: every script, font, and sample photo is a file under `app/`.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with the kit's `vendor/makefun-app.ts` library.

## Layout of the repo

- `app/index.html` — the editor page
- `app/style.css` — dark neon editor UI
- `app/src/state.js` — cover state + undo/redo history
- `app/src/grades.js` — the five colour grades
- `app/src/cover.js` — the canvas cover renderer (preview and export share it)
- `app/src/panels.js` — panel picking, panning, zooming
- `app/src/main.js` — wiring: tray, controls, exports, shot scenes
- `app/src/shots.js` — fixed `?shot=` scenes for screenshots
- `app/fonts/` — Anton + Pacifico (OFL, licenses beside them)
- `app/samples/` — four CC0 sample photos
- `screenshots/` — the cover and the editor, as the app drew them
- `main.ts`, `serve.ts`, `vendor/makefun-app.ts` — entry program, dev server, kit library

## License

MIT — see [LICENSE](LICENSE).
