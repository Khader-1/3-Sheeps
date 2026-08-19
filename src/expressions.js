// Character face maps and expression presets.
//
// All three sheep share the same face artwork at identical coordinates, so one
// expression system drives them all. The wolf is built differently: his brows
// and pupils live *inside* each eye group, and his pupil is البؤبؤ rather than
// the sheep's العدسه.
//
// Sheep head grouping is inconsistent in the source art — the biggest sheep
// has تجميعة_الراس, the smallest has اللراس, and the middle one has no head
// group at all — so buildFace() normalises that before posing.

import { Rig, fetchText } from './rig.js';
import { CHARACTERS } from './characters.js';
import { enhanceRig } from './enhance.js';

/** Parts that make up a sheep head, in document order. */
const SHEEP_HEAD_PARTS = [
  'الاذن', 'الاذن_2', 'الراس', '_ش_الحاجب', '_ي_الحاجب',
  'العين', 'العين_2', 'الانف', 'الفم', 'قرن_', 'قرن__2',
];

const SHEEP_FACE = {
  // viewer-left is the smaller x
  browL: '_ش_الحاجب',
  browR: '_ي_الحاجب',
  eyeL: 'العين_2',
  eyeR: 'العين',
  pupilL: 'العين_2/العدسه',
  pupilR: 'العين/العدسه',
  mouth: 'الفم',
  armL: 'اليد_ش',
  armR: 'اليد_ي',
  legL: 'الرجل_ش',
  legR: 'الرجل_ي',
  body: 'الجسم',
};

const WOLF_FACE = {
  browL: 'ت_العين_2/الحاجب',
  browR: 'ت_العين/الحاجب',
  eyeL: 'ت_العين_2',
  eyeR: 'ت_العين',
  pupilL: 'ت_العين_2/البؤبؤ',
  pupilR: 'ت_العين/البؤبؤ',
  mouth: 'الفم',
  armL: 'اليد_2',
  armR: 'اليد',
  legL: 'الرجل_2',
  legR: 'الرجل',
  body: 'الجسم',
};

// The sheep in profile. Drawn like the wolf's side view — one eye, one brow,
// everything under الراس — but with no mouth part at all, so there is nothing
// for a mouth shape to drive and express() simply leaves it alone.
//
// browPivot because they face the other way. A brow rotates about its outer
// end so the inner tip carries the read, and "outer" is the back of the head:
// the wolf's is his right, a sheep's is his left.
const SHEEP_SIDE_FACE = {
  brow: 'الراس/الحاجب',
  eye: 'الراس/العين',
  pupil: 'الراس/العين/العدسه',
  browPivot: [0, 0.5],
  head: 'الراس',
  body: 'الجسم',
};

const WOLF_SIDE_FACE = {
  brow: 'الراس/الحاجب',
  eye: 'الراس/العين',
  pupil: 'الراس/العين/العدسه',
  mouth: 'الراس/الفم',
  head: 'الراس',
  body: 'الجسم',
  armFar: 'اليدب',
  armNear: 'اليد_ق',
  legFar: 'الرجل__و',
  legNear: 'الرجل_ق',
};

/**
 * Load a character and normalise its rig.
 * @param {'wolf'|'big'|'mid'|'small'} key
 * @param {'front'|'side'} view
 */
