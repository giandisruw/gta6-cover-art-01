// Vice City Cover Studio — the editor UI.
//
// Owns the editor state, undo/redo, photo uploads, drag-to-reframe,
// zoom, shuffle, one-tap looks and PNG export. The drawing itself lives
// in cover.js; the fixed screenshot scenes live in shots.js.
import { drawCover, hitPanel, layoutGeometry, LAYOUTS, GRADES, PRESETS, SIZES, panelCount } from './cover.js';
import { runShot } from './shots.js';

const SAMPLES = [
  { name: 'woman-car', src: 'samples/woman-car.jpg' },
  { name: 'friends-neon', src: 'samples/friends-neon.jpg' },
  { name: 'pier', src: 'samples/pier.jpg' },
  { name: 'boulevard', src: 'samples/boulevard.jpg' },
];

const MAX_PHOTOS = 6;

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const zoomEl = document.getElementById('zoom');

let nextPhotoId = 1;
const photos = []; // { id, name, src }
const images = new Map(); // photo id -> loaded HTMLImageElement

// The whole cover, as one plain object: easy to snapshot for undo.
const state = {
  layout: 'hero3',
  grade: 'sunset',
  title: 'SUNSET HEIST',
  subtitle: 'Neon Shore',
  badge: 'VICE CITY',
  stars: 5,
  preset: '',
  slots: [], // { photo, zoom, ox, oy } — `photo` indexes into `photos`
  selected: 0,
};

const undoStack = [];
const redoStack = [];
const UNDO_LIMIT = 60;

function takeSnapshot() {
  return JSON.stringify({
    layout: state.layout, grade: state.grade, title: state.title,
    subtitle: state.subtitle, badge: state.badge, stars: state.stars,
    preset: state.preset, slots: state.slots, selected: state.selected,
  });
}

function loadSnapshot(json) {
  Object.assign(state, JSON.parse(json));
  syncControls();
  redraw();
}

function pushUndo() {
  undoStack.push(takeSnapshot());
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  redoStack.length = 0;
  updateUndoButtons();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(takeSnapshot());
  loadSnapshot(undoStack.pop());
  updateUndoButtons();
  setStatus('Undone.');
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(takeSnapshot());
  loadSnapshot(redoStack.pop());
  updateUndoButtons();
  setStatus('Redone.');
}

function updateUndoButtons() {
  document.getElementById('undo').disabled = !undoStack.length;
  document.getElementById('redo').disabled = !redoStack.length;
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

/** Rebuild the panel slots for the current layout, keeping photos in order. */
function resetSlots(keep = true) {
  const n = panelCount(state.layout);
  const old = keep ? state.slots : [];
  state.slots = Array.from({ length: n }, (_, i) => {
    const prev = old[i];
    return prev ? { ...prev } : { photo: i % Math.max(photos.length, 1), zoom: 1, ox: 0, oy: 0 };
  });
  state.selected = Math.min(state.selected, n - 1);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

async function addPhoto(name, src) {
  const id = nextPhotoId++;
  photos.push({ id, name, src });
  try {
    images.set(id, await loadImage(src));
  } catch (err) {
    photos.pop();
    throw err;
  }
  return id;
}

async function loadSamples() {
  photos.length = 0;
  images.clear();
  for (const s of SAMPLES) await addPhoto(s.name, s.src);
  resetSlots(false);
  renderThumbs();
  redraw();
}

function selectedSlot() {
  return state.slots[state.selected];
}

function redraw() {
  drawCover(ctx, canvas.width, canvas.height, state, images, photos);
  drawSelectionOutline();
  const zoom = Math.round((selectedSlot()?.zoom ?? 1) * 100);
  zoomEl.value = String(zoom);
  document.getElementById('zoom-val').textContent = `${zoom}%`;
}

/** Dashed gold outline around the selected panel, so framing is visible. */
function drawSelectionOutline() {
  if (document.body.classList.contains('shot-cover')) return;
  const geo = layoutGeometry(state.layout, canvas.width, canvas.height);
  const p = geo.panels[state.selected];
  if (!p) return;
  ctx.save();
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 10]);
  if (p.rot) {
    ctx.translate((p.x + p.w / 2) * canvas.width, (p.y + p.h / 2) * canvas.height);
    ctx.rotate((p.rot * Math.PI) / 180);
    ctx.strokeRect((-p.w / 2) * canvas.width, (-p.h / 2) * canvas.height, p.w * canvas.width, p.h * canvas.height);
  } else {
    ctx.strokeRect(p.x * canvas.width, p.y * canvas.height, p.w * canvas.width, p.h * canvas.height);
  }
  ctx.restore();
}

