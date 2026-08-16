// The buildable house.
//
// The scene backgrounds contain houses, but they are painted into the set and
// cannot be taken apart — and this game needs a house whose walls, roof and
// door are separate objects that can each be built from a different material
// and each fly off independently. So the house is drawn here, in the same flat
// cartoon language as the film: heavy black outlines, flat fills, no gradients.

import { svgEl } from '../rig.js';

/**
 * The three materials, in the order the story introduces them.
 *
 * `strength` is what the wolf is tested against. Straw can never survive even
 * a perfect build; wood survives only if built with care; stone survives
 * regardless. That is the lesson expressed as numbers: the material matters,
 * and so does the effort.
 */
export const MATERIALS = {
  straw: {
    id: 'straw', label: 'قش', strength: 1.0,
    // Easy to work, useless against a wolf: the widest target and the slowest
    // sweep. Straw is what you choose when you want to be finished.
    green: 0.22, yellow: 0.40, speed: 0.95,
    fill: '#e8bd52', dark: '#c99a33', line: '#7a5410',
  },
  wood: {
    id: 'wood', label: 'حطب', strength: 2.0,
    green: 0.13, yellow: 0.26, speed: 1.25,
    fill: '#b5763c', dark: '#8d5628', line: '#4e2d10',
  },
  stone: {
    id: 'stone', label: 'حجارة وطين', strength: 3.2,
    // The strongest house and the hardest to build — a narrow target and a
    // fast sweep. That trade is the whole point: the material that survives
    // is the one that asks something of you.
    green: 0.075, yellow: 0.17, speed: 1.6,
    fill: '#c0503f', dark: '#9c3b2c', line: '#4a1a12',
  },
};

export const PARTS = [
  { id: 'walls', label: 'الجدران' },
  { id: 'roof', label: 'السقف' },
  { id: 'door', label: 'الباب' },
];

const INK = '#2a1608';

/** Texture strokes that tell the three materials apart at a glance. */
function texture(mat, x, y, w, h) {
  const g = svgEl('g', { opacity: 0.9 });
  if (mat.id === 'straw') {
    for (let i = 0; i < 26; i++) {
      const f = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
      const px = x + f * w;
      const py = y + (((i * 37) % 100) / 100) * h;
      g.appendChild(svgEl('line', {
        x1: px, y1: py, x2: px + 16, y2: py + 5,
        stroke: mat.dark, 'stroke-width': 3, 'stroke-linecap': 'round',
      }));
    }
  } else if (mat.id === 'wood') {
    const n = Math.max(2, Math.round(h / 26));
    for (let i = 1; i < n; i++) {
      g.appendChild(svgEl('line', {
        x1: x, y1: y + (h / n) * i, x2: x + w, y2: y + (h / n) * i,
        stroke: mat.dark, 'stroke-width': 3,
      }));
    }
  } else {
    const rows = Math.max(2, Math.round(h / 30));
    const cols = Math.max(2, Math.round(w / 56));
    for (let r = 0; r < rows; r++) {
      const yy = y + (h / rows) * r;
      g.appendChild(svgEl('line', {
        x1: x, y1: yy, x2: x + w, y2: yy, stroke: mat.dark, 'stroke-width': 3,
      }));
      for (let c = 0; c <= cols; c++) {
        const xx = x + (w / cols) * c + (r % 2 ? w / cols / 2 : 0);
        if (xx <= x || xx >= x + w) continue;
        g.appendChild(svgEl('line', {
          x1: xx, y1: yy, x2: xx, y2: yy + h / rows,
          stroke: mat.dark, 'stroke-width': 3,
        }));
      }
    }
  }
  return g;
}

/** Geometry of the three parts, in the game's own 1280×720 space. */
export const GEO = {
  walls: { x: 430, y: 360, w: 420, h: 250 },
  roof: { x: 386, y: 210, w: 508, h: 156 },
  door: { x: 578, y: 452, w: 124, h: 158 },
};

let uid = 0;

/**
 * Build (or rebuild) one part.
 * Returns the group so the caller can animate it away when it fails.
 */
