// Measure the painted extent of every scene background. All of them declare
// a 1280×720 canvas, but the artwork inside does not always fill it — which
// shows up as black edges once the camera frames the full canvas.

import { loadScene, SCENE_W, SCENE_H } from '../anim/stage.js';
import { svgEl } from '../rig.js';

const SCENES = [
  'خلفيه 1', 'خلفيه 2', 'خلفيات 3و4و2',
  'مشهد5', 'مشهد6', 'مشهد7', 'مشهد8', 'مشهد9', 'مشهد10',
  'مشهد11', 'مشهد12', 'مشهد13', 'مشهد14', 'مشهد15', 'مشهد16',
  'مشهد16جزء2', 'مشهد17و18', 'مشهد19', 'مشهد20', 'مشهد21',
  'مشهد22', 'مشهد22جزء 2', 'مشهد23', 'مشهد24', 'مشهد25',
  'مشهد25جزء2', 'مشهد26', 'المشهد27الاخير',
];

export default async function inspectScenes() {
  const host = svgEl('svg', { width: SCENE_W, height: SCENE_H, viewBox: `0 0 ${SCENE_W} ${SCENE_H}` });
  host.style.position = 'absolute';
  host.style.opacity = '0';
  document.body.appendChild(host);

  const rows = [`${'scene'.padEnd(18)} ${'x'.padStart(7)} ${'y'.padStart(7)} ${'w'.padStart(7)} ${'h'.padStart(7)}   covers 1280x720?`];
  for (const name of SCENES) {
    let g;
    try {
      g = await loadScene(name);
    } catch (e) {
      rows.push(`${name.padEnd(18)}  LOAD FAILED`);
      continue;
    }
    host.appendChild(g);
    const b = g.getBBox();
    host.removeChild(g);

    const covers = b.x <= 1 && b.y <= 1 && b.x + b.width >= SCENE_W - 1 && b.y + b.height >= SCENE_H - 1;
    rows.push(
      `${name.padEnd(18)} ${f(b.x)} ${f(b.y)} ${f(b.width)} ${f(b.height)}   ${covers ? 'yes' : 'NO'}`
    );
  }
  host.remove();
  window.__log = rows.join('\n');
  return null;
}

const f = (n) => String(Math.round(n)).padStart(7);
