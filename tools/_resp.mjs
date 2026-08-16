// Screenshot the menu and one game across very different screen shapes.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { serve } from './serve.mjs';
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const SIZES = [
  [2560, 1080, 'ultrawide'], [1792, 838, 'phone-landscape-wide'],
  [1440, 900, 'laptop'], [1024, 768, 'ipad-4x3'],
  [390, 844, 'phone-portrait'], [768, 1024, 'ipad-portrait'],
];
const { server, port } = await serve(0);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [w, h, name] of SIZES) {
  const p = await b.newPage();
  await p.setViewport({ width: w, height: h });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/web/game.html`, { waitUntil: 'networkidle0' });
  await p.waitForFunction('document.querySelectorAll(\'#layer-ui g[cursor="pointer"]\').length >= 7', { timeout: 60000 }).catch(() => {});
  await wait(700);
  await p.screenshot({ path: `${OUT}/${name}-menu.png` });
  const tiles = await p.evaluate(() => [...document.querySelectorAll('#layer-ui g[cursor="pointer"]')].map((g) => {
    const r = g.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  }));
  const off = tiles.filter((t) => t.x < 0 || t.y < 0 || t.x + t.w > w || t.y + t.h > h).length;
  console.log(`${name.padEnd(22)} ${String(w).padStart(4)}x${h}  tiles ${tiles.length}  offscreen ${off}  ${errs.length ? 'ERR ' + errs[0].slice(0,40) : ''}`);
  await p.close();
}
await b.close(); server.close();
