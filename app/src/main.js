// Golden Hour Cover Studio — editor wiring: state, undo/redo, drag-to-crop,
// photo upload, and PNG export at 1080x1080, 1080x1350 and 1920x1080.
// A `?shot=` query sets up a fixed scene for a screenshot instead (./shots.js).
import { SAMPLES, LAYOUTS, GRADES, SIZES, defaultState, panelCount, panelAt, drawCover, renderCover, coverFileName } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

let state = defaultState();
let selectedPanel = 0;
let images = {};
let undoStack = [];
let redoStack = [];
let dragging = null;

const clone = (s) => JSON.parse(JSON.stringify(s));

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function loadSamples() {
  for (const name of SAMPLES) {
    try {
      images[name] = await loadImage(`./samples/${name}.jpg`);
    } catch {
      images[name] = null;
    }
  }
}

function sizeOf() {
  return SIZES[state.size] ?? SIZES['1080x1080'];
}

function redraw() {
  const [w, h] = sizeOf();
  canvas.width = w;
  canvas.height = h;
  drawCover(ctx, w, h, state, images);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function pushHistory() {
  undoStack.push(clone(state));
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
  syncHistoryButtons();
}

/**
 * Pushes a snapshot taken BEFORE a change. Callers that mutate the live state
 * as the user types or drags (title text, zoom slider, panel drag) must pass
 * the snapshot they took before the first mutation — pushing the live state
 * after the change would make Undo restore the changed state, i.e. do nothing.
 */
function pushSnapshot(snapshot) {
  undoStack.push(clone(snapshot));
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
  syncHistoryButtons();
}

function syncHistoryButtons() {
  document.getElementById('undo').disabled = undoStack.length === 0;
  document.getElementById('redo').disabled = redoStack.length === 0;
}

function applyState(next, { keepHistory = false } = {}) {
  if (!keepHistory) pushHistory();
  state = clone(next);
  syncControls();
  redraw();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(clone(state));
  state = undoStack.pop();
  syncControls();
  redraw();
  syncHistoryButtons();
  setStatus('Undid that change.');
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(clone(state));
  state = redoStack.pop();
  syncControls();
  redraw();
  syncHistoryButtons();
  setStatus('Redid that change.');
}

// --- Controls ---------------------------------------------------------------

function buildThumbs() {
  const box = document.getElementById('thumbs');
  for (const name of SAMPLES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.photo = name;
    b.setAttribute('aria-pressed', 'false');
    b.title = `Use the ${name} photo for the selected panel`;
    const img = document.createElement('img');
    img.src = `./samples/${name}.jpg`;
    img.alt = `${name} sample photo`;
    const label = document.createElement('span');
    label.textContent = name;
    b.append(img, label);
    b.addEventListener('click', () => {
      const next = clone(state);
      next.panels[selectedPanel].photo = name;
      next.panels[selectedPanel].zoom = 1;
      next.panels[selectedPanel].ox = 0;
      next.panels[selectedPanel].oy = 0;
      applyState(next);
      setStatus(`Panel ${selectedPanel + 1} now shows the ${name} photo.`);
    });
    box.append(b);
  }
}

function buildChoices(id, entries, get, set) {
  const box = document.getElementById(id);
  for (const [key, info] of Object.entries(entries)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.key = key;
    b.setAttribute('aria-pressed', String(get() === key));
    if (key === 'sunset' || key === 'neon' || key === 'teal' || key === 'rose' || key === 'noir') {
      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = `linear-gradient(135deg, ${info.sky[1]}, ${info.sky[2]})`;
      b.append(sw);
    }
    b.append(document.createTextNode(info.label));
    b.addEventListener('click', () => {
      const next = clone(state);
      set(next, key);
      applyState(next);
    });
    box.append(b);
  }
}

function syncControls() {
  for (const [id, get] of [['layouts', () => state.layout], ['grades', () => state.grade]]) {
    for (const b of document.getElementById(id).children) {
      b.setAttribute('aria-pressed', String(b.dataset.key === get()));
    }
  }
  for (const b of document.getElementById('thumbs').children) {
    b.setAttribute('aria-pressed', String(b.dataset.photo === state.panels[selectedPanel].photo));
  }
  document.getElementById('title').value = state.title;
  document.getElementById('subtitle').value = state.subtitle;
  document.getElementById('size').value = state.size;
  document.getElementById('zoom').value = String(Math.round(state.panels[selectedPanel].zoom * 100));
  document.getElementById('fxFrame').checked = state.fx.frame;
  document.getElementById('fxGrain').checked = state.fx.grain;
  document.getElementById('fxVignette').checked = state.fx.vignette;
  document.getElementById('fxHalftone').checked = state.fx.halftone;
  const count = panelCount(state.layout);
  const role = state.layout === 'solo' ? 'full photo' : `panel ${selectedPanel + 1} of ${count}`;
  document.getElementById('panelLabel').textContent = `${role} — ${state.panels[selectedPanel].photo} photo`;
}

function bindControls() {
  // Text inputs mutate live on every keystroke, so snapshot on focus (before
  // the first keystroke) and commit that snapshot on change.
  let textSnapshot = null;
  for (const id of ['title', 'subtitle']) {
    const input = document.getElementById(id);
    input.addEventListener('focus', () => { textSnapshot = clone(state); });
    input.addEventListener('input', (e) => {
      state[id] = e.target.value;
      redraw();
    });
    input.addEventListener('change', () => {
      if (textSnapshot) { pushSnapshot(textSnapshot); textSnapshot = null; }
    });
  }
  document.getElementById('size').addEventListener('change', (e) => {
    const next = clone(state);
    next.size = e.target.value === 'all' ? state.size : e.target.value;
    applyState(next);
  });
  const zoomInput = document.getElementById('zoom');
  let zoomSnapshot = null;
  zoomInput.addEventListener('focus', () => { zoomSnapshot = clone(state); });
  zoomInput.addEventListener('input', (e) => {
    state.panels[selectedPanel].zoom = Number(e.target.value) / 100;
    redraw();
  });
  zoomInput.addEventListener('change', () => {
    if (zoomSnapshot) { pushSnapshot(zoomSnapshot); zoomSnapshot = null; }
  });
  document.getElementById('resetCrop').addEventListener('click', () => {
    const next = clone(state);
    next.panels[selectedPanel].zoom = 1;
    next.panels[selectedPanel].ox = 0;
    next.panels[selectedPanel].oy = 0;
    applyState(next);
    setStatus('Crop reset for the selected panel.');
  });
  document.getElementById('cyclePhoto').addEventListener('click', () => {
    const next = clone(state);
    const cur = next.panels[selectedPanel].photo;
    const i = SAMPLES.indexOf(cur);
    next.panels[selectedPanel].photo = SAMPLES[(i + 1) % SAMPLES.length];
    applyState(next);
  });
  for (const [id, key] of [['fxFrame', 'frame'], ['fxGrain', 'grain'], ['fxVignette', 'vignette'], ['fxHalftone', 'halftone']]) {
    document.getElementById(id).addEventListener('change', (e) => {
      const next = clone(state);
      next.fx[key] = e.target.checked;
      applyState(next);
    });
  }
  document.getElementById('undo').addEventListener('click', undo);
  document.getElementById('redo').addEventListener('click', redo);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  });
  document.getElementById('upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const img = await loadImage(URL.createObjectURL(file));
      images.upload = img;
      const next = clone(state);
      next.panels[selectedPanel].photo = 'upload';
      next.panels[selectedPanel].zoom = 1;
      next.panels[selectedPanel].ox = 0;
      next.panels[selectedPanel].oy = 0;
      applyState(next);
      setStatus(`Your photo is in panel ${selectedPanel + 1}.`);
    } catch {
      setStatus('That file could not be read as a photo.');
    }
  });
  document.getElementById('export').addEventListener('click', exportCovers);
}

