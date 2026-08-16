// Build the teaser's audio bed from the project's own voice recordings, and
// emit a per-cue amplitude envelope so the characters can actually lip-sync to
// them instead of idling while a voice plays.
//
//   node tools/mixaudio.mjs                 voice + effects  -> promo-audio.*
//   node tools/mixaudio.mjs --narrated      + narration + music -> promo-narrated-audio.*
//
// Outputs:
//   out/promo-audio.m4a    the mixed track (voice + effects)
//   out/promo-audio.json   { total, fps, cues:[{ at, dur, speaker, env:[…] }] }
//
// The envelope is per-frame RMS of the trimmed segment, normalised 0..1. It is
// not phoneme detection — it drives mouth openness, which at 24fps reads
// convincingly as speech and stays exactly in step with the track.
//
// Trim in/out points are estimates from the script and clip length, not from
// listening; adjust per cue if a word gets clipped.
//
// Effects come from assets/audio/sfx (see tools/gen-sfx.mjs). Their placement
// is derived from the same beat times and the same walk-cycle maths the
// picture uses, so footfalls land on footfalls — see BEATS and footfalls()
// below, which mirror src/targets/promo.js and src/anim/gait.js. Changing a
// shot length in the teaser means changing BEATS here too.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V = path.join(ROOT, 'assets/audio/صوتيات');
const NARRATED = process.argv.includes('--narrated');
// --plain uses the tanween-free narration: same lines, less formal delivery.
const PLAIN = process.argv.includes('--plain');
const stem = NARRATED
  ? (PLAIN ? 'promo-narrated-plain-audio' : 'promo-narrated-audio')
  : 'promo-audio';
const OUT = path.join(ROOT, `out/${stem}.m4a`);
const JSON_OUT = path.join(ROOT, `out/${stem}.json`);
const FPS = 24;
// Must exceed the picture (26.85s). The renderer muxes with -shortest, so an
// audio bed shorter than the film silently truncates the title card.
const TOTAL = 27.0;

// Kept deliberately short — these are teaser stings, not lines of dialogue.
const CUES = [
  {
    speaker: 'big',
    file: 'المشهد الرابع/الخروف الاكبر1.mp3',
    at: 2.85, in: 0.0, out: 2.1,
    label: 'eldest: we must find a house',
  },
  {
    speaker: 'mid',
    file: 'المشهد الثالث عشر/الخروف الاوسط-1.mp3',
    at: 8.5, in: 0.0, out: 1.5,
    label: 'middle: what is happening?',
  },
  {
    speaker: 'small',
    file: 'المشهد العاشر/الخروف الاصغر-2.mp3',
    at: 15.5, in: 2.7, out: 4.25,
    label: 'smallest: you came to eat me',
  },
  {
    speaker: 'big',
    // Synthesised in the eldest's own cloned voice rather than cut from tape.
    // The take says «أما عندي خطة للإيقاع بهذا الذئب الماكر» in one breath, and
    // no trim of it yields «أنا عندي خطة» cleanly — every candidate boundary
    // either clipped a word or dragged in the rest of the sentence. Generating
    // the line keeps the voice and gets the words the teaser actually wants.
    src: 'out/tts/lines/big-plan.wav',
    // out: null means "however long the file is" — a generated line's length
    // changes every time its tempo or wording is tuned, and a hardcoded number
    // silently clips it.
    at: 18.05, in: 0, out: null,
    label: 'eldest: I have a plan (cloned)',
  },
];

// Beat times, mirroring src/targets/promo.js.
const BEATS = {
  fieldAt: 2.3, fieldDur: 2.8, walkFrac: 0.92,
  houseCuts: 5.1,
  doorAt: 6.699,
  midAt: 7.599,
  lairAt: 10.049,
  fragEnds: [10.949, 11.849, 13.049],
  prowlAt: 13.049, prowlDur: 2.2,
  standAt: 19.949,
  titleFlash: 22.369, titleAt: 22.449,
};

/**
 * Footfall times for one walk cycle, using the same maths as addWalk().
 *
 * The body dips at |sin(cyc)| peaks, which is where a foot plants, so a
 * footfall is at cyc = pi/2 + k*pi — i.e. progress*steps + phase = 0.25 + k/2.
 * Solving for progress and scaling by the duration puts the sound exactly on
 * the picture instead of near it.
 */
function footfalls(at, dur, steps, phase, { every = 1 } = {}) {
  const out = [];
  for (let k = 0; ; k++) {
    const e = (0.25 + 0.5 * k - phase) / steps;
    if (e > 1) break;
    if (e >= 0 && k % every === 0) out.push(+(at + e * dur).toFixed(3));
  }
  return out;
}

const WALK_DUR = BEATS.fieldDur * BEATS.walkFrac;
const WALK_STEPS = Math.round(WALK_DUR * 1.7);

