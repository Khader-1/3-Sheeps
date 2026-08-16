// Build driver: run a target module in headless Chrome, then write out the
// serialized SVG plus a PNG preview.
//
//   node tools/build.mjs poster
//   node tools/build.mjs inspect --no-svg
//
// The SVG is taken from the live DOM, so getBBox()-derived poses are baked in
// as plain transform attributes and the result is a standalone SVG file.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { serve } from './serve.mjs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('-')) || 'poster';
const wantSvg = !args.includes('--no-svg');
const wantPng = !args.includes('--no-png');
const scale = Number((args.find((a) => a.startsWith('--scale=')) || '').split('=')[1] || 2);

const { server, port, root } = await serve(0);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--allow-file-access-from-files', '--font-render-hinting=none'],
});

try {
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`  [${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`  [pageerror] ${e.message}`));

  await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}/web/build.html?target=${encodeURIComponent(target)}`, {
    waitUntil: 'networkidle0',
  });
  await page.waitForFunction('window.__done === true', { timeout: 60000 });

  const err = await page.evaluate(() => window.__error);
  if (logs.length) console.log(logs.join('\n'));
  if (err) {
    console.error('target failed:\n' + err);
    process.exitCode = 1;
  } else {
    const info = await page.evaluate(() => {
      const svg = document.querySelector('#stage > svg');
      if (!svg) return { text: null, log: window.__log || null };
      return {
        text: new XMLSerializer().serializeToString(svg),
        w: svg.viewBox.baseVal.width || svg.width.baseVal.value,
        h: svg.viewBox.baseVal.height || svg.height.baseVal.value,
        log: window.__log || null,
      };
    });

    if (info.log) console.log(info.log);

    if (info.text) {
      fs.mkdirSync(path.join(root, 'out'), { recursive: true });

      if (wantSvg) {
        const header = '<?xml version="1.0" encoding="UTF-8"?>\n';
        const file = path.join(root, 'out', `${target}.svg`);
        fs.writeFileSync(file, header + info.text, 'utf8');
        console.log(`svg  ${rel(file, root)}  (${(info.text.length / 1024).toFixed(0)} KB, ${Math.round(info.w)}×${Math.round(info.h)})`);
      }

      if (wantPng) {
        // Rasterise by pointing a fresh headless Chrome at the serialized SVG,
        // rather than screenshotting the live page.
        //
        // puppeteer's capture is unreliable here: after the viewport resize
        // that print-sized documents require, elementHandle.screenshot() and
        // page.screenshot() both return a blank white raster for large SVGs
        // (thousands of paths / nested <svg> viewports) — the poster renders,
        // the 9k-path contact sheet does not. A separate Chrome process on the
        // file renders it correctly every time, and our SVGs are fully
        // self-contained (fonts base64-embedded, images as data URIs) so
        // nothing is lost by loading them standalone.
        const tmpSvg = path.join(root, 'out', `.${target}.raster.svg`);
        fs.writeFileSync(tmpSvg, '<?xml version="1.0" encoding="UTF-8"?>\n' + info.text, 'utf8');

        const box = await page.evaluate(() => {
          const r = document.querySelector('#stage > svg').getBoundingClientRect();
          return { w: Math.ceil(r.width), h: Math.ceil(r.height) };
        });

        const file = path.join(root, 'out', `${target}.png`);
        fs.rmSync(file, { force: true });
        await new Promise((res, rej) => {
          const p = spawn(CHROME, [
            '--headless=new', '--disable-gpu', '--hide-scrollbars',
            `--force-device-scale-factor=${scale}`,
            '--virtual-time-budget=20000',
            `--window-size=${box.w},${box.h}`,
            `--screenshot=${file}`,
            `file://${tmpSvg}`,
          ], { stdio: 'ignore' });
          p.on('close', () => res());
          p.on('error', rej);
        });
        fs.rmSync(tmpSvg, { force: true });

        if (fs.existsSync(file)) {
          console.log(`png  ${rel(file, root)}  (${box.w}×${box.h} @${scale}x)`);
        } else {
          console.error('png  FAILED to rasterise');
          process.exitCode = 1;
        }
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

function rel(f, r) {
  return path.relative(r, f);
}
