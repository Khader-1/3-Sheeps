// Open every game in portrait and screenshot it.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { serve } from './serve.mjs';
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const ORDER = ['build', 'door', 'run', 'chimney', 'whosaid', 'rebuild', 'faces'];
const { server, port } = await serve(0);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < ORDER.length; i++) {
  const p = await b.newPage();
  await p.setViewport({ width: 414, height: 896, isMobile: true });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/web/game.html`, { waitUntil: 'networkidle0' });
  await p.waitForFunction('document.querySelectorAll(\'#layer-ui g[cursor="pointer"]\').length >= 7', { timeout: 60000 }).catch(() => {});
  const ui = () => p.evaluate(() => [...document.querySelectorAll('#layer-ui g[cursor="pointer"]')].map((g) => {
    const r = g.getBoundingClientRect();
    return { t: g.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }));
  const tiles = await ui();
  if (tiles[i]) { await p.mouse.click(tiles[i].x, tiles[i].y); await wait(1500); }
  const start = (await ui()).find((o) => o.t.includes('ابدأ'));
  if (start) { await p.mouse.click(start.x, start.y); await wait(2400); }
  await p.screenshot({ path: `${OUT}/${ORDER[i]}.png` });
  console.log(`${ORDER[i].padEnd(10)} ${errs.length ? 'ERR ' + errs[0].slice(0, 50) : 'ok'}`);
  await p.close();
}
await b.close(); server.close();
