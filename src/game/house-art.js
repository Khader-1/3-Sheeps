// The house as real artwork, for «أعِد البناء».
//
// بيت.svg, cut into walls / roof / door by tools/house-split.mjs — the source
// has no groups at all, so they are recovered from geometry and written back
// with their measured boxes.
//
// This is deliberately NOT what «ابنِ بيتك» uses. That game is about choosing
// قش, حطب or حجارة, and recolouring one wooden house three ways read worse
// than the drawn blocks did: a tinted plank still looks like a plank, so the
// straw house and the stone house came out as the same house in different
// paint. house.js keeps the drawn materials for it, where the difference is
// the whole point. Here there is no choice to express — the pieces only have
// to look like the house they came from.
//
// MATERIALS is carried over so the two modules stay interchangeable, but only
// `tint` is read, and only the wood entry (no tint) is ever asked for.
import { svgEl, fetchText } from '../rig.js';

const SRC = '/assets/incoming/خلفيات/شخصيات svg/بيت-مجزأ.svg';

/**
 * The three materials, in the order the story introduces them.
 *
 * `strength` is what the wolf is tested against. Straw can never survive even
 * a perfect build; wood survives only if built with care; stone survives
 * regardless. That is the lesson expressed as numbers: the material matters,
 * and so does the effort.
 *
 * `tint` recolours the artwork. Hue first, then saturation, then lightness —
 * the source is a warm mid-brown, so straw is a push toward yellow with more
 * light, and stone is most of the colour taken out and cooled.
 */
export const MATERIALS = {
  straw: {
    id: 'straw', label: 'قش', strength: 1.0,
    // Easy to work, useless against a wolf: the widest target and the slowest
    // sweep. Straw is what you choose when you want to be finished.
    green: 0.22, yellow: 0.40, speed: 0.95,
    fill: '#e8bd52',
    tint: 'hue-rotate(24deg) saturate(1.3) brightness(1.42)',
  },
  wood: {
    id: 'wood', label: 'حطب', strength: 2.0,
    green: 0.13, yellow: 0.26, speed: 1.25,
    fill: '#b5763c',
    // The artwork is already a wooden house; this is what it was painted as.
    tint: null,
  },
  stone: {
    id: 'stone', label: 'حجارة وطين', strength: 3.2,
    // The strongest house and the hardest to build — a narrow target and a
    // fast sweep. That trade is the whole point: the material that survives
    // is the one that asks something of you.
    green: 0.075, yellow: 0.17, speed: 1.6,
    fill: '#8d9299',
    tint: 'saturate(0.22) hue-rotate(168deg) brightness(1.12)',
  },
};

export const PARTS = [
  { id: 'walls', label: 'الجدران' },
  { id: 'roof', label: 'السقف' },
  { id: 'door', label: 'الباب' },
];

const INK = '#2a1608';

/**
 * Where the house stands in the game's 1280×720 space.
 *
 * Filled in by loadHouse() from the artwork's own measurements rather than
 * written down here: the parts have to keep their real proportions, and a
 * hand-typed box would drift the moment the drawing changed.
 */
export const GEO = { walls: {}, roof: {}, door: {} };

/** Footprint: the house is 720×475, and this is where that box lands. */
const STAND = { cx: 640, bottom: 608, height: 430 };

let doc = null;                 // the parsed artwork
let toGame = null;              // art -> game transform
let uid = 0;

/** Load and measure the artwork. Idempotent; both building games await it. */
export async function loadHouse() {
  if (doc) return GEO;
  const text = await fetchText(SRC);
  doc = new DOMParser().parseFromString(text, 'image/svg+xml');

  const read = (el) => {
    const [x, y, w, h] = el.getAttribute('data-box').split(/\s+/).map(Number);
    return { x, y, w, h };
  };
  const groups = {};
  for (const g of doc.documentElement.querySelectorAll('g[data-part]')) {
    groups[g.getAttribute('data-part')] = g;
  }

  // The whole house, from the file's own viewBox.
  const [vx, vy, vw, vh] = doc.documentElement.getAttribute('viewBox').split(/\s+/).map(Number);
  const s = STAND.height / vh;
  const tx = STAND.cx - (vx + vw / 2) * s;
  const ty = STAND.bottom - (vy + vh) * s;
  toGame = { s, tx, ty };

  for (const [id, g] of Object.entries(groups)) {
    const b = read(g);
    GEO[id] = {
      x: b.x * s + tx, y: b.y * s + ty,
      w: b.w * s, h: b.h * s,
    };
  }
  return GEO;
}

