// Tame a harsh instrument in a generated cue, without regenerating it.
//
//   node tools/music-tame.mjs out/music/intro-fanfare.wav
//
// Writes variants next to the source plus a comparison track, so the amount of
// taming can be chosen by ear instead of guessed.
//
// Regenerating with a revised prompt is the real fix, but it costs half an hour
// per cue and the model may change other things you liked. EQ costs seconds and
// changes only what you point it at, so it is worth trying first.
//
// The bands are the usual suspects for "sharp": 2kHz is trumpet bite, 6.3kHz is
// cymbal and triangle sizzle. Both measured as peaks in this cue.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.error('usage: node tools/music-tame.mjs <file.wav>');
  process.exit(1);
}
const dir = path.dirname(src);
const stem = path.basename(src, path.extname(src));

const VARIANTS = [
  ['0-original', '', 'الأصل'],
  ['1-gentle',
    'equalizer=f=2000:t=q:w=1.1:g=-3',
    'تخفيف خفيف — 2k فقط'],
  ['2-balanced',
    'equalizer=f=2000:t=q:w=1.1:g=-4,highshelf=f=6000:g=-3',
    'متوازن — 2k و ما فوق 6k'],
  ['3-soft',
    'equalizer=f=2000:t=q:w=1.0:g=-6,equalizer=f=3150:t=q:w=1.4:g=-3,highshelf=f=6000:g=-5',
    'ناعم — تخفيف أقوى'],
];

const made = [];
for (const [key, chain, label] of VARIANTS) {
  const dst = path.join(dir, `${stem}--${key}.wav`);
  const af = (chain ? chain + ',' : '') + 'loudnorm=I=-16:TP=-1.0';
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src,
    '-af', af, '-ar', '48000', dst], { stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status !== 0) continue;
  made.push({ key, dst, label });
  console.log(`  ${key.padEnd(12)} ${label}`);
}

// Loudness-matched so the comparison is about tone, not level — a quieter
// version always sounds smoother, which would make the choice meaningless.
const args = ['-y', '-loglevel', 'error'];
const parts = [];
made.forEach((m, i) => {
  args.push('-i', m.dst);
  parts.push(`[${i}:a]aresample=48000,apad=pad_dur=1.0[a${i}]`);
});
parts.push(made.map((_, i) => `[a${i}]`).join('') + `concat=n=${made.length}:v=0:a=1[out]`);
const cmp = path.join(dir, `${stem}--compare.m4a`);
args.push('-filter_complex', parts.join(';'), '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', cmp);
spawnSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] });

console.log(`\n${cmp} — in order:`);
made.forEach((m, i) => console.log(`  ${i + 1}. ${m.label}`));
