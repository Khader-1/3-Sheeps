// Encode the delivered video for the web.
//
//   node tools/video.mjs                -> every slot that is out of date
//   node tools/video.mjs film           -> just that one
//   node tools/video.mjs --force        -> all of them regardless
//
// The trailers and the film arrive finished, at whatever bitrate the editor
// exported — the first trailer came in at 11.9 Mbps, 36 MB for 25 seconds.
// Two things have to happen to them before they can go on the site.
//
// Cloudflare Pages refuses any single file over 25 MiB, so anything past that
// does not deploy at all. And the footage is flat cartoon animation — large
// areas of one colour, hard edges, no grain — which x264 encodes far below its
// usual rate, so most of that bitrate is buying nothing. CRF 20 took the
// trailers to a fifth of their delivered size with no difference visible at
// full screen.
//
// CRF alone cannot promise a size, though. For a 27-second trailer that is
// fine — CRF 20 lands at 6 MB and there is nothing to decide. For the film it
// is not: 651 seconds inside 23 MiB is 296 kbps for 720p, which is not a
// quality tradeoff, it is a ruined picture.
//
// So the film is not one file. It is cut into six-second segments with an HLS
// playlist over them, and the cap stops being a problem — 67 MB of good
// encode becomes ~110 pieces of about 600 KB. The player fetches the playlist,
// then the first segment, and starts; it never waits on the whole film. That
// is also the fastest possible start, which is the other thing wanted here.
//
// Anything short enough to fit stays a single progressive file. There is no
// reason to make a browser parse a playlist for a 6 MB trailer.
//
// Each entry in SLOTS is a fixed place, not a filename. A new cut of the film
// replaces the film; it never becomes a second film. tools/share.mjs uploads
// into these same slots and runs this afterwards.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 25 MiB is the hard limit; leave room so a re-encode is never a near miss. */
const CAP = 23 * 1048576;
const CRF = '20';
const AUDIO_KBPS = 192;

/** Segment length. Six seconds is the usual HLS compromise: short enough that
 *  playback starts almost at once, long enough that the segments still encode
 *  efficiently and the playlist stays small. */
const SEG = 6;

export const SLOTS = [
  { id: 'promo-1', label: 'إعلان ١', src: 'assets/incoming/إعلانات/1.mp4', out: 'out/promo-1.mp4' },
  { id: 'promo-2', label: 'إعلان ٢', src: 'assets/incoming/إعلانات/2.mp4', out: 'out/promo-2.mp4' },
  // The film is eleven minutes; it streams. CRF 22 with x264's animation
  // tuning — the deblocking that flat cel art wants, and it keeps the frames
  // that matter — puts the whole thing at about 67 MB.
  {
    id: 'film', label: 'الفيلم الكامل',
    src: 'assets/incoming/فيلم/الفيلم.mp4',
    out: 'out/film/film.m3u8', hls: true, crf: '22', tune: 'animation', audioKbps: 128,
  },
];

export const slotById = (id) => SLOTS.find((s) => s.id === id);

/** Seconds, or 0 if ffprobe cannot say. */
export function duration(file) {
  try {
    return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
      '-of', 'csv=p=0', file]).toString().trim()) || 0;
  } catch {
    return 0;
  }
}

/** What a slot currently holds, for the upload page and the CLI. */
export function slotState(slot) {
  const src = path.join(ROOT, slot.src);
  const out = path.join(ROOT, slot.out);
  const stat = (f) => { try { return fs.statSync(f); } catch { return null; } };
  const s = stat(src);
  const o = stat(out);
  return {
    id: slot.id,
    label: slot.label,
    has: !!s,
    srcBytes: s?.size ?? 0,
    outBytes: o?.size ?? 0,
    seconds: o ? duration(out) : s ? duration(src) : 0,
    updated: s?.mtimeMs ?? 0,
    stale: !!s && (!o || o.mtimeMs < s.mtimeMs),
  };
}

const x264 = (extra) => ['-c:v', 'libx264', '-preset', 'slow', ...extra,
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];

/**
 * Encode one slot. Returns null if there is nothing to do.
 *
 * The two-pass fallback writes its log next to the output rather than into the
 * working directory, so two encodes running from different slots cannot read
 * each other's statistics.
 */
