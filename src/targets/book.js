// The picture book — one SVG per page.
//
// Same staging technique as the poster: the backgrounds are empty sets, so the
// characters are loaded as rigs, posed, and placed into the scene's own 1280×720
// coordinate space. Pages are 16:9 like the film, which means the artwork is
// used at its native aspect with nothing cropped.
//
// Text is drawn in <foreignObject> rather than <text>. SVG text does not wrap,
// and Arabic needs both wrapping and RTL — the browser does both correctly in
// HTML, and the output here is an HTML document, so there is no reason to
// hand-roll line breaking.
//
// tools/book.mjs drives this and writes out/book.html.

import { svgEl, fetchText, bboxIn } from '../rig.js';
import { loadScene } from '../anim/stage.js';
import { loadCharacter, applyExpression, restArms } from '../expressions.js';
import { PAGES, BOOK } from '../book/pages.js';
import { blow, flames, motionLines } from '../book/effects.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const XHTML = 'http://www.w3.org/1999/xhtml';
const W = BOOK.width;
const H = BOOK.height;

const CREAM = '#FFF6DC';
const INK = '#241606';

/** A <foreignObject> holding one styled HTML block — used for all page text. */
function textBox({ x, y, w, h, html, cls }) {
  const fo = svgEl('foreignObject', { x, y, width: w, height: h });
  const div = document.createElementNS(XHTML, 'div');
  div.setAttribute('class', cls);
  div.setAttribute('xmlns', XHTML);
  div.innerHTML = html;
  fo.appendChild(div);
  return fo;
}

const CARD_W = 520;
const CARD_H = 128;
const CARD_M = 46;

/** The four corner slots a narration card can occupy. */
function slotRect(where) {
  return {
    x: where.endsWith('l') ? CARD_M : W - CARD_W - CARD_M,
    y: where.startsWith('t') ? CARD_M : H - CARD_H - CARD_M,
    width: CARD_W, height: CARD_H,
  };
}

const overlap = (a, b) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

/**
 * Pick the corner that covers the least of what matters.
 *
 * Hand-placed cards kept landing on a character's face, and every time a
 * character moved the card had to be re-checked by eye. This scores each of
 * the four corners against the boxes of everything already drawn — the cast
 * and any speech bubbles — and takes the cheapest.
 *
 * Bottom corners get a small head start: text below the picture is the
 * storybook convention, and the top of a frame usually holds the sky, which
 * is the one place a card is never wanted to cover a horizon line.
 */
function bestCorner(obstacles) {
  const bias = { bl: 0, br: 0, tl: 2600, tr: 2600 };
  let best = 'bl';
  let bestScore = Infinity;
  for (const where of ['bl', 'br', 'tl', 'tr']) {
    const r = slotRect(where);
    let score = bias[where];
    for (const o of obstacles) score += overlap(r, o) * (o.weight || 1);
    if (score < bestScore) { bestScore = score; best = where; }
  }
  return best;
}

/** Rounded card carrying a line of narration. */
function narrationCard(text, where) {
  const w = CARD_W;
  const h = CARD_H;
  const { x, y } = slotRect(where);

  const g = svgEl('g', { 'data-part': 'نص' });
  g.appendChild(svgEl('rect', {
    x, y, width: w, height: h, rx: 26,
    fill: CREAM, stroke: INK, 'stroke-width': 4, opacity: 0.97,
  }));
  g.appendChild(textBox({
    x: x + 22, y: y + 16, w: w - 44, h: h - 32,
    cls: 'narr', html: `<p>${text}</p>`,
  }));
  return g;
}

/**
 * A comic speech bubble with a tail.
 *
 * Height is estimated from the character count rather than measured: the box
 * is generous and the text is vertically centred inside it, so a one-line
 * bubble and a two-line bubble both sit correctly without a measure pass.
 */
