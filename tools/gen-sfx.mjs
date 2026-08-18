// Synthesize the film's sound effects.
//
//   node tools/gen-sfx.mjs            build any that are missing
//   node tools/gen-sfx.mjs --force    rebuild everything
//
// The project has no sound effects at all — every recording in assets/audio is
// a voice. Rather than block on sourcing a library, these are generated from
// ffmpeg's own oscillators and noise sources, so they cost nothing, carry no
// licence, and are reproducible.
//
// They are deliberately plain: filtered noise with the right envelope reads as
// the right object at low volume under dialogue. Each one is a normal .wav in
// assets/audio/sfx/, so any can be replaced with a real recording later
// without touching the mix — same filename, same rough length.
//
// The vocabulary:
//   forest     wind through leaves, the outdoor bed
//   chirp      a two-note bird, for the calm opening only
//   step-grass a hoof on grass
//   step-wolf  the same, heavier and with a low thump under it
//   knock      one rap on a wooden door
//   breath     a slow predatory inhale
//   growl      low rumbling growl
//   whoosh     a cut accent between the reveal fragments
//   impact     the hit under the title flash
//   page-turn  one page going over, for the deck's book

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'assets/audio/sfx');
const force = process.argv.includes('--force');
const R = 48000;

const noise = (colour, d, a = 1) => `anoisesrc=c=${colour}:r=${R}:d=${d}:a=${a}`;
const tone = (f, d) => `sine=frequency=${f}:duration=${d}:sample_rate=${R}`;

/**
 * Each entry is a list of lavfi sources plus a filter_complex that has to end
 * in [out]. Durations are generous; the mix trims what it needs.
 */
const SFX = {
  // Two noise layers on different slow tremolos: a low body that swells like
  // wind, and a high band that hisses like leaves. Different tremolo rates
  // keep them from pulsing together, which is what makes a loop obvious.
  'forest.wav': {
    src: [noise('pink', 30, 0.55), noise('white', 30, 0.3)],
    f: `[0:a]lowpass=f=1100,highpass=f=110,tremolo=f=0.1:d=0.55,volume=0.9[low];
        [1:a]bandpass=f=3000:width_type=q:w=0.9,tremolo=f=0.23:d=0.6,volume=0.22[high];
        [low][high]amix=inputs=2:normalize=0,
        afade=t=in:st=0:d=1.2,afade=t=out:st=28.5:d=1.5[out]`,
  },

  // Two descending notes. A single tone reads as a test beep; the interval is
  // what makes it a bird.
  'chirp.wav': {
    src: [tone(2650, 0.06), tone(2050, 0.05)],
    f: `[0:a]afade=t=in:st=0:d=0.008,afade=t=out:st=0.02:d=0.04:curve=exp[a];
        [1:a]afade=t=in:st=0:d=0.008,afade=t=out:st=0.015:d=0.035:curve=exp,
             adelay=85|85[b];
        [a][b]amix=inputs=2:normalize=0,volume=0.5,
        aecho=0.6:0.4:55:0.16,apad=pad_dur=0.2[out]`,
  },

  // A hoof on grass is a broadband crackle with almost no tail — the fast
  // exponential fade is what stops it sounding like a snare.
  'step-grass.wav': {
    src: [noise('pink', 0.2, 0.8)],
    f: `[0:a]highpass=f=650,lowpass=f=7000,
        afade=t=out:st=0.004:d=0.085:curve=exp,volume=1.4[out]`,
  },

  // Same crackle, lower and slower, over a soft thump for the wolf's weight.
  'step-wolf.wav': {
    src: [noise('pink', 0.3, 0.8), tone(58, 0.3)],
    f: `[0:a]highpass=f=380,lowpass=f=4200,
        afade=t=out:st=0.006:d=0.14:curve=exp,volume=1.3[n];
        [1:a]afade=t=out:st=0:d=0.17:curve=exp,volume=0.7[t];
        [n][t]amix=inputs=2:normalize=0,alimiter=limit=0.92[out]`,
  },

  // A knock is a click plus the door's own resonance. The bandpass around
  // 300Hz is the wooden panel; the low sine is the frame taking the hit.
  'knock.wav': {
    src: [noise('pink', 0.32, 0.95), tone(96, 0.32)],
    f: `[0:a]bandpass=f=310:width_type=q:w=0.75,volume=3.2,
        afade=t=out:st=0.005:d=0.1:curve=exp[n];
        [1:a]volume=0.6,afade=t=out:st=0:d=0.15:curve=exp[l];
        [n][l]amix=inputs=2:normalize=0,alimiter=limit=0.9[out]`,
  },

  // Slow in, slower out — an inhale, not a gust.
  'breath.wav': {
    src: [noise('white', 1.1, 0.7)],
    f: `[0:a]bandpass=f=850:width_type=q:w=1.4,
        afade=t=in:st=0:d=0.3,afade=t=out:st=0.55:d=0.5,volume=1.6[out]`,
  },

  // Brown noise gives the low rumble; the tremolo at 30Hz is the actual growl
  // — that flutter rate is what the ear reads as an animal rather than noise.
  'growl.wav': {
    src: [noise('brown', 1.8, 0.9), tone(64, 1.8)],
    f: `[0:a]lowpass=f=520,tremolo=f=30:d=0.8,volume=2.6[r];
        [1:a]tremolo=f=30:d=0.6,volume=0.5[b];
        [r][b]amix=inputs=2:normalize=0,
        afade=t=in:st=0:d=0.2,afade=t=out:st=1.3:d=0.5,
        alimiter=limit=0.9[out]`,
  },

  // A cut accent: fast in, quick out, wide band.
  'whoosh.wav': {
    src: [noise('white', 0.45, 0.8)],
    f: `[0:a]bandpass=f=1600:width_type=q:w=1.8,
        afade=t=in:st=0:d=0.1:curve=exp,afade=t=out:st=0.12:d=0.3,
        aecho=0.7:0.5:70:0.2,volume=1.5[out]`,
  },

  // One page going over: a brush of high noise with a crackle on the front.
  // Used by the deck, not the film — the book's pages turn to it.
  'page-turn.wav': {
    src: [noise('white', 0.5, 0.7), noise('white', 0.5, 0.5)],
    f: `[0:a]highpass=f=1500,lowpass=f=7000,
        afade=t=in:st=0:d=0.03:curve=exp,afade=t=out:st=0.07:d=0.34:curve=exp,
        volume=1.7[brush];
        [1:a]highpass=f=4200,tremolo=f=48:d=0.9,
        afade=t=in:st=0:d=0.01,afade=t=out:st=0.02:d=0.16:curve=exp,
        volume=0.8[crack];
        [brush][crack]amix=inputs=2:normalize=0,alimiter=limit=0.9[out]`,
  },

  // The hit under the title flash: a noise crack over a long low decay.
  'impact.wav': {
    src: [noise('pink', 1.6, 0.9), tone(48, 1.6), tone(72, 1.6)],
    f: `[0:a]lowpass=f=2600,afade=t=out:st=0.01:d=0.35:curve=exp,volume=1.8[n];
        [1:a]afade=t=out:st=0:d=1.3:curve=exp,volume=0.9[a];
        [2:a]afade=t=out:st=0:d=0.7:curve=exp,volume=0.4[b];
        [n][a][b]amix=inputs=3:normalize=0,alimiter=limit=0.92[out]`,
  },
};

