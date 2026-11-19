// Golden Hour Cover Studio — wires the page.
//
// Owns the photo tray, the controls, panel picking/panning/zooming, undo and
// redo, and the PNG exports. The cover itself is drawn by cover.js; this file
// only decides *what* to draw and when.

import { drawCoverArt, renderCoverToCanvas } from './cover.js';
import { defaultState, cloneState, panelCountFor, CoverHistory } from './state.js';
import { LAYOUTS, GRADES, SIZES } from './state.js';
import { describeGrade } from './grades.js';
import { panelAtPoint, panPanel, zoomPanel, resetPanel } from './panels.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const statusEl = $('status');

const state = defaultState();
const history = new CoverHistory();
const photos = new Map(); // photo key -> loaded HTMLImageElement
const SAMPLES = ['woman-lake', 'woman-face', 'man-portrait', 'valley-river'];
let selected = 0;
let uploadCount = 0;

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

/** Load a bundled sample photo and cache it under `sample:<name>`. */
async function loadSample(name) {
  const key = `sample:${name}`;
  if (photos.has(key)) return photos.get(key);
  try {
    const img = await loadImage(`samples/${name}.jpg`);
    photos.set(key, img);
    return img;
  } catch {
    return null;
  }
}

function setStatus(text) {
  statusEl.textContent = text;
}

/** Preview canvas backing size follows the export size, capped at 900px. */
function sizePreviewCanvas() {
  const found = SIZES.find((s) => s.id === state.size) ?? SIZES[0];
  const scale = Math.min(1, 900 / Math.max(found.w, found.h));
  canvas.width = Math.round(found.w * scale);
  canvas.height = Math.round(found.h * scale);
}

function redraw() {
  drawCoverArt(canvas.getContext('2d'), state, photos, canvas.width, canvas.height);
  updateUndoButtons();
  $('selected-panel').textContent = `Panel ${selected + 1} of ${panelCountFor(state.layout)}`;
}

/** Push the pre-change state, apply the change, repaint. */
function commit(fn) {
  history.push(state);
  fn();
  redraw();
}

function updateUndoButtons() {
  $('undo').disabled = !history.canUndo;
  $('redo').disabled = !history.canRedo;
}

/** Render the current cover at export resolution on a fresh canvas. */
function renderExport(offscreen) {
  return renderCoverToCanvas(offscreen, state, photos);
}

