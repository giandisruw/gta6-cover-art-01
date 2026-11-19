// Fixed scenes for the screenshots: ?shot=cover shows the cover alone
// at full size, ?shot=editor the editor with a photo loaded, ?shot=mosaic
// the nine-mosaic cover, ?shot=tilted the tilted-snapshot cover.
// window.__shotReady is set once the scene has painted and the fonts
// have arrived, so a screenshot tool knows when to capture.
export async function runShot(shot, query, app) {
  const scenes = {
    cover: { layout: 'hero3', grade: 'sunset', title: 'SUNSET HEIST', subtitle: 'Neon Shore', badge: 'VICE CITY', stars: 5 },
    editor: { layout: 'hero3', grade: 'sunset', title: 'SUNSET HEIST', subtitle: 'Neon Shore', badge: 'VICE CITY', stars: 5 },
    mosaic: { layout: 'mosaic', grade: 'candy', title: 'BOULEVARD QUEEN', subtitle: 'Palm Candy', badge: 'VICE CITY', stars: 5 },
    tilted: { layout: 'tilted', grade: 'golden', title: 'PIER PRESSURE', subtitle: 'Golden Hour', badge: 'VICE CITY', stars: 4 },
  };
  const scene = scenes[shot];
  if (!scene) return;
  if (shot === 'cover' || shot === 'mosaic' || shot === 'tilted') app.setBodyClass('shot-cover');
  app.setState(scene);
  await app.ready();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
