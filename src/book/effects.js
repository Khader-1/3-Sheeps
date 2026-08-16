// Drawn effects for the book pages.
//
// The character art has no "blowing", "falling" or "on fire" state — the rigs
// are a neutral wolf and three neutral sheep. Rather than ask for new
// drawings, these add the missing information the way a comic does: a cone of
// wind out of the snout, speed lines behind a falling body, flames licking a
// tail. All of it is drawn relative to the rig's actual part positions, so it
// follows the character wherever the page puts him.
//
// Positions come from bboxIn(), which walks the transform chain — a part's own
// getBBox() is in its local space and would place the flames in the wrong
// corner of the page entirely.

import { svgEl, bboxIn } from '../rig.js';


/**
 * First real fill colour found under any of `paths`.
 *
 * The character art leads each group with stroke-only outline paths that carry
 * fill="none"; taking the first <path> blindly yields a transparent shape.
 */
function sampleFill(rig, paths, fallback) {
  for (const p of paths) {
    const host = rig.part(p, { optional: true });
    if (!host) continue;
    for (const el of host.querySelectorAll('path, polygon, ellipse, circle, rect')) {
      const f = el.getAttribute('fill') || getComputedStyle(el).fill;
      if (!f) continue;
      const v = f.trim().toLowerCase();
      if (v === 'none' || v === 'transparent' || v.startsWith('rgba(0, 0, 0, 0')) continue;
      return f;
    }
  }
  return fallback;
}


/**
 * Open the wolf's jaws, seen head-on.
 *
 * The side-view jaw is a wedge hinged at the back of the muzzle, which is
 * correct in profile and wrong from the front: face-on there is no hinge to
 * see, only a roughly symmetric opening below the nose, widest across the
 * middle, with canines top and bottom.
 *
 * Built symmetric about the mouth's own centre and sized from its box, so it
 * lands correctly at any scale.
 */
function openJawFront(rig, mouthEl, angle) {
  const parent = mouthEl.parentNode;
  const b = mouthEl.getBBox();

  const cx = b.x + b.width / 2;
  // Start below the nose, which is drawn over the top of the mouth's box.
  const top = b.y + b.height * 0.5;
  const halfW = b.width * 0.42;
  const depth = b.height * (0.45 + angle / 30);
  const sw = Math.max(1.2, b.height * 0.09);

  const fur = sampleFill(rig, ['تجميع_الراس/الراس', 'الراس', 'الجسم'], '#615e5e');
  const g = svgEl('g', { 'data-part': 'فك_مفتوح' });

  const maw = (w, d) =>
    `M ${cx - w} ${top} L ${cx + w} ${top}` +
    ` Q ${cx + w * 1.04} ${top + d * 0.72} ${cx} ${top + d}` +
    ` Q ${cx - w * 1.04} ${top + d * 0.72} ${cx - w} ${top} Z`;

  // The lower jaw itself, a little wider and deeper than the opening, so the
  // dark mouth sits inside a muzzle rather than being a hole in the face.
  g.appendChild(svgEl('path', {
    d: maw(halfW * 1.16, depth * 1.14),
    fill: fur, stroke: '#000', 'stroke-width': sw, 'stroke-linejoin': 'round',
  }));
  g.appendChild(svgEl('path', {
    d: maw(halfW, depth),
    fill: '#33100e', stroke: '#000', 'stroke-width': sw * 0.7, 'stroke-linejoin': 'round',
  }));

  g.appendChild(svgEl('ellipse', {
    cx, cy: top + depth * 0.66, rx: halfW * 0.52, ry: depth * 0.2, fill: '#a8514b',
  }));

  // Canines: two down from the upper lip, two up from the lower.
  const fang = (fx, fy, w, h) => svgEl('path', {
    d: `M ${fx - w} ${fy} L ${fx + w} ${fy} L ${fx} ${fy + h} Z`,
    fill: '#fffdf5', stroke: '#000', 'stroke-width': sw * 0.45, 'stroke-linejoin': 'round',
  });
  const fw = halfW * 0.17;
  const fh = depth * 0.34;
  g.appendChild(fang(cx - halfW * 0.62, top, fw, fh));
  g.appendChild(fang(cx + halfW * 0.62, top, fw, fh));
  g.appendChild(fang(cx - halfW * 0.44, top + depth * 0.9, fw * 0.85, -fh * 0.72));
  g.appendChild(fang(cx + halfW * 0.44, top + depth * 0.9, fw * 0.85, -fh * 0.72));

  parent.insertBefore(g, mouthEl.nextSibling);
  mouthEl.setAttribute('opacity', 0);
  return g;
}


