// Golden Hour Cover Studio — the cover engine.
// Draws GTA-style multi-panel cover art on a 2D canvas: four layouts, five colour
// grades, Anton titles with a Pacifico subtitle, per-panel crop, and poster effects.
// Everything is drawn from local photos and two vendored OFL fonts; no network.
// The grain is seeded, so the same state always renders the same pixels.

export const SAMPLES = ['beach', 'city', 'neon', 'palms'];

export const LAYOUTS = {
  vicegrid: { label: 'Vice Grid', panels: 4, blurb: 'Hero + 3 panels' },
  posterwall: { label: 'Poster Wall', panels: 9, blurb: 'Nine panels' },
  solo: { label: 'Solo Shot', panels: 1, blurb: 'One full-bleed photo' },
  polaroid: { label: 'Polaroid Stack', panels: 3, blurb: 'Tilted snapshots' },
};

export const GRADES = {
  sunset: { label: 'Vice Sunset', sky: ['#ffd9a0', '#ff7a3d', '#c22e6e'], wash: ['#ff8c42', '#e83e8c'], deep: '#7a1040', ink: '#ffffff', sub: '#ffe9a8', glow: '#ffb347' },
  neon: { label: 'Neon Night', sky: ['#2b3a8f', '#7b2fbe', '#ff2e88'], wash: ['#3b4fd8', '#ff2e88'], deep: '#12082e', ink: '#ffffff', sub: '#7df9ff', glow: '#ff5db1' },
  teal: { label: 'Teal Dawn', sky: ['#bfe8d8', '#2dd4bf', '#0f766e'], wash: ['#2dd4bf', '#f59e0b'], deep: '#083344', ink: '#ffffff', sub: '#fde68a', glow: '#fbbf24' },
  rose: { label: 'Rose Gold', sky: ['#ffe3c2', '#f7b267', '#b56576'], wash: ['#f7b267', '#e07856'], deep: '#5b2333', ink: '#ffffff', sub: '#fff1d6', glow: '#ffb703' },
  noir: { label: 'Mono Noir', sky: ['#e8e8e8', '#9a9a9a', '#2b2b2b'], wash: ['#8a8a8a', '#1a1a1a'], deep: '#000000', ink: '#ffffff', sub: '#e5e5e5', glow: '#ffffff' },
};

export const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

/** A small deterministic PRNG, so grain and halftone render identically every time. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fresh default state: nine panel slots (every layout uses a prefix of them). */
export function defaultState() {
  const photos = ['beach', 'city', 'neon', 'palms', 'beach', 'city', 'neon', 'palms', 'beach'];
  return {
    layout: 'vicegrid',
    grade: 'sunset',
    title: 'NEON COAST',
    subtitle: 'golden hour',
    size: '1080x1080',
    fx: { frame: true, grain: true, vignette: true, halftone: false },
    panels: photos.map((photo) => ({ photo, zoom: 1, ox: 0, oy: 0 })),
  };
}

export function panelCount(layout) {
  return LAYOUTS[layout]?.panels ?? 4;
}