// Every other footfall per sheep. All eight of each would be twenty-four hits
// in two and a half seconds, which reads as a drum roll rather than a walk.
const SHEEP_STEPS = [0.13, 0.51, 0.82].flatMap((phase) =>
  footfalls(BEATS.fieldAt, WALK_DUR, WALK_STEPS, phase, { every: 2 }));

const WOLF_STEPS = footfalls(BEATS.prowlAt, BEATS.prowlDur, 1.2, 0);

const rap = (t) => [t, t + 0.165, t + 0.33];

// Gains are relative to a -1 dBFS peak on every effect (tools/gen-sfx.mjs
// normalises them), so these numbers read as intent: 0.6 is a foreground
// story beat, 0.3 sits under the picture, 0.07 is a bed you notice only when
// it stops.
const SFX = [
  // Outdoor bed. Only over the exterior shots — the door, the two interiors
  // and the plan are inside, and wind under them would read as a mistake.
  { file: 'forest.wav', at: 0,               dur: 5.1,  gain: 0.11 },
  { file: 'forest.wav', at: BEATS.lairAt,    dur: 5.2,  gain: 0.095 },
  { file: 'forest.wav', at: BEATS.standAt,   dur: 2.5,  gain: 0.09 },
  { file: 'forest.wav', at: BEATS.titleAt,   dur: 4.4,  gain: 0.075 },

  // No birds. They were the only cue that read as decoration rather than as
  // part of the scene, and with music now under the opening there is nothing
  // for them to fill.

  ...SHEEP_STEPS.map((at) => ({ file: 'step-grass.wav', at, gain: 0.11 })),
  ...WOLF_STEPS.map((at) => ({ file: 'step-wolf.wav', at, gain: 0.30 })),

  // Two groups, matching the two camera shakes on the door.
  ...rap(BEATS.doorAt + 0.1).map((at) => ({ file: 'knock.wav', at, gain: 0.60 })),
  ...rap(BEATS.doorAt + 0.5).slice(0, 2).map((at) => ({ file: 'knock.wav', at, gain: 0.52 })),

  // Cut accents on the two flashes between reveal fragments.
  { file: 'whoosh.wav', at: BEATS.fragEnds[0], gain: 0.30 },
  { file: 'whoosh.wav', at: BEATS.fragEnds[1], gain: 0.34 },

  { file: 'breath.wav', at: BEATS.fragEnds[0] + 0.1, gain: 0.30 },
  // Starts just before the pull-out so the growl is what reveals him.
  { file: 'growl.wav',  at: BEATS.prowlAt - 0.2, gain: 0.42 },

  { file: 'impact.wav', at: BEATS.titleFlash, gain: 0.62 },
];

// ---- narration and music (the --narrated cut) ------------------------------
//
// Narration is the film's own narrator, cloned with XTTS-v2 and generated by
// tools/tts-narration.py. Every line sits in a gap between the characters'
// recorded dialogue — the picture is already cut to those lines, so narration
// has to live between them rather than over them.
const NARRATION = [
  { file: 'open.wav',  at: 1.10, gain: 1.0 },   // ends 2.70, just before «يجب علينا أن نجد منزلاً» at 2.85
  { file: 'build.wav', at: 5.20, gain: 1.0 },   // over the three house cuts
  // Two halves with a deliberate 0.88s of silence between them. The pause is
  // the point — «ذئبٌ جائع» lands during the pull-out to the full wolf, and
  // the gap is what makes it a reveal rather than a subordinate clause.
  { file: 'wolf-a.wav', at: 10.05, gain: 1.0 },  // ends 12.92
  { file: 'wolf-b.wav', at: 13.80, gain: 1.0 },  // ends 15.32, clear of «أتيت لتأكلني» at 15.5
  { file: 'ask.wav',   at: 20.10, gain: 1.0 },  // the closing question
  { file: 'title.wav', at: 22.70, gain: 1.0 },  // over the title card
];

// Three ACE-Step cues, cut to the teaser's three movements. Both cuts get
// them. Levels are low because the sidechain below ducks them under speech,
// but the resting level still has to sit beneath the recordings.
//
// A-warm opens at full level: a gradual fade-in reads as the film not having
// started yet. 60ms is only there to avoid a click on the first sample. The
// two later cues get a short fade because they enter mid-scene, where a hard
// cut would be heard as a mistake rather than as an entrance.
const MUSIC = [
  { file: 'A-warm.wav',    at: 0.0,   gain: 0.36, fadeIn: 0.06, fadeOut: 1.6 },
  { file: 'B-tension.wav', at: 9.6,   gain: 0.34, fadeIn: 0.40, fadeOut: 2.0 },
  { file: 'C-title.wav',   at: 22.30, gain: 0.36, fadeIn: 0.25, fadeOut: 2.4 },
];

