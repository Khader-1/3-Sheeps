import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { serve } from './serve.mjs';
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const { server, port } = await serve(0);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 720 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clickables = () => p.evaluate(() => [...document.querySelectorAll('#layer-ui g[cursor="pointer"]')].map((g) => {
  const r = g.getBoundingClientRect();
  return { t: g.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2 };
}));
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/web/game.html`, { waitUntil: 'networkidle0' });
await p.waitForFunction('document.querySelectorAll(\'#layer-ui g[cursor="pointer"]\').length >= 7', { timeout: 90000 });
const tiles = await clickables();
await p.mouse.click(tiles[3].x, tiles[3].y);
await wait(1400);
const start = (await clickables()).find((o) => o.t.includes('ابدأ'));
await p.mouse.click(start.x, start.y);
for (let i = 0; i < 7; i++) { await wait(800); await p.screenshot({ path: `${OUT}/d-${i}.png` }); }
const fire = (await clickables()).find((o) => o.t.includes('أشعل'));
if (fire) await p.mouse.click(fire.x, fire.y);
for (let i = 0; i < 4; i++) { await wait(450); await p.screenshot({ path: `${OUT}/f-${i}.png` }); }
console.log(errs.length ? 'ERRORS: ' + [...new Set(errs)].slice(0, 3).join(' | ') : 'no page errors');
await b.close(); server.close();