/** Panel rectangles for a layout at W x H. The title band sits on top for grid layouts. */
export function layoutPanels(layout, w, h) {
  const g = Math.max(4, Math.round(w * 0.008)); // gutter
  if (layout === 'posterwall') {
    const band = Math.round(h * 0.17);
    const top = band + g;
    const cw = (w - g * 4) / 3;
    const ch = (h - top - g * 4) / 3;
    const out = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        out.push({ x: g + c * (cw + g), y: top + r * (ch + g), w: cw, h: ch, role: `panel ${r * 3 + c + 1}` });
      }
    }
    return out;
  }
  if (layout === 'solo') {
    return [{ x: 0, y: 0, w, h, role: 'full photo' }];
  }
  if (layout === 'polaroid') {
    const pw = w * 0.4;
    const ph = h * 0.44;
    return [
      { x: w * 0.07, y: h * 0.3, w: pw, h: ph, rot: -0.14, role: 'snapshot 1' },
      { x: w * 0.33, y: h * 0.26, w: pw, h: ph, rot: 0.06, role: 'snapshot 2' },
      { x: w * 0.55, y: h * 0.33, w: pw, h: ph, rot: -0.05, role: 'snapshot 3' },
    ];
  }
  // vicegrid: hero left, three stacked right, title band on top.
  const band = Math.round(h * 0.17);
  const top = band + g;
  const heroW = Math.round((w - g * 3) * 0.62);
  const colX = g + heroW + g;
  const colW = w - colX - g;
  const rowH = (h - top - g * 4) / 3;
  return [
    { x: g, y: top, w: heroW, h: h - top - g, role: 'hero' },
    { x: colX, y: top, w: colW, h: rowH, role: 'panel 2' },
    { x: colX, y: top + rowH + g, w: colW, h: rowH, role: 'panel 3' },
    { x: colX, y: top + (rowH + g) * 2, w: colW, h: rowH, role: 'panel 4' },
  ];
}

/** Which panel (index) holds point (x, y) in canvas pixels, or -1. */
export function panelAt(layout, w, h, x, y) {
  const panels = layoutPanels(layout, w, h);
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return i;
  }
  return -1;
}

function drawPhotoInto(ctx, img, rect, panel, gradeKey) {
  if (!img) return;
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * panel.zoom;
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const cx = rect.x + rect.w / 2 + panel.ox * rect.w;
  const cy = rect.y + rect.h / 2 + panel.oy * rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (gradeKey === 'noir') ctx.filter = 'grayscale(1) contrast(1.08) brightness(1.02)';
  ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
  ctx.filter = 'none';
  ctx.restore();
}

/** A warm-to-deep wash that gives every photo the same sunset/neon grade. */
function applyGradeWash(ctx, w, h, grade) {
  const wash = ctx.createLinearGradient(0, 0, w * 0.25, h);
  wash.addColorStop(0, hexA(grade.wash[0], 0.22));
  wash.addColorStop(1, hexA(grade.wash[1], 0.3));
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  const deep = ctx.createLinearGradient(0, h * 0.45, 0, h);
  deep.addColorStop(0, hexA(grade.deep, 0));
  deep.addColorStop(1, hexA(grade.deep, 0.42));
  ctx.fillStyle = deep;
  ctx.fillRect(0, 0, w, h);
}

