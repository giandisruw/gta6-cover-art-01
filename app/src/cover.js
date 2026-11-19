// Vice City Cover Studio — cover render engine (v2).
// Draws a GTA-poster-style cover onto any 2D canvas: multi-panel photo
// layouts, colour grades, gradient Anton lettering, Pacifico script,
// badge ribbon, heat-meter stars, halftone title block, grain, vignette.
// Pure canvas, no network, no external assets.

export const LAYOUTS = [
  { id: 'hero3', name: 'Hero + 3' },
  { id: 'grid2', name: 'Four Panel' },
  { id: 'mosaic', name: 'Nine Mosaic' },
  { id: 'fullbleed', name: 'Full Bleed' },
  { id: 'tilted', name: 'Tilted Snaps' },
];

export const GRADES = [
  {
    id: 'sunset', name: 'Vice Sunset',
    filter: 'saturate(1.35) contrast(1.08) sepia(0.18) hue-rotate(-8deg)',
    washTop: 'rgba(255, 122, 60, 0.10)', washBottom: 'rgba(196, 28, 112, 0.30)',
    title: ['#ffe259', '#ff7e5f', '#d63384'], accent: '#ff5e7a',
  },
  {
    id: 'neon', name: 'Neon Nights',
    filter: 'saturate(1.6) contrast(1.15) hue-rotate(10deg)',
    washTop: 'rgba(0, 255, 220, 0.08)', washBottom: 'rgba(255, 0, 160, 0.32)',
    title: ['#7df9ff', '#ff5ef1', '#7b2ff7'], accent: '#ff5ef1',
  },
  {
    id: 'teal', name: 'Teal Heat',
    filter: 'saturate(1.25) contrast(1.05) hue-rotate(28deg) sepia(0.10)',
    washTop: 'rgba(0, 200, 180, 0.12)', washBottom: 'rgba(0, 60, 90, 0.32)',
    title: ['#c8ffe2', '#2fd4c4', '#0b6e7a'], accent: '#2fd4c4',
  },
  {
    id: 'golden', name: 'Golden Hour',
    filter: 'sepia(0.35) saturate(1.4) contrast(1.05) brightness(1.06)',
    washTop: 'rgba(255, 190, 80, 0.14)', washBottom: 'rgba(180, 90, 20, 0.24)',
    title: ['#fff3b0', '#ffb347', '#e26d1f'], accent: '#ffb347',
  },
  {
    id: 'noir', name: 'Palm Noir',
    filter: 'grayscale(0.85) contrast(1.28) brightness(0.92)',
    washTop: 'rgba(255, 255, 255, 0.05)', washBottom: 'rgba(0, 0, 0, 0.38)',
    title: ['#ffffff', '#d5d5d5', '#8f8f8f'], accent: '#e8e8e8',
  },
  {
    id: 'candy', name: 'Palm Candy',
    filter: 'saturate(1.7) contrast(1.10) brightness(1.08) hue-rotate(-15deg)',
    washTop: 'rgba(255, 150, 220, 0.12)', washBottom: 'rgba(120, 40, 220, 0.26)',
    title: ['#ff9ff3', '#f368e0', '#a55eea'], accent: '#f368e0',
  },
];

export const PRESETS = [
  { id: 'sunset-heist', name: 'Sunset Heist', layout: 'hero3', grade: 'sunset', title: 'SUNSET HEIST', subtitle: 'Neon Shore', badge: 'VICE CITY', stars: 5 },
  { id: 'neon-shore', name: 'Neon Shore', layout: 'grid2', grade: 'neon', title: 'NEON SHORE', subtitle: 'After Dark', badge: 'VICE CITY', stars: 5 },
  { id: 'pier-pressure', name: 'Pier Pressure', layout: 'tilted', grade: 'golden', title: 'PIER PRESSURE', subtitle: 'Golden Hour', badge: 'VICE CITY', stars: 4 },
  { id: 'boulevard-queen', name: 'Boulevard Queen', layout: 'mosaic', grade: 'candy', title: 'BOULEVARD QUEEN', subtitle: 'Palm Candy', badge: 'VICE CITY', stars: 5 },
  { id: 'night-shift', name: 'Night Shift', layout: 'fullbleed', grade: 'noir', title: 'NIGHT SHIFT', subtitle: 'Palm Noir', badge: 'VICE CITY', stars: 4 },
];