/**
 * Open the wolf's jaws.
 *
 * The first attempt pursed his lips into an "O" — which is how a person
 * blows, and something a wolf cannot do. A wolf opens at the hinge: the lower
 * jaw swings down and back, the muzzle line stays put as the upper jaw, and
 * the gap between them is a dark maw with canines top and bottom.
 *
 * The rig has no jaw part — the muzzle is a single closed curve — so the jaw
 * is constructed from that curve's own geometry: its back end is the hinge,
 * its front end is the tip, and the lower jaw is that same vector rotated
 * down. Built this way it lands correctly whatever size the wolf is placed at.
 *
 * @param {Rig} rig
 * @param {object} o
 * @param {number} [o.angle] how far the jaw drops, degrees
 */
export function openJaw(rig, { angle = 24 } = {}) {
  // Side view nests the mouth under الراس; the front view has it under
  // تجميع_الراس, which the first path does not reach.
  const mouthEl = rig.part('الراس/الفم', { optional: true })
    || rig.part('الفم', { optional: true });
  if (!mouthEl) return null;

  const parent = mouthEl.parentNode;
  parent.querySelectorAll('[data-part="فك_مفتوح"]').forEach((n) => n.remove());

  // Head-on needs a different construction entirely — see openJawFront.
  if (rig.view === 'front') return openJawFront(rig, mouthEl, angle);

  const b = mouthEl.getBBox();
  // Hinge at the back of the muzzle line, tip at the front. In the rig's own
  // coordinates the snout is always the high-x end, whatever the flip.
  const hx = b.x + b.width * 0.03;
  const hy = b.y + b.height * 0.62;
  const dx = b.width * 0.78;
  const dy = b.height * -0.26;

  const rot = (deg) => {
    const a = (deg * Math.PI) / 180;
    return [hx + dx * Math.cos(a) - dy * Math.sin(a),
            hy + dx * Math.sin(a) + dy * Math.cos(a)];
  };
  const [ux, uy] = rot(-4);        // upper jaw lifts a little
  const [lx, ly] = rot(angle);     // lower jaw swings down
  const jawLen = Math.hypot(dx, dy);
  const sw = Math.max(1.5, b.height * 0.1);

  // Muzzle colour, taken from the head's own artwork so the jaw matches
  // whatever palette the character was drawn in.
  // Take the first path that actually paints something. The head group leads
  // with stroke-only outline paths carrying fill="none" — sampling blindly
  // took one of those and produced a see-through jaw.
  const fur = sampleFill(rig, ['الراس/الراس', 'الراس', 'الجسم'], '#615e5e');

  const g = svgEl('g', { 'data-part': 'فك_مفتوح' });

  // 1. The maw: the dark gap between the two jaws.
  g.appendChild(svgEl('path', {
    d: `M ${hx} ${hy} L ${ux} ${uy}` +
       ` Q ${(ux + lx) / 2 + jawLen * 0.06} ${(uy + ly) / 2} ${lx} ${ly} Z`,
    fill: '#33100e', stroke: '#000', 'stroke-width': sw * 0.8, 'stroke-linejoin': 'round',
  }));

  // 2. Tongue, lying along the lower jaw.
  const tcx = hx + (lx - hx) * 0.5;
  const tcy = hy + (ly - hy) * 0.5;
  g.appendChild(svgEl('ellipse', {
    cx: tcx, cy: tcy, rx: jawLen * 0.3, ry: jawLen * 0.09,
    fill: '#a8514b',
    transform: `rotate(${(Math.atan2(ly - hy, lx - hx) * 180) / Math.PI} ${tcx} ${tcy})`,
  }));

  // 3. Canines: two down from the upper jaw, two up from the lower.
  const fang = (x1, y1, x2, y2, at, size, down) => {
    const px = x1 + (x2 - x1) * at;
    const py = y1 + (y2 - y1) * at;
    const s = jawLen * size;
    const d = down ? 1 : -1;
    return svgEl('path', {
      d: `M ${px - s * 0.42} ${py} L ${px + s * 0.42} ${py} L ${px} ${py + d * s * 1.5} Z`,
      fill: '#fffdf5', stroke: '#000', 'stroke-width': sw * 0.5, 'stroke-linejoin': 'round',
    });
  };
  g.appendChild(fang(hx, hy, ux, uy, 0.86, 0.10, true));
  g.appendChild(fang(hx, hy, ux, uy, 0.54, 0.07, true));
  g.appendChild(fang(hx, hy, lx, ly, 0.84, 0.085, false));
  g.appendChild(fang(hx, hy, lx, ly, 0.52, 0.06, false));

  // 4. The lower jaw itself, over the maw's bottom edge so it reads as a
  //    solid part of the head rather than a wedge cut out of it.
  const nx = -(ly - hy) / jawLen;
  const ny = (lx - hx) / jawLen;
  const t = jawLen * 0.15;
  g.appendChild(svgEl('path', {
    d: `M ${hx} ${hy} L ${lx} ${ly}` +
       ` L ${lx + nx * t} ${ly + ny * t}` +
       ` Q ${hx + nx * t * 1.3} ${hy + ny * t * 1.3} ${hx} ${hy} Z`,
    fill: fur, stroke: '#000', 'stroke-width': sw, 'stroke-linejoin': 'round',
  }));

  parent.insertBefore(g, mouthEl.nextSibling);
  // The closed muzzle line is now the upper jaw's underside; hide it, the jaw
  // group draws its own outline.
  mouthEl.setAttribute('opacity', 0);
  return g;
}

