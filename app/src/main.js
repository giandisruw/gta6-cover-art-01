// Vice City Cover Studio — page wiring (all original code).
// Photo upload, layouts, grades, presets, per-panel drag/zoom, undo/redo,
// PNG export in the four post sizes. A `?shot=` query sets up a fixed scene
// for a screenshot instead (./shots.js). Everything runs offline in the
// browser; photos never leave the machine.

import {
  drawCover, slotAt, defaultState, defaultSlots, panelCount,
  EXPORT_SIZES, GRADES, LAYOUTS, PRESETS,
} from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const $ = (id) => document.getElementById(id);

const SAMPLES = [
  { name: 'Woman + convertible', file: 'samples/woman-car.jpg' },
  { name: 'Boulevard', file: 'samples/boulevard.jpg' },
  { name: 'Neon street', file: 'samples/friends-neon.jpg' },
  { name: 'Pier', file: 'samples/pier.jpg' },
];

let state = defaultState();
let photos = []; // [{name, img}]
let selectedSlot = 0;
let sizeId = 'square';
let undoStack = [];
let redoStack = [];

function snapshot() {
  return JSON.stringify(state);
}
function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
  syncUndoButtons();
}
function restore(json) {
  state = JSON.parse(json);
  syncControls();
  redraw();
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  syncUndoButtons();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  syncUndoButtons();
}
function syncUndoButtons() {
  $('undo').disabled = !undoStack.length;
  $('redo').disabled = !redoStack.length;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function redraw() {
  const size = EXPORT_SIZES.find((s) => s.id === sizeId) ?? EXPORT_SIZES[0];
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  drawCover(canvas, state, photos);
}

function setStatus(text) {
  statusEl.textContent = text;
}

/** Rebuilds the layout / grade / preset button rows from the engine tables. */
function buildButtons() {
  const layoutRow = $('layouts');
  layoutRow.innerHTML = '';
  for (const l of LAYOUTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = l.name;
    b.title = l.desc;
    b.dataset.layout = l.id;
    b.addEventListener('click', () => {
      if (state.layout === l.id) return;
      pushHistory();
      state.layout = l.id;
      state.slots = defaultSlots(l.id);
      selectedSlot = 0;
      syncControls();
      redraw();
    });
    layoutRow.appendChild(b);
  }

  const gradeRow = $('grades');
  gradeRow.innerHTML = '';
  for (const g of GRADES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = g.name;
    b.dataset.grade = g.id;
    b.addEventListener('click', () => {
      if (state.grade === g.id) return;
      pushHistory();
      state.grade = g.id;
      syncControls();
      redraw();
    });
    gradeRow.appendChild(b);
  }

  const presetRow = $('presets');
  presetRow.innerHTML = '';
  for (const p of PRESETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip preset';
    b.textContent = p.name;
    b.addEventListener('click', () => {
      pushHistory();
      state.layout = p.layout;
      state.grade = p.grade;
      state.title = p.title;
      state.subtitle = p.subtitle;
      state.heat = p.heat;
      state.slots = defaultSlots(p.layout);
      selectedSlot = 0;
      syncControls();
      redraw();
      setStatus(`Look “${p.name}” applied — tweak it, then export.`);
    });
    presetRow.appendChild(b);
  }

  const sizeRow = $('sizes');
  sizeRow.innerHTML = '';
  for (const s of EXPORT_SIZES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = s.label;
    b.dataset.size = s.id;
    b.addEventListener('click', () => {
      sizeId = s.id;
      syncControls();
      redraw();
    });
    sizeRow.appendChild(b);
  }
}

function syncControls() {
  document.querySelectorAll('#layouts .chip').forEach((b) => b.classList.toggle('on', b.dataset.layout === state.layout));
  document.querySelectorAll('#grades .chip').forEach((b) => b.classList.toggle('on', b.dataset.grade === state.grade));
  document.querySelectorAll('#sizes .chip').forEach((b) => b.classList.toggle('on', b.dataset.size === sizeId));
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  $('badge').value = state.badge;
  $('titleSize').value = String(state.titleSize);
  $('grain').checked = state.grain;
  $('vignette').checked = state.vignette;
  $('halftone').checked = state.halftone;
  document.querySelectorAll('#heat .star').forEach((b, i) => b.classList.toggle('on', i < state.heat));
  syncSlotPanel();
}

function syncSlotPanel() {
  const n = panelCount(state.layout);
  const slot = state.slots[selectedSlot] ?? state.slots[0];
  $('slotLabel').textContent = `Panel ${selectedSlot + 1} of ${n}`;
  $('slotPhoto').innerHTML = '';
  photos.forEach((p, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = p.name;
    if (slot && slot.photo === i) o.selected = true;
    $('slotPhoto').appendChild(o);
  });
  if (slot) {
    $('slotZoom').value = String(Math.round(slot.scale * 100));
    $('zoomVal').textContent = `${Math.round(slot.scale * 100)}%`;
  }
}

function bindControls() {
  $('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
  $('title').addEventListener('change', pushHistory);
  $('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
  $('subtitle').addEventListener('change', pushHistory);
  $('badge').addEventListener('input', (e) => { state.badge = e.target.value; redraw(); });
  $('badge').addEventListener('change', pushHistory);
  $('titleSize').addEventListener('input', (e) => { state.titleSize = Number(e.target.value); redraw(); });
  $('titleSize').addEventListener('change', pushHistory);
  $('grain').addEventListener('change', (e) => { pushHistory(); state.grain = e.target.checked; redraw(); });
  $('vignette').addEventListener('change', (e) => { pushHistory(); state.vignette = e.target.checked; redraw(); });
  $('halftone').addEventListener('change', (e) => { pushHistory(); state.halftone = e.target.checked; redraw(); });

  document.querySelectorAll('#heat .star').forEach((b, i) => {
    b.addEventListener('click', () => { pushHistory(); state.heat = i + 1; syncControls(); redraw(); });
  });

  $('photo').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;
    for (const file of files) {
      try {
        const img = await loadImage(URL.createObjectURL(file));
        photos.push({ name: file.name.replace(/\.[^.]+$/, ''), img });
      } catch { setStatus(`Could not read ${file.name}.`); }
    }
    // New uploads fill empty slots first, then extend the rotation.
    pushHistory();
    state.slots.forEach((slot, i) => { slot.photo = i % photos.length; });
    syncSlotPanel();
    redraw();
    setStatus(`${files.length} photo(s) added — click a panel, then drag it to frame the shot.`);
    e.target.value = '';
  });

  $('samples').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-sample]');
    if (!btn) return;
    const sample = SAMPLES[Number(btn.dataset.sample)];
    pushHistory();
    const slot = state.slots[selectedSlot];
    if (slot) slot.photo = photos.findIndex((p) => p.file === sample.file);
    syncSlotPanel();
    redraw();
  });

  $('shuffle').addEventListener('click', () => {
    pushHistory();
    state.slots.forEach((slot) => { slot.photo = Math.floor(Math.random() * photos.length); });
    syncSlotPanel();
    redraw();
  });

  $('slotPhoto').addEventListener('change', (e) => {
    pushHistory();
    const slot = state.slots[selectedSlot];
    if (slot) slot.photo = Number(e.target.value);
    redraw();
  });
  $('slotZoom').addEventListener('input', (e) => {
    const slot = state.slots[selectedSlot];
    if (!slot) return;
    slot.scale = Number(e.target.value) / 100;
    $('zoomVal').textContent = `${e.target.value}%`;
    redraw();
  });
  $('slotZoom').addEventListener('change', pushHistory);

  $('undo').addEventListener('click', undo);
  $('redo').addEventListener('click', redo);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    }
  });

  // Click a panel to select it; drag to pan the photo inside it.
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const slot = slotAt(state, canvas.width, canvas.height, x, y);
    if (slot < 0) return;
    selectedSlot = slot;
    syncSlotPanel();
    drag = { x, y, ox: state.slots[slot].ox, oy: state.slots[slot].oy, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const dx = (x - drag.x) / canvas.width;
    const dy = (y - drag.y) / canvas.height;
    if (Math.abs(dx) + Math.abs(dy) > 0.002) drag.moved = true;
    const slot = state.slots[selectedSlot];
    slot.ox = Math.max(-0.6, Math.min(0.6, drag.ox + dx));
    slot.oy = Math.max(-0.6, Math.min(0.6, drag.oy + dy));
    redraw();
  });
  canvas.addEventListener('pointerup', () => {
    if (drag?.moved) pushHistory();
    drag = null;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const slot = state.slots[selectedSlot];
    if (!slot) return;
    slot.scale = Math.max(0.6, Math.min(3, slot.scale * (e.deltaY < 0 ? 1.08 : 0.93)));
    syncSlotPanel();
    redraw();
  }, { passive: false });

  $('export').addEventListener('click', () => exportSize(sizeId));
  $('exportAll').addEventListener('click', async () => {
    for (const s of EXPORT_SIZES) {
      await exportSize(s.id, true);
      await new Promise((r) => setTimeout(r, 250));
    }
    setStatus(`Exported all 4 sizes as PNG.`);
  });
}