const NARR_DIR = path.join(ROOT, PLAIN ? 'out/tts/narration-plain' : 'out/tts/narration');
const MUSIC_DIR = path.join(ROOT, 'out/music');

const narration = NARRATED
  ? NARRATION.filter((n) => fs.existsSync(path.join(NARR_DIR, n.file)))
  : [];
const music = MUSIC.filter((m) => fs.existsSync(path.join(MUSIC_DIR, m.file)));

{
  const missN = NARRATED
    ? NARRATION.filter((n) => !fs.existsSync(path.join(NARR_DIR, n.file)))
    : [];
  const missM = MUSIC.filter((m) => !fs.existsSync(path.join(MUSIC_DIR, m.file)));
  // Missing pieces are reported and skipped rather than fatal: the music cues
  // arrive one at a time over several hours, and a mix with two of three is
  // still worth hearing.
  if (missN.length) console.warn('narration missing: ' + missN.map((n) => n.file).join(', '));
  if (missM.length) console.warn('music not ready yet: ' + missM.map((m) => m.file).join(', '));
}

const SFX_DIR = path.join(ROOT, 'assets/audio/sfx');
const missingSfx = [...new Set(SFX.map((s) => s.file))]
  .filter((f) => !fs.existsSync(path.join(SFX_DIR, f)));
if (missingSfx.length) {
  console.error('missing effects: ' + missingSfx.join(', ') + '\n  run: node tools/gen-sfx.mjs');
  process.exit(1);
}

/** A cue's audio: a recording under صوتيات, or a generated file under out/. */
const cuePath = (c) => (c.src ? path.join(ROOT, c.src) : path.join(V, c.file));

/** Fill in `out` for any cue that asked for its whole file. */
function resolveEnds() {
  for (const c of CUES) {
    if (c.out != null) continue;
    const d = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=nw=1:nk=1', cuePath(c)], { encoding: 'utf8' }).stdout.trim();
    c.out = Math.max(0.05, (+d || 0) - 0.01);
  }
}

const missing = CUES.filter((c) => !fs.existsSync(cuePath(c)));
if (missing.length) {
  console.error('missing clips:\n  ' + missing.map((m) => m.src || m.file).join('\n  '));
  process.exit(1);
}

/** Per-frame RMS envelope of a trimmed segment, normalised to 0..1. */
function envelope(file, tin, tout) {
  const r = spawnSync('ffmpeg', [
    '-v', 'error', '-ss', String(tin), '-to', String(tout), '-i', file,
    '-ac', '1', '-ar', '48000', '-f', 's16le', '-',
  ], { maxBuffer: 1 << 28, encoding: 'buffer' });
  if (r.status !== 0) throw new Error('ffmpeg decode failed for ' + file);

  const pcm = new Int16Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 2));
  const per = Math.floor(48000 / FPS);
  const n = Math.max(1, Math.floor(pcm.length / per));
  const env = [];
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = i * per; j < (i + 1) * per && j < pcm.length; j++) {
      const v = pcm[j] / 32768;
      sum += v * v;
    }
    env.push(Math.sqrt(sum / per));
  }
  const peak = Math.max(...env, 1e-6);
  // Slight gamma so quiet consonants still open the mouth a little.
  return env.map((v) => Math.min(1, (v / peak) ** 0.65));
}

resolveEnds();

// ---- mix ------------------------------------------------------------------
// One ffmpeg input per distinct file. An effect used many times (a footstep is
// used twelve) is decoded once and asplit into copies, rather than opened once
// per placement — thirty-odd inputs would make the command unwieldy and the
// decode redundant.
const args = ['-y', '-loglevel', 'error',
  '-f', 'lavfi', '-t', String(TOTAL), '-i', 'anullsrc=r=48000:cl=stereo'];
for (const c of CUES) args.push('-i', cuePath(c));

const sfxFiles = [...new Set(SFX.map((s) => s.file))];
for (const f of sfxFiles) args.push('-i', path.join(SFX_DIR, f));

const parts = [];
const labels = ['[0:a]'];

CUES.forEach((c, i) => {
  const ms = Math.round(c.at * 1000);
  const len = c.out - c.in;
  parts.push(
    `[${i + 1}:a]atrim=start=${c.in}:end=${c.out},asetpts=PTS-STARTPTS,` +
    `afade=t=in:st=0:d=0.05,afade=t=out:st=${(len - 0.08).toFixed(2)}:d=0.08,` +
    `aresample=48000,adelay=${ms}|${ms}[c${i}]`
  );
  labels.push(`[c${i}]`);
});

