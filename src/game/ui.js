// Shared shell for the mini games.
//
// Every game gets the same context: a 1280×720 SVG with fixed layers, the
// film's sound effects, the film's voice recordings, and a small set of UI
// primitives drawn in the same flat cartoon language as the artwork.
//
// The important part is teardown. Each game registers its animation loops,
// timers and audio here rather than owning them, so the menu can stop a game
// cleanly — a stray rAF loop from a previous game repainting over the next one
// is the classic way a menu-driven set of games falls apart.

import { asset } from '../base.js';
import { svgEl } from '../rig.js';
import { loadScene } from '../anim/stage.js';

// The design box. Every game is authored in these coordinates and all of it is
// guaranteed visible on any screen — nothing is ever cropped.
export const W = 1280;
export const H = 720;

/**
 * The visible area, in design coordinates.
 *
 * The viewBox is grown from the design box to match the window's aspect
 * exactly, so there are never letterbox bars: on a wide screen it extends
 * sideways, on a tall one it extends up and down, and the 1280x720 box stays
 * centred inside it. `view` is what the UI anchors to — banners to its top,
 * buttons to its bottom, the back chip to its corner — which is what makes the
 * layout work at 21:9 and in portrait without a separate design for each.
 */
export const view = { x: 0, y: 0, w: W, h: H, left: 0, right: W, top: 0, bottom: H };

/**
 * Where UI is allowed to live — `view`, clamped.
 *
 * The background should fill whatever shape the screen is, but the interface
 * should not: on a phone held upright the visible box is nearly four times as
 * tall as the design, and anchoring a title to its top edge threw the title
 * most of a screen away from the game. The band keeps controls in a
 * comfortable frame around the design box however extreme the window gets.
 */
export const band = { x: 0, y: 0, w: W, h: H, left: 0, right: W, top: 0, bottom: H };

const MAX_BAND_W = W * 1.5;
const MAX_BAND_H = H * 1.2;

const viewListeners = new Set();

export function onViewChange(fn) {
  viewListeners.add(fn);
  return () => viewListeners.delete(fn);
}

/** Recompute `view` from the host's real size and apply it to the svg. */
export function applyView(svg, host) {
  const r = host.getBoundingClientRect();
  const aspect = (r.width || W) / (r.height || H);
  const w = aspect > W / H ? H * aspect : W;
  const h = aspect > W / H ? H : W / aspect;
  Object.assign(view, {
    x: (W - w) / 2, y: (H - h) / 2, w, h,
    left: (W - w) / 2, right: (W + w) / 2,
    top: (H - h) / 2, bottom: (H + h) / 2,
  });
  const bw = Math.min(view.w, MAX_BAND_W);
  const bh = Math.min(view.h, MAX_BAND_H);
  Object.assign(band, {
    x: (W - bw) / 2, y: (H - bh) / 2, w: bw, h: bh,
    left: (W - bw) / 2, right: (W + bw) / 2,
    top: (H - bh) / 2, bottom: (H + bh) / 2,
  });

  svg.setAttribute('viewBox', `${rnd(view.x)} ${rnd(view.y)} ${rnd(view.w)} ${rnd(view.h)}`);
  for (const fn of viewListeners) fn(view);
}

/**
 * Sit the world on the bottom of the screen.
 *
 * Games are drawn with their ground line inside the 1280x720 box. Once the
 * visible area is taller than that — a phone held upright is nearly four times
 * as tall — the ground ends up across the middle of the screen and everything
 * standing on it appears to float, with the fire and the falling rocks halfway
 * up in mid air.
 *
 * So the scene and everything in it is scaled to fit the WIDTH and pinned to
 * the bottom. Scaling to cover instead would keep the frame full but at almost
 * four times zoom, which is unplayable; pinning to the bottom keeps the action
 * where a player expects it and leaves the spare room above, which the
 * backdrop fills.
 */
/** True when the window is much taller than the design — a phone upright. */
export const isTall = () => view.h > H * 1.5;

export function fitGround(layers, { align = 0.5 } = {}) {
  const s = view.w / W;
  // Centred, not floor-pinned. Pinning kept the ground at the very bottom of
  // a tall screen, which left the game hugging the edge under a large empty
  // band — centring balances it, and since the scene and everything standing
  // in it move together the characters stay on the ground either way.
  const ty = view.y + (view.h - H * s) * align;
  const t = `translate(${rnd(view.x)} ${rnd(ty)}) scale(${rnd(s)})`;
  for (const k of ['bg', 'world', 'fx']) layers[k]?.setAttribute('transform', t);
  return s;
}

/** Where the ground now sits, in the untransformed coordinates UI uses. */
export function groundTop(align = 0.5) {
  const s = view.w / W;
  return view.y + (view.h - H * s) * align;
}

/**
 * Scale a background so it covers the whole visible area.
 *
 * Scenes are painted for the 1280x720 box. Once the viewBox is wider or taller
 * than that, the painting has to grow to reach the new edges or the screen
 * shows page colour beside it.
 */