export async function loadCharacter(key, view = 'front') {
  const c = CHARACTERS[key];
  if (!c) throw new Error(`unknown character ${key}`);
  const viewId = c.views[view];
  if (!viewId) throw new Error(`${key} has no "${view}" view`);

  const rig = new Rig(await fetchText(c.file), { view: viewId, name: key });

  if (key === 'wolf' && view === 'front') {
    rig.face = { ...WOLF_FACE, head: 'تجميع_الراس' };
  } else if (key === 'wolf' && view === 'side') {
    rig.face = { ...WOLF_SIDE_FACE };
  } else if (view === 'front') {
    // Normalise the head group across the three sheep.
    let head = ['تجميعة_الراس', 'اللراس'].find((h) => rig.has(h));
    if (!head) {
      rig.group('الراس_تجميع', SHEEP_HEAD_PARTS);
      head = 'الراس_تجميع';
    }
    rig.face = { ...SHEEP_FACE, head };
  } else {
    // A sheep in profile. This used to be head and body and nothing else, so
    // every expression applied to one silently did nothing — no blink, no
    // gaze, no brow — which is a large part of why the side views went unused
    // for as long as they did.
    rig.face = { ...SHEEP_SIDE_FACE };
  }

  rig.key = key;
  rig.view = view;

  // Art corrections (src/enhance.js) run here so every target gets them —
  // teaser, book and games all load characters through this function.
  enhanceRig(rig);

  return rig;
}

// Expression *base* poses.
//
// rig.pose() writes the whole transform attribute, so it replaces whatever was
// there rather than adding to it. That means any per-frame track touching a
// part — a blink on the eyes, a brow raise from lip sync, a saccade on the
// pupils — silently erases the expression that was applied at setup time. A
// terrified sheep ends up blank-faced the moment it starts talking.
//
// So express() records what it applied, and animation channels go through
// poseOver(), which composes their delta on top of that base.
const BASE = new WeakMap();

/** The expression transform recorded for a part, or null. */
export function basePose(rig, path) {
  const m = BASE.get(rig);
  return (m && m.get(path)) || null;
}

/**
 * Pose a part on top of its expression base: rotations and offsets add,
 * scales multiply, and the base's pivot wins (it is the one the expression
 * was authored against).
 */
export function poseOver(rig, path, delta = {}) {
  const b = basePose(rig, path);
  if (!b) return rig.pose(path, delta);
  const dx = delta.scaleX ?? delta.scale ?? 1;
  const dy = delta.scaleY ?? delta.scale ?? 1;
  return rig.pose(path, {
    rotate: (b.rotate || 0) + (delta.rotate || 0),
    x: (b.x || 0) + (delta.x || 0),
    y: (b.y || 0) + (delta.y || 0),
    scaleX: (b.scaleX ?? b.scale ?? 1) * dx,
    scaleY: (b.scaleY ?? b.scale ?? 1) * dy,
    pivot: b.pivot || delta.pivot || [0.5, 0.5],
  });
}

/**
 * Apply a facial expression to a front-view rig.
 *
 * Brows rotate about their outer end so the inner tip drives the read:
 * inner-down is anger/determination, inner-up is fear.
 * The mouth artwork is a smile, so scaleY:-1 flips it to a frown.
 *
 * @param {Rig} rig
 * @param {object} o
 * @param {number} [o.brow]    degrees; positive = inner ends down (angry)
 * @param {number} [o.browLift] vertical brow offset; negative = raised
 * @param {[number,number]} [o.gaze] pupil offset in user units [x, y]
 * @param {number} [o.eyeOpen] vertical eye scale, 1 = normal
 * @param {object} [o.mouth]   raw transform passed through to pose()
 */
export function express(rig, o = {}) {
  const f = rig.face;
  const { brow = 0, browLift = 0, gaze = [0, 0], eyeOpen = 1, mouth = null } = o;

  // Re-applying an expression replaces the previous base rather than layering.
  const base = new Map();
  BASE.set(rig, base);
  const put = (path, t) => {
    if (!path || !rig.has(path)) return;
    base.set(path, t);
    rig.pose(path, t);
  };

  const setBrow = (path, sign) => put(path, {
    rotate: sign * brow,
    y: browLift,
    pivot: sign > 0 ? [0, 0.5] : [1, 0.5],
  });
  setBrow(f.browL, +1);
  setBrow(f.browR, -1);
  if (f.brow) put(f.brow, { rotate: brow, y: browLift, pivot: f.browPivot || [1, 0.5] });

  for (const p of [f.pupilL, f.pupilR, f.pupil]) put(p, { x: gaze[0], y: gaze[1] });

  if (eyeOpen !== 1) {
    for (const e of [f.eyeL, f.eyeR, f.eye]) put(e, { scaleY: eyeOpen, pivot: [0.5, 0.5] });
  }

  if (mouth) put(f.mouth, { pivot: [0.5, 0.5], ...mouth });
  return rig;
}

