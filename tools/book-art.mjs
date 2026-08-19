// Compress the delivered book artwork for tools/book.mjs.
//
//   node tools/book-art.mjs          -> out/book-art/pNN.webp
//   node tools/book-art.mjs --force  -> rebuild even if up to date
//
// The pages arrived as 22 full-frame PNGs at 1922×1082, one per story page,
// numbered the way the book is. They are the drawing now: the book used to
// stage each page out of a background set plus posed character rigs, and these
// replace that entirely.
//
// They are also 23 MB, and book.html inlines every page as a data URI so the
// file works off a USB stick. Straight PNG would make a 30 MB document. The
// art is flat vector-style colour with hard edges, which is exactly what WebP
// handles well — quality 92 lands around 200 KB a page, a twelfth of the size,
// with no visible ringing along the linework.
//
// Kept at roughly native size rather than the book's 1280: the print
// stylesheet puts a page across 297 mm, and 1920 px is 164 dpi there
// against 109.
//
// The frames carry a black hairline all the way round — two pixels on the
// left, top and right and one along the bottom, on every one of the 22, so it
// is the render's own letterbox and not something in the drawings. Left in it
// would show as a dark seam against the page's black sheet backing. Cropping
// it away leaves 1918×1079, which is 16:9 to within a pixel; the scale back up
// to 1920×1080 makes the aspect exact so the <image> needs no slicing.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets/incoming/كتاب');
const OUT = path.join(ROOT, 'out/book-art');

/** Which page each delivered number is. The cover keeps its staged artwork. */
export const ART_PAGES = [
  'p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08', 'p09', 'p10', 'p11',
  'p12', 'p13', 'p14', 'p15', 'p16', 'p17', 'p18', 'p19', 'p20', 'p21', 'end',
];

/**
 * Convert any page whose source is newer than its WebP.
 *
 * Returns the number actually re-encoded, so book.mjs can say so. cwebp at
 * -m 6 takes about a second a page; skipping unchanged ones keeps a book
 * rebuild instant.
 */
export function buildArt({ force = false } = {}) {
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = path.join(OUT, '.crop.png');
  let made = 0;

  ART_PAGES.forEach((id, i) => {
    const src = path.join(SRC, `${String(i + 1).padStart(2, '0')}.png`);
    const dst = path.join(OUT, `${id}.webp`);
    if (!fs.existsSync(src)) throw new Error(`missing book art: ${path.relative(ROOT, src)}`);
    if (!force && fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs) return;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src,
      '-vf', 'crop=1918:1079:2:2,scale=1920:1080:flags=lanczos', tmp]);
    execFileSync('cwebp', ['-quiet', '-q', '92', '-m', '6', tmp, '-o', dst]);
    made++;
  });

  fs.rmSync(tmp, { force: true });
  return made;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const made = buildArt({ force: process.argv.includes('--force') });
  const bytes = ART_PAGES.reduce((n, id) => n + fs.statSync(path.join(OUT, `${id}.webp`)).size, 0);
  console.log(`art    out/book-art/  (${ART_PAGES.length} pages, ${made} re-encoded, ${(bytes / 1048576).toFixed(1)} MB)`);
}
