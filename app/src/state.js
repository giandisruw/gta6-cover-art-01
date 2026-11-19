// Golden Hour Cover Studio — state model.
//
// The whole cover is one plain JSON-able object, so undo/redo is just a stack of
// snapshots and the cover renderer stays a pure function of (state, photos).
// This module touches no DOM, so Node can import it for a smoke test.

export const LAYOUTS = [
  { id: 'vice-grid', name: 'Vice Grid', panels: 4, blurb: 'Hero + three stacked panels' },
  { id: 'poster-wall', name: 'Poster Wall', panels: 9, blurb: 'Nine-panel poster grid' },
  { id: 'solo', name: 'Solo Shot', panels: 1, blurb: 'One photo, full bleed' },
  { id: 'polaroids', name: 'Polaroid Stack', panels: 4, blurb: 'Tilted snapshots on a sunset' },
];

export const GRADES = [
  { id: 'sunset', name: 'Vice Sunset' },
  { id: 'neon', name: 'Neon Night' },
  { id: 'teal', name: 'Teal Dawn' },
  { id: 'rose', name: 'Rose Gold' },
  { id: 'noir', name: 'Mono Noir' },
];

export const SIZES = [
  { id: '1080x1080', name: 'Square · 1080 × 1080', w: 1080, h: 1080 },
  { id: '1080x1350', name: 'Portrait · 1080 × 1350', w: 1080, h: 1350 },
  { id: '1920x1080', name: 'Wide · 1920 × 1080', w: 1920, h: 1080 },
];

/** How many panels a layout shows. */
export function panelCountFor(layoutId) {
  const found = LAYOUTS.find((l) => l.id === layoutId);
  return found ? found.panels : 4;
}

/** Export dimensions for a size id, falling back to the square. */
export function sizeFor(sizeId) {
  const found = SIZES.find((s) => s.id === sizeId);
  return found ? { w: found.w, h: found.h } : { w: 1080, h: 1080 };
}

/** One empty panel slot: no photo yet, centred, unzoomed. */
export function emptyPanel() {
  return { photo: null, zoom: 1, ox: 0, oy: 0 };
}

/** The state a fresh visitor starts from. */
export function defaultState() {
  return {
    layout: 'vice-grid',
    grade: 'sunset',
    size: '1080x1080',
    title: 'NEON COAST',
    subtitle: 'a golden hour story',
    badge: 'EST. 2026 · NEON COAST',
    titlePos: 'bottom',
    frame: true,
    grain: true,
    vignette: true,
    halftone: false,
    // Nine slots; a layout only draws its first panelCountFor(layout) of them.
    panels: Array.from({ length: 9 }, () => emptyPanel()),
  };
}

/** Deep copy through JSON: state holds only plain data. */
export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

/**
 * Undo/redo history over state snapshots. push() stores the state *before* a
 * change; undo() returns the snapshot to restore, or null when empty.
 */
export class CoverHistory {
  constructor() {
    this.past = [];
    this.future = [];
  }

  push(state) {
    this.past.push(cloneState(state));
    if (this.past.length > 60) this.past.shift();
    this.future = [];
  }

  undo(current) {
    if (this.past.length === 0) return null;
    this.future.push(cloneState(current));
    return this.past.pop();
  }

  redo(current) {
    if (this.future.length === 0) return null;
    this.past.push(cloneState(current));
    return this.future.pop();
  }

  get canUndo() {
    return this.past.length > 0;
  }

  get canRedo() {
    return this.future.length > 0;
  }
}