function hexA(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Procedural sunset sky: gradient, glowing sun, soft horizon haze. */
function drawSky(ctx, w, h, grade) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  grade.sky.forEach((c, i) => sky.addColorStop(i / (grade.sky.length - 1), c));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // The sun is sized to the sky it sits in, so a short title band gets a small
  // sun that fits inside it instead of a disc spilling over the title.
  const sunR = Math.min(w * 0.11, h * 0.5);
  const sunX = w * 0.72;
  const sunY = h * 0.5;
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 3.2);
  glow.addColorStop(0, hexA(grade.glow, 0.85));
  glow.addColorStop(1, hexA(grade.glow, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fillStyle = '#fff7e0';
  ctx.fill();
  // Thin horizon haze bands.
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(0, h * 0.52, w, h * 0.012);
  ctx.fillRect(0, h * 0.58, w, h * 0.008);
}

/** Palm-frond clusters hanging in from the top corners, framing the sky. */
function drawPalms(ctx, w, h) {
  ctx.save();
  ctx.strokeStyle = 'rgba(20,8,24,0.85)';
  ctx.lineCap = 'round';
  const cluster = (cx, cy, s, flip) => {
    for (let i = 0; i < 6; i++) {
      // Left corner fans down-right, right corner fans down-left.
      const a = flip > 0 ? 0.35 + i * 0.26 : Math.PI - (0.35 + i * 0.26);
      const len = w * 0.11 * s;
      ctx.lineWidth = Math.max(2, w * 0.006 * s);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(
        cx + Math.cos(a) * len * 0.55, cy + Math.sin(a) * len * 0.45 + h * 0.015 * s,
        cx + Math.cos(a) * len, cy + Math.sin(a) * len + h * 0.05 * s,
      );
      ctx.stroke();
    }
  };
  cluster(w * 0.015, h * 0.01, 1.1, 1);
  cluster(w * 0.985, h * 0.01, 1.0, -1);
  ctx.restore();
}

function fitFont(ctx, text, maxWidth, startPx, family, weight = '') {
  let size = startPx;
  ctx.font = `${weight} ${size}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

/** The title band: gradient sky strip with Anton title + Pacifico subtitle. */
function drawTitleBand(ctx, w, h, state, grade) {
  const band = Math.round(h * 0.17);
  drawSky(ctx, w, band, grade);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, band - Math.round(h * 0.012), w, Math.round(h * 0.012));
  const title = (state.title || 'NEON COAST').trim().toUpperCase();
  const sub = (state.subtitle || '').trim();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const titleSize = fitFont(ctx, title, w * 0.92, band * 0.52, 'Anton, sans-serif');
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = titleSize * 0.12;
  ctx.shadowOffsetY = titleSize * 0.04;
  ctx.fillStyle = grade.ink;
  ctx.fillText(title, w / 2, band * 0.42);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  if (sub) {
    const subSize = fitFont(ctx, sub, w * 0.6, band * 0.26, 'Pacifico, cursive');
    ctx.fillStyle = grade.sub;
    ctx.fillText(sub, w / 2, band * 0.82);
  }
}

/** Big title over a full-bleed photo (Solo Shot): top title, bottom script subtitle. */
function drawSoloTitles(ctx, w, h, state, grade) {
  const title = (state.title || 'NEON COAST').trim().toUpperCase();
  const sub = (state.subtitle || '').trim();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = w * 0.012;
  ctx.shadowOffsetY = w * 0.004;
  const titleSize = fitFont(ctx, title, w * 0.9, h * 0.085, 'Anton, sans-serif');
  ctx.fillStyle = grade.ink;
  ctx.fillText(title, w / 2, h * 0.075);
  if (sub) {
    const subSize = fitFont(ctx, sub, w * 0.6, h * 0.045, 'Pacifico, cursive');
    ctx.fillStyle = grade.sub;
    ctx.fillText(sub, w / 2, h * 0.93);
  }
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/** Small gold corner badge: a star, the city name, a tilted ribbon. */
function drawBadge(ctx, w, h, grade) {
  const bw = w * 0.2;
  const bh = h * 0.038;
  const bx = w - bw - w * 0.02;
  const by = h * 0.018;
  ctx.save();
  ctx.translate(bx + bw / 2, by + bh / 2);
  ctx.rotate(-0.045);
  ctx.fillStyle = '#1c1026';
  ctx.strokeStyle = grade.glow;
  ctx.lineWidth = Math.max(2, w * 0.002);
  roundRect(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = grade.glow;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = fitFont(ctx, '★ NEON COAST', bw * 0.86, bh * 0.52, 'Anton, sans-serif');
  ctx.fillText('★ NEON COAST', 0, bh * 0.02);
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

function applyFrame(ctx, w, h) {
  const t = Math.max(6, Math.round(w * 0.012));
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = t;
  ctx.strokeRect(t / 2, t / 2, w - t, h - t);
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = Math.max(1, t * 0.12);
  ctx.strokeRect(t * 1.7, t * 1.7, w - t * 3.4, h - t * 3.4);
}

function applyVignette(ctx, w, h) {
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

function applyGrain(ctx, w, h) {
  const rand = mulberry32(20261120);
  const dots = Math.floor((w * h) / 850);
  ctx.save();
  for (let i = 0; i < dots; i++) {
    const a = 0.03 + rand() * 0.06;
    ctx.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    const s = 1 + Math.floor(rand() * 2);
    ctx.fillRect(rand() * w, rand() * h, s, s);
  }
  ctx.restore();
}

function applyHalftone(ctx, w, h) {
  const rand = mulberry32(777);
  const step = Math.max(9, Math.round(w / 110));
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  for (let y = step / 2; y < h; y += step) {
    for (let x = step / 2; x < w; x += step) {
      const r = (0.5 + (y / h) * 2.0) * (w / 1080) + rand() * 0.3;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function applyEffects(ctx, w, h, fx) {
  if (fx.vignette) applyVignette(ctx, w, h);
  if (fx.halftone) applyHalftone(ctx, w, h);
  if (fx.grain) applyGrain(ctx, w, h);
  if (fx.frame) applyFrame(ctx, w, h);
}

/**
 * Draws the whole cover onto `ctx` at W x H.
 * `images` maps a photo key ('beach' | 'city' | 'neon' | 'palms' | 'upload') to an image.
 */
export function drawCover(ctx, w, h, state, images) {
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const layout = state.layout;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = grade.deep;
  ctx.fillRect(0, 0, w, h);

  if (layout === 'polaroid') {
    drawSky(ctx, w, h, grade);
    drawPalms(ctx, w, h);
    const panels = layoutPanels(layout, w, h);
    panels.forEach((rect, i) => {
      const panel = state.panels[i];
      const img = images[panel.photo];
      ctx.save();
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.rot ?? 0);
      ctx.fillStyle = '#fdfaf2';
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = w * 0.02;
      ctx.shadowOffsetY = w * 0.008;
      const pad = w * 0.014;
      const capH = h * 0.055;
      ctx.fillRect(-rect.w / 2 - pad, -rect.h / 2 - pad, rect.w + pad * 2, rect.h + pad * 2 + capH);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.restore();
      // Photo inside the white snapshot border.
      ctx.save();
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.rot ?? 0);
      ctx.beginPath();
      ctx.rect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
      ctx.clip();
      const inner = { x: -rect.w / 2, y: -rect.h / 2, w: rect.w, h: rect.h };
      drawPhotoInto(ctx, img, inner, panel, state.grade);
      ctx.restore();
    });
    applyGradeWash(ctx, w, h, grade);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = w * 0.01;
    const title = (state.title || 'NEON COAST').trim().toUpperCase();
    const titleSize = fitFont(ctx, title, w * 0.9, h * 0.075, 'Anton, sans-serif');
    ctx.fillStyle = grade.ink;
    ctx.fillText(title, w / 2, h * 0.1);
    const sub = (state.subtitle || '').trim();
    if (sub) {
      const subSize = fitFont(ctx, sub, w * 0.6, h * 0.04, 'Pacifico, cursive');
      ctx.fillStyle = grade.sub;
      ctx.fillText(sub, w / 2, h * 0.93);
    }
    ctx.shadowBlur = 0;
  } else if (layout === 'solo') {
    const rect = layoutPanels(layout, w, h)[0];
    drawPhotoInto(ctx, images[state.panels[0].photo], rect, state.panels[0], state.grade);
    applyGradeWash(ctx, w, h, grade);
    drawSoloTitles(ctx, w, h, state, grade);
  } else {
    drawTitleBand(ctx, w, h, state, grade);
    const panels = layoutPanels(layout, w, h);
    panels.forEach((rect, i) => {
      drawPhotoInto(ctx, images[state.panels[i].photo], rect, state.panels[i], state.grade);
    });
    applyGradeWash(ctx, w, h, grade);
  }

  applyEffects(ctx, w, h, state.fx);
  // The badge goes on last, over the frame, so the frame never cuts across it.
  drawBadge(ctx, w, h, grade);
}

/** Renders a fresh canvas at W x H for the given state. */
export function renderCover(w, h, state, images) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawCover(canvas.getContext('2d'), w, h, state, images);
  return canvas;
}

export function coverFileName(sizeKey) {
  return `neon-coast-cover-${sizeKey}.png`;
}
