// Poster — «الخراف الثلاثة والذئب الماكر»
//
// Rebuilt from the rigged Moho characters rather than the flat poster art, so
// posture and expression are controllable. The original landscape, credits bar
// and logos are reused; the old character art and the corrupted text are
// replaced.
//
// Output is a true A3 portrait (297×420mm, viewBox 842×1191 = A3 in points).

import { fetchText, svgEl } from '../rig.js';
import { loadCharacter, applyExpression } from '../expressions.js';
import { COPY } from '../copy.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const POSTER = '/assets/incoming/خلفيات/ملصق-الخراف-الثلاثة.svg';
const FONTS = '/assets/fonts/embed.css';

// The source artboard is 1320.17 wide but the poster itself sits at x 239..1081.
const CROP_X = 239;
const W = 842;
const H = 1191;

// Layout. With the credits bar gone the landscape runs to the bottom edge, so
// the cast stands lower and larger than it did over the bar.
const L = {
  groundY: 1105,      // where the characters stand
  logosY: 1074,       // top of the logo band (keeps clear of the page edge)
  title1Y: 178,
  title2Y: 292,
  ruleY: 330,
  subtitleY: 372,
  taglineY: 420,
};

export default async function poster() {
  const [srcText, fontCss] = await Promise.all([fetchText(POSTER), fetchText(FONTS)]);

  const svg = svgEl('svg', {
    xmlns: SVGNS,
    'xmlns:xlink': 'http://www.w3.org/1999/xlink',
    version: '1.1',
    width: '297mm',
    height: '420mm',
    viewBox: `0 0 ${W} ${H}`,
  });

  // getBBox() only reports real geometry for nodes in the live document, and
  // every pivot and placement depends on it — so attach before posing.
  document.getElementById('stage').appendChild(svg);

  // Fonts + type styles, embedded so the file stands alone.
  const style = document.createElementNS(SVGNS, 'style');
  style.textContent = `${fontCss}
.t-title{font-family:'Poster Display',sans-serif;font-weight:800;font-size:104px;}
.t-sub{font-family:'Poster Text',sans-serif;font-weight:600;font-size:31px;}
.t-tag{font-family:'Poster Text',sans-serif;font-weight:400;font-size:25px;}
.t-credit{font-family:'Poster Text',sans-serif;font-weight:400;font-size:15px;}
.t-credit-em{font-family:'Poster Text',sans-serif;font-weight:700;font-size:16px;}
text{direction:rtl;unicode-bidi:isolate;}`;
  svg.appendChild(style);

  // Everything is clipped to the A3 page; the landscape art bleeds past it.
  const defs = document.createElementNS(SVGNS, 'defs');
  defs.innerHTML = `
    <clipPath id="page"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath>
    <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b1d3a" stop-opacity="0.42"/>
      <stop offset="0.45" stop-color="#0b1d3a" stop-opacity="0.10"/>
      <stop offset="1" stop-color="#0b1d3a" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.62" r="0.75">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#1a1005" stop-opacity="0.26"/>
    </radialGradient>
    <radialGradient id="groundShadow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#241a10" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#241a10" stop-opacity="0"/>
    </radialGradient>`;
  svg.appendChild(defs);

  const page = svgEl('g', { 'clip-path': 'url(#page)' });
  svg.appendChild(page);

  // ---- reused background ------------------------------------------------
  const src = new DOMParser().parseFromString(srcText, 'image/svg+xml').documentElement;

  // The reused artwork paints via class rules (.cls-2{fill:url(#linear-gradient)})
  // and clip paths defined in the source file. Carry its <style> and <defs>
  // across, or the sky renders as flat black.
  for (const node of src.querySelectorAll(':scope > defs, :scope > style')) {
    svg.appendChild(document.importNode(node, true));
  }

  const bg = svgEl('g', { id: 'الخلفية', transform: `translate(${-CROP_X} 0)` });
  page.appendChild(bg);

  // Replaced layers: old characters, their shadows, and the corrupted text.
  // The credits bar and logos are re-added later so they sit above the cast.
  const DROP = new Set([
    'ظلال', 'الخروف-الأصغر', 'الخروف-الأكبر', 'الخروف-الأوسط', 'الذئب',
    'النصوص', 'شريط-الاعتمادات', 'الشعارات',
  ]);
  for (const g of [...src.children].filter((e) => e.tagName === 'g')) {
    if (DROP.has(g.getAttribute('id'))) continue;
    bg.appendChild(document.importNode(g, true));
  }

  // Cool the sky slightly and darken the top so the title holds.
  page.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: 560, fill: 'url(#dusk)' }));

  // ---- characters -------------------------------------------------------
  const cast = svgEl('g', { id: 'الشخصيات' });
  page.appendChild(cast);

  const shadow = (cx, cy, rx, ry, op) =>
    svgEl('ellipse', { cx, cy, rx, ry, fill: 'url(#groundShadow)', opacity: op });

  /** Attach a rig to the stage before posing, so getBBox() is meaningful. */
  const stageRig = async (key, view, id) => {
    const rig = await loadCharacter(key, view);
    const g = svgEl('g', { id });
    g.appendChild(rig.node);
    cast.appendChild(g);
    return rig;
  };

  cast.appendChild(shadow(104, L.groundY - 22, 116, 13, 0.45));
  cast.appendChild(shadow(184, L.groundY - 10, 132, 14, 0.5));
  cast.appendChild(shadow(300, L.groundY + 4, 164, 17, 0.6));
  cast.appendChild(shadow(700, L.groundY + 8, 210, 18, 0.55));

  // The wolf uses the side view: he already leans forward in that pose, which
  // reads as looming far better than the symmetrical front view.
  const wolf = await stageRig('wolf', 'side', 'الذئب');
  applyExpression(wolf, 'menacing');
  wolf.poseAll({
    // Head drops toward them but is not craned so far forward that the muzzle
    // vanishes behind the eldest brother's horns.
    [wolf.face.head]: { rotate: 9, pivot: [0.15, 0.9] },
    // reach a forelimb down over them
    [wolf.face.armNear]: { rotate: -26, pivot: [0.5, 0.05] },
    [wolf.face.armFar]: { rotate: -14, pivot: [0.5, 0.05] },
  });

  // Placed provisionally; the exact x is solved below once the eldest brother
  // exists, so the muzzle is guaranteed to clear his head.
  const wolfPlacement = { x: 688, y: L.groundY + 8, height: 700, flip: true, rotate: -2 };
  wolf.place(wolfPlacement);

  // The three brothers, front view so their faces read.
  // Order matters: the two younger are staged first so the eldest sits in front.
  // Smallest is furthest back and furthest from the wolf. In the source art
  // both his arms are straight out (224×63 each), so they need swinging down
  // about the shoulder — which sits at the inner end of each arm group.
  const small = await stageRig('small', 'front', 'الخروف-الأصغر');
  applyExpression(small, 'terrified');
  small.poseAll({
    [small.face.head]: { rotate: -6, pivot: [0.5, 1] },
    'اليد_ش': { rotate: -74, pivot: [1, 0.4] },
    'اليد_ي': { rotate: 78, pivot: [0, 0.4] },
  });
  small.place({ x: 72, y: L.groundY - 26, height: 348 });

  const mid = await stageRig('mid', 'front', 'الخروف-الأوسط');
  applyExpression(mid, 'afraid');
  mid.poseAll({
    [mid.face.head]: { rotate: 5, pivot: [0.5, 1] },   // shrinking away
    'اليد_ش': { rotate: 20, pivot: [0.5, 0.05] },
    'اليد_ي': { rotate: -10, pivot: [0.5, 0.05] },
  });
  mid.place({ x: 162, y: L.groundY - 13, height: 402 });

  const big = await stageRig('big', 'front', 'الخروف-الأكبر');
  applyExpression(big, 'determined');
  big.chain('اليد_ش', ['الكتف_ش', 'الساعد', 'الكف']);
  big.chain('اليد_ي', ['الكتف_ش', 'الساعد', 'الكف']);
  big.poseAll({
    // chin up, squared to the wolf
    [big.face.head]: { rotate: -9, pivot: [0.5, 1] },
    // arms braced slightly out, planted
    'اليد_ش': { rotate: -15, pivot: [0.5, 0.05] },
    'اليد_ي': { rotate: 17, pivot: [0.5, 0.05] },
  });

  big.place({ x: 300, y: L.groundY + 2, height: 498 });

  // Solve the wolf's horizontal position so his muzzle clears the eldest
  // brother's head instead of vanishing behind it. Measured rather than
  // guessed, so it stays correct if any character is later resized.
  {
    const MARGIN = 24;
    const snout = wolf.part('الراس/الانف', { optional: true }) || wolf.part(wolf.face.head);
    const gap = bboxInSvg(snout, svg).x - (bboxInSvg(big.part(big.face.head), svg).x + bboxInSvg(big.part(big.face.head), svg).width);
    if (gap < MARGIN) {
      wolfPlacement.x += MARGIN - gap;
      wolf.place(wolfPlacement);
    }
  }

  // Report the real page-space geometry of the pieces that collide.
  {
    const probe = {
      'wolf head': wolf.part(wolf.face.head),
      'wolf snout': wolf.part('الراس/الانف', { optional: true }),
      'wolf mouth': wolf.part(wolf.face.mouth, { optional: true }),
      'big head': big.part(big.face.head),
      'big horn L': big.part('قرن__2', { optional: true }),
      'big horn R': big.part('قرن_', { optional: true }),
    };
    const rows = ['', 'page-space bboxes (x1..x2, y1..y2):'];
    for (const [name, el] of Object.entries(probe)) {
      if (!el) { rows.push(`  ${name.padEnd(11)} —`); continue; }
      const b = bboxInSvg(el, svg);
      rows.push(
        `  ${name.padEnd(11)} x ${b.x.toFixed(0).padStart(5)}..${(b.x + b.width).toFixed(0).padStart(5)}` +
        `   y ${b.y.toFixed(0).padStart(5)}..${(b.y + b.height).toFixed(0).padStart(5)}`
      );
    }
    const ws = bboxInSvg(probe['wolf snout'] || probe['wolf head'], svg);
    const bh = bboxInSvg(probe['big head'], svg);
    const gap = ws.x - (bh.x + bh.width);
    rows.push(`  --> snout-left minus bighead-right = ${gap.toFixed(0)} (want > 0)`);
    window.__log = rows.join('\n');
  }

  // ---- vignette + credits ----------------------------------------------
  page.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#vignette)' }));

  // Only the logos survive from the old credits band — the dark bar and the
  // credit text are dropped so the landscape continues to the bottom edge.
  // (The credit lines remain in copy.js for the film's end titles.)
  const logos = [...src.children].find((e) => e.getAttribute?.('id') === 'الشعارات');
  if (logos) {
    const wrap = svgEl('g', {
      id: 'الشعارات',
      transform: `translate(${-CROP_X} ${L.logosY - 1091})`,
    });
    const art = document.importNode(logos, true);
    wrap.appendChild(art);
    page.appendChild(wrap);

    // The dark credits bar used to supply the contrast these logos sat on.
    // Give each one its own soft plate instead. Direct children are individual
    // paths, so cluster them into logos by horizontal proximity first.
    const plates = svgEl('g', { id: 'ألواح-الشعارات' });
    wrap.insertBefore(plates, art);

    // Both logos are embedded <image> elements carrying their own transform,
    // so getBBox() reports the raw pixel box (677×878) rather than the placed
    // one. Map each box through its element transform to get parent coords.
    const boxes = [...art.querySelectorAll('image, path, rect, circle, ellipse, polygon')]
      .map((e) => bboxInParent(e))
      .filter((b) => b && b.width > 0 && b.height > 0)
      .sort((a, b) => a.x - b.x);

    const GAP = 80;
    const clusters = [];
    for (const b of boxes) {
      const last = clusters[clusters.length - 1];
      if (last && b.x <= last.x2 + GAP) {
        last.x2 = Math.max(last.x2, b.x + b.width);
        last.y1 = Math.min(last.y1, b.y);
        last.y2 = Math.max(last.y2, b.y + b.height);
      } else {
        clusters.push({ x1: b.x, x2: b.x + b.width, y1: b.y, y2: b.y + b.height });
      }
    }
    for (const c of clusters) {
      const padX = 20, padY = 14;
      plates.appendChild(
        svgEl('rect', {
          x: c.x1 - padX, y: c.y1 - padY,
          width: c.x2 - c.x1 + padX * 2, height: c.y2 - c.y1 + padY * 2,
          rx: 16, fill: '#FFFDF6', opacity: 0.9,
        })
      );
    }
  }

  // ---- type -------------------------------------------------------------
  const cx = W / 2;
  const type = svgEl('g', { id: 'النصوص', 'text-anchor': 'middle' });
  page.appendChild(type);

  // Title, drawn twice: a heavy outline behind a cream fill. Both copies must
  // end up at the same size, so the fitted size is measured once and shared.
  const TITLE_MAX = W - 96;
  for (const [txt, y] of [[COPY.titleLine1, L.title1Y], [COPY.titleLine2, L.title2Y]]) {
    const under = text(txt, cx, y, 't-title', {
      fill: 'none', stroke: '#22160b', 'stroke-width': 18,
      'stroke-linejoin': 'round', 'paint-order': 'stroke',
    });
    type.appendChild(under);
    const size = fitText(under, TITLE_MAX);
    const over = text(txt, cx, y, 't-title', { fill: '#FFF3C4' });
    over.style.fontSize = `${size}px`;
    type.appendChild(over);
  }

  type.appendChild(
    svgEl('line', {
      x1: cx - 196, y1: L.ruleY, x2: cx + 196, y2: L.ruleY,
      stroke: '#FFF3C4', 'stroke-width': 2.5, 'stroke-linecap': 'round', opacity: 0.9,
    })
  );

  for (const [txt, y, cls] of [
    [COPY.subtitle, L.subtitleY, 't-sub'],
    [COPY.tagline, L.taglineY, 't-tag'],
  ]) {
    const under = text(txt, cx, y, cls, {
      fill: 'none', stroke: '#22160b', 'stroke-width': 6,
      'stroke-linejoin': 'round', 'paint-order': 'stroke',
    });
    type.appendChild(under);
    const size = fitText(under, W - 120);
    const over = text(txt, cx, y, cls, { fill: '#FFFFFF' });
    over.style.fontSize = `${size}px`;
    type.appendChild(over);
  }

  return svg;
}

