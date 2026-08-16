// Screenshot one mini game.
//
//   node tools/gamecheck.mjs door            -> /tmp/gamecheck/door-*.png
//   node tools/gamecheck.mjs run --hold=6    -> let it run longer before the shot
//
// One game at a time: sweeping all seven takes minutes, and while iterating on
// a single game that wait is the whole cost of the loop.

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { serve } from './serve.mjs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ORDER = ['build', 'door', 'run', 'chimney', 'whosaid', 'rebuild', 'faces'];

const argv = process.argv.slice(2);
const name = argv.find((a) => !a.startsWith('-')) || 'build';
const opt = (k, d) => { const h = argv.find((a) => a.startsWith(`--${k}=`)); return h ? h.split('=')[1] : d; };
const hold = Number(opt('hold', 2.5));
const OUT = opt('out', '/tmp/gamecheck');

const idx = ORDER.indexOf(name);
if (idx < 0) { console.error(`unknown game "${name}". one of: ${ORDER.join(', ')}`); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const { server, port } = await serve(0);
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clickables = () => page.evaluate(() =>
  [...document.querySelectorAll('#layer-ui g[cursor="pointer"], #layer-fx g[cursor="grab"]')]
    .map((g) => { const b = g.getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2, t: g.textContent.trim().slice(0, 24) }; }));

try {
  await page.goto(`http://127.0.0.1:${port}/web/game.html`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(
    `document.querySelectorAll('#layer-ui g[cursor="pointer"]').length >= ${ORDER.length}`,
    { timeout: 90000 });

  const tiles = await clickables();
  await page.mouse.click(tiles[idx].x, tiles[idx].y);
  await wait(1800);
  await page.screenshot({ path: path.join(OUT, `${name}-1-intro.png`) });

  const start = (await clickables()).find((b) => b.t.includes('ابدأ'));
  if (start) { await page.mouse.click(start.x, start.y); await wait(hold * 1000); }
  await page.screenshot({ path: path.join(OUT, `${name}-2-play.png`) });

  console.log(`${name}: ${OUT}/${name}-{1-intro,2-play}.png`);
  if (errs.length) console.log('errors:\n  ' + [...new Set(errs)].slice(0, 8).join('\n  '));
  else console.log('no page errors');
} catch (e) {
  console.error(e.message);
} finally {
  await browser.close();
  server.close();
  process.exit(0);
}
