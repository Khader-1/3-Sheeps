// Stage: a 16:9 SVG canvas with layers, a camera, and helpers for pulling in
// the project's scene backgrounds.
//
// The scene artwork is static, so the camera does the cinematography — slow
// push-ins, drifts and whip-pans turn 27 still paintings into shots.

import { svgEl, fetchText, bboxIn } from '../rig.js';

const SVGNS = 'http://www.w3.org/2000/svg';

export const FILM = { width: 1920, height: 1080, fps: 24 };

/** Scene backgrounds, as exported from Moho at 1280×720. */
export const SCENE_DIR = '/assets/incoming/خلفيات/خلفيات svg';
export const SCENE_W = 1280;
export const SCENE_H = 720;

export class Stage {
  constructor({ width = FILM.width, height = FILM.height, background = '#000' } = {}) {
    this.width = width;
    this.height = height;

    this.svg = svgEl('svg', {
      xmlns: SVGNS,
      'xmlns:xlink': 'http://www.w3.org/1999/xlink',
      version: '1.1',
      width,
      height,
      viewBox: `0 0 ${width} ${height}`,
      'shape-rendering': 'geometricPrecision',
    });

    this.defs = document.createElementNS(SVGNS, 'defs');
    this.svg.appendChild(this.defs);

    if (background) {
      this.svg.appendChild(svgEl('rect', { x: 0, y: 0, width, height, fill: background }));
    }

    // camera <- world <- layers. The camera group carries the view transform.
    this.camera = svgEl('g', { id: 'camera' });
    this.svg.appendChild(this.camera);
    this.world = svgEl('g', { id: 'world' });
    this.camera.appendChild(this.world);

    // Overlays (titles, letterbox, fades) sit outside the camera so they are
    // never dragged around by camera moves.
    this.overlay = svgEl('g', { id: 'overlay' });
    this.svg.appendChild(this.overlay);

    this._layers = new Map();
  }

  /** Named layer inside the world, created on first use. Draw order = call order. */
  layer(name) {
    if (!this._layers.has(name)) {
      const g = svgEl('g', { id: name });
      this.world.appendChild(g);
      this._layers.set(name, g);
    }
    return this._layers.get(name);
  }

  /** Mount into the live document — required before any getBBox() call. */
  mount(host = document.getElementById('stage')) {
    host.appendChild(this.svg);
    return this;
  }

  /**
   * Point the camera at a rectangle in world space; it is scaled to fill the
   * frame (cover) and centred. Smaller rect = closer shot.
   */
  look({ x, y, w, h }) {
    const s = Math.max(this.width / w, this.height / h);
    const tx = this.width / 2 - (x + w / 2) * s;
    const ty = this.height / 2 - (y + h / 2) * s;
    this.camera.setAttribute('transform', `translate(${r(tx)} ${r(ty)}) scale(${r(s)})`);
    return this;
  }

  /** Camera rect covering a whole scene background. */
  full() {
    return { x: 0, y: 0, w: SCENE_W, h: SCENE_H };
  }

  /**
   * A framing inside the scene: zoom>1 pushes in, cx/cy are normalised
   * centre coordinates (0.5,0.5 = middle of the scene).
   */
  frame(zoom = 1, cx = 0.5, cy = 0.5) {
    const w = SCENE_W / zoom;
    const h = SCENE_H / zoom;
    return { x: SCENE_W * cx - w / 2, y: SCENE_H * cy - h / 2, w, h };
  }

  /** Full-frame rect for overlay effects. */
  fullFrameRect(attrs = {}) {
    return svgEl('rect', { x: 0, y: 0, width: this.width, height: this.height, ...attrs });
  }

  addDef(node) {
    this.defs.appendChild(node);
    return node;
  }
}

/**
 * Frame a shot on a named rig part — the thing that makes a fragment reveal
 * (a paw, a snout, an eye) cheap to author.
 *
 * Give it the part element and the group whose coordinate space the camera
 * works in; it returns a camera rect containing that part, padded and
 * corrected to the frame's aspect ratio.
 *
 *   const eye = wolf.part('الراس/العين/العدسه');
 *   const r   = frameOn(eye, camG, { pad: 6 });   // extreme close-up
 *
 * @param {SVGGraphicsElement} el       the part to frame
 * @param {SVGGraphicsElement} space    ancestor defining the camera's space
 * @param {object} o
 * @param {number} [o.pad]     multiple of the part's size to include around
 *                             it. 1 = tight crop, 6 = the part fills ~1/6th
 * @param {number} [o.aspect]  frame aspect, defaults to the film's
 * @param {number} [o.biasX]   nudge the framing, in multiples of part width
 * @param {number} [o.biasY]
 * @param {number} [o.minW]    never frame tighter than this, to avoid
 *                             magnifying a tiny part into mush
 */
