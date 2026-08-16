// Proof for the fragment-reveal camera: frame five wolf body parts by name
// and lay the results out as a contact sheet, so the framings can be judged
// before they are cut into the teaser.

import { svgEl, fetchText } from '../rig.js';
import { loadScene, frameOn, camTransform, SCENE_W, SCENE_H } from '../anim/stage.js';
import { loadCharacter, applyExpression } from '../expressions.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const CW = 640, CH = 360;   // one cell = 16:9

// The reveal order: extremities first, face last.
const FRAGMENTS = [
  { label: 'paw',   part: 'اليد_ق/الكف',            pad: 3.4 },
  { label: 'tail',  part: 'الذيل',                   pad: 2.2 },
  { label: 'snout', part: 'الراس/الانف',             pad: 5.0 },
  { label: 'eye',   part: 'الراس/العين/العدسه',      pad: 7.0 },
  { label: 'teeth', part: 'الراس/الفم',              pad: 3.0 },
  { label: 'whole', part: null,                      pad: 1.15 },
];

export default async function testFragments() {
  const cols = 2;
  const rows = Math.ceil(FRAGMENTS.length / cols);

  const svg = svgEl('svg', {
    xmlns: SVGNS, 'xmlns:xlink': 'http://www.w3.org/1999/xlink',
    width: CW * cols, height: CH * rows,
    viewBox: `0 0 ${CW * cols} ${CH * rows}`,
  });
  document.getElementById('stage').appendChild(svg);

  const fontCss = await fetchText('/assets/fonts/embed.css');
  const style = document.createElementNS(SVGNS, 'style');
  style.textContent = `${fontCss}.lbl{font-family:'Poster Text',sans-serif;font-weight:700;}`;
  svg.appendChild(style);

  const defs = document.createElementNS(SVGNS, 'defs');
  svg.appendChild(defs);

  const log = [];

  for (let i = 0; i < FRAGMENTS.length; i++) {
    const f = FRAGMENTS[i];
    const cx = (i % cols) * CW;
    const cy = Math.floor(i / cols) * CH;

    // A nested <svg> is its own viewport and clips its contents automatically —
    // far more reliable than a clipPath, whose coordinates get tangled up with
    // the group's own transform.
    const cell = svgEl('svg', {
      x: cx, y: cy, width: CW, height: CH,
      viewBox: `0 0 ${CW} ${CH}`, overflow: 'hidden',
    });
    svg.appendChild(cell);

    // camG is the space the camera works in; the scene and the wolf share it.
    const camG = svgEl('g');
    cell.appendChild(camG);
    camG.appendChild(await loadScene('مشهد8'));

    const wolf = await loadCharacter('wolf', 'side');
    const holder = svgEl('g');
    holder.appendChild(wolf.node);
    camG.appendChild(holder);

    applyExpression(wolf, 'menacing');
    wolf.poseAll({
      [wolf.face.head]: { rotate: 7, pivot: [0.15, 0.9] },
      [wolf.face.armNear]: { rotate: -20, pivot: [0.5, 0.05] },
    });
    wolf.place({ x: 640, y: 690, height: 470, flip: true });

    // Frame the named part — or the whole rig for the payoff shot.
    const target = f.part ? wolf.part(f.part, { optional: true }) : wolf.node;
    if (!target) {
      log.push(`${f.label.padEnd(6)} PART NOT FOUND: ${f.part}`);
      continue;
    }
    const rect = frameOn(target, camG, { pad: f.pad, aspect: CW / CH });
    camG.setAttribute('transform', camTransform(rect, CW, CH));

    log.push(
      `${f.label.padEnd(6)} pad ${String(f.pad).padStart(4)}  ->  ` +
      `x ${rect.x.toFixed(0).padStart(6)} y ${rect.y.toFixed(0).padStart(6)} ` +
      `w ${rect.w.toFixed(0).padStart(5)} h ${rect.h.toFixed(0).padStart(5)}`
    );

    // Label
    const t = svgEl('text', {
      x: 16, y: CH - 16, class: 'lbl', 'font-size': 26,
      fill: '#fff', stroke: '#000', 'stroke-width': 5,
      'paint-order': 'stroke', direction: 'ltr',
    });
    t.textContent = `${i + 1}. ${f.label}`;
    cell.appendChild(t);
    cell.appendChild(svgEl('rect', {
      x: 1, y: 1, width: CW - 2, height: CH - 2,
      fill: 'none', stroke: '#000', 'stroke-width': 2, opacity: 0.5,
    }));
  }

  window.__log = log.join('\n');
  return svg;
}
