// Find an open green framing with no house in shot, for the brothers beat.

import { svgEl } from '../rig.js';
import { loadScene, camTransform, SCENE_W, SCENE_H } from '../anim/stage.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const CW = 640, CH = 360;

const CANDIDATES = [
  ['مشهد8', 1.15, 0.30, 0.55],
  ['مشهد8', 1.25, 0.66, 0.55],
  ['خلفيه 2', 1.3, 0.16, 0.55],
  ['خلفيه 2', 1.3, 0.84, 0.55],
  ['مشهد9', 1.3, 0.18, 0.55],
  ['مشهد14', 1.3, 0.28, 0.55],
];

const view = (zoom, cx, cy) => {
  const w = SCENE_W / zoom, h = SCENE_H / zoom;
  return { x: SCENE_W * cx - w / 2, y: SCENE_H * cy - h / 2, w, h };
};

export default async function testOpen() {
  const cols = 2, rows = Math.ceil(CANDIDATES.length / cols);
  const svg = svgEl('svg', {
    xmlns: SVGNS, width: CW * cols, height: CH * rows,
    viewBox: `0 0 ${CW * cols} ${CH * rows}`,
  });
  document.getElementById('stage').appendChild(svg);

  for (let i = 0; i < CANDIDATES.length; i++) {
    const [name, zoom, cx, cy] = CANDIDATES[i];
    const cell = svgEl('svg', {
      x: (i % cols) * CW, y: Math.floor(i / cols) * CH,
      width: CW, height: CH, viewBox: `0 0 ${CW} ${CH}`,
    });
    svg.appendChild(cell);
    const camG = svgEl('g', { transform: camTransform(view(zoom, cx, cy), CW, CH) });
    camG.appendChild(await loadScene(name));
    cell.appendChild(camG);

    const t = svgEl('text', {
      x: 14, y: CH - 14, 'font-size': 24, fill: '#fff',
      stroke: '#000', 'stroke-width': 5, 'paint-order': 'stroke',
      'font-family': 'monospace', direction: 'ltr',
    });
    t.textContent = `${i + 1}. ${name}  z${zoom} c${cx}`;
    cell.appendChild(t);
    cell.appendChild(svgEl('rect', { x: 1, y: 1, width: CW - 2, height: CH - 2, fill: 'none', stroke: '#000', 'stroke-width': 2 }));
  }
  return svg;
}