export function frameOn(el, space, o = {}) {
  const { pad = 3, aspect = FILM.width / FILM.height, biasX = 0, biasY = 0, minW = 90 } = o;
  const b = bboxIn(el, space);

  const cx = b.x + b.width / 2 + b.width * biasX;
  const cy = b.y + b.height / 2 + b.height * biasY;

  // Grow the part's box by `pad`, then expand to the frame aspect so nothing
  // is cropped off the axis that happens to be tighter.
  let w = Math.max(b.width * pad, minW);
  let h = Math.max(b.height * pad, minW / aspect);
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;

  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** Camera rect containing several parts at once (e.g. both eyes). */
export function frameOnAll(els, space, o = {}) {
  const boxes = els.filter(Boolean).map((e) => bboxIn(e, space));
  if (!boxes.length) throw new Error('frameOnAll: no elements');
  const x1 = Math.min(...boxes.map((b) => b.x));
  const y1 = Math.min(...boxes.map((b) => b.y));
  const x2 = Math.max(...boxes.map((b) => b.x + b.width));
  const y2 = Math.max(...boxes.map((b) => b.y + b.height));
  const fake = { getBBox: () => ({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 }), getScreenCTM: () => space.getScreenCTM() };
  return frameOn(fake, space, o);
}

/** Convert a camera rect into the transform that realises it (cover fit). */
export function camTransform(rect, width = FILM.width, height = FILM.height) {
  const s = Math.max(width / rect.w, height / rect.h);
  const tx = width / 2 - (rect.x + rect.w / 2) * s;
  const ty = height / 2 - (rect.y + rect.h / 2) * s;
  return `translate(${r(tx)} ${r(ty)}) scale(${r(s)})`;
}

/** Interpolate between two camera rects. */
export function lerpRect(a, b, p) {
  return {
    x: a.x + (b.x - a.x) * p,
    y: a.y + (b.y - a.y) * p,
    w: a.w + (b.w - a.w) * p,
    h: a.h + (b.h - a.h) * p,
  };
}

const sceneCache = new Map();

/**
 * Load a scene background by file name (without .svg) and return a <g>
 * containing its artwork, positioned in the 1280×720 scene space.
 */
export async function loadScene(name) {
  if (!sceneCache.has(name)) {
    sceneCache.set(name, fetchText(`${SCENE_DIR}/${encodeURIComponent(name)}.svg`));
  }
  // Moho leaves empty placeholder paths behind — <path ... d="Z"/>, geometry
  // that closes a subpath that was never opened. They draw nothing, but Chrome
  // logs "Expected moveto path command" for each one as the attribute is set,
  // which buries real errors under noise. The strip has to happen on the text:
  // by the time the nodes exist the browser has already complained.
  const text = (await sceneCache.get(name)).replace(/<path\b[^>]*\sd="Z"\s*\/>\s*/g, '');
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const src = doc.documentElement;

  const g = svgEl('g', { 'data-scene': name });
  // Carry defs/styles across: the Illustrator-authored art paints via class
  // rules and clip paths, and renders black without them.
  for (const node of src.querySelectorAll(':scope > defs, :scope > style')) {
    g.appendChild(document.importNode(node, true));
  }
  for (const node of [...src.children]) {
    const tag = node.tagName.toLowerCase();
    if (tag === 'defs' || tag === 'style') continue;
    g.appendChild(document.importNode(node, true));
  }

  // Moho exports declare px dimensions; normalise anything that is not the
  // expected 1280×720 so every scene shares one coordinate space.
  const vb = src.getAttribute('viewBox');
  let sw = parseFloat(src.getAttribute('width')) || SCENE_W;
  let sh = parseFloat(src.getAttribute('height')) || SCENE_H;
  if (vb) {
    const p = vb.trim().split(/[\s,]+/).map(Number);
    if (p.length === 4) { sw = p[2]; sh = p[3]; }
  }
  if (Math.abs(sw - SCENE_W) > 1 || Math.abs(sh - SCENE_H) > 1) {
    const s = Math.max(SCENE_W / sw, SCENE_H / sh);
    g.setAttribute('transform', `scale(${r(s)})`);
  }

  return g;
}

const r = (n) => Math.round(n * 10000) / 10000;
