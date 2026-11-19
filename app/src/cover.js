// Vice City Cover Studio — cover render engine (all original code).
// Draws a multi-panel GTA-poster-style cover from photos + caption onto any
// 2D canvas, at any export size. No network, no external assets: fonts are
// vendored woff2, photos are local files or user uploads held in memory.

export const EXPORT_SIZES = [
  { id: 'square', label: 'Square 1080 × 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: 'Portrait 1080 × 1350', w: 1080, h: 1350 },
  { id: 'wide', label: 'Wide 1920 × 1080', w: 1920, h: 1080 },
  { id: 'story', label: 'Story 1080 × 1920', w: 1080, h: 1920 },
];

export const GRADES = [
  {
    id: 'sunset', name: 'Vice Sunset',
    filter: 'saturate(1.35) contrast(1.12) brightness(1.03)',
    tint: [[0, 'rgba(255,94,58,0.20)'], [1, 'rgba(168,28,120,0.34)']],
    mode: 'overlay', title: ['#fff7d6', '#ffb347', '#ff5e8a'],
  },
  {
    id: 'neon', name: 'Neon Nights',
    filter: 'saturate(1.6) contrast(1.18) brightness(0.97)',
    tint: [[0, 'rgba(0,229,255,0.16)'], [0.55, 'rgba(255,0,128,0.10)'], [1, 'rgba(90,0,160,0.34)']],
    mode: 'overlay', title: ['#ffffff', '#7df9ff', '#ff4fd8'],
  },
  {
    id: 'teal', name: 'Teal Heat',
    filter: 'saturate(1.25) contrast(1.15)',
    tint: [[0, 'rgba(0,180,160,0.22)'], [1, 'rgba(255,120,40,0.26)']],
    mode: 'soft-light', title: ['#ffffff', '#ffe259', '#ffa751'],
  },
  {
    id: 'golden', name: 'Golden Hour',
    filter: 'saturate(1.45) contrast(1.08) brightness(1.06) sepia(0.22)',
    tint: [[0, 'rgba(255,200,80,0.20)'], [1, 'rgba(220,90,20,0.26)']],
    mode: 'overlay', title: ['#fffbe6', '#ffd76a', '#ff8c42'],
  },
  {
    id: 'noir', name: 'Palm Noir',
    filter: 'saturate(0.75) contrast(1.3) brightness(0.94)',
    tint: [[0, 'rgba(20,20,40,0.10)'], [1, 'rgba(0,0,0,0.42)']],
    mode: 'multiply', title: ['#ffffff', '#e8e8e8', '#9be7ff'],
  },
  {
    id: 'candy', name: 'Palm Candy',
    filter: 'saturate(1.7) contrast(1.1) brightness(1.04)',
    tint: [[0, 'rgba(255,110,199,0.20)'], [1, 'rgba(0,200,255,0.20)']],
    mode: 'overlay', title: ['#ffffff', '#ff9de2', '#6ee7ff'],
  },
];

export const LAYOUTS = [
  { id: 'hero3', name: 'Hero + 3', desc: 'One hero panel, three stacked' },
  { id: 'grid4', name: 'Four Panel', desc: 'Classic 2 × 2 poster grid' },
  { id: 'mosaic9', name: 'Nine Mosaic', desc: '3 × 3 grid, title in the middle' },
  { id: 'fullbleed', name: 'Full Bleed', desc: 'One photo, title band on top' },
  { id: 'tilted', name: 'Tilted Snaps', desc: 'Three tilted snapshots, collage' },
];

export const PRESETS = [
  { id: 'heist', name: 'Sunset Heist', layout: 'hero3', grade: 'sunset', title: 'Sunset Heist', subtitle: 'one last job', heat: 4 },
  { id: 'neon', name: 'Neon Shore', layout: 'mosaic9', grade: 'neon', title: 'Neon Shore', subtitle: 'the city never sleeps', heat: 5 },
  { id: 'pier', name: 'Pier Pressure', layout: 'tilted', grade: 'golden', title: 'Pier Pressure', subtitle: 'catch of the day', heat: 3 },
  { id: 'queen', name: 'Boulevard Queen', layout: 'grid4', grade: 'candy', title: 'Boulevard Queen', subtitle: 'queen of the strip', heat: 5 },
  { id: 'noir', name: 'Night Shift', layout: 'fullbleed', grade: 'noir', title: 'Night Shift', subtitle: 'everyone has a price', heat: 4 },
];

/** A fresh default state. `slots` hold per-panel photo transforms. */
export function defaultState() {
  return {
    layout: 'hero3',
    grade: 'sunset',
    title: 'Sunset Heist',
    subtitle: 'one last job',
    badge: 'NEON COAST',
    heat: 4,
    titleSize: 1, // multiplier on the fitted size
    grain: true,
    vignette: true,
    halftone: true,
    // photos: array of {name, img} kept outside the serialised state.
    // slots: [{photo: index into photos, scale, ox, oy}] — one per panel.
    slots: defaultSlots('hero3'),
  };
}

export function panelCount(layout) {
  return { hero3: 4, grid4: 4, mosaic9: 8, fullbleed: 1, tilted: 3 }[layout] ?? 4;
}

export function defaultSlots(layout) {
  const n = panelCount(layout);
  return Array.from({ length: n }, (_, i) => ({ photo: i, scale: 1, ox: 0, oy: 0 }));
}

/** Panel rectangles as fractions [x, y, w, h] of the inner area. */
export function layoutPanels(layout) {
  switch (layout) {
    case 'hero3':
      return [[0, 0, 0.615, 1], [0.615, 0, 0.385, 1 / 3], [0.615, 1 / 3, 0.385, 1 / 3], [0.615, 2 / 3, 0.385, 1 / 3]];
    case 'grid4':
      return [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]];
    case 'mosaic9': {
      // 3x3; centre cell is the title block, the other 8 are photos.
      const cells = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push([c / 3, r / 3, 1 / 3, 1 / 3]);
      return cells.filter((_, i) => i !== 4);
    }
    case 'fullbleed':
      return [[0, 0, 1, 1]];
    case 'tilted':
      return [[0.06, 0.10, 0.52, 0.52], [0.44, 0.06, 0.50, 0.46], [0.16, 0.52, 0.62, 0.44]];
    default:
      return layoutPanels('hero3');
  }
}