fs.mkdirSync(DIR, { recursive: true });

let built = 0;
for (const [name, spec] of Object.entries(SFX)) {
  const out = path.join(DIR, name);
  if (!force && fs.existsSync(out)) continue;

  const args = ['-y', '-loglevel', 'error'];
  for (const s of spec.src) args.push('-f', 'lavfi', '-i', s);
  args.push('-filter_complex', spec.f.replace(/\s*\n\s*/g, ''),
    '-map', '[out]', '-ar', String(R), '-ac', '1', out);

  const r = spawnSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status !== 0) {
    console.error(`failed: ${name}`);
    process.exit(r.status ?? 1);
  }
  peakNormalise(out);
  built++;
}

/**
 * Bring the file up to a -1 dBFS peak, in place.
 *
 * Oscillator and noise sources come out at wildly different intrinsic levels —
 * filtered pink noise lands tens of dB below a sine. Without this the mix
 * gains are meaningless: the first pass put the forest bed at -47 dB mean,
 * which is inaudible, while the knock and the growl each needed a different
 * arbitrary multiplier. Normalising here makes a gain of 0.5 mean the same
 * thing for every effect.
 */
function peakNormalise(file, targetDb = -1) {
  const probe = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect',
    '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /max_volume:\s*(-?[\d.]+) dB/.exec(probe.stderr || '');
  if (!m) return;
  const gain = targetDb - parseFloat(m[1]);
  if (Math.abs(gain) < 0.2) return;

  const tmp = file + '.tmp.wav';
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file,
    '-af', `volume=${gain.toFixed(2)}dB`, '-ar', String(R), '-ac', '1', tmp],
    { stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status === 0) fs.renameSync(tmp, file);
  else fs.rmSync(tmp, { force: true });
}

const rows = Object.keys(SFX).map((n) => {
  const p = path.join(DIR, n);
  const d = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1', p], { encoding: 'utf8' }).stdout.trim();
  return `  ${n.padEnd(16)} ${(+d).toFixed(2)}s`;
});
console.log(`sfx  assets/audio/sfx/  (${built} built, ${Object.keys(SFX).length} total)`);
console.log(rows.join('\n'));