function downloadCanvas(offscreen, name) {
  return new Promise((resolve) => {
    offscreen.toBlob((blob) => {
      if (!blob) {
        setStatus('Export failed: the browser gave no PNG.');
        resolve(false);
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve(true);
    }, 'image/png');
  });
}

async function exportOne() {
  const off = document.createElement('canvas');
  const { w, h } = renderExport(off);
  const ok = await downloadCanvas(off, `golden-hour-${w}x${h}.png`);
  if (ok) setStatus(`Saved golden-hour-${w}x${h}.png`);
}

async function exportAll() {
  const keep = state.size;
  for (const size of SIZES) {
    state.size = size.id;
    const off = document.createElement('canvas');
    const { w, h } = renderExport(off);
    await downloadCanvas(off, `golden-hour-${w}x${h}.png`);
    await new Promise((r) => setTimeout(r, 350));
  }
  state.size = keep;
  sizePreviewCanvas();
  redraw();
  setStatus('Saved all three sizes: 1080×1080, 1080×1350, 1920×1080.');
}

/** Build one row of toggle buttons from a list of {id, name}. */
function buildButtonRow(container, items, activeId, onPick) {
  container.innerHTML = '';
  for (const item of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (item.id === activeId ? ' active' : '');
    b.textContent = item.name;
    b.addEventListener('click', () => {
      onPick(item.id);
      [...container.children].forEach((c) => c.classList.remove('active'));
      b.classList.add('active');
    });
    container.appendChild(b);
  }
}

function buildControls() {
  buildButtonRow($('layouts'), LAYOUTS, state.layout, (id) => {
    commit(() => {
      state.layout = id;
      selected = 0;
    });
    setStatus(`Layout: ${LAYOUTS.find((l) => l.id === id).name}. Click a panel, then a photo.`);
  });
  buildButtonRow($('grades'), GRADES, state.grade, (id) => {
    commit(() => {
      state.grade = id;
    });
    setStatus(describeGrade(id));
  });
  buildButtonRow($('sizes'), SIZES, state.size, (id) => {
    commit(() => {
      state.size = id;
    });
    sizePreviewCanvas();
    redraw();
  });
}

/** The photo tray: four bundled samples, then anything the visitor uploads. */
function buildTray() {
  const tray = $('photo-tray');
  tray.innerHTML = '';
  for (const name of SAMPLES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.title = `Use sample photo ${name}`;
    const img = document.createElement('img');
    img.src = `samples/${name}.jpg`;
    img.alt = `Sample photo ${name}`;
    b.appendChild(img);
    b.addEventListener('click', async () => {
      const loaded = await loadSample(name);
      if (!loaded) {
        setStatus('That sample photo did not load.');
        return;
      }
      commit(() => {
        state.panels[selected].photo = `sample:${name}`;
      });
      setStatus(`Photo placed in panel ${selected + 1}. Drag it to reposition.`);
    });
    tray.appendChild(b);
  }
}

function addUploadThumb(file, img) {
  const key = `upload:${Date.now()}-${uploadCount++}`;
  photos.set(key, img);
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'thumb';
  b.title = `Use uploaded photo ${file.name}`;
  const thumb = document.createElement('img');
  thumb.src = URL.createObjectURL(file);
  thumb.alt = `Uploaded photo ${file.name}`;
  b.appendChild(thumb);
  b.addEventListener('click', () => {
    commit(() => {
      state.panels[selected].photo = key;
    });
    setStatus(`Photo placed in panel ${selected + 1}. Drag it to reposition.`);
  });
  $('photo-tray').appendChild(b);
  return key;
}

function wireInputs() {
  const titleInput = $('title-input');
  const subtitleInput = $('subtitle-input');
  const badgeInput = $('badge-input');
  titleInput.value = state.title;
  subtitleInput.value = state.subtitle;
  badgeInput.value = state.badge;

  const remember = () => history.push(state);
  titleInput.addEventListener('focus', remember);
  subtitleInput.addEventListener('focus', remember);
  badgeInput.addEventListener('focus', remember);
  titleInput.addEventListener('input', () => {
    state.title = titleInput.value;
    redraw();
  });
  subtitleInput.addEventListener('input', () => {
    state.subtitle = subtitleInput.value;
    redraw();
  });
  badgeInput.addEventListener('input', () => {
    state.badge = badgeInput.value;
    redraw();
  });

  $('title-pos').addEventListener('click', () => {
    commit(() => {
      state.titlePos = state.titlePos === 'bottom' ? 'top' : 'bottom';
    });
    $('title-pos').textContent = `Title: ${state.titlePos}`;
  });

  const toggles = [
    ['toggle-frame', 'frame'],
    ['toggle-grain', 'grain'],
    ['toggle-vignette', 'vignette'],
    ['toggle-halftone', 'halftone'],
  ];
  for (const [id, key] of toggles) {
    $(id).addEventListener('change', (e) => {
      commit(() => {
        state[key] = e.target.checked;
      });
    });
  }

  $('upload').addEventListener('change', async (e) => {
    const files = [...e.target.files].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    let firstKey = null;
    for (const file of files) {
      try {
        const img = await loadImage(URL.createObjectURL(file));
        const key = addUploadThumb(file, img);
        firstKey ??= key;
      } catch {
        setStatus(`Could not read ${file.name}.`);
      }
    }
    if (firstKey) {
      commit(() => {
        state.panels[selected].photo = firstKey;
      });
      setStatus(`${files.length} photo${files.length > 1 ? 's' : ''} added — first one is in panel ${selected + 1}.`);
    }
    e.target.value = '';
  });

  $('zoom-in').addEventListener('click', () => {
    commit(() => zoomPanel(state.panels[selected], 1.25));
  });
  $('zoom-out').addEventListener('click', () => {
    commit(() => zoomPanel(state.panels[selected], 0.8));
  });
  $('reset-crop').addEventListener('click', () => {
    commit(() => resetPanel(state.panels[selected]));
  });
  $('fill-all').addEventListener('click', () => {
    const key = state.panels[selected].photo;
    if (!key) {
      setStatus('Pick a photo for this panel first, then Fill all panels.');
      return;
    }
    commit(() => {
      for (const p of state.panels) p.photo = key;
    });
    setStatus('One photo now fills every panel.');
  });

  $('undo').addEventListener('click', () => {
    const prev = history.undo(state);
    if (!prev) return;
    Object.assign(state, prev);
    sizePreviewCanvas();
    redraw();
  });
  $('redo').addEventListener('click', () => {
    const next = history.redo(state);
    if (!next) return;
    Object.assign(state, next);
    sizePreviewCanvas();
    redraw();
  });

  $('export-one').addEventListener('click', exportOne);
  $('export-all').addEventListener('click', exportAll);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      $('undo').click();
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault();
      $('redo').click();
    }
  });
}

/** Pointer: click selects a panel, drag pans its photo, wheel zooms it. */
function wireCanvas() {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let dragStart = null;

  const toCanvas = (e) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * canvas.width,
      y: ((e.clientY - r.top) / r.height) * canvas.height,
    };
  };

  canvas.addEventListener('pointerdown', (e) => {
    const p = toCanvas(e);
    const hit = panelAtPoint(state.layout, canvas.width, canvas.height, p.x, p.y);
    if (hit < 0 || hit >= panelCountFor(state.layout)) return;
    selected = hit;
    dragging = true;
    // Snapshot *before* the drag: undo must restore the pre-drag crop, not
    // the dragged one (first pass pushed the post-drag state by mistake).
    dragStart = cloneState(state);
    lastX = p.x;
    lastY = p.y;
    canvas.setPointerCapture(e.pointerId);
    redraw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const p = toCanvas(e);
    const panel = state.panels[selected];
    panPanel(panel, (p.x - lastX) / canvas.width, (p.y - lastY) / canvas.height);
    lastX = p.x;
    lastY = p.y;
    redraw();
  });
  canvas.addEventListener('pointerup', () => {
    if (dragging && dragStart) history.push(dragStart);
    dragStart = null;
    dragging = false;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const panel = state.panels[selected];
    commit(() => zoomPanel(panel, e.deltaY < 0 ? 1.12 : 0.9));
  }, { passive: false });
}

async function boot() {
  buildControls();
  buildTray();
  wireInputs();
  wireCanvas();
  sizePreviewCanvas();

  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  if (shot) {
    if (shot === 'cover') {
      document.body.classList.add('shot-cover');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    await runShot(shot, params, {
      state,
      photos,
      loadSample,
      redraw,
      renderExport,
    });
    return;
  }

  // First visit: preload the samples and fill the cover with them.
  const first = await loadSample('woman-lake');
  if (first) {
    state.panels[0].photo = 'sample:woman-lake';
    state.panels[1].photo = 'sample:man-portrait';
    state.panels[2].photo = 'sample:woman-face';
    state.panels[3].photo = 'sample:valley-river';
    await Promise.all(SAMPLES.map((s) => loadSample(s)));
  }
  redraw();
  setStatus('Pick a layout, tap a panel, then a photo — export when it looks right.');
}

boot();
