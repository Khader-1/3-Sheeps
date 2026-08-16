// Measure the existing poster so its background layers can be reused.

import { fetchText } from '../rig.js';

export const POSTER = '/assets/incoming/خلفيات/ملصق-الخراف-الثلاثة.svg';

export default async function inspectPoster() {
  const text = await fetchText(POSTER);
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;

  const holder = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  holder.style.position = 'absolute';
  holder.style.opacity = '0';
  document.body.appendChild(holder);
  const imported = document.importNode(svg, true);
  holder.appendChild(imported);

  const lines = [`viewBox: ${svg.getAttribute('viewBox')}`];
  lines.push(`\n${'group'.padEnd(26)} ${'x'.padStart(8)} ${'y'.padStart(8)} ${'w'.padStart(8)} ${'h'.padStart(8)}`);
  for (const g of imported.querySelectorAll(':scope > g')) {
    const b = g.getBBox();
    lines.push(
      `${(g.getAttribute('id') || '?').padEnd(26)} ${f(b.x)} ${f(b.y)} ${f(b.width)} ${f(b.height)}`
    );
  }

  // Overall content extent, ignoring any full-bleed background rect.
  const all = imported.getBBox();
  lines.push(`\ntotal content bbox: ${f(all.x)} ${f(all.y)} ${f(all.width)} ${f(all.height)}`);

  holder.remove();
  window.__log = lines.join('\n');
  return null;
}

const f = (n) => String(Math.round(n)).padStart(8);
