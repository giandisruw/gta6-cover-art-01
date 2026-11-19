// Golden Hour Cover Studio — colour grades.
//
// Each grade is a recipe the renderer applies on top of the photos: a warm or
// cool wash drawn with a blend mode, a top-to-bottom tint, and the ink colours
// for the title block. No grade ever touches the photo files themselves.

export const GRADE_RECIPES = {
  sunset: {
    name: 'Vice Sunset',
    // Warm wash: pink-orange light, drawn with 'overlay' so shadows stay deep.
    wash: '#ff7a3c',
    washAlpha: 0.28,
    washMode: 'overlay',
    topTint: 'rgba(64, 16, 88, 0.10)',
    bottomTint: 'rgba(255, 94, 60, 0.34)',
    titleFill: '#ffffff',
    titleStroke: '#1c0b2e',
    accent: '#ffb347',
    band: 'rgba(20, 6, 36, 0.55)',
  },
  neon: {
    name: 'Neon Night',
    wash: '#22d3ee',
    washAlpha: 0.22,
    washMode: 'overlay',
    topTint: 'rgba(8, 8, 40, 0.28)',
    bottomTint: 'rgba(255, 45, 149, 0.38)',
    titleFill: '#ffffff',
    titleStroke: '#12041f',
    accent: '#ff2d95',
    band: 'rgba(10, 4, 32, 0.62)',
  },
  teal: {
    name: 'Teal Dawn',
    wash: '#2dd4bf',
    washAlpha: 0.24,
    washMode: 'soft-light',
    topTint: 'rgba(10, 60, 74, 0.22)',
    bottomTint: 'rgba(255, 176, 102, 0.30)',
    titleFill: '#fff7e6',
    titleStroke: '#062a33',
    accent: '#5eead4',
    band: 'rgba(4, 34, 42, 0.55)',
  },
  rose: {
    name: 'Rose Gold',
    wash: '#fda4af',
    washAlpha: 0.26,
    washMode: 'overlay',
    topTint: 'rgba(92, 24, 54, 0.12)',
    bottomTint: 'rgba(251, 146, 60, 0.30)',
    titleFill: '#fff1f2',
    titleStroke: '#3f0a24',
    accent: '#fbbf24',
    band: 'rgba(48, 10, 32, 0.55)',
  },
  noir: {
    name: 'Mono Noir',
    wash: '#a1a1aa',
    washAlpha: 0.30,
    washMode: 'saturation',
    topTint: 'rgba(0, 0, 0, 0.18)',
    bottomTint: 'rgba(0, 0, 0, 0.42)',
    titleFill: '#fafafa',
    titleStroke: '#000000',
    accent: '#d4d4d8',
    band: 'rgba(0, 0, 0, 0.6)',
  },
};

/** Look a grade up by id, falling back to the sunset grade. */
export function gradeRecipe(gradeId) {
  return GRADE_RECIPES[gradeId] ?? GRADE_RECIPES.sunset;
}

/** One line about a grade, for the editor's status line. */
export function describeGrade(gradeId) {
  const lines = {
    sunset: 'Vice Sunset — warm pink-orange light, like golden hour on the coast.',
    neon: 'Neon Night — pink and teal after dark, wet-pavement glow.',
    teal: 'Teal Dawn — cool teal shadows with a warm horizon.',
    rose: 'Rose Gold — soft pink-gold, bright and warm.',
    noir: 'Mono Noir — the same cover, drained to black and white.',
  };
  return lines[gradeId] ?? lines.sunset;
}
