// Golden Hour Cover Studio — the cover renderer.
//
// Pure canvas drawing: given a state and a map of photo key -> loaded image,
// drawCoverArt paints the whole cover (panels, grade, lettering, effects) onto
// any 2D context at any size, so the live preview and the exported PNG are the
// same drawing, just at different resolutions.

import { panelCountFor, sizeFor } from './state.js';
import { gradeRecipe } from './grades.js';

/** Panel rectangles for a layout, in canvas pixels. Rotation is in degrees. */
export function layoutPanels(layout, W, H) {
  const g = Math.round(Math.min(W, H) * 0.014); // gutter between panels
  if (layout === 'poster-wall') {
    const cw = (W - g * 2) / 3;
    const ch = (H - g * 2) / 3;
    const out = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        out.push({ x: c * (cw + g), y: r * (ch + g), w: cw, h: ch, rot: 0 });
      }
    }
    return out;
  }
  if (layout === 'solo') {
    return [{ x: 0, y: 0, w: W, h: H, rot: 0 }];
  }
  if (layout === 'polaroids') {
    return [
      { x: W * 0.05, y: H * 0.06, w: W * 0.52, h: H * 0.40, rot: -4 },
      { x: W * 0.53, y: H * 0.04, w: W * 0.42, h: H * 0.36, rot: 3 },
      { x: W * 0.08, y: H * 0.53, w: W * 0.42, h: H * 0.38, rot: 2 },
      { x: W * 0.54, y: H * 0.50, w: W * 0.41, h: H * 0.40, rot: -3 },
    ];
  }
  // vice-grid: hero on the left, three stacked panels on the right.
  const heroW = W * 0.62;
  const rightX = heroW + g;
  const rightW = W - rightX;
  const cellH = (H - g * 2) / 3;
  return [
    { x: 0, y: 0, w: heroW, h: H, rot: 0 },
    { x: rightX, y: 0, w: rightW, h: cellH, rot: 0 },
    { x: rightX, y: cellH + g, w: rightW, h: cellH, rot: 0 },
    { x: rightX, y: (cellH + g) * 2, w: rightW, h: cellH, rot: 0 },
  ];
}

/** Draw one photo into a rect, cover-fit, with zoom and pan offsets. */
export function drawPhotoInRect(ctx, img, rect, zoom, ox, oy) {
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * Math.max(0.5, zoom);
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const dx = rect.x + (rect.w - pw) / 2 + ox * rect.w * 0.25;
  const dy = rect.y + (rect.h - ph) / 2 + oy * rect.h * 0.25;
  ctx.drawImage(img, dx, dy, pw, ph);
}

/** An empty panel: deep gradient, dashed frame, and a short invitation. */
function drawEmptyPanel(ctx, rect) {
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  grad.addColorStop(0, '#3b1d5e');
  grad.addColorStop(1, '#1c0b2e');
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = Math.max(1.5, rect.w * 0.004);
  ctx.setLineDash([rect.w * 0.03, rect.w * 0.02]);
  ctx.strokeRect(rect.x + rect.w * 0.04, rect.y + rect.h * 0.04, rect.w * 0.92, rect.h * 0.92);
  ctx.restore();
  const size = Math.min(rect.w, rect.h) * 0.09;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+ ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
}