// --- Drag to reposition the selected panel's photo ---------------------------

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const [w, h] = sizeOf();
  return {
    x: ((e.clientX - rect.left) / rect.width) * w,
    y: ((e.clientY - rect.top) / rect.height) * h,
  };
}

function bindDrag() {
  canvas.addEventListener('pointerdown', (e) => {
    const p = canvasPoint(e);
    const [w, h] = sizeOf();
    const hit = panelAt(state.layout, w, h, p.x, p.y);
    if (hit === -1) return;
    selectedPanel = hit;
    syncControls();
    const panel = state.panels[hit];
    dragging = { startX: p.x, startY: p.y, ox: panel.ox, oy: panel.oy, moved: false, snapshot: clone(state) };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const p = canvasPoint(e);
    const [w, h] = sizeOf();
    const dx = (p.x - dragging.startX) / w;
    const dy = (p.y - dragging.startY) / h;
    if (Math.abs(dx) + Math.abs(dy) > 0.002) dragging.moved = true;
    const panel = state.panels[selectedPanel];
    panel.ox = Math.max(-0.6, Math.min(0.6, dragging.ox + dx));
    panel.oy = Math.max(-0.6, Math.min(0.6, dragging.oy + dy));
    redraw();
  });
  canvas.addEventListener('pointerup', () => {
    if (dragging?.moved) pushSnapshot(dragging.snapshot);
    dragging = null;
  });
  // Wheel zoom has no change event, so commit the pre-zoom snapshot once the
  // wheel goes quiet for a beat (one history step per zoom gesture).
  let wheelSnapshot = null;
  let wheelTimer = null;
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (!wheelSnapshot) wheelSnapshot = clone(state);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      if (wheelSnapshot) { pushSnapshot(wheelSnapshot); wheelSnapshot = null; }
    }, 700);
    const panel = state.panels[selectedPanel];
    panel.zoom = Math.max(1, Math.min(3, panel.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
    document.getElementById('zoom').value = String(Math.round(panel.zoom * 100));
    redraw();
  }, { passive: false });
}

