// Fixed scenes for screenshots: ?shot=editor shows the page with a sample
// photo loaded; ?shot=cover shows a cover alone (body.shot-cover hides the
// controls). `scene` picks a preset + sample order; `layout`, `grade`,
// `title`, `subtitle` and `size` override it. window.__shotReady is set
// once painted, so a headless screenshot can wait for it.
import { defaultState, defaultSlots, PRESETS } from './cover.js';

const SCENES = {
  // 1-cover: hero + 3, sunset grade.
  cover: { preset: 'heist', size: 'square', order: [0, 2, 1, 3] },
  // 2-editor: the editor with a photo loaded.
  editor: { preset: 'heist', size: 'square', order: [0, 2, 1, 3] },
  // 3-cover: nine-mosaic neon cover, portrait.
  mosaic: { preset: 'neon', size: 'portrait', order: [0, 2, 1, 3, 0, 2, 1, 3] },
  // 4-cover: tilted snapshots, golden hour, wide — landscape photos only,
  // so no portrait head gets cropped by the wide snapshot frames.
  tilted: { preset: 'pier', size: 'wide', order: [0, 2, 3] },
};

export async function runShot(shot, query, api) {
  const scene = SCENES[shot] ?? SCENES.cover;
  if (shot === 'cover' || shot === 'mosaic' || shot === 'tilted') {
    document.body.classList.add('shot-cover');
  }
  const preset = PRESETS.find((p) => p.id === scene.preset) ?? PRESETS[0];
  const next = defaultState();
  next.layout = query.get('layout') ?? preset.layout;
  next.grade = query.get('grade') ?? preset.grade;
  next.title = query.get('title') ?? preset.title;
  next.subtitle = query.get('subtitle') ?? preset.subtitle;
  next.heat = preset.heat;
  next.slots = defaultSlots(next.layout);
  // Rotate the bundled samples across the panels so every panel differs.
  const order = scene.order ?? [0, 2, 1, 3, 0, 2, 1, 3];
  next.slots.forEach((slot, i) => { slot.photo = order[i % order.length] % Math.max(1, api.photos.length); });
  api.apply(next);

  // Use the requested export size for the cover scene's canvas.
  const sizeId = query.get('size') ?? scene.size;
  const sizeBtn = document.querySelector(`#sizes .chip[data-size="${sizeId}"]`);
  if (sizeBtn) sizeBtn.click();

  try { await Promise.all([document.fonts.load('90px Anton'), document.fonts.load('40px Pacifico')]); } catch { /* system-font fallback */ }
  api.redraw();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.__shotReady = true;
}
