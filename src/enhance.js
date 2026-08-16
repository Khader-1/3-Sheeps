// Character art fixes applied at load time.
//
// The source SVGs are the artists' files and stay untouched. Anything wrong
// with a shape is corrected here, in code, sized from the original part's own
// bounding box — so a fix lands at every scale, in every target (teaser, book,
// games) at once, and can be reverted by deleting a function.
//
// The wolf's hands and feet were drawn as four long human fingers separated
// back to the wrist, with no pad and no claws. At poster size they read as
// bony hands. These build a proper paw in their place: a pad, three toes, and
// claws.

import { svgEl } from './rig.js';

/** First real fill under `paths` — the art leads with fill="none" outlines. */
function sampleFill(rig, paths, fallback) {
  for (const p of paths) {
    const host = rig.part(p, { optional: true });
    if (!host) continue;
    for (const el of host.querySelectorAll('path, polygon, ellipse, circle, rect')) {
      const f = el.getAttribute('fill') || getComputedStyle(el).fill;
      if (!f) continue;
      const v = f.trim().toLowerCase();
      if (v === 'none' || v === 'transparent' || v.startsWith('rgba(0, 0, 0, 0')) continue;
      return f;
    }
  }
  return fallback;
}

/**
 * Deterministic pseudo-random in [-1, 1], seeded by a string.
 *
 * Stable across renders — the same paw jitters the same way every frame, which
 * a Math.random() would not, and a paw that reshuffles every frame boils.
 */
function jitter(seed, i) {
  let h = 2166136261;
  const str = `${seed}:${i}`;
  for (let k = 0; k < str.length; k++) {
    h ^= str.charCodeAt(k);
    h = Math.imul(h, 16777619);
  }
  return (((h >>> 0) % 10000) / 5000) - 1;
}

/**
 * Build a paw into the space of an existing part's bounding box.
 *
 * @param {DOMRect} b   the replaced part's local bbox
 * @param {object} o
 * @param {'down'|'forward'} o.dir  hands hang, feet point along the ground
 * @param {boolean} [o.flipToes]    toes to -x instead of +x, for a foot facing back
 */
