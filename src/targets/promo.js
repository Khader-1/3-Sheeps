// Teaser — «الخراف الثلاثة والذئب الماكر»
//
// A teaser, not a synopsis: the house materials are never named, no house is
// shown falling, and the ending never appears. Structure is
// calm -> characters -> knock -> wolf in fragments -> reactions -> question.
//
// The four dialogue beats use the project's own voice recordings; the picture
// is cut to their lengths. See tools/mixaudio.mjs for the audio spine.
//
// ~27s, 1920×1080, 24fps.

import { fetchText, svgEl } from '../rig.js';
import { loadScene, frameOn, camTransform, SCENE_W, SCENE_H, FILM } from '../anim/stage.js';
import { Timeline, Ease, lerp } from '../anim/timeline.js';
import { loadCharacter, applyExpression, restArms, REST_ARMS } from '../expressions.js';
import { addIdle, lookTo } from '../anim/idle.js';
import { addWalk, addStepForward, buildLimbChains } from '../anim/gait.js';
import { loadSyncData, addLipSync, cueFor } from '../anim/lipsync.js';
import { COPY } from '../copy.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const W = FILM.width;
const H = FILM.height;
const CREAM = '#FFF3C4';
const INK = '#140d06';
const rnd = (n) => Math.round(n * 1000) / 1000;

function view(zoom = 1, cx = 0.5, cy = 0.5) {
  const w = SCENE_W / zoom, h = SCENE_H / zoom;
  return { x: SCENE_W * cx - w / 2, y: SCENE_H * cy - h / 2, w, h };
}
const lerpRect = (a, b, p) => ({
  x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p),
  w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p),
});

/**
 * The teaser.
 *
 * @param {object} [o]
 * @param {boolean} [o.narrated] Use the narrated cut: the film's own narrator
 *   (cloned with XTTS-v2) carries the atmosphere lines that the silent cut
 *   puts on screen as cards, over the generated music. The closing statement
 *   and the title still appear as text in both — a trailer wants its last line
 *   read as well as heard.
 */
