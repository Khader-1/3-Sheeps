// The narrated cut of the teaser.
//
// Same picture, same edit, same timing as src/targets/promo.js — this is one
// implementation with a flag, not a fork, so a change to the edit lands in
// both cuts automatically.
//
// What differs: the narrator speaks the atmosphere lines instead of them
// appearing as cards, and the ACE-Step music plays underneath, ducked under
// every voice. Audio comes from out/promo-narrated-audio.m4a
// (tools/mixaudio.mjs --narrated).
//
//   node tools/render.mjs promo-narrated --format=mp4

import promo from './promo.js';

export default () => promo({ narrated: true });
