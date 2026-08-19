// Walk cycles for the cutout rigs.
//
// Moho exported limb parts as *siblings*, so rotating a thigh does not carry
// its foot. chain() re-parents them into real bone chains first; everything
// after that is ordinary sinusoidal cycling.
//
// Two naming conventions exist in the source art — the sheep front views use
// الرجل_ش / الفخد / القدم, the wolf side view uses الرجل__و / ق_الفخد / قصبه_ق —
// so limbs are resolved against both and the rig records what it found.
//
// A convincing cutout walk needs four things moving together:
//   legs   opposed swing, with the lower joint lagging so the foot plants
//   arms   swinging opposite to the leg on the same side
//   body   vertical bob at twice the step rate, plus a slight torso rock
//   head   a counter-bob so it isn't welded to the body
//
// All of it is a pure function of time, so it survives seeking.

import { bboxIn } from '../rig.js';

const rnd = (n) => Math.round(n * 1000) / 1000;

/** Overlap of two rects, or null. */
function overlap(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) return null;
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

/**
 * Measure where limbs actually hinge, instead of guessing.
 *
 * Rotating a limb needs a pivot, and until now every pivot was a fraction of
 * the part's bounding box — [0.5, 0.04] meaning "top-centre-ish". For a
 * straight limb that is close enough. For the wolf's side-view legs, which are
 * drawn bent and curving backwards, the top-centre of the box is nowhere near
 * the hip, so the whole leg swung away from the body and visibly detached.
 *
 * A joint is where two connected parts overlap: the hip is where the leg
 * overlaps the torso, the knee is where the shin overlaps the thigh. Taking
 * the centre of that overlap puts the pivot on the actual hinge, whatever the
 * drawing looks like.
 *
 * Measured lazily — this needs a live node, and rigs are often chained before
 * they are placed.
 */
export function limbPivots(rig) {
  if (rig._pivots) return rig._pivots;
  const limbs = buildLimbChains(rig);
  const out = { legs: [], mids: [], arms: [] };

  const box = (path) => {
    const el = rig.part(path, { optional: true });
    if (!el) return null;
    try { return bboxIn(el, rig.node); } catch { return null; }
  };
  /** Centre of the overlap, as a fraction of `childBox`. */
  const hinge = (childBox, hostBox, fallback) => {
    if (!childBox || !hostBox) return fallback;
    const o = overlap(childBox, hostBox);
    if (!o) return fallback;
    return [
      Math.max(0, Math.min(1, (o.x + o.width / 2 - childBox.x) / childBox.width)),
      Math.max(0, Math.min(1, (o.y + o.height / 2 - childBox.y) / childBox.height)),
    ];
  };

  const body = box('الجسم');
  for (const leg of limbs.legs) out.legs.push(hinge(box(leg), body, [0.5, 0.04]));
  for (const arm of limbs.arms) out.arms.push(hinge(box(arm), body, [0.5, 0.05]));
  for (const mid of limbs.mids) {
    // The mid segment's parent is the segment above it in the chain.
    const parent = mid.split('/').slice(0, -1).join('/');
    out.mids.push(hinge(box(mid), box(parent), [0.5, 0.06]));
  }

  rig._pivots = out;
  return out;
}
const TAU = Math.PI * 2;

const LIMB_SETS = [
  {
    name: 'sheep-front',
    legs: [['الرجل_ش', ['الفخد', 'القدم']], ['الرجل_ي', ['الفخد', 'القدم']]],
    arms: [['اليد_ش', ['الكتف_ش', 'الساعد', 'الكف']], ['اليد_ي', ['الكتف_ش', 'الساعد', 'الكف']]],
  },
  {
    name: 'wolf-side',
    legs: [['الرجل__و', ['ق_الفخد', 'قصبه_ق', '__القدم_ق']], ['الرجل_ق', ['ق_الفخد', 'قصبه_ق', '__القدم_ق']]],
    arms: [['اليدب', ['الكتف', 'الساعد', 'الكف']], ['اليد_ق', ['الكتف', 'الساعد', 'الكف']]],
  },
  {
    // The wolf's front view. His arms are drawn straight out to the sides,
    // which is useless for walking and perfect for bracing inside a chimney.
    name: 'wolf-front',
    legs: [['الرجل', ['الفخد', 'القدم']], ['الرجل_2', ['الفخد', 'القدم']]],
    arms: [['اليد', ['الكتف', 'الساعد', 'الكف']], ['اليد_2', ['الكتف', 'الساعد', 'الكف']]],
  },
  {
    name: 'sheep-side',
    legs: [['الرجل_ق', ['الرجل_', 'القدم']], ['الرجل_د', ['الرجل_', 'القدم']]],
    arms: [['اليد_ق', ['الكتف_ق', 'الساعد', 'الكف']], ['اليد_د', ['الكتف_ق', 'الساعد', 'الكف']]],
  },
];

/**
 * Re-parent a character's limbs into chains and record their paths on the rig.
 * Idempotent.
 */
