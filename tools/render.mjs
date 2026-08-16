// Frame-exact renderer.
//
//   node tools/render.mjs promo                     -> out/promo.mp4
//   node tools/render.mjs promo --format=mov        -> alpha MOV (Moho import)
//   node tools/render.mjs promo --format=png        -> PNG sequence (Moho import)
//   node tools/render.mjs promo --format=mp4,mov,png
//   node tools/render.mjs promo --fps=24 --scale=1 --range=2:6
//
// The page exposes window.__film = { duration, seek(t) }. Frames are produced
// by seeking to an exact time and screenshotting — never by letting an
// animation run in real time — so no frame is ever dropped or duplicated and
// a re-render is bit-identical.
//
// Frames stream straight into ffmpeg's stdin; nothing large hits the disk
// unless a PNG sequence was asked for.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { serve } from './serve.mjs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const argv = process.argv.slice(2);
const target = argv.find((a) => !a.startsWith('-')) || 'promo';
const opt = (name, def) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : def;
};

const fps = Number(opt('fps', 24));
const scale = Number(opt('scale', 1));
const formats = String(opt('format', 'mp4')).split(',').map((s) => s.trim()).filter(Boolean);
const audioArg = opt('audio', '');
const range = opt('range', '');
const quiet = argv.includes('--quiet');

const { server, port, root } = await serve(0);
const OUT = path.join(root, 'out');
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--allow-file-access-from-files',
    '--font-render-hinting=none',
    '--force-color-profile=srgb',
    '--disable-lcd-text',
    '--hide-scrollbars',
  ],
});

let code = 0;
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto(
    `http://127.0.0.1:${port}/web/film.html?target=${encodeURIComponent(target)}`,
    { waitUntil: 'networkidle0' }
  );
  await page.waitForFunction('window.__ready === true', { timeout: 120000 });

  const err = await page.evaluate(() => window.__error);
  if (err) throw new Error('target failed:\n' + err);

  const meta = await page.evaluate(() => ({
    duration: window.__film.duration,
    width: window.__film.width,
    height: window.__film.height,
    audio: window.__film.audio || null,
  }));

  const [t0, t1] = range
    ? range.split(':').map(Number)
    : [0, meta.duration];
  const first = Math.round(t0 * fps);
  const last = Math.max(first, Math.round(t1 * fps) - 1);
  const total = last - first + 1;

  const W = Math.round(meta.width * scale);
  const H = Math.round(meta.height * scale);
  await page.setViewport({ width: meta.width, height: meta.height, deviceScaleFactor: scale });

  const alpha = formats.includes('mov') || formats.includes('png');
  if (alpha) await page.evaluate(() => window.__film.setTransparent?.(true));

  log(`${target}: ${meta.duration.toFixed(2)}s @ ${fps}fps = ${total} frames, ${W}×${H}`);
  log(`formats: ${formats.join(', ')}`);

  // ---- encoders ---------------------------------------------------------
  const audioFile = resolveAudio(audioArg || meta.audio, root);
  if (audioFile) log(`audio: ${path.relative(root, audioFile)}`);

  const sinks = [];
  for (const f of formats) {
    if (f === 'png') {
      const dir = path.join(OUT, `${target}_png`);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      sinks.push({ kind: 'png', dir, n: first });
    } else {
      sinks.push({ kind: f, proc: encoder(f, { W, H, fps, target, OUT, audioFile, alpha }) });
    }
  }

  // ---- frame loop -------------------------------------------------------
  const started = Date.now();
  for (let i = first; i <= last; i++) {
    const t = i / fps;
    await page.evaluate((tt) => window.__film.seek(tt), t);
    const buf = await page.screenshot({
      type: 'png',
      omitBackground: alpha,
      captureBeyondViewport: false,
    });

    for (const s of sinks) {
      if (s.kind === 'png') {
        fs.writeFileSync(path.join(s.dir, `${target}_${String(s.n++).padStart(5, '0')}.png`), buf);
      } else if (!s.proc.stdin.write(buf)) {
        await new Promise((res) => s.proc.stdin.once('drain', res));
      }
    }

    if (!quiet && (i - first) % fps === 0) {
      const done = i - first + 1;
      const pct = ((done / total) * 100).toFixed(0);
      const rate = done / ((Date.now() - started) / 1000);
      process.stdout.write(`\r  ${pct}%  frame ${done}/${total}  ${rate.toFixed(1)} fps  `);
    }
  }
  if (!quiet) process.stdout.write('\r' + ' '.repeat(56) + '\r');

  for (const s of sinks) {
    if (s.kind === 'png') {
      log(`png  out/${target}_png/  (${total} frames)`);
    } else {
      s.proc.stdin.end();
      await new Promise((res) => s.proc.on('close', res));
    }
  }

  for (const f of formats) {
    if (f === 'png') continue;
    const file = path.join(OUT, `${target}.${f}`);
    if (fs.existsSync(file)) {
      log(`${f.padEnd(4)} out/${target}.${f}  (${(fs.statSync(file).size / 1048576).toFixed(1)} MB)`);
    }
  }

  if (errors.length) {
    console.error('\npage errors:\n  ' + [...new Set(errors)].slice(0, 8).join('\n  '));
  }
} catch (e) {
  console.error(e.message);
  code = 1;
} finally {
  await browser.close();
  server.close();
  process.exit(code);
}

function log(s) {
  if (!quiet) console.log(s);
}

/** Build an ffmpeg process for one output format. */
function encoder(fmt, { W, H, fps, target, OUT, audioFile, alpha }) {
  const out = path.join(OUT, `${target}.${fmt}`);
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-'];

  if (audioFile) args.push('-i', audioFile);

  if (fmt === 'mp4') {
    // yuv420p + even dimensions for universal playback.
    args.push(
      '-vf', `scale=${even(W)}:${even(H)}:flags=lanczos`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '17',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart'
    );
  } else if (fmt === 'mov') {
    // QuickTime Animation keeps the alpha channel; Moho imports this directly.
    args.push('-c:v', 'qtrle', '-pix_fmt', 'argb');
  } else if (fmt === 'webm') {
    args.push('-c:v', 'libvpx-vp9', '-pix_fmt', alpha ? 'yuva420p' : 'yuv420p', '-crf', '28', '-b:v', '0');
  }

  if (audioFile) {
    args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  }
  args.push('-r', String(fps), out);

  const p = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'inherit'] });
  p.stdin.on('error', () => {});
  return p;
}

// Function declaration, not a const: the top-level render loop runs before
// the bottom of this module is evaluated.
function even(n) {
  return n % 2 ? n + 1 : n;
}

function resolveAudio(spec, root) {
  if (!spec) return null;
  const p = path.isAbsolute(spec) ? spec : path.join(root, spec);
  return fs.existsSync(p) ? p : null;
}