/**
 * Pose a wolf into a blow and return the cone of wind.
 *
 * The mouth artwork is a closed line, so an open "O" is inserted over it — the
 * same trick the film's lip sync uses, because scaling a closed curve only
 * ever deepens it.
 *
 * @param {Rig} rig     a side-view wolf, already placed
 * @param {SVGElement} space  the element the returned nodes will be added to
 * @param {object} o
 * @param {number} [o.power] 0..1, scales the cone
 * @param {boolean} [o.facingLeft] true when the rig was placed with flip
 */
export function blow(rig, space, { power = 1, facingLeft = true } = {}) {
  // Lean into it: head down and forward, body tipped, brow driven low.
  if (rig.has('الراس')) rig.pose('الراس', { rotate: facingLeft ? -13 : 13, pivot: [0.15, 0.9] });
  if (rig.has('الجسم')) rig.pose('الجسم', { rotate: facingLeft ? -6 : 6, pivot: [0.5, 0.95] });

  const g = svgEl('g', { 'data-part': 'نفخ' });

  // openJaw() inserts itself INSIDE the head, in the rig's own coordinates.
  // Appending the returned node to this page-space group re-parents it, which
  // keeps the local numbers but reinterprets them at page scale — the jaw ends
  // up detached and several times too large. Let it stay where it put itself.
  openJaw(rig, { angle: 19 + power * 5 });

  // Cone origin: the snout tip, in the page's coordinate space.
  const snout = rig.part('الراس/الانف', { optional: true }) || rig.part('الراس');
  const b = bboxIn(snout, space);
  const ox = facingLeft ? b.x : b.x + b.width;
  const oy = b.y + b.height * 0.62;
  const dir = facingLeft ? -1 : 1;

  // Four arcs fanning out, each longer and fainter than the last.
  const L = 250 * power;
  for (let i = 0; i < 4; i++) {
    const spread = (i - 1.5) * 26 * power;
    const len = L * (0.62 + i * 0.13);
    g.appendChild(svgEl('path', {
      d: `M ${ox + dir * 14} ${oy + spread * 0.35}` +
         ` Q ${ox + dir * len * 0.55} ${oy + spread * 0.9}` +
         ` ${ox + dir * len} ${oy + spread * 1.9}`,
      fill: 'none', stroke: '#ffffff', 'stroke-width': 7 - i * 1.1,
      'stroke-linecap': 'round', opacity: 0.62 - i * 0.09,
    }));
  }
  // A few specks carried along, so the cone reads as moving air.
  for (let i = 0; i < 7; i++) {
    const h = Math.sin(i * 12.9898) * 43758.5453;
    const f = h - Math.floor(h);
    g.appendChild(svgEl('circle', {
      cx: ox + dir * (60 + f * L), cy: oy + (f - 0.5) * 90 * power,
      r: 3 + f * 4, fill: '#ffffff', opacity: 0.42,
    }));
  }
  return g;
}

/**
 * One licking tongue of flame.
 *
 * A symmetrical teardrop reads as a static blob. Real flame is asymmetric and
 * curls, so each tongue leans, and its two sides are different curves — the
 * silhouette is what sells movement in a still image.
 */
