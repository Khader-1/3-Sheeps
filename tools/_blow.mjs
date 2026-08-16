// Play ابنِ بيتك through to the wolf's arrival and check he clears the house.
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
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
const ui = () => p.evaluate(() => [...document.querySelectorAll('#layer-ui g[cursor="pointer"]')].map((g) => {
  const r = g.getBoundingClientRect();
  return { t: g.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2 };
}));
await p.goto(`http://127.0.0.1:${port}/web/game.html`, { waitUntil: 'networkidle0' });
await p.waitForFunction('document.querySelectorAll(\'#layer-ui g[cursor="pointer"]\').length >= 7', { timeout: 90000 });
await p.mouse.click((await ui())[0].x, (await ui())[0].y);
await wait(1300);
await p.mouse.click((await ui()).find((o) => o.t.includes('ابدأ')).x, (await ui()).find((o) => o.t.includes('ابدأ')).y);
// build all three parts: pick stone each time, press immediately
for (let i = 0; i < 3; i++) {
  await wait(900);
  const mats = (await ui()).filter((o) => /قش|حطب|حجارة/.test(o.t));
  if (!mats.length) break;
  await p.mouse.click(mats[2].x, mats[2].y);
  await wait(800);
  const press = (await ui()).find((o) => o.t.includes('اضغط'));
  if (press) await p.mouse.click(press.x, press.y);
  await wait(1300);
}
await wait(2200);
await p.screenshot({ path: `${OUT}/arrive.png` });
await wait(1600);
await p.screenshot({ path: `${OUT}/blow.png` });
console.log(errs.length ? 'ERRORS: ' + [...new Set(errs)].slice(0,2).join(' | ') : 'no page errors');
await b.close(); server.close();
