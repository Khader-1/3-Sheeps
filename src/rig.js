// rig.js — load Moho-exported character SVGs and make them posable.
//
// The Moho exports are unusually clean: nested <g id="…"> with plain <path>
// children, no defs, no gradients, no existing transforms. Two things need
// handling: IDs are duplicated across siblings (الكف appears in every limb),
// and limb parts are siblings rather than a parent chain, so rotating a
// shoulder does not carry the forearm with it.
//
// Parts are therefore addressed by structural path ("اليد_ش/الكف"), and
// chain() re-parents a limb into a real bone chain.
//
// Poses are emitted as plain SVG 1.1 transform attributes rather than CSS
// transform-box, so the serialized SVG opens correctly in Illustrator and
// Inkscape, not just Chrome.

import { asset } from './base.js';

const SVGNS = 'http://www.w3.org/2000/svg';

let uid = 0;

/** Parse SVG source text into a detached <svg> element. */
export function parseSvg(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const err = doc.querySelector('parsererror');
  if (err) throw new Error('SVG parse failed: ' + err.textContent.slice(0, 200));
  return doc.documentElement;
}

/** Direct child <g> elements. */
const childGroups = (el) => [...el.children].filter((c) => c.tagName === 'g');

export class Rig {
  /**
   * @param {string} text      raw SVG source
   * @param {object} opts
   * @param {string} opts.view id of the view group to extract (e.g. "من_المام").
   *                           Falls back to the first top-level group.
   * @param {string} opts.name short latin name, used to namespace IDs
   */
  constructor(text, { view, name = 'rig' } = {}) {
    const root = parseSvg(text);
    const views = childGroups(root);

    let node = view ? views.find((g) => g.getAttribute('id') === view) : null;
    if (!node) {
      if (view) {
        const have = views.map((g) => g.getAttribute('id')).join(', ');
        throw new Error(`view "${view}" not found in ${name}. Available: ${have}`);
      }
      node = views[0];
    }

    this.name = name;
    this.prefix = `${name}-${++uid}`;
    this.node = node.cloneNode(true);
    this.node.setAttribute('id', this.prefix);

    this.#namespaceIds();
    this.#index();
  }

