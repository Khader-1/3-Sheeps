// Full sweep: open every mini game from the menu, start it, screenshot, and
// report any page errors. Run in the background — it takes a few minutes.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { serve } from './serve.mjs';

const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const ORDER = ['build', 'door', 'run', 'chimney', 'whosaid', 'rebuild', 'faces'];
const { server, port } = await serve(0);
const b = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'],
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];

for (let i = 0; i < ORDER.length; i++) {
  const name = ORDER[i];
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 720 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text()); });
  try {
    await p.goto(`http://127.0.0.1:${port}/web/game.html`, { waitUntil: 'networkidle0' });
    await p.waitForFunction('document.querySelectorAll(\'#layer-ui g[cursor="pointer"]\').length >= 7', { timeout: 90000 });
    const clickables = () => p.evaluate(() => [...document.querySelectorAll('#layer-ui g[cursor="pointer"], #layer-fx g[cursor="grab"]')].map((g) => {
      const r = g.getBoundingClientRect();
      return { t: g.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }));
    const tiles = await clickables();
    await p.mouse.click(tiles[i].x, tiles[i].y);
    await wait(1600);
    const start = (await clickables()).find((o) => o.t.includes('ابدأ'));
    if (start) { await p.mouse.click(start.x, start.y); await wait(2600); }
    await p.screenshot({ path: `${OUT}/${name}.png` });
    // did anything actually draw?
    const drawn = await p.evaluate(() => ({
      world: document.querySelectorAll('#layer-world *').length,
      ui: document.querySelectorAll('#layer-ui *').length,
    }));
    results.push({ name, ok: errs.length === 0, drawn, errs: [...new Set(errs)].slice(0, 2) });
  } catch (e) {
    results.push({ name, ok: false, drawn: null, errs: [e.message.slice(0, 70)] });
  }
  await p.close();
}
await b.close(); server.close();

console.log('game        world  ui   status');
for (const r of results) {
  const d = r.drawn ? `${String(r.drawn.world).padStart(5)} ${String(r.drawn.ui).padStart(4)}` : '    -    -';
  console.log(`${r.name.padEnd(11)} ${d}   ${r.ok ? 'ok' : 'FAIL: ' + r.errs.join(' | ')}`);
}
console.log(results.every((r) => r.ok) ? '\nALL PASS' : '\nFAILURES PRESENT');
