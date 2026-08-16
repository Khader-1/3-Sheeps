// The narrated teaser, read without tanween.
//
// Identical picture and timing to src/targets/promo-narrated.js — the only
// difference is which narration set the mix uses. Full nunation is correct
// Classical Arabic and the clone reads it accurately, but it also makes the
// delivery formal; this version keeps every other harakah so the vowels stay
// unambiguous, and drops only ً ٌ ٍ.
//
//   node tools/mixaudio.mjs --narrated --plain
//   node tools/render.mjs promo-narrated-plain --format=mp4

import promo from './promo.js';

export default () => promo({ narrated: true, plain: true });