export function encodeSlot(slot, { force = false, log = () => {} } = {}) {
  const src = path.join(ROOT, slot.src);
  const out = path.join(ROOT, slot.out);
  if (!fs.existsSync(src)) return null;
  if (!force && fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs) return null;

  fs.mkdirSync(path.dirname(out), { recursive: true });
  const run = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { cwd: ROOT });

  if (slot.hls) {
    const dir = path.dirname(out);
    // Start clean: a shorter cut than last time would otherwise leave the tail
    // of the old one lying next to the new playlist.
    for (const f of fs.readdirSync(dir)) {
      if (/\.(m4s|ts|mp4|m3u8)$/.test(f)) fs.rmSync(path.join(dir, f), { force: true });
    }
    log(`${slot.id}: encoding at CRF ${slot.crf} (${slot.tune}) into ${SEG}s segments`);
    run(['-i', src,
      ...x264(['-crf', slot.crf ?? CRF, ...(slot.tune ? ['-tune', slot.tune] : [])]),
      // A segment can only start on a keyframe, so put one exactly on every
      // boundary. Without this ffmpeg keeps its own GOP structure and the
      // segments come out ragged and longer than asked for.
      '-force_key_frames', `expr:gte(t,n_forced*${SEG})`,
      '-c:a', 'aac', '-b:a', `${slot.audioKbps ?? AUDIO_KBPS}k`,
      '-f', 'hls', '-hls_time', String(SEG), '-hls_playlist_type', 'vod',
      // fMP4 rather than MPEG-TS: no 188-byte packet padding, so the segments
      // are a few percent smaller for the same picture.
      '-hls_segment_type', 'fmp4',
      '-hls_fmp4_init_filename', 'init.mp4',
      '-hls_segment_filename', path.join(dir, 'seg%04d.m4s'),
      '-hls_flags', 'independent_segments',
      out]);

    const parts = fs.readdirSync(dir).filter((f) => f.endsWith('.m4s'));
    const bytes = fs.readdirSync(dir)
      .reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
    const biggest = Math.max(...parts.map((f) => fs.statSync(path.join(dir, f)).size));
    if (biggest > CAP) throw new Error(`${slot.id}: a segment is ${(biggest / 1048576).toFixed(1)} MB, over the cap`);
    return { id: slot.id, out: slot.out, bytes, segments: parts.length, biggest, seconds: duration(src) };
  }

  log(`${slot.id}: encoding at CRF ${CRF}`);
  run(['-i', src, ...x264(['-crf', CRF]), '-c:a', 'aac', '-b:a', `${AUDIO_KBPS}k`, out]);

  let bytes = fs.statSync(out).size;
  let capped = false;

  if (bytes > CAP) {
    const secs = duration(src);
    if (!secs) throw new Error(`${slot.id}: over the cap and ffprobe gave no duration`);
    // Total budget minus the audio track, in kbit/s.
    const kbps = Math.max(200, Math.floor((CAP * 8) / 1000 / secs) - AUDIO_KBPS);
    log(`${slot.id}: ${(bytes / 1048576).toFixed(1)} MB is over the ${CAP / 1048576} MB cap` +
        ` — two-pass at ${kbps} kbps`);
    const passlog = out + '.pass';
    run(['-i', src, ...x264(['-b:v', `${kbps}k`, '-pass', '1', '-passlogfile', passlog]), '-an', '-f', 'mp4', '/dev/null']);
    run(['-i', src, ...x264(['-b:v', `${kbps}k`, '-pass', '2', '-passlogfile', passlog]), '-c:a', 'aac', '-b:a', `${AUDIO_KBPS}k`, out]);
    for (const f of fs.readdirSync(path.dirname(out))) {
      if (f.startsWith(path.basename(passlog))) fs.rmSync(path.join(path.dirname(out), f), { force: true });
    }
    bytes = fs.statSync(out).size;
    capped = true;
  }

  return { id: slot.id, out: slot.out, bytes, capped, seconds: duration(out) };
}

export function buildVideo({ force = false, only = null, log = () => {} } = {}) {
  const done = [];
  for (const slot of SLOTS) {
    if (only && slot.id !== only) continue;
    const r = encodeSlot(slot, { force, log });
    if (r) done.push(r);
  }
  return done;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const only = args.find((a) => !a.startsWith('-')) || null;
  if (only && !slotById(only)) {
    console.error(`unknown slot "${only}" — try: ${SLOTS.map((s) => s.id).join(', ')}`);
    process.exit(1);
  }
  const done = buildVideo({ force: args.includes('--force'), only, log: (m) => console.log('  ' + m) });
  if (!done.length) console.log('video  nothing to do');
  for (const r of done) {
    const size = `${(r.bytes / 1048576).toFixed(1)} MB, ${r.seconds.toFixed(0)}s`;
    console.log(r.segments
      ? `video  ${r.out}  (${size}, ${r.segments} segments, largest ${(r.biggest / 1048576).toFixed(1)} MB)`
      : `video  ${r.out}  (${size}${r.capped ? ', rate-capped to fit' : ''})`);
  }
}