function gradeById(id) {
  return GRADES.find((g) => g.id === id) ?? GRADES[0];
}

/** Draws one photo cover-fitting a rect, with a per-slot zoom/pan transform. */
function drawPhoto(ctx, img, rect, slot, grade) {
  const [x, y, w, h] = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (img) {
    const base = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const s = base * (slot?.scale ?? 1);
    const pw = img.naturalWidth * s;
    const ph = img.naturalHeight * s;
    const ox = (slot?.ox ?? 0) * w;
    const oy = (slot?.oy ?? 0) * h;
    ctx.filter = grade.filter;
    ctx.drawImage(img, x + (w - pw) / 2 + ox, y + (h - ph) / 2 + oy, pw, ph);
    ctx.filter = 'none';
  } else {
    ctx.fillStyle = '#241a33';
    ctx.fillRect(x, y, w, h);
  }
  // Grade tint: a vertical gradient washed over the photo.
  const tint = ctx.createLinearGradient(x, y, x, y + h);
  for (const [stop, color] of grade.tint) tint.addColorStop(stop, color);
  ctx.globalCompositeOperation = grade.mode;
  ctx.fillStyle = tint;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

let noiseCanvas = null;
function grainTile() {
  if (noiseCanvas) return noiseCanvas;
  noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = 140;
  noiseCanvas.height = 140;
  const nctx = noiseCanvas.getContext('2d');
  const data = nctx.createImageData(140, 140);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 118 + Math.floor(Math.random() * 40);
    data.data[i] = v; data.data[i + 1] = v; data.data[i + 2] = v; data.data[i + 3] = 255;
  }
  nctx.putImageData(data, 0, 0);
  return noiseCanvas;
}

