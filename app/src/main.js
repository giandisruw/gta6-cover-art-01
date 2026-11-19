// Vice City Cover Studio — UI wiring (v2).
// Owns the editor state, undo/redo, photo uploads, drag-to-reframe,
// zoom, shuffle, presets and PNG export. The drawing itself lives in
// cover.js; fixed screenshot scenes live in shots.js.
import { drawCover, hitPanel, layoutGeometry, LAYOUTS, GRADES, PRESETS, SIZES, panelCount } from './cover.js';
import { runShot } from './shots.js';

const SAMPLES = [
  { name: 'woman-car', src: 'samples/woman-car.jpg' },
  { name: 'friends-neon', src: 'samples/friends-neon.jpg' },
  { name: 'pier', src: 'samples/pier.jpg' },
  { name: 'boulevard', src: 'samples/boulevard.jpg' },
];

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const zoomEl = document.getElementById('zoom');

let nextPhotoId = 1;
const photos = []; // { id, name, src }
const images = new Map(); // id -> HTMLImageElement

const state = {
  layout: 'hero3',
  grade: 'sunset',
  title: 'SUNSET HEIST',
  subtitle: 'Neon Shore',
  badge: 'VICE CITY',
  stars: 5,
  slots: [], // { photo, zoom, ox, oy } — photo indexes into photos
  selected: 0,
};

const undoStack = [];
const redoStack = [];

function snapshot() {
  return JSON.stringify({
    layout: state.layout, grade: state.grade, title: state.title,
    subtitle: state.subtitle, badge: state.badge, stars: state.stars,
    slots: state.slots, selected: state.selected,
  });
}

function restore(json) {
  const s = JSON.parse(json);
  Object.assign(state, s);
  syncControls();
  redraw();
}

function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack.length = 0;
  updateUndoButtons();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  updateUndoButtons();
  setStatus('Undone.');
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
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

/** (Re)build slots for the current layout, keeping photos in order. */
function resetSlots(keepPhotos = true) {
  const n = panelCount(state.layout);
  const old = keepPhotos ? state.slots : [];
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

function redraw() {
  drawCover(ctx, canvas.width, canvas.height, state, images, photos);
  drawSelection();
  document.getElementById('zoom').value = String(Math.round((state.slots[state.selected]?.zoom ?? 1) * 100));
  document.getElementById('zoom-val').textContent = `${Math.round((state.slots[state.selected]?.zoom ?? 1) * 100)}%`;
}

/** Outline the selected panel so the user can see what they are framing. */
function drawSelection() {
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
    const used = state.slots.some((s) => s.photo === i);
    b.classList.toggle('in-use', used);
    b.addEventListener('click', () => {
      pushUndo();
      state.slots[state.selected] = { ...state.slots[state.selected], photo: i };
      redraw();
      renderThumbs();
      setStatus(`${p.name} is now in panel ${state.selected + 1}.`);
    });
    strip.appendChild(b);
  });
  document.getElementById('photo-count').textContent = `${photos.length} / 6 photos`;
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

function applyStatePatch(patch) {
  pushUndo();
  Object.assign(state, patch);
  if (patch.layout) resetSlots(true);
  syncControls();
  redraw();
}

// --- control wiring -------------------------------------------------------

function buildButtons() {
  const layoutBox = document.getElementById('layouts');
  LAYOUTS.forEach((l) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.layout = l.id;
    b.textContent = l.name;
    b.addEventListener('click', () => {
      if (state.layout === l.id) return;
      applyStatePatch({ layout: l.id, preset: '' });
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
      applyStatePatch({ grade: g.id, preset: '' });
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

document.getElementById('photo').addEventListener('change', async (e) => {
  const files = [...e.target.files].slice(0, 6 - photos.length);
  if (!files.length) {
    setStatus(photos.length >= 6 ? 'Already at 6 photos — the most a cover holds.' : 'No photo picked.');
    e.target.value = '';
    return;
  }
  for (const file of files) {
    const dataUrl = await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(file);
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

document.getElementById('undo').addEventListener('click', undo);
document.getElementById('redo').addEventListener('click', redo);
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
});

let zoomSnapshotTaken = false;
zoomEl.addEventListener('pointerdown', () => { zoomSnapshotTaken = false; });
zoomEl.addEventListener('input', () => {
  if (!zoomSnapshotTaken) { pushUndo(); zoomSnapshotTaken = true; }
  const slot = state.slots[state.selected];
  if (!slot) return;
  slot.zoom = Number(zoomEl.value) / 100;
  redraw();
});

// --- canvas interaction: click to select, drag to reframe, scroll to zoom ---

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
  slot.ox += (p.x - drag.lastX) / canvas.width;
  slot.oy += (p.y - drag.lastY) / canvas.height;
  slot.ox = Math.max(-1, Math.min(1, slot.ox));
  slot.oy = Math.max(-1, Math.min(1, slot.oy));
  drag.lastX = p.x;
  drag.lastY = p.y;
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });
let lastWheelUndo = 0;
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const idx = state.selected;
  const slot = state.slots[idx];
  if (!slot) return;
  const now = Date.now();
  if (!drag && now - lastWheelUndo > 800) { pushUndo(); lastWheelUndo = now; }
  slot.zoom = Math.max(1, Math.min(4, slot.zoom * (e.deltaY < 0 ? 1.08 : 0.92)));
  redraw();
}, { passive: false });

// --- export ---------------------------------------------------------------

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
  const off = renderOffscreen(size.w, size.h);
  await download(off, `vice-city-cover-${size.w}x${size.h}.png`);
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

// --- test / shot hooks ------------------------------------------------------

window.__coverApp = {
  get state() { return state; },
  get photos() { return photos; },
  get images() { return images; },
  setState(patch) { Object.assign(state, patch); if (patch.layout) resetSlots(true); syncControls(); redraw(); },
  redraw,
  exportSize,
  renderOffscreen,
  undo,
  redo,
};

// --- boot -------------------------------------------------------------------

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
    setState: (patch) => { Object.assign(state, patch); if (patch.layout) resetSlots(true); syncControls(); redraw(); },
    setBodyClass: (cls) => document.body.classList.add(cls),
    ready: () => {
      if (document.fonts?.ready) return document.fonts.ready.then(() => redraw());
      redraw();
    },
  });
}
window.__appReady = true;