/** The grade wash + top-to-bottom tint inside the current clip. */
function applyGradeWash(ctx, recipe, rect) {
  ctx.save();
  ctx.globalCompositeOperation = recipe.washMode;
  ctx.globalAlpha = recipe.washAlpha;
  ctx.fillStyle = recipe.wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  const tint = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  tint.addColorStop(0, recipe.topTint);
  tint.addColorStop(1, recipe.bottomTint);
  ctx.fillStyle = tint;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

let noisePattern = null;

/** Film grain: one small random-dot tile, reused for every cover. */
function drawGrain(ctx, W, H) {
  if (!noisePattern) {
    const tile = document.createElement('canvas');
    tile.width = 128;
    tile.height = 128;
    const tctx = tile.getContext('2d');
    const data = tctx.createImageData(128, 128);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = Math.floor(Math.random() * 255);
      data.data[i] = v;
      data.data[i + 1] = v;
      data.data[i + 2] = v;
      data.data[i + 3] = 28;
    }
    tctx.putImageData(data, 0, 0);
    noisePattern = ctx.createPattern(tile, 'repeat');
  }
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = noisePattern;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Darkened corners so the middle of the cover pops. */
function drawVignette(ctx, W, H) {
  const grad = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.42,
    W / 2, H / 2, Math.max(W, H) * 0.75,
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

/** Halftone dots along the top edge, a print-poster nod. */
function drawHalftone(ctx, W, H, accent) {
  ctx.save();
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.55;
  const step = Math.max(10, W * 0.022);
  for (let row = 0; row < 4; row++) {
    for (let x = step / 2; x < W; x += step) {
      const r = (1 - row / 4) * step * 0.22 + 1;
      ctx.beginPath();
      ctx.arc(x + (row % 2 ? step / 2 : 0), step * (row + 0.6), r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** The sunset sky behind the polaroid layout: gradient + low sun + palms hint. */
function drawPolaroidBackdrop(ctx, W, H, recipe) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#2a1052');
  sky.addColorStop(0.45, '#c2337f');
  sky.addColorStop(0.75, '#ff7a3c');
  sky.addColorStop(1, '#ffc46b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.fillStyle = 'rgba(255, 236, 190, 0.9)';
  ctx.beginPath();
  ctx.arc(W * 0.5, H * 0.52, Math.min(W, H) * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Fit the title to the width, then paint it with outline + shadow. */
function drawTitleBlock(ctx, state, recipe, W, H) {
  const title = state.title.trim().toUpperCase();
  const sub = state.subtitle.trim();
  // Keep the words clear of the poster frame: the frame stroke is painted
  // last and would otherwise cover the subtitle's descenders (found in the
  // first screenshot pass, where the script subtitle was clipped at the foot).
  const frameW = state.frame ? Math.max(6, W * 0.014) : 0;
  const bottom = H - frameW * 1.6;
  const bandH = H * (title && sub ? 0.21 : 0.15);
  const bandY = state.titlePos === 'top' ? frameW * 1.6 : bottom - bandH;
  ctx.fillStyle = recipe.band;
  ctx.fillRect(0, bandY, W, bandH);
  ctx.fillStyle = recipe.accent;
  ctx.fillRect(0, state.titlePos === 'top' ? bandY + bandH : bandY, W, Math.max(3, H * 0.006));

  if (title) {
    let size = H * 0.105;
    const setFont = () => {
      ctx.font = `${size}px Anton, 'Arial Black', sans-serif`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.02)}px`;
    };
    setFont();
    while (ctx.measureText(title).width > W * 0.92 && size > 14) {
      size -= 2;
      setFont();
    }
    const baseline = bandY + bandH * (sub ? 0.58 : 0.66);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = recipe.titleStroke;
    ctx.lineWidth = Math.max(2, size * 0.16);
    ctx.strokeText(title, W / 2, baseline);
    ctx.fillStyle = recipe.titleFill;
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = size * 0.12;
    ctx.shadowOffsetY = size * 0.03;
    ctx.fillText(title, W / 2, baseline);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  if (sub) {
    const size = H * 0.042;
    ctx.font = `${size}px Pacifico, cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = recipe.accent;
    const y = bandY + bandH * 0.86;
    ctx.fillText(sub, W / 2, y);
  }
}

/** The small corner badge, e.g. the fictional city and year. */
function drawBadge(ctx, state, recipe, W, H) {
  const text = state.badge.trim().toUpperCase();
  if (!text) return;
  const size = Math.max(12, H * 0.018);
  ctx.font = `bold ${size}px Anton, 'Arial Black', sans-serif`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.18)}px`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  const pad = Math.max(10, W * 0.02);
  const frameW = state.frame ? Math.max(6, W * 0.014) : 0;
  const y = state.titlePos === 'top' ? H * 0.22 : pad + frameW * 1.2;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  const tw = ctx.measureText(text).width;
  ctx.fillRect(W - pad - tw - pad * 0.7, y - pad * 0.35, tw + pad * 1.4, size * 1.9);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, W - pad, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

/**
 * Paint the full cover. `photos` maps a panel's photo key to a loaded image.
 * The same function draws the preview and every exported PNG.
 */
export function drawCoverArt(ctx, state, photos, W, H) {
  const recipe = gradeRecipe(state.grade);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1c0b2e';
  ctx.fillRect(0, 0, W, H);

  const panels = layoutPanels(state.layout, W, H).slice(0, panelCountFor(state.layout));
  if (state.layout === 'polaroids') drawPolaroidBackdrop(ctx, W, H, recipe);

  panels.forEach((rect, i) => {
    const panel = state.panels[i] ?? { photo: null, zoom: 1, ox: 0, oy: 0 };
    ctx.save();
    ctx.beginPath();
    if (rect.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate((rect.rot * Math.PI) / 180);
      ctx.rect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
    } else {
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.clip();
    const local = rect.rot
      ? { x: -rect.w / 2, y: -rect.h / 2, w: rect.w, h: rect.h }
      : rect;
    const img = panel.photo ? photos.get(panel.photo) : null;
    if (img) {
      drawPhotoInRect(ctx, img, local, panel.zoom, panel.ox, panel.oy);
    } else {
      drawEmptyPanel(ctx, local);
    }
    applyGradeWash(ctx, recipe, local);
    ctx.restore();

    // Polaroid white frame, or a thin white seam for grid panels.
    if (state.layout === 'polaroids') {
      ctx.save();
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate((rect.rot * Math.PI) / 180);
      ctx.strokeStyle = '#fdf6ec';
      ctx.lineWidth = Math.max(4, rect.w * 0.02);
      ctx.strokeRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
      ctx.restore();
    } else if (state.layout !== 'solo') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(1.5, W * 0.002);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
    }
  });

  if (state.halftone) drawHalftone(ctx, W, H, recipe.accent);
  drawTitleBlock(ctx, state, recipe, W, H);
  drawBadge(ctx, state, recipe, W, H);
  if (state.vignette) drawVignette(ctx, W, H);
  if (state.grain) drawGrain(ctx, W, H);

  if (state.frame) {
    const bw = Math.max(6, W * 0.014);
    ctx.strokeStyle = '#fdf6ec';
    ctx.lineWidth = bw;
    ctx.strokeRect(bw / 2, bw / 2, W - bw, H - bw);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = Math.max(1, W * 0.0015);
    ctx.strokeRect(bw * 1.6, bw * 1.6, W - bw * 3.2, H - bw * 3.2);
  }
}

/** Size a canvas to the state's export size and paint the cover on it. */
export function renderCoverToCanvas(canvas, state, photos) {
  const size = sizeFor(state.size);
  canvas.width = size.w;
  canvas.height = size.h;
  drawCoverArt(canvas.getContext('2d'), state, photos, size.w, size.h);
  return size;
}