/** Named expressions used across the poster, promo and film. */
export const EXPRESSIONS = {
  neutral: {},

  /** Jaw set, brows low and level — the eldest brother facing the wolf. */
  determined: {
    brow: 16,
    browLift: 4,
    gaze: [5, -6],
    eyeOpen: 0.92,
    mouth: { scaleY: -0.85, scaleX: 0.9, y: 3 },
  },

  /**
   * Unsettled but not panicking — brows tented gently, eyes a touch wide.
   * Deliberately milder than `afraid` so the two read as different beats.
   */
  worried: {
    brow: -14,
    browLift: -4,
    gaze: [4, -3],
    eyeOpen: 1.08,
    mouth: { scaleY: -0.8, scaleX: 0.78, y: 3 },
  },

  /** Brows tented up, eyes wide, small mouth — the younger two. */
  afraid: {
    brow: -20,
    browLift: -5,
    gaze: [4, -5],
    eyeOpen: 1.15,
    mouth: { scaleY: -0.7, scaleX: 0.62, y: 4 },
  },

  /** Same fear, pitched a little higher for the smallest. */
  terrified: {
    brow: -26,
    browLift: -7,
    gaze: [5, -6],
    eyeOpen: 1.3,
    mouth: { scaleY: -0.55, scaleX: 0.5, y: 5 },
  },

  /** Open smile, brows relaxed and lifted at the outer ends. */
  happy: {
    brow: -6,
    browLift: -3,
    gaze: [0, -2],
    eyeOpen: 1.0,
    mouth: { scaleX: 1.3, scaleY: 1.25, y: 1 },
  },

  /** Inner brows up, lids low, gaze down — heavier and slower than worry. */
  sad: {
    brow: -17,
    browLift: 2,
    gaze: [0, 4],
    eyeOpen: 0.8,
    mouth: { scaleY: -0.95, scaleX: 0.8, y: 5 },
  },

  /** Brows high and flat, eyes round, small open mouth. */
  surprised: {
    brow: -6,
    browLift: -11,
    gaze: [0, 0],
    eyeOpen: 1.38,
    mouth: { scaleY: -0.5, scaleX: 0.55, y: 3 },
  },

  /** Brows driven down and in, pupils forward — the wolf closing in. */
  menacing: {
    brow: 22,
    browLift: 5,
    gaze: [-3, 2],
    eyeOpen: 0.8,
  },
};

/**
 * Bring the smallest sheep's arms down out of his T-pose.
 *
 * His arms are drawn straight out and are 224 units long, with the shoulder
 * sitting *inside* a 267-wide torso — and the arms are behind the body in
 * draw order. Swing them down much past 50° and the hands disappear behind
 * his back, because the whole arm ends up inside the torso silhouette.
 * These angles keep them clear of it by about 95 units, matching how far his
 * brothers' arms read.
 */
export const REST_ARMS = { 'اليد_ش': -50, 'اليد_ي': 53 };

export function restArms(rig) {
  rig.poseAll({
    'اليد_ش': { rotate: REST_ARMS['اليد_ش'], pivot: [1, 0.4] },
    'اليد_ي': { rotate: REST_ARMS['اليد_ي'], pivot: [0, 0.4] },
  });
  return rig;
}

export function applyExpression(rig, name) {
  const e = EXPRESSIONS[name];
  if (!e) throw new Error(`unknown expression "${name}"`);
  return express(rig, e);
}