export const SIZES = [
  { id: '1080x1080', w: 1080, h: 1080, label: '1080 × 1080' },
  { id: '1080x1350', w: 1080, h: 1350, label: '1080 × 1350' },
  { id: '1920x1080', w: 1920, h: 1080, label: '1920 × 1080' },
  { id: '1080x1920', w: 1080, h: 1920, label: '1080 × 1920' },
];

/** How many photo panels each layout needs. */
export function panelCount(layout) {
  return { hero3: 4, grid2: 4, mosaic: 8, fullbleed: 1, tilted: 3 }[layout] ?? 4;
}

function gradeById(id) {
  return GRADES.find((g) => g.id === id) ?? GRADES[0];
}

/**
 * Panel rectangles for a layout, in fractions of the canvas (x, y, w, h,
 * optional rotation in degrees). The title zone is returned separately so
 * lettering can sit on top of the photos or in its own cell.
 */
export function layoutGeometry(layout, W, H) {
  const gap = 0.008; // white gutter, as a fraction of the short side
  const frame = 0.018; // white poster frame
  const titleH = 0.20; // title band height (fraction of H)
  const inner = { x: frame, y: frame, w: 1 - frame * 2, h: 1 - frame * 2 };
  const band = { x: inner.x, y: inner.y + inner.h - titleH, w: inner.w, h: titleH };

  if (layout === 'hero3') {
    const rightW = inner.w * 0.36;
    const hero = { x: inner.x, y: inner.y, w: inner.w - rightW - gap, h: inner.h - titleH - gap };
    const colX = inner.x + hero.w + gap;
    const cellH = (inner.h - titleH - gap * 3) / 3;
    const panels = [hero];
    for (let i = 0; i < 3; i++) {
      panels.push({ x: colX, y: inner.y + i * (cellH + gap), w: rightW, h: cellH });
    }
    return { panels, title: band, backdrop: 'none' };
  }
  if (layout === 'grid2') {
    const cw = (inner.w - gap) / 2;
    const ch = (inner.h - titleH - gap * 2) / 2;
    const panels = [];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        panels.push({ x: inner.x + c * (cw + gap), y: inner.y + r * (ch + gap), w: cw, h: ch });
      }
    }
    return { panels, title: band, backdrop: 'none' };
  }
  if (layout === 'mosaic') {
    const cw = (inner.w - gap * 2) / 3;
    const ch = (inner.h - gap * 2) / 3;
    const panels = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (r === 1 && c === 1) continue; // centre cell is the title block
        panels.push({ x: inner.x + c * (cw + gap), y: inner.y + r * (ch + gap), w: cw, h: ch });
      }
    }
    const centre = { x: inner.x + cw + gap, y: inner.y + ch + gap, w: cw, h: ch };
    return { panels, title: centre, backdrop: 'none', titleCell: true };
  }
  if (layout === 'fullbleed') {
    return { panels: [{ x: inner.x, y: inner.y, w: inner.w, h: inner.h - titleH }], title: band, backdrop: 'none' };
  }
  // tilted: three polaroids on a sunset backdrop, title across the top
  const top = { x: inner.x, y: inner.y + 0.02, w: inner.w, h: 0.16 };
  const pw = inner.w * 0.30;
  const ph = (inner.h - 0.24) * 0.92;
  const py = inner.y + 0.20;
  const panels = [
    { x: inner.x + 0.015, y: py, w: pw, h: ph, rot: -6 },
    { x: inner.x + inner.w / 2 - pw / 2, y: py - 0.015, w: pw, h: ph, rot: 2 },
    { x: inner.x + inner.w - pw - 0.015, y: py, w: pw, h: ph, rot: 6 },
  ];
  return { panels, title: top, backdrop: 'sunset', titleCell: false };
}

function drawStar(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (fill) ctx.fill();
  else ctx.stroke();
}

let grainTile = null;
function grainPattern(ctx) {
  if (grainTile) return grainTile;
  const t = document.createElement('canvas');
  t.width = 160;
  t.height = 160;
  const tc = t.getContext('2d');
  const img = tc.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 118 + Math.floor(Math.random() * 20);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  tc.putImageData(img, 0, 0);
  grainTile = ctx.createPattern(t, 'repeat');
  return grainTile;
}