function buildPaw(b, { dir, fur, ink = '#000', flipToes = false, seed = '' }) {
  const g = svgEl('g', { 'data-part': 'كف_محسّن' });
  const sw = Math.max(1.1, Math.min(b.width, b.height) * 0.075);
  const N = 3;

  // One silhouette, not a pile of ovals. The surrounding artwork is drawn as
  // single outlined masses with thin interior lines, and giving every toe its
  // own outline reads as three separate objects stuck to a mitten.
  const claws = [];
  const splits = [];
  let d;

  if (dir === 'down') {
    const x0 = b.x;
    const x1 = b.x + b.width;
    const y0 = b.y;
    const padY = b.y + b.height * 0.58;          // where the toes begin
    const tip = b.y + b.height;
    // Uneven toes. Equal thirds and identical bulges read as a machine part;
    // a drawn paw has a longer middle toe and slightly different widths. The
    // variation is seeded per part, so the two hands differ from each other
    // but neither changes between frames.
    const wob = (i) => 1 + jitter(seed, i) * 0.16;
    const shares = [0, 1, 2].map((i) => wob(i) * (i === 1 ? 1.1 : 1));
    const total = shares.reduce((a, v) => a + v, 0);

    const rL = b.width * (0.3 + jitter(seed, 91) * 0.05);
    const rR = b.width * (0.3 + jitter(seed, 92) * 0.05);
    d = `M ${x0} ${y0 + rL} Q ${x0} ${y0} ${x0 + rL} ${y0}` +
        ` L ${x1 - rR} ${y0} Q ${x1} ${y0} ${x1} ${y0 + rR}` +
        ` L ${x1} ${padY + b.height * jitter(seed, 93) * 0.03}`;

    // Cumulative edges, so uneven widths still span the full paw.
    const edges = [x0];
    let acc = 0;
    for (let i = 0; i < N; i++) {
      acc += shares[i];
      edges.push(x0 + (b.width * acc) / total);
    }

    for (let i = N - 1; i >= 0; i--) {
      const xr = edges[i + 1];
      const xl = edges[i];
      const cx = (xl + xr) / 2;
      // A quadratic curve reaches only halfway to its control point, so the
      // silhouette's true low point is the midpoint of the endpoints and the
      // control — anchoring claws at the control leaves them floating free.
      const depth = 0.06 + jitter(seed, 10 + i) * 0.035 + (i === 1 ? 0.03 : 0);
      const ctrl = tip + b.height * depth;
      const edge = (padY + ctrl) / 2;
      d += ` Q ${cx} ${ctrl} ${xl} ${padY + b.height * jitter(seed, 20 + i) * 0.025}`;
      claws.push([cx + (xr - xl) * jitter(seed, 30 + i) * 0.08,
                  edge - b.height * 0.02,
                  (xr - xl) * 0.13, b.height * (0.1 + jitter(seed, 40 + i) * 0.02)]);
      if (i > 0) splits.push([xl, padY, xl + (xr - xl) * jitter(seed, 50 + i) * 0.12,
                              padY - b.height * (0.2 + jitter(seed, 60 + i) * 0.05)]);
    }
    d += ` L ${x0} ${y0 + rL} Z`;
  } else {
    // A wedge, not a slab. The original foot is thick where it meets the ankle
    // and tapers to the toes, filling the box diagonally — building a uniform
    // band across the bottom gave a boot that also floated free of the leg,
    // because nothing reached up to the ankle any more.
    const s = flipToes ? -1 : 1;
    const W = b.width;
    // The box's full height belongs to the OLD splayed toes, which were thin
    // lines hanging down. The solid part of the foot is only the upper portion
    // of it, so the wedge is built into that and the toes reach a little below.
    const h = b.height * 0.74;
    const x = (t) => (flipToes ? b.x + W * (1 - t) : b.x + W * t);
    const y = (t) => b.y + h * t;
    const sole = y(1);

    const toeFrom = 0.30;      // where the toes start along the sole
    const toeTo = 0.93;

    d = `M ${x(0)} ${y(0)}` +                       // ankle, back edge
        ` L ${x(0.34)} ${y(0)}` +                   // ankle, front edge
        ` Q ${x(0.74)} ${y(0.10)} ${x(0.90)} ${y(0.56)}` +   // instep, sloping down
        ` Q ${x(0.97)} ${y(0.86)} ${x(toeTo)} ${y(0.96)}`;   // front of the toes

    for (let i = N - 1; i >= 0; i--) {
      const xr = toeTo - (toeTo - toeFrom) * ((N - 1 - i) / N);
      const xl = toeTo - (toeTo - toeFrom) * ((N - i) / N);
      const cx = (xl + xr) / 2;
      const ctrl = sole + h * 0.07;
      const edge = (sole + ctrl) / 2;
      d += ` Q ${x(cx)} ${ctrl} ${x(xl)} ${sole - h * 0.02}`;
      claws.push([x(cx), edge, Math.abs(x(xr) - x(xl)) * 0.13, h * 0.07]);
      if (i > 0) splits.push([x(xl), sole - h * 0.03, x(xl), sole - h * 0.22]);
    }

    d += ` Q ${x(0.08)} ${y(1.0)} ${x(0.03)} ${y(0.78)}` +   // heel
         ` L ${x(0)} ${y(0)} Z`;
  }

  g.appendChild(svgEl('path', {
    d, fill: fur, stroke: ink, 'stroke-width': sw, 'stroke-linejoin': 'round',
  }));

  // Thin interior lines where the toes meet — the same language the body uses
  // for muscle definition, so the paw belongs to the same drawing.
  for (const [x1, y1, x2, y2] of splits) {
    g.appendChild(svgEl('path', {
      d: `M ${x1} ${y1} L ${x2} ${y2}`,
      stroke: ink, 'stroke-width': sw * 0.62, 'stroke-linecap': 'round', fill: 'none',
    }));
  }
  return g;
}

/** Replace one part with a paw drawn into its box. */
function replacePaw(rig, path, dir, fur, flipToes) {
  const el = rig.part(path, { optional: true });
  if (!el) return false;
  const parent = el.parentNode;
  parent.querySelectorAll('[data-part="كف_محسّن"]').forEach((n) => n.remove());

  const b = el.getBBox();
  if (!b.width || !b.height) return false;

  const paw = buildPaw(b, { dir, fur, flipToes, seed: `${rig.key}:${rig.view}:${path}` });
  parent.insertBefore(paw, el.nextSibling);
  el.setAttribute('display', 'none');   // kept in the DOM so the file stays editable
  return true;
}

/** Wolf hands and feet, both views. */
export function enhanceWolfPaws(rig) {
  const fur = sampleFill(rig, ['الجسم', 'الراس/الراس', 'الراس'], '#615e5e');
  const hands = rig.view === 'side'
    ? ['اليد_ق/الكف', 'اليدب/الكف']
    : ['اليد/الكف', 'اليد_2/الكف'];
  // Hands only. The original FEET are better than anything built here: they
  // are slim, they sit on the ground correctly, and every reconstruction came
  // out thicker and rounder than the drawing. The 'forward' branch of
  // buildPaw() is kept because it is correct code that lost on taste, and the
  // sheep may still want it.
  let n = 0;
  for (const p of hands) if (replacePaw(rig, p, 'down', fur, false)) n++;
  return n;
}

/**
 * Everything that should be corrected on a rig, dispatched by character.
 * Called from loadCharacter, so every target gets the fixes without asking.
 */
export function enhanceRig(rig) {
  // Deferred: these are sized from the bounding box of the part they replace,
  // and a detached node measures as zero. rig.ready() flushes this the first
  // time anything asks for real geometry — in practice, place().
  if (rig.key === 'wolf') rig.whenLive(enhanceWolfPaws);
  return rig;
}