sfxFiles.forEach((file, fi) => {
  const uses = SFX.filter((s) => s.file === file);
  const input = 1 + CUES.length + fi;
  const tags = uses.map((_, k) => `[x${fi}_${k}]`);
  parts.push(`[${input}:a]asplit=${uses.length}${tags.join('')}`);

  uses.forEach((u, k) => {
    const ms = Math.round(u.at * 1000);
    // A `dur` shortens the source and re-fades it, for the ambience beds that
    // are cut to a shot rather than played whole.
    const trim = u.dur
      ? `atrim=start=0:end=${u.dur},asetpts=PTS-STARTPTS,` +
        `afade=t=in:st=0:d=0.5,afade=t=out:st=${(u.dur - 0.5).toFixed(2)}:d=0.5,`
      : '';
    parts.push(
      `[x${fi}_${k}]${trim}volume=${u.gain},aformat=channel_layouts=stereo,` +
      `aresample=48000,adelay=${ms}|${ms}[s${fi}_${k}]`
    );
    labels.push(`[s${fi}_${k}]`);
  });
});

// Narration joins the voice bus, so the music ducks under it too.
narration.forEach((n, i) => {
  const input = 1 + CUES.length + sfxFiles.length + i;
  args.push('-i', path.join(NARR_DIR, n.file));
  const ms = Math.round(n.at * 1000);
  parts.push(
    `[${input}:a]volume=${n.gain},aformat=channel_layouts=stereo,` +
    `aresample=48000,adelay=${ms}|${ms}[n${i}]`
  );
  labels.push(`[n${i}]`);
});

// Voice bus is built first and reused twice: once as the mix's speech, once as
// the sidechain key that pushes the music down. Splitting is what lets one
// signal do both without decoding it again.
parts.push(
  `${labels.join('')}amix=inputs=${labels.length}:duration=first:` +
  `dropout_transition=0:normalize=0[speech]`
);

if (music.length) {
  music.forEach((m, i) => {
    const input = 1 + CUES.length + sfxFiles.length + narration.length + i;
    args.push('-i', path.join(MUSIC_DIR, m.file));
    const ms = Math.round(m.at * 1000);
    parts.push(
      `[${input}:a]volume=${m.gain},afade=t=in:st=0:d=${m.fadeIn},` +
      `areverse,afade=t=in:st=0:d=${m.fadeOut},areverse,` +
      `aformat=channel_layouts=stereo,aresample=48000,adelay=${ms}|${ms}[mu${i}]`
    );
  });
  const musicMix = music.length > 1
    ? `${music.map((_, i) => `[mu${i}]`).join('')}amix=inputs=${music.length}:` +
      `duration=longest:dropout_transition=0:normalize=0[music]`
    : '[mu0]anull[music]';
  parts.push(musicMix);

  // Duck the music under speech automatically instead of automating a gain
  // curve by hand — every change to a line's timing would otherwise mean
  // redrawing that curve.
  parts.push('[speech]asplit=2[sp_out][sp_key]');
  parts.push('[music][sp_key]sidechaincompress=threshold=0.03:ratio=7:attack=12:release=420[duck]');
  parts.push('[sp_out][duck]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[m]');
} else {
  parts.push('[speech]anull[m]');
}

parts.push('[m]alimiter=limit=0.95[out]');

args.push('-filter_complex', parts.join(';'), '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', OUT);
const r = spawnSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] });
if (r.status !== 0) process.exit(r.status ?? 1);

// ---- envelopes ------------------------------------------------------------
const cues = CUES.map((c) => ({
  speaker: c.speaker,
  at: c.at,
  dur: +(c.out - c.in).toFixed(3),
  label: c.label,
  env: envelope(cuePath(c), c.in, c.out).map((v) => +v.toFixed(3)),
}));

fs.writeFileSync(JSON_OUT, JSON.stringify({ total: TOTAL, fps: FPS, cues }, null, 1));

console.log(`audio  out/${stem}.m4a   (${TOTAL}s)${NARRATED ? '  [narrated]' : ''}`);
console.log(`sync   out/${stem}.json  (${FPS}fps envelopes)`);
for (const c of cues) {
  console.log(`  ${String(c.at).padStart(6)}s  ${c.dur.toFixed(2)}s  ${String(c.env.length).padStart(3)}f  ${c.speaker.padEnd(6)} ${c.label}`);
}
if (NARRATED) {
  console.log(`narr   ${narration.length} lines, cloned narrator`);
  for (const n of narration) console.log(`  ${String(n.at).padStart(6)}s  ${n.file}`);
}
console.log(`music  ${music.length} cues, ducked under speech`);
for (const m of music) console.log(`  ${String(m.at).padStart(6)}s  ${m.file}`);
const bySfx = {};
for (const s of SFX) bySfx[s.file] = (bySfx[s.file] || 0) + 1;
console.log(`sfx    ${SFX.length} placements from ${Object.keys(bySfx).length} effects`);
for (const [f, n] of Object.entries(bySfx)) {
  console.log(`  ${String(n).padStart(3)}x  ${f}`);
}
