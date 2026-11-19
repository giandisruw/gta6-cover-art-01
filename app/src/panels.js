// Golden Hour Cover Studio — panel picking, panning and zooming.
//
// The preview canvas shows the cover at a small size; these helpers translate
// pointer positions on that canvas into panel edits, keeping every offset
// clamped so a photo can never be dragged clean out of its panel.

import { layoutPanels } from './cover.js';

/** Which panel (index) sits under a point on the preview canvas, or -1. */
export function panelAtPoint(layout, canvasW, canvasH, x, y) {
  const panels = layoutPanels(layout, canvasW, canvasH);
  for (let i = panels.length - 1; i >= 0; i--) {
    const r = panels[i];
    if (!r.rot) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
      continue;
    }
    // Tilted panels (polaroids): un-rotate the point around the panel centre
    // first, so clicks near a tilted corner do not select the wrong panel.
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const a = (-r.rot * Math.PI) / 180;
    const dx = x - cx;
    const dy = y - cy;
    const lx = dx * Math.cos(a) - dy * Math.sin(a);
    const ly = dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(lx) <= r.w / 2 && Math.abs(ly) <= r.h / 2) return i;
  }
  return -1;
}

/** Drag a panel's photo: dx/dy are fractions of the panel size. */
export function panPanel(panel, dx, dy) {
  panel.ox = clamp(panel.ox + dx, -1, 1);
  panel.oy = clamp(panel.oy + dy, -1, 1);
}

/** Zoom a panel's photo, keeping the zoom inside a sane range. */
export function zoomPanel(panel, factor) {
  panel.zoom = clamp(panel.zoom * factor, 1, 4);
}

/** Reset one panel's crop to centred and unzoomed. */
export function resetPanel(panel) {
  panel.zoom = 1;
  panel.ox = 0;
  panel.oy = 0;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