function bubble({ x, y, w, text, tail }) {
  const lines = Math.max(1, Math.ceil(text.length / Math.floor(w / 21)));
  const h = 40 + lines * 46;
  const left = x - w / 2;

  const g = svgEl('g', { 'data-part': 'فقاعة' });
  if (tail) {
    const [tx, ty] = tail;
    const baseY = y + h;
    g.appendChild(svgEl('path', {
      d: `M ${x - 34} ${baseY - 8} L ${tx} ${ty} L ${x + 26} ${baseY - 8} Z`,
      fill: '#fff', stroke: INK, 'stroke-width': 4, 'stroke-linejoin': 'round',
    }));
  }
  g.appendChild(svgEl('rect', {
    x: left, y, width: w, height: h, rx: 30,
    fill: '#fff', stroke: INK, 'stroke-width': 4,
  }));
  g.appendChild(textBox({
    x: left + 18, y: y + 10, w: w - 36, h: h - 20,
    cls: 'bub', html: `<p>${text}</p>`,
  }));
  return g;
}

/** Slanted rain streaks plus a lightning wash, for the storm page. */
function storm(g) {
  const rain = svgEl('g', { opacity: 0.5 });
  // Deterministic scatter — no Math.random, so the page is reproducible.
  for (let i = 0; i < 190; i++) {
    const h1 = Math.sin(i * 12.9898) * 43758.5453;
    const h2 = Math.sin(i * 78.233) * 12345.6789;
    const x = ((h1 - Math.floor(h1)) * (W + 260)) - 200;
    const y = (h2 - Math.floor(h2)) * H;
    const len = 26 + ((h1 * 7) % 1) * 30;
    rain.appendChild(svgEl('line', {
      x1: x, y1: y, x2: x + len * 0.42, y2: y + len,
      stroke: '#cfe6ff', 'stroke-width': 2.1, 'stroke-linecap': 'round',
    }));
  }
  // Bolt first, rain over it — a bolt drawn on top of everything reads as a
  // sticker rather than as light in the scene.
  g.appendChild(svgEl('path', {
    d: 'M 902 30 L 872 214 L 916 210 L 884 388 L 964 196 L 916 200 L 952 34 Z',
    fill: '#fff6c9', stroke: '#fffdf0', 'stroke-width': 2, opacity: 0.8,
  }));
  g.appendChild(rain);
}


/**
 * Place a character relative to a house in the set, instead of by hand.
 *
 * The sets name their buildings — بيت_قش_من_الجمب, خشب_حطام, بيت_طوب_جاهز —
 * so the house can be found and measured, and the wolf sized as a fraction of
 * it and stood beside it facing in. Hand-placed coordinates were guesswork
 * against art nobody measured: he ended up taller than the cottage he was
 * threatening, and twice on the wrong side of it entirely.
 *
 * Returns the arguments for rig.place().
 */
function placeByHouse(rig, world, svg, spec) {
  const { match, frac = 0.66, gap = 40, side, height: fixedHeight } = spec;
  const houseEl = [...world.querySelectorAll('g[id]')]
    .find((g) => (g.getAttribute('id') || '').includes(match));
  if (!houseEl) {
    console.warn(`placeByHouse: no group matching "${match}"`);
    return null;
  }

  const hb = bboxIn(houseEl, svg);
  const rb = rig.bbox();
  // A fraction works when the reference is a building. Some references are
  // not — a heap of collapsed timber is knee-high, and any fraction of it
  // makes a toy wolf — so those give an explicit height and use the match
  // only for where he stands.
  const height = fixedHeight ?? hb.height * frac;
  const width = height * (rb.width / rb.height);

  // Stand on whichever side has room for him; ties go to the right.
  const use = side || ((W - (hb.x + hb.width)) >= hb.x ? 'right' : 'left');
  let x = use === 'right'
    ? hb.x + hb.width + gap + width / 2
    : hb.x - gap - width / 2;
  x = Math.max(width / 2 + 16, Math.min(W - width / 2 - 16, x));

  return {
    x,
    y: hb.y + hb.height,       // his feet meet the house's own ground line
    height,
    flip: use === 'right',     // standing right of it means facing left, into it
  };
}

