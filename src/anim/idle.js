// Idle life for a rigged character.
//
// Static cutout art reads as dead the moment it holds still, so every
// character on screen gets breathing, blinking, ear twitches and a slow sway.
// Each channel runs at its own frequency and each character gets a different
// phase, so a group never moves in lockstep — that lockstep is the single
// biggest giveaway of cheap cutout animation.
//
// Everything is a pure function of time (no accumulated state, no random),
// so it survives seeking and re-renders identically.

import { poseOver, basePose } from '../expressions.js';

const TAU = Math.PI * 2;
const rnd = (n) => Math.round(n * 1000) / 1000;

/**
 * @param {object} rig     a Rig with .face populated
 * @param {SVGGElement} holder  wrapper around rig.node — animated for the body
 *                              bob, so the rig's own place() transform is left
 *                              untouched
 * @param {Timeline} tl
 * @param {object} o
 * @param {number} o.at       start time
 * @param {number} o.dur      duration
 * @param {number} [o.phase]  0..1, offsets every channel; give each character
 *                            a different value
 * @param {number} [o.breath] body bob amplitude scale
 * @param {number} [o.sway]   head sway scale
 * @param {number} [o.fidget] extra motion — use a higher value for the
 *                            youngest, near zero for a still, stoic character
 * @param {boolean} [o.blink]
 */
export function addIdle(rig, holder, tl, o = {}) {
  const {
    at, dur, phase = 0, breath = 1, sway = 1, fidget = 1, blink = true,
  } = o;

  const head = rig.face?.head && rig.has(rig.face.head) ? rig.face.head : null;
  const ears = ['الاذن', 'الاذن_2'].filter((e) => rig.has(e));
  const eyes = [rig.face?.eyeL, rig.face?.eyeR, rig.face?.eye]
    .filter((e) => e && rig.has(e));
  const pupils = [rig.face?.pupilL, rig.face?.pupilR, rig.face?.pupil]
    .filter((p) => p && rig.has(p));

  // Body: slow vertical breathing, plus a barely-there horizontal drift.
  //
  // Guarded to its own window. Unguarded, this applies at p=0 for every
  // earlier frame and overwrites the holder transform — which silently
  // cancels a walk cycle's travel, leaving a character stepping on the spot.
  tl.add(at, dur, 'linear', (p, t) => {
    if (t < at - 1e-6) return;
    const u = p * dur;
    const y = Math.sin((u * 0.9 + phase * 6.3) * 1.0) * 2.6 * breath;
    const x = Math.sin((u * 0.37 + phase * 4.1) * 1.0) * 1.1 * fidget;
    holder.setAttribute('transform', `translate(${rnd(x)} ${rnd(y)})`);
  });

  // Head: a slow sway on a different period so it never syncs to the breath.
  if (head) {
    tl.add(at, dur, 'linear', (p) => {
      const u = p * dur;
      const a = Math.sin((u * 0.61 + phase * 5.7)) * 1.8 * sway;
      poseOver(rig, head, { rotate: a, pivot: [0.5, 1] });
    });
  }

  // Ears: occasional twitch. Sharp attack, slow settle — a sine would read
  // as a wobble rather than a flick.
  ears.forEach((ear, i) => {
    const period = 3.7 + i * 1.3;
    const dir = i === 0 ? 1 : -1;
    tl.add(at, dur, 'linear', (p) => {
      const u = p * dur;
      const k = ((u / period) + phase + i * 0.31) % 1;
      const flick = k < 0.08 ? Math.sin((k / 0.08) * Math.PI) ** 2 : 0;
      poseOver(rig, ear, { rotate: dir * flick * 7 * fidget, pivot: [0.5, 0.9] });
    });
  });

  // Blink: squash the eye group vertically. The art has no eyelid, but a fast
  // scaleY dip reads convincingly as one at 24fps.
  if (blink && eyes.length) {
    const period = 3.1;
    tl.add(at, dur, 'linear', (p) => {
      const u = p * dur;
      const k = ((u / period) + phase * 1.7) % 1;
      const closed = k < 0.05 ? Math.sin((k / 0.05) * Math.PI) : 0;
      const s = 1 - closed * 0.92;
      // Multiplies the expression's eye opening rather than replacing it, so a
      // wide-eyed character still blinks and still reads as wide-eyed.
      for (const e of eyes) poseOver(rig, e, { scaleY: s, pivot: [0.5, 0.45] });
    });
  }

  // Pupils: tiny saccades, so the gaze is never frozen.
  if (pupils.length) {
    tl.add(at, dur, 'linear', (p) => {
      const u = p * dur;
      const step = Math.floor(u / 1.6 + phase * 3);
      // Deterministic hash -> stable per step, no Math.random.
      const h = Math.sin(step * 12.9898 + phase * 78.233) * 43758.5453;
      const dx = ((h - Math.floor(h)) - 0.5) * 2.2 * fidget;
      const h2 = Math.sin(step * 39.3468 + phase * 11.135) * 24634.6345;
      const dy = ((h2 - Math.floor(h2)) - 0.5) * 1.4 * fidget;
      for (const q of pupils) poseOver(rig, q, { x: rnd(dx), y: rnd(dy) });
    });
  }
}

/**
 * Overlay a one-off gesture on top of idle: a quick head turn toward a
 * direction, holding at the end. Useful for "they hear something".
 */
export function lookTo(rig, tl, { at, dur = 0.5, angle = 8, gaze = [4, 0] }) {
  const head = rig.face?.head;
  if (head && rig.has(head)) {
    tl.add(at, dur, 'outCubic', (p) => {
      poseOver(rig, head, { rotate: angle * p, pivot: [0.5, 1] });
    });
  }
  const pupils = [rig.face?.pupilL, rig.face?.pupilR, rig.face?.pupil]
    .filter((q) => q && rig.has(q));
  // Gaze is absolute, blended out of whatever the expression set — adding to it
  // would stack two offsets and slide the pupils clean out of the eye.
  tl.add(at, dur, 'outCubic', (p) => {
    for (const q of pupils) {
      const b = basePose(rig, q) || {};
      const bx = b.x || 0, by = b.y || 0;
      rig.pose(q, { x: bx + (gaze[0] - bx) * p, y: by + (gaze[1] - by) * p });
    }
  });
}