function syncControls() {
  document.getElementById('title').value = state.title;
  document.getElementById('subtitle').value = state.subtitle;
  document.getElementById('badge').value = state.badge;
  document.getElementById('stars').value = String(state.stars);
  document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('active', b.dataset.grade === state.grade));
  document.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('active', b.dataset.preset === state.preset));
  renderThumbs();
}

function renderThumbs() {
  const strip = document.getElementById('thumbs');
  strip.innerHTML = '';
  photos.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.title = `Put ${p.name} in the selected panel`;
    const img = document.createElement('img');
    img.src = p.src;
    img.alt = p.name;
    b.appendChild(img);
    b.classList.toggle('in-use', state.slots.some((s) => s.photo === i));
    b.addEventListener('click', () => {
      pushUndo();
      state.slots[state.selected] = { ...state.slots[state.selected], photo: i };
      redraw();
      renderThumbs();
      setStatus(`${p.name} is now in panel ${state.selected + 1}.`);
    });
    strip.appendChild(b);
  });
  document.getElementById('photo-count').textContent = `${photos.length} / ${MAX_PHOTOS} photos`;
}

function applyPreset(preset) {
  pushUndo();
  state.layout = preset.layout;
  state.grade = preset.grade;
  state.title = preset.title;
  state.subtitle = preset.subtitle;
  state.badge = preset.badge;
  state.stars = preset.stars;
  state.preset = preset.id;
  resetSlots(true);
  syncControls();
  redraw();
  setStatus(`Look applied: ${preset.name}.`);
}

function applyPatch(patch) {
  pushUndo();
  Object.assign(state, patch);
  if (patch.layout) resetSlots(true);
  syncControls();
  redraw();
}

// --- control buttons ------------------------------------------------------

function buildButtons() {
  const layoutBox = document.getElementById('layouts');
  LAYOUTS.forEach((l) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.layout = l.id;
    b.textContent = l.name;
    b.addEventListener('click', () => {
      if (state.layout === l.id) return;
      applyPatch({ layout: l.id, preset: '' });
      setStatus(`Layout: ${l.name}.`);
    });
    layoutBox.appendChild(b);
  });

  const gradeBox = document.getElementById('grades');
  GRADES.forEach((g) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.grade = g.id;
    b.textContent = g.name;
    b.style.setProperty('--swatch', g.accent);
    b.addEventListener('click', () => {
      if (state.grade === g.id) return;
      applyPatch({ grade: g.id, preset: '' });
      setStatus(`Grade: ${g.name}.`);
    });
    gradeBox.appendChild(b);
  });

  const presetBox = document.getElementById('presets');
  PRESETS.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.preset = p.id;
    b.textContent = p.name;
    b.addEventListener('click', () => applyPreset(p));
    presetBox.appendChild(b);
  });

  const sizeBox = document.getElementById('sizes');
  SIZES.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.size = s.id;
    b.textContent = `PNG ${s.label}`;
    b.addEventListener('click', () => exportSize(s));
    sizeBox.appendChild(b);
  });
}

// --- text inputs ------------------------------------------------------------

document.getElementById('title').addEventListener('change', (e) => {
  pushUndo();
  state.title = e.target.value;
  state.preset = '';
  redraw();
});
document.getElementById('subtitle').addEventListener('change', (e) => {
  pushUndo();
  state.subtitle = e.target.value;
  state.preset = '';
  redraw();
});
document.getElementById('badge').addEventListener('change', (e) => {
  pushUndo();
  state.badge = e.target.value;
  state.preset = '';
  redraw();
});
document.getElementById('stars').addEventListener('change', (e) => {
  pushUndo();
  state.stars = Number(e.target.value);
  redraw();
});

// --- photos -----------------------------------------------------------------

document.getElementById('photo').addEventListener('change', async (e) => {
  const room = MAX_PHOTOS - photos.length;
  const files = [...e.target.files].slice(0, Math.max(room, 0));
  if (!files.length) {
    setStatus(photos.length >= MAX_PHOTOS ? `Already at ${MAX_PHOTOS} photos — the most a cover holds.` : 'No photo picked.');
    e.target.value = '';
    return;
  }
  for (const file of files) {
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
    await addPhoto(file.name.replace(/\.[^.]+$/, ''), dataUrl);
  }
  resetSlots(false);
  renderThumbs();
  redraw();
  setStatus(`${files.length} photo${files.length > 1 ? 's' : ''} added. Click a panel, then a thumbnail, to place it.`);
  e.target.value = '';
});