export function coverView(node) {
  const s = Math.max(view.w / W, view.h / H);
  node.setAttribute('transform',
    `translate(${rnd(W / 2)} ${rnd(H / 2)}) scale(${rnd(s)}) translate(${rnd(-W / 2)} ${rnd(-H / 2)})`);
}
export const INK = '#2a1608';
export const CREAM = '#FFF6DC';
export const GREEN = '#7ac043';
export const RED = '#c0392b';

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const rnd = (n) => Math.round(n * 100) / 100;

const SFX_NAMES = ['knock', 'growl', 'whoosh', 'impact', 'step-grass', 'chirp', 'breath',
  // The wolf's two outcomes, recorded rather than synthesised: he laughs
  // when he wins and cries when he does not.
  'wolf-laugh', 'wolf-cry'];

/** Build the stage once; the menu reuses it for every game. */
export function makeStage(host) {
  const svg = svgEl('svg', {
    xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${W} ${H}`,
    id: 'game', preserveAspectRatio: 'xMidYMid meet',
  });
  host.appendChild(svg);

  // Track the window: the viewBox follows the real aspect, so a resize or a
  // rotation re-lays-out rather than letterboxing.
  applyView(svg, host);
  const relayout = () => applyView(svg, host);
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', relayout);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', relayout);

  const layers = {};
  // `backdrop` sits behind everything and is never transformed with the world:
  // it fills whatever shape the screen is, so the fitted scene in front of it
  // never leaves bare page colour on a tall phone.
  for (const name of ['backdrop', 'bg', 'world', 'fx', 'ui']) {
    layers[name] = svgEl('g', { id: `layer-${name}` });
    svg.appendChild(layers[name]);
  }

  const sfx = {};
  for (const n of SFX_NAMES) {
    const a = new Audio(asset(`assets/audio/sfx/${n}.wav`));
    a.preload = 'auto';
    sfx[n] = a;
  }

  return { svg, layers, sfx };
}

export const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); };

/**
 * A running game. Owns everything that has to be stopped when it exits.
 */
export class GameContext {
  constructor(stage, onQuit) {
    this.svg = stage.svg;
    this.layers = stage.layers;
    this._sfx = stage.sfx;
    this._loops = new Set();
    this._timers = new Set();
    this._audio = new Set();
    this._onQuit = onQuit;
    this.dead = false;
  }

  // ---- lifecycle ----------------------------------------------------
  /** rAF loop. fn(dt, t) runs until it returns false or the game is torn down. */
  loop(fn) {
    let last = performance.now();
    const id = { raf: 0 };
    const step = (now) => {
      if (this.dead) return;
      const dt = Math.min(0.05, (now - last) / 1000);   // clamp after a tab switch
      last = now;
      if (fn(dt, now) === false) { this._loops.delete(id); return; }
      id.raf = requestAnimationFrame(step);
    };
    id.raf = requestAnimationFrame(step);
    this._loops.add(id);
    return () => { cancelAnimationFrame(id.raf); this._loops.delete(id); };
  }

  after(ms, fn) {
    const id = setTimeout(() => { this._timers.delete(id); if (!this.dead) fn(); }, ms);
    this._timers.add(id);
    return id;
  }

  destroy() {
    this.dead = true;
    for (const l of this._loops) cancelAnimationFrame(l.raf);
    for (const t of this._timers) clearTimeout(t);
    for (const a of this._audio) { try { a.pause(); a.currentTime = 0; } catch { /* gone */ } }
    this._loops.clear(); this._timers.clear(); this._audio.clear();
    this._offView?.();
    for (const k of Object.keys(this.layers)) {
      clear(this.layers[k]);
      this.layers[k].removeAttribute('transform');
    }
  }

  quit() { this._onQuit(); }

  // ---- audio ----------------------------------------------------------
  play(name, volume = 0.6) {
    const src = this._sfx[name];
    if (!src) return null;
    const a = src.cloneNode();
    a.volume = volume;
    this._audio.add(a);
    a.addEventListener('ended', () => this._audio.delete(a));
    a.play().catch(() => {});    // blocked until the first user gesture
    return a;
  }

  /**
   * Play one of the project's voice recordings.
   *
   * The paths are Arabic and contain spaces, so each segment is encoded.
   * `maxSec` stops long takes: several recordings run past ten seconds, which
   * is far too long to hold a child at a quiz prompt.
   */
  voice(path, { volume = 1, maxSec = 6, onEnd } = {}) {
    const url = asset('assets/audio/صوتيات/' + path.split('/').map(encodeURIComponent).join('/'));
    const a = new Audio(url);
    a.volume = volume;
    this._audio.add(a);
    const finish = () => { this._audio.delete(a); onEnd?.(); };
    a.addEventListener('ended', finish);
    if (maxSec) this.after(maxSec * 1000, () => { if (!a.paused) { a.pause(); finish(); } });
    a.play().catch(() => {});
    return { stop: () => { a.pause(); this._audio.delete(a); } };
  }

  // ---- drawing --------------------------------------------------------
  /**
   * Load a scene into the background, plus a backdrop copy behind it.
   *
   * The backdrop is the same painting scaled to COVER and darkened. It exists
   * so a tall or very wide screen never shows bare page colour beside the
   * fitted scene, and because it is the same artwork it always matches — no
   * colour has to be guessed.
   */
  async scene(name, { backdrop = true } = {}) {
    const g = await loadScene(name);
    this.layers.bg.appendChild(g);

    if (backdrop) {
      // A plain panel, not a zoomed copy of the scene.
      //
      // Filling the spare space with the same painting scaled up put a giant
      // second house above and below the small one, and it read as three
      // stacked pictures rather than as a background. A 16:9 game on a phone
      // held upright cannot fill the screen without cropping most of its
      // width, so the surround should look deliberate instead of pretending
      // not to be there.
      const pad = svgEl('rect', { fill: '#16220f' });
      const vig = svgEl('ellipse', { fill: '#000', opacity: 0.28 });
      this.layers.backdrop.appendChild(pad);
      this.layers.backdrop.appendChild(vig);

      // A soft edge around the play area, so it reads as a framed screen.
      const frame = svgEl('rect', {
        fill: 'none', stroke: '#0b1207', 'stroke-width': 10, rx: 14, opacity: 0.5,
      });
      this.layers.backdrop.appendChild(frame);

      const fit = () => {
        for (const [k, v] of [['x', view.x], ['y', view.y], ['width', view.w], ['height', view.h]]) {
          pad.setAttribute(k, v);
        }
        vig.setAttribute('cx', W / 2); vig.setAttribute('cy', H / 2);
        vig.setAttribute('rx', view.w * 0.75); vig.setAttribute('ry', view.h * 0.75);

        const sc = view.w / W;
        const fx = view.x;
        const fy = view.y + (view.h - H * sc) / 2;
        frame.setAttribute('x', fx); frame.setAttribute('y', fy);
        frame.setAttribute('width', view.w); frame.setAttribute('height', H * sc);
      };
      fit();
      this._offView = onViewChange(fit);
    }
    return g;
  }

  ui(node) { this.layers.ui.appendChild(node); return node; }
  clearUi() { clear(this.layers.ui); }
}

// ---- primitives --------------------------------------------------------

export function panel(x, y, w, h, { fill = CREAM, opacity = 0.96, rx = 22 } = {}) {
  return svgEl('rect', { x, y, width: w, height: h, rx, fill, opacity, stroke: INK, 'stroke-width': 5 });
}

export function label(text, x, y, { size = 34, fill = INK, weight = 700, anchor = 'middle' } = {}) {
  const t = svgEl('text', {
    x, y, 'text-anchor': anchor, fill, 'font-size': size,
    // Baloo Bhaijaan 2 — rounder and heavier than Cairo, and the games want
    // to read as a toy rather than a document. Cairo is still the text face
    // for the poster credits, where it has to stay quiet.
    'font-family': "'Poster Display', sans-serif", 'font-weight': weight,
    direction: 'rtl', 'unicode-bidi': 'isolate',
  });
  t.textContent = text;
  return t;
}

export function button(ctx, text, x, y, w, h, onClick, { fill = CREAM, size = 34, sound = 'knock' } = {}) {
  const g = svgEl('g', { class: 'btn', cursor: 'pointer' });
  g.appendChild(panel(x, y, w, h, { fill }));
  g.appendChild(label(text, x + w / 2, y + h / 2 + size * 0.35, { size }));
  g.addEventListener('click', () => {
    if (ctx.dead) return;
    if (sound) ctx.play(sound, 0.35);
    onClick();
  });
  return g;
}

/** Dim scrim covering the whole visible area, not just the design box. */
export function scrim(opacity = 0.62) {
  return svgEl('rect', {
    x: view.x, y: view.y, width: view.w, height: view.h, fill: '#0d0803', opacity,
  });
}

/** A small "back to the menu" chip, top-left, present in every game. */
export function backChip(ctx) {
  // Anchored to the visible corner, not the design box, so it is never pushed
  // off a wide screen or hidden under browser chrome on a phone.
  return button(ctx, '‹ القائمة', band.left + 24, band.top + 20, 168, 60,
    () => ctx.quit(), { size: 28, sound: null });
}

/** Short banner across the top of a game. */
export function banner(text, { size = 36, y = null, h = 74, w = 620 } = {}) {
  const top = y == null ? band.top + 20 : y;
  const g = svgEl('g');
  g.appendChild(panel(W / 2 - w / 2, top, w, h));
  g.appendChild(label(text, W / 2, top + h / 2 + size * 0.35, { size }));
  return g;
}