/** A part's artwork, transformed into game space. */
function artFor(id) {
  if (!doc) throw new Error('loadHouse() must be awaited before buildPart()');
  const g = doc.documentElement.querySelector(`g[data-part="${id}"]`);
  const wrap = svgEl('g', {
    transform: `translate(${round(toGame.tx)} ${round(toGame.ty)}) scale(${round(toGame.s)})`,
  });
  const copy = document.importNode(g, true);
  // The group in the file carries data-part too. Left on, every selector for a
  // part matches twice — the built node and the artwork inside it.
  copy.removeAttribute('data-part');
  copy.removeAttribute('id');
  wrap.appendChild(copy);
  return wrap;
}

const round = (n) => Math.round(n * 1000) / 1000;

/**
 * Build (or rebuild) one part.
 *
 * The returned group carries no transform of its own — callers animate it,
 * and the art→game mapping lives on an inner group so a pop or a fall does
 * not wipe it out.
 *
 * @param {number} [quality] 0..1 from the care test. Below ~0.4 the part is
 *   drawn cracked — a rushed wall should look rushed, not just score lower.
 */
export function buildPart(id, mat, quality = 1) {
  const g = svgEl('g', { 'data-part': id });
  const art = artFor(id);
  if (mat.tint) art.setAttribute('style', `filter:${mat.tint}`);
  g.appendChild(art);

  if (quality < 0.4) g.appendChild(cracks(id));
  return g;
}

/** Splits over a rushed part, clipped to its own box so none wander off it. */
function cracks(id) {
  const b = GEO[id];
  const clipId = `crack-${id}-${++uid}`;
  const out = svgEl('g');
  const defs = svgEl('defs');
  const clip = svgEl('clipPath', { id: clipId });
  clip.appendChild(svgEl('rect', { x: b.x, y: b.y, width: b.w, height: b.h }));
  defs.appendChild(clip);
  out.appendChild(defs);

  const holder = svgEl('g', { 'clip-path': `url(#${clipId})` });
  for (let i = 0; i < 3; i++) {
    const f = ((Math.sin((i + 1) * 12.9898) * 43758.5453) % 1 + 1) % 1;
    const x0 = b.x + b.w * (0.2 + f * 0.6);
    const y0 = b.y + b.h * 0.1;
    let d = `M ${round(x0)} ${round(y0)}`;
    let x = x0;
    for (let k = 1; k <= 4; k++) {
      const g2 = ((Math.sin((i * 7 + k) * 78.233) * 12345.6789) % 1 + 1) % 1;
      x += (g2 - 0.5) * b.w * 0.16;
      d += ` L ${round(x)} ${round(y0 + (b.h * 0.85 * k) / 4)}`;
    }
    holder.appendChild(svgEl('path', {
      d, fill: 'none', stroke: INK, 'stroke-width': 4,
      'stroke-linecap': 'round', opacity: 0.75,
    }));
  }
  out.appendChild(holder);
  return out;
}

/**
 * A ghost shown before a part has been chosen.
 *
 * The part's own silhouette, not a box around it: a rectangle over a roof was
 * the bug that made the stone roof look like a square mesh on a triangle.
 * Flattening the artwork to one translucent colour gives the true outline for
 * free, whatever shape it is.
 */
export function ghostPart(id) {
  const g = svgEl('g', { 'data-ghost': id, opacity: 0.22 });
  const art = artFor(id);
  // Faded, not flattened. Painting every path one translucent white stacks 794
  // of them into a smear with all the interior detail still showing through;
  // washing out the real thing reads immediately as "this goes here".
  art.setAttribute('style', 'filter:grayscale(0.75) brightness(1.5)');
  g.appendChild(art);
  return g;
}