export function buildLimbChains(rig) {
  if (rig._limbs) return rig._limbs;

  // Best fit, not first fit. The sets overlap: a sheep in profile has الرجل_ق
  // and اليد_ق, and so does the wolf, so "the first set with any leg in it"
  // handed every side-view sheep the wolf's rig. Half its groups then did not
  // exist and the other half were chained against the wolf's child names,
  // which throw and are swallowed — leaving a sheep with one leg, no arms and
  // pivots measured off the wrong parts. Counting how many of a set's groups
  // the rig actually has separates them cleanly: 4 against 2, either way.
  const set = LIMB_SETS
    .map((s) => ({ s, n: [...s.legs, ...s.arms].filter(([g]) => rig.has(g)).length }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n)[0]?.s;
  const limbs = { legs: [], arms: [], mids: [], set: set ? set.name : 'none' };

  if (set) {
    for (const [group, order] of set.legs) {
      if (!rig.has(group)) continue;
      try { rig.chain(group, order); } catch { /* already chained */ }
      limbs.legs.push(group);
      // the second joint down the chain, used for the foot lag
      limbs.mids.push(`${group}/${order[0]}/${order[1]}`);
    }
    for (const [group, order] of set.arms) {
      if (!rig.has(group)) continue;
      try { rig.chain(group, order); } catch { /* already chained */ }
      limbs.arms.push(group);
    }
  }

  rig._limbs = limbs;
  return limbs;
}

/**
 * Pose a rig's limbs at one point in a stride, and report the body's bob.
 *
 * addWalk() below owns the whole walk — it drives travel, timing and easing
 * from a timeline. This is the same cycle with none of that: one frame, posed
 * from a phase the caller supplies, for anything driven by distance or by an
 * rAF loop rather than by a timeline. «اهرب» advances the phase with the
 * ground so the legs stay in step whatever the speed, and the poster section
 * runs it off wall-clock.
 *
 * `armBase` is the rest angle of the arms and belongs to the character, not to
 * the animation: the smallest sheep's front view is drawn in a T-pose and
 * needs his arms swung down, while every side view's already hang correctly.
 * Applying the sheep's −54°/+56° to the wolf stuck his arm straight out in
 * front of him.
 *
 * Pivots come from limbPivots(), which measures each joint from where the
 * parts actually overlap. Bounding-box fractions were close enough for the
 * sheep's straight limbs and badly wrong for the wolf's bent ones, which is
 * what detached his legs from his body.
 *
 * @param {Rig} rig
 * @param {number} phase   stride cycles, fractional; 1 is a full two-step
 * @param {object} [o]
 * @param {number} [o.swing]   thigh swing, degrees
 * @param {number} [o.bob]     vertical bob amplitude, scene units
 * @param {number} [o.lean]    constant forward lean of the torso, degrees
 * @param {number} [o.rock]    torso rock amplitude, degrees
 * @param {number} [o.amp]     0..1 overall amplitude, for easing into a stop
 * @param {[number,number]} [o.armBase]
 * @returns {number} the body's vertical offset this frame
 */
export function stride(rig, phase, o = {}) {
  const { swing = 22, bob = 5, lean = 4, rock = 2.4, amp = 1, armBase = [0, 0] } = o;
  const lb = buildLimbChains(rig);
  const piv = limbPivots(rig);
  const cyc = phase * TAU;
  const a = Math.sin(cyc) * amp, b = Math.sin(cyc + Math.PI) * amp;

  lb.legs.forEach((leg, i) => rig.pose(leg, {
    rotate: (i === 0 ? a : b) * swing, pivot: piv.legs[i] || [0.5, 0.04],
  }));
  lb.mids.forEach((mid, i) => {
    if (!rig.has(mid)) return;
    const s = Math.sin(cyc + (i === 0 ? -1 : 1) * Math.PI / 2) * amp;
    rig.pose(mid, {
      rotate: Math.max(0, s) * swing * 0.7, pivot: piv.mids[i] || [0.5, 0.06],
    });
  });
  lb.arms.forEach((arm, i) => {
    const base = armBase[i] || 0;
    rig.pose(arm, {
      rotate: base + (i === 0 ? b : a) * swing * 0.5,
      pivot: base ? (i === 0 ? [1, 0.4] : [0, 0.4]) : (piv.arms[i] || [0.5, 0.05]),
    });
  });
  if (rig.has('الجسم')) rig.pose('الجسم', { rotate: a * rock + lean, pivot: [0.5, 0.9] });
  return (-Math.abs(Math.sin(cyc)) * bob + bob * 0.5) * amp;
}

/**
 * Walk a character across the scene.
 *
 * @param {object} o
 * @param {number} o.at, o.dur
 * @param {number} [o.fromX] travel start offset (scene units)
 * @param {number} [o.toX]   travel end offset
 * @param {number} [o.steps] stride cycles across the duration
 * @param {number} [o.swing] thigh swing, degrees
 * @param {number} [o.bob]   vertical bob amplitude
 * @param {number} [o.phase] 0..1, so a group isn't in lockstep
 * @param {number} [o.lean]  constant forward lean, degrees
 * @param {number} [o.rock]  torso rock amplitude, degrees
 * @param {[number,number]} [o.armBase] rest-pose offsets for arms drawn out
 * @param {number} [o.headSwing] head counter-rotation, degrees. Keep it small:
 *                            a walking head that swings hard reads as a nod.
 * @param {boolean} [o.preroll] hold the start pose before the window begins
 * @param {number} [o.settle] fraction of the walk spent decelerating to a stop
 */
export function addWalk(rig, holder, tl, o = {}) {
  const {
    at, dur, fromX = 0, toX = 0, steps = Math.max(2, Math.round(dur * 1.6)),
    swing = 22, bob = 4, phase = 0, lean = 0, rock = 0, armBase = [0, 0],
    headSwing = 2.2, preroll = false, settle = 0.18,
  } = o;

  const limbs = buildLimbChains(rig);
  const body = rig.has('الجسم') ? 'الجسم' : null;
  const head = rig.face?.head && rig.has(rig.face.head) ? rig.face.head : null;

  tl.add(at, dur, 'linear', (p, t) => {
    // Before the window the character is normally left untouched — applying at
    // p=0 would park him at the walk's start offset for the whole film, which
    // is what once moved the wolf out of his own close-ups.
    //
    // A shot that opens on a walk needs the opposite. Without preroll the
    // fade-in frames show the character already arrived, and he snaps back to
    // the entry offset the moment the walk starts.
    if (t < at - 1e-6 && !preroll) return;

    // Ease into the stop rather than halting mid-stride: travel and step rate
    // decelerate together over the last `settle` of the walk while the limb
    // amplitude fades out, so the legs arrive at rest instead of freezing.
    const k = settle > 0 ? Math.max(0, (p - (1 - settle)) / settle) : 0;
    const e = k <= 0 ? p : (1 - settle) + settle * (1 - (1 - k) ** 2);
    const amp = 1 - k;

    const cyc = (e * steps + phase) * TAU;
    const a = Math.sin(cyc) * amp;
    const b = Math.sin(cyc + Math.PI) * amp;

    // Travel + bob. Bob runs at 2x stride: the body dips on each footfall.
    const x = fromX + (toX - fromX) * e;
    const y = -Math.abs(Math.sin(cyc)) * bob * amp + bob * 0.5 * amp;
    holder.setAttribute('transform', `translate(${rnd(x)} ${rnd(y)})`);

    const piv = limbPivots(rig);
    limbs.legs.forEach((leg, i) => {
      rig.pose(leg, { rotate: (i === 0 ? a : b) * swing, pivot: piv.legs[i] || [0.5, 0.04] });
    });
    // Lower joints lag a quarter cycle and only bend one way — knees don't invert.
    limbs.mids.forEach((mid, i) => {
      if (!rig.has(mid)) return;
      const s = Math.sin(cyc + (i === 0 ? -1 : 1) * Math.PI / 2) * amp;
      rig.pose(mid, { rotate: Math.max(0, s) * swing * 0.75, pivot: piv.mids[i] || [0.5, 0.06] });
    });
    // Arms counter-swing the leg on the same side. armBase offsets a rest pose
    // that is drawn straight out (the smallest sheep is in a T-pose).
    limbs.arms.forEach((arm, i) => {
      const base = armBase[i] || 0;
      rig.pose(arm, {
        rotate: base + (i === 0 ? b : a) * swing * 0.6 + lean * 0.3,
        pivot: base ? (i === 0 ? [1, 0.4] : [0, 0.4]) : (piv.arms[i] || [0.5, 0.05]),
      });
    });

    // Torso rock and head counter-bob — without these the body reads as a
    // rigid block sliding along while only the limbs move.
    if (body && rock) rig.pose(body, { rotate: a * rock + lean, pivot: [0.5, 0.9] });
    if (head) rig.pose(head, { rotate: -a * headSwing + lean * 0.25, pivot: [0.5, 1] });
  });
}

/** A single weighted step forward, for "plants himself" moments. */
export function addStepForward(rig, holder, tl, o = {}) {
  const { at, dur = 0.8, dx = 40, dip = 6, phase = 0 } = o;
  const limbs = buildLimbChains(rig);
  tl.add(at, dur, 'outCubic', (p, t) => {
    if (t < at - 1e-6) return;
    const anticip = p < 0.25 ? -Math.sin((p / 0.25) * Math.PI) * 0.18 : 0;
    const travel = (p < 0.25 ? 0 : (p - 0.25) / 0.75) + anticip;
    holder.setAttribute('transform',
      `translate(${rnd(dx * travel)} ${rnd(-Math.sin(p * Math.PI) * dip)})`);
    const s = Math.sin(p * Math.PI + phase);
    limbs.legs.forEach((leg, i) => rig.pose(leg, { rotate: (i === 0 ? s : -s) * 20, pivot: [0.5, 0.04] }));
  });
}
