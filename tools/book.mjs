// Build the picture book into a single self-contained HTML document.
//
//   node tools/book.mjs                 -> out/book.html
//   node tools/book.mjs --png           -> also out/book/pageNN.png
//
// Every page is inlined as SVG, and the fonts are already base64 in
// assets/fonts/embed.css, so the file opens anywhere with no other assets —
// hand it over on a USB stick and it still works.
//
// Print: the stylesheet sets @page to landscape and one page per sheet, so
// Chrome's "Save as PDF" produces the book directly.

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { serve } from './serve.mjs';
import { buildArt } from './book-art.mjs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const wantPng = process.argv.includes('--png');
const wantCorners = process.argv.includes('--corners');

// The pages are drawings now, and the renderer fetches them as WebP. Encoding
// them here rather than expecting a separate step means a fresh clone builds
// the book in one command; unchanged pages are skipped, so it costs nothing.
const encoded = buildArt();
if (encoded) console.log(`art    ${encoded} page${encoded === 1 ? '' : 's'} re-encoded`);

const { server, port, root } = await serve(0);
const OUT = path.join(root, 'out');
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--font-render-hinting=none', '--force-color-profile=srgb', '--hide-scrollbars'],
});

let code = 0;
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`http://127.0.0.1:${port}/web/film.html?target=book`,
    { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.__ready === true', { timeout: 180000 });

  const err = await page.evaluate(() => window.__error);
  if (err) throw new Error(err);

  const data = await page.evaluate(() => {
    const svgs = [...document.querySelectorAll('#stage svg.page')];
    return {
      meta: window.__book,
      pages: svgs.map((s) => ({ id: s.getAttribute('data-page'), svg: s.outerHTML })),
    };
  });

  const html = document(data);
  const outFile = path.join(OUT, 'book.html');
  fs.writeFileSync(outFile, html);

  if (wantPng) {
    const dir = path.join(OUT, 'book');
    fs.mkdirSync(dir, { recursive: true });
    const shot = await browser.newPage();
    await shot.setViewport({ width: data.meta.width, height: data.meta.height });
    await shot.goto('file://' + outFile, { waitUntil: 'networkidle0' });
    const els = await shot.$$('.sheet svg');
    for (let i = 0; i < els.length; i++) {
      const n = String(i).padStart(2, '0');
      await els[i].screenshot({ path: path.join(dir, `page${n}.png`) });
    }
    console.log(`png    out/book/  (${els.length} pages)`);
  }

  const mb = (fs.statSync(outFile).size / 1048576).toFixed(1);
  console.log(`book   out/book.html  (${data.pages.length} pages, ${mb} MB)`);
  if (wantCorners && data.meta.corners) {
    console.log('\nnarration card, and the detail it found in each corner:');
    console.log(data.meta.corners);
  }
  if (errors.length) {
    console.log('\npage errors:');
    for (const e of [...new Set(errors)].slice(0, 6)) console.log('  ' + e);
  }
} catch (e) {
  console.error(e.message);
  code = 1;
} finally {
  await browser.close();
  server.close();
}
process.exit(code);

function document({ meta, pages }) {
  const sheets = pages.map((p, i) => `
<section class="sheet" id="${p.id}">
  ${p.svg}
  ${i === 0 ? '' : `<div class="folio">${toArabicDigits(i)}</div>`}
</section>`).join('\n');

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${meta.title}</title>
<style>
${meta.fontCss}

:root { --ink:#241606; --cream:#FFF6DC; --paper:#2a2018; }

* { box-sizing: border-box; }
html, body { margin:0; padding:0; background:var(--paper); }
body { font-family:'Poster Text', system-ui, sans-serif; }

.sheet {
  position: relative;
  width: min(100%, 1280px);
  margin: 0 auto 28px;
  background:#000;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 12px 34px rgba(0,0,0,.45);
}
.sheet svg { display:block; width:100%; height:auto; }

.folio {
  position:absolute; inset:auto 0 12px 0; text-align:center;
  color:#fff; opacity:.62; font-size:15px; letter-spacing:2px;
  text-shadow:0 1px 3px rgba(0,0,0,.8); pointer-events:none;
}

/* --- text inside the pages ------------------------------------------- */
.narr, .bub, .cover, .moral {
  height:100%; display:flex; flex-direction:column; justify-content:center;
  direction:rtl; text-align:center; color:var(--ink);
}
.narr p, .bub p, .moral p, .cover h1, .cover h2 { margin:0; }

.narr p   { font-family:'Poster Text',sans-serif; font-weight:600;
            font-size:33px; line-height:1.42; }
.bub p    { font-family:'Poster Text',sans-serif; font-weight:700;
            font-size:31px; line-height:1.34; }
.cover    { text-align:center; }
.cover h1 { font-family:'Poster Display',sans-serif; font-weight:800;
            font-size:96px; line-height:1.12; color:var(--cream);
            -webkit-text-stroke:9px var(--ink); paint-order:stroke fill; }
.cover h2 { font-family:'Poster Text',sans-serif; font-weight:600;
            font-size:34px; margin-top:20px; color:#fff; opacity:.92; }
.moral p  { font-family:'Poster Display',sans-serif; font-weight:800;
            font-size:52px; line-height:1.3; color:var(--cream);
            -webkit-text-stroke:6px var(--ink); paint-order:stroke fill; }

/* --- print: one page per sheet, landscape ---------------------------- */
@page { size: 297mm 167mm; margin: 0; }
@media print {
  body { background:#fff; }
  .sheet { width:100%; margin:0; border-radius:0; box-shadow:none;
           break-after:page; page-break-after:always; }
  .sheet:last-child { break-after:auto; page-break-after:auto; }
  .folio { color:#fff; }
}
</style>
</head>
<body>
${sheets}
</body>
</html>
`;
}

/** Folio numbers in Arabic-Indic digits, to match the text. */
function toArabicDigits(n) {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);
}
