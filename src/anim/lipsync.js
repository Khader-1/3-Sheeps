// Lip sync driven by the recording's own amplitude envelope.
//
// tools/mixaudio.mjs measures per-frame RMS for each voice cue and writes it to
// out/promo-audio.json. Driving the mouth from that envelope keeps the motion
// locked to the track — which is the difference between a character who is
// speaking and a character who is idling while a voice happens to play.
//
// It is amplitude, not phonemes: loud frames open the mouth wide, quiet frames
// nearly close it. At 24fps that reads as speech.

import { asset } from '../base.js';
import { poseOver, basePose } from '../expressions.js';

const rnd = (n) => Math.round(n * 1000) / 1000;

/** Load the envelope sidecar produced by tools/mixaudio.mjs. */
export async function loadSyncData(url = '/out/promo-audio.json') {
  const res = await fetch(asset(url));
  if (!res.ok) return null;   // silent renders are still valid
  return res.json();
}

/** Sample an envelope array at a time offset, with linear interpolation. */
function sampleEnv(env, fps, u) {
  if (!env || !env.length) return 0;
  const f = u * fps;
  const i = Math.floor(f);
  if (i < 0) return env[0];
  if (i >= env.length - 1) return env[env.length - 1];
  const frac = f - i;
  return env[i] * (1 - frac) + env[i + 1] * frac;
}

/**
 * Drive a rig's mouth from a voice cue.
 *
 * The mouth artwork is a closed smile, so openness is expressed by scaling it
 * vertically and dropping it slightly — scaleY 1 is closed, ~2.6 is wide.
 * A small head lift and brow raise ride the same envelope so the whole face
 * participates rather than just the jaw.
 *
 * @param {Rig} rig
 * @param {Timeline} tl
 * @param {object} cue   { at, dur, env } from promo-audio.json
 * @param {number} fps
 * @param {object} [o]
 * @param {number} [o.open]    max mouth scale
 * @param {number} [o.headNod] degrees of head motion on loud frames
 */
export function addLipSync(rig, tl, cue, fps = 24, o = {}) {
  // Styled to match the film's own open-mouth drawing: a wide, dark oval with
  // a heavy black outline, which fully replaces the closed lip line.
  const { headNod = 3.0, openScale = 0.34, cavityFill = '#3a1512', lipStroke = '#000000' } = o;
  if (!cue || !cue.env) return;

  const mouthPath = rig.face?.mouth && rig.has(rig.face.mouth) ? rig.face.mouth : null;
  const head = rig.face?.head && rig.has(rig.face.head) ? rig.face.head : null;
  const brows = [rig.face?.browL, rig.face?.browR].filter((b) => b && rig.has(b));
  if (!mouthPath) return;

  // The mouth artwork is a *stroked curve*, not a closed shape — scaling it
  // only deepens the smile, it never opens. So an actual oral cavity is
  // inserted just behind the lip line and its height is driven by the
  // envelope; the jaw appears to drop and the lip line rides on top.
  const mouthEl = rig.part(mouthPath);
  const b = mouthEl.getBBox();
  // getBBox() ignores the element's own transform, so the expression's mouth
  // offset has to be added by hand or the cavity sits away from the lips.
  const mb = basePose(rig, mouthPath) || {};
  const cx = b.x + b.width / 2 + (mb.x || 0);
  const topY = b.y + b.height * 0.45 + (mb.y || 0);
  const maxRy = b.width * openScale;

  const SVGNS = 'http://www.w3.org/2000/svg';
  const cavity = document.createElementNS(SVGNS, 'ellipse');
  cavity.setAttribute('cx', cx);
  cavity.setAttribute('cy', topY);
  cavity.setAttribute('rx', b.width * 0.44);
  cavity.setAttribute('ry', 0);
  cavity.setAttribute('fill', cavityFill);
  cavity.setAttribute('stroke', lipStroke);
  cavity.setAttribute('stroke-width', 3.2);
  cavity.setAttribute('stroke-linejoin', 'round');
  cavity.setAttribute('data-part', 'فم_مفتوح');
  // Inserted AFTER the lip line, so an open mouth covers the closed smile
  // rather than having it draw on top. The line is also faded out as the jaw
  // drops, otherwise the closed curve stays visible across the opening.
  mouthEl.parentNode.insertBefore(cavity, mouthEl.nextSibling);

  tl.add(cue.at, cue.dur, 'linear', (p, t) => {
    const live = t >= cue.at - 1e-6 && t < cue.at + cue.dur;
    const a = live ? sampleEnv(cue.env, fps, t - cue.at) : 0;

    // Cavity opens downward from the lip line, widening a little as it does.
    const ry = a * maxRy;
    cavity.setAttribute('ry', rnd(ry));
    cavity.setAttribute('cy', rnd(topY + ry * 0.72));
    cavity.setAttribute('rx', rnd(b.width * (0.44 + a * 0.05)));
    cavity.setAttribute('opacity', a > 0.02 ? 1 : 0);

    // Hide the closed smile as soon as the mouth starts to open — otherwise
    // the curve stays visible straight across the open shape. Fades out over
    // the first third of the opening so a half-open mouth still reads.
    mouthEl.setAttribute('opacity', rnd(Math.max(0, 1 - a * 3.2)));
    // All three compose on top of the expression base. Posing them directly
    // would wipe it — and the brows are where fear and worry actually live, so
    // a speaking character would go blank-faced for the whole line.
    poseOver(rig, mouthPath, { scaleX: 1 + a * 0.1, pivot: [0.5, 0.2] });

    if (head) poseOver(rig, head, { rotate: -a * headNod, pivot: [0.5, 1] });
    for (const b2 of brows) poseOver(rig, b2, { y: -a * 2.2, pivot: [0.5, 0.5] });
  });
}

/**
 * Find the cue for a given speaker nearest a time — lets a shot ask for
 * "whatever line this character says around here" without hardcoding indices.
 */
export function cueFor(sync, speaker, nearTime, tol = 3.0) {
  if (!sync) return null;
  const hits = sync.cues.filter((c) => c.speaker === speaker && Math.abs(c.at - nearTime) <= tol);
  if (!hits.length) return null;
  return hits.reduce((best, c) =>
    Math.abs(c.at - nearTime) < Math.abs(best.at - nearTime) ? c : best
  );
}