export default async function promo(o = {}) {
  const { narrated = false, plain = false } = o;
  const stem = narrated
    ? (plain ? 'promo-narrated-plain-audio' : 'promo-narrated-audio')
    : 'promo-audio';

  const fontCss = await fetchText('/assets/fonts/embed.css');
  // Voice envelopes drive the mouths; null if the audio has not been built yet.
  const sync = await loadSyncData(`/out/${stem}.json`);
  const FPS = sync?.fps || 24;

  const svg = svgEl('svg', {
    xmlns: SVGNS, 'xmlns:xlink': 'http://www.w3.org/1999/xlink',
    width: W, height: H, viewBox: `0 0 ${W} ${H}`,
  });
  document.getElementById('stage').appendChild(svg);

  const style = document.createElementNS(SVGNS, 'style');
  style.textContent = `${fontCss}
.d{font-family:'Poster Display',sans-serif;font-weight:800;}
.t{font-family:'Poster Text',sans-serif;font-weight:600;}
text{direction:rtl;unicode-bidi:isolate;}`;
  svg.appendChild(style);

  const defs = document.createElementNS(SVGNS, 'defs');
  defs.innerHTML = `
    <radialGradient id="vig" cx="0.5" cy="0.5" r="0.78">
      <stop offset="0.42" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#0a0600" stop-opacity="0.6"/>
    </radialGradient>
    <linearGradient id="warm" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b1a08"/><stop offset="1" stop-color="#0b0602"/>
    </linearGradient>`;
  svg.appendChild(defs);
  svg.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#warm)' }));

  const shots = svgEl('g', { id: 'shots' });
  svg.appendChild(shots);
  svg.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#vig)' }));
  const flashes = svgEl('g', { id: 'flashes' });
  svg.appendChild(flashes);
  const overlay = svgEl('g', { id: 'overlay' });
  svg.appendChild(overlay);

  const tl = new Timeline('teaser');

  // ------------------------------------------------------------- helpers
  async function makeShot(sceneName, tint = 0) {
    const root = svgEl('g', { 'data-shot': sceneName, opacity: 0 });
    const shakeG = svgEl('g');
    const camG = svgEl('g');
    camG.appendChild(await loadScene(sceneName));
    shakeG.appendChild(camG);
    root.appendChild(shakeG);
    if (tint > 0) root.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: '#0d0803', opacity: tint }));
    shots.appendChild(root);
    return { root, camG, shakeG, segs: [] };
  }

  function show(shot, at, dur, fadeIn = 0.26) {
    tl.add(at - fadeIn, fadeIn, 'inOutSine', (p) => shot.root.setAttribute('opacity', p));
    tl.add(at, dur, 'linear', (p, t) => {
      shot.root.style.display = t >= at - fadeIn - 1e-6 && t < at + dur ? '' : 'none';
    });
  }

  // One camera track per shot: registering a track per move lets the
  // last-registered one win at every time (tracks apply at p=0 before their
  // start), which silently flattens hard cuts into a single framing.
  const move = (shot, at, dur, from, to, ease = 'inOutSine') =>
    shot.segs.push({ at, dur, from, to, ease });
  const hold = (shot, at, dur, rect, dz = 1.06) =>
    shot.segs.push({
      at, dur, ease: 'linear', from: rect,
      to: { x: rect.x + (rect.w * (1 - 1 / dz)) / 2, y: rect.y + (rect.h * (1 - 1 / dz)) / 2, w: rect.w / dz, h: rect.h / dz },
    });

  function commit(shot) {
    const segs = shot.segs.slice().sort((a, b) => a.at - b.at);
    if (!segs.length) return;
    const start = segs[0].at;
    const end = Math.max(...segs.map((s) => s.at + s.dur));
    tl.add(start, end - start, 'linear', (p, t) => {
      let seg = segs[0];
      for (const s of segs) if (t >= s.at - 1e-6) seg = s;
      const u = Math.max(0, Math.min(1, (t - seg.at) / seg.dur));
      shot.camG.setAttribute('transform',
        camTransform(lerpRect(seg.from, seg.to, (Ease[seg.ease] || Ease.linear)(u)), W, H));
    });
  }

  function shake(node, at, dur, amp) {
    tl.add(at, dur, 'linear', (p, t) => {
      if (t < at - 1e-6 || t >= at + dur) { node.setAttribute('transform', 'translate(0 0)'); return; }
      const d = (1 - p) ** 2;
      node.setAttribute('transform',
        `translate(${rnd(Math.sin(p * 121.7) * amp * d)} ${rnd(Math.cos(p * 173.3) * amp * d * 0.6)})`);
    });
  }

  function flashAt(at, dur = 0.18, peak = 0.5) {
    const rect = svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff6dd', opacity: 0 });
    flashes.appendChild(rect);
    tl.add(at, dur, 'outQuad', (p, t) => {
      rect.setAttribute('opacity', t >= at - 1e-6 && t < at + dur ? (1 - p) * peak : 0);
    });
  }

  function line(str, { at, dur, size = 96, y = H / 2 + size * 0.33 }) {
    const g = svgEl('g', { opacity: 0 });
    const mk = (a) => {
      const t = svgEl('text', { x: W / 2, y, 'text-anchor': 'middle', class: 'd', 'font-size': size, ...a });
      t.textContent = str;
      return t;
    };
    g.appendChild(mk({ fill: 'none', stroke: INK, 'stroke-width': size * 0.16, 'stroke-linejoin': 'round', 'paint-order': 'stroke' }));
    g.appendChild(mk({ fill: CREAM }));
    overlay.appendChild(g);
    const IN = 0.3, OUT = 0.26;
    tl.add(at, IN, 'outCubic', (p) => {
      g.setAttribute('opacity', p);
      g.setAttribute('transform', `translate(${W / 2} ${H / 2}) scale(${rnd(lerp(1.08, 1, p))}) translate(${-W / 2} ${-H / 2})`);
    });
    tl.add(at + dur - OUT, OUT, 'inOutSine', (p) => g.setAttribute('opacity', 1 - p));
    tl.add(at, dur, 'linear', (p, t) => {
      g.style.display = t >= at - 1e-6 && t < at + dur ? '' : 'none';
    });
  }

  // Trailer captions. Same face, stroke and pop as the closing statement card,
  // just smaller and seated in the lower third so they clear the characters.
  // Every one is placed in a gap between voice lines, never over one:
  //   0.00–2.85  card        2.85–4.95  «يجب علينا أن نجد منزلاً»
  //   4.95–8.50  two cards   8.50–10.0  «ما الذي يحدث؟»
  //   10.0–15.5  two cards   15.5–17.05 «أتيت لتأكلني»
  //   17.05–18.05 (cut)      18.05–19.71 «لدي خطة»
  //   19.95–end  statement card, then the title
  // In the narrated cut these lines are spoken, so putting them on screen as
  // well would have the audience read and hear the same sentence at once.
  const caption = (str, at, dur, size = 72) => {
    if (narrated) return;
    line(str, { at, dur, size, y: H * 0.845 });
  };

  /** A single sheep reacting, framed on the head. */
  async function reaction(sceneName, key, expr, { at, dur, tint = 0.12, pad = 3.1, x = 640, height = 430, flip = false, gaze = [5, -4], lookAngle = 6, speaks = null }) {
    const shot = await makeShot(sceneName, tint);
    const rig = await loadCharacter(key, 'front');
    const holder = svgEl('g');
    holder.appendChild(rig.node);
    shot.camG.appendChild(holder);
    applyExpression(rig, expr);
    // The smallest is drawn in a T-pose; bring his arms down here too.
    if (key === 'small') restArms(rig);
    rig.place({ x, y: 690, height, flip });
    addIdle(rig, holder, tl, { at, dur, phase: 0.37, fidget: 1.0, breath: 1.1 });
    lookTo(rig, tl, { at: at + 0.2, dur: 0.4, angle: lookAngle, gaze });

    // Lip sync last, so the mouth/head channels it writes win over idle.
    const cue = speaks ? cueFor(sync, speaks, at + dur / 2, dur) : null;
    if (cue) addLipSync(rig, tl, cue, FPS);

    const head = rig.part(rig.face.head);
    const r0 = frameOn(head, shot.camG, { pad });
    const r1 = frameOn(head, shot.camG, { pad: pad * 0.88 });
    show(shot, at, dur, 0.2);
    move(shot, at, dur, r0, r1, 'inOutSine');
    commit(shot);
    return { shot, rig, holder };
  }

  /**
   * The eldest laying out his plan — with his brothers, not alone. The two
   * younger ones flank him and turn toward him as he speaks, so the shot reads
   * as a conversation rather than a portrait.
   */
  async function planningShot(sceneName, { at, dur, sync, fps }) {
    const shot = await makeShot(sceneName, 0.14);

    // Younger two first so the eldest sits in front of them.
    const flank = [
      ['mid', 'worried', 388, 372, 0.22, false, 12],
      ['small', 'afraid', 900, 344, 0.66, true, -12],
    ];
    for (const [key, expr, x, height, phase, flip, turn] of flank) {
      const rig = await loadCharacter(key, 'front');
      const holder = svgEl('g');
      holder.appendChild(rig.node);
      shot.camG.appendChild(holder);
      applyExpression(rig, expr);
      if (key === 'small') restArms(rig);
      rig.place({ x, y: 700, height, flip });
      addIdle(rig, holder, tl, { at, dur, phase, fidget: 1.1, breath: 1.05 });
      // They turn in toward him as he starts talking.
      lookTo(rig, tl, { at: at + 0.3, dur: 0.5, angle: turn, gaze: [turn > 0 ? 5 : -5, -2] });
    }

    const big = await loadCharacter('big', 'front');
    const bigHolder = svgEl('g');
    bigHolder.appendChild(big.node);
    shot.camG.appendChild(bigHolder);
    applyExpression(big, 'determined');
    big.place({ x: 640, y: 706, height: 440 });
    addIdle(big, bigHolder, tl, { at, dur, phase: 0.82, fidget: 0.35, breath: 1 });

    const cue = cueFor(sync, 'big', at + dur / 2, dur);
    if (cue) addLipSync(big, tl, cue, fps);

    // Frame the group, not one head.
    show(shot, at, dur, 0.24);
    move(shot, at, dur, view(1.14, 0.5, 0.56), view(1.24, 0.5, 0.54), 'inOutSine');
    commit(shot);
    return shot;
  }

  // ============================================================ BEAT 1
  const meadow = await makeShot('خلفيه 1', 0.06);
  show(meadow, 0, 2.3, 0.01);
  move(meadow, 0, 2.3, view(1.06, 0.48, 0.5), view(1.2, 0.53, 0.53));
  commit(meadow);
  // Held back until the opening shot has landed and the push-in has started.
  caption(COPY.teaser.calm, 0.62, 1.85);

  // ============================================================ BEAT 2
  // Open clearing — deliberately NOT in front of any of the three houses.
  // The brothers walk through frame; the eldest speaks.
  const FIELD_AT = 2.3, FIELD_DUR = 2.8;
  const field = await makeShot('مشهد8', 0.05);
  // Short dissolve: the outgoing meadow is still on screen through the fade,
  // and a long one leaves the entering brothers double-exposed over it.
  show(field, FIELD_AT, FIELD_DUR, 0.14);
  // Camera drifts right with them as they cross, rather than sitting still.
  move(field, FIELD_AT, FIELD_DUR, view(1.22, 0.26, 0.56), view(1.1, 0.38, 0.54));
  commit(field);
  await castBrothersWalking(field.camG, tl, FIELD_AT, FIELD_DUR, sync, FPS);

  // ============================================================ BEAT 3
  let t = FIELD_AT + FIELD_DUR;
  const houseCutsAt = t;
  for (const [scene, cx] of [['مشهد5', 0.52], ['مشهد6', 0.5], ['مشهد7', 0.48]]) {
    const s = await makeShot(scene, 0.05);
    show(s, t, 0.533, 0.1);
    move(s, t, 0.533, view(1.2, cx, 0.54), view(1.32, cx, 0.52), 'outQuad');
    commit(s);
    t += 0.533;
  }
  caption(COPY.teaser.brothers, houseCutsAt + 0.12, 1.42);

  // ============================================================ BEAT 4 — the knock
  const door = await makeShot('مشهد22', 0.74);
  show(door, t, 0.9, 0.12);
  hold(door, t, 0.9, view(1.5, 0.5, 0.5), 1.03);
  commit(door);
  shake(door.shakeG, t + 0.1, 0.32, 14);
  shake(door.shakeG, t + 0.5, 0.3, 11);
  caption(COPY.teaser.knock, t + 0.1, 1.5, 76);
  t += 0.9;

  // ============================================================ BEAT 5 — "what's happening?"
  await reaction('مشهد15', 'mid', 'worried', { at: t, dur: 2.45, pad: 2.5, x: 620, height: 440, gaze: [6, -3], lookAngle: 7, speaks: 'mid' });
  t += 2.45;

  // ============================================================ BEAT 6 — wolf fragments
  const lair = await makeShot('مشهد8', 0.3);
  const wolf = await loadCharacter('wolf', 'side');
  const wolfHolder = svgEl('g');
  wolfHolder.appendChild(wolf.node);
  lair.camG.appendChild(wolfHolder);
  applyExpression(wolf, 'menacing');
  wolf.poseAll({
    [wolf.face.head]: { rotate: 7, pivot: [0.15, 0.9] },
    [wolf.face.armNear]: { rotate: -20, pivot: [0.5, 0.05] },
  });
  wolf.place({ x: 880, y: 690, height: 470, flip: true });

  const WOLF_FROM_X = 110;

  const FRAGMENTS = [
    ['اليد_ق/الكف', 3.4, 0.9],
    ['الراس/الانف', 5.0, 0.9],
    ['الراس/العين/العدسه', 7.0, 1.2],
  ];
  const fragTotal = FRAGMENTS.reduce((a, f) => a + f[2], 0);
  show(lair, t, fragTotal + 2.2, 0.2);
  const fragStart = t;
  // Five seconds with no dialogue at all — the two cards carry it.
  caption(COPY.teaser.lurking, t + 0.25, 1.5);
  caption(COPY.teaser.wolf, t + fragTotal + 0.3, 1.7, 84);
  for (const [part, pad, dur] of FRAGMENTS) {
    const el = wolf.part(part, { optional: true });
    if (!el) continue;
    hold(lair, t, dur, frameOn(el, lair.camG, { pad }), 1.09);
    if (t > fragStart) flashAt(t, 0.09, 0.14);
    t += dur;
  }
  // Payoff: pull out to the whole wolf, prowling forward.
  // Every framing here is measured from his resting pose, but the prowl starts
  // him WOLF_FROM_X to the right of it — so the opening framing is shifted to
  // match, or the camera opens on the patch of grass he has just left.
  const headRect = frameOn(wolf.part('الراس'), lair.camG, { pad: 2.4 });
  headRect.x += WOLF_FROM_X;
  const wideRect = frameOn(wolf.node, lair.camG, { pad: 1.25 });
  wideRect.x += WOLF_FROM_X * 0.3;
  move(lair, t, 2.2, headRect, wideRect, 'inOutCubic');
  commit(lair);
  // Guarded to its own window. Without the guard this applies at p=0 for every
  // earlier frame, shifting the wolf 90 units sideways — which moves him out of
  // the fragment framings that were measured from his resting position, so the
  // snout and eye cuts land on empty grass.
  const prowlAt = t;
  // Full prowl cycle, not just a slide: legs, arms and torso all cycle, so the
  // body reads as walking rather than a rigid drawing being translated.
  tl.add(prowlAt, 2.2, 'linear', (p, time) => {
    if (time < prowlAt - 1e-6) { wolfHolder.setAttribute('transform', 'translate(0 0)'); return; }
  });
  // Stride length has to match ground speed or he cycles his legs on the spot.
  // He is 470 units tall against the eldest sheep's 300, so his stride is
  // correspondingly longer: 150 units of travel is a little over one cycle,
  // not the three the legs were doing before.
  addWalk(wolf, wolfHolder, tl, {
    at: prowlAt, dur: 2.2, fromX: WOLF_FROM_X, toX: -40,
    steps: 1.2, swing: 23, bob: 5.0, rock: 3.0, lean: 2,
    headSwing: 1.4, settle: 0.14,
  });
  t += 2.2;

  // ============================================================ BEAT 7 — "you came to eat us"
  await reaction('مشهد10', 'small', 'terrified', { at: t, dur: 2.1, pad: 2.4, x: 640, height: 400, gaze: [7, -5], lookAngle: -8, speaks: 'small' });
  t += 2.1;

  // ============================================================ BEAT 8 — "I have a plan"
  await planningShot('مشهد17و18', { at: t, dur: 2.6, sync, fps: FPS });
  t += 2.6;

  // ============================================================ BEAT 9 — the question
  const stand = await makeShot('مشهد19', 0.5);
  show(stand, t, 2.5, 0.3);
  move(stand, t, 2.5, view(1.22, 0.55, 0.5), view(1.38, 0.5, 0.52), 'inOutCubic');
  commit(stand);
  line(COPY.teaser.question, { at: t + 0.3, dur: 2.0, size: 78 });
  t += 2.5;

  // ============================================================ TITLE
  flashAt(t - 0.08, 0.28, 0.6);
  const card = await makeShot('خلفيه 1', 0.76);
  show(card, t, 4.4, 0.35);
  move(card, t, 4.4, view(1.3, 0.5, 0.5), view(1.16, 0.5, 0.5));
  commit(card);
  buildTitle(overlay, tl, t + 0.15);

  const duration = t + 4.4;
  tl.reserve(duration);

  return {
    duration, width: W, height: H, audio: `out/${stem}.m4a`,
    seek: (time) => tl.seek(time),
    setTransparent: () => {},
  };
}

