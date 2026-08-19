// Compress the delivered promo videos for the web.
//
//   node tools/promos.mjs          -> out/promo-N.mp4 for each incoming file
//   node tools/promos.mjs --force  -> re-encode even if up to date
//
// The deck's first trailer is built by this project — tools/render.mjs draws
// it frame by frame and encodes at CRF 17, which is nearly lossless because
// the frames are the source. The others arrive finished, at whatever bitrate
// the editor exported: the first was 1080p24 at 8.2 Mbps, 28 MB for 27
// seconds.
//
// That has to come down for two reasons. Cloudflare Pages refuses any single
// file over 25 MiB, so a straight copy would not deploy at all. And the
// footage is flat cartoon animation — large areas of one colour, hard edges,
// little grain — which x264 encodes far below its usual rate. CRF 20 on the
// first one lands at 5.6 MB, a fifth of the delivered size, and putting the
// two side by side at full screen shows no difference.
//
// Re-encoding rather than remuxing does cost a generation. It is worth it
// here: the alternative is not shipping the file.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets/incoming/إعلانات');
const OUT = path.join(ROOT, 'out');

const CRF = '20';

/**
 * Encode every delivered promo whose source is newer than its output.
 *
 * A file named N.mp4 becomes out/promo-N.mp4, which is the name present.html
 * asks for. Numbering the sources is the whole ordering mechanism — the deck
 * shows إعلان ١، إعلان ٢ in that order.
 */
export function buildPromos({ force = false } = {}) {
  if (!fs.existsSync(SRC)) return [];
  const made = [];

  for (const name of fs.readdirSync(SRC).sort()) {
    if (!/^[0-9]+\.mp4$/.test(name)) continue;
    const src = path.join(SRC, name);
    const dst = path.join(OUT, `promo-${name}`);
    if (!force && fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs) continue;

    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF,
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      '-c:a', 'aac', '-b:a', '192k', dst]);
    made.push(path.relative(ROOT, dst));
  }

  return made;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const made = buildPromos({ force: process.argv.includes('--force') });
  if (!made.length) {
    console.log('promos  nothing to do');
  } else {
    for (const f of made) {
      const mb = (fs.statSync(path.join(ROOT, f)).size / 1048576).toFixed(1);
      console.log(`promo   ${f}  (${mb} MB)`);
    }
  }
}