/** Renders the current cover at a size and downloads it as a PNG. */
function exportSize(id, quiet = false) {
  const size = EXPORT_SIZES.find((s) => s.id === id) ?? EXPORT_SIZES[0];
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off, state, photos);
  return new Promise((resolve) => {
    off.toBlob((blob) => {
      if (!blob) { setStatus('Export failed — try again.'); resolve(); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `cover-${size.w}x${size.h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      if (!quiet) setStatus(`Saved cover-${size.w}x${size.h}.png`);
      resolve();
    }, 'image/png');
  });
}

async function init() {
  buildButtons();
  bindControls();
  // Load the four bundled sample photos (AI-made, no real people, no logos).
  for (const s of SAMPLES) {
    try {
      const img = await loadImage(s.file);
      photos.push({ name: s.name, img, file: s.file });
    } catch { /* a missing sample just leaves that slot empty */ }
  }
  // Sample chips.
  const wrap = $('samples');
  wrap.innerHTML = '';
  SAMPLES.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.sample = String(i);
    b.textContent = `Use “${s.name}” in selected panel`;
    wrap.appendChild(b);
  });
  syncControls();
  syncUndoButtons();

  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) {
    await runShot(shot, new URLSearchParams(location.search), {
      photos, state,
      apply(next) { state = next; syncControls(); },
      redraw,
    });
  } else {
    // Wait for the poster fonts before the first paint so the title is real.
    try { await Promise.all([document.fonts.load('90px Anton'), document.fonts.load('40px Pacifico')]); } catch { /* fall back to system fonts */ }
    redraw();
  }
}

init();
