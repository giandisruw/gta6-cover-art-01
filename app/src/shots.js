// Golden Hour Cover Studio — fixed scenes for screenshots.
//
// `?shot=cover` draws one exported cover full-frame; `?shot=editor` shows the
// editor with a photo loaded; `?shot=export-test` proves the PNG export path
// produces real PNG bytes. Every scene sets window.__shotReady once painted,
// so a headless browser knows when to take the shot.

import { panelCountFor } from './state.js';

/** Wait until the two display fonts can actually draw. */
async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('40px Pacifico'),
    ]);
    await document.fonts.ready;
  } catch {
    // A missing font falls back to the system faces; the scene still renders.
  }
}

function markReady() {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      window.__shotReady = true;
    }),
  );
}

/**
 * Run one scene. `studio` is the live app handed in by main.js: its state,
 * its photo map, and the functions that load a sample and repaint.
 */
export async function runShot(shot, query, studio) {
  const layout = query.get('layout');
  const grade = query.get('grade');
  const size = query.get('size');
  const title = query.get('title');
  const subtitle = query.get('subtitle');
  const photo = query.get('photo');
  const panels = query.get('panels'); // e.g. "woman-lake,man-portrait,valley-river"

  if (layout) studio.state.layout = layout;
  if (grade) studio.state.grade = grade;
  if (size) studio.state.size = size;
  if (title !== null) studio.state.title = title;
  if (subtitle !== null) studio.state.subtitle = subtitle;

  const keys = panels
    ? panels.split(',').map((s) => s.trim()).filter(Boolean)
    : photo
      ? [photo]
      : [];
  // Fill every panel the layout shows: with fewer photos than panels, cycle
  // through them instead of leaving empty "+ ADD A PHOTO" slots in the shot
  // (the first poster-wall screenshot showed five empty panels).
  const loaded = new Map();
  for (const name of new Set(keys)) {
    const img = await studio.loadSample(name);
    if (img) loaded.set(name, img);
  }
  const usable = keys.filter((k) => loaded.has(k));
  if (usable.length) {
    const total = panelCountFor(studio.state.layout);
    for (let i = 0; i < total; i++) {
      studio.state.panels[i].photo = `sample:${usable[i % usable.length]}`;
    }
  }

  await fontsReady();
  studio.redraw();

  if (shot === 'export-test') {
    const canvas = document.createElement('canvas');
    const { w, h } = studio.renderExport(canvas);
    const url = canvas.toDataURL('image/png');
    const report = document.getElementById('shot-report');
    if (report) {
      report.textContent =
        `export-test ${w}x${h} data-url-bytes=${url.length} ` +
        `png-signature=${url.slice(22, 32)}`;
    }
    window.__exportTest = { w, h, bytes: url.length, head: url.slice(0, 30) };
  }
  markReady();
}
