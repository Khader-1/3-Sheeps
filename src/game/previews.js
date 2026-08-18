// Light previews for the menu cards.
//
// Each one is a small vignette of what its game asks you to do, drawn in a
// PW×PH box in the film's own palette, with one thing moving in it. They are
// not the games running small: mounting seven live games behind a menu would
// cost seven scenes and seven loops, and the only job here is to say at a
// glance which game this is.
//
// Everything moves on CSS keyframes rather than a rAF loop, so there is
// nothing to tear down when the menu goes away and nothing left competing
// with the game that starts. One <style> carries the lot; the menu injects it
// once.

import { svgEl } from '../rig.js';
import { INK } from './ui.js';

export const PW = 420;
export const PH = 200;

const SKY = '#bfe3f7';
const GRASS = '#9ac349';
const GRASS_DARK = '#7ba838';
const STRAW = '#e8c15a';
const WOOD = '#b0782f';
const STONE = '#9aa2a6';
const FIRE = '#ff8a2b';
const EMBER = '#ffd23f';
const WOOL = '#f6ecdc';
const FLEECE = '#a9714f';

const el = (tag, a = {}) => svgEl(tag, a);
const box = (x, y, w, h, fill, a = {}) => el('rect', { x, y, width: w, height: h, fill, ...a });
const dot = (cx, cy, r, fill, a = {}) => el('circle', { cx, cy, r, fill, ...a });
const line = (d, a = {}) => el('path', { d, fill: 'none', stroke: INK, 'stroke-width': 4,
                                         'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...a });
const shape = (d, fill, a = {}) => el('path', { d, fill, stroke: INK, 'stroke-width': 4,
                                                'stroke-linejoin': 'round', ...a });

/** A group holding the given children, with optional attributes. */
function group(attrs, ...kids) {
  const n = el('g', attrs);
  for (const k of kids) if (k) n.appendChild(k);
  return n;
}

/** Sky over grass — the bed most of these sit on. */
const outdoors = (horizon = PH * 0.62) => group({},
  box(0, 0, PW, PH, SKY),
  box(0, horizon, PW, PH - horizon, GRASS),
  el('path', { d: `M0 ${horizon} H${PW}`, stroke: GRASS_DARK, 'stroke-width': 3, fill: 'none' }),
);

/** A sheep, small and side-on, for the previews that need one. */
function sheep(cx, cy, s = 1, cls = '') {
  const g = group({ class: cls, transform: `translate(${cx} ${cy}) scale(${s})` },
    line('M-26 20 V38  M-8 22 V40  M10 22 V40  M26 20 V38'),
    el('ellipse', { cx: 0, cy: 0, rx: 40, ry: 30, fill: FLEECE, stroke: INK, 'stroke-width': 4 }),
    dot(34, -18, 17, WOOL, { stroke: INK, 'stroke-width': 4 }),
    dot(40, -22, 3, INK),
  );
  return g;
}

// ---- the seven ---------------------------------------------------------

/** أعِد البناء — a piece drops into the gap it belongs in. */
function rebuild() {
  const hx = 120, hy = 52, hw = 180, hh = 96;
  const dashed = { fill: 'none', stroke: INK, 'stroke-width': 4, 'stroke-dasharray': '10 9', opacity: 0.55 };
  return group({},
    outdoors(),
    // the outline of the finished house, waiting
    el('path', { d: `M${hx - 16} ${hy} L${hx + hw / 2} ${hy - 44} L${hx + hw + 16} ${hy} Z`, ...dashed }),
    el('rect', { x: hx, y: hy, width: hw, height: hh, rx: 6, ...dashed }),
    // the walls, already placed
    box(hx, hy, hw, hh, WOOD, { rx: 6, stroke: INK, 'stroke-width': 4 }),
    box(hx + hw / 2 - 24, hy + hh - 52, 48, 52, '#6d4a1e', { rx: 4, stroke: INK, 'stroke-width': 4 }),
    // and the roof, arriving
    group({ class: 'pv-slot' },
      shape(`M${hx - 16} ${hy} L${hx + hw / 2} ${hy - 44} L${hx + hw + 16} ${hy} Z`, '#8a4b2a')),
  );
}

/** المدخنة — the flame, and the moment to catch. */
function chimney() {
  const cx = 128, top = 60;
  const trackX = 232, trackY = 128, trackW = 152;
  return group({},
    outdoors(),
    // the stack
    box(cx - 34, top, 68, 108, '#a2643c', { rx: 4, stroke: INK, 'stroke-width': 4 }),
    line(`M${cx - 34} ${top + 30} H${cx + 34}  M${cx - 34} ${top + 62} H${cx + 34}`, { 'stroke-width': 3, opacity: 0.5 }),
    box(cx - 42, top - 12, 84, 18, '#8b5230', { rx: 4, stroke: INK, 'stroke-width': 4 }),
    // the fire in the throat of it
    group({ class: 'pv-flame', 'transform-origin': `${cx}px ${top + 104}px` },
      shape(`M${cx} ${top + 40} q22 26 22 42 a22 22 0 0 1 -44 0 q0 -16 22 -42 Z`, FIRE),
      shape(`M${cx} ${top + 62} q11 14 11 23 a11 11 0 0 1 -22 0 q0 -9 11 -23 Z`, EMBER, { 'stroke-width': 0 }),
    ),
    // and the window you have to hit
    box(trackX, trackY, trackW, 16, '#2f2413', { rx: 8, stroke: INK, 'stroke-width': 4 }),
    box(trackX + trackW * 0.44, trackY, trackW * 0.2, 16, GRASS, { rx: 8 }),
    group({ class: 'pv-sweep' }, box(trackX + 2, trackY - 8, 12, 32, EMBER, { rx: 6, stroke: INK, 'stroke-width': 4 })),
  );
}

/** من قال هذا؟ — a voice, and three who might have said it. */
function whosaid() {
  const heads = [[122, FLEECE], [210, WOOL], [298, FLEECE]];
  const arc = (r, i) => el('path', {
    d: `M210 ${58 - r} a${r} ${r} 0 0 1 0 ${r * 2}`,
    fill: 'none', stroke: EMBER, 'stroke-width': 5, 'stroke-linecap': 'round',
    class: 'pv-wave', style: `animation-delay:${i * 0.22}s`,
  });
  return group({},
    outdoors(0.74 * PH),
    arc(18, 0), arc(30, 1), arc(42, 2),
    ...heads.map(([x, fill]) => group({},
      dot(x - 26, 118, 11, fill, { stroke: INK, 'stroke-width': 4 }),
      dot(x + 26, 118, 11, fill, { stroke: INK, 'stroke-width': 4 }),
      dot(x, 122, 30, fill, { stroke: INK, 'stroke-width': 4 }),
      dot(x - 11, 118, 3.5, INK), dot(x + 11, 118, 3.5, INK),
    )),
  );
}

/** اهرب! — the ground going by, and something to clear. */
function run() {
  const ground = 150;
  const rock = (i) => group({ class: 'pv-roll', style: `animation-delay:${i * 1.35}s` },
    shape(`M${PW + 30} ${ground} q6 -26 24 -26 q18 0 24 26 Z`, STONE));
  return group({},
    outdoors(ground),
    box(0, ground, PW, PH - ground, GRASS_DARK, { opacity: 0.35 }),
    rock(0), rock(1),
    group({ class: 'pv-hop' }, sheep(130, ground - 34, 0.8)),
  );
}

/** ابنِ بيتك — straw, wood, stone, and a choice to make. */
function build() {
  const y = 54, s = 92, gap = 26;
  const x0 = (PW - (s * 3 + gap * 2)) / 2;
  const swatch = (i, fill, texture) => group({},
    box(x0 + i * (s + gap), y, s, s, fill, { rx: 12, stroke: INK, 'stroke-width': 4 }),
    texture(x0 + i * (s + gap)),
  );
  const straw = (x) => line(`M${x + 16} ${y + 74} l14 -50  M${x + 38} ${y + 76} l14 -54  M${x + 60} ${y + 74} l14 -50`,
    { 'stroke-width': 5, opacity: 0.45 });
  const wood = (x) => line(`M${x + 12} ${y + 30} H${x + 80}  M${x + 12} ${y + 54} H${x + 80}  M${x + 12} ${y + 76} H${x + 80}`,
    { 'stroke-width': 5, opacity: 0.4 });
  const stone = (x) => line(`M${x + 12} ${y + 44} H${x + 80}  M${x + 44} ${y + 12} V${y + 44}  M${x + 28} ${y + 44} V${y + 80}  M${x + 66} ${y + 44} V${y + 80}`,
    { 'stroke-width': 5, opacity: 0.4 });
  return group({},
    outdoors(0.86 * PH),
    swatch(0, STRAW, straw), swatch(1, WOOD, wood), swatch(2, STONE, stone),
    group({ class: 'pv-pick' },
      el('rect', { x: x0 - 8, y: y - 8, width: s + 16, height: s + 16, rx: 16,
                   fill: 'none', stroke: EMBER, 'stroke-width': 7 })),
  );
}

/** لا تفتح الباب — someone is knocking, and it is not your brother. */
function door() {
  const dx = 118, dy = 34, dw = 128, dh = 138;
  return group({},
    box(0, 0, PW, PH, '#3a2a17'),
    box(dx - 12, dy - 12, dw + 24, dh + 12, '#6d4a1e', { rx: 8, stroke: INK, 'stroke-width': 4 }),
    box(dx, dy, dw, dh, WOOD, { rx: 4, stroke: INK, 'stroke-width': 4 }),
    line(`M${dx + 42} ${dy} V${dy + dh}  M${dx + 86} ${dy} V${dy + dh}`, { 'stroke-width': 3, opacity: 0.5 }),
    dot(dx + dw - 22, dy + dh / 2, 7, EMBER, { stroke: INK, 'stroke-width': 3 }),
    // the paw
    group({ class: 'pv-knock' },
      dot(dx + dw + 62, dy + dh / 2 - 14, 26, '#7c7c7c', { stroke: INK, 'stroke-width': 4 }),
      dot(dx + dw + 44, dy + dh / 2 - 38, 10, '#7c7c7c', { stroke: INK, 'stroke-width': 4 }),
      dot(dx + dw + 68, dy + dh / 2 - 44, 10, '#7c7c7c', { stroke: INK, 'stroke-width': 4 }),
      dot(dx + dw + 90, dy + dh / 2 - 34, 10, '#7c7c7c', { stroke: INK, 'stroke-width': 4 }),
    ),
  );
}

/** كيف يشعر؟ — one face, three ways. */
function faces() {
  const cx = PW / 2, cy = 104;
  const mood = (i, brows, mouth) => group({ class: 'pv-mood', style: `animation-delay:${i * 1.6}s` },
    line(brows, { 'stroke-width': 6 }), line(mouth, { 'stroke-width': 6 }));
  return group({},
    outdoors(0.88 * PH),
    dot(cx - 52, cy - 6, 18, FLEECE, { stroke: INK, 'stroke-width': 4 }),
    dot(cx + 52, cy - 6, 18, FLEECE, { stroke: INK, 'stroke-width': 4 }),
    dot(cx, cy, 56, WOOL, { stroke: INK, 'stroke-width': 4 }),
    dot(cx - 20, cy - 10, 5.5, INK), dot(cx + 20, cy - 10, 5.5, INK),
    mood(0, `M${cx - 32} ${cy - 28} l24 -6  M${cx + 32} ${cy - 28} l-24 -6`, `M${cx - 20} ${cy + 22} q20 18 40 0`),
    mood(1, `M${cx - 32} ${cy - 30} l24 8  M${cx + 32} ${cy - 30} l-24 8`, `M${cx - 20} ${cy + 30} q20 -18 40 0`),
    mood(2, `M${cx - 34} ${cy - 34} l26 12  M${cx + 34} ${cy - 34} l-26 12`, `M${cx - 18} ${cy + 26} h36`),
  );
}

export const PREVIEWS = { rebuild, chimney, whosaid, run, build, door, faces };

/** The keyframes every preview above refers to. Injected once by the menu. */
export const PREVIEW_CSS = `
.pv-slot  { animation: pvSlot 3.2s cubic-bezier(.3,.9,.4,1) infinite; }
.pv-flame { animation: pvFlame .5s ease-in-out infinite alternate; }
.pv-sweep { animation: pvSweep 1.9s cubic-bezier(.5,0,.5,1) infinite alternate; }
.pv-wave  { animation: pvWave 1.5s ease-out infinite; }
.pv-roll  { animation: pvRoll 2.7s linear infinite; }
.pv-hop   { animation: pvHop 1.35s cubic-bezier(.3,0,.5,1) infinite; }
.pv-pick  { animation: pvPick 3.6s steps(1, end) infinite; }
.pv-knock { animation: pvKnock 2.2s ease-in-out infinite; }
.pv-mood  { animation: pvMood 4.8s ease-in-out infinite; opacity: 0; }

@keyframes pvSlot {
  0%        { transform: translate(0, -110px); opacity: 0; }
  18%       { opacity: 1; }
  46%, 100% { transform: none; opacity: 1; }
}
@keyframes pvFlame { from { transform: scaleY(.86) } to { transform: scaleY(1.14) } }
@keyframes pvSweep { from { transform: translateX(0) } to { transform: translateX(136px) } }
@keyframes pvWave  { 0% { opacity: 0 } 30% { opacity: .95 } 100% { opacity: 0 } }
@keyframes pvRoll  { to { transform: translateX(-${PW + 90}px) } }
@keyframes pvHop {
  0%, 42%, 100% { transform: none; }
  20%           { transform: translateY(-46px); }
}
@keyframes pvPick {
  0%   { transform: none; }
  33%  { transform: translateX(118px); }
  66%  { transform: translateX(236px); }
}
@keyframes pvKnock {
  0%, 44%, 100% { transform: none; }
  12%, 30%      { transform: translateX(-34px); }
  21%           { transform: translateX(-8px); }
}
@keyframes pvMood { 0%, 26% { opacity: 1 } 34%, 100% { opacity: 0 } }
`;