// ------------------------------------------------------------------ cast

/** The three brothers walking through the clearing. */
async function castBrothersWalking(parent, tl, at, dur, sync, fps) {
  const g = svgEl('g');
  parent.appendChild(g);

  // Travel left-to-right, staggered, entering from off the left edge — the
  // eldest at the head of the line, the smallest trailing.
  // fidget descends with age. armBase: the smallest is drawn with both arms
  // straight out, so his rest pose has to be swung down before any walk swing.
  const specs = [
    ['small', 316, 236, 0.13, 1.5, -340, [REST_ARMS['اليد_ش'], REST_ARMS['اليد_ي']]],
    ['mid',   470, 268, 0.51, 0.9, -315, [0, 0]],
    ['big',   640, 300, 0.82, 0.4, -292, [0, 0]],
  ];
  for (const [key, x, height, phase, fidget, travel, armBase] of specs) {
    const rig = await loadCharacter(key, 'front');
    const holder = svgEl('g');
    holder.appendChild(rig.node);
    g.appendChild(holder);
    applyExpression(rig, 'neutral');
    buildLimbChains(rig);
    rig.place({ x, y: 664, height });

    // Walk almost the whole shot — the old 22% standing tail was dead screen
    // time. The walk now decelerates into its own stop, so idle only has to
    // catch the last fraction of a second.
    const walkDur = dur * 0.92;
    addWalk(rig, holder, tl, {
      at, dur: walkDur, fromX: travel, toX: 0,
      steps: Math.round(walkDur * 1.7), swing: 24, bob: 4.2, phase, armBase,
      rock: 2.2, lean: 2.5,   // leaning into the direction of travel
      headSwing: 0.9,         // barely there; a walking head should not nod
      preroll: true,          // hold the entry pose through the shot's fade-in
      settle: 0.22,
    });
    addIdle(rig, holder, tl, {
      at: at + walkDur, dur: dur - walkDur, phase, fidget, breath: 1,
    });

    // The eldest delivers the line as they arrive — registered last so the
    // mouth and head it drives override the idle channels.
    if (key === 'big') {
      const cue = cueFor(sync, 'big', at + 1.2, 2.0);
      if (cue) addLipSync(rig, tl, cue, fps);
    }
  }
}

