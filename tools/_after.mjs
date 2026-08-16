// After a win/lose screen, do the buttons still work?
// Plays a game to its end, then tries "مرة أخرى" and "القائمة", and reports
// whether the UI responded — plus whether anything is still burning CPU.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { serve } from './serve.mjs';

const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const { server, port } = await serve(0);
const b = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'],
});
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 720 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errs = [];
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

const ui = () => p.evaluate(() => [...document.querySelectorAll('#layer-ui g[cursor="pointer"]')].map((g) => {
  const r = g.getBoundingClientRect();
  return { t: g.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2 };
}));
const text = () => p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 120));

await p.goto(`http://127.0.0.1:${port}/web/game.html`, { waitUntil: 'networkidle0' });
await p.waitForFunction('document.querySelectorAll(\'#layer-ui g[cursor="pointer"]\').length >= 7', { timeout: 90000 });

// اهرب — reaches an end screen on its own since the bot never jumps
const tiles = await ui();
await p.mouse.click(tiles[2].x, tiles[2].y);
await wait(1500);
const start = (await ui()).find((o) => o.t.includes('ابدأ'));
await p.mouse.click(start.x, start.y);

let ended = false;
for (let i = 0; i < 30; i++) {
  await wait(500);
  if ((await text()).includes('أمسكَ')) { ended = true; break; }
}
console.log(`reached end screen: ${ended}`);
await p.screenshot({ path: `${OUT}/1-end.png` });

// how many rAF loops are still alive?
const spinning = await p.evaluate(() => new Promise((res) => {
  let n = 0;
  const t0 = performance.now();
  const tick = () => { n++; if (performance.now() - t0 < 500) requestAnimationFrame(tick); else res(n); };
  requestAnimationFrame(tick);
}));
console.log(`frames in 500ms after end: ${spinning} (60 = normal, 0 = frozen)`);

const again = (await ui()).find((o) => o.t.includes('مرة أخرى'));
console.log(`"مرة أخرى" present: ${!!again}`);
if (again) {
  await p.mouse.click(again.x, again.y);
  await wait(1800);
  await p.screenshot({ path: `${OUT}/2-after-replay.png` });
  console.log(`after replay -> "${await text()}"`);
}

const menu = (await ui()).find((o) => o.t.includes('القائمة'));
console.log(`"القائمة" present: ${!!menu}`);
if (menu) {
  await p.mouse.click(menu.x, menu.y);
  await wait(1800);
  await p.screenshot({ path: `${OUT}/3-after-menu.png` });
  const back = await p.evaluate(() => document.querySelectorAll('#layer-ui g[cursor="pointer"]').length);
  console.log(`menu tiles after returning: ${back} (7 = menu is back)`);
}
console.log(errs.length ? 'ERRORS: ' + [...new Set(errs)].slice(0, 3).join(' | ') : 'no page errors');
await b.close(); server.close();