/** Halftone dots across a rectangle — the poster's printed-title texture. */
function halftone(ctx, x, y, w, h, scale) {
  const step = 15 * scale;
  const r = 2.4 * scale;
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
  for (let yy = y + step / 2; yy < y + h; yy += step) {
    const off = (Math.round((yy - y) / step) % 2) * step / 2;
    for (let xx = x + step / 2 + off; xx < x + w; xx += step) {
      ctx.beginPath();
      ctx.arc(xx, yy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function fitFont(ctx, text, fontFamily, weight, startPx, maxWidth) {
  let size = startPx;
  ctx.font = `${weight} ${size}px ${fontFamily}`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${fontFamily}`;
  }
  return size;
}

/**
 * Draw the whole cover.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W canvas width, @param {number} H canvas height
 * @param {object} state { layout, grade, title, subtitle, badge, stars, slots }
 * @param {Map<number, HTMLImageElement>} images photo id -> loaded image
 * @param {Array<{id:number, name:string}>} photos photo list (slot.photo indexes into it)
 */
export function drawCover(ctx, W, H, state, images, photos) {
  const grade = gradeById(state.grade);
  const geo = layoutGeometry(state.layout, W, H);
  const scale = Math.min(W, H) / 1080;
  const px = (fx) => fx * W;
  const py = (fy) => fy * H;

  ctx.save();
  ctx.clearRect(0, 0, W, H);
  // White poster frame background.
  ctx.fillStyle = '#f7f3ea';
  ctx.fillRect(0, 0, W, H);

  // Sunset backdrop for the tilted layout.
  if (geo.backdrop === 'sunset') {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2b1055');
    bg.addColorStop(0.45, '#ff5e7a');
    bg.addColorStop(0.75, '#ff9a3d');
    bg.addColorStop(1, '#ffd76a');
    ctx.fillStyle = bg;
    ctx.fillRect(px(0.018), py(0.018), px(0.964), py(0.964));
    // Low sun disc.
    ctx.save();
    ctx.fillStyle = 'rgba(255, 240, 180, 0.85)';
    ctx.beginPath();
    ctx.arc(W / 2, H * 0.52, H * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Photo panels.
  geo.panels.forEach((p, i) => {
    const slot = state.slots[i] ?? { photo: i % Math.max(photos.length, 1), zoom: 1, ox: 0, oy: 0 };
    const photo = photos[slot.photo % Math.max(photos.length, 1)];
    const img = photo ? images.get(photo.id) : null;
    const rx = px(p.x), ry = py(p.y), rw = px(p.w), rh = py(p.h);
    ctx.save();
    if (p.rot) {
      ctx.translate(rx + rw / 2, ry + rh / 2);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.translate(-rw / 2, -rh / 2);
    } else {
      ctx.translate(rx, ry);
    }
    // Polaroid white border for tilted snaps.
    if (p.rot) {
      ctx.fillStyle = '#fdfbf6';
      ctx.fillRect(-8 * scale, -8 * scale, rw + 16 * scale, rh + 26 * scale);
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 18 * scale;
      ctx.shadowOffsetY = 8 * scale;
    }
    ctx.beginPath();
    ctx.rect(0, 0, rw, rh);
    ctx.clip();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    if (img) {
      const base = Math.max(rw / img.naturalWidth, rh / img.naturalHeight);
      const s = base * (slot.zoom || 1);
      const dw = img.naturalWidth * s;
      const dh = img.naturalHeight * s;
      const cx = rw / 2 + (slot.ox || 0) * rw;
      const cy = rh / 2 + (slot.oy || 0) * rh;
      ctx.filter = grade.filter;
      ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
      ctx.filter = 'none';
    } else {
      ctx.fillStyle = '#3a2b4d';
      ctx.fillRect(0, 0, rw, rh);
    }
    // Grade wash over the photo.
    const wash = ctx.createLinearGradient(0, 0, 0, rh);
    wash.addColorStop(0, grade.washTop);
    wash.addColorStop(1, grade.washBottom);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, rw, rh);
    ctx.restore();
  });

  // Title zone.
  const t = geo.title;
  const tx = px(t.x), ty = py(t.y), tw = px(t.w), th = py(t.h);
  const isCell = !!geo.titleCell;
  if (isCell) {
    ctx.fillStyle = '#160a24';
    ctx.fillRect(tx, ty, tw, th);
  } else {
    const shade = ctx.createLinearGradient(0, ty, 0, ty + th);
    shade.addColorStop(0, 'rgba(16, 6, 32, 0)');
    shade.addColorStop(0.35, 'rgba(16, 6, 32, 0.82)');
    shade.addColorStop(1, 'rgba(16, 6, 32, 0.94)');
    ctx.fillStyle = shade;
    ctx.fillRect(tx, ty, tw, th);
  }
  halftone(ctx, tx, ty, tw, th, scale);

  // Title: gradient Anton capitals with a thick dark outline.
  const title = (state.title || 'VICE CITY').toUpperCase();
  const titleSize = fitFont(ctx, title, 'Anton, sans-serif', 400, th * (isCell ? 0.26 : 0.52), tw * 0.94);
  const grad = ctx.createLinearGradient(0, ty + th * 0.18, 0, ty + th * 0.82);
  grade.title.forEach((c, i) => grad.addColorStop(i / (grade.title.length - 1), c));
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try { ctx.letterSpacing = `${Math.max(1, 3 * scale)}px`; } catch { /* older canvas */ }
  const titleY = ty + th * 0.42;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#160a24';
  ctx.lineWidth = Math.max(2, titleSize * 0.09);
  ctx.strokeText(title, tx + tw / 2, titleY);
  ctx.fillStyle = grad;
  ctx.fillText(title, tx + tw / 2, titleY);
  ctx.restore();

  // Script subtitle in Pacifico, glowing in the grade accent.
  const subtitle = (state.subtitle || '').trim();
  if (subtitle) {
    const subSize = fitFont(ctx, subtitle, 'Pacifico, cursive', 400, th * (isCell ? 0.13 : 0.24), tw * 0.8);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.shadowColor = grade.accent;
    ctx.shadowBlur = 14 * scale;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(subtitle, tx + tw / 2, isCell ? ty + th * 0.72 : ty + th * 0.80);
    ctx.restore();
  }

  // Badge ribbon, top-right corner of the frame.
  const badge = (state.badge || '').trim();
  if (badge) {
    ctx.save();
    const bw = Math.min(tw * 0.34, 150 * scale + badge.length * 11 * scale);
    const bh = 34 * scale;
    // Keep the whole ribbon — tails included — inside the white frame.
    ctx.translate(W - 0.018 * W - bw / 2 - 30 * scale, 0.018 * H + bh * 0.9);
    ctx.rotate(0.06);
    ctx.fillStyle = grade.accent;
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.fillStyle = '#160a24';
    ctx.beginPath();
    ctx.moveTo(-bw / 2, -bh / 2); ctx.lineTo(-bw / 2 - 10 * scale, 0); ctx.lineTo(-bw / 2, bh / 2);
    ctx.moveTo(bw / 2, -bh / 2); ctx.lineTo(bw / 2 + 10 * scale, 0); ctx.lineTo(bw / 2, bh / 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(15 * scale)}px Anton, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge.toUpperCase(), 0, 1);
    ctx.restore();
  }

  // Heat meter: five stars, bottom-right of the title zone.
  const stars = Math.max(0, Math.min(5, state.stars ?? 5));
  const sr = 13 * scale;
  const sx0 = tx + tw - (5 * sr * 2.4 + 10 * scale);
  const sy = ty + th - sr * 1.6;
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const cx = sx0 + i * sr * 2.4;
    ctx.fillStyle = i < stars ? '#ffd23f' : 'rgba(255,255,255,0.35)';
    ctx.strokeStyle = '#160a24';
    ctx.lineWidth = 1.5 * scale;
    drawStar(ctx, cx, sy, sr, i < stars);
    if (i >= stars) ctx.stroke();
  }
  ctx.restore();

  // Film grain + vignette over everything.
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Hit-test a canvas point (in canvas pixels) against the panels. Returns the panel index or -1. */
export function hitPanel(layout, W, H, x, y) {
  const geo = layoutGeometry(layout, W, H);
  for (let i = geo.panels.length - 1; i >= 0; i--) {
    const p = geo.panels[i];
    let px = x / W - p.x;
    let py = y / H - p.y;
    if (p.rot) {
      const a = (-p.rot * Math.PI) / 180;
      const cx = p.w / 2, cy = p.h / 2;
      const dx = px - cx, dy = py - cy;
      px = cx + dx * Math.cos(a) - dy * Math.sin(a);
      py = cy + dx * Math.sin(a) + dy * Math.cos(a);
    }
    if (px >= 0 && px <= p.w && py >= 0 && py <= p.h) return i;
  }
  return -1;
}