function tongue(cx, base, w, h, lean, fill) {
  const tipX = cx + lean * w;
  return svgEl('path', {
    d: `M ${cx - w * 0.5} ${base}` +
       ` C ${cx - w * 0.95} ${base - h * 0.34}` +
       ` ${cx - w * 0.30} ${base - h * 0.52}` +
       ` ${tipX - w * 0.14} ${base - h * 0.80}` +
       ` C ${tipX - w * 0.02} ${base - h * 0.93} ${tipX} ${base - h * 0.97} ${tipX} ${base - h}` +
       ` C ${tipX + w * 0.30} ${base - h * 0.72}` +
       ` ${cx + w * 0.36} ${base - h * 0.62}` +
       ` ${cx + w * 0.62} ${base - h * 0.30}` +
       ` C ${cx + w * 0.74} ${base - h * 0.14} ${cx + w * 0.36} ${base} ${cx - w * 0.5} ${base} Z`,
    fill,
  });
}

/**
 * Flames licking a part — used on the wolf's tail.
 *
 * Three tongues at different sizes, leans and horizontal offsets, plus loose
 * embers breaking away above. Concentric tongues of the same shape just look
 * like a logo; offsetting and leaning them differently is what makes a still
 * fire look like it is moving.
 */
export function flames(rig, space, partPath = 'الذيل', o = {}) {
  const { scale = 1, attach = false, dir = 'up' } = o;
  const el = rig.part(partPath, { optional: true });
  if (!el) return null;

  // `attach` builds the fire in the PART's own coordinates and parents it to
  // the part, so it moves with it — a tail that sways has to take its flames
  // with it, and a fire measured once in page space just hangs in the air.
  const b = attach ? el.getBBox() : bboxIn(el, space);
  const g = svgEl('g', { 'data-part': 'نار' });

  const cx = b.x + b.width * 0.5;
  const base = b.y + b.height * 0.72;
  const W0 = b.width * 0.95 * scale;
  const H0 = b.height * 2.0 * scale;

  const spec = [
    { dx: -0.26, s: 0.74, lean: -0.34, fill: '#ff4d1a' },
    { dx: 0.24, s: 0.86, lean: 0.30, fill: '#ff6a1a' },
    { dx: 0.02, s: 1.00, lean: 0.08, fill: '#ff9f1a' },
    { dx: 0.06, s: 0.52, lean: 0.20, fill: '#ffe066' },
  ];
  for (const t of spec) {
    g.appendChild(tongue(cx + W0 * t.dx, base, W0 * t.s, H0 * t.s, t.lean, t.fill));
  }

  // Embers that have broken away from the tips — the clearest single cue that
  // a drawn fire is burning rather than painted on.
  for (let i = 0; i < 8; i++) {
    const h1 = Math.sin(i * 78.233) * 12345.6789;
    const f = h1 - Math.floor(h1);
    const h2 = Math.sin(i * 21.113) * 5411.987;
    const f2 = h2 - Math.floor(h2);
    g.appendChild(svgEl('ellipse', {
      cx: cx + (f - 0.5) * W0 * 2.1,
      cy: base - H0 * (0.95 + f2 * 0.95),
      rx: 2 + f * 3.4, ry: (2 + f * 3.4) * 1.7,
      fill: f2 > 0.5 ? '#ffd23f' : '#ff8c1a',
      opacity: 0.9 - f2 * 0.35,
      transform: `rotate(${(f - 0.5) * 40} ${cx + (f - 0.5) * W0 * 2.1} ${base - H0 * (0.95 + f2 * 0.95)})`,
    }));
  }

  // Flames are drawn rising. On a tail that hangs down into a hearth fire they
  // have to point the other way — the fire catches the lowest point and licks
  // downward from it — so the whole group is reflected about its base.
  if (dir === 'down') {
    g.setAttribute('transform', `translate(0 ${base * 2}) scale(1 -1)`);
  }
  if (attach) el.appendChild(g);
  return g;
}

/** Speed lines trailing a moving body. */
export function motionLines(rig, space, { dir = 'up', count = 7, len = 90 } = {}) {
  const b = bboxIn(rig.node, space);
  const g = svgEl('g', { 'data-part': 'خطوط_حركة', opacity: 0.55 });
  for (let i = 0; i < count; i++) {
    const h = Math.sin(i * 12.9898) * 43758.5453;
    const f = h - Math.floor(h);
    const x = b.x + b.width * (0.1 + 0.8 * (i / (count - 1)));
    const y = dir === 'up' ? b.y - 16 - f * 40 : b.y + b.height + 16 + f * 40;
    const l = len * (0.5 + f * 0.7);
    g.appendChild(svgEl('line', {
      x1: x, y1: dir === 'up' ? y - l : y + l, x2: x, y2: y,
      stroke: '#ffffff', 'stroke-width': 4, 'stroke-linecap': 'round',
    }));
  }
  return g;
}
