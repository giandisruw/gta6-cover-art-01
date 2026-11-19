// Fixed scenes for screenshots: ?shot=cover shows one exported cover alone,
// ?shot=editor shows the full editor with a photo loaded.
// Query knobs: layout, grade, photo, title, subtitle, size, panels (comma list).
// Unknown panel photo names are dropped, so a typo never leaves a blank panel.
// window.__shotReady is set once the scene is painted.
import { SIZES, SAMPLES, defaultState } from './cover.js';

function parsePanels(query) {
  const raw = query.get('panels');
  if (!raw) return null;
  return raw.split(',').map((s) => s.trim()).filter((s) => SAMPLES.includes(s));
}

export async function runShot(shot, query, api) {
  const next = defaultState();
  next.layout = query.get('layout') ?? next.layout;
  next.grade = query.get('grade') ?? next.grade;
  next.title = query.get('title') ?? next.title;
  next.subtitle = query.get('subtitle') ?? next.subtitle;
  const sizeKey = query.get('size');
  if (sizeKey && SIZES[sizeKey]) next.size = sizeKey;

  const panels = parsePanels(query);
  const single = query.get('photo');
  if (panels) {
    panels.forEach((photo, i) => {
      if (next.panels[i]) next.panels[i].photo = photo;
    });
  } else if (single && SAMPLES.includes(single)) {
    next.panels.forEach((p) => { p.photo = single; });
  }

  api.apply(next);
  if (shot === 'cover') document.body.classList.add('shot-cover');
  if (shot === 'editor') document.body.classList.add('shot-editor');
  // Let the fonts settle, then paint twice so the canvas is final.
  try { await document.fonts.ready; } catch { /* fall back */ }
  api.redraw();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  api.redraw();
  window.__shotReady = true;
}