function text(str, x, y, cls, attrs = {}) {
  const t = svgEl('text', { x, y, class: cls, ...attrs });
  t.textContent = str;
  return t;
}

/**
 * Bounding box of an element in the root SVG's user coordinate system,
 * with every ancestor transform applied. Used to measure real clearance
 * between characters after they have been posed, scaled and placed.
 */
function bboxInSvg(el, svg) {
  const b = el.getBBox();
  const m = svg.getScreenCTM().inverse().multiply(el.getScreenCTM());
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

/**
 * Bounding box of an element expressed in its parent's coordinate system.
 * getBBox() ignores the element's own transform, which matters for <image>
 * nodes that are placed and scaled via a transform attribute.
 */
function bboxInParent(el) {
  const b = el.getBBox();
  if (!b || (!b.width && !b.height)) return null;
  const m = el.transform?.baseVal?.consolidate()?.matrix;
  if (!m) return b;

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

/**
 * Shrink a text node's font-size until it fits maxWidth. Arabic shaping means
 * width cannot be predicted from character count, so this measures the laid-out
 * result. The node must already be in the document.
 */
function fitText(el, maxWidth) {
  let size = parseFloat(getComputedStyle(el).fontSize);
  for (let i = 0; i < 40 && el.getComputedTextLength() > maxWidth; i++) {
    size *= Math.min(0.985, (maxWidth / el.getComputedTextLength()) ** 0.5);
    el.style.fontSize = `${size}px`;
  }
  return size;
}