  // Moho emits duplicate IDs. Rewrite them so several characters can coexist
  // in one document without colliding. There are no internal url(#…) or href
  // references in these files, but namespacing keeps the DOM valid regardless.
  #namespaceIds() {
    let n = 0;
    for (const el of this.node.querySelectorAll('[id]')) {
      el.setAttribute('data-part', el.getAttribute('id'));
      el.setAttribute('id', `${this.prefix}-${++n}`);
    }
  }

  // Build "path/to/part" -> element. Duplicate sibling names get #2, #3 …
  #index() {
    this.map = new Map();
    const walk = (el, path) => {
      const seen = new Map();
      for (const g of childGroups(el)) {
        const raw = g.getAttribute('data-part') || '?';
        const k = (seen.get(raw) || 0) + 1;
        seen.set(raw, k);
        const key = path ? `${path}/${raw}` : raw;
        const keyed = k > 1 ? `${key}#${k}` : key;
        if (!this.map.has(keyed)) this.map.set(keyed, g);
        walk(g, keyed);
      }
    };
    walk(this.node, '');
    return this.map;
  }

  /** All indexed part paths — useful for discovery. */
  paths() {
    return [...this.map.keys()];
  }

  /**
   * Resolve a part. Accepts an exact path, or a bare part name which matches
   * the first path ending in that name.
   */
  part(path, { optional = false } = {}) {
    if (this.map.has(path)) return this.map.get(path);
    for (const [k, v] of this.map) {
      if (k === path || k.endsWith('/' + path)) return v;
    }
    if (optional) return null;
    throw new Error(`part "${path}" not found on ${this.name}`);
  }

  /** Every part whose path ends with the given name. */
  all(name) {
    return [...this.map.entries()]
      .filter(([k]) => k === name || k.endsWith('/' + name))
      .map(([, v]) => v);
  }

  /**
   * Re-parent sibling limb parts into a bone chain so rotating the root
   * carries its children. order is proximal -> distal, e.g.
   * chain('اليد_ش', ['الكتف_ش', 'الساعد', 'الكف'])
   */
  chain(groupPath, order) {
    const group = this.part(groupPath);
    const els = order.map((n) => {
      const hit = childGroups(group).find((g) => g.getAttribute('data-part') === n);
      if (!hit) throw new Error(`chain: "${n}" not a child of ${groupPath}`);
      return hit;
    });
    // Nest distal into proximal, deepest last so z-order is preserved by
    // re-appending in the original draw order within each level.
    for (let i = els.length - 1; i > 0; i--) els[i - 1].appendChild(els[i]);
    group.appendChild(els[0]);
    this.#index();
    return this;
  }

  /**
   * Wrap a set of sibling groups into a new named group so they can be posed
   * as a unit. Moho left the middle sheep's head parts ungrouped, so the head
   * has to be assembled before it can be tilted.
   * Insert position follows the first target, preserving z-order.
   */
  group(name, names, { parent = null } = {}) {
    const host = parent ? this.part(parent) : this.node;
    const kids = childGroups(host);
    const targets = [];
    for (const n of names) {
      const hit = kids.find((g) => g.getAttribute('data-part') === n && !targets.includes(g));
      if (hit) targets.push(hit);
    }
    if (!targets.length) throw new Error(`group(${name}): none of [${names}] found`);

    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('data-part', name);
    g.setAttribute('id', `${this.prefix}-g-${name}`);
    host.insertBefore(g, targets[0]);
    for (const t of targets) g.appendChild(t);
    this.#index();
    return this;
  }

  /** True if a part path resolves. */
  has(path) {
    return !!this.part(path, { optional: true });
  }

  /**
   * Pose a part.
   * @param {string} path
   * @param {object} t
   * @param {number} [t.rotate]  degrees, clockwise
   * @param {number} [t.x]       translate after rotation, user units
   * @param {number} [t.y]
   * @param {number} [t.scale]   uniform scale about the pivot
   * @param {number} [t.scaleX]
   * @param {number} [t.scaleY]
   * @param {[number,number]} [t.pivot] normalized within the part bbox.
   *                                    [0.5,0] = top-centre (a shoulder),
   *                                    [0.5,1] = bottom-centre (a foot).
   */
  pose(path, t = {}) {
    const el = this.part(path);
    const {
      rotate = 0, x = 0, y = 0,
      scale, scaleX = scale ?? 1, scaleY = scale ?? 1,
      pivot = [0.5, 0.5],
    } = t;

    const b = el.getBBox();
    const px = b.x + b.width * pivot[0];
    const py = b.y + b.height * pivot[1];

    const ops = [];
    if (x || y) ops.push(`translate(${r(x)} ${r(y)})`);
    if (rotate || scaleX !== 1 || scaleY !== 1) {
      ops.push(`translate(${r(px)} ${r(py)})`);
      if (rotate) ops.push(`rotate(${r(rotate)})`);
      if (scaleX !== 1 || scaleY !== 1) ops.push(`scale(${r(scaleX)} ${r(scaleY)})`);
      ops.push(`translate(${r(-px)} ${r(-py)})`);
    }

    if (ops.length) el.setAttribute('transform', ops.join(' '));
    else el.removeAttribute('transform');
    return this;
  }

  /** Apply a map of { partPath: transform }. */
  poseAll(spec) {
    for (const [k, v] of Object.entries(spec)) this.pose(k, v);
    return this;
  }

  /** Hide a part (kept in the DOM so the file stays editable). */
  hide(path) {
    const el = this.part(path, { optional: true });
    if (el) el.setAttribute('display', 'none');
    return this;
  }

  /**
   * Queue work that can only run once the rig is in the live document.
   *
   * Anything that measures geometry — and art corrections do, because they are
   * sized from the part they replace — reads zeros on a detached node. Rather
   * than make every caller remember to attach first, the work is queued here
   * and flushed by the first call that requires a live node.
   */
  whenLive(fn) {
    (this._pending ||= []).push(fn);
    return this;
  }

  /** Run queued work. Idempotent; safe to call from any measuring method. */
  ready() {
    if (!this._pending || this._live) return this;
    this._live = true;                 // set first: a task may call ready()
    for (const fn of this._pending) fn(this);
    this._pending = null;
    return this;
  }

  /** Bounding box of the whole rig, in its own coordinate space. */
  bbox() {
    this.ready();
    return this.node.getBBox();
  }

  /**
   * Place the rig in the parent document: scale so the rig is `height` units
   * tall, then position its bottom-centre at (x, y).
   */
  place({ x, y, height, flip = false, rotate = 0 }) {
    this.ready();
    const b = this.bbox();
    const s = height / b.height;
    const ops = [
      `translate(${r(x)} ${r(y)})`,
      rotate ? `rotate(${r(rotate)})` : '',
      `scale(${r(flip ? -s : s)} ${r(s)})`,
      `translate(${r(-(b.x + b.width / 2))} ${r(-(b.y + b.height))})`,
    ].filter(Boolean);
    this.node.setAttribute('transform', ops.join(' '));
    return this;
  }
}

const r = (n) => Math.round(n * 1000) / 1000;

/**
 * Bounding box of `el` expressed in `ancestor`'s user coordinate system, with
 * every intermediate transform applied.
 *
 * getBBox() alone ignores the element's own transform and every parent's, so
 * it cannot answer "where is this paw actually sitting in the scene?" — which
 * is exactly what framing a shot on a body part requires.
 *
 * Both elements must be in the live document.
 */
export function bboxIn(el, ancestor) {
  const b = el.getBBox();
  const m = ancestor.getScreenCTM().inverse().multiply(el.getScreenCTM());
  const pts = [
    [b.x, b.y], [b.x + b.width, b.y],
    [b.x, b.y + b.height], [b.x + b.width, b.y + b.height],
  ].map(([x, y]) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Create an SVG element with attributes. */
export function svgEl(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) el.setAttribute(k, String(v));
  }
  for (const k of kids) if (k) el.appendChild(k);
  return el;
}

export async function fetchText(url) {
  // Root-relative paths are resolved against the site root rather than the
  // server root — see src/base.js. Every artwork and font load in the project
  // funnels through here, so this is the one place it needs doing.
  const u = asset(url);
  const res = await fetch(u);
  if (!res.ok) throw new Error(`${res.status} loading ${u}`);
  return res.text();
}
