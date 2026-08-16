// Play المدخنة to an end screen, hit "مرة أخرى", and prove the wolf moves again.
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
const ui = () => p.evaluate(() => [...document.querySelectorAll('#layer-ui g[cursor="pointer"]')].map((g) => {
  const r = g.getBoundingClientRect();
  return { t: g.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2 };
}));
const wolfY = () => p.evaluate(() => {
  const g = [...document.querySelectorAll('#layer-world g')].find((n) => (n.getAttribute('transform') || '').startsWith('translate(0 '));
  const m = g && /translate\(0 (-?[\d.]+)/.exec(g.getAttribute('transform'));
  return m ? parseFloat(m[1]) : null;
});

await p.goto(`http://127.0.0.1:${port}/web/game.html`, { waitUntil: 'networkidle0' });
await p.waitForFunction('document.querySelectorAll(\'#layer-ui g[cursor="pointer"]\').length >= 7', { timeout: 90000 });
const tiles = await ui();
await p.mouse.click(tiles[3].x, tiles[3].y);
await wait(1400);
await p.mouse.click((await ui()).find((o) => o.t.includes('ابدأ')).x, (await ui()).find((o) => o.t.includes('ابدأ')).y);

for (let i = 0; i < 30; i++) {
  await wait(500);
  if ((await p.evaluate(() => document.body.innerText)).includes('أمسكَ')) break;
}
console.log('round 1 ended');

const again = (await ui()).find((o) => o.t.includes('مرة أخرى'));
await p.mouse.click(again.x, again.y);
await wait(1200);
const a = await wolfY();
await wait(2500);
const c = await wolfY();
await p.screenshot({ path: `${OUT}/replay.png` });
console.log(`wolf depth after replay: ${a} -> ${c}`);
console.log(a !== null && c !== null && Math.abs(c - a) > 5 ? 'PASS: he descends again' : 'FAIL: still frozen');
await b.close(); server.close();