function buildTitle(overlay, tl, at) {
  const g = svgEl('g', { opacity: 0 });
  overlay.appendChild(g);
  const put = (str, y, size, cls) => {
    const mk = (a) => {
      const el = svgEl('text', { x: W / 2, y, 'text-anchor': 'middle', class: cls, 'font-size': size, ...a });
      el.textContent = str;
      return el;
    };
    g.appendChild(mk({ fill: 'none', stroke: INK, 'stroke-width': size * 0.16, 'stroke-linejoin': 'round', 'paint-order': 'stroke' }));
    g.appendChild(mk({ fill: CREAM }));
  };
  put(COPY.titleLine1, 452, 124, 'd');
  put(COPY.titleLine2, 592, 124, 'd');

  const soon = svgEl('text', {
    x: W / 2, y: 738, 'text-anchor': 'middle', class: 't',
    'font-size': 50, fill: '#fff', opacity: 0, 'letter-spacing': 6,
  });
  soon.textContent = COPY.teaser.soon;
  g.appendChild(soon);

  tl.add(at, 0.85, 'outCubic', (p) => {
    g.setAttribute('opacity', p);
    g.setAttribute('transform', `translate(${W / 2} ${H / 2}) scale(${rnd(lerp(1.06, 1, p))}) translate(${-W / 2} ${-H / 2})`);
  });
  tl.add(at + 1.2, 0.7, 'outCubic', (p) => soon.setAttribute('opacity', p * 0.95));
}