document.getElementById('samples').addEventListener('click', async () => {
  await loadSamples();
  setStatus('Sample photos loaded.');
});

document.getElementById('shuffle').addEventListener('click', () => {
  pushUndo();
  const order = state.slots.map((s) => s.photo);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  state.slots.forEach((s, i) => { s.photo = order[i]; });
  redraw();
  renderThumbs();
  setStatus('Photos shuffled across the panels.');
});

// --- undo / redo ------------------------------------------------------------

document.getElementById('undo').addEventListener('click', undo);
document.getElementById('redo').addEventListener('click', redo);
document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  const key = e.key.toLowerCase();
  if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (key === 'y' || (key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
});

// --- zoom slider ------------------------------------------------------------

let zoomUndoTaken = false;
zoomEl.addEventListener('pointerdown', () => { zoomUndoTaken = false; });
zoomEl.addEventListener('input', () => {
  if (!zoomUndoTaken) { pushUndo(); zoomUndoTaken = true; }
  const slot = selectedSlot();
  if (!slot) return;
  slot.zoom = Number(zoomEl.value) / 100;
  redraw();
});

// --- canvas: click to select, drag to reframe, scroll to zoom ---------------

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const idx = hitPanel(state.layout, canvas.width, canvas.height, p.x, p.y);
  if (idx === -1) return;
  pushUndo();
  state.selected = idx;
  drag = { lastX: p.x, lastY: p.y, panel: idx };
  canvas.setPointerCapture(e.pointerId);
  redraw();
  setStatus(`Panel ${idx + 1} selected — drag to reframe, scroll to zoom.`);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const slot = state.slots[drag.panel];
  if (!slot) return;
  slot.ox = Math.max(-1, Math.min(1, slot.ox + (p.x - drag.lastX) / canvas.width));
  slot.oy = Math.max(-1, Math.min(1, slot.oy + (p.y - drag.lastY) / canvas.height));
  drag.lastX = p.x;
  drag.lastY = p.y;
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });

let lastWheelUndo = 0;
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const slot = state.slots[state.selected];
  if (!slot) return;
  const now = Date.now();
  if (!drag && now - lastWheelUndo > 800) { pushUndo(); lastWheelUndo = now; }
  slot.zoom = Math.max(1, Math.min(4, slot.zoom * (e.deltaY < 0 ? 1.08 : 0.92)));
  redraw();
}, { passive: false });

// --- PNG export -------------------------------------------------------------

function renderOffscreen(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  drawCover(c.getContext('2d'), w, h, state, images, photos);
  return c;
}

function download(canvasEl, filename) {
  return new Promise((resolve) => {
    canvasEl.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve();
    }, 'image/png');
  });
}

async function exportSize(size) {
  await download(renderOffscreen(size.w, size.h), `vice-city-cover-${size.w}x${size.h}.png`);
  setStatus(`Saved vice-city-cover-${size.w}x${size.h}.png`);
}

document.getElementById('export-all').addEventListener('click', async () => {
  const btn = document.getElementById('export-all');
  btn.disabled = true;
  for (const s of SIZES) {
    await exportSize(s);
    await new Promise((r) => setTimeout(r, 250));
  }
  setStatus('All 4 sizes exported.');
  btn.disabled = false;
});

// --- hooks the tests and the screenshot scenes use --------------------------

window.__coverApp = {
  get state() { return state; },
  get photos() { return photos; },
  get images() { return images; },
  setState(patch) {
    Object.assign(state, patch);
    if (patch.layout) resetSlots(true);
    syncControls();
    redraw();
  },
  redraw,
  exportSize,
  renderOffscreen,
  undo,
  redo,
};

// --- boot ---------------------------------------------------------------------

buildButtons();
syncControls();
updateUndoButtons();

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
await loadSamples();
if (document.fonts?.ready) {
  document.fonts.ready.then(() => redraw());
}
redraw();
if (shot) {
  await runShot(shot, query, {
    setState: (patch) => {
      Object.assign(state, patch);
      if (patch.layout) resetSlots(true);
      syncControls();
      redraw();
    },
    setBodyClass: (cls) => document.body.classList.add(cls),
    ready: () => {
      if (document.fonts?.ready) return document.fonts.ready.then(() => redraw());
      redraw();
    },
  });
}
window.__appReady = true;
