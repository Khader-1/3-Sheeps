// Discovery target: report the real part paths and geometry of each rig so
// poses and expressions can be written against actual names, not guesses.

import { Rig, fetchText } from '../rig.js';
import { CHARACTERS, VIEW } from '../characters.js';

export default async function inspect() {
  const lines = [];
  for (const [key, c] of Object.entries(CHARACTERS)) {
    const text = await fetchText(c.file);
    lines.push(`\n===== ${key}  (${c.file.split('/').pop()}) =====`);

    // Which top-level views exist?
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const views = [...doc.documentElement.children]
      .filter((e) => e.tagName === 'g')
      .map((e) => e.getAttribute('id'));
    lines.push(`views: ${views.join('  |  ')}`);

    for (const v of views) {
      const rig = new Rig(text, { view: v, name: key });
      // Must be in the document for getBBox() to report real numbers.
      const holder = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      holder.setAttribute('width', '1280');
      holder.setAttribute('height', '720');
      holder.style.position = 'absolute';
      holder.style.opacity = '0';
      holder.appendChild(rig.node);
      document.body.appendChild(holder);

      const b = rig.bbox();
      lines.push(`\n  --- view "${v}"  bbox ${f(b.x)},${f(b.y)} ${f(b.width)}×${f(b.height)}`);

      const interesting = /الحاجب|العدسه|البؤبؤ|العين|الفم|الراس|الوجه|قرن|الاذن/;
      const face = [];
      const body = [];
      for (const p of rig.paths()) {
        const leaf = p.split('/').pop();
        (interesting.test(leaf) ? face : body).push(p);
      }
      lines.push(`  body/limbs (${body.length}):`);
      for (const p of body) {
        const bb = rig.part(p).getBBox();
        lines.push(`     ${p}   @ ${f(bb.x)},${f(bb.y)} ${f(bb.width)}×${f(bb.height)}`);
      }
      lines.push(`  face (${face.length}):`);
      for (const p of face) {
        const bb = rig.part(p).getBBox();
        lines.push(`     ${p}   @ ${f(bb.x)},${f(bb.y)} ${f(bb.width)}×${f(bb.height)}`);
      }

      holder.remove();
    }
  }
  window.__log = lines.join('\n');
  return null;
}

const f = (n) => Math.round(n);
export { VIEW };