// --- Export ------------------------------------------------------------------

function downloadCanvas(out, filename) {
  return new Promise((resolve) => {
    out.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve(blob?.size ?? 0);
    }, 'image/png');
  });
}

async function exportCovers() {
  const choice = document.getElementById('size').value;
  const keys = choice === 'all' ? Object.keys(SIZES) : [choice];
  let total = 0;
  for (const key of keys) {
    const [w, h] = SIZES[key];
    const out = renderCover(w, h, state, images);
    total += await downloadCanvas(out, coverFileName(key));
  }
  setStatus(keys.length === 1
    ? `Saved ${coverFileName(keys[0])} (${(total / 1024).toFixed(0)} KB).`
    : `Saved all three sizes (${(total / 1024).toFixed(0)} KB total).`);
}

/** Test hook: renders and returns a PNG data URL at the requested size. */
window.__exportPng = async (sizeKey) => {
  const [w, h] = SIZES[sizeKey] ?? SIZES['1080x1080'];
  const out = renderCover(w, h, state, images);
  return { dataUrl: out.toDataURL('image/png'), width: w, height: h };
};
/** Test hook: every resource this page loaded, for the offline check. */
window.__loadedResources = () => performance.getEntriesByType('resource').map((r) => r.name);

// --- Boot --------------------------------------------------------------------

async function boot() {
  buildThumbs();
  buildChoices('layouts', LAYOUTS, () => state.layout, (next, key) => { next.layout = key; });
  buildChoices('grades', GRADES, () => state.grade, (next, key) => { next.grade = key; });
  bindControls();
  bindDrag();
  await loadSamples();
  try { await document.fonts.ready; } catch { /* fonts fall back to system faces */ }
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) {
    await runShot(shot, new URLSearchParams(location.search), {
      images, state,
      apply: (next) => { state = next; syncControls(); redraw(); },
      redraw,
    });
  } else {
    syncControls();
    redraw();
    setStatus('Pick a sample photo, or upload your own.');
  }
}

boot();
