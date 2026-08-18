// The poster with its page crop released.
//
//   node tools/poster-unclipped.mjs   -> out/poster-unclipped.svg
//
// out/poster.svg is A3 — viewBox 0 0 842 1191 — with everything inside one
// group carrying clip-path="url(#page)". The artwork under that clip is wider
// than the page: it runs from x=-239 to x=1083.8, so 239 units of scene are
// cut off the left and 242 off the right.
//
// Dropping the clip and widening the viewBox to the real extent gives the
// whole painting, with the page sitting inside it. The deck opens the poster
// section on this and then fades the two wings away, so the poster resolves
// out of the scene it was cropped from instead of just appearing.
//
// The wing widths are printed as percentages of the full image, which is what
// present.html needs to place the two curtains.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'out/poster.svg');
const DST = path.join(ROOT, 'out/poster-unclipped.svg');

const src = fs.readFileSync(SRC, 'utf8');

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  await page.setContent(`<body style="margin:0">${src}</body>`, { waitUntil: 'networkidle0' });

  const m = await page.evaluate(() => {
    const svg = document.querySelector('svg');
    const [px, py, pw, ph] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    // Measure with the clip lifted: getBBox() reports geometry, but a clipped
    // group can still report its clipped extent in some engines, so take the
    // attribute off first and put it back after.
    const g = svg.querySelector('g[clip-path]');
    const clip = g?.getAttribute('clip-path') || null;
    if (g) g.removeAttribute('clip-path');
    const b = svg.getBBox();
    if (g && clip) g.setAttribute('clip-path', clip);
    return { page: { x: px, y: py, w: pw, h: ph },
             full: { x: b.x, y: b.y, w: b.width, h: b.height }, clip };
  });

  const P = m.page, F = m.full;
  // Keep the page's own height: the overflow here is horizontal only, and
  // matching heights is what lets the deck line the two states up by height
  // alone.
  const box = { x: F.x, y: P.y, w: F.w, h: P.h };
  const left = (P.x - box.x) / box.w;
  const right = ((box.x + box.w) - (P.x + P.w)) / box.w;

  console.log(`page      ${P.x} ${P.y} ${P.w} ${P.h}`);
  console.log(`full      ${F.x.toFixed(2)} ${F.y.toFixed(2)} ${F.w.toFixed(2)} ${F.h.toFixed(2)}`);
  console.log(`clip was  ${m.clip}`);
  console.log(`\nwings, as a share of the unclipped width:`);
  console.log(`  left   ${(left * 100).toFixed(3)}%`);
  console.log(`  right  ${(right * 100).toFixed(3)}%`);
  console.log(`  page   ${((1 - left - right) * 100).toFixed(3)}%`);
  console.log(`  aspect ${box.w.toFixed(2)} / ${box.h.toFixed(2)}`);

  // Release the clip and widen the frame.
  let out = src.replace(/\sclip-path="url\(#page\)"/, '');
  if (out === src) {
    console.error('the page clip was not found — poster.svg has changed shape');
    process.exit(1);
  }
  out = out.replace(/viewBox="[^"]*"/, `viewBox="${box.x} ${box.y} ${box.w} ${box.h}"`)
           .replace(/\swidth="[^"]*"/, ` width="${box.w.toFixed(2)}"`)
           .replace(/\sheight="[^"]*"/, ` height="${box.h.toFixed(2)}"`);
  fs.writeFileSync(DST, out);
  console.log(`\nwrote ${path.relative(ROOT, DST)}  ${(out.length / 1024).toFixed(0)} KB`);
} finally {
  await browser.close();
}
