// Click all the way through one care bar in ابنِ بيتك and report what breaks.
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
p.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/404|moveto/.test(m.text())) errs.push('CONSOLE: ' + m.text()); });
const ui = () => p.evaluate(() => [...document.querySelectorAll('#layer-ui g[cursor="pointer"]')].map((g) => {
  const r = g.getBoundingClientRect();
  return { t: g.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2 };
}));
const txt = () => p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 90));

await p.goto(`http://127.0.0.1:${port}/web/game.html`, { waitUntil: 'networkidle0' });
await p.waitForFunction('document.querySelectorAll(\'#layer-ui g[cursor="pointer"]\').length >= 7', { timeout: 90000 });
await p.mouse.click((await ui())[0].x, (await ui())[0].y);          // ابنِ بيتك
await wait(1400);
await p.mouse.click((await ui()).find((o) => o.t.includes('ابدأ')).x, (await ui()).find((o) => o.t.includes('ابدأ')).y);
await wait(1000);
console.log('material screen:', await txt());

const mats = (await ui()).filter((o) => /قش|حطب|حجارة/.test(o.t));
console.log('materials found:', mats.map((m) => m.t).join(' / '));
await p.mouse.click(mats[0].x, mats[0].y);                           // قش
await wait(1000);
console.log('care screen:', await txt());
await p.screenshot({ path: `${OUT}/1-care.png` });

const press = (await ui()).find((o) => o.t.includes('اضغط'));
console.log('press button present:', !!press);
if (press) {
  await p.mouse.click(press.x, press.y);
  await wait(1600);
  await p.screenshot({ path: `${OUT}/2-after-press.png` });
  console.log('after press:', await txt());
}
console.log(errs.length ? errs.slice(0, 4).join('\n') : 'no errors');
await b.close(); server.close();
