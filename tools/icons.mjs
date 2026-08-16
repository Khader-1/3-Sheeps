// App icons, cut from a sheep's own head.
//
//   node tools/icons.mjs
//
// The icon used to be a wolf silhouette I drew by hand, which had nothing to
// do with the film. This takes the real artwork instead: load the character,
// isolate the head group, measure where it actually sits, and crop to it.
//
// Measuring has to happen in a browser — getBBox() is the only thing that
// knows how big a path is, and a head is a group of thirty-odd of them.
//
// The middle brother is the face used: all three sheep share identical face
// artwork, and only the eldest has horns, which crowd the frame at icon size.
//
// Backgrounds are per-platform, not a style choice:
//   transparent   tab favicon and the manifest's "any" icons — the head reads
//                 against light or dark chrome without a slab behind it
//   opaque green  the maskable icon, which Android crops to a circle and
//                 composites against nothing, and the iOS home-screen tile,
//                 which iOS composites onto black.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { serve } from './serve.mjs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'web/icons');

const CHARACTER = 'mid';
const GREEN = '#1d2b12';

const { server, port } = await serve(0);
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--font-render-hinting=none'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 700, height: 700 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('response', (r) => {
    // The browser asks for a favicon on every page and the preview server has
    // none; that 404 is noise, not a missing asset.
    if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) {
      errs.push(`HTTP ${r.status()} ${decodeURIComponent(r.url())}`);
    }
  });

  await page.goto(`http://127.0.0.1:${port}/web/blank.html`, { waitUntil: 'domcontentloaded' });

  // Pull the head out of the rig and hand back both its geometry and its
  // markup, so the icon can be assembled as plain SVG afterwards.
  const head = await page.evaluate(async (key) => {
    const { loadCharacter, applyExpression } = await import('/src/expressions.js');
    const { bboxIn } = await import('/src/rig.js');

    const rig = await loadCharacter(key, 'front');

    // Mount before posing. A pivot is a fraction of the part's bounding box,
    // and a detached node measures as zero — pose it first and the brows and
    // mouth rotate about the rig origin instead of themselves.
    const host = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    host.setAttribute('viewBox', '0 0 1280 720');
    document.body.appendChild(host);
    host.appendChild(rig.node);
    rig.ready();

    // A friendly face: the icon is the first thing a child sees on the home
    // screen, and the default pose is a flat stare.
    applyExpression(rig, 'happy');

    const group = rig.part(rig.face.head);
    const skull = bboxIn(rig.part(`${rig.face.head}/الراس`), rig.node);
    const touches = (a, b) => !(a.x + a.width < b.x || b.x + b.width < a.x ||
                                a.y + a.height < b.y || b.y + b.height < a.y);

    // Nothing should be off the skull, but crop defensively: a part stranded
    // outside the face would otherwise stretch the frame to make room for it.
    const dropped = [];
    for (const c of [...group.children]) {
      if (!touches(bboxIn(c, rig.node), skull)) {
        dropped.push(c.getAttribute('data-part'));
        c.remove();
      }
    }

    const b = bboxIn(group, rig.node);
    return { markup: new XMLSerializer().serializeToString(group), dropped,
             x: b.x, y: b.y, width: b.width, height: b.height };
  }, CHARACTER);

  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  console.log(`head  ${CHARACTER}  ${head.width.toFixed(0)} x ${head.height.toFixed(0)}` +
              (head.dropped.length ? `  (dropped off-model: ${head.dropped.join(', ')})` : ''));

  /**
   * @param {number} fill how much of the tile the head spans, 0..1
   * @param {string|null} bg background colour, or null for transparent
   */
  const iconSvg = (size, fill, bg) => {
    // Fit the longer side, so a head wider than it is tall still sits inside
    // the tile rather than running off the edges.
    const s = (100 * fill) / Math.max(head.width, head.height);
    const tx = 50 - (head.x + head.width / 2) * s;
    const ty = 50 - (head.y + head.height / 2) * s;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  ${bg ? `<rect width="100" height="100" fill="${bg}"/>` : ''}
  <g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${s.toFixed(5)})">${head.markup}</g>
</svg>`;
  };

  fs.mkdirSync(OUT, { recursive: true });
  const specs = [
    ['icon-192', 192, 0.94, null],
    ['icon-512', 512, 0.94, null],
    // iOS uses this one for the home screen and ignores the manifest icons.
    // Opaque, unlike the others: iOS composites a transparent apple-touch-icon
    // onto black, so "no background" there means a black tile rather than the
    // clean cut-out it gives a browser tab.
    ['apple-touch-icon', 180, 0.80, GREEN],
    // Android masks to a circle and can crop up to 20% off each edge, so the
    // head has to stay well inside the tile — hence the tighter fill.
    ['maskable-512', 512, 0.60, GREEN],
  ];

  for (const [name, size, fill, bg] of specs) {
    const file = path.join(OUT, `${name}.svg`);
    fs.writeFileSync(file, iconSvg(size, fill, bg));
    const shot = await browser.newPage();
    await shot.setViewport({ width: size, height: size });
    await shot.goto('file://' + file, { waitUntil: 'networkidle0' });
    await shot.screenshot({ path: path.join(OUT, `${name}.png`), omitBackground: !bg });
    await shot.close();
    console.log(`icon  ${name}.png  ${size}x${size}${bg ? '' : '  transparent'}`);
  }

  // A vector favicon, so the tab stays crisp at any density.
  fs.writeFileSync(path.join(OUT, 'icon.svg'), iconSvg(64, 0.94, null));
  console.log('icon  icon.svg');
} finally {
  await browser.close();
  server.close();
}