async function buildPage(spec) {
  const svg = svgEl('svg', {
    xmlns: SVGNS, 'xmlns:xlink': 'http://www.w3.org/1999/xlink',
    viewBox: `0 0 ${W} ${H}`, width: W, height: H,
    'data-page': spec.id, class: 'page',
  });
  document.getElementById('stage').appendChild(svg);

  // Scene, scaled up slightly when a page asks to push in.
  const world = svgEl('g');
  svg.appendChild(world);
  world.appendChild(await loadScene(spec.scene));
  if (spec.zoom && spec.zoom !== 1) {
    const z = spec.zoom;
    world.setAttribute('transform',
      `translate(${(W * (1 - z)) / 2} ${(H * (1 - z)) / 2}) scale(${z})`);
  }

  // Cast. Rigs must be in the live document before place(), because place()
  // measures with getBBox() and a detached node measures as zero.
  const placed = [];
  for (const c of spec.cast || []) {
    const rig = await loadCharacter(c.key, c.view || 'front');
    world.appendChild(rig.node);
    applyExpression(rig, c.expr || 'neutral');
    if (c.restArms) restArms(rig);
    if (c.poses) {
      for (const [path, t] of Object.entries(c.poses)) {
        if (rig.has(path)) rig.pose(path, t);
      }
    }
    const byHouse = c.faceHouse ? placeByHouse(rig, world, svg, c.faceHouse) : null;
    const put = byHouse || { x: c.x, y: c.y, height: c.height, flip: !!c.flip };
    rig.place({ ...put, rotate: c.rotate || 0 });
    placed.push({ rig, c, flip: put.flip });
    if (byHouse) c.flip = put.flip;   // the effects need to know which way he faces
    placed[placed.length - 1].c = c;
  }

  // Effects run after every rig is placed, because they measure real page
  // positions through the transform chain.
  for (const { rig, c } of placed) {
    if (c.blow) {
      const g = blow(rig, svg, { power: c.blow.power ?? 1, facingLeft: !!c.flip });
      if (g) world.appendChild(g);
    }
    if (c.burning) {
      const g = flames(rig, svg, 'الذيل', { scale: c.burning.scale ?? 1 });
      if (g) world.appendChild(g);
    }
    if (c.motion) {
      world.appendChild(motionLines(rig, svg, { dir: c.motion }));
    }
  }

  if (spec.night) {
    svg.appendChild(svgEl('rect', {
      x: 0, y: 0, width: W, height: H, fill: '#0b1430', opacity: spec.night,
    }));
  }
  if (spec.rain) storm(svg);

  if (spec.kind === 'cover') {
    const band = svgEl('g');
    band.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: '#120a02', opacity: 0.3 }));
    band.appendChild(textBox({
      x: 90, y: 56, w: W - 180, h: 250, cls: 'cover',
      html: `<h1>${BOOK.title}</h1><h2>${BOOK.subtitle}</h2>`,
    }));
    svg.appendChild(band);
  } else if (spec.kind === 'moral') {
    svg.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: '#120a02', opacity: 0.22 }));
    svg.appendChild(textBox({
      x: 120, y: H - 250, w: W - 240, h: 190, cls: 'moral',
      html: `<p>${spec.text}</p>`,
    }));
  }

  const bubbleNodes = (spec.bubbles || []).map(bubble);
  for (const b of bubbleNodes) svg.appendChild(b);

  if (spec.kind !== 'cover' && spec.kind !== 'moral' && spec.text) {
    // Characters count double: a card over a face is far worse than a card
    // over a tree. Bubbles are hard obstacles — two boxes of text touching
    // reads as a layout mistake.
    const obstacles = [
      ...placed.map(({ rig }) => ({ ...bboxIn(rig.node, svg), weight: 2 })),
      ...bubbleNodes.map((n) => ({ ...bboxIn(n, svg), weight: 3 })),
    ];
    const where = spec.textAt || bestCorner(obstacles);
    svg.appendChild(narrationCard(spec.text, where));
  }

  return svg;
}

export default async function book() {
  const fontCss = await fetchText('/assets/fonts/embed.css');

  const ids = [];
  for (const spec of PAGES) {
    await buildPage(spec);
    ids.push(spec.id);
  }

  window.__book = { fontCss, ids, width: W, height: H, title: BOOK.title };

  // The harness expects a film-shaped object; the book is static.
  return { duration: 0, width: W, height: H, seek: () => {}, setTransparent: () => {} };
}