/**
 * @param {number} [quality] 0..1 from the care test. Below ~0.4 the part is
 *   drawn cracked — a rushed wall should look rushed, not just score lower.
 */
export function buildPart(id, mat, quality = 1) {
  const g = svgEl('g', { 'data-part': id });
  const b = GEO[id];

  // The silhouette, built once and used twice: drawn as the part, and again as
  // a clip for the texture. Textures are laid out on a rectangular grid, so
  // without the clip the stone bricks run straight out past the roof's slopes
  // — a square mesh over a triangle.
  const shape = id === 'roof'
    ? svgEl('path', {
      d: `M ${b.x + b.w / 2} ${b.y} L ${b.x + b.w} ${b.y + b.h} L ${b.x} ${b.y + b.h} Z`,
      fill: mat.fill, stroke: INK, 'stroke-width': 7, 'stroke-linejoin': 'round',
    })
    : svgEl('rect', {
      x: b.x, y: b.y, width: b.w, height: b.h, rx: id === 'door' ? 58 : 8,
      fill: mat.fill, stroke: INK, 'stroke-width': 7,
    });

  g.appendChild(shape);

  const clipId = `clip-${id}-${++uid}`;
  const defs = svgEl('defs');
  const clip = svgEl('clipPath', { id: clipId });
  // A copy of the silhouette, stripped of paint — a clip only uses geometry,
  // and the stroke would otherwise widen the clipped area by half its width.
  const clipShape = shape.cloneNode(false);
  clipShape.removeAttribute('stroke');
  clipShape.removeAttribute('stroke-width');
  clipShape.setAttribute('fill', '#000');
  clip.appendChild(clipShape);
  defs.appendChild(clip);
  g.appendChild(defs);

  const inner = svgEl('g', { 'clip-path': `url(#${clipId})` });
  inner.appendChild(texture(mat, b.x - 4, b.y - 4, b.w + 8, b.h + 8));
  g.appendChild(inner);

  if (id === 'door') {
    g.appendChild(svgEl('circle', {
      cx: b.x + 26, cy: b.y + b.h * 0.56, r: 9, fill: '#ffd23f', stroke: INK, 'stroke-width': 4,
    }));
  }

  if (quality < 0.4) {
    // Cracks, clipped to the part so they never wander outside it.
    const cracks = svgEl('g', { 'clip-path': `url(#${clipId})` });
    const n = 3;
    for (let i = 0; i < n; i++) {
      const f = ((Math.sin((i + 1) * 12.9898) * 43758.5453) % 1 + 1) % 1;
      const x0 = b.x + b.w * (0.2 + f * 0.6);
      const y0 = b.y + b.h * 0.1;
      let d = `M ${x0} ${y0}`;
      let x = x0;
      for (let k = 1; k <= 4; k++) {
        const g2 = ((Math.sin((i * 7 + k) * 78.233) * 12345.6789) % 1 + 1) % 1;
        x += (g2 - 0.5) * b.w * 0.16;
        d += ` L ${x} ${y0 + (b.h * 0.85 * k) / 4}`;
      }
      cracks.appendChild(svgEl('path', {
        d, fill: 'none', stroke: '#2a1608', 'stroke-width': 4,
        'stroke-linecap': 'round', opacity: 0.75,
      }));
    }
    g.appendChild(cracks);
  }
  return g;
}

/** A ghost outline shown before a part has been chosen. */
export function ghostPart(id) {
  const b = GEO[id];
  const attrs = {
    fill: '#ffffff', 'fill-opacity': 0.16, stroke: '#ffffff',
    'stroke-width': 5, 'stroke-dasharray': '16 14', 'stroke-linejoin': 'round',
  };
  const g = svgEl('g', { 'data-ghost': id });
  if (id === 'roof') {
    g.appendChild(svgEl('path', {
      d: `M ${b.x + b.w / 2} ${b.y} L ${b.x + b.w} ${b.y + b.h} L ${b.x} ${b.y + b.h} Z`, ...attrs,
    }));
  } else {
    g.appendChild(svgEl('rect', {
      x: b.x, y: b.y, width: b.w, height: b.h, rx: id === 'door' ? 58 : 8, ...attrs,
    }));
  }
  return g;
}
