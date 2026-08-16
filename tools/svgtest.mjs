// Test a local SVG-generating model and render what it produces.
//
//   node tools/svgtest.mjs "a flat cartoon bundle of straw"
//   node tools/svgtest.mjs --preset=game-icons
//
// The interesting question is not whether the model emits SVG — it will — but
// whether the SVG is (a) valid, (b) actually the thing asked for, and (c)
// structured well enough to be useful. So every result is rendered to PNG and
// its path count reported: a usable asset is a handful of named shapes, not
// four hundred anonymous paths.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const MODEL = process.env.SVG_MODEL || 'hf.co/mradermacher/SVGThinker-7B-GGUF:Q4_K_M';
const OUT = 'out/svgtest';
fs.mkdirSync(OUT, { recursive: true });

// Prompts chosen from things the project actually needs, so a good result is
// immediately usable rather than a demo.
const PRESETS = {
  'game-icons': [
    ['straw', 'a flat cartoon icon of a bundle of golden straw, thick black outline, simple shapes, no gradients'],
    ['wood', 'a flat cartoon icon of a stack of brown wooden logs, thick black outline, simple shapes, no gradients'],
    ['stone', 'a flat cartoon icon of a grey stone brick wall block, thick black outline, simple shapes, no gradients'],
  ],
};

const argv = process.argv.slice(2);
const presetArg = argv.find((a) => a.startsWith('--preset='));
const jobs = presetArg
  ? PRESETS[presetArg.split('=')[1]] || []
  : [['prompt', argv.filter((a) => !a.startsWith('--')).join(' ')]];

if (!jobs.length || !jobs[0][1]) {
  console.error('usage: node tools/svgtest.mjs "<prompt>"  |  --preset=game-icons');
  process.exit(1);
}

/** Pull the first <svg>…</svg> out of whatever the model wrote around it. */
function extractSvg(text) {
  const m = text.match(/<svg[\s\S]*?<\/svg>/i);
  return m ? m[0] : null;
}

console.log(`model ${MODEL}\n`);
for (const [name, prompt] of jobs) {
  const t0 = Date.now();
  const r = spawnSync('ollama', ['run', MODEL, prompt], {
    encoding: 'utf8', maxBuffer: 1 << 26,
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(0);

  if (r.status !== 0) {
    console.log(`  FAIL ${name}: ${(r.stderr || '').trim().slice(0, 160)}`);
    continue;
  }
  const raw = r.stdout || '';
  fs.writeFileSync(path.join(OUT, `${name}.txt`), raw);

  const svg = extractSvg(raw);
  if (!svg) {
    console.log(`  ${name}: no <svg> in ${raw.length} chars of output  (${secs}s)`);
    continue;
  }

  const svgFile = path.join(OUT, `${name}.svg`);
  fs.writeFileSync(svgFile, svg);
  const paths = (svg.match(/<(path|rect|circle|ellipse|polygon|polyline)\b/g) || []).length;

  // Render it. rsvg-convert if present, otherwise Chrome headless.
  const png = path.join(OUT, `${name}.png`);
  let ok = spawnSync('rsvg-convert', ['-w', '512', '-o', png, svgFile]).status === 0;
  if (!ok) {
    ok = spawnSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      ['--headless', '--disable-gpu', '--screenshot=' + png, '--window-size=512,512',
       '--default-background-color=FFFFFFFF', 'file://' + path.resolve(svgFile)],
      { stdio: 'ignore' }).status === 0;
  }
  console.log(`  ${name.padEnd(8)} ${String(paths).padStart(4)} shapes  ${secs}s  ${ok ? png : 'render failed'}`);
}