function drawGrain(ctx, w, h) {
  const tile = grainTile();
  const pattern = ctx.createPattern(tile, 'repeat');
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(10,0,20,0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Halftone dots fading down inside a band rect. */
function drawHalftone(ctx, rect) {
  const [x, y, w, h] = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  const step = Math.max(9, w / 110);
  for (let yy = y + step / 2; yy < y + h; yy += step) {
    const fade = 1 - (yy - y) / h;
    for (let xx = x + step / 2; xx < x + w; xx += step) {
      const r = step * 0.16 + step * 0.22 * fade;
      ctx.beginPath();
      ctx.arc(xx, yy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function fitFont(ctx, text, maxWidth, startSize, family) {
  let size = startSize;
  ctx.font = `${size}px ${family}`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${size}px ${family}`;
  }
  return size;
}

/** The big poster title: gradient fill, thick dark outline, hard shadow. */
function drawTitleText(ctx, text, cx, baselineY, maxWidth, size, grade, align = 'center') {
  const upper = (text || '').toUpperCase();
  if (!upper.trim()) return 0;
  const fitted = fitFont(ctx, upper, maxWidth, size, 'Anton, "Arial Black", sans-serif');
  const grad = ctx.createLinearGradient(0, baselineY - fitted, 0, baselineY + fitted * 0.12);
  grade.title.forEach((c, i) => grad.addColorStop(i / (grade.title.length - 1), c));
  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.font = `${fitted}px Anton, "Arial Black", sans-serif`;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = fitted * 0.10;
  ctx.shadowOffsetY = fitted * 0.045;
  ctx.strokeStyle = '#14061f';
  ctx.lineWidth = Math.max(4, fitted * 0.13);
  ctx.strokeText(upper, cx, baselineY);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = grad;
  ctx.fillText(upper, cx, baselineY);
  ctx.restore();
  return fitted;
}

function drawSubtitle(ctx, text, cx, y, maxWidth, size) {
  if (!text || !text.trim()) return;
  const fitted = fitFont(ctx, text, maxWidth, size, 'Pacifico, cursive');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `${fitted}px Pacifico, cursive`;
  ctx.fillStyle = '#ffe9f6';
  ctx.shadowColor = 'rgba(255,0,140,0.8)';
  ctx.shadowBlur = fitted * 0.35;
  ctx.fillText(text, cx, y);
  ctx.restore();
}

function drawBadge(ctx, text, x, y, h) {
  if (!text || !text.trim()) return;
  const label = text.toUpperCase();
  ctx.save();
  ctx.font = `${h * 0.52}px Anton, "Arial Black", sans-serif`;
  const tw = ctx.measureText(label).width;
  const pad = h * 0.45;
  ctx.fillStyle = '#ff2e88';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, h * 0.06);
  roundRect(ctx, x, y, tw + pad * 2, h, h * 0.32);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + (tw + pad * 2) / 2, y + h / 2 + h * 0.03);
  ctx.restore();
}

function drawHeat(ctx, stars, x, y, size) {
  const w = size * 1.25 * 5;
  const h = size * 1.7;
  ctx.save();
  // Dark pill so the stars stay legible over any photo.
  ctx.fillStyle = 'rgba(12,2,24,0.55)';
  roundRect(ctx, x - size * 0.45, y - h / 2, w + size * 0.9, h, h / 2);
  ctx.fill();
  ctx.font = `${size}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd23f' : 'rgba(255,255,255,0.35)';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = Math.max(1, size * 0.06);
    const sx = x + i * size * 1.25;
    ctx.strokeText('★', sx, y);
    ctx.fillText('★', sx, y);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Draws the whole cover.
 * @param {HTMLCanvasElement} canvas
 * @param {object} state — serialisable state from defaultState()
 * @param {Array<{img: HTMLImageElement|null, name: string}>} photos
 */
export function drawCover(canvas, state, photos) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const grade = gradeById(state.grade);
  const frame = Math.round(Math.min(W, H) * 0.018);
  const gut = Math.round(Math.min(W, H) * 0.011);

  // White poster frame.
  ctx.fillStyle = '#fdfbf7';
  ctx.fillRect(0, 0, W, H);
  const ix = frame, iy = frame, iw = W - frame * 2, ih = H - frame * 2;

  if (state.layout === 'tilted') {
    // Sunset gradient backdrop, then three tilted snapshot prints.
    const bg = ctx.createLinearGradient(0, iy, 0, iy + ih);
    bg.addColorStop(0, '#2b0a4a');
    bg.addColorStop(0.45, '#c81d6e');
    bg.addColorStop(0.75, '#ff7a3d');
    bg.addColorStop(1, '#ffc46b');
    ctx.fillStyle = bg;
    ctx.fillRect(ix, iy, iw, ih);
    // Sun disc.
    ctx.save();
    ctx.fillStyle = 'rgba(255,236,170,0.9)';
    ctx.beginPath();
    ctx.arc(ix + iw * 0.5, iy + ih * 0.34, Math.min(iw, ih) * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const panels = layoutPanels('tilted');
    const tilts = [-0.055, 0.05, -0.02];
    panels.forEach(([fx, fy, fw, fh], i) => {
      const px = ix + fx * iw, py = iy + fy * ih, pw = fw * iw, ph = fh * ih;
      const slot = state.slots[i] ?? { photo: i, scale: 1, ox: 0, oy: 0 };
      const photo = photos[slot.photo % Math.max(1, photos.length)];
      ctx.save();
      ctx.translate(px + pw / 2, py + ph / 2);
      ctx.rotate(tilts[i]);
      ctx.translate(-pw / 2, -ph / 2);
      // Polaroid-style white border + shadow.
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = Math.min(W, H) * 0.02;
      ctx.shadowOffsetY = Math.min(W, H) * 0.008;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-gut, -gut, pw + gut * 2, ph + gut * 2);
      ctx.shadowColor = 'transparent';
      drawPhoto(ctx, photo?.img ?? null, [0, 0, pw, ph], slot, grade);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, pw, ph);
      ctx.restore();
    });
    // Title band across the bottom of the inner area.
    const bandH = ih * 0.20;
    const bandY = iy + ih - bandH;
    const bandGrad = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
    bandGrad.addColorStop(0, 'rgba(20,4,32,0)');
    bandGrad.addColorStop(1, 'rgba(20,4,32,0.88)');
    ctx.fillStyle = bandGrad;
    ctx.fillRect(ix, bandY, iw, bandH);
    if (state.halftone) drawHalftone(ctx, [ix, bandY, iw, bandH * 0.55]);
    drawTitleText(ctx, state.title, ix + iw / 2, bandY + bandH * 0.62, iw * 0.94, bandH * 0.58 * state.titleSize, grade);
    drawSubtitle(ctx, state.subtitle, ix + iw / 2, bandY + bandH * 0.88, iw * 0.8, bandH * 0.20);
    drawBadge(ctx, state.badge, ix + iw * 0.03, iy + ih * 0.03, Math.min(W, H) * 0.045);
    drawHeat(ctx, state.heat, ix + iw - Math.min(W, H) * 0.30, iy + ih * 0.055, Math.min(W, H) * 0.032);
  } else if (state.layout === 'mosaic9') {
    // 3x3 grid; centre cell is the title block.
    const photoPanels = layoutPanels('mosaic9');
    photoPanels.forEach(([fx, fy, fw, fh], i) => {
      const slot = state.slots[i] ?? { photo: i, scale: 1, ox: 0, oy: 0 };
      const photo = photos[slot.photo % Math.max(1, photos.length)];
      drawPhoto(ctx, photo?.img ?? null,
        [ix + fx * iw + (fx > 0 ? gut / 2 : 0), iy + fy * ih + (fy > 0 ? gut / 2 : 0), fw * iw - gut, fh * ih - gut],
        slot, grade);
    });
    // Centre title cell.
    const cx = ix + iw / 3 + gut / 2, cy = iy + ih / 3 + gut / 2, cw = iw / 3 - gut, ch = ih / 3 - gut;
    const tg = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
    tg.addColorStop(0, '#1c0533');
    tg.addColorStop(1, '#a3135f');
    ctx.fillStyle = tg;
    ctx.fillRect(cx, cy, cw, ch);
    if (state.halftone) drawHalftone(ctx, [cx, cy, cw, ch]);
    drawTitleText(ctx, state.title, cx + cw / 2, cy + ch * 0.52, cw * 0.92, ch * 0.30 * state.titleSize, grade);
    drawSubtitle(ctx, state.subtitle, cx + cw / 2, cy + ch * 0.82, cw * 0.88, ch * 0.13);
    drawBadge(ctx, state.badge, ix + iw * 0.03, iy + ih * 0.03, Math.min(W, H) * 0.045);
    drawHeat(ctx, state.heat, ix + iw - Math.min(W, H) * 0.30, iy + ih * 0.055, Math.min(W, H) * 0.032);
  } else {
    // hero3 / grid4 / fullbleed: photo panels, then a title band at the foot.
    const bandH = state.layout === 'fullbleed' ? ih * 0.22 : ih * 0.185;
    const photoH = ih - bandH;
    const panels = layoutPanels(state.layout);
    panels.forEach(([fx, fy, fw, fh], i) => {
      const slot = state.slots[i] ?? { photo: i, scale: 1, ox: 0, oy: 0 };
      const photo = photos[slot.photo % Math.max(1, photos.length)];
      drawPhoto(ctx, photo?.img ?? null,
        [ix + fx * iw + (fx > 0 ? gut / 2 : 0), iy + fy * ih + (fy > 0 ? gut / 2 : 0), fw * iw - gut, fh * photoH - gut],
        slot, grade);
    });
    const bandY = iy + photoH;
    const bandGrad = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
    if (state.layout === 'fullbleed') {
      bandGrad.addColorStop(0, 'rgba(20,4,32,0)');
      bandGrad.addColorStop(0.45, 'rgba(20,4,32,0.82)');
      bandGrad.addColorStop(1, 'rgba(20,4,32,0.95)');
      ctx.fillStyle = bandGrad;
      ctx.fillRect(ix, bandY - bandH * 0.35, iw, bandH * 1.35);
    } else {
      bandGrad.addColorStop(0, '#2a0a4e');
      bandGrad.addColorStop(1, '#12041f');
      ctx.fillStyle = bandGrad;
      ctx.fillRect(ix, bandY, iw, bandH);
    }
    if (state.halftone) drawHalftone(ctx, [ix, bandY, iw, bandH * 0.6]);
    const titleY = state.layout === 'fullbleed' ? bandY + bandH * 0.60 : bandY + bandH * 0.58;
    drawTitleText(ctx, state.title, ix + iw / 2, titleY, iw * 0.94, bandH * 0.55 * state.titleSize, grade);
    drawSubtitle(ctx, state.subtitle, ix + iw / 2, bandY + bandH * 0.88, iw * 0.8, bandH * 0.20);
    drawBadge(ctx, state.badge, ix + iw * 0.03, iy + ih * 0.03, Math.min(W, H) * 0.045);
    drawHeat(ctx, state.heat, ix + iw - Math.min(W, H) * 0.30, iy + ih * 0.055, Math.min(W, H) * 0.032);
  }

  if (state.grain) drawGrain(ctx, W, H);
  if (state.vignette) drawVignette(ctx, W, H);
  // Thin inner rule to finish the poster frame.
  ctx.strokeStyle = 'rgba(20,4,32,0.35)';
  ctx.lineWidth = Math.max(1, Math.min(W, H) * 0.002);
  ctx.strokeRect(frame / 2, frame / 2, W - frame, H - frame);
}

/** Hit-test: which photo slot (if any) is under canvas point (x, y)? */
export function slotAt(state, canvasW, canvasH, x, y) {
  const frame = Math.min(canvasW, canvasH) * 0.018;
  const ix = frame, iy = frame, iw = canvasW - frame * 2, ih = canvasH - frame * 2;
  const bandH = state.layout === 'fullbleed' ? ih * 0.22 : ih * 0.185;
  const photoH = state.layout === 'tilted' || state.layout === 'mosaic9' ? ih : ih - bandH;
  const panels = layoutPanels(state.layout);
  for (let i = panels.length - 1; i >= 0; i--) {
    const [fx, fy, fw, fh] = panels[i];
    const px = ix + fx * iw, py = iy + fy * ih, pw = fw * iw, ph = fh * photoH;
    if (x >= px && x <= px + pw && y >= py && y <= py + ph) return i;
  }
  return -1;
}
